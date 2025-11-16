import * as vscode from "vscode";
import { PostgresClient, type QueryResultSet } from "./postgresClient";
import type { TableIdentifier } from "./schemaExplorer";
import { getWebviewHtml } from "./webviewHost";

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
    await sendTableRows(existing, client, target, 100);
    return;
  }

  console.log(`[dbview] Creating new panel for ${key}`);
  const panel = vscode.window.createWebviewPanel(
    "dbview.tableView",
    `DBView: ${target.schema}.${target.table}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media", "webview")]
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
      sendTableRows(panel, client, target, 100);
    }
  });

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  panel.webview.postMessage({
    type: "INIT_TABLE_VIEW",
    schema: target.schema,
    table: target.table,
    limit: 100
  });

  await sendTableRows(panel, client, target, 100);

  panel.webview.onDidReceiveMessage(async (message: any) => {
    if (message?.type === "LOAD_TABLE_ROWS") {
      const schema = message.schema ?? target.schema;
      const table = message.table ?? target.table;
      const limit = typeof message.limit === "number" ? message.limit : 100;
      console.log(`[dbview] Loading table rows for ${schema}.${table} with limit ${limit}`);
      await sendTableRows(panel, client, { schema, table }, limit);
    }
  });
}

async function sendTableRows(
  panel: vscode.WebviewPanel,
  client: PostgresClient,
  target: TableIdentifier,
  limit: number
): Promise<void> {
  try {
    console.log(`[dbview] Fetching ${limit} rows from ${target.schema}.${target.table}`);
    const result = await client.fetchTableRows(target.schema, target.table, limit);
    console.log(`[dbview] Fetched ${result.rows.length} rows with ${result.columns.length} columns`);
    postTableRows(panel, target, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[dbview] Failed to load ${target.schema}.${target.table}:`, errorMessage);
    vscode.window.showErrorMessage(`Failed to load ${target.schema}.${target.table}: ${errorMessage}`);
    postTableRows(panel, target, { columns: [], rows: [] });
  }
}

function postTableRows(
  panel: vscode.WebviewPanel,
  target: TableIdentifier,
  result: QueryResultSet
): void {
  console.log(`[dbview] Posting ${result.rows.length} rows to webview for ${target.schema}.${target.table}`);
  panel.webview.postMessage({
    type: "LOAD_TABLE_ROWS",
    schema: target.schema,
    table: target.table,
    columns: result.columns,
    rows: result.rows
  });
}
