import * as vscode from "vscode";
import { PostgresClient } from "./postgresClient";
import { SchemaExplorerProvider, type TableIdentifier } from "./schemaExplorer";
import { openTablePanel } from "./tablePanel";
import { openSqlRunnerPanel } from "./sqlRunnerPanel";
import { getStoredConnection } from "./connectionSettings";
import { showConnectionConfigPanel } from "./connectionConfigPanel";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("[dbview] Extension activating...");

  let connection = await getStoredConnection(context);
  console.log("[dbview] Stored connection:", connection ? `${connection.host}:${connection.port}/${connection.database}` : "none");

  let client = new PostgresClient(connection ?? undefined);
  const schemaExplorer = new SchemaExplorerProvider(client, connection, context);

  console.log("[dbview] Registering tree data provider...");

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("dbview.dbExplorer", schemaExplorer)
  );

  const configureConnectionCommand = vscode.commands.registerCommand(
    "dbview.configureConnection",
    async () => {
      const currentConnection = await getStoredConnection(context);
      console.log("[dbview] Opening connection config with defaults:", currentConnection);
      const newConnection = await showConnectionConfigPanel(context, currentConnection ?? undefined);
      if (newConnection) {
        console.log("[dbview] New connection configured:", newConnection);
        client = new PostgresClient(newConnection);
        schemaExplorer.updateClient(client, newConnection);
        schemaExplorer.refresh();
        vscode.window.showInformationMessage("dbview: Connection updated successfully");
      } else {
        console.log("[dbview] Connection configuration cancelled");
      }
    }
  );

  const refreshCommand = vscode.commands.registerCommand("dbview.refreshExplorer", () =>
    schemaExplorer.refresh()
  );

  const openTableCommand = vscode.commands.registerCommand(
    "dbview.openTable",
    async (target?: TableIdentifier) => {
      const selection = target ?? { schema: "public", table: "users" };
      await openTablePanel(context, client, selection);
    }
  );

  const openSqlRunnerCommand = vscode.commands.registerCommand("dbview.openSqlRunner", () =>
    openSqlRunnerPanel(context, client)
  );

  context.subscriptions.push(
    configureConnectionCommand,
    refreshCommand,
    openTableCommand,
    openSqlRunnerCommand
  );

  console.log("[dbview] Extension activated successfully");
}

export function deactivate(): void {
  // nothing to cleanup yet
}
