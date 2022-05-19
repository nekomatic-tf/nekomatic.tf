const request = require('request-retry-dayjs');

function getMptfPrice(bptfQuery) {
    return new Promise((resolve, reject) => {
        const base = 'https://api.backpack.tf/item/get_third_party_prices/';
        const options = {
            method: 'GET',
            url: base + bptfQuery,
            headers: {
                'User-Agent': 'autobot.tf@' + process.env.SERVER_VERSION,
            },
            json: true,
            gzip: true,
        };

        request(options, (err, response, body) => {
            if (err) {
                return reject(err);
            }

            return resolve(body.prices?.mp?.lowest_price);
        });
    });
}

module.exports = getMptfPrice;
