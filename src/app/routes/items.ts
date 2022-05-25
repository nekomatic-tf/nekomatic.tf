import log from '../lib/logger';
import express, { Router } from 'express';
import Server from '../classes/Server';
import { Schema } from '@tf2autobot/tf2-schema';
import SKU from '@tf2autobot/tf2-sku';
import testSKU from '../lib/utils/testSKU';
import getImage from '../lib/utils/getImage';
import generateOldBptfUrl from '../lib/utils/generateOldBptfUrl';
import generateBptfUrl from '../lib/utils/generateBptfUrl';
import getMptfPrice from '../lib/utils/getMptfPrice';
import { qualityColor } from '../lib/data';

export class Items {
    private isRandom = false;

    private pickedRandomIndex = 0;

    private schema: Schema;

    constructor(private readonly server: Server) {
        this.schema = this.server.schemaManagerTF2.schema;
    }

    init(): Router {
        const router = express.Router();

        return router.get('/:sku', (req, res) => {
            const protocol = req.headers['x-forwarded-proto'] === undefined ? 'http' : req.headers['x-forwarded-proto'];
            const host = req.headers.host;
            const domain = `${protocol as string}://${host}`;

            const sku = req.params.sku;

            const pricelist = this.server.pricelist;
            const defindexes = this.server.schemaManagerTF2.defindexes;

            if (['random', 'lucky', 'iamfeelinglucky'].includes(sku)) {
                const randomSku = this.pickRandomSku(Object.keys(pricelist.prices));
                this.isRandom = true;
                return res.redirect(`/items/${randomSku}`);
            }

            const item = SKU.fromString(sku);
            const isExist = this.schema.checkExistence(item);
            // const deviceType = req.device.type.toLowerCase();
            // const isPhone = deviceType === 'phone';

            if (testSKU(sku) && defindexes[item.defindex] !== undefined && isExist) {
                log.info(`Got GET /items/${sku}${this.isRandom ? ' (Random) ' : ' '}request`);
                if (this.isRandom) {
                    this.isRandom = false;
                }

                const baseItemData = this.schema.getItemBySKU(sku);
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

                const render = (imageUrl: string, mptfPrice: string) => {
                    res.render('items/index', {
                        sku: sku.replace(/;[p][0-9]+/g, ''), // Ignore painted attribute
                        name: itemName,
                        quality: qualityColor[item.quality],
                        imageUrl,
                        description: baseItemData?.item_description,
                        oldBptfUrl: oldBptfUrl,
                        bptfUrl: generateBptfUrl(this.server.options.redirects.backpacktf, this.schema, item),
                        mptfPrice,
                        currentPricestfPrice: currentPrice
                    });
                };

                void getImage(this.schema, item, itemName, baseItemData, domain)
                    .then(imageUrl => {
                        void getMptfPrice(bptfQuery)
                            .then(mptfPrice => {
                                render(imageUrl, mptfPrice);
                            })
                            .catch(err => {
                                log.error('Error getting mptf prices', err);
                                render(imageUrl, undefined);
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
