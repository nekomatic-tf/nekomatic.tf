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
import { XMLHttpRequest } from 'xmlhttprequest-ts';

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

        let itemImageUrlPrint: string;

        if (!baseItemData || !item) {
            itemImageUrlPrint = 'https://jberlife.com/wp-content/uploads/2019/07/sorry-image-not-available.jpg';
        } else if (images.retiredKeys[item.defindex] !== undefined) {
            itemImageUrlPrint = images.retiredKeys[item.defindex];
        } else if (
            itemName.includes('Non-Craftable') &&
            itemName.includes('Killstreak') &&
            itemName.includes('Kit') &&
            !itemName.includes('Fabricator')
        ) {
            // Get image for Non-Craftable Killstreak/Specialized Killstreak/Professional Killstreak [Weapon] Kit
            const front =
                'https://community.cloudflare.steamstatic.com/economy/image/IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdEH9myp0du1AHE66AL6lNU5Fw_2yIWtaMjIpQmjAT';

            const url = itemName.includes('Specialized')
                ? images.ks2Images[item.target]
                : itemName.includes('Professional')
                ? images.ks3Images[item.target]
                : images.ks1Images[item.target];

            if (url) {
                itemImageUrlPrint = `${front}${url}/520fx520f`;
            }

            if (!itemImageUrlPrint) {
                itemImageUrlPrint = baseItemData.image_url_large;
            }
        } else if (
            (itemName.includes('Strangifier') && !itemName.includes('Chemistry Set')) ||
            itemName.includes('Unusualifier')
        ) {
            const front =
                'https://community.cloudflare.steamstatic.com/economy/image/IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdEH9myp0du1AHE66AL6lNU5Fw_2yIWtaMjIpQmjAT';
            const url = itemName.includes('Unusualifier')
                ? images.unusualifierImages[item.target]
                : images.strangifierImages[item.target];

            if (url) {
                itemImageUrlPrint = `${front}${url}/520fx520f`;
            }

            if (!itemImageUrlPrint) {
                itemImageUrlPrint = baseItemData.image_url_large;
            }
        } else if (images.paintCans.includes(`${item.defindex}`)) {
            itemImageUrlPrint = `https://steamcommunity-a.akamaihd.net/economy/image/IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdEH9myp0erksICf${
                images.paintCan[item.defindex]
            }520fx520f`;
        } else if (item.australium === true) {
            // No festivized image available for Australium
            itemImageUrlPrint = images.australiumImageURL[item.defindex]
                ? `https://steamcommunity-a.akamaihd.net/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgE${
                      images.australiumImageURL[item.defindex]
                  }520fx520f`
                : itemImageUrlPrint;
        } else if (item.paintkit !== null) {
            const newItem = SKU.fromString(`${item.defindex};6`);
            itemImageUrlPrint = `https://scrap.tf/img/items/warpaint/${encodeURIComponent(
                this.schema.getName(newItem, false)
            )}_${item.paintkit}_${item.wear}_${item.festive === true ? 1 : 0}.png`;
        } else if (item.festive) {
            const front =
                'https://community.cloudflare.steamstatic.com/economy/image/fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEMaQkUTxr2vTx8';
            itemImageUrlPrint = images.festivizedImages[item.defindex]
                ? `${front}${images.festivizedImages[item.defindex]}/520fx520f`
                : baseItemData.image_url_large;
        } else {
            itemImageUrlPrint = baseItemData.image_url_large;
        }

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

        const webhook = setWebhook('priceUpdate', this.server.options, '', [
            {
                author: {
                    name: itemName,
                    url: `https://autobot.tf/items/${sku}`,
                    icon_url:
                        'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/3d/3dba19679c4a689b9d24fa300856cbf3d948d631_full.jpg'
                },
                footer: {
                    text: `${sku} • ${String(new Date(time * 1000)).replace('Coordinated Universal Time', 'UTC')} • v${
                        process.env.SERVER_VERSION
                    }`
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
                        name: 'Buying for',
                        value: isNew
                            ? `${newPrices.buy.toString()}`
                            : `${oldPrices.buy.toString()} → ${newPrices.buy.toString()} (${
                                  buyChangesValue > 0
                                      ? `+${Currencies.toCurrencies(buyChangesValue, conversion).toString()}`
                                      : buyChangesValue === 0
                                      ? `0 ref`
                                      : Currencies.toCurrencies(buyChangesValue, conversion).toString()
                              })`
                    },
                    {
                        name: 'Selling for',
                        value: isNew
                            ? `${newPrices.sell.toString()}`
                            : `${oldPrices.sell.toString()} → ${newPrices.sell.toString()} (${
                                  sellChangesValue > 0
                                      ? `+${Currencies.toCurrencies(sellChangesValue, conversion).toString()}`
                                      : sellChangesValue === 0
                                      ? `0 ref`
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

        const webhook = setWebhook('priceUpdate', this.server.options, '', [
            {
                author: {
                    name: 'Mann Co. Supply Crate Key',
                    url: `https://autobot.tf/items/${sku}`,
                    icon_url:
                        'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/3d/3dba19679c4a689b9d24fa300856cbf3d948d631_full.jpg'
                },
                footer: {
                    text: `${sku} • ${String(new Date(time * 1000)).replace('Coordinated Universal Time', 'UTC')} • v${
                        process.env.SERVER_VERSION
                    }`
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
                webhook.content = opt.roleId[i] === 'no role' ? '' : `<@&${opt.roleId[i]}>`;

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
        const request = new XMLHttpRequest();

        request.onreadystatechange = (): void => {
            if (request.readyState === 4) {
                if (request.status === 204) {
                    return resolve();
                } else {
                    return reject({ text: request.responseText, webhook });
                }
            }
        };

        request.open('POST', url);
        request.setRequestHeader('Content-type', 'application/json');
        request.send(JSON.stringify(webhook));
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
