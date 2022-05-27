import SchemaManager, { Schema } from '@tf2autobot/tf2-schema';
import fs from 'fs';
import path from 'path';

interface Defindexes {
    [defindex: string]: string;
}

export default class SchemaManagerTF2 {
    public schemaManager: SchemaManager;

    public schema: Schema;

    public defindexes: Defindexes;

    public schemaPath = path.join(__dirname, '../../../public/files/schema.json');

    public generateSchemaInterval: NodeJS.Timeout;

    constructor(private steamApiKey: string) {
        this.schemaManager = new SchemaManager({ apiKey: this.steamApiKey, updateTime: 3_600_000 });
    }

    initializeSchema(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.schemaManager.init(err => {
                if (err) {
                    return reject(err);
                }

                this.schema = this.schemaManager.schema;
                this.defindexes = this.getDefindexes();

                generateSchemaFile(this.schema, this.schemaPath);
                this.setGenerateSchema();

                return resolve();
            });
        });
    }

    getDefindexes(): Defindexes {
        const schemaItems = this.schema.raw.schema.items;
        const schemaItemsSize = schemaItems.length;
        const defindexes = {};

        for (let i = 0; i < schemaItemsSize; i++) {
            const schemaItem = schemaItems[i];
            defindexes[schemaItem.defindex] = schemaItem.item_name;
        }

        return defindexes;
    }

    setGenerateSchema(): void {
        const hours1 = 3_600_000;
        const mins1 = 60_000;
        this.generateSchemaInterval = setInterval(() => {
            generateSchemaFile(this.schema, this.schemaPath);

            this.defindexes = this.getDefindexes();
        }, hours1 + mins1);
    }

    shutdown(): void {
        clearInterval(this.generateSchemaInterval);

        // Stop updating schema
        clearTimeout(this.schemaManager?._updateTimeout);
        clearInterval(this.schemaManager?._updateInterval);
    }
}

function generateSchemaFile(schema: Schema, schemaPath: string) {
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), {
        encoding: 'utf8'
    });
}
