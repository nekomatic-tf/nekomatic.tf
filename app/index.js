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

const ejs = require('ejs');

log.debug('Initializing tf2schema...');
init()
    .then((schemaManager) => {
        const schemaPath = path.join(__dirname, '../public/files/schema.json');

        const hours12 = 12 * 60 * 60 * 1000;
        const mins2 = 2 * 60 * 1000;

        let schema = schemaManager.schema;
        let schemaItems = schema.raw.schema.items;
        let schemaItemsSize = schemaItems.length;
        let currentMaximumDefindex = schemaItems[schemaItemsSize - 1].defindex;

        setInterval(() => {
            fs.writeFileSync(schemaPath, JSON.stringify(schema.raw), {
                encoding: 'utf8',
            });

            schema = schemaManager.schema;
            schemaItems = schema.raw.schema.items;
            schemaItemsSize = schemaItems.length;
            currentMaximumDefindex = schemaItems[schemaItemsSize - 1].defindex;
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
            log.debug(`Got GET / request (main page)`);
            res.sendFile(path.join(__dirname, '../views/index.html'));
        });
        app.get('/download/schema', (req, res) => {
            log.debug(`Got GET /download/schema request`);
            res.download(schemaPath);
        });
        app.get('/json/schema', (req, res) => {
            log.debug(`Got GET /json/schema request`);
            res.json(schema.raw);
        });
        app.get('/items/:sku', (req, res) => {
            const sku = req.params.sku;
            const item = SKU.fromString(sku);

            if (testSKU(sku) && item.defindex <= currentMaximumDefindex) {
                log.debug(`Got GET /items/${sku} request`);

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
                if (item.defindex > currentMaximumDefindex) {
                    res.json({
                        success: false,
                        message:
                            'Input defindex is too big. Item does not exist. Please try again.',
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
