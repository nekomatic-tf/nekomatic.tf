import { Item, Schema } from '@tf2autobot/tf2-schema';

export default function generateScmUrl(schema: Schema, item: Item): string {
    const name = schema.getName(
        {
            defindex: item.defindex,
            quality: item.quality,
            festive: item.festive,
            killstreak: item.killstreak,
            australium: item.australium,
            target: item.target,
            paintkit: item.paintkit,
            wear: item.wear,
            crateseries: item.crateseries
        },
        true,
        false,
        true
    );

    return `https://steamcommunity.com/market/listings/440/${name}`;
}
