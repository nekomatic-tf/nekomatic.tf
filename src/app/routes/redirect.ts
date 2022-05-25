import log from '../lib/logger';
import express, { Router } from 'express';
import Server from '../classes/Server';

export class Redirect {
    constructor(private readonly server: Server) {
        //
    }

    init(): Router {
        const router = express.Router();

        ['discord', 'github', 'steam', 'youtube', 'backpacktf'].forEach(site => {
            router.get(`/${site}`, (req, res) => {
                log.info(`Got GET /${site} redirect`);
                res.redirect(this.server.options[site]);
            });
        });

        return router;
    }
}
