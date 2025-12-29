import * as vscode from "vscode";
import type { DatabaseAdapter, QueryResultSet } from "@dbview/adapters";
import type { TableIdentifier } from "./schemaExplorer";
import { getWebviewHtml, getThemeKind, type ThemeKind } from "./webviewHost";
import type { SavedView, FilterCondition, ColumnMetadata, TableInfo, DatabaseConnectionConfig } from "@dbview/types";
import { format as formatSql } from "sql-formatter";

// Local type definitions for API types (mirrors shared-ui/api/types.ts)
interface FilterPreset {
  id: string;
  name: string;
  filters: Array<{
    id: string;
    columnName: string;
    operator: string;
    value: unknown;
  }>;
  logic: "AND" | "OR";
  createdAt: number;
}

interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: number;
  duration?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
  starred?: boolean;
}

interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// Get autocomplete performance limits from VS Code settings
function getAutocompleteLimits() {
  const config = vscode.workspace.getConfiguration('dbview.autocomplete');
  return {
    MAX_TABLES_PER_SCHEMA: config.get<number>('maxTablesPerSchema', 200),
    MAX_TOTAL_TABLES: config.get<number>('maxTotalTables', 500),
    MAX_TABLES_WITH_METADATA: config.get<number>('maxTablesWithMetadata', 100)
  };
}

// Multi-panel support: one panel per connection
const panels: Map<string, vscode.WebviewPanel> = new Map();
const panelConfigs: Map<string, DatabaseConnectionConfig> = new Map();
const panelClients: Map<string, DatabaseAdapter> = new Map();
const panelReadyState: Map<string, boolean> = new Map();
const panelMessageQueues: Map<string, any[]> = new Map();

// Helper to get connection key - MUST match schemaExplorer.ts implementation exactly
function getConnectionKey(config: DatabaseConnectionConfig): string {
  const dbType = config.dbType || 'postgres';

  if (config.name) {
    return `${dbType}:${config.name}`;
  }

  switch (dbType) {
    case 'sqlite':
      return `${dbType}:${(config as any).filePath}`;
    case 'mongodb':
      if ((config as any).connectionString) {
        return `${dbType}:${(config as any).connectionString}`;
      }
      return `${dbType}:${(config as any).user || 'anonymous'}@${(config as any).host || 'localhost'}:${(config as any).port || 27017}/${(config as any).database}`;
    case 'redis':
      return `${dbType}:${(config as any).host || 'localhost'}:${(config as any).port || 6379}/${(config as any).database || 0}`;
    case 'elasticsearch':
      if ((config as any).cloudId) {
        return `${dbType}:cloud:${(config as any).cloudId}`;
      }
      return `${dbType}:${(config as any).nodes?.[0] || (config as any).host || 'localhost'}`;
    case 'cassandra':
      return `${dbType}:${((config as any).contactPoints || []).join(',')}:${(config as any).port || 9042}/${(config as any).keyspace}`;
    case 'postgres':
    case 'mysql':
    case 'mariadb':
    case 'sqlserver':
      return `${dbType}:${(config as any).user}@${(config as any).host}:${(config as any).port}/${(config as any).database}`;
    default:
      return `${dbType}:${JSON.stringify(config)}`;
  }
}

// Helper to send response with requestId pattern
function sendResponse(panel: vscode.WebviewPanel, requestId: number | undefined, data: unknown, error?: string): void {
  if (requestId !== undefined) {
    // New pattern: respond with requestId
    panel.webview.postMessage({
      requestId,
      data: error ? undefined : data,
      error
    });
  }
}

