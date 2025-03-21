"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = exports.logger = void 0;
var winston = require("winston");
var config_1 = require("../config");
// Define log format
var logFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json());
// Create logger instance
exports.logger = winston.createLogger({
    level: config_1.config.logLevel,
    format: logFormat,
    defaultMeta: { service: 'crowdship-api' },
    transports: [
        // Console logging
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.printf(function (_a) {
                var timestamp = _a.timestamp, level = _a.level, message = _a.message, service = _a.service, rest = __rest(_a, ["timestamp", "level", "message", "service"]);
                return "".concat(timestamp, " [").concat(service, "] ").concat(level, ": ").concat(message, " ").concat(Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '');
            })),
        }),
        // File logging - error level
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        // File logging - all levels
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ],
});
// Add stream for Morgan
exports.stream = {
    write: function (message) {
        exports.logger.http(message.trim());
    },
};
// If we're not in production, log to the console with colors
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }));
}
