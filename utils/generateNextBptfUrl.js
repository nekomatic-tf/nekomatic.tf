function generateNextBptfUrl(schema, item) {
    const base = `https://next.backpack.tf/stats`;

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

    const name = schema.getName(
        {
            defindex: item.defindex,
            quality: 6
        },
        false
    );

    let query = '';

    query = query + `?itemName=${encodeURIComponent(name)}`;

    if (item.craftable === false) {
        query = query + `?craftable=0`;
    }

    if (item.killstreak) {
        query = query + `?killstreakTier=${String(item.killstreak)}`;
    }

    if (item.australium) {
        query = query + `?australium=1`;
    }

    if (item.effect) {
        query = query + `?particle=${item.effect}`;
    }

    if (item.festive) {
        query = query + `?festivized=1`;
    }

    if (item.paintkit) {
        query = query + `?texture=${item.paintkit}`;
    }

    if (item.wear) {
        query = query + `?wearTier=${item.wear}`;
    }

    if (item.quality2) {
        query = query + `?elevatedQuality=${item.quality2}`;
    }

    if (item.crateseries) {
        query = query + `?crateSeries=${item.crateseries}`;
    }

    if (item.target) {
        query = query + `?targetItem=${schema.getName(
            {
                defindex: item.target,
                quality: 6
            },
            false
        )}`;
    }

    if (item.output) {
        query = query + `?outputItem=${schema.getName(
            {
                defindex: item.output,
                quality: 6
            },
            false
        )}`;
    }

    // OutputQuality can't

    return (base + query);
}

module.exports = generateNextBptfUrl;
