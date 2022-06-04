import { Schema } from '@tf2autobot/tf2-schema';
import { UnknownDictionary } from '../types/common';
import { Embeds, Webhook } from '../types/interfaces/DiscordWebhook';
import IOptions from './IOptions';
import { Prices } from './Pricelist';
import Server from './Server';
import SKU from '@tf2autobot/tf2-sku';
import * as images from '../lib/data';
import Currencies from '@tf2autobot/tf2-currencies';
import log from '../lib/logger';
import axios, { AxiosError } from 'axios';
import { getTimeUTC } from '../lib/tools/time';
import getBaseItemImage from '../lib/tools/getBaseItemImage';

type Type = 'server' | 'priceUpdate';

export default class DiscordWebhook {
    private isMentionedKeyPrices = false;

    constructor(private server: Server, private schema: Schema) {
        PriceUpdateQueue.setUrls(this.server.options.discord.priceUpdate.urls);
    }

    sendWebhookPriceUpdate(
        sku: string,
        time: number,
        newPrices: Prices,
        oldPrices: Prices | null,
        isNew: boolean,
        buyChangesValue: number | null,
        sellChangesValue: number | null
    ): void {
        const baseItemData = this.schema.getItemBySKU(sku);
        const item = SKU.fromString(sku);
        const itemName = this.schema.getName(item, false);
        const parts = sku.split(';');

        const [itemImageUrlPrint] = getBaseItemImage(baseItemData, item, itemName);

        let effectsId: string;
        if (parts[2]) {
            effectsId = parts[2].replace('u', '');
        }

        let effectURL: string;
        if (!effectsId) {
            effectURL = '';
        } else effectURL = `https://autobot.tf/images/effects/${effectsId}_94x94.png`;

        const qualityItem = parts[1];
        const qualityColorPrint = images.qualityColor[qualityItem];

        const keyPrice = this.server.pricelist.keyPrice;
        const conversion = sku === '5021;6' ? undefined : keyPrice;
        const timeStr = getTimeUTC(time);

        const webhook = setWebhook('priceUpdate', this.server.options, '', [
            {
                author: {
                    name: itemName,
                    url: `https://autobot.tf/items/${sku}`,
                    icon_url:
                        'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/3d/3dba19679c4a689b9d24fa300856cbf3d948d631_full.jpg'
                },
                footer: {
                    text: `${sku} • ${timeStr} • v${process.env.SERVER_VERSION}`
                },
                thumbnail: {
                    url: itemImageUrlPrint
                },
                image: {
                    url: effectURL
                },
                title: '',
                fields: [
                    {
                        name: `Buying for${
                            isNew ? '✨' : buyChangesValue === 0 ? ' 🔄' : buyChangesValue > 0 ? ' 📈' : ' 📉'
                        }`,
                        value:
                            isNew || buyChangesValue === 0
                                ? newPrices.buy.toString()
                                : `${oldPrices.buy.toString()} → ${newPrices.buy.toString()} (${
                                      buyChangesValue > 0
                                          ? `+${Currencies.toCurrencies(buyChangesValue, conversion).toString()}`
                                          : Currencies.toCurrencies(buyChangesValue, conversion).toString()
                                  })`
                    },
                    {
                        name: `Selling for${
                            isNew ? '✨' : sellChangesValue === 0 ? ' 🔄' : sellChangesValue > 0 ? ' 📈' : ' 📉'
                        }`,
                        value:
                            isNew || sellChangesValue === 0
                                ? newPrices.sell.toString()
                                : `${oldPrices.sell.toString()} → ${newPrices.sell.toString()} (${
                                      sellChangesValue > 0
                                          ? `+${Currencies.toCurrencies(sellChangesValue, conversion).toString()}`
                                          : Currencies.toCurrencies(sellChangesValue, conversion).toString()
                                  })`
                    }
                ],
                color: qualityColorPrint
            }
        ]);

        PriceUpdateQueue.enqueue(sku, webhook);
    }

    private waitNextMention(): void {
        const hour12 = 12 * 60 * 60 * 1000;
        setTimeout(() => {
            this.isMentionedKeyPrices = false;
        }, hour12);
    }

