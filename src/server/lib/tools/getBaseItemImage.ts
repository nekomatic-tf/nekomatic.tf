import { Item, SchemaItem } from '@tf2autobot/tf2-schema';
import * as images from '../../lib/data';

export default function getBaseItemImage(baseItemData: SchemaItem, item: Item, itemName: string): [string, boolean] {
    let itemImageUrlPrint: string;
    let needResize = false;

    if (!baseItemData || !item) {
        itemImageUrlPrint = 'https://jberlife.com/wp-content/uploads/2019/07/sorry-image-not-available.jpg';
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
        itemImageUrlPrint = `https://scrap.tf/img/items/warpaint/${item.defindex}_${item.paintkit}_${item.wear}_${
            item.festive === true ? 1 : 0
        }.png`;
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

    return [itemImageUrlPrint, needResize];
}
