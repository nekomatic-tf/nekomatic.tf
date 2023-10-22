import log from '../lib/logger';
import IOptions from './IOptions';
import IPricer from '../types/interfaces/IPricer';
import Pricelist from './Pricelist';
import SchemaManagerTF2 from './SchemaManager';
import ServerManager from './ServerManager';
import ExpressManager from './Express/ExpressManager';
import DiscordWebhook from './DiscordWebhook';
import getCratetfCratesList from '../lib/tools/getCratetfCrateList';

export default class Server {
    public pricelist: Pricelist;

    public expressManager: ExpressManager;

    public discordWebhook: DiscordWebhook;

    public ready = false;

    public cratetfCrateList: string[];

    public cratetfCratesInterval: NodeJS.Timeout;

    constructor(
        private readonly serverManager: ServerManager,
        public readonly pricer: IPricer,
        public readonly schemaManagerTF2: SchemaManagerTF2,
        public options: IOptions
    ) {
        this.expressManager = new ExpressManager(this);
        this.discordWebhook = new DiscordWebhook(this, this.schemaManagerTF2.schema);
        this.pricelist = new Pricelist(this, this.schemaManagerTF2, this.pricer, this.options);
    }

    async start(): Promise<void> {
        this.cratetfCrateList = await getCratetfCratesList();
        this.getCratetfCratesInterval();

        return new Promise((resolve, reject) => {
            this.pricelist
                .init()
                .then(() => {
                    log.debug('Connecting to pricestf websocket...');
                    this.pricer.connect();
                    log.debug('Connected!');

                    log.debug('Setting up server...');
                    void this.expressManager.init().then(() => {
                        this.setReady = true;
                        resolve();
                    });
                })
                .catch(err => {
                    if (err) {
                        return reject(err);
                    }

                    if (this.serverManager.isStopping) {
                        // Shutdown is requested, break out of the startup process
                        return resolve();
                    }
                });
        });
    }

    set setReady(isReady: boolean) {
        this.ready = isReady;
    }

    get isReady(): boolean {
        return this.ready;
    }

    private getCratetfCratesInterval(): void {
        this.cratetfCratesInterval = setInterval(() => {
            void getCratetfCratesList().then(crateList => {
                if (crateList.length > 0) {
                    this.cratetfCrateList = crateList;
                }
            });
            // Check every 12 hours
        }, 12 * 60 * 60 * 1000);
    }
}
