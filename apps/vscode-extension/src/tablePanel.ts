import * as vscode from "vscode";
import { PostgresClient, type QueryResultSet } from "./postgresClient";
import type { TableIdentifier } from "./schemaExplorer";
import { getWebviewHtml } from "./webviewHost";
import type { SavedView, FilterCondition } from "@dbview/core";

const openPanels = new Map<string, vscode.WebviewPanel>();

export async function openTablePanel(
  context: vscode.ExtensionContext,
  client: PostgresClient,
  target: TableIdentifier
): Promise<void> {
  const key = `${target.schema}.${target.table}`;
  const existing = openPanels.get(key);
  if (existing) {
    console.log(`[dbview] Panel for ${key} already exists, refreshing data...`);
    existing.reveal(vscode.ViewColumn.Active);
    // Re-send the init message to ensure the webview is in the correct state
    existing.webview.postMessage({
      type: "INIT_TABLE_VIEW",
      schema: target.schema,
      table: target.table,
      limit: 100
    });
    // Refresh the data for the existing panel
    await sendTableRows(existing, client, target, { limit: 100, offset: 0 });
    return;
  }

  console.log(`[dbview] Creating new panel for ${key}`);
  const panel = vscode.window.createWebviewPanel(
    "dbview.tableView",
    `DBView: ${target.schema}.${target.table}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media", "webview")],
      enableCommandUris: true
    }
  );

  openPanels.set(key, panel);

  panel.onDidDispose(() => {
    console.log(`[dbview] Panel for ${key} disposed`);
    openPanels.delete(key);
  });

  // Refresh data when the panel becomes visible (tab is clicked)
  panel.onDidChangeViewState((e) => {
    if (e.webviewPanel.visible && e.webviewPanel.active) {
      console.log(`[dbview] Panel for ${key} became active, refreshing data...`);
      // Re-send init and data to ensure correct state
      panel.webview.postMessage({
        type: "INIT_TABLE_VIEW",
        schema: target.schema,
        table: target.table,
        limit: 100
      });
      sendTableRows(panel, client, target, { limit: 100, offset: 0 });
    }
  });

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  panel.webview.postMessage({
    type: "INIT_TABLE_VIEW",
    schema: target.schema,
    table: target.table,
    limit: 100
  });

  await sendTableRows(panel, client, target, { limit: 100, offset: 0 });

  panel.webview.onDidReceiveMessage(async (message: any) => {
    try {
      switch (message?.type) {
        case "LOAD_TABLE_ROWS": {
          const schema = message.schema ?? target.schema;
          const table = message.table ?? target.table;
          const limit = typeof message.limit === "number" ? message.limit : 100;
          const offset = typeof message.offset === "number" ? message.offset : 0;
          const filters = message.filters as FilterCondition[] | undefined;
          const filterLogic = (message.filterLogic as 'AND' | 'OR') ?? 'AND';
          console.log(`[dbview] Loading table rows for ${schema}.${table} (limit: ${limit}, offset: ${offset}, filters: ${filters?.length ?? 0})`);
          await sendTableRows(panel, client, { schema, table }, { limit, offset, filters, filterLogic });
          break;
        }

        case "GET_ROW_COUNT": {
          console.log(`[dbview] Getting row count for ${message.schema}.${message.table}`);
          try {
            const filters = message.filters as FilterCondition[] | undefined;
            const filterLogic = (message.filterLogic as 'AND' | 'OR') ?? 'AND';
            const totalRows = await client.getTableRowCount(message.schema, message.table, { filters, filterLogic });
            panel.webview.postMessage({
              type: "ROW_COUNT",
              totalRows
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Failed to get row count:`, errorMessage);
            panel.webview.postMessage({
              type: "ROW_COUNT_ERROR",
              error: errorMessage
            });
          }
          break;
        }

        case "GET_TABLE_METADATA": {
          console.log(`[dbview] Getting metadata for ${message.schema}.${message.table}`);
          try {
            const metadata = await client.getTableMetadata(message.schema, message.table);
            panel.webview.postMessage({
              type: "TABLE_METADATA",
              columns: metadata,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to get metadata: ${errorMessage}`);
          }
          break;
        }

        case "UPDATE_CELL": {
          console.log(`[dbview] Updating cell in ${message.schema}.${message.table}`);
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
              rowIndex: message.rowIndex
            });
            // Reload table data
            await sendTableRows(panel, client, { schema: message.schema, table: message.table }, { limit: 100, offset: 0 });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            panel.webview.postMessage({
              type: "UPDATE_ERROR",
              error: errorMessage,
              rowIndex: message.rowIndex,
              column: message.column,
            });
            vscode.window.showErrorMessage(`Update failed: ${errorMessage}`);
          }
          break;
        }

        case "INSERT_ROW": {
          console.log(`[dbview] Inserting row into ${message.schema}.${message.table}`);
          try {
            const newRow = await client.insertRow(message.schema, message.table, message.values);
            panel.webview.postMessage({
              type: "INSERT_SUCCESS",
              newRow
            });
            // Reload table data
            await sendTableRows(panel, client, { schema: message.schema, table: message.table }, { limit: 100, offset: 0 });
            vscode.window.showInformationMessage('Row inserted successfully');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            panel.webview.postMessage({
              type: "INSERT_ERROR",
              error: errorMessage
            });
            vscode.window.showErrorMessage(`Insert failed: ${errorMessage}`);
          }
          break;
        }

        case "DELETE_ROWS": {
          console.log(`[dbview] Deleting ${message.primaryKeys.length} row(s) from ${message.schema}.${message.table}`);
          try {
            const count = await client.deleteRows(message.schema, message.table, message.primaryKeys);
            panel.webview.postMessage({
              type: "DELETE_SUCCESS",
              deletedCount: count
            });
            // Reload table data
            await sendTableRows(panel, client, { schema: message.schema, table: message.table }, { limit: 100, offset: 0 });
            vscode.window.showInformationMessage(`${count} row(s) deleted successfully`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            panel.webview.postMessage({
              type: "DELETE_ERROR",
              error: errorMessage
            });
            vscode.window.showErrorMessage(`Delete failed: ${errorMessage}`);
          }
          break;
        }

        case "COMMIT_CHANGES": {
          console.log(`[dbview] Committing ${message.edits.length} change(s) to ${message.schema}.${message.table}`);
          try {
            let successCount = 0;
            for (const edit of message.edits) {
              await client.updateCell(
                message.schema,
                message.table,
                edit.primaryKey,
                edit.columnKey,
                edit.newValue
              );
              successCount++;
            }
            panel.webview.postMessage({
              type: "COMMIT_SUCCESS",
              successCount
            });
            // Reload table data
            await sendTableRows(panel, client, { schema: message.schema, table: message.table }, { limit: 100, offset: 0 });
            vscode.window.showInformationMessage(`${successCount} change(s) committed successfully`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            panel.webview.postMessage({
              type: "COMMIT_ERROR",
              error: errorMessage
            });
            vscode.window.showErrorMessage(`Commit failed: ${errorMessage}`);
          }
          break;
        }

        case "SAVE_VIEW": {
          console.log(`[dbview] Saving view "${message.view.name}" for ${message.view.schema}.${message.view.table}`);
          try {
            const view = message.view as SavedView;
            const key = `dbview.views.${view.schema}.${view.table}`;
            const views = context.workspaceState.get<SavedView[]>(key, []);

            // If setting as default, unset other defaults
            if (view.isDefault) {
              views.forEach(v => v.isDefault = false);
            }

            const existingIndex = views.findIndex(v => v.id === view.id);
            if (existingIndex >= 0) {
              views[existingIndex] = view;
            } else {
              views.push(view);
            }

            await context.workspaceState.update(key, views);
            panel.webview.postMessage({ type: "VIEW_SAVED", view });
            vscode.window.showInformationMessage(`View "${view.name}" saved successfully`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Failed to save view:`, errorMessage);
            vscode.window.showErrorMessage(`Failed to save view: ${errorMessage}`);
          }
          break;
        }

        case "LOAD_VIEWS": {
          console.log(`[dbview] Loading views for ${message.schema}.${message.table}`);
          try {
            const key = `dbview.views.${message.schema}.${message.table}`;
            const views = context.workspaceState.get<SavedView[]>(key, []);
            panel.webview.postMessage({ type: "VIEWS_LOADED", views });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Failed to load views:`, errorMessage);
            panel.webview.postMessage({ type: "VIEWS_LOADED", views: [] });
          }
          break;
        }

        case "DELETE_VIEW": {
          console.log(`[dbview] Deleting view ${message.viewId} from ${message.schema}.${message.table}`);
          try {
            const key = `dbview.views.${message.schema}.${message.table}`;
            const views = context.workspaceState.get<SavedView[]>(key, []);
            const filtered = views.filter(v => v.id !== message.viewId);
            await context.workspaceState.update(key, filtered);
            panel.webview.postMessage({ type: "VIEW_DELETED", viewId: message.viewId });
            vscode.window.showInformationMessage('View deleted successfully');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Failed to delete view:`, errorMessage);
            vscode.window.showErrorMessage(`Failed to delete view: ${errorMessage}`);
          }
          break;
        }

        case "EXPORT_VIEW": {
          console.log(`[dbview] Exporting view "${message.view.name}"`);
          try {
            const view = message.view as SavedView;
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(`${view.table}-${view.name}.view.json`),
              filters: { 'View Files': ['json'] }
            });

            if (uri) {
              await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(JSON.stringify(view, null, 2))
              );
              vscode.window.showInformationMessage(`View exported to ${uri.fsPath}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Failed to export view:`, errorMessage);
            vscode.window.showErrorMessage(`Failed to export view: ${errorMessage}`);
          }
          break;
        }

        case "IMPORT_VIEW": {
          console.log(`[dbview] Importing view`);
          try {
            const uris = await vscode.window.showOpenDialog({
              filters: { 'View Files': ['json'] },
              canSelectMany: false
            });

            if (uris && uris[0]) {
              const content = await vscode.workspace.fs.readFile(uris[0]);
              const view = JSON.parse(content.toString()) as SavedView;
              panel.webview.postMessage({ type: "VIEW_IMPORTED", view });
              vscode.window.showInformationMessage(`View "${view.name}" imported successfully`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Failed to import view:`, errorMessage);
            vscode.window.showErrorMessage(`Failed to import view: ${errorMessage}`);
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
              await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(content, 'utf-8')
              );
              console.log(`[dbview] Export successful: ${uri.fsPath}`);
              vscode.window.showInformationMessage(`Data exported to ${uri.fsPath}`);
              panel.webview.postMessage({ type: "EXPORT_DATA_SUCCESS", filePath: uri.fsPath });
            } else {
              // User cancelled the save dialog
              console.log(`[dbview] Export cancelled by user`);
              panel.webview.postMessage({ type: "EXPORT_DATA_CANCELLED" });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Export failed:`, errorMessage);
            vscode.window.showErrorMessage(`Export failed: ${errorMessage}`);
            panel.webview.postMessage({ type: "EXPORT_DATA_ERROR", error: errorMessage });
          }
          break;
        }

        case "IMPORT_DATA": {
          console.log(`[dbview] Importing ${message.rows.length} rows into ${message.schema}.${message.table}`);
          try {
            let successCount = 0;
            const errors: string[] = [];

            for (let i = 0; i < message.rows.length; i++) {
              try {
                await client.insertRow(message.schema, message.table, message.rows[i]);
                successCount++;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Row ${i + 1}: ${errorMsg}`);

                // Stop after 10 errors to avoid flooding
                if (errors.length >= 10) {
                  errors.push(`... and ${message.rows.length - i - 1} more rows failed`);
                  break;
                }
              }
            }

            if (errors.length > 0) {
              panel.webview.postMessage({
                type: "IMPORT_DATA_ERROR",
                insertedCount: successCount,
                errors
              });
              vscode.window.showWarningMessage(
                `Import completed with errors: ${successCount}/${message.rows.length} rows inserted`
              );
            } else {
              panel.webview.postMessage({
                type: "IMPORT_DATA_SUCCESS",
                insertedCount: successCount
              });
              vscode.window.showInformationMessage(`${successCount} rows imported successfully`);
            }

            // Refresh table data
            await sendTableRows(panel, client, { schema: message.schema, table: message.table }, { limit: 100, offset: 0 });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[dbview] Import failed:`, errorMessage);
            vscode.window.showErrorMessage(`Import failed: ${errorMessage}`);
            panel.webview.postMessage({ type: "IMPORT_DATA_ERROR", error: errorMessage });
          }
          break;
        }

        default:
          console.log(`[dbview] Unknown message type: ${message?.type}`);
      }
    } catch (error) {
      console.error(`[dbview] Error handling message:`, error);
    }
  });
}

