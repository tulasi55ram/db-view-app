"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresAdapter = void 0;
/**
 * PostgresAdapter - Database adapter for PostgreSQL
 * Note: This class is currently not implemented with real database connections.
 * For actual PostgreSQL functionality, use the PostgresClient in the vscode-extension package.
 */
class PostgresAdapter {
    constructor(config) {
        this.config = config;
    }
    async listSchemas() {
        throw new Error("PostgresAdapter.listSchemas() is not implemented. Use PostgresClient instead.");
    }
    async listTables(schema) {
        throw new Error("PostgresAdapter.listTables() is not implemented. Use PostgresClient instead.");
    }
    async fetchRows(schema, table) {
        throw new Error("PostgresAdapter.fetchRows() is not implemented. Use PostgresClient instead.");
    }
}
exports.PostgresAdapter = PostgresAdapter;
