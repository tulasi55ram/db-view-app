"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPostgresConfig = isPostgresConfig;
exports.isMySQLConfig = isMySQLConfig;
exports.isSQLServerConfig = isSQLServerConfig;
exports.isSQLiteConfig = isSQLiteConfig;
exports.isMongoDBConfig = isMongoDBConfig;
exports.isRedisConfig = isRedisConfig;
// Type guards
function isPostgresConfig(config) {
    return config.dbType === 'postgres';
}
function isMySQLConfig(config) {
    return config.dbType === 'mysql';
}
function isSQLServerConfig(config) {
    return config.dbType === 'sqlserver';
}
function isSQLiteConfig(config) {
    return config.dbType === 'sqlite';
}
function isMongoDBConfig(config) {
    return config.dbType === 'mongodb';
}
function isRedisConfig(config) {
    return config.dbType === 'redis';
}
