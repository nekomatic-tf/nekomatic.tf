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
            throw e;
        }
    }

    static async apiRequest(httpMethod, path, input, headers) {
        const options = {
            method: httpMethod,
            url: `${this.URL}${path}`,
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
            });
        });
    }

    static async requestAuthAccess() {
        return PricesTfApi.apiRequest('POST', '/auth/access', {});
    }

    async setupToken() {
        try {
            const r = await PricesTfApi.requestAuthAccess();
            log.default.debug('got new access token');
            this.token = r.accessToken;
        } catch (e) {
            log.default.error(
                'Error on setupToken(): ' + JSON.stringify(e, null, 2)
            );
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
