const { version: SERVER_VERSION } = require('../package.json');
process.env.SERVER_VERSION = SERVER_VERSION;

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');

const init = require('./schema');
const express = require('express');

const SKU = require('@tf2autobot/tf2-sku');

const ejs = require('ejs');

init()
    .then((schemaManager) => {
        const schemaPath = path.join(__dirname, '../public/files/schema.json');

        const hours12 = 12 * 60 * 60 * 1000;
        const mins2 = 2 * 60 * 1000;

        setInterval(() => {
            fs.writeFileSync(
                schemaPath,
                JSON.stringify(schemaManager.schema.raw),
                {
                    encoding: 'utf8',
                }
            );
        }, hours12 + mins2);

        const app = express();
        // const router = express.Router();

        const port = process.env.PORT;

        // .set('views', path.join(__dirname, '../views/'))
        app.use(express.static(path.join(__dirname, '../public'))).set(
            'view engine',
            'ejs'
        );

        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../views/index.html'));
        });
        app.get('/download/schema', (req, res) => {
            res.download(schemaPath);
        });
        app.get('/json/schema', (req, res) => {
            res.json(schemaManager.schema.raw);
        });
        app.get('/items/:sku', (req, res) => {
            console.log(req.params.sku);
            const schema = schemaManager.schema;
            const baseItemData = schema.getItemBySKU(req.params.sku);

            const item = SKU.fromString(req.params.sku);
            const itemName = schema.getName(item, true);

            res.render('items/index', {
                sku: req.params.sku,
                name: itemName,
                image: baseItemData.image_url_large,
                description: baseItemData.item_description,
                bptfUrl: generateBptfUrl(schema, item),
            });
        });

        app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
        });
    })
    .catch((err) => {
        throw new Error(err);
    });

function generateBptfUrl(schema, item) {
    const base = 'https://backpack.tf/stats/';

    const name = schema.getName(
        {
            defindex: item.defindex,
            quality: 6,
            festive: item.festive,
            killstreak: item.killstreak,
            australium: item.australium,
            target: item.target,
            paintkit: item.paintkit,
            wear: item.wear,
        },
        false
    );

    const nameLowered = name.toLowerCase();

    const isUnusualifier =
        nameLowered.includes('unusualifier') && item.target !== null;

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

    const isStrangifier =
        nameLowered.includes('strangifier') && item.target !== null;

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

    const isKillstreakKit =
        nameLowered.includes('kit') &&
        item.killstreak !== 0 &&
        item.target !== null;

    const itemName = isStrangifier
        ? 'Strangifier'
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
        : name.includes('Haunted Metal Scrap') ||
          name.includes("Horseless Headless Horsemann's Headtaker")
        ? name.replace('Unique ', '')
        : name;

    const quality =
        (item.quality2 !== null
            ? schema.getQualityById(item.quality2) + ' '
            : '') + schema.getQualityById(item.quality);

    const tradable = `${!item.tradable ? 'Non-' : ''}Tradable`;
    const craftable = `${!item.craftable ? 'Non-' : ''}Craftable`;

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

    return (
        base +
        `${quality}/${itemName}/${tradable}/${craftable}${
            priceindex ? '/' + priceindex : ''
        }`
    );
}

const ON_DEATH = require('death');
const inspect = require('util');

ON_DEATH({ uncaughtException: true })((signalOrErr, origin) => {
    const crashed = signalOrErr !== 'SIGINT';

    if (crashed) {
        console.error(
            [
                'Server' +
                    ' crashed! Please create an issue with the following log:',
                `package.version: ${
                    process.env.SERVER_VERSION || undefined
                }; node: ${process.version} ${process.platform} ${
                    process.arch
                }}`,
                'Stack trace:',
                inspect.inspect(origin),
            ].join('\r\n')
        );
    } else {
        console.warn('Received kill signal `' + signalOrErr + '`');
    }

    process.exit(1);
});
