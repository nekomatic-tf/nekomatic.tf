const Currencies = require('@tf2autobot/tf2-currencies');
const PricesTfSocketManager = require('./prices-tf-socket-manager');
const API = require('./prices-tf-api');
// import PricesTfApi, { PricesTfItem, PricesTfItemMessageEvent } from './prices-tf-api';
const log = require('../../logger');

class PricesTfPricer {
    constructor(api) {
        this.api = api;
        this.socketManager = new PricesTfSocketManager.default(api);
    }

    getOptions() {
        return this.api.getOptions();
    }

    async getPrice(sku) {
        const response = await this.api.getPrice(sku);
        return this.parsePrices2Item(response);
    }

    async getPricelist() {
        if (process.env.DEV === 'true') {
            try {
                const pricelist = await API.default.apiRequest(
                    'GET',
                    '/json/pricelist-array',
                    {},
                    {},
                    'https://autobot.tf'
                );

                return pricelist;
            } catch (err) {
                console.log(err);
            }
        }

        let prices = [];
        let currentPage = 1;
        let totalPages = 0;

        let delay = 0;
        const minDelay = 200;

        do {
            await new Promise((resolve) => setTimeout(resolve, delay));
            const start = new Date().getTime();
            log.default.debug(
                'Getting page ' +
                    currentPage.toString() +
                    ' of ' +
                    totalPages.toString()
            );
            try {
                const response = await this.api.getPricelistPage(currentPage);
                currentPage++;
                totalPages = response.meta.totalPages;
                prices = prices.concat(response.items);
            } catch (e){
                return this.getPricelist();
            }
            const time = new Date().getTime() - start;

            delay = Math.max(0, minDelay - time);
        } while (currentPage < totalPages);

        const parsed = prices.map((v) =>
            this.parseItem(this.parsePrices2Item(v))
        );
        return { items: parsed };
    }

    async requestCheck(sku) {
        const r = await this.api.requestCheck(sku);
        if (r.enqueued) {
            return {
                sku: sku,
            };
        } else {
            return {
                sku: null,
            };
        }
    }

    shutdown() {
        this.socketManager.shutDown();
    }

    connect() {
        this.socketManager.connect();
    }

    init() {
        return this.socketManager.init();
    }

    parsePricesTfMessageEvent(raw) {
        return JSON.parse(raw);
    }

    parsePrices2Item(item) {
        return {
            sku: item.sku,
            buy: new Currencies({
                keys: item.buyKeys,
                metal: Currencies.toRefined(item.buyHalfScrap / 2),
            }),
            sell: new Currencies({
                keys: item.sellKeys,
                metal: Currencies.toRefined(item.sellHalfScrap / 2),
            }),
            source: 'bptf',
            time: Math.floor(new Date(item.updatedAt).getTime() / 1000),
        };
    }

    parseItem(r) {
        return {
            buy: r.buy,
            sell: r.sell,
            sku: r.sku,
            source: r.source,
            time: r.time,
        };
    }

    parsePriceUpdatedData(e) {
        return this.parseItem(this.parsePrices2Item(e.data));
    }

    bindHandlePriceEvent(onPriceChange) {
        this.socketManager.on('message', (message) => {
            try {
                const data = this.parsePricesTfMessageEvent(message.data);
                if (data.type === 'AUTH_REQUIRED') {
                    // might be nicer to put this elsewhere

                    void this.api.setupToken().then(() => {
                        this.socketManager.send(
                            JSON.stringify({
                                type: 'AUTH',
                                data: {
                                    accessToken: this.api.token,
                                },
                            })
                        );
                    });
                } else if (data.type === 'PRICE_UPDATED') {
                    const item = this.parsePriceUpdatedData(data);
                    onPriceChange(item);
                }
            } catch (e) {
                // e always undefined, do nothing.
            }
        });
    }
}

exports.default = PricesTfPricer;