// Helper to send messages to webview (queues if not ready)
function sendMessageToPanel(connectionKey: string, message: any): void {
  const panel = panels.get(connectionKey);
  if (!panel) {
    console.warn(`[dbview-mainPanel] Cannot send message - panel not found for key: ${connectionKey}`);
    return;
  }

  const isReady = panelReadyState.get(connectionKey);
  if (isReady) {
    console.log(`[dbview-mainPanel] Sending message immediately: ${message.type}`);
    panel.webview.postMessage(message);
  } else {
    console.log(`[dbview-mainPanel] Queuing message (webview not ready): ${message.type}`);
    const queue = panelMessageQueues.get(connectionKey) || [];
    queue.push(message);
    panelMessageQueues.set(connectionKey, queue);
  }
}

export function updateWebviewTheme(): void {
  const theme = getThemeKind();
  for (const panel of panels.values()) {
    panel.webview.postMessage({
      type: "THEME_CHANGE",
      theme
    });
  }
}

function isReadOnlyMode(config: DatabaseConnectionConfig): boolean {
  return config.readOnly === true;
}

export function getPanelForConnection(config: DatabaseConnectionConfig): vscode.WebviewPanel | undefined {
  const key = getConnectionKey(config);
  return panels.get(key);
}

export function getAllPanels(): vscode.WebviewPanel[] {
  return Array.from(panels.values());
}

export function closePanelForConnection(config: DatabaseConnectionConfig): void {
  const key = getConnectionKey(config);
  const panel = panels.get(key);
  if (panel) {
    panel.dispose();
  }
}

