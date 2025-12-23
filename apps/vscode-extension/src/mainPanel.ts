import * as vscode from "vscode";
import { PostgresClient, type QueryResultSet } from "./postgresClient";
import type { TableIdentifier } from "./schemaExplorer";
import { getWebviewHtml, getThemeKind, type ThemeKind } from "./webviewHost";
import type { SavedView, FilterCondition, ColumnMetadata, TableInfo, ConnectionConfig } from "@dbview/core";
import { format as formatSql } from "sql-formatter";

// Multi-panel support: one panel per connection
const panels: Map<string, vscode.WebviewPanel> = new Map();
const panelConfigs: Map<string, ConnectionConfig> = new Map();
const panelClients: Map<string, PostgresClient> = new Map();

// Helper to get connection key - must match schemaExplorer.ts implementation
function getConnectionKey(config: ConnectionConfig): string {
  return config.name || `${config.host}:${config.port}/${config.database}`;
}

export function updateWebviewTheme(): void {
  const theme = getThemeKind();
  // Update theme for all panels
  for (const panel of panels.values()) {
    panel.webview.postMessage({
      type: "THEME_CHANGE",
      theme
    });
  }
}

function isReadOnlyMode(config: ConnectionConfig): boolean {
  return config.readOnly === true;
}

export function getPanelForConnection(connectionName: string): vscode.WebviewPanel | undefined {
  return panels.get(connectionName);
}

export function getAllPanels(): vscode.WebviewPanel[] {
  return Array.from(panels.values());
}

export function closePanelForConnection(connectionName: string): void {
  const panel = panels.get(connectionName);
  if (panel) {
    panel.dispose(); // This will trigger disposal handler
  }
}

