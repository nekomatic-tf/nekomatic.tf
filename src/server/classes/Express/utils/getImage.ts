import SKU from '@tf2autobot/tf2-sku';
import mergeImages from 'merge-images';
import { Canvas, Image } from 'canvas';
import { Jimp } from 'jimp';
import log from '../../../lib/logger';
import fs from 'fs';
import path from 'path';
import { Item, SchemaItem } from '@tf2autobot/tf2-schema';
import getBaseItemImage from '../../../lib/tools/getBaseItemImage';

const publicImagesDirectory = path.join(__dirname, '../../../../../public/images');

export default async function getImage(
    item: Item,
    itemName: string,
    baseItemData: SchemaItem,
    domain: string
): Promise<string> {
    const [itemImageUrlPrint, needResize] = getBaseItemImage(baseItemData, item, itemName);
    let toReturn = itemImageUrlPrint;

    // TODO: Later just get the effect image and make it overlays instead of merge thingy (hmmm...)
    if (item.effect !== null) {
        const folderContents = fs.readdirSync(path.join(publicImagesDirectory, '/items/'));

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

                const imageBase64 = (await mergeImages(
                    [path.join(publicImagesDirectory, `/effects/${item.effect}_380x380.png`), itemImage],
                    {
                        Canvas: Canvas,
                        Image: Image
                    }
                )) as string;

                const toSave = imageBase64.replace(/^data:image\/png;base64,/, '');

                fs.writeFileSync(path.join(publicImagesDirectory, `/items/${sku}.png`), toSave, 'base64');

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
        Jimp.read(itemImage)
            .then(image => {
                image
                    .resize({ w: 380, h: 380 })
                    .getBase64('image/png')
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
