const { version: SERVER_VERSION } = require('../package.json');
process.env.SERVER_VERSION = SERVER_VERSION;

// TODO: UPGRADE TO TYPESCRIPT

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');

const DEFAULT_OPTIONS = {
    bptfDomain: 'https://backpack.tf',
};
let options = DEFAULT_OPTIONS;
const optionsPath = path.join(__dirname, '../options');
if (!fs.existsSync(optionsPath)) {
    try {
        fs.mkdirSync(optionsPath);
        fs.writeFileSync(
            optionsPath + '/options.json',
            JSON.stringify(DEFAULT_OPTIONS, null, 2),
            { encoding: 'utf-8' }
        );
    } catch (err) {
        throw new Error(err);
    }
} else {
    options = JSON.parse(
        fs.readFileSync(optionsPath + '/options.json', { encoding: 'utf-8' })
    );
}

const init = require('./schema');

const log = require('./lib/logger');
log.initLogger();
const express = require('express');
// const device = require('express-device');
const bodyParser = require('body-parser');

const SKU = require('@tf2autobot/tf2-sku');
const generateBptfUrl = require('../utils/generateBptfUrl');
const generateBptfNextUrl = require('../utils/generateNextBptfUrl');

const getImage = require('../utils/getImage');
const getQualityColor = require('../utils/getQualityColor');
const testSKU = require('../utils/validateSKU');

const api = require('./lib/pricer/pricestf/prices-tf-api');
const pricer = require('./lib/pricer/pricestf/prices-tf-pricer');
const Pricelist = require('./classes/Pricelist');

const pricestfApi = new api.default();
const pricestfPricer = new pricer.default(pricestfApi);

