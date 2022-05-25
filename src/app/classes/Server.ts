import log from '../lib/logger';
import Options from './Options';
import IPricer from '../types/interfaces/IPricer';
import Pricelist from './Pricelist';
import SchemaManagerTF2 from './SchemaManager';
import ServerManager from './ServerManager';
import ExpressManager from './ExpressManager';
import DiscordWebhook from './DiscordWebhook';

export default class Server {
    public pricelist: Pricelist;

    private expressManager: ExpressManager;

    public discordWebhook: DiscordWebhook;

    public ready = false;

    constructor(
        private readonly serverManager: ServerManager,
        public readonly pricer: IPricer,
        public readonly schemaManagerTF2: SchemaManagerTF2,
        public options: Options
    ) {
        this.expressManager = new ExpressManager(this);
        this.discordWebhook = new DiscordWebhook(this, this.schemaManagerTF2.schema);
        this.pricelist = new Pricelist(this, this.schemaManagerTF2, this.pricer, this.options);
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            void this.pricelist
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
}
