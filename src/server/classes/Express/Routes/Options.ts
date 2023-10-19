import log from '../../../lib/logger';
import fs from 'fs';
import express, { Router, Request, Response } from 'express';
import Server from '../../Server';
import IOptions, { getOptionsPath, JsonOptions } from '../../IOptions';
import { removeCliOptions } from '../../IOptions';
import { deepMerge } from '../../../lib/tools/deep-merge';
import validator from '../../../lib/validator';

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
            const options = deepMerge({}, this.server.options) as IOptions;
            res.json({ success: true, options: removeCliOptions(options) });
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

            const oldOptions = deepMerge({}, this.server.options) as IOptions;
            // remove any CLI stuff
            removeCliOptions(oldOptions);

            const knownParams = req.body as JsonOptions;
            const result = deepMerge(oldOptions, knownParams) as JsonOptions;

            const errors = validator(result, 'options');
            if (errors !== null) {
                const msg = '❌ Error updating options: ' + errors.join(', ');
                log.warn(`Got PATCH /options request with error, request info:\n${requestRawHeader}`);
                log.error(msg);

                return res.json({
                    success: false,
                    message: msg
                });
            }

            try {
                fs.writeFile(getOptionsPath(), JSON.stringify(result, null, 2), { encoding: 'utf-8' }, () => {
                    const toSend = {
                        success: true,
                        oldOptions,
                        newOptions: result
                    };
                    log.warn(
                        `Got PATCH /options request from with successful changes:\n${JSON.stringify(
                            toSend,
                            null,
                            2
                        )}, request info:\n${requestRawHeader}`
                    );
                    return res.json(toSend);
                });
            } catch (err) {
                log.warn(`Got PATCH /options request with error, request info:\n${requestRawHeader}`);
                const msg = 'Error saving patched options';
                log.error(msg, err);
                return res.json({
                    success: false,
                    message: msg
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