log.default.debug('Initializing pricer...');
pricestfPricer
    .init()
    .then(() => {
        log.default.debug('Initializing tf2schema...');
        init().then((schemaManager) => {
            const schemaPath = path.join(
                __dirname,
                '../public/files/schema.json'
            );

            const qualities = Object.keys(schemaManager.schema.qualities).reduce((obj, q) => {
                obj[schemaManager.schema.qualities[q]] = schemaManager.schema.qualityNames[q];
                return obj;
            }, {});

            let defindexes = getDefindexes(schemaManager.schema);
            generateSchemaFile(schemaManager.schema, schemaPath);

            const hours12 = 12 * 60 * 60 * 1000;
            const mins2 = 2 * 60 * 1000;
            setInterval(() => {
                generateSchemaFile(schemaManager.schema, schemaPath);

                defindexes = getDefindexes(schemaManager.schema);
            }, hours12 + mins2);

            const pricelist = new Pricelist.default(
                schemaManager.schema,
                pricestfPricer
            );

            log.default.debug('Initializing pricelist...');
            pricelist.init().then((pricelist2) => {
                if (process.env.DEV !== 'true') {
                    log.default.debug('Connecting to pricestf websocket...');
                    pricestfPricer.connect();
                    log.default.debug('Connected!');
                }

                log.default.debug('Setting up server...');
                const app = express();
                // const router = express.Router();

                const port = process.env.PORT;

                // .set('views', path.join(__dirname, '../views/'))
                app.use(express.static(path.join(__dirname, '../public')))
                    .set('view engine', 'ejs')
                    .use(bodyParser.json())
                    .use(
                        bodyParser.urlencoded({
                            extended: false,
                        })
                    );
                // app.use(device.capture());

                // TODO: Error handling/landing page
                // TODO: Refactor - use router, etc...
                // TODO: Implement rate limiter with (should be done elsewhere)

                app.get('/', (req, res) => {
                    log.default.info(`Got GET / request (main page)`);
                    res.sendFile(path.join(__dirname, '../views/index.html'));
                });
                app.get('/discord', (req, res) => {
                    log.default.info(`Got /discord redirect`);
                    res.redirect(process.env.DISCORD);
                });
                app.get('/github', (req, res) => {
                    log.default.info(`Got /github redirect`);
                    res.redirect(process.env.GITHUB);
                });
                app.get('/steam', (req, res) => {
                    log.default.info(`Got /steam redirect`);
                    res.redirect(process.env.STEAM);
                });
                app.get('/youtube', (req, res) => {
                    log.default.info(`Got /youtube redirect`);
                    res.redirect(process.env.YOUTUBE);
                });
                app.get('/backpacktf', (req, res) => {
                    log.default.info(`Got /backpacktf redirect`);
                    res.redirect(options.bptfDomain);
                });

                app.get('/download/schema', (req, res) => {
                    log.default.info(`Got GET /download/schema request`);
                    res.download(schemaPath);
                });
                app.get('/json/schema', (req, res) => {
                    log.default.info(`Got GET /json/schema request`);
                    res.json(schemaManager.schema);
                });
                app.get('/json/pricelist', (req, res) => {
                    if (pricelist2.isResettingPricelist) {
                        log.default.warn(
                            `Got GET /json/pricelist-array request in the middle of pricelist reset`
                        );
                        return res.status(503).json({
                            message: 'Service unavailabe for the time being.',
                        });
                    }

                    log.default.info(`Got GET /json/pricelist request`);
                    res.json({
                        success: true,
                        items: pricelist2.prices,
                    });
                });
                app.get('/json/pricelist-array', (req, res) => {
                    if (pricelist2.isResettingPricelist) {
                        log.default.warn(
                            `Got GET /json/pricelist-array request in the middle of pricelist reset`
                        );
                        return res.status(503).json({
                            message: 'Service unavailabe for the time being.',
                        });
                    }

                    log.default.info(`Got GET /json/pricelist-array request`);
                    res.json({
                        success: true,
                        items: pricelist2.getPricesArray,
                    });
                });
                app.get('/json/items/:sku', (req, res) => {
                    const sku = req.params.sku;

                    if (pricelist2.isResettingPricelist) {
                        log.default.warn(
                            `Got GET /json/items/${sku} request in the middle of pricelist reset`
                        );
                        return res.status(503).json({
                            message:
                                'Service unavailabe for the time being, please try again later.',
                        });
                    }

                    if (!testSKU(sku)) {
                        log.default.warn(
                            `Failed on GET /json/items/${sku} request`
                        );
                        return res.json({
                            success: false,
                            message: 'Invalid sku format. Please try again.',
                        });
                    }

                    const item = pricelist2.prices[sku];
                    if (!item) {
                        log.default.warn(
                            `Failed on GET /json/items/${sku} request - item does not exist`
                        );
                        return res.json({
                            success: false,
                            message: `Item does not exist in the pricelist. Please try again.`,
                        });
                    }

                    log.default.info(`Got GET /json/items/${sku} request`);
                    res.json({
                        success: true,
                        sku: item.sku,
                        name: schemaManager.schema.getName(
                            SKU.fromString(sku),
                            false
                        ),
                        time: item.time,
                        buy: item.buy,
                        sell: item.sell,
                    });
                });

                let isRandom = false;
                app.get('/items/:sku', async (req, res) => {
                    const protocol =
                        req.headers['x-forwarded-proto'] === undefined
                            ? 'http'
                            : req.headers['x-forwarded-proto'];
                    const host = req.headers.host;
                    const domain = `${protocol}://${host}`;

                    let sku = req.params.sku;

                    if (['random', 'lucky', 'iamfeelinglucky'].includes(sku)) {
                        const randomSku = pickRandomSku(
                            Object.keys(pricelist2.prices),
                            schemaManager.schema
                        );
                        isRandom = true;
                        return res.redirect(`/items/${randomSku}`);
                    }

                    const item = SKU.fromString(sku);
                    const isExist = schemaManager.schema.checkExistence(item);
                    // const deviceType = req.device.type.toLowerCase();
                    // const isPhone = deviceType === 'phone';

                    if (
                        testSKU(sku) &&
                        defindexes[item.defindex] !== undefined &&
                        isExist
                    ) {
                        log.default.info(
                            `Got GET /items/${sku}${
                                isRandom ? ' (Random) ' : ' '
                            }request`
                        );
                        if (isRandom) {
                            isRandom = false;
                        }

                        const baseItemData =
                            schemaManager.schema.getItemBySKU(sku);
                        const itemName = schemaManager.schema.getName(
                            item,
                            true
                        );
                        const image = await getImage(
                            schemaManager.schema,
                            item,
                            itemName,
                            baseItemData,
                            domain
                        );

                        res.render('items/index', {
                            sku: sku.replace(/;[p][0-9]+/g, ''), // Ignore painted attribute
                            name: itemName,
                            quality: getQualityColor(item.quality),
                            image,
                            description: baseItemData?.item_description,
                            bptfUrl: generateBptfUrl(
                                options.bptfDomain,
                                schemaManager.schema,
                                item
                            ),
                            bptfNextUrl: generateBptfNextUrl(
                                schemaManager.schema,
                                qualities,
                                item
                            ),
                        });
                    } else {
                        log.default.warn(`Failed on GET /items/${sku} request`);
                        if (
                            defindexes[item.defindex] === undefined ||
                            !isExist
                        ) {
                            res.json({
                                success: false,
                                message: `Item does not exist. Please try again. Your can download tf2 schema here: ${domain}/download/schema`,
                            });
                        } else {
                            res.json({
                                success: false,
                                message:
                                    'Invalid sku format. Please try again.',
                            });
                        }
                    }
                });

                app.get('/options', (req, res) => {
                    // Track who's requesting this, so better don't try
                    const requestRawHeader = JSON.stringify(
                        req.rawHeaders,
                        null,
                        2
                    );

                    if (!checkAuthorization(req, res, requestRawHeader)) {
                        return;
                    }

                    log.default.info(
                        `Got GET /options request, info:\n${requestRawHeader}`
                    );
                    log.default.info();
                    res.json({ success: true, options: options });
                });

                app.patch('/options', (req, res) => {
                    const requestRawHeader = JSON.stringify(
                        req.rawHeaders,
                        null,
                        2
                    );

                    if (!checkAuthorization(req, res, requestRawHeader)) {
                        return;
                    }

                    if (req.headers['content-type'] !== 'application/json') {
                        log.default.warn(
                            `Got PATCH /options request with wrong content-type, request info:\n${requestRawHeader}`
                        );
                        return res.status(400).json({
                            message: 'Invalid request',
                        });
                    }

                    if (req.body === undefined) {
                        log.default.warn(
                            `Got PATCH /options request with undefined body, request info:\n${requestRawHeader}`
                        );
                        return res.status(400).json({
                            message: 'Invalid request (body undefined)',
                        });
                    }

                    const oldOptions = Object.assign({}, options);
                    let changed = false;

                    for (const key in req.body) {
                        if (options[key] === undefined) {
                            continue;
                        } else if (
                            key === 'bptfDomain' &&
                            (typeof req.body[key] !== 'string' ||
                                !req.body[key].includes('https://'))
                        ) {
                            continue;
                        }
                        changed = true;
                        options[key] = req.body[key];
                    }

                    if (changed) {
                        try {
                            fs.writeFile(
                                optionsPath + '/options.json',
                                JSON.stringify(options, null, 2),
                                { encoding: 'utf-8' },
                                () => {
                                    const toSend = {
                                        success: true,
                                        oldOptions,
                                        newOptions: options,
                                    };
                                    log.default.warn(
                                        `Got PATCH /options request from with successful changes:\n${JSON.stringify(
                                            toSend,
                                            null,
                                            2
                                        )}, request info:\n${requestRawHeader}`
                                    );
                                    return res.json(toSend);
                                }
                            );
                        } catch (err) {
                            log.default.warn(
                                `Got PATCH /options request with error, request info:\n${requestRawHeader}`
                            );
                            const msg = 'Error saving patched options';
                            log.default.error(msg, err);
                            return res.json({
                                success: false,
                                message: msg,
                            });
                        }
                    } else {
                        log.default.warn(
                            `Got PATCH /options request with no changes, request info:\n${requestRawHeader}`
                        );
                        return res.status(418).json({
                            success: false,
                            message: 'Nothing changed',
                        });
                    }
                });

                // Utilities

                /**
                 * Must have query "name", name must not in the sku format
                 *
                 * on success:
                 * { success: true, sku: string }
                 */
                app.get('/utils/getSku', (req, res) => {
                    if (
                        req.query === undefined ||
                        req.query?.name === undefined
                    ) {
                        log.default.warn(
                            `Failed on GET /utils/getSku request with undefined query`
                        );
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid request (missing query "name")',
                        });
                    }

                    if (testSKU(req.query.name)) {
                        log.default.warn(
                            `Failed on GET /utils/getSku request with name as sku`
                        );
                        return res.status(400).json({
                            success: false,
                            message: '"name" must not be in sku format',
                        });
                    }

                    const sku = schemaManager.schema.getSkuFromName(
                        req.query.name
                    );

                    if (sku.includes(';null') || sku.includes(';undefined')) {
                        log.default.warn(
                            `Failed on GET /utils/getSku request with generated sku: ${sku}`
                        );
                        return res.status(404).json({
                            success: false,
                            message: `Generated sku: ${sku} - Please check the name you've sent`,
                            sku,
                        });
                    }

                    log.default.info(
                        `Got GET /utils/getSku request with generated sku: ${sku}`
                    );
                    res.json({
                        success: true,
                        sku,
                        item: SKU.fromString(sku),
                    });
                });

                /**
                 * Must have query "sku", name must be in the sku format
                 * Optional query: "proper" (default is false)
                 *
                 * on success:
                 * { success: true, name: string, isExist: boolean }
                 */
                app.get('/utils/getName', (req, res) => {
                    if (
                        req.query === undefined ||
                        req.query?.sku === undefined
                    ) {
                        log.default.warn(
                            `Failed on GET /utils/getName request with undefined query`
                        );
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid request (missing query "sku")',
                        });
                    }

                    if (!testSKU(req.query.sku)) {
                        log.default.warn(
                            `Failed on GET /utils/getName request with sku as something else`
                        );
                        return res.status(400).json({
                            success: false,
                            message: '"sku" must be in sku format',
                        });
                    }

                    const item = SKU.fromString(req.query.sku);
                    const name = schemaManager.schema.getName(
                        SKU.fromString(req.query.sku),
                        req.query.proper === undefined
                            ? false
                            : Boolean(req.query.proper)
                    );
                    const isExist = schemaManager.schema.checkExistence(item);

                    log.default.info(
                        `Got GET /utils/getName request with generated name: ${name} (${isExist})`
                    );
                    res.json({
                        success: true,
                        name,
                        isExist,
                        item,
                    });
                });

                /**
                 * Content-Type header must be application/json
                 * body must be in array of item name
                 *
                 * on success:
                 * { success: true, converted: { [name]: sku }}
                 */
                app.get('/utils/getSkuBulk', (req, res) => {
                    if (req.headers['content-type'] !== 'application/json') {
                        log.default.warn(
                            `Got GET /utils/getSkuBulk request with wrong content-type`
                        );
                        return res.status(400).json({
                            success: false,
                            message:
                                'Invalid request (Content-Type header must be application/json)',
                        });
                    }

                    if (req.body === undefined) {
                        log.default.warn(
                            `Failed on GET /utils/getSkuBulk request with undefined body`
                        );
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid request (missing body)',
                        });
                    }

                    if (!Array.isArray(req.body)) {
                        log.default.warn(
                            `Failed on GET /utils/getSkuBulk request body is not type Array`
                        );
                        return res.status(400).json({
                            success: false,
                            message: 'body must be an array of item name',
                        });
                    }

                    const toReturn = {};
                    req.body.forEach((name) => {
                        toReturn[name] =
                            schemaManager.schema.getSkuFromName(name);
                    });

                    log.default.info(
                        `Got GET /utils/getSkuBulk request with ${req.body.length} items`
                    );
                    res.json({
                        success: true,
                        converted: toReturn,
                    });
                });

                /**
                 * Content-Type header must be application/json
                 * body must be in array of sku
                 * Optional query: "proper" (default is false)
                 *
                 * on success:
                 * { success: true, converted: { [sku]: name }}
                 */
                app.get('/utils/getNameBulk', (req, res) => {
                    if (req.headers['content-type'] !== 'application/json') {
                        log.default.warn(
                            `Got GET /utils/getNameBulk request with wrong content-type`
                        );
                        return res.status(403).json({
                            success: false,
                            message:
                                'Invalid request (Content-Type header must be application/json)',
                        });
                    }

                    if (req.body === undefined) {
                        log.default.warn(
                            `Failed on GET /utils/getNameBulk request with undefined body`
                        );
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid request (missing body)',
                        });
                    }

                    if (!Array.isArray(req.body)) {
                        log.default.warn(
                            `Failed on GET /utils/getNameBulk request body is not type Array`
                        );
                        return res.status(400).json({
                            success: false,
                            message: 'body must be an array of item sku',
                        });
                    }

                    const isProper =
                        req.query?.proper === undefined
                            ? false
                            : Boolean(req.query.proper);

                    const toReturn = {};
                    req.body.forEach((sku) => {
                        toReturn[sku] = schemaManager.schema.getName(
                            SKU.fromString(sku),
                            isProper
                        );
                    });

                    log.default.info(
                        `Got GET /utils/getNameBulk request with ${req.body.length} items`
                    );
                    res.json({
                        success: true,
                        converted: toReturn,
                    });
                });

                app.listen(port, () => {
                    log.default.info(
                        `Server is now live at http://localhost:${port}`
                    );
                });
            });
        });
    })
    .catch((err) => {
        throw new Error(err);
    });

