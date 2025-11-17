import * as vscode from "vscode";
import type { ConnectionConfig } from "@dbview/core";
import { PostgresClient } from "./postgresClient";
import { SchemaExplorerProvider, SchemaTreeItem, type TableIdentifier } from "./schemaExplorer";
import { openTablePanel } from "./tablePanel";
import { openSqlRunnerPanel } from "./sqlRunnerPanel";
import {
  getStoredConnection,
  getAllSavedConnections,
  setActiveConnection,
  deleteConnection,
  getActiveConnectionName,
  clearStoredConnection
} from "./connectionSettings";
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
        connection = newConnection;
        vscode.window.showInformationMessage("dbview: Connection updated successfully");
      } else {
        console.log("[dbview] Connection configuration cancelled");
      }
    }
  );

  const addConnectionCommand = vscode.commands.registerCommand(
    "dbview.addConnection",
    async () => {
      console.log("[dbview] Opening connection config for new connection");
      const newConnection = await showConnectionConfigPanel(context, undefined);
      if (newConnection) {
        console.log("[dbview] New connection configured:", JSON.stringify(newConnection, null, 2));
        connection = newConnection;
        client = new PostgresClient(newConnection);
        console.log("[dbview] Client created, updating schema explorer...");
        schemaExplorer.updateClient(client, newConnection);
        console.log("[dbview] Refreshing schema explorer...");
        schemaExplorer.refresh();
        console.log("[dbview] Schema explorer refreshed");
        vscode.window.showInformationMessage(
          newConnection.name
            ? `Connection "${newConnection.name}" added successfully`
            : "Connection added successfully"
        );
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

  const switchConnectionCommand = vscode.commands.registerCommand(
    "dbview.switchConnection",
    async () => {
      const connections = await getAllSavedConnections(context);

      if (connections.length === 0) {
        vscode.window.showInformationMessage(
          "No saved connections found. Please configure a connection first.",
          "Configure Connection"
        ).then(selection => {
          if (selection === "Configure Connection") {
            vscode.commands.executeCommand("dbview.configureConnection");
          }
        });
        return;
      }

      const activeConnectionName = await getActiveConnectionName(context);

      const items = connections.map(conn => ({
        label: conn.name || `${conn.host}:${conn.port}/${conn.database}`,
        description: conn.name ? `${conn.user}@${conn.host}:${conn.port}/${conn.database}` : undefined,
        detail: conn.name === activeConnectionName ? "$(check) Active" : undefined,
        connectionName: conn.name || ""
      }));

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a connection to switch to",
        ignoreFocusOut: true
      });

      if (selection && selection.connectionName) {
        const selectedConnection = await setActiveConnection(context, selection.connectionName);
        if (selectedConnection) {
          client = new PostgresClient(selectedConnection);
          schemaExplorer.updateClient(client, selectedConnection);
          schemaExplorer.refresh();
          connection = selectedConnection;
          vscode.window.showInformationMessage(`Switched to connection: ${selection.label}`);
        }
      }
    }
  );

  const manageConnectionsCommand = vscode.commands.registerCommand(
    "dbview.manageConnections",
    async () => {
      const connections = await getAllSavedConnections(context);

      if (connections.length === 0) {
        vscode.window.showInformationMessage(
          "No saved connections found. Please configure a connection first.",
          "Configure Connection"
        ).then(selection => {
          if (selection === "Configure Connection") {
            vscode.commands.executeCommand("dbview.configureConnection");
          }
        });
        return;
      }

      const activeConnectionName = await getActiveConnectionName(context);

      const items = connections.map(conn => ({
        label: conn.name || `${conn.host}:${conn.port}/${conn.database}`,
        description: conn.name ? `${conn.user}@${conn.host}:${conn.port}/${conn.database}` : undefined,
        detail: conn.name === activeConnectionName ? "$(check) Active" : undefined,
        connectionName: conn.name || ""
      }));

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a connection to manage",
        ignoreFocusOut: true
      });

      if (selection && selection.connectionName) {
        const action = await vscode.window.showQuickPick(
          [
            { label: "$(plug) Switch to this connection", value: "switch" },
            { label: "$(edit) Edit connection", value: "edit" },
            { label: "$(trash) Delete connection", value: "delete" }
          ],
          {
            placeHolder: `Manage connection: ${selection.label}`,
            ignoreFocusOut: true
          }
        );

        if (action) {
          switch (action.value) {
            case "switch":
              const selectedConnection = await setActiveConnection(context, selection.connectionName);
              if (selectedConnection) {
                client = new PostgresClient(selectedConnection);
                schemaExplorer.updateClient(client, selectedConnection);
                schemaExplorer.refresh();
                connection = selectedConnection;
                vscode.window.showInformationMessage(`Switched to connection: ${selection.label}`);
              }
              break;

            case "edit":
              const connToEdit = connections.find(c => c.name === selection.connectionName);
              if (connToEdit) {
                const editedConnection = await showConnectionConfigPanel(context, connToEdit);
                if (editedConnection) {
                  vscode.window.showInformationMessage("Connection updated successfully");

                  // If this was the active connection, update the client
                  if (selection.connectionName === activeConnectionName) {
                    client = new PostgresClient(editedConnection);
                    schemaExplorer.updateClient(client, editedConnection);
                    schemaExplorer.refresh();
                    connection = editedConnection;
                  }
                }
              }
              break;

            case "delete":
              const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the connection "${selection.label}"?`,
                { modal: true },
                "Delete"
              );

              if (confirm === "Delete") {
                await deleteConnection(context, selection.connectionName);
                vscode.window.showInformationMessage(`Connection "${selection.label}" deleted`);

                // If we deleted the active connection, clear the client
                if (selection.connectionName === activeConnectionName) {
                  const remainingConnections = await getAllSavedConnections(context);
                  if (remainingConnections.length > 0) {
                    // Switch to the first available connection
                    const firstConn = remainingConnections[0];
                    if (firstConn.name) {
                      await setActiveConnection(context, firstConn.name);
                      client = new PostgresClient(firstConn);
                      schemaExplorer.updateClient(client, firstConn);
                      schemaExplorer.refresh();
                      connection = firstConn;
                    }
                  } else {
                    // No connections left
                    client = new PostgresClient(undefined);
                    schemaExplorer.updateClient(client, null);
                    schemaExplorer.refresh();
                    connection = null;
                  }
                }
              }
              break;
          }
        }
      }
    }
  );

  const refreshConnectionCommand = vscode.commands.registerCommand(
    "dbview.refreshConnection",
    async (item?: SchemaTreeItem) => {
      if (!connection || !item || item.node.type !== "connection") {
        return;
      }

      schemaExplorer.refresh();
    }
  );

  const editConnectionCommand = vscode.commands.registerCommand(
    "dbview.editConnection",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "connection" || !item.connectionInfo) {
        vscode.window.showWarningMessage("No connection available to edit.");
        return;
      }

      const editedConnection = await showConnectionConfigPanel(context, item.connectionInfo);
      if (!editedConnection) {
        return;
      }

      vscode.window.showInformationMessage("Connection updated successfully");
      client = new PostgresClient(editedConnection);
      schemaExplorer.updateClient(client, editedConnection);
      schemaExplorer.refresh();
      connection = editedConnection;
    }
  );

  const copyConnectionStringCommand = vscode.commands.registerCommand(
    "dbview.copyConnectionString",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "connection" || !item.connectionInfo) {
        vscode.window.showWarningMessage("Connection details unavailable to copy.");
        return;
      }

      let connectionToCopy: ConnectionConfig = item.connectionInfo;

      if (!connectionToCopy.password && connectionToCopy.name) {
        const storedPassword = await context.secrets.get(
          `dbview.connection.${connectionToCopy.name}.password`
        );
        if (storedPassword) {
          connectionToCopy = { ...connectionToCopy, password: storedPassword };
        }
      }

      const connectionString = buildConnectionString(connectionToCopy);
      await vscode.env.clipboard.writeText(connectionString);
      vscode.window.showInformationMessage("Connection string copied to clipboard");
    }
  );

  const deleteConnectionCommand = vscode.commands.registerCommand(
    "dbview.deleteConnection",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "connection" || !item.connectionInfo) {
        vscode.window.showWarningMessage("No connection available to delete.");
        return;
      }

      const connectionName = item.connectionInfo.name;
      const label = item.label ?? item.connectionInfo.database ?? "connection";
      const confirm = await vscode.window.showWarningMessage(
        `Delete connection "${label}"?`,
        { modal: true },
        "Delete"
      );

      if (confirm !== "Delete") {
        return;
      }

      if (connectionName) {
        const activeConnectionName = await getActiveConnectionName(context);
        const deletingActive = activeConnectionName === connectionName;

        await deleteConnection(context, connectionName);
        vscode.window.showInformationMessage(`Connection "${label}" deleted`);

        if (deletingActive) {
          const remainingConnections = await getAllSavedConnections(context);
          if (remainingConnections.length > 0) {
            const nextConnection = remainingConnections[0];
            client = new PostgresClient(nextConnection);
            schemaExplorer.updateClient(client, nextConnection);
            schemaExplorer.refresh();
            connection = nextConnection;
            if (nextConnection.name) {
              await setActiveConnection(context, nextConnection.name);
            }
          } else {
            connection = null;
            client = new PostgresClient(undefined);
            schemaExplorer.updateClient(client, null);
            schemaExplorer.refresh();
          }
        } else {
          schemaExplorer.refresh();
        }
      } else {
        await clearStoredConnection(context);
        connection = null;
        client = new PostgresClient(undefined);
        schemaExplorer.updateClient(client, null);
        schemaExplorer.refresh();
        vscode.window.showInformationMessage(`Connection "${label}" deleted`);
      }
    }
  );

  context.subscriptions.push(
    configureConnectionCommand,
    addConnectionCommand,
    refreshCommand,
    openTableCommand,
    openSqlRunnerCommand,
    switchConnectionCommand,
    manageConnectionsCommand,
    refreshConnectionCommand,
    editConnectionCommand,
    copyConnectionStringCommand,
    deleteConnectionCommand
  );

  console.log("[dbview] Extension activated successfully");
}

export function deactivate(): void {
  // nothing to cleanup yet
}

function buildConnectionString(connection: ConnectionConfig): string {
  const encodedUser = encodeURIComponent(connection.user);
  const encodedPassword = connection.password ? `:${encodeURIComponent(connection.password)}` : "";
  const auth = `${encodedUser}${encodedPassword}@`;
  const host = connection.host;
  const port = connection.port;
  const database = encodeURIComponent(connection.database);
  return `postgresql://${auth}${host}:${port}/${database}`;
}
