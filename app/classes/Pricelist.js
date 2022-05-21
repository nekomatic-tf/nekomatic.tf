const Currencies = require('@tf2autobot/tf2-currencies');
const SKU = require('@tf2autobot/tf2-sku');
const log = require('../lib/logger');

// interface Currency {
//     keys: number;
//     metal: number;
// }

// interface Prices {
//     buy: Currency;
//     sell: Currency;
// }

// export interface EntryData {
//     sku: string;
//     buy?: Currency | null;
//     sell?: Currency | null;
//     time?: number | null;
// }

class Entry {
    // implements EntryData
    // sku: string;

    // buy: Currencies | null;

    // sell: Currencies | null;

    // time: number | null;

    constructor(entry) {
        this.sku = entry.sku;
        this.buy = new Currencies(entry.buy);
        this.sell = new Currencies(entry.sell);
        this.time = entry.time;
    }

    static fromData(data) {
        return new Entry(data);
    }

    getJSON() {
        return {
            sku: this.sku,
            buy: this.buy === null ? null : this.buy.toJSON(),
            sell: this.sell === null ? null : this.sell.toJSON(),
            time: this.time,
        };
    }
}

// export interface PricesObject {
//     [id: string]: Entry;
// }

// export interface PricesDataObject {
//     [id: string]: EntryData;
// }

// export interface KeyPrices {
//     buy: Currencies;
//     sell: Currencies;
//     time: number;
// }

class Pricelist {
    constructor(schema, pricer) {
        this.prices = {};
        this.keyPrices;
        this.schema = schema;
        this.pricer = pricer;
        this.receivedCount = 0;
        this.last1MinsReceivedCount = 0;
        this.retryAttempted = 0;
        this.isResettingPricelist = false;
        this.isGettingPricelist = false;
        this.hasAlreadyResetPricelist = false;
        this.boundHandlePriceChange = this.handlePriceChange.bind(this);
    }

    get keyPrice() {
        return this.keyPrices.sell.metal;
    }

    init() {
        return new Promise((resolve) => {
            log.default.info('Getting pricelist from prices.tf...');

            this.pricer.getPricelist().then((pricelist) => {
                this.setPricelist(pricelist.items);
                this.setupPricerHealthCheck();

                this.pricer.bindHandlePriceEvent(this.boundHandlePriceChange);

                return resolve(this);
            });
        });
    }

    setPricelist(prices) {
        const count = prices.length;
        for (let i = 0; i < count; i++) {
            const entry = prices[i];

            if (entry.sku === null) {
                continue;
            }

            if (entry.buy === null) {
                entry.buy = new Currencies({
                    keys: 0,
                    metal: 0,
                });
            }

            if (entry.sell === null) {
                entry.sell = new Currencies({
                    keys: 0,
                    metal: 0,
                });
            }

            const newEntry = {
                sku: entry.sku,
                buy: new Currencies(entry.buy),
                sell: new Currencies(entry.sell),
                time: entry.time,
            };

            this.prices[entry.sku] = Entry.fromData(newEntry);

            if (entry.sku === '5021;6') {
                this.keyPrices = {
                    buy: entry.buy,
                    sell: entry.sell,
                    time: entry.time,
                };
            }
        }
    }

    setupPricerHealthCheck() {
        this.autoPricerCheckInterval = setInterval(() => {
            if (this.receivedCount - this.last1MinsReceivedCount === 0) {
                this.retryAttempted++;
                log.default.warn(
                    `[${this.retryAttempted}] No price changes in the last 1 minutes, retrying to connect to pricer websocket server...`
                );

                if (
                    this.hasAlreadyResetPricelist === false &&
                    this.isGettingPricelist === false
                ) {
                    this.isGettingPricelist = true;
                    this.pricer
                        .getPricelist()
                        .then((pricelist) => {
                            // reset prices
                            this.resetPricelist();
                            this.setPricelist(pricelist.items);
                            this.isResettingPricelist = false;
                            this.isGettingPricelist = false;
                            this.hasAlreadyResetPricelist = true;

                            this.pricer.connect();

                            setTimeout(() => {
                                this.hasAlreadyResetPricelist = false;
                            }, 5 * 60 * 1000);
                        })
                        .catch((err) => {
                            log.default.error(
                                'Error on getting pricelist (on reset pricelist):',
                                err
                            );
                        });
                } else {
                    this.pricer.connect();
                }
            } else {
                this.last1MinsReceivedCount = this.receivedCount;
                this.retryAttempted = 0;
            }
        }, 1 * 60 * 1000);
    }

    handlePriceChange(data) {
        if (!data.sku) return;

        this.receivedCount++;

        if (data.buy !== null) {
            const sku = data.sku;

            const newPrices = {
                buy: new Currencies(data.buy),
                sell: new Currencies(data.sell),
            };

            if (this.prices[sku]) {
                // update data in pricelist (memory)
                if (sku === '5021;6') {
                    this.keyPrices = {
                        buy: new Currencies({
                            keys: 0,
                            metal: data.buy.metal,
                        }),
                        sell: new Currencies({
                            keys: 0,
                            metal: data.sell.metal,
                        }),
                        time: data.time ?? this.keyPrices.time,
                    };
                    this.prices[sku].buy = this.keyPrices.buy;
                    this.prices[sku].sell = this.keyPrices.sell;
                } else {
                    this.prices[sku].buy = newPrices.buy;
                    this.prices[sku].sell = newPrices.sell;
                }
                this.prices[sku].time = data.time ?? this.prices[sku].time;
            } else {
                // Register new item
                const newEntry = {
                    sku: sku,
                    buy: newPrices.buy,
                    sell: newPrices.sell,
                    time: data.time,
                };
                this.prices[sku] = this.prices[sku] = Entry.fromData(newEntry);
            }
        }
    }

    getPricesArray(onlyExist) {
        const toArray = [];
        const skus = Object.keys(this.prices);

        for (let i = 0; i < skus.length; i++) {
            const sku = skus[i];
            if (!Object.prototype.hasOwnProperty.call(this.prices, sku)) {
                continue;
            }

            if (onlyExist && !this.schema.checkExistence(SKU.fromString(sku))) {
                continue;
            }

            const item = this.prices[sku];
            toArray.push({
                sku: sku,
                name: this.schema.getName(SKU.fromString(sku), false),
                source: 'bptf',
                time: item.time,
                buy: item.buy,
                sell: item.sell,
            });
        }

        return toArray;
    }

    resetPricelist() {
        this.isResettingPricelist = true;
        const skus = Object.keys(this.prices);

        for (let i = 0; i < skus.length; i++) {
            const sku = skus[i];
            if (!Object.prototype.hasOwnProperty.call(this.prices, sku)) {
                continue;
            }

            delete this.prices[sku];
        }
    }
}

exports.default = Pricelist;