function generateSchemaFile(schema, schemaPath) {
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), {
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

let pickedRandomIndex = 0;

function pickRandomSku(skus, schema) {
    let pickedIndex = Math.floor(Math.random() * skus.length);
    if (pickedRandomIndex === pickedIndex) {
        // ensure not the same as previously picked
        pickedIndex === 0 ? pickedIndex++ : pickedIndex--;
    }

    const isExist = () => {
        return schema.checkExistence(SKU.fromString(skus[pickedIndex]));
    };

    while (!isExist()) {
        pickedIndex === 0 ? pickedIndex++ : pickedIndex--;
    }

    pickedRandomIndex = pickedIndex;
    return skus[pickedIndex];
}

function checkAuthorization(req, res, requestRawHeader) {
    if (req.query.secret_key === undefined) {
        log.default.warn(
            `Failed on GET /options request (Unauthorized), request info:\n${requestRawHeader}`
        );
        res.status(401).json({ message: 'Not Authorized' });
        return false;
    } else if (req.query.secret_key !== process.env.SECRET_KEY_ADMIN) {
        log.default.warn(
            `Failed on GET /options request from (Invalid Authorization), request info:\n ${requestRawHeader} `
        );
        res.status(403).json({
            message: 'Invalid authorization',
        });
        return false;
    }

    return true;
}

const ON_DEATH = require('death');
const inspect = require('util');

ON_DEATH({ uncaughtException: true })((signalOrErr, origin) => {
    const crashed = signalOrErr !== 'SIGINT';

    if (crashed) {
        log.default.error(
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
        log.default.warn('Received kill signal `' + signalOrErr + '`');
    }

    log.default.info('Server uptime:' + process.uptime());
    pricestfPricer?.shutdown();
    process.exit(1);
});
