import { ipcMain, clipboard, dialog, BrowserWindow } from "electron";
import { format as formatSql } from "sql-formatter";
import type { ConnectionManager } from "../services/ConnectionManager";
import type { ConnectionWithStatus } from "../services/ConnectionManager";
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
import {
  getAllConnections,
  getQueryHistory,
  addQueryHistoryEntry,
  clearQueryHistory,
  deleteQueryHistoryEntry,
  toggleQueryHistoryStar,
  getSavedQueries,
  addSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
  getFilterPresets,
  saveFilterPreset,
  deleteFilterPreset,
  getTabsState,
  saveTabsState,
  getSavedViews,
  saveSavedView,
  deleteSavedView,
  getConnectionOrder,
  saveConnectionOrder,
  type QueryHistoryEntry,
  type SavedQuery,
  type FilterPreset,
  type TabsState
} from "../services/SettingsStore";
import type { DatabaseConnectionConfig } from "@dbview/types";

/**
 * Broadcast connection status change to all renderer windows
 */
function broadcastConnectionStatus(connectionKey: string, status: ConnectionWithStatus["status"], error?: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send("connection:statusChange", { connectionKey, status, error });
    }
  }
}

/**
 * Broadcast import progress to all renderer windows
 */
function broadcastImportProgress(progress: { current: number; total: number; percentage: number }): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send("import:progress", progress);
    }
  }
}

