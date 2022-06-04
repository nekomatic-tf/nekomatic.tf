import { Item, Schema } from '@tf2autobot/tf2-schema';

export default function generateBptfUrl(bptfDomain: string, schema: Schema, item: Item): string {
    const base = `${bptfDomain}/stats`;

    // item<{
    //     defindex: number | 0;
    //     quality: number | 0;
    //     craftable?: boolean | true;
    //     tradable?: boolean | true;
    //     killstreak?: number | 0;
    //     australium?: boolean | false;
    //     effect?: number | null;
    //     festive?: boolean;
    //     paintkit?: number | null;
    //     wear?: number | null;
    //     quality2?: number | null;
    //     craftnumber?: number | null;
    //     crateseries?: number | null;
    //     target?: number | null;
    //     output?: number | null;
    //     outputQuality?: number | null;
    //     paint?: number | null;
    // }>

    const wears = {
        1: 'Factory New',
        2: 'Minimal Wear',
        3: 'Field-Tested',
        4: 'Well-Worn',
        5: 'Battle Scarred'
    };

    const name = schema.getName(
        {
            defindex: item.defindex,
            quality: 6,
            festive: item.festive
        },
        false
    );

    let query = `?item=${encodeURIComponent(name)}&quality=${encodeURIComponent(
        schema.getQualityById(item.quality)
    )}&craftable=${String(item.craftable)}`;

    if (item.killstreak) {
        query = query + `&killstreakTier=${String(item.killstreak)}`;
    }

    if (item.australium) {
        query = query + `&australium=${String(item.australium)}`;
    }

    if (typeof item.paintkit === 'number') {
        query = query + `&texture=${encodeURIComponent(schema.getSkinById(item.paintkit))}`;
    }

    if (item.wear) {
        query = query + `&wearTier=${encodeURIComponent(wears[item.wear])}`;
    }

    if (item.quality2) {
        query = query + `&elevatedQuality=${encodeURIComponent(schema.getQualityById(item.quality2))}`;
    }

    if (
        item.effect !== null ||
        item.crateseries !== null ||
        item.target !== null ||
        item.output !== null ||
        item.outputQuality !== null
    ) {
        const nameLowered = name.toLowerCase();

        const isUnusualifier = nameLowered.includes('unusualifier') && item.target !== null;

        const isStrangifierChemistrySet =
            nameLowered.includes('chemistry set') &&
            item.target !== null &&
            item.output !== null &&
            item.outputQuality !== null;

        const isCollectorsChemistrySet =
            nameLowered.includes('chemistry set') &&
            item.target === null &&
            item.output !== null &&
            item.outputQuality !== null;

        const isStrangifier = nameLowered.includes('strangifier') && item.target !== null;

        const isFabricator =
            nameLowered.includes('fabricator') &&
            item.target !== null &&
            item.output !== null &&
            item.outputQuality !== null;
        const isGenericFabricator =
            nameLowered.includes('fabricator') &&
            item.target === null &&
            item.output !== null &&
            item.outputQuality !== null;

        const isKillstreakKit = nameLowered.includes('kit') && item.killstreak !== 0 && item.target !== null;

        const priceindex =
            item.effect !== null
                ? item.effect
                : item.crateseries !== null
                ? item.crateseries
                : isUnusualifier || isStrangifier
                ? item.target
                : isFabricator
                ? `${item.output}-${item.outputQuality}-${item.target}`
                : isKillstreakKit
                ? `${item.killstreak}-${item.target}`
                : isStrangifierChemistrySet
                ? `${item.target}-${item.outputQuality}-${item.output}`
                : isCollectorsChemistrySet
                ? `${item.output}-${item.outputQuality}`
                : isGenericFabricator
                ? `${item.output}-${item.outputQuality}-0`
                : undefined;

        if (priceindex) {
            query = query + `&priceindex=${encodeURIComponent(priceindex)}`;
        }
    }

    return base + query;
}
