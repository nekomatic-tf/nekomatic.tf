import SchemaManagerTF2 from './SchemaManager';
import pm2 from 'pm2';
import log from '../lib/logger';
import { waitForWriting } from '../lib/files';
import IPricer from '../types/interfaces/IPricer';
import IOptions from './IOptions';
import Server from './Server';

export default class ServerManager {
    private schemaManager: SchemaManagerTF2;

    public server: Server = null;

    private stopRequested = false;

    private stopRequestCount = 0;

    private stopping = false;

    private exiting = false;

    constructor(private readonly pricer: IPricer) {
        this.pricer = pricer;
    }

    get isStopping(): boolean {
        return this.stopping || this.stopRequested;
    }

    get isServerReady(): boolean {
        return this.server !== null && this.server.isReady;
    }

    start(options: IOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            log.debug('Connecting to PM2...');
            this.connectToPM2()
                .then(() => {
                    log.info('Starting server...');

                    this.pricer.init();

                    log.debug('Initializing tf2schema...');
                    this.schemaManager = new SchemaManagerTF2(options.steamApiKey);
                    void this.schemaManager.initializeSchema().then(() => {
                        this.server = new Server(this, this.pricer, this.schemaManager, options);

                        this.server
                            .start()
                            .then(() => {
                                return resolve();
                            })
                            .catch(err => {
                                if (err) {
                                    return reject(err);
                                }

                                if (this.isStopping) {
                                    // Shutdown is requested, stop the bot
                                    return this.stop(null, false, false);
                                }
                            });
                    });
                })
                .catch(err => {
                    if (err) {
                        return reject(err);
                    }

                    if (this.isStopping) {
                        // Shutdown is requested, stop the bot
                        return this.stop(null, false, false);
                    }
                });
        });
    }

    stop(err: Error | null, checkIfReady = true, rudely = false): void {
        log.debug('Shutdown has been initialized, stopping...', { err: err });

        this.stopRequested = true;
        this.stopRequestCount++;

        if (this.stopRequestCount >= 10) {
            rudely = true;
        }

        if (rudely) {
            log.warn('Forcefully exiting');
            return this.exit(err);
        }

        if (err === null && checkIfReady && this.server !== null && !this.server.isReady) {
            return;
        }

        if (this.stopping) {
            // We are already shutting down
            return;
        }

        this.stopping = true;

        this.cleanup();

        if (this.server === null) {
            log.debug('Server instance was not yet created');
            return this.exit(err);
        }
    }

    stopProcess(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (process.env.pm_id === undefined) {
                this.stop(null);
                return resolve();
            }

            log.warn('Stop has been requested, stopping...');

            pm2.stop(process.env.pm_id, err => {
                if (err) {
                    return reject(err);
                }

                return resolve();
            });
        });
    }

    restartProcess(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            // When running Docker, just signal the process to kill.
            // Setting --restart=Always will make sure the container is restarted.
            if (process.env.DOCKER !== undefined) {
                this.stop(null);
                return resolve(true);
            }

            if (process.env.pm_id === undefined) {
                return resolve(false);
            }

            log.warn('Restart has been initialized, restarting...');

            pm2.restart(process.env.pm_id, err => {
                if (err) {
                    return reject(err);
                }

                return resolve(true);
            });
        });
    }

    private cleanup(): void {
        if (this.server !== null) {
            // Stop updating schema
            this.schemaManager.shutdown();

            // Close all server connections
            this.server.expressManager.shutdown();

            clearInterval(this.server.cratetfCratesInterval);
        }

        // Disconnect from socket server to stop price updates
        this.pricer.shutdown();
    }

    private exit(err: Error | null): void {
        if (this.exiting) {
            return;
        }

        this.exiting = true;

        log.debug('Waiting for files to be saved');
        void waitForWriting().then(() => {
            log.debug('Done waiting for files');

            log.on('finish', () => {
                // Logger has finished, exit the process
                process.exit(err ? 1 : 0);
            });

            log.warn('Exiting...');

            // Stop the logger
            log.end();
        });
    }

    connectToPM2(): Promise<void> {
        return new Promise((resolve, reject) => {
            pm2.connect(err => {
                if (err) {
                    return reject(err);
                }

                return resolve();
            });
        });
    }
}
