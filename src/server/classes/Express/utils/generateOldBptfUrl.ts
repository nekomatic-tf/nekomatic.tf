import { Item, Schema } from '@tf2autobot/tf2-schema';

export default function generateOldBptfUrl(oldBptfDomain: string, schema: Schema, item: Item): [string, string] {
    const base = `${oldBptfDomain}/stats/`;

    const name = schema.getName(
        {
            defindex: item.defindex,
            quality: 6,
            festive: item.festive,
            killstreak: item.killstreak,
            australium: item.australium,
            target: item.target,
            paintkit: item.paintkit,
            wear: item.wear
        },
        false,
        true
    );

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

    const itemName = isStrangifierChemistrySet || isCollectorsChemistrySet
        ? 'Chemistry Set'
        : isStrangifier
        ? 'Strangifier'
        : isUnusualifier
        ? 'Unusualifier'
        : isFabricator
        ? item.killstreak === 2
            ? 'Specialized Killstreak Fabricator'
            : 'Professional Killstreak Fabricator'
        : isKillstreakKit
        ? item.killstreak === 1
            ? 'Killstreak Kit'
            : item.killstreak === 2
            ? 'Specialized Killstreak Kit'
            : 'Professional Killstreak Kit'
        : name.includes('Haunted Metal Scrap') || name.includes("Horseless Headless Horsemann's Headtaker")
        ? name.replace('Unique ', '')
        : name;

    const quality =
        (item.quality2 !== null ? schema.getQualityById(item.quality2) + ' ' : '') +
        schema.getQualityById(item.quality);

    const tradable = `${!item.tradable ? 'Non-' : ''}Tradable`;
    const craftable = `${!item.craftable ? 'Non-' : ''}Craftable`;

    const priceindex =
        item.effect !== null
            ? item.effect
            : item.crateseries !== null
            ? item.crateseries
            : isUnusualifier || isStrangifier
            ? item.target
            : isFabricator || isStrangifierChemistrySet
            ? `${item.output}-${item.outputQuality}-${item.target}`
            : isKillstreakKit
            ? `${item.killstreak}-${item.target}`
            : isCollectorsChemistrySet
            ? `${item.output}-${item.outputQuality}`
            : isGenericFabricator
            ? `${item.output}-${item.outputQuality}-0`
            : undefined;

    const query = `${quality}/${encodeURIComponent(itemName)}/${tradable}/${craftable}${
        priceindex ? '/' + String(priceindex) : ''
    }`;

    return [base + query, query];
}
