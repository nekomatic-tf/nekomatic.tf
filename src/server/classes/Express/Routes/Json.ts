import log from '../../../lib/logger';
import express, { Router } from 'express';
import SKU from '@tf2autobot/tf2-sku';
import testSKU from '../utils/testSKU';
import Server from '../../Server';
import { Schema } from '@tf2autobot/tf2-schema';
import { rateLimiterUsingThirdParty } from '../Middlewares/rateLimiter';

export default class Json {
    private schema: Schema;

    constructor(private server: Server) {
        this.schema = this.server.schemaManagerTF2.schema;
    }

    init(): Router {
        // should do something at GET /json (/) ?

        const router = express.Router();

        /*
         * Get schema for TF2 items
         * Example: https://autobot.tf/json/schema
         *
         * on success, return Schema
         */
        router.get('/schema', (req, res) => {
            log.info(`Got GET /json/schema request`);
            res.json(this.schema);
        });

        /*
         * Get an pricelist in PricesObject
         * Example: https://autobot.tf/json/pricelist-array
         *
         * on success, return:
         * { success: true, items: PricesObject }
         */
        router.get('/pricelist', (req, res) => {
            if (this.server.pricelist.isResettingPricelist) {
                log.warn(`Got GET /json/pricelist-array request in the middle of pricelist reset`);
                return res.status(503).json({
                    message: 'Service unavailabe for the time being.'
                });
            }

            log.info(`Got GET /json/pricelist request`);
            res.json({
                success: true,
                items: this.server.pricelist.prices
            });
        });

        /*
         * Get an pricelist in Entry[]
         * Example: https://autobot.tf/json/pricelist-array
         *
         * on success, return:
         * { success: true, items: Entry[] }
         */
        router.get('/pricelist-array', rateLimiterUsingThirdParty, (req, res) => {
            if (this.server.pricelist.isResettingPricelist) {
                log.warn(`Got GET /json/pricelist-array request in the middle of pricelist reset`);
                return res.status(503).json({
                    message: 'Service unavailabe for the time being.'
                });
            }

            log.info(`Got GET /json/pricelist-array${req.query?.onlyExist === 'true' ? ' (onlyExist)' : ''} request`);
            res.json({
                success: true,
                items: this.server.pricelist.getPricesArray(req.query?.onlyExist === 'true')
            });
        });

        /*
         * Get an item
         * Example: https://autobot.tf/json/items/5021;6
         *
         * on success, return:
         * { success: true, sku: string; name: string; time: number; buy: Currencies; sell: Currencies }
         */
        router.get('/items/:sku', (req, res) => {
            const sku = req.params.sku;

            if (this.server.pricelist.isResettingPricelist) {
                log.warn(`Got GET /json/items/${sku} request in the middle of pricelist reset`);
                return res.status(503).json({
                    message: 'Service unavailabe for the time being, please try again later.'
                });
            }

            if (!testSKU(sku)) {
                log.warn(`Failed on GET /json/items/${sku} request`);
                return res.json({
                    success: false,
                    message: 'Invalid sku format. Please try again.'
                });
            }

            const item = this.server.pricelist.prices[sku];
            if (!item) {
                log.warn(`Failed on GET /json/items/${sku} request - item does not exist`);
                return res.json({
                    success: false,
                    message: `Item does not exist in the pricelist. Please try again.`
                });
            }

            log.info(`Got GET /json/items/${sku} request`);
            res.json({
                success: true,
                sku: item.sku,
                name: this.schema.getName(SKU.fromString(sku), false),
                time: item.time,
                buy: item.buy,
                sell: item.sell
            });
        });

        // Utilities

        /*
         * Must have query "name", name must not in the sku format
         * Example: https://autobot.tf/json/utils/getSku?name=Mann Co. Supply Crate Key
         *
         * on success:
         * { success: true, sku: string }
         */
        router.get('/utils/getSku', (req, res) => {
            if (req.query === undefined || req.query?.name === undefined) {
                log.warn(`Failed on GET /utils/getSku request with undefined query`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request (missing query "name")'
                });
            }

            const name = req.query.name as string;

            if (testSKU(name)) {
                log.warn(`Failed on GET /utils/getSku request with name as sku`);
                return res.status(400).json({
                    success: false,
                    message: '"name" must not be in sku format'
                });
            }

            const sku = this.schema.getSkuFromName(name);

            if (sku.includes(';null') || sku.includes(';undefined')) {
                log.warn(`Failed on GET /utils/getSku request with generated sku: ${sku}`);
                return res.status(404).json({
                    success: false,
                    message: `Generated sku: ${sku} - Please check the name you've sent`,
                    sku
                });
            }

            log.info(`Got GET /utils/getSku request with generated sku: ${sku}`);
            res.json({
                success: true,
                sku,
                item: SKU.fromString(sku)
            });
        });

