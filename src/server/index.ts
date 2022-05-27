import 'module-alias/register';
// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
const { version: SERVER_VERSION } = require('../../package.json');
import PricesTfApi from './lib/pricer/pricestf/prices-tf-api';
import PricesTfPricer from './lib/pricer/pricestf/prices-tf-pricer';
import { loadOptions } from './classes/IOptions';

process.env.SERVER_VERSION = SERVER_VERSION as string;

import fs from 'fs';
import path from 'path';
import genPaths from './resources/paths';

if (!fs.existsSync(path.join(__dirname, '../../node_modules'))) {
    /* eslint-disable-next-line no-console */
    console.error('Missing dependencies! Install them by running `npm install`');
    process.exit(1);
}

import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });
const options = loadOptions();
const paths = genPaths();

import log, { init } from './lib/logger';
init(paths);

if (process.env.pm_id === undefined && process.env.DOCKER === undefined) {
    log.warn(
        "You are not running the server with PM2! If the server crashes it won't start again." +
            ' Get a VPS and run your server with PM2: https://github.com/TF2Autobot/tf2autobot/wiki/Getting-a-VPS'
    );
}

if (process.env.DOCKER !== undefined) {
    log.warn(
        'You are running the server with Docker! If the server crashes, it will start again only if you run the container with --restart=always'
    );
}

import ServerManager from './classes/ServerManager';
const api = new PricesTfApi();
const pricer = new PricesTfPricer(api);
const serverManager = new ServerManager(pricer);

import ON_DEATH from 'death';
import * as inspect from 'util';
import { setWebhook, sendWebhook } from './classes/DiscordWebhook';
import { uptime } from './lib/tools/time';
import { Webhook } from './types/interfaces/DiscordWebhook';
import { XMLHttpRequest } from 'xmlhttprequest-ts';

const optDW = options.discord.server;

ON_DEATH({ uncaughtException: true })((signalOrErr, origin) => {
    const crashed = !['SIGINT', 'SIGTERM'].includes(signalOrErr as 'SIGINT' | 'SIGTERM' | 'SIGQUIT');

    const ending = () => {
        process.exit(1);
    };

    if (crashed) {
        const serverReady = serverManager.isServerReady;

        const serverState =
            'Server' +
            (!serverReady
                ? ' failed to start properly, this is most likely a temporary error. See the log:'
                : ' crashed! Please create an issue with the following log:');

        const crashLogs = ['Stack trace:', inspect.inspect(origin), `${uptime()}`];

        const errorMessage = [
            serverState,
            `package.version: ${process.env.SERVER_VERSION || undefined}; node: ${process.version} ${
                process.platform
            } ${process.arch}}`
        ]
            .concat(crashLogs)
            .join('\r\n');

        log.error(errorMessage);

        // On crash, we can't use the sendWebhook function
        if (optDW.enabled && optDW.url !== '') {
            const webhook: Webhook = {
                username: optDW.displayName || 'Autobot.tf',
                avatar_url:
                    'https://user-images.githubusercontent.com/47635037/100915844-e05e7380-350f-11eb-96f1-6d61141c4a44.png',
                content: `${optDW.mentions.userIds.map(id => `<@!${id}>`).join(', ')}, <@&${optDW.mentions.roleId}>`,
                embeds: [
                    {
                        title: '💥 Server crashed!',
                        description: crashLogs.join('\r\n'),
                        color: '16711680', // Red
                        footer: {
                            text: `${String(new Date(Date.now()))} • v${process.env.SERVER_VERSION}`
                        }
                    }
                ]
            };

            const request = new XMLHttpRequest();
            request.onreadystatechange = () => {
                if (request.readyState === 4) {
                    if (request.status !== 204) {
                        log.error({ responseText: request.responseText, webhook });
                    }
                    ending();
                }
            };
            request.open('POST', optDW.url);
            request.setRequestHeader('Content-Type', 'application/json');
            request.send(JSON.stringify(webhook));
        } else {
            ending();
        }
    } else {
        log.warn('Received kill signal `' + (signalOrErr as string) + '`');

        if (options.dev !== true && optDW.enabled && optDW.url !== '') {
            const webhook = setWebhook('server', options, `<@&${optDW.mentions.roleId}>`, [
                {
                    title: '⚠️ Server is restarting/shutting down...',
                    description: 'We will be back shortly!',
                    color: '16776960', // Yellow
                    footer: {
                        text: `${String(new Date(Date.now()))} • v${process.env.SERVER_VERSION}`
                    }
                }
            ]);

            sendWebhook(optDW.url, webhook)
                .catch(err => {
                    log.error('Failed to send webhook on crash', err);
                })
                .finally(() => {
                    ending();
                });
        }
    }

    serverManager.stop(crashed ? (signalOrErr as Error) : null, true, false);
    log.info('Server uptime:' + String(uptime()));
    pricer?.shutdown();
});

process.on('message', message => {
    if (message === 'shutdown') {
        log.warn('Process received shutdown message, stopping...');
    } else {
        log.warn('Process received unknown message `' + (message as string) + '`');
    }

    if (options.dev !== true && optDW.enabled && optDW.url !== '') {
        const webhook = setWebhook(
            'server',
            options,
            message === 'shutdown'
                ? `<@&${optDW.mentions.roleId}>`
                : `${optDW.mentions.userIds.map(id => `<@!${id}>`).join(', ')}`,
            [
                {
                    title:
                        message === 'shutdown'
                            ? '⚠️ Server is restarting/shutting down...'
                            : '⚠️ Server received unknown message...',
                    description: message === 'shutdown' ? 'We will be back shortly!' : `Message: ${message as string}`,
                    color: '16776960', // Yellow
                    footer: {
                        text: `${String(new Date(Date.now()))} • v${process.env.SERVER_VERSION}`
                    }
                }
            ]
        );

        if (message === 'shutdown') {
            sendWebhook(optDW.url, webhook)
                .catch(err => {
                    log.error('Failed to send webhook on shutdown', err);
                })
                .finally(() => {
                    serverManager.stop(null, true, false);
                });
        } else {
            void sendWebhook(optDW.url, webhook).catch(err => {
                log.error('Failed to send webhook on receive unknown message', err);
            });
        }
    }
});

void serverManager
    .start(options)
    .then(() => {
        log.info(`Server is now live at http://localhost:${options.port}`);

        if (options.dev !== true && optDW.enabled && optDW.url !== '') {
            const webhook = setWebhook('server', options, `<@&${optDW.mentions.roleId}>`, [
                {
                    title: '🎉 Server is now live!',
                    description: `[Main page](https://autobot.tf) | [Random item](https://autobot.tf/items/random)`,
                    color: '3329330', // Green
                    footer: {
                        text: `${String(new Date(Date.now()))} • v${process.env.SERVER_VERSION}`
                    }
                }
            ]);

            void sendWebhook(optDW.url, webhook).catch(err => {
                log.error('Failed to send webhook on live', err);
            });
        }
    })
    .catch(err => {
        if (err) {
            throw err;
        }
    });
