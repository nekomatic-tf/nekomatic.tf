import log from '../../../lib/logger';
import express, { Router } from 'express';
import Server from '../../Server';

export default class Download {
    constructor(private server: Server) {
        //
    }

    init(): Router {
        const router = express.Router();

        // do something at GET / (/download) ?

        return router.get('/schema', (req, res) => {
            log.info(`Got GET /download/schema request`);
            res.download(this.server.schemaManagerTF2.schemaPath);
        });
    }
}
