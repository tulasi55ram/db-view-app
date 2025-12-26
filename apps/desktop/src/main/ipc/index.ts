import { ipcMain, clipboard, dialog, BrowserWindow } from "electron";
import { format as formatSql } from "sql-formatter";
import type { ConnectionManager } from "../services/ConnectionManager";
import type {
  LoadTableRowsParams,
  GetRowCountParams,
  GetTableMetadataParams,
  UpdateCellParams,
  InsertRowParams,
  DeleteRowsParams,
  RunQueryParams,
  ExplainQueryParams,
  GetViewsParams,
  SaveViewParams,
  DeleteViewParams,
  ExportDataParams,
  ImportDataParams,
  SaveDialogOptions,
  OpenDialogOptions,
} from "../../preload/api";
import { getAllConnections, saveConnection, deleteConnectionConfig } from "../services/SettingsStore";
import { passwordStore } from "../services/PasswordStore";
import type { DatabaseConnectionConfig, SavedView } from "@dbview/core";

// In-memory storage for saved views (could be moved to electron-store)
const savedViews: Map<string, SavedView[]> = new Map();

function getViewKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

/**
 * Register all IPC handlers
 */
export function registerAllHandlers(connectionManager: ConnectionManager): void {
  // ==================== Connection Management ====================

  ipcMain.handle("connections:getAll", async () => {
    return connectionManager.getConnectionsWithStatus();
  });

  ipcMain.handle("connections:save", async (_event, config: DatabaseConnectionConfig) => {
    await connectionManager.saveConnectionConfig(config);
  });

  ipcMain.handle("connections:delete", async (_event, name: string) => {
    await connectionManager.deleteConnection(name);
  });

  ipcMain.handle("connections:test", async (_event, config: DatabaseConnectionConfig) => {
    return connectionManager.testConnection(config);
  });

  ipcMain.handle("connections:connect", async (_event, connectionKey: string) => {
    const connections = getAllConnections();
    const config = connections.find((c) => connectionManager.getConnectionKey(c as any) === connectionKey);
    if (!config) {
      throw new Error(`Connection not found: ${connectionKey}`);
    }
    await connectionManager.getOrCreateAdapter(config);
  });

  ipcMain.handle("connections:disconnect", async (_event, connectionKey: string) => {
    await connectionManager.disconnect(connectionKey);
  });

  // ==================== Schema Operations ====================

  ipcMain.handle("schema:list", async (_event, connectionKey: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    return adapter.listSchemas();
  });

  ipcMain.handle("schema:getTables", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    return adapter.listTables(schema);
  });

  ipcMain.handle("schema:getHierarchy", async (_event, connectionKey: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    return adapter.getHierarchy();
  });

  // ==================== Table Operations ====================

  ipcMain.handle("table:loadRows", async (_event, params: LoadTableRowsParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.fetchTableRows(params.schema, params.table, {
      limit: params.limit,
      offset: params.offset,
      filters: params.filters,
      filterLogic: params.filterLogic,
    });
  });

  ipcMain.handle("table:getRowCount", async (_event, params: GetRowCountParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.getTableRowCount(params.schema, params.table, {
      filters: params.filters,
      filterLogic: params.filterLogic,
    });
  });

  ipcMain.handle("table:getMetadata", async (_event, params: GetTableMetadataParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.getTableMetadata(params.schema, params.table);
  });

  ipcMain.handle("table:getStatistics", async (_event, params: GetTableMetadataParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.getTableStatistics(params.schema, params.table);
  });

  ipcMain.handle("table:getIndexes", async (_event, params: GetTableMetadataParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    if (adapter.getIndexes) {
      return adapter.getIndexes(params.schema, params.table);
    }
    return [];
  });

  ipcMain.handle("table:updateCell", async (_event, params: UpdateCellParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    await adapter.updateCell(params.schema, params.table, params.primaryKey, params.column, params.value);
  });

  ipcMain.handle("table:insertRow", async (_event, params: InsertRowParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.insertRow(params.schema, params.table, params.values);
  });

  ipcMain.handle("table:deleteRows", async (_event, params: DeleteRowsParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.deleteRows(params.schema, params.table, params.primaryKeys);
  });

  // ==================== Query Operations ====================

  ipcMain.handle("query:run", async (_event, params: RunQueryParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    return adapter.runQuery(params.sql);
  });

  ipcMain.handle("query:format", async (_event, sql: string) => {
    try {
      return formatSql(sql, {
        language: "postgresql",
        tabWidth: 2,
        keywordCase: "upper",
        indentStyle: "standard",
        linesBetweenQueries: 2,
      });
    } catch (error) {
      throw new Error(`Failed to format SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ipcMain.handle("query:explain", async (_event, params: ExplainQueryParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }
    if (!adapter.explainQuery) {
      throw new Error("EXPLAIN not supported for this database type");
    }
    return adapter.explainQuery(params.sql);
  });

  // ==================== Saved Views ====================

  ipcMain.handle("views:getAll", async (_event, params: GetViewsParams) => {
    const key = getViewKey(params.schema, params.table);
    return savedViews.get(key) || [];
  });

  ipcMain.handle("views:save", async (_event, params: SaveViewParams) => {
    const key = getViewKey(params.schema, params.table);
    const views = savedViews.get(key) || [];

    // If setting as default, unset other defaults
    if (params.view.isDefault) {
      views.forEach((v) => {
        if (v.id !== params.view.id) {
          v.isDefault = false;
        }
      });
    }

    const existingIndex = views.findIndex((v) => v.id === params.view.id);
    if (existingIndex >= 0) {
      views[existingIndex] = params.view;
    } else {
      views.push(params.view);
    }

    savedViews.set(key, views);
  });

  ipcMain.handle("views:delete", async (_event, params: DeleteViewParams) => {
    const key = getViewKey(params.schema, params.table);
    const views = savedViews.get(key) || [];
    savedViews.set(
      key,
      views.filter((v) => v.id !== params.viewId)
    );
  });

  // ==================== ER Diagram ====================

  ipcMain.handle("diagram:getER", async (_event, connectionKey: string, schemas: string[]) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    if (!adapter.getERDiagramData) {
      return { tables: [], relationships: [] };
    }
    return adapter.getERDiagramData(schemas);
  });

  // ==================== Autocomplete ====================

  ipcMain.handle("autocomplete:getData", async (_event, connectionKey: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }

    const schemas = await adapter.listSchemas();
    const tables: any[] = [];
    const columns: Record<string, any[]> = {};

    // Limit tables for performance
    const MAX_TABLES = 500;
    const MAX_TABLES_WITH_METADATA = 100;

    for (const schema of schemas) {
      if (tables.length >= MAX_TABLES) break;

      const schemaTables = await adapter.listTables(schema);
      for (const table of schemaTables) {
        if (tables.length >= MAX_TABLES) break;
        tables.push({ ...table, schema });
      }
    }

    // Get metadata for first N tables
    for (let i = 0; i < Math.min(tables.length, MAX_TABLES_WITH_METADATA); i++) {
      const table = tables[i];
      try {
        const metadata = await adapter.getTableMetadata(table.schema, table.name);
        columns[`${table.schema}.${table.name}`] = metadata;
      } catch (error) {
        columns[`${table.schema}.${table.name}`] = [];
      }
    }

    return { schemas, tables, columns };
  });

  // ==================== Export/Import ====================

  ipcMain.handle("export:data", async (_event, params: ExportDataParams) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      defaultPath: `${params.schema}_${params.table}.${params.extension}`,
      filters: [{ name: params.extension.toUpperCase(), extensions: [params.extension] }],
    });

    if (result.canceled || !result.filePath) return null;

    const fs = await import("fs/promises");
    await fs.writeFile(result.filePath, params.content, "utf-8");
    return result.filePath;
  });

  ipcMain.handle("import:data", async (_event, params: ImportDataParams) => {
    const adapter = connectionManager.getAdapter(params.connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${params.connectionKey}`);
    }

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < params.rows.length; i++) {
      try {
        await adapter.insertRow(params.schema, params.table, params.rows[i]);
        successCount++;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { insertedCount: successCount, errors: errors.length > 0 ? errors : undefined };
  });

  // ==================== Clipboard ====================

  ipcMain.handle("clipboard:write", async (_event, text: string) => {
    clipboard.writeText(text);
  });

  // ==================== File Dialogs ====================

  ipcMain.handle("dialog:showSave", async (_event, options: SaveDialogOptions) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { canceled: true, filePaths: [] };

    const result = await dialog.showSaveDialog(window, {
      defaultPath: options.defaultPath,
      filters: options.filters,
    });

    return { canceled: result.canceled, filePaths: result.filePath ? [result.filePath] : [] };
  });

  ipcMain.handle("dialog:showOpen", async (_event, options: OpenDialogOptions) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { canceled: true, filePaths: [] };

    const result = await dialog.showOpenDialog(window, {
      filters: options.filters,
      properties: options.properties as any,
    });

    return { canceled: result.canceled, filePaths: result.filePaths };
  });
}
