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
        this.schemaManager = new SchemaManager({ apiKey: this.steamApiKey, updateTime: 3_600_000, lite: true });
    }

    initializeSchema(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.schemaManager.init(err => {
                if (err) {
                    return reject(err);
                }

                this.schema = this.schemaManager.schema;

                this.schemaManager.on('schema', () => {
                    this.defindexes = this.getDefindexes();
                    generateSchemaFile(this.schema, this.schemaPath);
                });

                return resolve();
            });
        });
    }

    getDefindexes(): Defindexes {
        const schemaItemsSize = this.schema.raw.schema.items.length;
        const defindexes = {};

        for (let i = 0; i < schemaItemsSize; i++) {
            const schemaItem = this.schema.raw.schema.items[i];
            defindexes[schemaItem.defindex] = schemaItem.item_name;
        }

        return defindexes;
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