export async function getOrCreateMainPanel(
  context: vscode.ExtensionContext,
  client: DatabaseAdapter,
  connectionConfig: DatabaseConnectionConfig
): Promise<vscode.WebviewPanel> {
  const key = getConnectionKey(connectionConfig);

  const connInfo: any = { name: connectionConfig.name, dbType: connectionConfig.dbType };
  if ('database' in connectionConfig) connInfo.database = connectionConfig.database;
  if ('host' in connectionConfig) connInfo.host = connectionConfig.host;
  if ('port' in connectionConfig) connInfo.port = connectionConfig.port;

  console.log(`[dbview-mainPanel] getOrCreateMainPanel for key: "${key}"`);

  const existingPanel = panels.get(key);
  if (existingPanel) {
    console.log(`[dbview-mainPanel] Reusing existing panel for: "${key}"`);
    existingPanel.reveal(vscode.ViewColumn.Active);
    return existingPanel;
  }

  const connectionTitle = connectionConfig.name || ('database' in connectionConfig ? connectionConfig.database : connectionConfig.dbType);
  console.log(`[dbview-mainPanel] Creating new panel for: ${connectionTitle}`);

  const panel = vscode.window.createWebviewPanel(
    "dbview.mainView",
    `DBView - ${connectionTitle}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media", "webview")],
      enableCommandUris: true
    }
  );

  panels.set(key, panel);
  panelConfigs.set(key, connectionConfig);
  panelClients.set(key, client);
  panelReadyState.set(key, false);
  panelMessageQueues.set(key, []);

  panel.onDidDispose(() => {
    console.log(`[dbview-mainPanel] Panel disposed for: "${key}"`);
    panels.delete(key);
    panelConfigs.delete(key);
    panelClients.delete(key);
    panelReadyState.delete(key);
    panelMessageQueues.delete(key);
  });

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(async (message: any) => {
    try {
      const requestId = message.requestId;
      const tabId = message.tabId;

      switch (message?.type) {
        case "WEBVIEW_READY": {
          console.log(`[dbview-mainPanel] Webview ready for: ${key}`);
          panelReadyState.set(key, true);

          const queue = panelMessageQueues.get(key) || [];
          console.log(`[dbview-mainPanel] Flushing ${queue.length} queued message(s)`);
          for (const queuedMsg of queue) {
            panel.webview.postMessage(queuedMsg);
          }
          panelMessageQueues.set(key, []);
          break;
        }

        // ============================================
        // Table Data Operations (with requestId support)
        // ============================================

        case "LOAD_TABLE_ROWS": {
          const { schema, table, limit = 100, offset = 0, filters, filterLogic = 'AND' } = message;
          console.log(`[dbview] Loading rows: ${schema}.${table} (limit: ${limit}, offset: ${offset})`);

          try {
            const result = await client.fetchTableRows(schema, table, { limit, offset, filters, filterLogic });
            sendResponse(panel, requestId, {
              columns: result.columns,
              rows: result.rows,
              limit,
              offset
            });
          } catch (error) {
            console.error(`[dbview] Error loading table rows:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "GET_ROW_COUNT": {
          const { schema, table, filters, filterLogic = 'AND' } = message;
          console.log(`[dbview] Getting row count: ${schema}.${table}`);

          try {
            const totalRows = await client.getTableRowCount(schema, table, { filters, filterLogic });
            sendResponse(panel, requestId, totalRows);
          } catch (error) {
            console.error(`[dbview] Error getting row count:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "GET_TABLE_METADATA": {
          const { schema, table } = message;
          console.log(`[dbview] Getting metadata: ${schema}.${table}`);

          try {
            const metadata = await client.getTableMetadata(schema, table);
            sendResponse(panel, requestId, metadata);
          } catch (error) {
            console.error(`[dbview] Error getting metadata:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "GET_TABLE_INDEXES": {
          const { schema, table } = message;
          console.log(`[dbview] Getting indexes: ${schema}.${table}`);

          try {
            const indexes = client.getIndexes ? await client.getIndexes(schema, table) : [];
            sendResponse(panel, requestId, indexes);
          } catch (error) {
            console.error(`[dbview] Error getting indexes:`, error);
            sendResponse(panel, requestId, []);
          }
          break;
        }

        case "GET_TABLE_STATISTICS": {
          const { schema, table } = message;
          console.log(`[dbview] Getting statistics: ${schema}.${table}`);

          try {
            const statistics = await client.getTableStatistics(schema, table);
            sendResponse(panel, requestId, statistics);
          } catch (error) {
            console.error(`[dbview] Error getting statistics:`, error);
            sendResponse(panel, requestId, undefined);
          }
          break;
        }

        // ============================================
        // Schema Operations
        // ============================================

        case "LIST_SCHEMAS": {
          console.log(`[dbview] Listing schemas`);
          try {
            const schemas = await client.listSchemas();
            sendResponse(panel, requestId, schemas);
          } catch (error) {
            console.error(`[dbview] Error listing schemas:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "LIST_TABLES": {
          const { schema } = message;
          console.log(`[dbview] Listing tables for schema: ${schema}`);
          try {
            const tables = await client.listTables(schema);
            sendResponse(panel, requestId, tables);
          } catch (error) {
            console.error(`[dbview] Error listing tables:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "LIST_COLUMNS": {
          const { schema, table } = message;
          console.log(`[dbview] Listing columns for: ${schema}.${table}`);
          try {
            const columns = await client.getTableMetadata(schema, table);
            sendResponse(panel, requestId, columns);
          } catch (error) {
            console.error(`[dbview] Error listing columns:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Write Operations
        // ============================================

        case "UPDATE_CELL": {
          const { schema, table, primaryKey, column, value, rowIndex } = message;
          console.log(`[dbview] Updating cell: ${schema}.${table}.${column}`);

          if (isReadOnlyMode(connectionConfig)) {
            sendResponse(panel, requestId, undefined, "🔒 Connection is in read-only mode. Write operations are blocked.");
            break;
          }

          try {
            await client.updateCell(schema, table, primaryKey, column, value);
            sendResponse(panel, requestId, { success: true, rowIndex });
          } catch (error) {
            console.error(`[dbview] Error updating cell:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "INSERT_ROW": {
          const { schema, table, values } = message;
          console.log(`[dbview] Inserting row: ${schema}.${table}`);

          if (isReadOnlyMode(connectionConfig)) {
            sendResponse(panel, requestId, undefined, "🔒 Connection is in read-only mode. Write operations are blocked.");
            break;
          }

          try {
            const newRow = await client.insertRow(schema, table, values);
            sendResponse(panel, requestId, newRow);
          } catch (error) {
            console.error(`[dbview] Error inserting row:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "DELETE_ROWS": {
          const { schema, table, primaryKeys } = message;
          console.log(`[dbview] Deleting ${primaryKeys.length} row(s): ${schema}.${table}`);

          if (isReadOnlyMode(connectionConfig)) {
            sendResponse(panel, requestId, undefined, "🔒 Connection is in read-only mode. Write operations are blocked.");
            break;
          }

          try {
            const deletedCount = await client.deleteRows(schema, table, primaryKeys);
            sendResponse(panel, requestId, { deletedCount });
          } catch (error) {
            console.error(`[dbview] Error deleting rows:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Query Operations
        // ============================================

        case "RUN_QUERY": {
          const { sql } = message;
          console.log(`[dbview] Running query`);

          try {
            const result = await client.runQuery(sql);
            sendResponse(panel, requestId, {
              columns: result.columns,
              rows: result.rows
            });
          } catch (error) {
            console.error(`[dbview] Error running query:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "FORMAT_SQL": {
          const { sql } = message;
          console.log(`[dbview] Formatting SQL`);

          try {
            const sqlDialect = client.type === 'mysql' ? 'mysql' : 'postgresql';
            const formatted = formatSql(sql, {
              language: sqlDialect,
              tabWidth: 2,
              keywordCase: 'upper',
              indentStyle: 'standard',
              linesBetweenQueries: 2,
            });
            sendResponse(panel, requestId, formatted);
          } catch (error) {
            console.error(`[dbview] Error formatting SQL:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "EXPLAIN_QUERY": {
          const { sql } = message;
          console.log(`[dbview] Explaining query`);

          try {
            let explainSQL: string;
            if (client.type === 'mysql') {
              explainSQL = `EXPLAIN FORMAT=JSON ${sql}`;
            } else {
              explainSQL = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
            }

            const result = await client.runQuery(explainSQL);

            let plan;
            if (client.type === 'mysql') {
              const explainOutput = result.rows[0]['EXPLAIN'];
              plan = typeof explainOutput === 'string' ? JSON.parse(explainOutput) : explainOutput;
            } else {
              const explainOutput = result.rows[0]['QUERY PLAN'];
              plan = Array.isArray(explainOutput) ? explainOutput[0] : explainOutput;
            }

            sendResponse(panel, requestId, plan);
          } catch (error) {
            console.error(`[dbview] Error explaining query:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // ER Diagram
        // ============================================

        case "GET_ER_DIAGRAM": {
          const { schemas } = message;
          console.log(`[dbview] Getting ER diagram for schemas:`, schemas);

          try {
            if (client.getERDiagramData) {
              const diagramData = await client.getERDiagramData(schemas);
              sendResponse(panel, requestId, diagramData);
            } else {
              sendResponse(panel, requestId, { tables: [], relationships: [] });
            }
          } catch (error) {
            console.error(`[dbview] Error getting ER diagram:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Autocomplete
        // ============================================

        case "GET_AUTOCOMPLETE_DATA": {
          console.log(`[dbview] Getting autocomplete data`);
          const startTime = Date.now();

          try {
            const limits = getAutocompleteLimits();
            const schemas = await client.listSchemas();

            const allTables: TableInfo[] = [];
            for (const schema of schemas) {
              if (allTables.length >= limits.MAX_TOTAL_TABLES) break;

              try {
                const schemaTables = await client.listTables(schema);
                const limitedTables = schemaTables.slice(0, limits.MAX_TABLES_PER_SCHEMA);
                allTables.push(...limitedTables.map(t => ({ ...t, schema })));
              } catch (error) {
                console.error(`[dbview] Error fetching tables for ${schema}:`, error);
              }
            }

            const columns: Record<string, ColumnMetadata[]> = {};
            const tablesToFetch = allTables.slice(0, limits.MAX_TABLES_WITH_METADATA);

            for (const table of tablesToFetch) {
              const key = `${table.schema}.${table.name}`;
              try {
                columns[key] = await client.getTableMetadata(table.schema, table.name);
              } catch (error) {
                columns[key] = [];
              }
            }

            console.log(`[dbview] Autocomplete ready in ${Date.now() - startTime}ms`);
            sendResponse(panel, requestId, { schemas, tables: allTables, columns });
          } catch (error) {
            console.error(`[dbview] Error getting autocomplete data:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Export/Import
        // ============================================

        case "EXPORT_DATA": {
          const { schema, table, content, extension } = message;
          console.log(`[dbview] Exporting data to ${extension}`);

          try {
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(`${schema}_${table}.${extension}`),
              filters: { [extension.toUpperCase()]: [extension] }
            });

            if (uri) {
              await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
              vscode.window.showInformationMessage(`Data exported to ${uri.fsPath}`);
              sendResponse(panel, requestId, { filePath: uri.fsPath });
            } else {
              sendResponse(panel, requestId, { cancelled: true });
            }
          } catch (error) {
            console.error(`[dbview] Error exporting data:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "IMPORT_DATA": {
          const { schema, table, rows } = message;
          console.log(`[dbview] Importing ${rows.length} rows to ${schema}.${table}`);

          if (isReadOnlyMode(connectionConfig)) {
            sendResponse(panel, requestId, undefined, "🔒 Connection is in read-only mode. Write operations are blocked.");
            break;
          }

          try {
            let successCount = 0;
            const errors: string[] = [];

            for (let i = 0; i < rows.length; i++) {
              try {
                await client.insertRow(schema, table, rows[i]);
                successCount++;
              } catch (error) {
                errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }

            if (successCount > 0) {
              vscode.window.showInformationMessage(`Imported ${successCount} row(s)`);
            }
            sendResponse(panel, requestId, { insertedCount: successCount, errors: errors.length > 0 ? errors : undefined });
          } catch (error) {
            console.error(`[dbview] Error importing data:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Clipboard
        // ============================================

        case "COPY_TO_CLIPBOARD": {
          const { text } = message;
          console.log(`[dbview] Copying to clipboard`);

          try {
            await vscode.env.clipboard.writeText(text);
            sendResponse(panel, requestId, { success: true });
          } catch (error) {
            console.error(`[dbview] Error copying to clipboard:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Saved Views
        // ============================================

        case "GET_VIEWS": {
          const { schema, table } = message;
          const key = `dbview.views.${schema}.${table}`;
          const views = context.workspaceState.get<SavedView[]>(key, []);
          sendResponse(panel, requestId, views);
          break;
        }

        case "SAVE_VIEW": {
          const { schema, table, view } = message;
          const key = `dbview.views.${schema}.${table}`;

          try {
            const existingViews = context.workspaceState.get<SavedView[]>(key, []);
            if (view.isDefault) {
              existingViews.forEach(v => { if (v.id !== view.id) v.isDefault = false; });
            }
            const updatedViews = [...existingViews, view];
            await context.workspaceState.update(key, updatedViews);
            sendResponse(panel, requestId, updatedViews);
          } catch (error) {
            console.error(`[dbview] Error saving view:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "DELETE_VIEW": {
          const { schema, table, viewId } = message;
          const key = `dbview.views.${schema}.${table}`;

          try {
            const existingViews = context.workspaceState.get<SavedView[]>(key, []);
            const updatedViews = existingViews.filter(v => v.id !== viewId);
            await context.workspaceState.update(key, updatedViews);
            sendResponse(panel, requestId, updatedViews);
          } catch (error) {
            console.error(`[dbview] Error deleting view:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Filter Presets
        // ============================================

        case "GET_FILTER_PRESETS": {
          const { schema, table } = message;
          const key = `dbview.filterPresets.${schema}.${table}`;
          const presets = context.workspaceState.get<FilterPreset[]>(key, []);
          sendResponse(panel, requestId, presets);
          break;
        }

        case "SAVE_FILTER_PRESET": {
          const { schema, table, preset } = message;
          const key = `dbview.filterPresets.${schema}.${table}`;

          try {
            const existingPresets = context.workspaceState.get<FilterPreset[]>(key, []);
            const existingIndex = existingPresets.findIndex(p => p.id === preset.id);
            let updatedPresets: FilterPreset[];
            if (existingIndex >= 0) {
              updatedPresets = [...existingPresets];
              updatedPresets[existingIndex] = preset;
            } else {
              updatedPresets = [...existingPresets, preset];
            }
            await context.workspaceState.update(key, updatedPresets);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error saving filter preset:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "DELETE_FILTER_PRESET": {
          const { schema, table, presetId } = message;
          const key = `dbview.filterPresets.${schema}.${table}`;

          try {
            const existingPresets = context.workspaceState.get<FilterPreset[]>(key, []);
            const updatedPresets = existingPresets.filter(p => p.id !== presetId);
            await context.workspaceState.update(key, updatedPresets);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error deleting filter preset:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Query History
        // ============================================

        case "GET_QUERY_HISTORY": {
          const { connectionKey: connKey } = message;
          const historyKey = `dbview.queryHistory.${connKey || key}`;
          const history = context.globalState.get<QueryHistoryEntry[]>(historyKey, []);
          sendResponse(panel, requestId, history);
          break;
        }

        case "ADD_QUERY_HISTORY": {
          const { connectionKey: connKey, entry } = message;
          const historyKey = `dbview.queryHistory.${connKey || key}`;

          try {
            const existingHistory = context.globalState.get<QueryHistoryEntry[]>(historyKey, []);
            const updatedHistory = [entry, ...existingHistory].slice(0, 100);
            await context.globalState.update(historyKey, updatedHistory);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error adding query history:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "CLEAR_QUERY_HISTORY": {
          const { connectionKey: connKey } = message;
          const historyKey = `dbview.queryHistory.${connKey || key}`;

          try {
            await context.globalState.update(historyKey, []);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error clearing query history:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "DELETE_QUERY_HISTORY_ENTRY": {
          const { connectionKey: connKey, entryId } = message;
          const historyKey = `dbview.queryHistory.${connKey || key}`;

          try {
            const existingHistory = context.globalState.get<QueryHistoryEntry[]>(historyKey, []);
            const updatedHistory = existingHistory.filter(e => e.id !== entryId);
            await context.globalState.update(historyKey, updatedHistory);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error deleting query history entry:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "TOGGLE_QUERY_STAR": {
          const { connectionKey: connKey, entryId, starred } = message;
          const historyKey = `dbview.queryHistory.${connKey || key}`;

          try {
            const existingHistory = context.globalState.get<QueryHistoryEntry[]>(historyKey, []);
            const updatedHistory = existingHistory.map(e =>
              e.id === entryId ? { ...e, starred } : e
            );
            await context.globalState.update(historyKey, updatedHistory);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error toggling query star:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Saved Queries
        // ============================================

        case "GET_SAVED_QUERIES": {
          const { connectionKey: connKey } = message;
          const queriesKey = `dbview.savedQueries.${connKey || key}`;
          const queries = context.globalState.get<SavedQuery[]>(queriesKey, []);
          sendResponse(panel, requestId, queries);
          break;
        }

        case "ADD_SAVED_QUERY": {
          const { connectionKey: connKey, query } = message;
          const queriesKey = `dbview.savedQueries.${connKey || key}`;

          try {
            const existingQueries = context.globalState.get<SavedQuery[]>(queriesKey, []);
            const updatedQueries = [...existingQueries, query];
            await context.globalState.update(queriesKey, updatedQueries);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error adding saved query:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "UPDATE_SAVED_QUERY": {
          const { connectionKey: connKey, queryId, updates } = message;
          const queriesKey = `dbview.savedQueries.${connKey || key}`;

          try {
            const existingQueries = context.globalState.get<SavedQuery[]>(queriesKey, []);
            const updatedQueries = existingQueries.map(q =>
              q.id === queryId ? { ...q, ...updates, updatedAt: Date.now() } : q
            );
            await context.globalState.update(queriesKey, updatedQueries);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error updating saved query:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        case "DELETE_SAVED_QUERY": {
          const { connectionKey: connKey, queryId } = message;
          const queriesKey = `dbview.savedQueries.${connKey || key}`;

          try {
            const existingQueries = context.globalState.get<SavedQuery[]>(queriesKey, []);
            const updatedQueries = existingQueries.filter(q => q.id !== queryId);
            await context.globalState.update(queriesKey, updatedQueries);
            sendResponse(panel, requestId, undefined);
          } catch (error) {
            console.error(`[dbview] Error deleting saved query:`, error);
            sendResponse(panel, requestId, undefined, error instanceof Error ? error.message : String(error));
          }
          break;
        }

        // ============================================
        // Theme
        // ============================================

        case "GET_THEME": {
          const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ||
                        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrastLight
                        ? "light" : "dark";
          sendResponse(panel, requestId, theme);
          break;
        }

        default:
          console.log(`[dbview] Unknown message type:`, message?.type);
          break;
      }
    } catch (error) {
      console.error(`[dbview] Error handling message:`, error);
      if (message?.requestId !== undefined) {
        sendResponse(panel, message.requestId, undefined, error instanceof Error ? error.message : String(error));
      }
    }
  });

  return panel;
}

export async function openTableInPanel(
  context: vscode.ExtensionContext,
  client: DatabaseAdapter,
  connectionConfig: DatabaseConnectionConfig,
  target: TableIdentifier
): Promise<void> {
  await getOrCreateMainPanel(context, client, connectionConfig);
  const connectionName = connectionConfig.name || ('database' in connectionConfig ? connectionConfig.database : 'unknown');
  const key = getConnectionKey(connectionConfig);

  sendMessageToPanel(key, {
    type: "OPEN_TABLE",
    schema: target.schema,
    table: target.table,
    connectionKey: key,
    connectionName
  });
}

export async function openQueryInPanel(
  context: vscode.ExtensionContext,
  client: DatabaseAdapter,
  connectionConfig: DatabaseConnectionConfig
): Promise<void> {
  await getOrCreateMainPanel(context, client, connectionConfig);
  const connectionName = connectionConfig.name || ('database' in connectionConfig ? connectionConfig.database : 'unknown');
  const key = getConnectionKey(connectionConfig);

  sendMessageToPanel(key, {
    type: "OPEN_QUERY_TAB",
    connectionKey: key,
    connectionName
  });
}

export async function openERDiagramInPanel(
  context: vscode.ExtensionContext,
  client: DatabaseAdapter,
  connectionConfig: DatabaseConnectionConfig,
  schemas?: string[]
): Promise<void> {
  await getOrCreateMainPanel(context, client, connectionConfig);
  const key = getConnectionKey(connectionConfig);

  let schemasToVisualize = schemas;
  if (!schemasToVisualize) {
    try {
      schemasToVisualize = await client.listSchemas();
    } catch (error) {
      console.error('[dbview] Error fetching schemas:', error);
      const dbType = connectionConfig.dbType || 'postgres';
      switch (dbType) {
        case 'postgres':
          schemasToVisualize = ['public'];
          break;
        case 'mysql':
        case 'sqlserver':
        case 'mongodb':
          schemasToVisualize = ['database' in connectionConfig && connectionConfig.database !== undefined ? String(connectionConfig.database) : 'default'];
          break;
        case 'sqlite':
          schemasToVisualize = ['main'];
          break;
        default:
          schemasToVisualize = ['default'];
      }
    }
  }

  sendMessageToPanel(key, {
    type: "OPEN_ER_DIAGRAM",
    connectionKey: key,
    schemas: schemasToVisualize
  });
}
