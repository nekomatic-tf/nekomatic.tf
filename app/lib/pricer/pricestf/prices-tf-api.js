const request = require('request-retry-dayjs');
const log = require('../../logger');
// export interface PricesTfRequestCheckResponse {
//     enqueued: boolean;
// }

// export interface PricesTfItem {
//     sku: string;
//     buyHalfScrap: number;
//     buyKeys: number;
//     buyKeyHalfScrap: number | null;
//     sellHalfScrap: number;
//     sellKeys: number;
//     sellKeyHalfScrap: number | null;
//     createdAt: string;
//     updatedAt: string;
// }

// export interface PricesTfItemMessageEvent {
//     type: string;
//     data?: PricesTfItem;
// }

// export interface PricesTfResponseMeta {
//     totalItems: number;
//     itemCount: number;
//     itemsPerPage: number;
//     totalPages: number;
//     currentPage: number;
// }

// export interface PricesTfGetPricesResponse {
//     items: PricesTfItem[];
//     meta: PricesTfResponseMeta;
// }

// export interface PricesTfAuthAccessResponse {
//     accessToken: string;
// }

class PricesTfApi {
    constructor() {
        this.token = '';
    }

    async authedApiRequest(httpMethod, path, input, headers) {
        try {
            return await PricesTfApi.apiRequest(httpMethod, path, input, {
                Authorization: 'Bearer ' + this.token,
                ...headers,
            });
        } catch (e) {
            if (e && 401 === e['statusCode']) {
                await this.setupToken();
                return this.authedApiRequest(httpMethod, path, input, headers);
            }
            if (e && e['statusCode'] >= 500){
                let time = 5 * 1000;
                log.default.warn(`Looks like the prices.tf api is down! Retrying in ${time / 1000} seconds...`);
                await new Promise(r => setTimeout(r, time));
                throw e;
            }
            log.default.warn(e);
        }
    }
    static async apiRequest(httpMethod, path, input, headers, customURL) {
        const options = {
            method: httpMethod,
            url: customURL ? `${customURL}${path}` : `${this.URL}${path}`,
            headers: {
                'User-Agent': 'autobot.tf@' + process.env.BOT_VERSION,
                ...headers,
            },
            json: true,
            timeout: 30000,
        };

        options[httpMethod === 'GET' ? 'qs' : 'body'] = input;

        return new Promise((resolve, reject) => {
            void request(options, (err, response, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(body);
                }
            }).end();
        });
    }

    static async requestAuthAccess() {
        return PricesTfApi.apiRequest('POST', '/auth/access', {});
    }

    async setupToken() {
        try {
            const r = await PricesTfApi.requestAuthAccess();
            this.token = r.accessToken;
        } catch (e) {
            log.default.error('Error on setupToken()');
            log.default.error(e);
        }
    }

    async requestCheck(sku) {
        return this.authedApiRequest('POST', `/prices/${sku}/refresh`, {});
    }

    async getPrice(sku) {
        return this.authedApiRequest('GET', `/prices/${sku}`, {});
    }

    async getPricelistPage(page) {
        return this.authedApiRequest('GET', '/prices', { page, limit: 100 });
    }

    getOptions() {
        return {
            pricerUrl: 'https://api2.prices.tf',
        };
    }
}

exports.default = PricesTfApi;
PricesTfApi.URL = 'https://api2.prices.tf';
