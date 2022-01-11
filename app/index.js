const { version: SERVER_VERSION } = require('../package.json');
process.env.SERVER_VERSION = SERVER_VERSION;

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');

const init = require('./schema');
const log = require('./lib/logger');
const express = require('express');

const SKU = require('@tf2autobot/tf2-sku');
const generateBptfUrl = require('../utils/generateBptfUrl');
const getImage = require('../utils/getImage');
const getQualityColor = require('../utils/getQualityColor');
const testSKU = require('../utils/validateSKU');

log.debug('Initializing tf2schema...');
init()
    .then((schemaManager) => {
        const schemaPath = path.join(__dirname, '../public/files/schema.json');

        let defindexes = getDefindexes(schemaManager.schema);
        generateSchemaFile(schemaManager.schema, schemaPath);

        const hours12 = 12 * 60 * 60 * 1000;
        const mins2 = 2 * 60 * 1000;
        setInterval(() => {
            generateSchemaFile(schemaManager.schema, schemaPath);

            defindexes = getDefindexes(schemaManager.schema);
        }, hours12 + mins2);

        const app = express();
        // const router = express.Router();

        const port = process.env.PORT;

        // .set('views', path.join(__dirname, '../views/'))
        app.use(express.static(path.join(__dirname, '../public'))).set(
            'view engine',
            'ejs'
        );

        // TODO: Error handling/landing page
        // TODO: Refactor - use router, etc...

        app.get('/', (req, res) => {
            log.debug(`Got GET / request (main page)`);
            res.sendFile(path.join(__dirname, '../views/index.html'));
        });
        app.get('/download/schema', (req, res) => {
            log.debug(`Got GET /download/schema request`);
            res.download(schemaPath);
        });
        app.get('/json/schema', (req, res) => {
            log.debug(`Got GET /json/schema request`);
            res.json(schemaManager.schema.raw);
        });
        app.get('/items/:sku', (req, res) => {
            const sku = req.params.sku;
            const item = SKU.fromString(sku);

            if (testSKU(sku) && defindexes[item.defindex] !== undefined) {
                log.debug(`Got GET /items/${sku} request`);

                const schema = schemaManager.schema;
                const baseItemData = schema.getItemBySKU(sku);
                const itemName = schema.getName(item, true);

                res.render('items/index', {
                    sku: sku,
                    name: itemName,
                    quality: getQualityColor(item.quality),
                    image: getImage(schema, sku, item, itemName, baseItemData),
                    description: baseItemData.item_description,
                    bptfUrl: generateBptfUrl(schema, item),
                });
            } else {
                log.warn(`Failed on GET /items/${sku} request`);
                if (defindexes[item.defindex] === undefined) {
                    res.json({
                        success: false,
                        message: 'Item does not exist. Please try again.',
                    });
                } else {
                    res.json({
                        success: false,
                        message: 'Invalid sku format. Please try again.',
                    });
                }
            }
        });

        app.listen(port, () => {
            log.info(`Server listening at http://localhost:${port}`);
        });
    })
    .catch((err) => {
        log.error(err);
        throw new Error(err);
    });

function generateSchemaFile(schema, schemaPath) {
    fs.writeFileSync(schemaPath, JSON.stringify(schema.raw, null, 2), {
        encoding: 'utf8',
    });
}

function getDefindexes(schema) {
    const schemaItems = schema.raw.schema.items;
    const schemaItemsSize = schemaItems.length;
    const defindexes = {};

    for (i = 0; i < schemaItemsSize; i++) {
        const schemaItem = schemaItems[i];
        defindexes[schemaItem.defindex] = schemaItem.item_name;
    }

    return defindexes;
}

const ON_DEATH = require('death');
const inspect = require('util');

ON_DEATH({ uncaughtException: true })((signalOrErr, origin) => {
    const crashed = signalOrErr !== 'SIGINT';

    if (crashed) {
        log.error(
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
        log.warn('Received kill signal `' + signalOrErr + '`');
    }

    process.exit(1);
});