    sendWebhookKeyUpdate(sku: string, prices: Prices, time: number): void {
        const itemImageUrl = this.schema.getItemByItemName('Mann Co. Supply Crate Key');
        const timeStr = getTimeUTC(time);

        const webhook = setWebhook('priceUpdate', this.server.options, '', [
            {
                author: {
                    name: 'Mann Co. Supply Crate Key',
                    url: `https://autobot.tf/items/${sku}`,
                    icon_url:
                        'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/3d/3dba19679c4a689b9d24fa300856cbf3d948d631_full.jpg'
                },
                footer: {
                    text: `${sku} • ${timeStr} • v${process.env.SERVER_VERSION}`
                },
                thumbnail: {
                    url: itemImageUrl.image_url_large
                },
                title: '',
                fields: [
                    {
                        name: 'Buying for',
                        value: `${prices.buy.keys > 0 ? `${prices.buy.keys} keys, ` : ''}${prices.buy.metal} ref`,
                        inline: true
                    },
                    {
                        name: 'Selling for',
                        value: `${prices.sell.keys > 0 ? `${prices.sell.keys} keys, ` : ''}${prices.sell.metal} ref`,
                        inline: true
                    }
                ],
                color: '16766720'
            }
        ]);

        const opt = this.server.options.discord.priceUpdate.keyPrices;
        // send key price update to only key price update webhook.
        opt.urls.forEach((url, i) => {
            if (this.isMentionedKeyPrices === false) {
                webhook.content = `<@&${opt.roleId}>`;

                if (opt.urls.length - i === 1) {
                    this.isMentionedKeyPrices = true;
                    this.waitNextMention();
                }
            }

            sendWebhook(url, webhook).catch(err => {
                log.error(`❌ Failed to send key prices update webhook to Discord ${i}: `, err);
            });
        });
    }
}

export function setWebhook(type: Type, options: IOptions, content: string, embeds: Embeds[]): Webhook {
    const opt = options.discord[type];
    return {
        username: opt.displayName,
        avatar_url: opt.avatarUrl,
        content: content,
        embeds: embeds
    };
}

export function sendWebhook(url: string, webhook: Webhook): Promise<void> {
    return new Promise((resolve, reject) => {
        void axios({
            method: 'POST',
            url: url,
            data: webhook
        })
            .then(() => {
                resolve();
            })
            .catch((err: AxiosError) => {
                reject({ error: err, webhook });
            });
    });
}

export class PriceUpdateQueue {
    private static priceUpdate: UnknownDictionary<Webhook> = {};

    private static urls: string[];

    static setUrls(urls: string[]): void {
        this.urls = urls;
    }

    private static sleepTime = 1000;

    private static isRateLimited = false;

    private static isProcessing = false;

    static enqueue(sku: string, webhook: Webhook): void {
        this.priceUpdate[sku] = webhook;

        void this.process();
    }

    private static dequeue(): void {
        delete this.priceUpdate[this.first()];
    }

    private static first(): string {
        return Object.keys(this.priceUpdate)[0];
    }

    private static size(): number {
        return Object.keys(this.priceUpdate).length;
    }

    private static async process(): Promise<void> {
        const sku = this.first();

        if (sku === undefined || this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        await new Promise(resolve => setTimeout(resolve, this.sleepTime));

        if (this.isRateLimited) {
            this.sleepTime = 1000;
            this.isRateLimited = false;
        }

        this.urls.forEach((url, i) => {
            sendWebhook(url, this.priceUpdate[sku])
                .catch(err => {
                    /*eslint-disable */
                    if (err.text) {
                        const errContent = JSON.parse(err.text);
                        if (errContent?.message === 'The resource is being rate limited.') {
                            this.sleepTime = errContent.retry_after;
                            this.isRateLimited = true;
                        }
                    }
                    /*eslint-enable */
                })
                .finally(() => {
                    if (this.urls.length - i === 1) {
                        // Last, then we dequeue.
                        this.isProcessing = false;
                        this.dequeue();
                        void this.process();
                    }
                });
        });
    }
}
