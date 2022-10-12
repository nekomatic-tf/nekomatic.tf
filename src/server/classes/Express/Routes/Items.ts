import log from '../../../lib/logger';
import express, { Router } from 'express';
import Server from '../../Server';
import { Schema } from '@tf2autobot/tf2-schema';
import SKU from '@tf2autobot/tf2-sku';
import testSKU from '../utils/testSKU';
import getImage from '../utils/getImage';
import generateOldBptfUrl from '../utils/generateOldBptfUrl';
import generateBptfUrl from '../utils/generateBptfUrl';
import { qualityColorHex } from '../../../lib/data';
import generateScmUrl from '../utils/generateScmUrl';
import generateStnTradingUrl from '../utils/generateStnTradingUrl';
import { rateLimiterUsingThirdParty } from '../Middlewares/rateLimiter';

export class Items {
    private isRandom = false;

    private pickedRandomIndex = 0;

    private schema: Schema;

    constructor(private readonly server: Server) {
        this.schema = this.server.schemaManagerTF2.schema;
    }

    init(): Router {
        const router = express.Router();

        return router.get('/:skuOrName', rateLimiterUsingThirdParty, (req, res) => {
            const protocol = req.headers['x-forwarded-proto'] === undefined ? 'http' : req.headers['x-forwarded-proto'];
            const host = req.headers.host;
            const domain = `${protocol as string}://${host}`;

            const skuOrName = req.params.skuOrName;

            const pricelist = this.server.pricelist;
            const defindexes = this.server.schemaManagerTF2.defindexes;

            if (['random', 'lucky', 'iamfeelinglucky'].includes(skuOrName)) {
                const randomSku = this.pickRandomSku(Object.keys(pricelist.prices));
                this.isRandom = true;
                return res.redirect(`/items/${randomSku}`);
            }

            let sku: string;

            if (!testSKU(skuOrName)) {
                // received not in sku format, check if can generate sku from it
                sku = this.schema.getSkuFromName(decodeURIComponent(skuOrName));

                if (sku.includes('null') || sku.includes('undefined')) {
                    log.warn(`Failed on GET /items/${skuOrName} request`);
                    return res.json({
                        success: false,
                        message:
                            `Invalid sku format, or the item name returned with null or undefined.` +
                            ` Generated sku: ${sku}. If you're inputting an item name and it contains some special character(s),` +
                            ` replace it with URL Escape Codes instead - see: https://docs.microfocus.com/OMi/10.62/Content/OMi/ExtGuide/ExtApps/URL_encoding.htm#:~:text=URL%20escape%20codes%20for%20characters,'%3CMy%20title%3E'%20.`
                    });
                }
            } else {
                sku = skuOrName;
            }

            const item = SKU.fromString(sku);
            const isExist = this.schema.checkExistence(item);
            // const deviceType = req.device.type.toLowerCase();
            // const isPhone = deviceType === 'phone';

            if (defindexes[item.defindex] !== undefined && isExist) {
                log.info(`Got GET /items/${sku}${this.isRandom ? ' (Random) ' : ' '}request`);
                if (this.isRandom) {
                    this.isRandom = false;
                }

                const baseItemData = this.schema.getItemBySKU(sku);
                const itemDescription = baseItemData?.item_description;
                const itemName = this.schema.getName(item, true);
                const [oldBptfUrl, bptfQuery] = generateOldBptfUrl(
                    this.server.options.oldBptfDomain,
                    this.schema,
                    item
                );

                let currentPrice: string;
                if (pricelist.prices[sku] !== undefined) {
                    const prices = pricelist.prices[sku];
                    currentPrice = `${
                        prices.buy.toValue(pricelist.keyPrice) === 0 ? '0 ref' : prices.buy.toString()
                    } / ${prices.sell.toValue(pricelist.keyPrice) === 0 ? '0 ref' : prices.sell.toString()}`;
                }

                getImage(item, itemName, baseItemData, domain)
                    .then(imageUrl => {
                        res.render('items/index', {
                            sku: sku.replace(/;[p][0-9]+/g, ''), // Ignore painted attribute
                            skuForDisplay: sku,
                            name: itemName,
                            quality: qualityColorHex[item.quality],
                            image: imageUrl,
                            description: `${currentPrice ? `Prices.tf: ${currentPrice}` : ''}${
                                itemDescription ? `\n-----\n${itemDescription}` : ''
                            }`,
                            oldBptfUrl: oldBptfUrl,
                            bptfUrl: generateBptfUrl(this.server.options.redirects.backpacktf, this.schema, item),
                            scmUrl: generateScmUrl(this.schema, item),
                            stnUrl: generateStnTradingUrl(this.schema, item),
                            bptfQuery,
                            currentPricestfPrice: currentPrice
                        });
                    })
                    .catch(err => {
                        log.error('Error getting item image on GET /items/${sku} request', err);
                        res.json({
                            success: false,
                            message: `Error getting item image`
                        });
                    });
            } else {
                log.warn(`Failed on GET /items/${sku} request`);
                if (defindexes[item.defindex] === undefined || !isExist) {
                    res.json({
                        success: false,
                        message: `Item does not exist. Please try again. Your can download tf2 schema here: ${domain}/download/schema`
                    });
                } else {
                    res.json({
                        success: false,
                        message: 'Invalid sku format. Please try again.'
                    });
                }
            }
        });
    }

    private pickRandomSku(skus: string[]): string {
        let pickedIndex = Math.floor(Math.random() * skus.length);
        if (this.pickedRandomIndex === pickedIndex) {
            // ensure not the same as previously picked
            pickedIndex === 0 ? pickedIndex++ : pickedIndex--;
        }

        const isExist = () => {
            return this.schema.checkExistence(SKU.fromString(skus[pickedIndex]));
        };

        while (!isExist()) {
            pickedIndex === 0 ? pickedIndex++ : pickedIndex--;
        }

        this.pickedRandomIndex = pickedIndex;
        return skus[pickedIndex];
    }
}

// do something at GET /items ?
