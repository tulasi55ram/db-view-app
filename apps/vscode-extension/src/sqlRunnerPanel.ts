import * as vscode from "vscode";
import { PostgresClient } from "./postgresClient";
import { getWebviewHtml } from "./webviewHost";

let sqlRunnerPanel: vscode.WebviewPanel | undefined;

export function openSqlRunnerPanel(
  context: vscode.ExtensionContext,
  client: PostgresClient
): void {
  if (sqlRunnerPanel) {
    sqlRunnerPanel.reveal(vscode.ViewColumn.Active);
    return;
  }

  sqlRunnerPanel = vscode.window.createWebviewPanel(
    "dbview.sqlRunner",
    "DBView: SQL Runner",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media", "webview")]
    }
  );

  sqlRunnerPanel.onDidDispose(() => {
    sqlRunnerPanel = undefined;
  });

  sqlRunnerPanel.webview.html = getWebviewHtml(sqlRunnerPanel.webview, context.extensionUri);
  sqlRunnerPanel.webview.postMessage({ type: "INIT_SQL_RUNNER" });

  sqlRunnerPanel.webview.onDidReceiveMessage(async (message: any) => {
    if (message?.type === "RUN_QUERY" && typeof message.sql === "string") {
      await executeSql(client, message.sql, sqlRunnerPanel!);
    }
  });
}

async function executeSql(
  client: PostgresClient,
  sql: string,
  panel: vscode.WebviewPanel
): Promise<void> {
  try {
    const result = await client.runQuery(sql);
    panel.webview.postMessage({
      type: "QUERY_RESULT",
      columns: result.columns,
      rows: result.rows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    panel.webview.postMessage({ type: "QUERY_ERROR", message });
  }
}
