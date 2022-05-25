import log from '../lib/logger';
import fs from 'fs';
import express, { Router, Request, Response } from 'express';
import Server from '../classes/Server';
import { getOptionsPath } from '../classes/Options';

export default class Options {
    constructor(private server: Server) {
        //
    }

    init(): Router {
        const router = express.Router();

        router.get('/', (req, res) => {
            // Track who's requesting this, so better don't try
            const requestRawHeader = JSON.stringify(req.rawHeaders, null, 2);

            if (!checkAuthorization(req, res, requestRawHeader)) {
                return;
            }

            log.info(`Got GET /options request, info:\n${requestRawHeader}`);
            res.json({ success: true, options: this.server.options });
        });

        router.patch('/', (req, res) => {
            const requestRawHeader = JSON.stringify(req.rawHeaders, null, 2);

            if (!checkAuthorization(req, res, requestRawHeader)) {
                return;
            }

            if (req.headers['content-type'] !== 'application/json') {
                log.warn(`Got PATCH /options request with wrong content-type, request info:\n${requestRawHeader}`);
                return res.status(400).json({
                    message: 'Invalid request'
                });
            }

            if (req.body === undefined) {
                log.warn(`Got PATCH /options request with undefined body, request info:\n${requestRawHeader}`);
                return res.status(400).json({
                    message: 'Invalid request (body undefined)'
                });
            }

            const oldOptions = Object.assign({}, this.server.options);
            let changed = false;

            /*eslint-disable */
            for (const key in req.body) {
                if (this.server.options[key] === undefined) {
                    continue;
                } else if (
                    key === 'bptfDomain' &&
                    (typeof req.body[key] !== 'string' || !req.body[key].includes('https://'))
                ) {
                    continue;
                }
                changed = true;
                this.server.options[key] = req.body[key];
            }
            /*eslint-enable */

            if (changed) {
                try {
                    fs.writeFile(
                        getOptionsPath(),
                        JSON.stringify(this.server.options, null, 2),
                        { encoding: 'utf-8' },
                        () => {
                            const toSend = {
                                success: true,
                                oldOptions,
                                newOptions: this.server.options
                            };
                            log.warn(
                                `Got PATCH /options request from with successful changes:\n${JSON.stringify(
                                    toSend,
                                    null,
                                    2
                                )}, request info:\n${requestRawHeader}`
                            );
                            return res.json(toSend);
                        }
                    );
                } catch (err) {
                    log.warn(`Got PATCH /options request with error, request info:\n${requestRawHeader}`);
                    const msg = 'Error saving patched options';
                    log.error(msg, err);
                    return res.json({
                        success: false,
                        message: msg
                    });
                }
            } else {
                log.warn(`Got PATCH /options request with no changes, request info:\n${requestRawHeader}`);
                return res.status(418).json({
                    success: false,
                    message: 'Nothing changed'
                });
            }
        });

        return router;
    }
}

function checkAuthorization(req: Request, res: Response, requestRawHeader: string): boolean {
    if (req.query.secret_key === undefined) {
        log.warn(`Failed on GET /options request (Unauthorized), request info:\n${requestRawHeader}`);
        res.status(401).json({ message: 'Not Authorized' });
        return false;
    } else if (req.query.secret_key !== process.env.SECRET_KEY_ADMIN) {
        log.warn(`Failed on GET /options request from (Invalid Authorization), request info:\n ${requestRawHeader} `);
        res.status(403).json({
            message: 'Invalid authorization'
        });
        return false;
    }

    return true;
}