// Track connections that have status listeners attached to prevent duplicate listeners
const connectionStatusListeners = new Set<string>();

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
    const adapter = await connectionManager.getOrCreateAdapter(config);

    // Only attach status listener once per connection to prevent duplicates
    if (!connectionStatusListeners.has(connectionKey)) {
      connectionStatusListeners.add(connectionKey);
      adapter.on("statusChange", (event) => {
        const status = event.status === "connected" ? "connected" : "disconnected";
        broadcastConnectionStatus(connectionKey, status);
      });
    }

    // Broadcast initial connected status
    broadcastConnectionStatus(connectionKey, "connected");
  });

  ipcMain.handle("connections:disconnect", async (_event, connectionKey: string) => {
    // Clean up listener tracking
    connectionStatusListeners.delete(connectionKey);
    await connectionManager.disconnect(connectionKey);
    broadcastConnectionStatus(connectionKey, "disconnected");
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

  ipcMain.handle("schema:getObjectCounts", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    return adapter.getObjectCounts(schema);
  });

  ipcMain.handle("schema:getViews", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    if (!adapter.listViews) {
      return [];
    }
    return adapter.listViews(schema);
  });

  ipcMain.handle("schema:getMaterializedViews", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    if (!adapter.listMaterializedViews) {
      return [];
    }
    return adapter.listMaterializedViews(schema);
  });

  ipcMain.handle("schema:getFunctions", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    if (!adapter.listFunctions) {
      return [];
    }
    return adapter.listFunctions(schema);
  });

  ipcMain.handle("schema:getProcedures", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    if (!adapter.listProcedures) {
      return [];
    }
    return adapter.listProcedures(schema);
  });

  ipcMain.handle("schema:getTypes", async (_event, connectionKey: string, schema: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    if (!adapter.listTypes) {
      return [];
    }
    return adapter.listTypes(schema);
  });

  ipcMain.handle("table:getColumns", async (_event, connectionKey: string, schema: string, table: string) => {
    const adapter = connectionManager.getAdapter(connectionKey);
    if (!adapter) {
      throw new Error(`Not connected: ${connectionKey}`);
    }
    return adapter.listColumns(schema, table);
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
      orderBy: params.orderBy,
      sortColumn: params.sortColumn,
      sortDirection: params.sortDirection,
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

  // ==================== Saved Views (persisted to disk) ====================

  ipcMain.handle("views:getAll", async (_event, params: GetViewsParams) => {
    return getSavedViews(params.schema, params.table);
  });

  ipcMain.handle("views:save", async (_event, params: SaveViewParams) => {
    saveSavedView(params.schema, params.table, params.view);
  });

  ipcMain.handle("views:delete", async (_event, params: DeleteViewParams) => {
    deleteSavedView(params.schema, params.table, params.viewId);
  });

  // ==================== Filter Presets ====================

  ipcMain.handle("filterPresets:getAll", async (_event, params: { schema: string; table: string }) => {
    return getFilterPresets(params.schema, params.table);
  });

  ipcMain.handle("filterPresets:save", async (_event, params: { schema: string; table: string; preset: FilterPreset }) => {
    saveFilterPreset(params.schema, params.table, params.preset);
  });

  ipcMain.handle("filterPresets:delete", async (_event, params: { schema: string; table: string; presetId: string }) => {
    deleteFilterPreset(params.schema, params.table, params.presetId);
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

    // Caps and limits for performance
    const MAX_TABLES = 500;
    const MAX_TABLES_WITH_METADATA = 100;
    const CONCURRENCY_LIMIT = 10;
    const TIMEOUT_MS = 10000; // 10 second timeout

    // Helper to yield to event loop between heavy operations
    const yieldToEventLoop = (): Promise<void> =>
      new Promise((resolve) => setImmediate(resolve));

    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

    try {
      const schemas = await adapter.listSchemas();
      const tables: any[] = [];
      const columns: Record<string, any[]> = {};

      if (abortController.signal.aborted) {
        throw new Error("Autocomplete timed out");
      }

      // Fetch tables from schemas in parallel (limited concurrency)
      const schemaTablePromises = schemas.map((schema) =>
        adapter.listTables(schema).then((schemaTables) =>
          schemaTables.map((table) => ({ ...table, schema }))
        )
      );
      const allSchemaTables = await Promise.all(schemaTablePromises);

      for (const schemaTables of allSchemaTables) {
        for (const table of schemaTables) {
          if (tables.length >= MAX_TABLES) break;
          tables.push(table);
        }
        if (tables.length >= MAX_TABLES) break;
      }

      // Yield to event loop after collecting tables
      await yieldToEventLoop();

      if (abortController.signal.aborted) {
        throw new Error("Autocomplete timed out");
      }

      // Fetch metadata in parallel with concurrency limit
      const tablesToFetch = tables.slice(0, MAX_TABLES_WITH_METADATA);
      for (let i = 0; i < tablesToFetch.length; i += CONCURRENCY_LIMIT) {
        if (abortController.signal.aborted) {
          throw new Error("Autocomplete timed out");
        }

        const batch = tablesToFetch.slice(i, i + CONCURRENCY_LIMIT);
        const metadataPromises = batch.map(async (table) => {
          try {
            const metadata = await adapter.getTableMetadata(table.schema, table.name);
            return { key: `${table.schema}.${table.name}`, metadata };
          } catch {
            return { key: `${table.schema}.${table.name}`, metadata: [] };
          }
        });
        const results = await Promise.all(metadataPromises);
        for (const { key, metadata } of results) {
          columns[key] = metadata;
        }

        // Yield to event loop between batches to keep UI responsive
        await yieldToEventLoop();
      }

      return { schemas, tables, columns };
    } finally {
      clearTimeout(timeoutId);
    }
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

    // Caps and limits
    const MAX_ROWS = 10000; // 10k row limit for imports
    const BATCH_SIZE = 50;
    const MAX_ERRORS = 100; // Stop collecting errors after this many

    // Helper to yield to event loop between batches
    const yieldToEventLoop = (): Promise<void> =>
      new Promise((resolve) => setImmediate(resolve));

    // Validate row count
    if (params.rows.length > MAX_ROWS) {
      throw new Error(
        `Import exceeds maximum row limit. Received ${params.rows.length} rows, maximum allowed is ${MAX_ROWS}. ` +
        `Please split your import into smaller batches.`
      );
    }

    let successCount = 0;
    const errors: string[] = [];
    const totalRows = params.rows.length;

    // Broadcast initial progress
    broadcastImportProgress({ current: 0, total: totalRows, percentage: 0 });

    // Process rows in batches with parallel inserts within each batch
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = params.rows.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (row, batchIndex) => {
        const rowIndex = i + batchIndex;
        try {
          await adapter.insertRow(params.schema, params.table, row);
          return { success: true, rowIndex };
        } catch (error) {
          return {
            success: false,
            rowIndex,
            error: `Row ${rowIndex + 1}: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });

      const results = await Promise.all(batchPromises);
      for (const result of results) {
        if (result.success) {
          successCount++;
        } else if (result.error && errors.length < MAX_ERRORS) {
          errors.push(result.error);
        }
      }

      // Broadcast progress after each batch
      const current = Math.min(i + BATCH_SIZE, totalRows);
      const percentage = Math.round((current / totalRows) * 100);
      broadcastImportProgress({ current, total: totalRows, percentage });

      // Yield to event loop between batches to keep UI responsive
      await yieldToEventLoop();
    }

    // Broadcast completion
    broadcastImportProgress({ current: totalRows, total: totalRows, percentage: 100 });

    return {
      insertedCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
      truncatedErrors: errors.length >= MAX_ERRORS,
    };
  });

  // ==================== Clipboard ====================

  ipcMain.handle("clipboard:write", async (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle("clipboard:read", async () => {
    return clipboard.readText();
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

  // ==================== Query History ====================

  ipcMain.handle("queryHistory:get", async (_event, connectionKey: string) => {
    return getQueryHistory(connectionKey);
  });

  ipcMain.handle("queryHistory:add", async (_event, connectionKey: string, entry: QueryHistoryEntry) => {
    addQueryHistoryEntry(connectionKey, entry);
  });

  ipcMain.handle("queryHistory:clear", async (_event, connectionKey: string) => {
    clearQueryHistory(connectionKey);
  });

  ipcMain.handle("queryHistory:delete", async (_event, connectionKey: string, entryId: string) => {
    deleteQueryHistoryEntry(connectionKey, entryId);
  });

  ipcMain.handle("queryHistory:toggleStar", async (_event, connectionKey: string, entryId: string, starred: boolean) => {
    toggleQueryHistoryStar(connectionKey, entryId, starred);
  });

  // ==================== Saved Queries ====================

  ipcMain.handle("savedQueries:get", async (_event, connectionKey: string) => {
    return getSavedQueries(connectionKey);
  });

  ipcMain.handle("savedQueries:add", async (_event, connectionKey: string, query: SavedQuery) => {
    addSavedQuery(connectionKey, query);
  });

  ipcMain.handle("savedQueries:update", async (_event, connectionKey: string, queryId: string, updates: Partial<SavedQuery>) => {
    updateSavedQuery(connectionKey, queryId, updates);
  });

  ipcMain.handle("savedQueries:delete", async (_event, connectionKey: string, queryId: string) => {
    deleteSavedQuery(connectionKey, queryId);
  });

  // ==================== Tabs Persistence ====================

  ipcMain.handle("tabs:load", async () => {
    return getTabsState();
  });

  ipcMain.handle("tabs:save", async (_event, state: TabsState) => {
    saveTabsState(state);
  });

  // ==================== Connection Order ====================

  ipcMain.handle("connections:getOrder", async () => {
    return getConnectionOrder();
  });

  ipcMain.handle("connections:saveOrder", async (_event, order: string[]) => {
    saveConnectionOrder(order);
  });
}
