import axios from 'axios';

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

export default async function getMptfPrice(bptfQuery: string): Promise<string> {
    return new Promise((resolve, reject) => {
        axios({
            method: 'GET',
            url: '/' + bptfQuery,
            baseURL: 'https://api.backpack.tf/item/get_third_party_prices',
            headers: {
                'User-Agent': 'autobot.tf@' + process.env.SERVER_VERSION
            },
            timeout: 2500
        })
            .then(response => {
                return resolve((response.data as GetMptfPrice).prices?.mp?.lowest_price);
            })
            .catch(err => {
                return reject(err);
            });
    });
}