async function sendTableRows(
  panel: vscode.WebviewPanel,
  client: PostgresClient,
  target: TableIdentifier,
  options: {
    limit: number;
    offset: number;
    filters?: FilterCondition[];
    filterLogic?: 'AND' | 'OR';
  }
): Promise<void> {
  try {
    console.log(`[dbview] Fetching ${options.limit} rows from ${target.schema}.${target.table} (offset: ${options.offset}, filters: ${options.filters?.length ?? 0})`);
    const result = await client.fetchTableRows(target.schema, target.table, options);
    console.log(`[dbview] Fetched ${result.rows.length} rows with ${result.columns.length} columns`);
    postTableRows(panel, target, result, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[dbview] Failed to load ${target.schema}.${target.table}:`, errorMessage);
    vscode.window.showErrorMessage(`Failed to load ${target.schema}.${target.table}: ${errorMessage}`);
    postTableRows(panel, target, { columns: [], rows: [] }, options);
  }
}

function postTableRows(
  panel: vscode.WebviewPanel,
  target: TableIdentifier,
  result: QueryResultSet,
  options: {
    limit: number;
    offset: number;
    filters?: FilterCondition[];
    filterLogic?: 'AND' | 'OR';
  }
): void {
  console.log(`[dbview] Posting ${result.rows.length} rows to webview for ${target.schema}.${target.table}`);
  panel.webview.postMessage({
    type: "LOAD_TABLE_ROWS",
    schema: target.schema,
    table: target.table,
    columns: result.columns,
    rows: result.rows,
    limit: options.limit,
    offset: options.offset,
    filters: options.filters,
    filterLogic: options.filterLogic
  });
}
