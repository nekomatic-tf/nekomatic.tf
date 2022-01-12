const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

const levels = {
    debug: 5,
    verbose: 4,
    info: 3,
    warn: 2,
    trade: 1,
    error: 0,
};

const colors = {
    debug: 'blue',
    verbose: 'cyan',
    info: 'green',
    warn: 'yellow',
    trade: 'magenta',
    error: 'red',
};

winston.addColors(colors);

const levelFilter = function (level) {
    return winston.format((info) => {
        if (info.level !== level) {
            return false;
        }

        return info;
    });
};

const privateFilter = winston.format((info) => {
    if (info.private === true) {
        return false;
    }

    return info;
});

const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({
        stack: true,
    }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.colorize(),
    winston.format.errors({
        stack: true,
    }),
    winston.format.printf((info) => {
        let msg = `${info.timestamp} ${info.level}: ${info.message}`;

        // @ts-ignore
        const splat = info[Symbol.for('splat')];

        if (splat) {
            if (splat.length === 1) {
                msg += ` ${JSON.stringify(splat[0])}`;
            } else if (splat.length > 1) {
                // @ts-ignore
                msg += ` ${JSON.stringify(info[Symbol.for('splat')])}`;
            }
        }

        return msg;
    })
);

const logger = winston.createLogger({
    levels: levels,
});

const debugPath = path.join(__dirname, `../../logs/debug-%DATE%.log`);
const errorPath = path.join(__dirname, `../../logs/error-%DATE%.log`);

const initLogger = function () {
    const transports = [
        {
            type: 'DailyRotateFile',
            filename: debugPath,
            level: 'debug',
            filter: 'private',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxFiles: '14d',
        },
        {
            type: 'File',
            filename: errorPath,
            level: 'error',
        },
        {
            type: 'Console',
            level: 'debug',
        },
    ];

    transports.forEach(function (transport) {
        const type = transport.type;

        delete transport.type;

        if (['File', 'DailyRotateFile'].includes(type)) {
            transport['format'] = fileFormat;
        } else if (type === 'Console') {
            transport['format'] = consoleFormat;
        }

        const filter = transport.filter;

        if (filter) {
            delete transport.filter;

            if (filter === 'trade') {
                transport['format'] = winston.format.combine(
                    levelFilter(filter)(),
                    transport['format']
                );
            } else if (filter === 'private') {
                transport['format'] = winston.format.combine(
                    privateFilter(),
                    transport['format']
                );
            }
        }

        logger.add(new winston.transports[type](transport));
    });
};

exports.initLogger = initLogger;
exports.default = logger;