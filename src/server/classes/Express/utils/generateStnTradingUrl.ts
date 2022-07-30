import { Item, Schema } from '@tf2autobot/tf2-schema';

export default function generateStnTradingUrl(schema: Schema, item: Item): string {
    const name = schema.getName(
        {
            defindex: item.defindex,
            quality: item.quality,
            festive: item.festive,
            effect: item.effect,
            killstreak: item.killstreak,
            australium: item.australium,
            target: item.target,
            paintkit: item.paintkit,
            wear: item.wear
        },
        true,
        false
    );

    const itemName = item.effect !== null ? (item.quality2 === 11 ? 'Strange ' : '') + 'Unusual ' + name : name;

    return `https://stntrading.eu/item/tf2/${itemName.replace(' ', '+')}`;
}
