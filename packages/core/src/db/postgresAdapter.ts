import type { Column, ConnectionConfig, Row, Table } from "../types/index.js";

/**
 * PostgresAdapter - Database adapter for PostgreSQL
 * Note: This class is currently not implemented with real database connections.
 * For actual PostgreSQL functionality, use the PostgresClient in the vscode-extension package.
 */
export class PostgresAdapter {
  constructor(private readonly config: ConnectionConfig) {}

  async listSchemas(): Promise<string[]> {
    throw new Error("PostgresAdapter.listSchemas() is not implemented. Use PostgresClient instead.");
  }

  async listTables(schema: string): Promise<Table[]> {
    throw new Error("PostgresAdapter.listTables() is not implemented. Use PostgresClient instead.");
  }

  async fetchRows(schema: string, table: string): Promise<Row[]> {
    throw new Error("PostgresAdapter.fetchRows() is not implemented. Use PostgresClient instead.");
  }
}