export async function getOrCreateMainPanel(
  context: vscode.ExtensionContext,
  client: PostgresClient,
  connectionConfig: ConnectionConfig
): Promise<vscode.WebviewPanel> {
  const key = getConnectionKey(connectionConfig);

  console.log(`[dbview-mainPanel] ========== getOrCreateMainPanel CALLED ==========`);
  console.log(`[dbview-mainPanel] Connection config:`, JSON.stringify({
    name: connectionConfig.name,
    database: connectionConfig.database,
    host: connectionConfig.host,
    port: connectionConfig.port
  }, null, 2));
  console.log(`[dbview-mainPanel] Generated connection key: "${key}"`);
  console.log(`[dbview-mainPanel] Current panels map size: ${panels.size}`);
  console.log(`[dbview-mainPanel] Current panel keys:`, Array.from(panels.keys()));

  // If panel exists for this connection, reveal and return it
  const existingPanel = panels.get(key);
  if (existingPanel) {
    console.log(`[dbview-mainPanel] ✓ REUSING existing panel for connection key: "${key}"`);
    vscode.window.showInformationMessage(`[DEBUG] Reusing panel: ${key}`);
    existingPanel.reveal(vscode.ViewColumn.Active);
    return existingPanel;
  }

  // Create new panel for this connection
  const connectionTitle = connectionConfig.name || connectionConfig.database;
  console.log(`[dbview-mainPanel] ✓ CREATING NEW panel for connection: ${connectionTitle} (key: "${key}")`);
  vscode.window.showInformationMessage(`[DEBUG] Creating NEW panel: ${connectionTitle}`);

  const panel = vscode.window.createWebviewPanel(
    "dbview.mainView",
    `DBView - ${connectionTitle}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true, // Keep state when panel is hidden
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media", "webview")],
      enableCommandUris: true
    }
  );

  // Store panel, config, and client in maps
  panels.set(key, panel);
  panelConfigs.set(key, connectionConfig);
  panelClients.set(key, client);

  console.log(`[dbview-mainPanel] ✓ Panel stored in map with key: "${key}"`);
  console.log(`[dbview-mainPanel] ✓ Panels map now has ${panels.size} panel(s)`);
  console.log(`[dbview-mainPanel] ✓ All panel keys:`, Array.from(panels.keys()));

  panel.onDidDispose(() => {
    console.log(`[dbview-mainPanel] Panel disposed for connection: ${connectionTitle} (key: "${key}")`);
    panels.delete(key);
    panelConfigs.delete(key);
    panelClients.delete(key);
    console.log(`[dbview-mainPanel] Panels map now has ${panels.size} panel(s)`);
  });

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  // Handle messages from the webview
  // Message handler is a closure that captures client and connectionConfig for this specific panel
  panel.webview.onDidReceiveMessage(async (message: any) => {
    try {
      const tabId = message.tabId;

      switch (message?.type) {
        case "LOAD_TABLE_ROWS": {
          const schema = message.schema;
          const table = message.table;
          const limit = typeof message.limit === "number" ? message.limit : 100;
          const offset = typeof message.offset === "number" ? message.offset : 0;
          const filters = message.filters as FilterCondition[] | undefined;
          const filterLogic = (message.filterLogic as 'AND' | 'OR') ?? 'AND';

          console.log(`[dbview] Loading table rows for tab ${tabId}: ${schema}.${table} (limit: ${limit}, offset: ${offset}, filters: ${filters?.length ?? 0})`);

          try {
            const result = await client.fetchTableRows(schema, table, { limit, offset, filters, filterLogic });
            panel.webview.postMessage({
              type: "LOAD_TABLE_ROWS",
              tabId,
              schema,
              table,
              columns: result.columns,
              rows: result.rows,
              limit,
              offset
            });
          } catch (error) {
            console.error(`[dbview] Error loading table rows:`, error);
            vscode.window.showErrorMessage(`Failed to load table rows: ${error instanceof Error ? error.message : String(error)}`);
          }
          break;
        }

        case "GET_ROW_COUNT": {
          console.log(`[dbview] Getting row count for tab ${tabId}: ${message.schema}.${message.table}`);
          try {
            const filters = message.filters as FilterCondition[] | undefined;
            const filterLogic = (message.filterLogic as 'AND' | 'OR') ?? 'AND';
            const totalRows = await client.getTableRowCount(message.schema, message.table, { filters, filterLogic });
            panel.webview.postMessage({
              type: "ROW_COUNT",
              tabId,
              totalRows
            });
          } catch (error) {
            console.error(`[dbview] Error getting row count:`, error);
            panel.webview.postMessage({
              type: "ROW_COUNT_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "GET_TABLE_METADATA": {
          console.log(`[dbview] Getting metadata for tab ${tabId}: ${message.schema}.${message.table}`);
          try {
            const metadata = await client.getTableMetadata(message.schema, message.table);
            panel.webview.postMessage({
              type: "TABLE_METADATA",
              tabId,
              columns: metadata
            });
          } catch (error) {
            console.error(`[dbview] Error getting table metadata:`, error);
            vscode.window.showErrorMessage(`Failed to get table metadata: ${error instanceof Error ? error.message : String(error)}`);
          }
          break;
        }

        case "GET_TABLE_INDEXES": {
          console.log(`[dbview] Getting indexes for ${message.schema}.${message.table}`);
          try {
            const indexes = await client.getIndexes(message.schema, message.table);
            panel.webview.postMessage({
              type: "TABLE_INDEXES",
              indexes
            });
          } catch (error) {
            console.error(`[dbview] Error getting table indexes:`, error);
            panel.webview.postMessage({
              type: "TABLE_INDEXES",
              indexes: []
            });
          }
          break;
        }

        case "GET_TABLE_STATISTICS": {
          console.log(`[dbview] Getting statistics for ${message.schema}.${message.table}`);
          try {
            const statistics = await client.getTableStatistics(message.schema, message.table);
            panel.webview.postMessage({
              type: "TABLE_STATISTICS",
              statistics
            });
          } catch (error) {
            console.error(`[dbview] Error getting table statistics:`, error);
            panel.webview.postMessage({
              type: "TABLE_STATISTICS",
              statistics: undefined
            });
          }
          break;
        }

        case "GET_ER_DIAGRAM": {
          console.log(`[dbview] Getting ER diagram for schemas:`, message.schemas);
          try {
            const diagramData = await client.getERDiagramData(message.schemas);
            panel.webview.postMessage({
              type: "ER_DIAGRAM_DATA",
              diagramData
            });
          } catch (error) {
            console.error(`[dbview] Error getting ER diagram:`, error);
            panel.webview.postMessage({
              type: "ER_DIAGRAM_ERROR",
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "UPDATE_CELL": {
          console.log(`[dbview] Updating cell for tab ${tabId}: ${message.schema}.${message.table}`);

          // Check for read-only mode
          if (isReadOnlyMode(connectionConfig)) {
            console.log(`[dbview] UPDATE blocked - connection is in read-only mode`);
            panel.webview.postMessage({
              type: "UPDATE_ERROR",
              tabId,
              error: "🔒 Connection is in read-only mode. Write operations are blocked.",
              rowIndex: message.rowIndex,
              column: message.column
            });
            break;
          }

          try {
            await client.updateCell(
              message.schema,
              message.table,
              message.primaryKey,
              message.column,
              message.value
            );
            panel.webview.postMessage({
              type: "UPDATE_SUCCESS",
              tabId,
              rowIndex: message.rowIndex
            });

            // Refresh the row to get the updated value
            // We'll need to implement this if needed
          } catch (error) {
            console.error(`[dbview] Error updating cell:`, error);
            panel.webview.postMessage({
              type: "UPDATE_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error),
              rowIndex: message.rowIndex,
              column: message.column
            });
          }
          break;
        }

        case "INSERT_ROW": {
          console.log(`[dbview] ========== INSERT ROW REQUEST ==========`);
          console.log(`[dbview] Tab ID: ${tabId}`);
          console.log(`[dbview] Schema: ${message.schema}`);
          console.log(`[dbview] Table: ${message.table}`);
          console.log(`[dbview] Values to insert:`, JSON.stringify(message.values, null, 2));
          console.log(`[dbview] Number of columns: ${Object.keys(message.values).length}`);

          // Check for read-only mode
          if (isReadOnlyMode(connectionConfig)) {
            console.log(`[dbview] INSERT blocked - connection is in read-only mode`);
            panel.webview.postMessage({
              type: "INSERT_ERROR",
              tabId,
              error: "🔒 Connection is in read-only mode. Write operations are blocked."
            });
            break;
          }

          try {
            console.log(`[dbview] Calling client.insertRow...`);
            const newRow = await client.insertRow(message.schema, message.table, message.values);
            console.log(`[dbview] ========== INSERT SUCCESSFUL ==========`);
            console.log(`[dbview] Inserted row:`, newRow);

            panel.webview.postMessage({
              type: "INSERT_SUCCESS",
              tabId,
              newRow
            });
            console.log(`[dbview] INSERT_SUCCESS message sent to webview`);
          } catch (error) {
            console.error(`[dbview] ========== INSERT FAILED ==========`);
            console.error(`[dbview] Error inserting row:`, error);
            console.error(`[dbview] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

            panel.webview.postMessage({
              type: "INSERT_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
            console.log(`[dbview] INSERT_ERROR message sent to webview`);
          }
          break;
        }

        case "DELETE_ROWS": {
          console.log(`[dbview] Deleting ${message.primaryKeys.length} row(s) for tab ${tabId}: ${message.schema}.${message.table}`);

          // Check for read-only mode
          if (isReadOnlyMode(connectionConfig)) {
            console.log(`[dbview] DELETE blocked - connection is in read-only mode`);
            panel.webview.postMessage({
              type: "DELETE_ERROR",
              tabId,
              error: "🔒 Connection is in read-only mode. Write operations are blocked."
            });
            break;
          }

          try {
            const deletedCount = await client.deleteRows(message.schema, message.table, message.primaryKeys);
            panel.webview.postMessage({
              type: "DELETE_SUCCESS",
              tabId,
              deletedCount
            });
          } catch (error) {
            console.error(`[dbview] Error deleting rows:`, error);
            panel.webview.postMessage({
              type: "DELETE_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "RUN_QUERY": {
          console.log(`[dbview] Running query for tab ${tabId}`);
          try {
            const result = await client.runQuery(message.sql);
            panel.webview.postMessage({
              type: "QUERY_RESULT",
              tabId,
              columns: result.columns,
              rows: result.rows
            });
          } catch (error) {
            console.error(`[dbview] Error running query:`, error);
            panel.webview.postMessage({
              type: "QUERY_ERROR",
              tabId,
              message: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        // Saved views operations
        case "SAVE_VIEW": {
          const { schema, table, view } = message;
          const key = `dbview.views.${schema}.${table}`;

          try {
            const existingViews = context.workspaceState.get<SavedView[]>(key, []);

            // Check if updating default view - unset other defaults
            if (view.isDefault) {
              existingViews.forEach(v => {
                if (v.id !== view.id) {
                  v.isDefault = false;
                }
              });
            }

            const updatedViews = [...existingViews, view];
            await context.workspaceState.update(key, updatedViews);

            panel.webview.postMessage({
              type: "VIEWS_UPDATED",
              tabId,
              views: updatedViews
            });
          } catch (error) {
            console.error(`[dbview] Error saving view:`, error);
            vscode.window.showErrorMessage(`Failed to save view: ${error instanceof Error ? error.message : String(error)}`);
          }
          break;
        }

        case "GET_VIEWS": {
          const { schema, table } = message;
          const key = `dbview.views.${schema}.${table}`;
          const views = context.workspaceState.get<SavedView[]>(key, []);
          panel.webview.postMessage({
            type: "VIEWS_LOADED",
            tabId,
            views
          });
          break;
        }

        case "DELETE_VIEW": {
          const { schema, table, viewId } = message;
          const key = `dbview.views.${schema}.${table}`;

          try {
            const existingViews = context.workspaceState.get<SavedView[]>(key, []);
            const updatedViews = existingViews.filter(v => v.id !== viewId);
            await context.workspaceState.update(key, updatedViews);

            panel.webview.postMessage({
              type: "VIEWS_UPDATED",
              tabId,
              views: updatedViews
            });
          } catch (error) {
            console.error(`[dbview] Error deleting view:`, error);
            vscode.window.showErrorMessage(`Failed to delete view: ${error instanceof Error ? error.message : String(error)}`);
          }
          break;
        }

        case "EXPORT_VIEW": {
          const { view } = message;
          const jsonString = JSON.stringify(view, null, 2);

          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${view.name}.view.json`),
            filters: {
              'DBView Files': ['view.json'],
              'JSON Files': ['json']
            }
          });

          if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonString, 'utf8'));
            vscode.window.showInformationMessage('View exported successfully');
          }
          break;
        }

        case "IMPORT_VIEW": {
          const { schema, table } = message;

          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
              'DBView Files': ['view.json'],
              'JSON Files': ['json']
            }
          });

          if (uris && uris.length > 0) {
            try {
              const content = await vscode.workspace.fs.readFile(uris[0]);
              const view = JSON.parse(content.toString()) as SavedView;

              // Update schema/table to match current table
              view.schema = schema;
              view.table = table;
              view.id = `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              view.createdAt = Date.now();
              view.updatedAt = Date.now();

              const key = `dbview.views.${schema}.${table}`;
              const existingViews = context.workspaceState.get<SavedView[]>(key, []);
              const updatedViews = [...existingViews, view];
              await context.workspaceState.update(key, updatedViews);

              panel.webview.postMessage({
                type: "VIEWS_UPDATED",
                tabId,
                views: updatedViews
              });

              vscode.window.showInformationMessage('View imported successfully');
            } catch (error) {
              console.error(`[dbview] Error importing view:`, error);
              vscode.window.showErrorMessage(`Failed to import view: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
          break;
        }

        case "GET_AUTOCOMPLETE_DATA": {
          console.log(`[dbview] Getting autocomplete data`);
          try {
            // Fetch all schemas
            const schemasResult = await client.runQuery(`
              SELECT schema_name
              FROM information_schema.schemata
              WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              ORDER BY schema_name
            `);
            const schemas = schemasResult.rows.map((row: any) => row.schema_name as string);

            // Fetch all tables with row counts
            const tablesResult = await client.runQuery(`
              SELECT
                schemaname as schema,
                tablename as name,
                n_live_tup as row_count
              FROM pg_stat_user_tables
              ORDER BY schemaname, tablename
            `);
            const tables: TableInfo[] = tablesResult.rows.map((row: any) => ({
              schema: row.schema,
              name: row.name,
              rowCount: row.row_count ? parseInt(row.row_count) : undefined
            }));

            // Fetch columns for all tables (this may be expensive for large DBs)
            const columns: Record<string, ColumnMetadata[]> = {};
            for (const table of tables) {
              const key = `${table.schema}.${table.name}`;
              try {
                columns[key] = await client.getTableMetadata(table.schema, table.name);
              } catch (error) {
                console.error(`[dbview] Error fetching metadata for ${key}:`, error);
                columns[key] = [];
              }
            }

            panel.webview.postMessage({
              type: "AUTOCOMPLETE_DATA",
              schemas,
              tables,
              columns
            });
          } catch (error) {
            console.error(`[dbview] Error getting autocomplete data:`, error);
          }
          break;
        }

        case "FORMAT_SQL": {
          console.log(`[dbview] Formatting SQL for tab ${tabId}`);
          try {
            const formatted = formatSql(message.sql, {
              language: 'postgresql',
              tabWidth: 2,
              keywordCase: 'upper',
              indentStyle: 'standard',
              linesBetweenQueries: 2,
            });

            panel.webview.postMessage({
              type: "SQL_FORMATTED",
              tabId,
              formattedSql: formatted
            });
          } catch (error) {
            console.error(`[dbview] Error formatting SQL:`, error);
            panel.webview.postMessage({
              type: "SQL_FORMATTED",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "EXPLAIN_QUERY": {
          console.log(`[dbview] Explaining query for tab ${tabId}`);
          try {
            // Wrap user query in EXPLAIN ANALYZE
            const explainSQL = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${message.sql}`;
            const result = await client.runQuery(explainSQL);

            // PostgreSQL returns EXPLAIN output in first row, first column
            const explainOutput = result.rows[0]['QUERY PLAN'];
            const plan = Array.isArray(explainOutput) ? explainOutput[0] : explainOutput;

            panel.webview.postMessage({
              type: "EXPLAIN_RESULT",
              tabId,
              plan
            });
          } catch (error) {
            console.error(`[dbview] Error explaining query:`, error);
            panel.webview.postMessage({
              type: "EXPLAIN_RESULT",
              tabId,
              plan: null,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "EXPORT_DATA": {
          console.log(`[dbview] Exporting data to ${message.extension} format`);
          try {
            const { schema, table, content, extension } = message;
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(`${schema}_${table}.${extension}`),
              filters: {
                [extension.toUpperCase()]: [extension]
              }
            });

            if (uri) {
              await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
              console.log(`[dbview] Export successful: ${uri.fsPath}`);
              vscode.window.showInformationMessage(`Data exported to ${uri.fsPath}`);
              panel.webview.postMessage({
                type: "EXPORT_DATA_SUCCESS",
                tabId,
                filePath: uri.fsPath
              });
            } else {
              console.log(`[dbview] Export cancelled by user`);
              panel.webview.postMessage({
                type: "EXPORT_DATA_CANCELLED",
                tabId
              });
            }
          } catch (error) {
            console.error(`[dbview] Error exporting data:`, error);
            panel.webview.postMessage({
              type: "EXPORT_DATA_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "IMPORT_DATA": {
          console.log(`[dbview] Importing data to ${message.schema}.${message.table}`);

          // Check for read-only mode
          if (isReadOnlyMode(connectionConfig)) {
            console.log(`[dbview] IMPORT blocked - connection is in read-only mode`);
            panel.webview.postMessage({
              type: "IMPORT_DATA_ERROR",
              tabId,
              error: "🔒 Connection is in read-only mode. Write operations are blocked."
            });
            break;
          }

          try {
            const { schema, table, rows } = message;
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
              panel.webview.postMessage({
                type: "IMPORT_DATA_SUCCESS",
                tabId,
                insertedCount: successCount,
                errors: errors.length > 0 ? errors : undefined
              });
              vscode.window.showInformationMessage(`Imported ${successCount} row(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`);
            } else {
              panel.webview.postMessage({
                type: "IMPORT_DATA_ERROR",
                tabId,
                error: "No rows were imported",
                errors
              });
            }
          } catch (error) {
            console.error(`[dbview] Error importing data:`, error);
            panel.webview.postMessage({
              type: "IMPORT_DATA_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "COPY_TO_CLIPBOARD": {
          console.log(`[dbview] Copying to clipboard`);
          try {
            await vscode.env.clipboard.writeText(message.content);
            vscode.window.showInformationMessage('Copied to clipboard');
            panel.webview.postMessage({
              type: "COPY_TO_CLIPBOARD_SUCCESS",
              tabId
            });
          } catch (error) {
            console.error(`[dbview] Error copying to clipboard:`, error);
            panel.webview.postMessage({
              type: "COPY_TO_CLIPBOARD_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        default:
          console.log(`[dbview] Unknown message type:`, message?.type);
          break;
      }
    } catch (error) {
      console.error(`[dbview] Error handling message:`, error);
      vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return panel;
}

export async function openTableInPanel(
  context: vscode.ExtensionContext,
  client: PostgresClient,
  connectionConfig: ConnectionConfig,
  target: TableIdentifier
): Promise<void> {
  const panel = await getOrCreateMainPanel(context, client, connectionConfig);
  const connectionName = connectionConfig.name || connectionConfig.database;

  // Send message to open the table in a new tab
  panel.webview.postMessage({
    type: "OPEN_TABLE",
    schema: target.schema,
    table: target.table,
    limit: 100,
    connectionName
  });
}

export async function openQueryInPanel(
  context: vscode.ExtensionContext,
  client: PostgresClient,
  connectionConfig: ConnectionConfig
): Promise<void> {
  const panel = await getOrCreateMainPanel(context, client, connectionConfig);
  const connectionName = connectionConfig.name || connectionConfig.database;

  // Send message to open a new query tab
  panel.webview.postMessage({
    type: "OPEN_QUERY_TAB",
    connectionName
  });
}

export async function openERDiagramInPanel(
  context: vscode.ExtensionContext,
  client: PostgresClient,
  connectionConfig: ConnectionConfig,
  schemas?: string[]
): Promise<void> {
  const panel = await getOrCreateMainPanel(context, client, connectionConfig);

  // If no schemas provided, get all available schemas
  let schemasToVisualize = schemas;
  if (!schemasToVisualize) {
    try {
      const result = await client.runQuery(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);
      schemasToVisualize = result.rows.map((row: any) => row.schema_name);
    } catch (error) {
      console.error('[dbview] Error fetching schemas:', error);
      schemasToVisualize = ['public']; // Fallback to public schema
    }
  }

  // Send message to open ER diagram
  panel.webview.postMessage({
    type: "OPEN_ER_DIAGRAM",
    schemas: schemasToVisualize
  });
}
