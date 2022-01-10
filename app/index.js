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

const ejs = require('ejs');

log.debug('Initializing tf2schema...');
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
            log.debug(`Receive request for main page.`);
            res.sendFile(path.join(__dirname, '../views/index.html'));
        });
        app.get('/download/schema', (req, res) => {
            log.debug(`Receive request for: /download/schema`);
            res.download(schemaPath);
        });
        app.get('/json/schema', (req, res) => {
            log.debug(`Receive request for: /json/schema`);
            res.json(schemaManager.schema.raw);
        });
        app.get('/items/:sku', (req, res) => {
            const sku = req.params.sku;
            log.debug(`Receive request for: ${sku}`);

            const schema = schemaManager.schema;
            const baseItemData = schema.getItemBySKU(sku);

            const item = SKU.fromString(sku);
            const itemName = schema.getName(item, true);

            res.render('items/index', {
                sku: sku,
                name: itemName,
                image: getImage(schema, sku, item, itemName, baseItemData),
                description: baseItemData.item_description,
                bptfUrl: generateBptfUrl(schema, item),
            });
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
