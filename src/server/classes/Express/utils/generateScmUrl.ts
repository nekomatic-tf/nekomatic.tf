import { Item, Schema } from '@tf2autobot/tf2-schema';

export default function generateScmUrl(schema: Schema, item: Item): string {
    const name = schema.getName(item, true, false, true);

    return `https://steamcommunity.com/market/listings/440/${name}`;
}
