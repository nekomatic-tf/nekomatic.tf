import ReconnectingWebSocket from 'reconnecting-websocket';
import log from '../../logger';
import WS from 'ws';
import * as Events from 'reconnecting-websocket/events';
import PricesTfApi from './prices-tf-api';

export default class PricesTfSocketManager {
    private readonly socketClass;

    constructor(private api: PricesTfApi) {
        // https://stackoverflow.com/questions/28784375/nested-es6-classes
        this.socketClass = class WebSocket extends WS {
            constructor(url, protocols) {
                super(url, protocols, {
                    headers: {
                        Authorization: 'Bearer ' + api.token
                    }
                });
            }
        };
    }

    private ws: ReconnectingWebSocket;

    private socketDisconnected(): () => void {
        return () => {
            log.debug('Disconnected from socket server');
        };
    }

    private socketConnect(): () => void {
        return () => {
            log.debug('Connected to socket server');
        };
    }

    init(): void {
        this.shutDown();
        this.ws = new ReconnectingWebSocket('wss://ws.prices.tf', [], {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            WebSocket: this.socketClass,
            maxEnqueuedMessages: 0,
            startClosed: true
        });

        this.ws.addEventListener('open', this.socketConnect());

        this.ws.addEventListener('error', err => {
            if (err.message === 'Unexpected server response: 401') {
                log.debug('JWT expired');
                this.setupToken();
            } else {
                log.error('Websocket error', err?.error);
            }
        });

        this.ws.addEventListener('close', this.socketDisconnected());
    }

    private setupToken(): void {
        this.api
            .setupToken()
            .then(() => {
                if (!this.isConnecting()) {
                    log.debug('Wesocket not connecting, reconnecting...');
                    this.ws.reconnect();
                }
            })
            .catch(err => {
                log.error('Websocket error - setupToken():', err);
            });
    }

    isConnecting(): boolean {
        return this.ws.readyState === WS.CONNECTING;
    }

    connect(): void {
        this.ws.reconnect();
    }

    shutDown(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }
    }

    send(data: string): void {
        this.ws.send(data);
    }

    on<T extends keyof Events.WebSocketEventListenerMap>(name: T, handler: Events.WebSocketEventListenerMap[T]): void {
        this.ws.addEventListener(name, handler);
    }
}
