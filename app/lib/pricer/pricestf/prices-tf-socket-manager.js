const ReconnectingWebSocket = require('reconnecting-websocket');
const WS = require('ws');
// import * as Events from 'reconnecting-websocket/events';
// import PricesTfApi from './prices-tf-api';
const log = require('../../logger');

class PricesTfSocketManager {
    constructor(api) {
        // https://stackoverflow.com/questions/28784375/nested-es6-classes
        this.api = api;
        this.socketClass = class WebSocket extends WS {
            constructor(url, protocols) {
                super(url, protocols, {
                    headers: {
                        Authorization: 'Bearer ' + api.token,
                    },
                });
            }
        };
    }

    socketDisconnected() {
        return () => {
            log.default.debug('Disconnected from socket server');
        };
    }

    socketConnect() {
        return () => {
            log.default.debug('Connected to socket server');
        };
    }

    init() {
        return new Promise((resolve) => {
            this.shutDown();
            this.ws = new ReconnectingWebSocket('wss://ws.prices.tf', [], {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                WebSocket: this.socketClass,
                maxEnqueuedMessages: 0,
                startClosed: true,
            });

            this.ws.addEventListener('open', this.socketConnect());

            this.ws.addEventListener('error', (err) => {
                if (err.message === 'Unexpected server response: 401') {
                    log.default.warn('JWT expired');
                    void this.api
                        .setupToken()
                        .then(() => this.ws.reconnect())
                        .catch((err) => {
                            log.default.error('Websocket error - setupToken():', err);
                            // Don't attempt to reconnect
                        });
                } else {
                    log.default.error('Websocket error:', err?.error);
                }
            });

            this.ws.addEventListener('close', this.socketDisconnected());

            return resolve();
        });
    }

    connect() {
        this.ws.reconnect();
    }

    shutDown() {
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }
    }

    send(data) {
        this.ws.send(data);
    }

    on(name, handler) {
        this.ws.addEventListener(name, handler);
    }
}

exports.default = PricesTfSocketManager;
