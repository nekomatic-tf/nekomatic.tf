import jsonschema from 'jsonschema';

export const optionsSchema: jsonschema.Schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    definitions: {
        'string-array': {
            type: 'array',
            items: {
                type: 'string'
            },
            required: false,
            additionalProperties: false
        }
    },
    properties: {
        oldBptfDomain: {
            type: 'string'
        },
        redirects: {
            type: 'object',
            properties: {
                backpacktf: {
                    type: 'string'
                },
                discord: {
                    type: 'string'
                },
                github: {
                    type: 'string'
                },
                steam: {
                    type: 'string'
                },
                youtube: {
                    type: 'string'
                }
            },
            required: ['backpacktf', 'discord', 'github', 'steam', 'youtube'],
            additionalProperties: false
        },
        discord: {
            type: 'object',
            properties: {
                server: {
                    type: 'object',
                    properties: {
                        displayName: {
                            type: 'string'
                        },
                        avatarUrl: {
                            type: 'string'
                        },
                        enabled: {
                            type: 'boolean'
                        },
                        url: {
                            type: 'string'
                        },
                        mentions: {
                            type: 'object',
                            properties: {
                                userIds: {
                                    $ref: '#/definitions/string-array'
                                },
                                roleId: {
                                    type: 'string'
                                }
                            },
                            required: ['userIds', 'roleId'],
                            additionalProperties: false
                        }
                    },
                    required: ['displayName', 'avatarUrl', 'enabled', 'url', 'mentions'],
                    additionalProperties: false
                },
                priceUpdate: {
                    type: 'object',
                    properties: {
                        displayName: {
                            type: 'string'
                        },
                        avatarUrl: {
                            type: 'string'
                        },
                        enabled: {
                            type: 'boolean'
                        },
                        urls: {
                            type: '#/definitions/string-array'
                        },
                        keyPrices: {
                            type: 'object',
                            properties: {
                                urls: {
                                    $ref: '#/definitions/string-array'
                                },
                                roleId: {
                                    type: 'string'
                                }
                            },
                            required: ['urls', 'roleId'],
                            additionalProperties: false
                        }
                    },
                    required: ['displayName', 'avatarUrl', 'enabled', 'urls', 'keyPrices'],
                    additionalProperties: false
                }
            }
        }
    },
    required: ['oldBptfDomain', 'redirects', 'discord'],
    additionalProperties: false
};