        /*
         * Must have query "sku", name must be in the sku format
         * Optional query: "proper" (default is false)
         * Example: https://autobot.tf/json/utils/getName?sku=5021;6?proper=true
         *
         * on success:
         * { success: true, name: string, isExist: boolean }
         */
        router.get('/utils/getName', (req, res) => {
            if (req.query === undefined || req.query?.sku === undefined) {
                log.warn(`Failed on GET /utils/getName request with undefined query`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request (missing query "sku")'
                });
            }

            const sku = req.query.sku as string;

            if (!testSKU(sku)) {
                log.warn(`Failed on GET /utils/getName request with sku as something else`);
                return res.status(400).json({
                    success: false,
                    message: '"sku" must be in sku format'
                });
            }

            const item = SKU.fromString(sku);
            const name = this.schema.getName(
                SKU.fromString(sku),
                req.query.proper === undefined ? false : Boolean(req.query.proper)
            );
            const isExist = this.schema.checkExistence(item);

            log.info(`Got GET /utils/getName request with generated name: ${name} (${String(isExist)})`);
            res.json({
                success: true,
                name,
                isExist,
                item
            });
        });

        /*
         * Must have query "sku", name must be in the sku format
         * Optional query: "proper" (default is false)
         * Example: https://autobot.tf/json/utils/getName?sku=5021;6?proper=true
         *
         * on success:
         * { success: true, name: string, isExist: boolean }
         */

        /*
         * Content-Type header must be application/json
         * body must be in array of item name
         *
         * url: https://autobot.tf/json//utils/getSkuBulk
         * body: string[]
         *
         * on success:
         * { success: true, converted: { [name]: sku }}
         */
        router.get('/utils/getSkuBulk', (req, res) => {
            if (req.headers['content-type'] !== 'application/json') {
                log.warn(`Got GET /utils/getSkuBulk request with wrong content-type`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request (Content-Type header must be application/json)'
                });
            }

            if (req.body === undefined) {
                log.warn(`Failed on GET /utils/getSkuBulk request with undefined body`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request (missing body)'
                });
            }

            if (!Array.isArray(req.body)) {
                log.warn(`Failed on GET /utils/getSkuBulk request body is not type Array`);
                return res.status(400).json({
                    success: false,
                    message: 'body must be an array of item name'
                });
            }

            const toReturn = {};
            req.body.forEach(name => {
                toReturn[name as string] = this.schema.getSkuFromName(name);
            });

            log.info(`Got GET /utils/getSkuBulk request with ${req.body.length} items`);
            res.json({
                success: true,
                converted: toReturn
            });
        });

        /*
         * Content-Type header must be application/json
         * body must be in array of sku
         * Optional query: "proper" (default is false)
         *
         * url: https://autobot.tf/json//utils/getNameBulk
         * body: string[]
         *
         * on success:
         * { success: true, converted: { [sku]: name }}
         */
        router.get('/utils/getNameBulk', (req, res) => {
            if (req.headers['content-type'] !== 'application/json') {
                log.warn(`Got GET /utils/getNameBulk request with wrong content-type`);
                return res.status(403).json({
                    success: false,
                    message: 'Invalid request (Content-Type header must be application/json)'
                });
            }

            if (req.body === undefined) {
                log.warn(`Failed on GET /utils/getNameBulk request with undefined body`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request (missing body)'
                });
            }

            if (!Array.isArray(req.body)) {
                log.warn(`Failed on GET /utils/getNameBulk request body is not type Array`);
                return res.status(400).json({
                    success: false,
                    message: 'body must be an array of item sku'
                });
            }

            const isProper = req.query?.proper === undefined ? false : Boolean(req.query.proper);

            const toReturn = {};
            req.body.forEach(sku => {
                toReturn[sku as string] = this.schema.getName(SKU.fromString(sku), isProper);
            });

            log.info(`Got GET /utils/getNameBulk request with ${req.body.length} items`);
            res.json({
                success: true,
                converted: toReturn
            });
        });

        return router;
    }
}
