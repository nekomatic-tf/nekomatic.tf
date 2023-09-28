import Server from '../Server';
import express, { Express } from 'express';
import http from 'http';
import path from 'path';
import bodyParser from 'body-parser';
import Index from './Routes/Index';
import { Items } from './Routes/Items';
import Json from './Routes/Json';
import Download from './Routes/Download';
import { Redirect } from './Routes/Redirect';
import Options from './Routes/Options';
import getCratetfCratesList from './utils/getCratetfCrateList';

export default class ExpressManager {
    public app: Express;

    private serverApp: http.Server;

    constructor(private server: Server) {
        this.app = express();
    }

    init(): Promise<void> {
        return new Promise(resolve => {
            getCratetfCratesList()
            .then((cratetfCratesList) => {
                const index = new Index();
                const items = new Items(this.server, cratetfCratesList);
                const json = new Json(this.server);
                const download = new Download(this.server);
                const redirect = new Redirect(this.server);
                const options = new Options(this.server);

                this.app
                    .use(express.static(path.join(__dirname, '../../../../public')))
                    .set('view engine', 'ejs')
                    .set('trust proxy', 1)
                    .use(bodyParser.json())
                    .use(
                        bodyParser.urlencoded({
                            extended: false
                        })
                    );

                this.app.use('/', index.init());
                this.app.use('/items', items.init());
                this.app.use('/json', json.init());
                this.app.use('/download', download.init());
                this.app.use('/redirect', redirect.init());
                this.app.use('/options', options.init());

                this.serverApp = this.app.listen(this.server.options.port, () => {
                    resolve();
                });
            })
        });
    }

    shutdown(): void {
        this.serverApp.close();
    }
}
