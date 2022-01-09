const SchemaManager = require('@tf2autobot/tf2-schema');

async function init() {
    return new Promise((resolve, reject) => {
        const schemaManager = new SchemaManager({
            apiKey: process.env.STEAM_APIKEY,
            updateTime: 12 * 60 * 60 * 1000, // every 12 hours
        });
        schemaManager.init((err) => {
            if (err) {
                return reject(err);
            }

            return resolve(schemaManager);
        });
    });
}

module.exports = init;
