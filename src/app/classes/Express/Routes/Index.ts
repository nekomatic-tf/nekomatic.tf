import log from '../../../lib/logger';
import express, { Router } from 'express';
import path from 'path';

export default class Index {
    constructor() {
        //
    }

    init(): Router {
        const router = express.Router();

        return router.get('/', (req, res) => {
            log.info(`Got GET / request (main page)`);
            res.sendFile(path.join(__dirname, '../../../views/index.html'));
        });
    }
}
