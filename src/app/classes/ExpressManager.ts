import Server from './Server';
import express, { Express } from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import Index from '../routes';
import { Items } from '../routes/items';
import Json from '../routes/json';
import Download from '../routes/download';
import { Redirect } from '../routes/redirect';
import Options from '../routes/options';

export default class ExpressManager {
    public app: Express;

    constructor(private server: Server) {
        this.app = express();
    }

    init(): Promise<void> {
        return new Promise(resolve => {
            const index = new Index();
            const items = new Items(this.server);
            const json = new Json(this.server);
            const download = new Download(this.server);
            const redirect = new Redirect(this.server);
            const options = new Options(this.server);

            this.app
                .use(express.static(path.join(__dirname, '../../../public')))
                .set('view engine', 'ejs')
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

            this.app.listen(this.server.options.port, () => {
                resolve();
            });
        });
    }
}
