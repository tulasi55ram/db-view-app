import * as vscode from "vscode";
import type { DatabaseAdapter, QueryResultSet } from "@dbview/adapters";
import type { TableIdentifier } from "./schemaExplorer";
import { getWebviewHtml, getThemeKind, type ThemeKind } from "./webviewHost";
import type { SavedView, FilterCondition, ColumnMetadata, TableInfo, DatabaseConnectionConfig } from "@dbview/types";
import { format as formatSql } from "sql-formatter";

// Get autocomplete performance limits from VS Code settings
// Users can adjust these in Settings > Extensions > DBView if they have large databases
// TODO: Implement lazy loading - fetch column metadata on-demand when user types specific table names
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

// Query tracking for cancellation
interface RunningQuery {
  queryId: string;
  startTime: number;
  sql: string;
}
const runningQueries = new Map<string, RunningQuery>();

// Helper to get connection key - MUST match schemaExplorer.ts implementation exactly
function getConnectionKey(config: DatabaseConnectionConfig): string {
  const dbType = config.dbType || 'postgres';

  // Use name if available, with dbType prefix
  if (config.name) {
    return `${dbType}:${config.name}`;
  }

  // Generate key based on database type
  switch (dbType) {
    case 'sqlite':
      return `${dbType}:${(config as any).filePath}`;
    case 'mongodb':
      if ((config as any).connectionString) {
        return `${dbType}:${(config as any).connectionString}`;
      }
      return `${dbType}:${(config as any).user || 'anonymous'}@${(config as any).host || 'localhost'}:${(config as any).port || 27017}/${(config as any).database}`;
    case 'postgres':
    case 'mysql':
    case 'sqlserver':
      // All have host:port/database structure
      return `${dbType}:${(config as any).user}@${(config as any).host}:${(config as any).port}/${(config as any).database}`;
    default:
      // Future database types - use JSON as fallback
      return `${dbType}:${JSON.stringify(config)}`;
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
  // Update theme for all panels
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

/**
 * Ensure the client is connected before database operations.
 * For MongoDB and other databases that may lose connection, this attempts to reconnect.
 * @param client The database adapter to check
 * @returns true if connected (or reconnected successfully), false otherwise
 */
async function ensureClientConnected(client: DatabaseAdapter): Promise<boolean> {
  let needsReconnect = false;

  // If already connected, verify with ping
  if (client.status === 'connected') {
    try {
      const isAlive = await client.ping();
      if (isAlive) {
        return true;
      }
      console.log('[dbview-mainPanel] Client ping failed, will attempt reconnect...');
      needsReconnect = true;
    } catch (error) {
      console.log('[dbview-mainPanel] Client ping threw error, will attempt reconnect...', error);
      needsReconnect = true;
    }
  }

  // Attempt to reconnect if needed or if status indicates disconnected/error
  if (needsReconnect || client.status === 'disconnected' || client.status === 'error') {
    console.log(`[dbview-mainPanel] Client status is ${client.status}, attempting to connect...`);
    try {
      await client.connect();
      const isAlive = await client.ping();
      if (isAlive) {
        console.log('[dbview-mainPanel] Client reconnected successfully');
        return true;
      }
    } catch (error) {
      console.error('[dbview-mainPanel] Failed to reconnect client:', error);
    }
  }

  return client.status === 'connected';
}

/**
 * Get existing panel for a connection config
 * @param config Connection configuration (must match what was used to create panel)
 * @returns The webview panel if it exists, undefined otherwise
 */
export function getPanelForConnection(config: DatabaseConnectionConfig): vscode.WebviewPanel | undefined {
  const key = getConnectionKey(config);
  return panels.get(key);
}

export function getAllPanels(): vscode.WebviewPanel[] {
  return Array.from(panels.values());
}

/**
 * Close existing panel for a connection config
 * @param config Connection configuration (must match what was used to create panel)
 */
export function closePanelForConnection(config: DatabaseConnectionConfig): void {
  const key = getConnectionKey(config);
  const panel = panels.get(key);
  if (panel) {
    panel.dispose(); // This will trigger disposal handler which cleans up maps
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

  console.log(`[dbview-mainPanel] ========== getOrCreateMainPanel CALLED ==========`);
  console.log(`[dbview-mainPanel] Connection config:`, JSON.stringify(connInfo, null, 2));
  console.log(`[dbview-mainPanel] Generated connection key: "${key}"`);
  console.log(`[dbview-mainPanel] Current panels map size: ${panels.size}`);
  console.log(`[dbview-mainPanel] Current panel keys:`, Array.from(panels.keys()));

  // If panel exists for this connection, reveal and return it
  const existingPanel = panels.get(key);
  if (existingPanel) {
    console.log(`[dbview-mainPanel] ✓ REUSING existing panel for connection key: "${key}"`);
    // Update the client in case it was reconnected
    panelClients.set(key, client);
    existingPanel.reveal(vscode.ViewColumn.Active);
    return existingPanel;
  }

  // Create new panel for this connection
  const connectionTitle = connectionConfig.name || ('database' in connectionConfig ? connectionConfig.database : connectionConfig.dbType);
  console.log(`[dbview-mainPanel] ✓ CREATING NEW panel for connection: ${connectionTitle} (key: "${key}")`);

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
  panelReadyState.set(key, false);
  panelMessageQueues.set(key, []);

  console.log(`[dbview-mainPanel] ✓ Panel stored in map with key: "${key}"`);
  console.log(`[dbview-mainPanel] ✓ Panels map now has ${panels.size} panel(s)`);
  console.log(`[dbview-mainPanel] ✓ All panel keys:`, Array.from(panels.keys()));

  panel.onDidDispose(() => {
    console.log(`[dbview-mainPanel] Panel disposed for connection: ${connectionTitle} (key: "${key}")`);
    panels.delete(key);
    panelConfigs.delete(key);
    panelClients.delete(key);
    panelReadyState.delete(key);
    panelMessageQueues.delete(key);
    console.log(`[dbview-mainPanel] Panels map now has ${panels.size} panel(s)`);
  });

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  // Handle messages from the webview
  // Message handler uses panelClients.get(key) to get the current client (may be updated after reconnects)
  panel.webview.onDidReceiveMessage(async (message: any) => {
    try {
      const tabId = message.tabId;
      // Always get the current client from the map (may have been updated after reconnection)
      const currentClient = panelClients.get(key);
      if (!currentClient) {
        console.error(`[dbview-mainPanel] No client found for connection key: ${key}`);
        return;
      }

      // For database operations, ensure client is connected
      const requiresConnection = [
        "LOAD_TABLE_ROWS", "GET_ROW_COUNT", "GET_TABLE_METADATA", "GET_TABLE_INDEXES",
        "RUN_QUERY", "INSERT_ROW", "UPDATE_CELL", "DELETE_ROWS", "GET_EXPLAIN_PLAN",
        "GET_AUTOCOMPLETE_DATA",
        // Document database operations (MongoDB, Elasticsearch, Cassandra)
        "UPDATE_DOCUMENT", "INSERT_DOCUMENT", "DELETE_DOCUMENTS", "RUN_DOCUMENT_QUERY",
        // Redis operations
        "LOAD_REDIS_KEYS", "RUN_REDIS_COMMAND"
      ].includes(message?.type);

      if (requiresConnection) {
        const isConnected = await ensureClientConnected(currentClient);
        if (!isConnected) {
          const errorMsg = 'Database connection lost. Please reconnect and try again.';
          console.error(`[dbview-mainPanel] ${errorMsg}`);
          vscode.window.showErrorMessage(`dbview: ${errorMsg}`, 'Reconnect').then(selection => {
            if (selection === 'Reconnect') {
              vscode.commands.executeCommand('dbview.reconnectConnection');
            }
          });
          // Send error response to webview for operations that expect a response
          if (message.tabId) {
            panel.webview.postMessage({
              type: "CONNECTION_ERROR",
              tabId: message.tabId,
              error: errorMsg
            });
          }
          return;
        }
      }

      switch (message?.type) {
        case "WEBVIEW_READY": {
          console.log(`[dbview-mainPanel] Webview ready for connection: ${key}`);
          panelReadyState.set(key, true);

          // Flush any queued messages
          const queue = panelMessageQueues.get(key) || [];
          console.log(`[dbview-mainPanel] Flushing ${queue.length} queued message(s)`);
          for (const queuedMsg of queue) {
            panel.webview.postMessage(queuedMsg);
          }
          panelMessageQueues.set(key, []);
          break;
        }

        case "LOAD_TABLE_ROWS": {
          const schema = message.schema;
          const table = message.table;
          const limit = typeof message.limit === "number" ? message.limit : 100;
          const offset = typeof message.offset === "number" ? message.offset : 0;
          const filters = message.filters as FilterCondition[] | undefined;
          const filterLogic = (message.filterLogic as 'AND' | 'OR') ?? 'AND';
          const sorting = message.sorting as Array<{ columnName: string; direction: 'asc' | 'desc' }> | undefined;

          console.log(`[dbview] Loading table rows for tab ${tabId}: ${schema}.${table} (limit: ${limit}, offset: ${offset}, filters: ${filters?.length ?? 0}, sorting: ${sorting?.length ?? 0})`);

          try {
            const result = await currentClient.fetchTableRows(schema, table, { limit, offset, filters, filterLogic, sorting });
            panel.webview.postMessage({
              type: "LOAD_TABLE_ROWS",
              tabId,
              schema,
              table,
              columns: result.columns,
              rows: result.rows,
              limit,
              offset,
              dbType: connectionConfig.dbType || 'postgres'
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
            const totalRows = await currentClient.getTableRowCount(message.schema, message.table, { filters, filterLogic });
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
            const metadata = await currentClient.getTableMetadata(message.schema, message.table);
            panel.webview.postMessage({
              type: "TABLE_METADATA",
              tabId,
              columns: metadata,
              dbType: connectionConfig.dbType || 'postgres'
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
            if (currentClient.getIndexes) {
              const indexes = await currentClient.getIndexes(message.schema, message.table);
              panel.webview.postMessage({
                type: "TABLE_INDEXES",
                indexes
              });
            } else {
              panel.webview.postMessage({
                type: "TABLE_INDEXES",
                indexes: []
              });
            }
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
            const statistics = await currentClient.getTableStatistics(message.schema, message.table);
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
            if (currentClient.getERDiagramData) {
              const diagramData = await currentClient.getERDiagramData(message.schemas);
              panel.webview.postMessage({
                type: "ER_DIAGRAM_DATA",
                diagramData
              });
            } else {
              panel.webview.postMessage({
                type: "ER_DIAGRAM_DATA",
                diagramData: { tables: [], relationships: [] }
              });
            }
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
            await currentClient.updateCell(
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
            console.log(`[dbview] Calling currentClient.insertRow...`);
            const newRow = await currentClient.insertRow(message.schema, message.table, message.values);
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

        case "CONFIRM_DELETE": {
          // Show VS Code native confirmation dialog for delete operations
          const rowCount = message.rowCount || 1;
          const rowWord = rowCount === 1 ? 'row' : 'rows';
          const confirmMessage = `Are you sure you want to delete ${rowCount} ${rowWord}? This action cannot be undone.`;

          const result = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            'Delete'
          );

          panel.webview.postMessage({
            type: "CONFIRM_DELETE_RESULT",
            tabId,
            confirmed: result === 'Delete'
          });
          break;
        }

        case "SHOW_JUMP_TO_ROW": {
          // Show VS Code native InputBox for Jump to Row
          const { totalRows: jumpTotalRows, pageSize: jumpPageSize, offset: jumpOffset } = message;
          const pageStartRow = jumpOffset + 1;
          const pageEndRow = Math.min(jumpOffset + jumpPageSize, jumpTotalRows ?? jumpOffset + jumpPageSize);

          const rowNumberStr = await vscode.window.showInputBox({
            title: 'Jump to Row',
            prompt: `Enter row number (current view: ${pageStartRow.toLocaleString()}-${pageEndRow.toLocaleString()}${jumpTotalRows !== null ? ` of ${jumpTotalRows.toLocaleString()}` : ''})`,
            placeHolder: `1-${jumpTotalRows?.toLocaleString() ?? '...'}`,
            validateInput: (value) => {
              const num = parseInt(value, 10);
              if (isNaN(num) || num < 1) {
                return 'Please enter a valid row number';
              }
              if (jumpTotalRows !== null && num > jumpTotalRows) {
                return `Row number must be between 1 and ${jumpTotalRows.toLocaleString()}`;
              }
              // Check if row is on current page
              if (num < pageStartRow || num > pageEndRow) {
                return `Row ${num} is on page ${Math.ceil(num / jumpPageSize)}. Navigate to that page first.`;
              }
              return null;
            }
          });

          if (rowNumberStr !== undefined) {
            const rowNumber = parseInt(rowNumberStr, 10);
            const localRowIndex = rowNumber - pageStartRow;
            panel.webview.postMessage({
              type: "JUMP_TO_ROW_RESULT",
              tabId,
              rowIndex: localRowIndex,
              rowNumber
            });
          }
          break;
        }

        case "SHOW_SAVE_VIEW": {
          // Show VS Code native InputBox for Save View - multi-step flow
          const { currentState: viewState } = message;

          // Build summary of what will be saved
          const hasFilters = viewState?.filters?.length > 0;
          const hasSorting = viewState?.sorting?.length > 0;
          const hasVisibleColumns = viewState?.visibleColumns?.length > 0;

          const summaryParts: string[] = [];
          if (hasFilters) summaryParts.push(`${viewState.filters.length} filter(s)`);
          if (hasSorting) summaryParts.push(`${viewState.sorting.length} sort(s)`);
          if (hasVisibleColumns) summaryParts.push(`${viewState.visibleColumns.length} column(s)`);
          if (viewState?.pageSize) summaryParts.push(`${viewState.pageSize} rows/page`);

          const summaryText = summaryParts.length > 0
            ? `Saving: ${summaryParts.join(', ')}`
            : 'Saving current view configuration';

          // Step 1: Get view name
          const viewName = await vscode.window.showInputBox({
            title: 'Save View - Name',
            prompt: summaryText,
            placeHolder: 'e.g., Active Users, Recent Orders',
            validateInput: (value) => {
              if (!value || !value.trim()) {
                return 'View name is required';
              }
              return null;
            }
          });

          if (viewName === undefined) {
            break; // User cancelled
          }

          // Step 2: Get optional description
          const viewDescription = await vscode.window.showInputBox({
            title: 'Save View - Description (Optional)',
            prompt: `Saving view "${viewName}"`,
            placeHolder: 'Brief description of this view (press Enter to skip)'
          });

          if (viewDescription === undefined) {
            break; // User cancelled
          }

          // Step 3: Ask if this should be the default view
          const defaultChoice = await vscode.window.showQuickPick(
            [
              { label: 'No', description: 'Use default table view when opening', value: false },
              { label: 'Yes', description: 'Automatically apply this view when opening the table', value: true }
            ],
            {
              title: 'Save View - Set as Default?',
              placeHolder: 'Set as default view for this table?'
            }
          );

          if (defaultChoice === undefined) {
            break; // User cancelled
          }

          // Send the result back to the webview
          panel.webview.postMessage({
            type: "SAVE_VIEW_RESULT",
            tabId,
            name: viewName.trim(),
            description: viewDescription?.trim() || '',
            isDefault: defaultChoice.value
          });
          break;
        }

        case "SHOW_EXPORT_DIALOG": {
          // Show VS Code native QuickPick for Export - multi-step flow
          const { selectedRowCount = 0, hasFilters = false } = message;

          // Step 1: Select format
          const formatChoice = await vscode.window.showQuickPick(
            [
              { label: '$(file-text) CSV', description: 'Comma-separated values', value: 'csv' },
              { label: '$(json) JSON', description: 'JavaScript Object Notation', value: 'json' },
              { label: '$(database) SQL', description: 'SQL INSERT statements', value: 'sql' }
            ],
            {
              title: 'Export Data - Select Format',
              placeHolder: 'Choose export format'
            }
          );

          if (!formatChoice) {
            break; // User cancelled
          }

          const format = formatChoice.value;

          // Step 2: Build options list based on context
          const optionItems: { label: string; description: string; picked: boolean; id: string }[] = [];

          // Include headers option (only for CSV)
          if (format === 'csv') {
            optionItems.push({
              label: 'Include headers',
              description: 'Add column names as first row',
              picked: true,
              id: 'includeHeaders'
            });
          }

          // Selected rows only option (if rows are selected)
          if (selectedRowCount > 0) {
            optionItems.push({
              label: `Selected rows only (${selectedRowCount})`,
              description: 'Export only the selected rows',
              picked: false,
              id: 'selectedRowsOnly'
            });
          }

          // Apply filters option (if filters active)
          if (hasFilters) {
            optionItems.push({
              label: 'Apply current filters',
              description: 'Only export rows matching active filters',
              picked: false,
              id: 'applyCurrentFilters'
            });
          }

          // If there are options to choose from, show multi-select
          let includeHeaders = true;
          let selectedRowsOnly = false;
          let applyCurrentFilters = false;

          if (optionItems.length > 0) {
            const selectedOptions = await vscode.window.showQuickPick(
              optionItems,
              {
                title: 'Export Data - Options',
                placeHolder: 'Select export options (optional)',
                canPickMany: true
              }
            );

            if (selectedOptions === undefined) {
              break; // User cancelled
            }

            // Process selected options
            const selectedIds = new Set(selectedOptions.map(opt => opt.id));
            includeHeaders = format === 'csv' ? selectedIds.has('includeHeaders') : true;
            selectedRowsOnly = selectedIds.has('selectedRowsOnly');
            applyCurrentFilters = selectedIds.has('applyCurrentFilters');
          }

          // Send the result back to the webview
          panel.webview.postMessage({
            type: "EXPORT_RESULT",
            tabId,
            options: {
              format,
              includeHeaders: format === 'csv' ? includeHeaders : undefined,
              selectedRowsOnly,
              applyCurrentFilters,
              encoding: 'UTF-8'
            }
          });
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
            const deletedCount = await currentClient.deleteRows(message.schema, message.table, message.primaryKeys);
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

        // ==================== Document Database Operations (MongoDB, Elasticsearch) ====================

        case "UPDATE_DOCUMENT": {
          console.log(`[dbview] Updating document ${message.documentId} in ${message.schema}.${message.table}`);
          try {
            // For MongoDB, use updateCell with the document ID as the primary key
            const primaryKey = { _id: message.documentId };

            // Apply each field update, skipping immutable fields like _id
            for (const [field, value] of Object.entries(message.updates as Record<string, unknown>)) {
              // Skip _id field - it's immutable in MongoDB and used as the primary key
              if (field === '_id') {
                console.log(`[dbview] Skipping immutable field: _id`);
                continue;
              }

              await currentClient.updateCell(
                message.schema,
                message.table,
                primaryKey,
                field,
                value
              );
            }

            panel.webview.postMessage({
              type: "UPDATE_SUCCESS",
              tabId,
              documentId: message.documentId
            });
          } catch (error) {
            console.error(`[dbview] Error updating document:`, error);
            panel.webview.postMessage({
              type: "UPDATE_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "INSERT_DOCUMENT": {
          console.log(`[dbview] ========== INSERT DOCUMENT REQUEST ==========`);
          console.log(`[dbview] Tab ID: ${tabId}`);
          console.log(`[dbview] Schema: ${message.schema}`);
          console.log(`[dbview] Table/Collection: ${message.table}`);
          console.log(`[dbview] Document to insert:`, JSON.stringify(message.document, null, 2));
          console.log(`[dbview] Client type: ${currentClient?.constructor?.name}`);

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
            console.log(`[dbview] Calling currentClient.insertRow...`);
            const newRow = await currentClient.insertRow(
              message.schema,
              message.table,
              message.document as Record<string, unknown>
            );
            console.log(`[dbview] ========== INSERT DOCUMENT SUCCESSFUL ==========`);
            console.log(`[dbview] Inserted document:`, JSON.stringify(newRow, null, 2));

            panel.webview.postMessage({
              type: "INSERT_SUCCESS",
              tabId,
              newRow
            });
            console.log(`[dbview] INSERT_SUCCESS message sent to webview`);
          } catch (error) {
            console.error(`[dbview] ========== INSERT DOCUMENT FAILED ==========`);
            console.error(`[dbview] Error inserting document:`, error);
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

        case "DELETE_DOCUMENTS": {
          console.log(`[dbview] Deleting ${message.documentIds?.length} document(s) from ${message.schema}.${message.table}`);
          try {
            const documentIds = message.documentIds as string[];

            // Convert document IDs to primary key objects
            const primaryKeys = documentIds.map(id => ({ _id: id }));

            const deletedCount = await currentClient.deleteRows(
              message.schema,
              message.table,
              primaryKeys
            );

            panel.webview.postMessage({
              type: "DELETE_SUCCESS",
              tabId,
              deletedCount
            });
          } catch (error) {
            console.error(`[dbview] Error deleting documents:`, error);
            panel.webview.postMessage({
              type: "DELETE_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        // ==================== Document Template Management ====================

        case "GET_DOCUMENT_TEMPLATES": {
          console.log(`[dbview] Getting templates for ${message.schema}.${message.table}`);
          try {
            const connKey = getConnectionKey(connectionConfig);
            const templateKey = `documentTemplates:${connKey}:${message.schema}:${message.table}`;
            const templates = context.workspaceState.get<any[]>(templateKey, []);
            panel.webview.postMessage({
              type: "DOCUMENT_TEMPLATES",
              tabId,
              schema: message.schema,
              table: message.table,
              templates
            });
          } catch (error) {
            console.error(`[dbview] Error getting templates:`, error);
          }
          break;
        }

        case "SAVE_DOCUMENT_TEMPLATE": {
          console.log(`[dbview] Saving template "${message.templateName}" for ${message.schema}.${message.table}`);
          try {
            const connKey = getConnectionKey(connectionConfig);
            const templateKey = `documentTemplates:${connKey}:${message.schema}:${message.table}`;
            const templates = context.workspaceState.get<any[]>(templateKey, []);

            const newTemplate = {
              id: `template-${Date.now()}`,
              name: message.templateName,
              content: message.templateContent,
              createdAt: new Date().toISOString()
            };

            templates.push(newTemplate);
            await context.workspaceState.update(templateKey, templates);

            panel.webview.postMessage({
              type: "TEMPLATE_SAVED",
              tabId,
              schema: message.schema,
              table: message.table,
              template: newTemplate
            });
          } catch (error) {
            console.error(`[dbview] Error saving template:`, error);
          }
          break;
        }

        case "DELETE_DOCUMENT_TEMPLATE": {
          console.log(`[dbview] Deleting template ${message.templateId} for ${message.schema}.${message.table}`);
          try {
            const connKey = getConnectionKey(connectionConfig);
            const templateKey = `documentTemplates:${connKey}:${message.schema}:${message.table}`;
            const templates = context.workspaceState.get<any[]>(templateKey, []);

            const filteredTemplates = templates.filter(t => t.id !== message.templateId);
            await context.workspaceState.update(templateKey, filteredTemplates);

            panel.webview.postMessage({
              type: "TEMPLATE_DELETED",
              tabId,
              schema: message.schema,
              table: message.table,
              templateId: message.templateId
            });
          } catch (error) {
            console.error(`[dbview] Error deleting template:`, error);
          }
          break;
        }

        // ==================== Redis Operations ====================

        case "LOAD_REDIS_KEYS": {
          console.log(`[dbview] Loading Redis keys: type=${message.keyType}, pattern=${message.pattern}`);
          try {
            // For Redis, the table name encodes the key type: "[type] pattern"
            const keyType = message.keyType || 'string';
            const pattern = message.pattern || '*';
            const tableName = `[${keyType}] ${pattern}`;

            const result = await currentClient.fetchTableRows(
              message.schema || '',
              tableName,
              {
                limit: message.limit || 100,
                offset: message.offset || 0
              }
            );

            // Get metadata for the key type
            const metadata = await currentClient.getTableMetadata(message.schema || '', tableName);

            panel.webview.postMessage({
              type: "LOAD_TABLE_ROWS",
              tabId,
              schema: message.schema || '',
              table: tableName,
              columns: result.columns,
              rows: result.rows,
              limit: message.limit || 100,
              offset: message.offset || 0,
              dbType: 'redis'
            });

            panel.webview.postMessage({
              type: "TABLE_METADATA",
              tabId,
              columns: metadata,
              dbType: 'redis'
            });
          } catch (error) {
            console.error(`[dbview] Error loading Redis keys:`, error);
            vscode.window.showErrorMessage(`Failed to load Redis keys: ${error instanceof Error ? error.message : String(error)}`);
          }
          break;
        }

        case "SCAN_REDIS_KEYS": {
          // Cursor-based SCAN for namespace tree (like desktop RedisSidebarTree)
          console.log(`[dbview] Scanning Redis keys: pattern=${message.pattern}, cursor=${message.cursor}, schema=${message.schema}`);
          try {
            const pattern = message.pattern || '*';
            const cursor = message.cursor || '0';
            const count = message.count || 100;

            // Select the correct database (schema is "db0", "db1", etc.)
            const dbIndex = message.schema ? parseInt(message.schema.replace('db', ''), 10) : 0;
            if (!isNaN(dbIndex)) {
              await currentClient.runQuery(`SELECT ${dbIndex}`);
            }

            // Execute SCAN command
            const scanResult = await currentClient.runQuery(`SCAN ${cursor} MATCH ${pattern} COUNT ${count}`);

            if (!scanResult.rows || scanResult.rows.length < 2) {
              panel.webview.postMessage({
                type: "REDIS_SCAN_RESULT",
                tabId,
                keys: [],
                cursor: "0",
                hasMore: false
              });
              break;
            }

            // Parse SCAN result: [cursor, [keys...]]
            const cursorRow = scanResult.rows[0] as Record<string, unknown>;
            const keysRow = scanResult.rows[1] as Record<string, unknown>;
            const nextCursor = String(cursorRow.value ?? "0");
            const scannedKeys = (keysRow.value as string[]) || [];

            // Get types for each key (in parallel for performance)
            const keysWithTypes = await Promise.all(
              scannedKeys.map(async (key) => {
                try {
                  const typeResult = await currentClient.runQuery(`TYPE ${key}`);
                  const type = typeResult.rows?.[0] ? String(Object.values(typeResult.rows[0])[0]) : 'unknown';
                  return { key, type };
                } catch {
                  return { key, type: 'unknown' };
                }
              })
            );

            panel.webview.postMessage({
              type: "REDIS_SCAN_RESULT",
              tabId,
              keys: keysWithTypes,
              cursor: nextCursor,
              hasMore: nextCursor !== "0"
            });
          } catch (error) {
            console.error(`[dbview] Error scanning Redis keys:`, error);
            panel.webview.postMessage({
              type: "REDIS_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "GET_REDIS_KEY_VALUE": {
          // Get value for a selected key based on its type
          console.log(`[dbview] Getting Redis key value: ${message.key}, schema=${message.schema}`);
          try {
            const key = message.key;

            // Select the correct database (schema is "db0", "db1", etc.)
            const dbIndex = message.schema ? parseInt(message.schema.replace('db', ''), 10) : 0;
            if (!isNaN(dbIndex)) {
              await currentClient.runQuery(`SELECT ${dbIndex}`);
            }

            // Get key type first
            const typeResult = await currentClient.runQuery(`TYPE ${key}`);
            const keyType = typeResult.rows?.[0] ? String(Object.values(typeResult.rows[0])[0]) : 'none';

            // Get TTL
            const ttlResult = await currentClient.runQuery(`TTL ${key}`);
            const ttl = ttlResult.rows?.[0] ? Number(Object.values(ttlResult.rows[0])[0]) : -1;

            // Try to get memory usage (may fail on older Redis)
            let memory: number | undefined;
            try {
              const memResult = await currentClient.runQuery(`MEMORY USAGE ${key}`);
              if (memResult.rows?.[0]) {
                memory = Number(Object.values(memResult.rows[0])[0]);
              }
            } catch {
              // Memory command not supported
            }

            // Get value based on type
            let data: any = { type: keyType, ttl, memory };

            switch (keyType) {
              case 'string': {
                const result = await currentClient.runQuery(`GET ${key}`);
                // Result format: [{ result: value }] or [{ index, value }]
                if (result.rows?.[0]) {
                  const row = result.rows[0] as Record<string, unknown>;
                  // Handle both formats: { result: value } or { value: value }
                  data.value = String(row.result ?? row.value ?? Object.values(row)[0] ?? '');
                } else {
                  data.value = null;
                }
                break;
              }
              case 'hash': {
                const result = await currentClient.runQuery(`HGETALL ${key}`);
                // Parse hash result into field-value pairs
                // runQuery returns alternating [{ index: 0, value: "field1" }, { index: 1, value: "value1" }, ...]
                // OR could be object format { field1: value1, field2: value2 }
                const fields: { field: string; value: string }[] = [];
                if (result.rows && result.rows.length > 0) {
                  const firstRow = result.rows[0] as Record<string, unknown>;

                  if ('index' in firstRow && 'value' in firstRow) {
                    // Array format - alternating field/value pairs from runQuery
                    for (let i = 0; i < result.rows.length; i += 2) {
                      const fieldRow = result.rows[i] as Record<string, unknown>;
                      const valueRow = result.rows[i + 1] as Record<string, unknown>;
                      if (fieldRow && valueRow) {
                        const field = String(fieldRow.value ?? '');
                        const value = String(valueRow.value ?? '');
                        fields.push({ field, value });
                      }
                    }
                  } else {
                    // Object format - keys are field names
                    for (const [field, value] of Object.entries(firstRow)) {
                      fields.push({ field, value: String(value ?? '') });
                    }
                  }
                }
                data.fields = fields;
                break;
              }
              case 'list': {
                const result = await currentClient.runQuery(`LRANGE ${key} 0 -1`);
                // runQuery returns [{ index: 0, value: "item1" }, { index: 1, value: "item2" }, ...]
                const items: { index: number; value: string }[] = [];
                if (result.rows) {
                  result.rows.forEach((row) => {
                    const rowData = row as Record<string, unknown>;
                    const index = typeof rowData.index === 'number' ? rowData.index : items.length;
                    const value = String(rowData.value ?? Object.values(rowData).find(v => typeof v === 'string') ?? '');
                    items.push({ index, value });
                  });
                }
                data.items = items;
                break;
              }
              case 'set': {
                const result = await currentClient.runQuery(`SMEMBERS ${key}`);
                // runQuery returns [{ index: 0, value: "member1" }, { index: 1, value: "member2" }, ...]
                const members: { value: string }[] = [];
                if (result.rows) {
                  result.rows.forEach((row) => {
                    const rowData = row as Record<string, unknown>;
                    const value = String(rowData.value ?? Object.values(rowData).find(v => typeof v === 'string') ?? '');
                    members.push({ value });
                  });
                }
                data.members = members;
                break;
              }
              case 'zset': {
                const result = await currentClient.runQuery(`ZRANGE ${key} 0 -1 WITHSCORES`);
                // runQuery returns [{ index: 0, value: "member1" }, { index: 1, value: "score1" }, ...]
                // Alternating member/score pairs
                const members: { value: string; score: number }[] = [];
                if (result.rows) {
                  for (let i = 0; i < result.rows.length; i += 2) {
                    const memberRow = result.rows[i] as Record<string, unknown>;
                    const scoreRow = result.rows[i + 1] as Record<string, unknown>;
                    const value = String(memberRow?.value ?? Object.values(memberRow || {}).find(v => typeof v === 'string') ?? '');
                    const score = scoreRow ? Number(scoreRow.value ?? Object.values(scoreRow).find(v => typeof v === 'string' || typeof v === 'number') ?? 0) : 0;
                    members.push({ value, score });
                  }
                }
                data.members = members;
                break;
              }
              case 'stream': {
                // Get stream entries using XRANGE
                const result = await currentClient.runQuery(`XRANGE ${key} - + COUNT 100`);
                const entries: { id: string; fields: Record<string, unknown> }[] = [];

                if (result.rows && result.rows.length > 0) {
                  // XRANGE returns: [[id1, [field1, val1, field2, val2]], [id2, ...]]
                  // runQuery may format this in different ways:
                  // 1. Raw array: row is [id, [field1, val1, ...]]
                  // 2. Object with value: { index: 0, value: [id, [fields]] }
                  // 3. Already parsed: { id: "...", fields: {...} }
                  for (const row of result.rows) {
                    // Case 1: Row is an array [id, [field1, val1, ...]]
                    if (Array.isArray(row)) {
                      const rowArray = row as unknown as [string, string[]];
                      const [id, fieldArray] = rowArray;
                      const fields: Record<string, unknown> = {};
                      if (Array.isArray(fieldArray)) {
                        for (let i = 0; i < fieldArray.length; i += 2) {
                          fields[String(fieldArray[i])] = fieldArray[i + 1];
                        }
                      }
                      entries.push({ id: String(id), fields });
                      continue;
                    }

                    const rowData = row as Record<string, unknown>;

                    // Case 2: Already parsed format { id, fields }
                    if (rowData.id && rowData.fields) {
                      entries.push({
                        id: String(rowData.id),
                        fields: (rowData.fields as Record<string, unknown>) || {}
                      });
                      continue;
                    }

                    // Case 3: Value is an array [id, [field1, val1, ...]]
                    if (Array.isArray(rowData.value)) {
                      const [id, fieldArray] = rowData.value as [string, string[]];
                      const fields: Record<string, unknown> = {};
                      if (Array.isArray(fieldArray)) {
                        for (let i = 0; i < fieldArray.length; i += 2) {
                          fields[String(fieldArray[i])] = fieldArray[i + 1];
                        }
                      }
                      entries.push({ id: String(id), fields });
                      continue;
                    }

                    // Case 4: Fallback - try to extract from object values
                    const values = Object.values(rowData);
                    if (values.length >= 2 && typeof values[0] === 'string') {
                      // Might be { index: id, value: [fields] } or similar
                      const potentialId = String(values[0]);
                      const potentialFields = values[1];
                      if (Array.isArray(potentialFields)) {
                        const fields: Record<string, unknown> = {};
                        for (let i = 0; i < potentialFields.length; i += 2) {
                          fields[String(potentialFields[i])] = potentialFields[i + 1];
                        }
                        entries.push({ id: potentialId, fields });
                      }
                    }
                  }
                }

                // Get stream length
                const infoResult = await currentClient.runQuery(`XLEN ${key}`);
                const length = infoResult.rows?.[0]
                  ? Number((infoResult.rows[0] as Record<string, unknown>).result ?? Object.values(infoResult.rows[0])[0] ?? 0)
                  : 0;

                data.entries = entries;
                data.streamInfo = { length };
                break;
              }

              // RedisJSON module types
              case 'ReJSON-RL':
              case 'rejson-rl': {
                // Try JSON.GET for RedisJSON module
                try {
                  const result = await currentClient.runQuery(`JSON.GET ${key}`);
                  if (result.rows?.[0]) {
                    const row = result.rows[0] as Record<string, unknown>;
                    const jsonStr = String(row.result ?? row.value ?? Object.values(row)[0] ?? '');
                    try {
                      data.jsonValue = JSON.parse(jsonStr);
                      data.rawValue = jsonStr;
                    } catch {
                      data.rawValue = jsonStr;
                    }
                  }
                } catch (jsonErr) {
                  // JSON.GET failed, try to get debug info
                  data.rawValue = `RedisJSON key (JSON.GET failed: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)})`;
                }
                break;
              }

              // Fallback for unknown types (HyperLogLog, module types, etc.)
              default: {
                // Try multiple approaches to get some data
                let rawValue: string | null = null;

                // 1. Try DEBUG OBJECT for metadata
                try {
                  const debugResult = await currentClient.runQuery(`DEBUG OBJECT ${key}`);
                  if (debugResult.rows?.[0]) {
                    const row = debugResult.rows[0] as Record<string, unknown>;
                    data.debugInfo = String(row.result ?? row.value ?? Object.values(row)[0] ?? '');
                  }
                } catch {
                  // DEBUG command may be disabled
                }

                // 2. Try OBJECT ENCODING to understand the internal encoding
                try {
                  const encodingResult = await currentClient.runQuery(`OBJECT ENCODING ${key}`);
                  if (encodingResult.rows?.[0]) {
                    const row = encodingResult.rows[0] as Record<string, unknown>;
                    data.encoding = String(row.result ?? row.value ?? Object.values(row)[0] ?? '');
                  }
                } catch {
                  // OBJECT command may fail
                }

                // 3. For unknown types, try common commands based on probable encoding
                // HyperLogLog uses string encoding internally
                if (keyType === 'string' || data.encoding === 'raw' || data.encoding === 'embstr') {
                  try {
                    const getResult = await currentClient.runQuery(`GET ${key}`);
                    if (getResult.rows?.[0]) {
                      const row = getResult.rows[0] as Record<string, unknown>;
                      rawValue = String(row.result ?? row.value ?? Object.values(row)[0] ?? '');
                    }
                  } catch {
                    // GET failed
                  }
                }

                // 4. Try DUMP as last resort (returns serialized value)
                if (!rawValue) {
                  try {
                    const dumpResult = await currentClient.runQuery(`DUMP ${key}`);
                    if (dumpResult.rows?.[0]) {
                      const row = dumpResult.rows[0] as Record<string, unknown>;
                      const dumpValue = row.result ?? row.value ?? Object.values(row)[0];
                      if (dumpValue) {
                        // DUMP returns binary data, convert to hex for display
                        data.dumpHex = Buffer.isBuffer(dumpValue)
                          ? (dumpValue as Buffer).toString('hex')
                          : String(dumpValue);
                      }
                    }
                  } catch {
                    // DUMP failed
                  }
                }

                data.rawValue = rawValue;
                data.isUnknownType = true;
                break;
              }
            }

            panel.webview.postMessage({
              type: "REDIS_KEY_VALUE",
              tabId,
              key,
              data
            });
          } catch (error) {
            console.error(`[dbview] Error getting Redis key value:`, error);
            panel.webview.postMessage({
              type: "REDIS_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "GET_REDIS_KEY_INFO": {
          // Get metadata for a key (TYPE, TTL, MEMORY)
          console.log(`[dbview] Getting Redis key info: ${message.key}, schema=${message.schema}`);
          try {
            const key = message.key;

            // Select the correct database (schema is "db0", "db1", etc.)
            const dbIndex = message.schema ? parseInt(message.schema.replace('db', ''), 10) : 0;
            if (!isNaN(dbIndex)) {
              await currentClient.runQuery(`SELECT ${dbIndex}`);
            }

            // Get type
            const typeResult = await currentClient.runQuery(`TYPE ${key}`);
            const keyType = typeResult.rows?.[0] ? String(Object.values(typeResult.rows[0])[0]) : 'none';

            // Get TTL
            const ttlResult = await currentClient.runQuery(`TTL ${key}`);
            const ttl = ttlResult.rows?.[0] ? Number(Object.values(ttlResult.rows[0])[0]) : -1;

            // Try to get memory usage
            let memory: number | undefined;
            try {
              const memResult = await currentClient.runQuery(`MEMORY USAGE ${key}`);
              if (memResult.rows?.[0]) {
                memory = Number(Object.values(memResult.rows[0])[0]);
              }
            } catch {
              // Memory command not supported
            }

            panel.webview.postMessage({
              type: "REDIS_KEY_INFO",
              tabId,
              key,
              keyType,
              ttl,
              memory
            });
          } catch (error) {
            console.error(`[dbview] Error getting Redis key info:`, error);
            panel.webview.postMessage({
              type: "REDIS_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "GET_REDIS_DBSIZE": {
          // Get total key count for a database (O(1) operation)
          console.log(`[dbview] Getting Redis DBSIZE for schema: ${message.schema}`);
          try {
            // Select the correct database (schema is "db0", "db1", etc.)
            const dbIndex = message.schema ? parseInt(message.schema.replace('db', ''), 10) : 0;
            if (!isNaN(dbIndex)) {
              await currentClient.runQuery(`SELECT ${dbIndex}`);
            }

            const result = await currentClient.runQuery("DBSIZE");
            const size = result.rows?.[0] ? Number(Object.values(result.rows[0])[0]) : 0;

            panel.webview.postMessage({
              type: "REDIS_DBSIZE",
              tabId,
              schema: message.schema,
              size
            });
          } catch (error) {
            console.error(`[dbview] Error getting Redis DBSIZE:`, error);
            panel.webview.postMessage({
              type: "REDIS_ERROR",
              tabId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        // ==================== Document Query Operations (MongoDB, Elasticsearch, Cassandra) ====================

        case "RUN_DOCUMENT_QUERY": {
          // Execute query from the Document Query Editor (MongoDB/Elasticsearch/Cassandra)
          const queryDbType = message.dbType as string;
          console.log(`[dbview] Running ${queryDbType} query for tab ${tabId}: ${message.query?.substring(0, 100)}...`);
          const docQueryStartTime = Date.now();

          try {
            let result: QueryResultSet;

            if (queryDbType === 'cassandra') {
              // Cassandra uses CQL - pass directly to runQuery
              result = await currentClient.runQuery(message.query);
            } else if (queryDbType === 'mongodb' || queryDbType === 'elasticsearch') {
              // MongoDB and Elasticsearch use JSON queries
              // The query should be valid JSON that the adapter can interpret
              result = await currentClient.runQuery(message.query);
            } else {
              throw new Error(`Unsupported document database type: ${queryDbType}`);
            }

            const docQueryDuration = Date.now() - docQueryStartTime;

            // Format results for the UI grid
            let columns: string[] = [];
            let rows: Record<string, unknown>[] = result.rows || [];

            if (rows.length > 0) {
              // Extract columns from the first row's keys
              const firstRow = rows[0];
              columns = Object.keys(firstRow);
            } else {
              // No results - show empty state
              columns = ['result'];
              rows = [{ result: '(no results)' }];
            }

            panel.webview.postMessage({
              type: "DOCUMENT_QUERY_RESULT",
              tabId,
              columns,
              rows,
              duration: docQueryDuration
            });
          } catch (error) {
            console.error(`[dbview] Error running ${queryDbType} query:`, error);
            panel.webview.postMessage({
              type: "DOCUMENT_QUERY_ERROR",
              tabId,
              message: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "RUN_REDIS_COMMAND": {
          // Execute raw Redis command from the Redis query editor
          console.log(`[dbview] Running Redis command from query editor: ${message.command}`);
          const redisStartTime = Date.now();
          try {
            const result = await currentClient.runQuery(message.command);
            const redisDuration = Date.now() - redisStartTime;

            // Format results for the UI grid
            let columns: string[] = [];
            let rows: Record<string, unknown>[] = [];

            if (result.rows && result.rows.length > 0) {
              // If rows have 'index' and 'value' properties, format them nicely
              const firstRow = result.rows[0] as Record<string, unknown>;
              if ('index' in firstRow && 'value' in firstRow) {
                columns = ['index', 'value'];
                rows = result.rows.map((r) => {
                  const row = r as Record<string, unknown>;
                  return { index: row.index, value: row.value };
                });
              } else if ('result' in firstRow) {
                // Single result value
                columns = ['result'];
                rows = [{ result: firstRow.result }];
              } else {
                // Use whatever columns are present
                columns = Object.keys(firstRow);
                rows = result.rows;
              }
            } else {
              // Empty result
              columns = ['result'];
              rows = [{ result: '(empty)' }];
            }

            panel.webview.postMessage({
              type: "REDIS_COMMAND_RESULT",
              tabId,
              columns,
              rows,
              duration: redisDuration
            });
          } catch (error) {
            console.error(`[dbview] Error running Redis command:`, error);
            panel.webview.postMessage({
              type: "REDIS_COMMAND_ERROR",
              tabId,
              message: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "RUN_QUERY": {
          console.log(`[dbview] Running query for tab ${tabId}`);

          // Generate unique query ID
          const queryId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

          // Track the running query
          runningQueries.set(tabId, {
            queryId,
            startTime: Date.now(),
            sql: message.sql
          });

          try {
            const result = await currentClient.runQuery(message.sql, queryId);
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
          } finally {
            // Clean up tracking
            runningQueries.delete(tabId);
          }
          break;
        }

        case "CANCEL_QUERY": {
          console.log(`[dbview] Cancel query requested for tab ${tabId}`);

          // Get the running query info
          const runningQuery = runningQueries.get(tabId);

          if (!runningQuery) {
            console.log(`[dbview] No running query found for tab ${tabId}`);
            panel.webview.postMessage({
              type: "QUERY_CANCELLED",
              tabId
            });
            break;
          }

          // Check if the adapter supports query cancellation
          if (!currentClient.cancelQuery) {
            console.log(`[dbview] Query cancellation not supported for ${currentClient.type}`);
            runningQueries.delete(tabId);
            panel.webview.postMessage({
              type: "QUERY_ERROR",
              tabId,
              message: `Query cancellation is not supported for ${currentClient.type} databases`
            });
            break;
          }

          try {
            console.log(`[dbview] Cancelling query ${runningQuery.queryId} for tab ${tabId}`);
            await currentClient.cancelQuery(runningQuery.queryId);

            panel.webview.postMessage({
              type: "QUERY_CANCELLED",
              tabId
            });

            vscode.window.showInformationMessage('Query cancelled successfully');
          } catch (error) {
            console.error(`[dbview] Error cancelling query:`, error);
            panel.webview.postMessage({
              type: "QUERY_ERROR",
              tabId,
              message: `Failed to cancel query: ${error instanceof Error ? error.message : String(error)}`
            });
          } finally {
            // Clean up tracking
            runningQueries.delete(tabId);
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
          const startTime = Date.now();
          try {
            // Get configurable limits from VS Code settings
            const limits = getAutocompleteLimits();
            console.log(`[dbview] Using limits: ${limits.MAX_TOTAL_TABLES} tables max, ${limits.MAX_TABLES_WITH_METADATA} with metadata`);

            // Fetch all schemas using database-agnostic adapter method
            const schemas = await currentClient.listSchemas();
            console.log(`[dbview] Fetched ${schemas.length} schemas in ${Date.now() - startTime}ms`);

            // Fetch tables with row counts for each schema (with limits for performance)
            const allTables: TableInfo[] = [];

            for (const schema of schemas) {
              if (allTables.length >= limits.MAX_TOTAL_TABLES) {
                console.log(`[dbview] Reached max table limit (${limits.MAX_TOTAL_TABLES}), skipping remaining schemas`);
                break;
              }

              try {
                const schemaTables = await currentClient.listTables(schema);
                // Limit tables per schema
                const limitedTables = schemaTables.slice(0, limits.MAX_TABLES_PER_SCHEMA);

                if (schemaTables.length > limitedTables.length) {
                  console.log(`[dbview] Schema '${schema}' has ${schemaTables.length} tables, limiting to ${limitedTables.length}`);
                }

                // Add schema to each table info
                allTables.push(...limitedTables.map(t => ({
                  ...t,
                  schema: schema
                })));
              } catch (error) {
                console.error(`[dbview] Error fetching tables for schema ${schema}:`, error);
              }
            }
            console.log(`[dbview] Fetched ${allTables.length} tables in ${Date.now() - startTime}ms`);

            // Fetch column metadata only for a limited subset of tables to prevent performance issues
            // Full metadata fetching on large DBs can take minutes and freeze the UI
            const columns: Record<string, ColumnMetadata[]> = {};
            const tablesToFetchMetadata = allTables.slice(0, limits.MAX_TABLES_WITH_METADATA);

            if (allTables.length > limits.MAX_TABLES_WITH_METADATA) {
              console.log(`[dbview] Limiting column metadata fetch to ${limits.MAX_TABLES_WITH_METADATA} of ${allTables.length} tables`);
            }

            for (const table of tablesToFetchMetadata) {
              const key = `${table.schema}.${table.name}`;
              try {
                columns[key] = await currentClient.getTableMetadata(table.schema, table.name);
              } catch (error) {
                console.error(`[dbview] Error fetching metadata for ${key}:`, error);
                columns[key] = [];
              }
            }

            const totalTime = Date.now() - startTime;
            console.log(`[dbview] Autocomplete data ready: ${schemas.length} schemas, ${allTables.length} tables, ${Object.keys(columns).length} tables with column metadata (${totalTime}ms)`);

            panel.webview.postMessage({
              type: "AUTOCOMPLETE_DATA",
              schemas,
              tables: allTables,
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
            // Determine SQL dialect based on database type
            const sqlDialect = currentClient.type === 'mysql' ? 'mysql' : 'postgresql';

            const formatted = formatSql(message.sql, {
              language: sqlDialect,
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
            // Use database-specific EXPLAIN syntax
            let explainSQL: string;
            if (currentClient.type === 'mysql') {
              // MySQL uses simpler EXPLAIN syntax
              explainSQL = `EXPLAIN FORMAT=JSON ${message.sql}`;
            } else {
              // PostgreSQL EXPLAIN with detailed options
              explainSQL = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${message.sql}`;
            }

            const result = await currentClient.runQuery(explainSQL);

            // Extract the plan from the result (format varies by database)
            let plan;
            if (currentClient.type === 'mysql') {
              // MySQL returns JSON in 'EXPLAIN' column
              const explainOutput = result.rows[0]['EXPLAIN'];
              plan = typeof explainOutput === 'string' ? JSON.parse(explainOutput) : explainOutput;
            } else {
              // PostgreSQL returns EXPLAIN output in 'QUERY PLAN' column
              const explainOutput = result.rows[0]['QUERY PLAN'];
              plan = Array.isArray(explainOutput) ? explainOutput[0] : explainOutput;
            }

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
                await currentClient.insertRow(schema, table, rows[i]);
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

        // ========== Filter Presets ==========
        case "GET_FILTER_PRESETS": {
          const { schema, table } = message;
          const presetsKey = `dbview.filterPresets.${key}.${schema}.${table}`;
          console.log(`[dbview] Getting filter presets for ${schema}.${table}`);

          try {
            const presets = context.workspaceState.get<any[]>(presetsKey, []);
            panel.webview.postMessage({
              type: "FILTER_PRESETS_LOADED",
              presets
            });
          } catch (error) {
            console.error(`[dbview] Error loading filter presets:`, error);
            panel.webview.postMessage({
              type: "FILTER_PRESET_ERROR",
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "SAVE_FILTER_PRESET": {
          const { schema, table, preset } = message;
          const presetsKey = `dbview.filterPresets.${key}.${schema}.${table}`;
          console.log(`[dbview] Saving filter preset "${preset.name}" for ${schema}.${table}`);

          try {
            const existing = context.workspaceState.get<any[]>(presetsKey, []);

            // Replace if same name exists, otherwise append
            const index = existing.findIndex((p: any) => p.name === preset.name);
            if (index >= 0) {
              existing[index] = preset;
            } else {
              existing.push(preset);
            }

            await context.workspaceState.update(presetsKey, existing);

            panel.webview.postMessage({
              type: "FILTER_PRESET_SAVED",
              preset
            });
          } catch (error) {
            console.error(`[dbview] Error saving filter preset:`, error);
            panel.webview.postMessage({
              type: "FILTER_PRESET_ERROR",
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case "DELETE_FILTER_PRESET": {
          const { schema, table, presetId } = message;
          const presetsKey = `dbview.filterPresets.${key}.${schema}.${table}`;
          console.log(`[dbview] Deleting filter preset ${presetId} for ${schema}.${table}`);

          try {
            const existing = context.workspaceState.get<any[]>(presetsKey, []);
            const updated = existing.filter((p: any) => p.id !== presetId);

            await context.workspaceState.update(presetsKey, updated);

            panel.webview.postMessage({
              type: "FILTER_PRESET_DELETED",
              presetId
            });
          } catch (error) {
            console.error(`[dbview] Error deleting filter preset:`, error);
            panel.webview.postMessage({
              type: "FILTER_PRESET_ERROR",
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
  client: DatabaseAdapter,
  connectionConfig: DatabaseConnectionConfig,
  target: TableIdentifier
): Promise<void> {
  await getOrCreateMainPanel(context, client, connectionConfig);
  const connectionName = connectionConfig.name || ('database' in connectionConfig ? connectionConfig.database : 'unknown');
  const key = getConnectionKey(connectionConfig);

  // Send message to open the table in a new tab (queues if webview not ready)
  sendMessageToPanel(key, {
    type: "OPEN_TABLE",
    schema: target.schema,
    table: target.table,
    limit: 100,
    connectionName,
    dbType: connectionConfig.dbType || 'postgres',
    readOnly: 'readOnly' in connectionConfig ? Boolean(connectionConfig.readOnly) : false
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

  // Send message to open a new query tab (queues if webview not ready)
  // Include dbType to route to the correct query editor (SQL, Document, or Redis)
  sendMessageToPanel(key, {
    type: "OPEN_QUERY_TAB",
    connectionName,
    dbType: connectionConfig.dbType || 'postgres'
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

  // If no schemas provided, get all available schemas using database-agnostic method
  let schemasToVisualize = schemas;
  if (!schemasToVisualize) {
    try {
      schemasToVisualize = await client.listSchemas();
      console.log(`[dbview] Fetched ${schemasToVisualize!.length} schemas for ER diagram`);
    } catch (error) {
      console.error('[dbview] Error fetching schemas:', error);
      // Fallback based on database type
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

  // Send message to open ER diagram (queues if webview not ready)
  sendMessageToPanel(key, {
    type: "OPEN_ER_DIAGRAM",
    schemas: schemasToVisualize
  });
}
