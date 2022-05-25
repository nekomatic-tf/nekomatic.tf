import SKU from '@tf2autobot/tf2-sku';
import mergeImages from 'merge-images';
import { Canvas, Image } from 'canvas';
import Jimp from 'jimp';
import log from '../logger';
import fs from 'fs';
import path from 'path';
import { Item, Schema, SchemaItem } from '@tf2autobot/tf2-schema';
import * as images from '../data';

export default async function getImage(
    schema: Schema,
    item: Item,
    itemName: string,
    baseItemData: SchemaItem,
    domain: string
): Promise<string> {
    let itemImageUrlPrint: string;
    let needResize = false;

    if (!baseItemData || !item) {
        return 'https://jberlife.com/wp-content/uploads/2019/07/sorry-image-not-available.jpg';
    } else if (images.retiredKeys[item.defindex] !== undefined) {
        needResize = true;
        itemImageUrlPrint = images.retiredKeys[item.defindex];
    } else if (
        itemName.includes('Non-Craftable') &&
        itemName.includes('Killstreak') &&
        itemName.includes('Kit') &&
        !itemName.includes('Fabricator')
    ) {
        // Get image for Non-Craftable Killstreak/Specialized Killstreak/Professional Killstreak [Weapon] Kit
        const front =
            'https://community.cloudflare.steamstatic.com/economy/image/IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdEH9myp0du1AHE66AL6lNU5Fw_2yIWtaMjIpQmjAT';

        const url = itemName.includes('Specialized')
            ? images.ks2Images[item.target]
            : itemName.includes('Professional')
            ? images.ks3Images[item.target]
            : images.ks1Images[item.target];

        if (url) {
            itemImageUrlPrint = `${front}${url}/380fx380f`;
        }

        if (!itemImageUrlPrint) {
            needResize = true;
            itemImageUrlPrint = baseItemData.image_url_large;
        }
    } else if (
        (itemName.includes('Strangifier') && !itemName.includes('Chemistry Set')) ||
        itemName.includes('Unusualifier')
    ) {
        const front =
            'https://community.cloudflare.steamstatic.com/economy/image/IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdEH9myp0du1AHE66AL6lNU5Fw_2yIWtaMjIpQmjAT';
        const url = itemName.includes('Unusualifier')
            ? images.unusualifierImages[item.target]
            : images.strangifierImages[item.target];

        if (url) {
            itemImageUrlPrint = `${front}${url}/380fx380f`;
        }

        if (!itemImageUrlPrint) {
            needResize = true;
            itemImageUrlPrint = baseItemData.image_url_large;
        }
    } else if (images.paintCans.includes(`${item.defindex}`)) {
        itemImageUrlPrint = `https://steamcommunity-a.akamaihd.net/economy/image/IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdEH9myp0erksICf${
            images.paintCan[item.defindex]
        }380fx380f`;
    } else if (item.australium === true) {
        // No festivized image available for Australium
        itemImageUrlPrint = images.australiumImageURL[item.defindex]
            ? `https://steamcommunity-a.akamaihd.net/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgE${
                  images.australiumImageURL[item.defindex]
              }380fx380f`
            : itemImageUrlPrint;
    } else if (item.paintkit !== null) {
        const newItem = SKU.fromString(`${item.defindex};6`);
        itemImageUrlPrint = `https://scrap.tf/img/items/warpaint/${encodeURIComponent(
            schema.getName(newItem, false)
        )}_${item.paintkit}_${item.wear}_${item.festive === true ? 1 : 0}.png`;
    } else if (item.festive) {
        const front =
            'https://community.cloudflare.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEMaQkUTxr2vTx8';
        if (images.festivizedImages[item.defindex]) {
            itemImageUrlPrint = `${front}${images.festivizedImages[item.defindex]}/380fx380f`;
        } else {
            needResize = true;
            itemImageUrlPrint = baseItemData.image_url_large;
        }
    } else {
        needResize = true;
        itemImageUrlPrint = baseItemData.image_url_large;
    }

    let toReturn = itemImageUrlPrint;

    // TODO: Later just get the effect image and make it overlays instead of merge thingy (hmmm...)
    if (item.effect !== null) {
        const folderContents = fs.readdirSync(path.join(__dirname, '../../../../public/images/items/'));

        let fileFound = false;
        const adjustedItem = Object.assign({}, item);
        adjustedItem.craftable = true;
        adjustedItem.tradable = true;
        adjustedItem.killstreak = 0;
        adjustedItem.australium = false;
        adjustedItem.festive = false;
        adjustedItem.quality2 = null;
        adjustedItem.craftnumber = null;
        adjustedItem.crateseries = null;
        adjustedItem.output = null;
        adjustedItem.outputQuality = null;
        adjustedItem.paint = null;
        const sku = SKU.fromObject(adjustedItem); // defindex;quality;effect[;paintkit; wear]

        // cloud database?
        folderContents.forEach(file => {
            if (!file.endsWith('.png')) return;
            if (sku === file.replace('.png', '')) {
                log.debug(`File found!`);
                fileFound = true;
                toReturn = `${domain}/images/items/${file}`;
            }
        });

        if (!fileFound) {
            log.debug(`File not found, merging images...`);

            try {
                const itemImage = needResize ? await resizeImage(itemImageUrlPrint) : itemImageUrlPrint;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const imageBase64 = (await mergeImages(
                    [path.join(__dirname, `../public/images/effects/${item.effect}_380x380.png`), itemImage],
                    {
                        Canvas: Canvas,
                        Image: Image
                    }
                )) as string;

                const toSave = imageBase64.replace(/^data:image\/png;base64,/, '');

                fs.writeFileSync(path.join(__dirname, `../public/images/items/${sku}.png`), toSave, 'base64');

                return `${domain}/images/items/${sku}.png`;
            } catch (err) {
                log.error('Error on merging images');
                log.error(err);
                // Caught an error, return default image, no need to save into file
                return toReturn;
            }
        } else {
            // File found, should return image link #1880
            return toReturn;
        }
    } else {
        // Effect is null, return default image url
        return toReturn;
    }
}

async function resizeImage(itemImage: string) {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Jimp.read({ url: itemImage })
            .then(image => {
                image
                    .resize(380, 380)
                    .getBase64Async(image.getMIME())
                    .then(resizedBase64 => {
                        return resolve(resizedBase64);
                    })
                    .catch(err => {
                        log.error('Error on image.resize.getBase64Async (resizeImage)');
                        log.error(err);
                        return reject(err);
                    });
            })
            .catch(err => {
                log.error('Error on Jimp.read (resizeImage)');
                log.error(err);
                return reject(err);
            });
    });
}

module.exports = getImage;
