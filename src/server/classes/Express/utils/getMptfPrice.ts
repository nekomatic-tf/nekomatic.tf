import request from 'request-retry-dayjs';

interface GetMptfPrice {
    prices?: {
        mp?: {
            sku: string;
            lowest_price: string;
            num_for_sale: number;
            highest_buy_order?: string;
        };
    };
}

export default function getMptfPrice(bptfQuery: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const base = 'https://api.backpack.tf/item/get_third_party_prices/';
        const options = {
            method: 'GET',
            url: base + bptfQuery,
            headers: {
                'User-Agent': 'autobot.tf@' + process.env.SERVER_VERSION
            },
            json: true,
            gzip: true,
            maxAttempts: 1,
            timeout: 2500 // set timeout to only 2.5 seconds, default was 10 seconds
        };

        void request(options, (err, response, body) => {
            if (err) {
                return reject(err);
            }

            return resolve((body as GetMptfPrice).prices?.mp?.lowest_price);
        });
    });
}
