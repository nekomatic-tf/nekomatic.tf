import jsonschema from 'jsonschema';
const Validator = jsonschema.Validator;

const v = new Validator();

import { optionsSchema } from '../schemas/options-json/options';
v.addSchema(optionsSchema);

import { EntryData } from '../classes/Pricelist';
import { JsonOptions } from '../classes/IOptions';

export = function (data: EntryData | JsonOptions, schema: string): string[] | null {
    const putSchema = schema === 'options' ? optionsSchema : {};

    const validated = v.validate(data, putSchema);
    if (validated.valid === true) {
        return null;
    }

    return errorParser(validated);
};

function errorParser(validated: jsonschema.ValidatorResult): string[] {
    const errors: string[] = [];
    for (let i = 0; i < validated.errors.length; i++) {
        const error = validated.errors[i];
        let property = error.property;
        if (property.startsWith('instance.')) {
            property = property.replace('instance.', '');
        } else if (property === 'instance') {
            property = '';
        }

        let message = error.stack;
        if (error.name === 'additionalProperties') {
            message = `unknown property "${error.argument as string}"`;
        } else if (property) {
            if (error.name === 'anyOf') {
                message = `"${property}" does not have a valid value`;
            } else {
                message = message.replace(error.property, `"${property}"`).trim();
            }
        } else {
            message = message.replace(error.property, property).trim();
        }

        errors.push(message);
    }
    return errors;
}
