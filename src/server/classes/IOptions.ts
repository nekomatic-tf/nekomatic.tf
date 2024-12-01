import { snakeCase } from 'change-case';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import jsonlint from '@tf2autobot/jsonlint';
import * as path from 'path';
import { AnyObject, deepMerge } from '../lib/tools/deep-merge';
import validator from '../lib/validator';

const DEFAULTS: JsonOptions = {
    oldBptfDomain: 'https://old.backpack.tf',
    redirects: {
        backpacktf: 'https://backpack.tf',
        discord: 'https://discord.gg/2Y3Kegc85E',
        github: 'https://github.com/nekomatic-tf/',
        steam: 'https://steamcommunity.com/groups/TF2Autobot-Neko',
        youtube: 'https://www.youtube.com/channel/UCLSQJ9DRlj0oiK4JMg8gRVA'
    },
    discord: {
        server: {
            displayName: 'Nekomatic.tf',
            avatarUrl: 'https://nekomatic.tf/images/nekomatic.png',
            enabled: true,
            url: '',
            mentions: {
                userIds: [], // Should be '527868979600031765' - IdiNium, and '276706259971997696' - maximilianmaliar
                roleId: '978634678795907112' // - 🌐｜Autobot.tf alert
            }
        },
        priceUpdate: {
            displayName: 'prices.tf',
            avatarUrl:
                'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/avatars/3d/3dba19679c4a689b9d24fa300856cbf3d948d631_full.jpg',
            enabled: true,
            urls: [],
            keyPrices: {
                urls: [],
                roleId: '742723818568679505' // - 🔑｜Keyprices alert
            }
        }
    }
};

// ------------ JsonOptions ------------

export interface MentionsServer {
    userIds: string[];
    roleId: string;
}

export interface Server {
    displayName: string;
    avatarUrl: string;
    enabled: boolean;
    url: string;
    mentions: MentionsServer;
}

export interface PriceUpdate {
    displayName: string;
    avatarUrl: string;
    enabled: boolean;
    urls: string[];
    keyPrices: {
        urls: string[];
        roleId: string;
    };
}

export interface Discord {
    server: Server;
    priceUpdate: PriceUpdate;
}

export interface Redirects {
    backpacktf: string;
    discord: string;
    github: string;
    steam: string;
    youtube: string;
}

export interface JsonOptions {
    oldBptfDomain: string;
    redirects: Redirects;
    discord: Discord;
}

export default interface IOptions extends JsonOptions {
    steamApiKey: string;
    port: number;
    secretKeyAdmin: string;
    dev: boolean;
}

function getOption<T>(option: string, def: T, parseFn: (target: string) => T, options?: IOptions): T {
    try {
        if (options && options[option]) {
            return options[option] as T;
        }
        const envVar = snakeCase(option).toUpperCase();
        return process.env[envVar] ? parseFn(process.env[envVar]) : def;
    } catch {
        return def;
    }
}

function throwLintError(filepath: string, e: Error): void {
    if (e instanceof Error && 'message' in e) {
        throw new Error(`${filepath}\n${e.message}`);
    }

    throw e;
}

function lintPath(filepath: string): void {
    const rawOptions = readFileSync(filepath, { encoding: 'utf8' });
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        jsonlint.parse(rawOptions);
    } catch (e) {
        throwLintError(filepath, e as Error);
    }
}

function lintAllTheThings(directory: string): void {
    if (existsSync(directory)) {
        readdirSync(directory, { withFileTypes: true })
            .filter(ent => path.extname(ent.name) === '.json')
            .forEach(ent => lintPath(path.join(directory, ent.name)));
    }
}

function loadJsonOptions(optionsPath: string, options?: IOptions): JsonOptions {
    let fileOptions;
    const workingDefault = deepMerge({}, DEFAULTS);
    const incomingOptions = options ? deepMerge({}, options) : deepMerge({}, DEFAULTS);

    try {
        const rawOptions = readFileSync(optionsPath, { encoding: 'utf8' });
        try {
            const parsedRaw = JSON.parse(rawOptions) as JsonOptions;

            fileOptions = deepMerge({}, workingDefault, parsedRaw);
            return deepMerge(fileOptions as AnyObject, incomingOptions) as JsonOptions;
        } catch (e) {
            if (e instanceof SyntaxError) {
                // lint the rawOptions to give better feedback since it is SyntaxError
                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    jsonlint.parse(rawOptions);
                } catch (e) {
                    throwLintError(optionsPath, e as Error);
                }
            }
            throw e;
        }
    } catch (e) {
        // file or directory is missing or something else is wrong
        if (!existsSync(path.dirname(optionsPath))) {
            // check for dir
            mkdirSync(path.dirname(optionsPath), { recursive: true });
            writeFileSync(optionsPath, JSON.stringify(DEFAULTS, null, 4), { encoding: 'utf8' });
            return deepMerge({}, DEFAULTS) as JsonOptions;
        } else if (!existsSync(optionsPath)) {
            // directory is present, see if file was missing
            writeFileSync(optionsPath, JSON.stringify(DEFAULTS, null, 4), { encoding: 'utf8' });
            return deepMerge({}, DEFAULTS) as JsonOptions;
        } else {
            // something else is wrong, throw the error
            throw e;
        }
    }
}

export function removeCliOptions(incomingOptions: IOptions): void {
    const findNonEnv = validator(incomingOptions, 'options');
    if (findNonEnv) {
        findNonEnv
            .filter(e => e.includes('unknown property'))
            .map(e => e.slice(18, -1))
            .map(e => delete incomingOptions[e]);
    }
}

export function loadOptions(options?: IOptions): IOptions {
    const incomingOptions = (options ? deepMerge({}, options) : {}) as IOptions;
    lintAllTheThings(getFilesPath()); // you shall not pass

    // const jsonParseArray = (jsonString: string): string[] => JSON.parse(jsonString) as unknown as string[];
    const jsonParseBoolean = (jsonString: string): boolean => JSON.parse(jsonString) as unknown as boolean;
    const jsonParseNumber = (jsonString: string): number => JSON.parse(jsonString) as unknown as number;

    const envOptions = {
        steamApiKey: getOption('steamApiKey', '', String, incomingOptions),
        port: getOption('port', 3000, jsonParseNumber, incomingOptions),
        secretKeyAdmin: getOption('secretKeyAdmin', '', String, incomingOptions),
        dev: getOption('dev', false, jsonParseBoolean, incomingOptions)
    };

    removeCliOptions(incomingOptions);
    const jsonOptions = loadJsonOptions(getOptionsPath(), incomingOptions);

    const errors = validator(jsonOptions as IOptions, 'options');
    if (errors !== null) {
        throw new Error(errors.join(', '));
    }

    return deepMerge(jsonOptions, envOptions, incomingOptions) as IOptions;
}

export function getFilesPath(): string {
    return path.resolve(__dirname, '..', '..', '..', 'files');
}

export function getOptionsPath(): string {
    return path.resolve(getFilesPath(), 'options.json');
}
