import * as vscode from "vscode";
import type { DatabaseConnectionConfig } from "@dbview/types";
import type { DatabaseAdapter } from "@dbview/adapters";
import { DatabaseAdapterFactory } from "@dbview/adapters";
import { SchemaExplorerProvider, SchemaTreeItem, type TableIdentifier } from "./schemaExplorer";
import { openTableInPanel, openQueryInPanel, openERDiagramInPanel, updateWebviewTheme } from "./mainPanel";
import {
  getStoredConnection,
  getAllSavedConnections,
  setActiveConnection,
  deleteConnection,
  updateConnection,
  getActiveConnectionName,
  clearStoredConnection,
  isPasswordSaved,
  clearPassword,
  clearAllPasswords,
  getConnectionSecurityInfo
} from "./connectionSettings";
import { showConnectionConfigPanel } from "./connectionConfigPanel";

// Module-level reference for cleanup on deactivate
let schemaExplorerInstance: SchemaExplorerProvider | null = null;

/**
 * Migrate existing connections to multi-database format
 * Adds dbType: 'postgres' to legacy connections
 */
async function migrateConnectionsToMultiDB(context: vscode.ExtensionContext): Promise<void> {
  const migrationVersion = context.globalState.get('dbview.migrationVersion');
  if (migrationVersion === '2.0.0') {
    return;
  }

  console.log("[dbview] Running multi-database migration...");

  const connections = await getAllSavedConnections(context);
  let migratedCount = 0;

  for (const conn of connections) {
    if (!('dbType' in conn)) {
      // Add dbType: 'postgres' to legacy connections
      const migratedConn: DatabaseConnectionConfig = {
        ...(conn as any),
        dbType: 'postgres' as const
      } as DatabaseConnectionConfig;

      if ((conn as any).name) {
        await updateConnection(context, (conn as any).name, migratedConn);
        migratedCount++;
      }
    }
  }

  await context.globalState.update('dbview.migrationVersion', '2.0.0');

  if (migratedCount > 0) {
    console.log(`[dbview] Migration complete: ${migratedCount} connection(s) updated for multi-database support`);
  } else {
    console.log("[dbview] Migration complete: No connections needed migration");
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("[dbview] Extension activating...");

  // Run migration for multi-database support
  await migrateConnectionsToMultiDB(context);

  let connection = await getStoredConnection(context);
  const connStr = connection && 'host' in connection && 'port' in connection && 'database' in connection
    ? `${connection.host}:${connection.port}/${connection.database}`
    : connection?.name || 'unknown';
  console.log("[dbview] Stored connection:", connection ? connStr : "none");

  // Create client using adapter factory
  let client: DatabaseAdapter | undefined;
  if (connection) {
    const connectionConfig: DatabaseConnectionConfig = 'dbType' in connection
      ? connection as DatabaseConnectionConfig
      : { ...(connection as any), dbType: 'postgres' as const } as DatabaseConnectionConfig;
    client = DatabaseAdapterFactory.create(connectionConfig);
  }

  const schemaExplorer = new SchemaExplorerProvider(client, connection, context);
  schemaExplorerInstance = schemaExplorer; // Store for cleanup on deactivate

  // Start health check if there's an initial connection
  if (connection && client) {
    // Do an initial ping to set connection status
    client.ping().then((isAlive: boolean) => {
      if (isAlive && client) {
        client.startHealthCheck();
        console.log("[dbview] Initial connection verified, health check started");
      } else {
        console.log("[dbview] Initial connection failed, will show status in sidebar");
      }
      // Force refresh after ping to update status indicator
      console.log("[dbview] Refreshing tree after initial ping, status:", client?.status);
      schemaExplorer.refresh();
      // Enable error notifications after initial setup
      schemaExplorer.enableErrorNotifications();
    }).catch((err: Error) => {
      console.error("[dbview] Initial ping failed:", err);
      schemaExplorer.refresh();
      // Enable error notifications even if ping fails
      schemaExplorer.enableErrorNotifications();
    });
  } else {
    // No initial connection, enable error notifications immediately
    schemaExplorer.enableErrorNotifications();
  }

  // Helper to safely switch to a new client
  async function switchClient(newConnection: DatabaseConnectionConfig | null): Promise<void> {
    console.log("[dbview] Switching client, disconnecting old pool...");
    if (client) {
      await client.disconnect();
    }

    if (newConnection) {
      client = DatabaseAdapterFactory.create(newConnection);

      // Connect to the database (required for MySQL and other non-pooled adapters)
      try {
        await client.connect();
        console.log("[dbview] Client connected successfully");

        // Start health check
        const isAlive = await client.ping();
        if (isAlive) {
          client.startHealthCheck();
          console.log("[dbview] Health check started");
        }
      } catch (error) {
        console.error("[dbview] Failed to connect client:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to connect to database: ${errorMessage}`);
      }
    } else {
      client = undefined;
    }

    schemaExplorer.updateClient(client, newConnection);
    schemaExplorer.refresh();
    connection = newConnection;
  }

  console.log("[dbview] Registering tree view...");

  // Use createTreeView instead of registerTreeDataProvider to get access to visibility events
  const treeView = vscode.window.createTreeView("dbview.dbExplorer", {
    treeDataProvider: schemaExplorer,
    showCollapseAll: true
  });

  // Track if we've already shown the connection panel on first view
  let hasShownInitialConnectionPanel = false;

  // Function to check and show connection panel if no connections exist
  const checkAndShowConnectionPanel = async () => {
    if (hasShownInitialConnectionPanel) {
      return;
    }
    const connections = await getAllSavedConnections(context);
    console.log("[dbview] Checking connections, found:", connections.length);
    if (connections.length === 0) {
      hasShownInitialConnectionPanel = true;
      console.log("[dbview] No connections found, showing connection config panel");
      vscode.commands.executeCommand("dbview.configureConnection");
    }
  };

  // Show connection panel by default when extension sidebar is opened with no connections
  treeView.onDidChangeVisibility(async (e) => {
    console.log("[dbview] Tree view visibility changed:", e.visible);
    if (e.visible) {
      await checkAndShowConnectionPanel();
    }
  });

  // Also check immediately if the view is already visible (handles the case when extension activates with view open)
  if (treeView.visible) {
    console.log("[dbview] Tree view is already visible on activation");
    checkAndShowConnectionPanel();
  }

  context.subscriptions.push(treeView);

  const configureConnectionCommand = vscode.commands.registerCommand(
    "dbview.configureConnection",
    async () => {
      const currentConnection = await getStoredConnection(context);
      console.log("[dbview] Opening connection config with defaults:", currentConnection);
      const newConnection = await showConnectionConfigPanel(context, currentConnection ?? undefined);
      if (newConnection) {
        console.log("[dbview] New connection configured:", newConnection);
        await switchClient(newConnection);
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
        await switchClient(newConnection);
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
    async (target?: TableIdentifier | SchemaTreeItem) => {
      console.log(`[dbview] ========== openTable COMMAND CALLED ==========`);
      console.log(`[dbview] target type:`, target ? (('node' in target) ? 'SchemaTreeItem' : 'TableIdentifier') : 'undefined');

      // Handle both TableIdentifier (from tree item command) and SchemaTreeItem (from context menu)
      let selection: TableIdentifier;
      let conn: DatabaseConnectionConfig | null = null;
      let targetClient: DatabaseAdapter | undefined = undefined;

      if (target && 'node' in target) {
        // It's a SchemaTreeItem from context menu
        const treeItem = target as SchemaTreeItem;
        console.log(`[dbview] Tree item node type: ${treeItem.node.type}`);

        if (treeItem.node.type === 'table') {
          selection = { schema: treeItem.node.schema, table: treeItem.node.table };
          // Get connection from tree item
          conn = treeItem.connectionInfo ?? null;
          console.log(`[dbview] openTable: Connection from tree item - ${formatConnectionDisplay(conn || ({dbType: 'postgres'} as any))}`);

          if (conn) {
            targetClient = await schemaExplorer.getOrCreateClient(conn);
          }
        } else {
          // Fallback if wrong node type
          vscode.window.showWarningMessage('Please select a table to open.');
          return;
        }
      } else if (target && 'schema' in target && 'table' in target) {
        // It's a TableIdentifier
        selection = target as TableIdentifier;
        conn = connection;
        targetClient = client;
        console.log(`[dbview] openTable: Using global connection - ${conn ? formatConnectionDisplay(conn) : 'none'}`);
      } else {
        // No target provided, use default
        selection = { schema: "public", table: "users" };
        conn = connection;
        targetClient = client;
        console.log(`[dbview] openTable: Using default connection - ${conn ? formatConnectionDisplay(conn) : 'none'}`);
      }

      if (!conn || !targetClient) {
        vscode.window.showWarningMessage('No connection available to open table');
        return;
      }

      const connKey = conn.name || formatConnectionDetailedDisplay(conn);
      console.log(`[dbview] openTable: Opening ${selection.schema}.${selection.table} for connection "${formatConnectionDisplay(conn)}"`);
      console.log(`[dbview] openTable: Connection key will be: "${connKey}"`);

      await openTableInPanel(context, targetClient, conn, selection);
      console.log(`[dbview] ========== openTable COMMAND FINISHED ==========`);
    }
  );

  const openSqlRunnerCommand = vscode.commands.registerCommand("dbview.openSqlRunner", () => {
    if (!connection || !client) {
      vscode.window.showWarningMessage('No connection available');
      return;
    }
    return openQueryInPanel(context, client, connection);
  });

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
        label: formatConnectionDisplay(conn),
        description: conn.name ? formatConnectionDetailedDisplay(conn) : undefined,
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
          await switchClient(selectedConnection);
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
        label: formatConnectionDisplay(conn),
        description: conn.name ? formatConnectionDetailedDisplay(conn) : undefined,
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
                await switchClient(selectedConnection);
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
                    await switchClient(editedConnection);
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
                      await switchClient(firstConn);
                    }
                  } else {
                    // No connections left
                    await switchClient(null);
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
      // Works with or without tree item - just refresh the explorer
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

      const originalName = item.connectionInfo.name;
      // Skip save in panel - we'll handle it with updateConnection to properly handle name changes
      const editedConnection = await showConnectionConfigPanel(context, item.connectionInfo, { skipSave: true });
      if (!editedConnection) {
        return;
      }

      // Use updateConnection to properly handle name changes
      if (originalName && editedConnection.name) {
        await updateConnection(context, originalName, editedConnection);

        // If name changed, invalidate the old cached client
        if (originalName !== editedConnection.name) {
          schemaExplorer.invalidateClient(item.connectionInfo);
        }
      }

      // Always invalidate current client to force reconnect with new settings
      schemaExplorer.invalidateClient(editedConnection);

      vscode.window.showInformationMessage("Connection updated successfully");
      schemaExplorer.refresh();
    }
  );

  const copyConnectionStringCommand = vscode.commands.registerCommand(
    "dbview.copyConnectionString",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "connection" || !item.connectionInfo) {
        vscode.window.showWarningMessage("Connection details unavailable to copy.");
        return;
      }

      let connectionToCopy: DatabaseConnectionConfig = item.connectionInfo;

      // Add password if not present and it's saved (only for password-based databases)
      if ('password' in connectionToCopy && !connectionToCopy.password && connectionToCopy.name) {
        const storedPassword = await context.secrets.get(
          `dbview.connection.${connectionToCopy.name}.password`
        );
        if (storedPassword) {
          connectionToCopy = { ...(connectionToCopy as any), password: storedPassword } as DatabaseConnectionConfig;
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
      const label = item.label ?? formatConnectionDisplay(item.connectionInfo);
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
            if (nextConnection.name) {
              await setActiveConnection(context, nextConnection.name);
            }
            await switchClient(nextConnection);
          } else {
            await switchClient(null);
          }
        } else {
          schemaExplorer.refresh();
        }
      } else {
        await clearStoredConnection(context);
        await switchClient(null);
        vscode.window.showInformationMessage(`Connection "${label}" deleted`);
      }
    }
  );

  const openDocsCommand = vscode.commands.registerCommand(
    "dbview.openDocs",
    () => {
      vscode.env.openExternal(vscode.Uri.parse("https://github.com/your-repo/dbview"));
    }
  );

  const copyTableNameCommand = vscode.commands.registerCommand(
    "dbview.copyTableName",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "table") {
        return;
      }
      const tableName = item.node.table;
      await vscode.env.clipboard.writeText(tableName);
      vscode.window.showInformationMessage(`Copied: ${tableName}`);
    }
  );

  const copySchemaTableNameCommand = vscode.commands.registerCommand(
    "dbview.copySchemaTableName",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "table") {
        return;
      }
      const fullName = `${item.node.schema}.${item.node.table}`;
      await vscode.env.clipboard.writeText(fullName);
      vscode.window.showInformationMessage(`Copied: ${fullName}`);
    }
  );

  const generateSelectCommand = vscode.commands.registerCommand(
    "dbview.generateSelect",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "table") {
        return;
      }
      const query = `SELECT * FROM ${item.node.schema}.${item.node.table} LIMIT 100;`;
      await vscode.env.clipboard.writeText(query);
      vscode.window.showInformationMessage("SELECT query copied to clipboard");
    }
  );

  const refreshTableCountCommand = vscode.commands.registerCommand(
    "dbview.refreshTableCount",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "table" || !item.connectionInfo) {
        return;
      }

      const tableNode = item.node;
      const client = schemaExplorer.getClientForConnection(item.connectionInfo);
      if (!client) {
        vscode.window.showWarningMessage("No active database connection");
        return;
      }

      if (!client.getActualRowCount) {
        vscode.window.showWarningMessage("Actual row count not supported for this database type");
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Counting rows in ${tableNode.table}...`,
            cancellable: false
          },
          async () => {
            const actualCount = await client.getActualRowCount!(
              tableNode.schema,
              tableNode.table
            );

            // Update the tree item's cached row count
            tableNode.rowCount = actualCount;

            // Refresh the tree view
            schemaExplorer.refresh();

            vscode.window.showInformationMessage(
              `${tableNode.table}: ${actualCount.toLocaleString()} rows`
            );
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to count rows: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  const copyColumnNameCommand = vscode.commands.registerCommand(
    "dbview.copyColumnName",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "column") {
        return;
      }
      await vscode.env.clipboard.writeText(item.node.name);
      vscode.window.showInformationMessage(`Copied: ${item.node.name}`);
    }
  );

  const copyColumnDefinitionCommand = vscode.commands.registerCommand(
    "dbview.copyColumnDefinition",
    async (item?: SchemaTreeItem) => {
      if (!item || item.node.type !== "column") {
        return;
      }
      const node = item.node;
      const nullable = node.isNullable ? "NULL" : "NOT NULL";
      const definition = `${node.name} ${node.dataType.toUpperCase()} ${nullable}`;
      await vscode.env.clipboard.writeText(definition);
      vscode.window.showInformationMessage(`Copied: ${definition}`);
    }
  );

  const showDatabaseInfoCommand = vscode.commands.registerCommand(
    "dbview.showDatabaseInfo",
    async () => {
      if (!connection || !client) {
        vscode.window.showWarningMessage("No active database connection");
        return;
      }
      try {
        const info = await client.getDatabaseInfo();
        const message = `
**Database: ${info.databaseName}**

📊 **Statistics**
• Size: ${info.size}
• Tables: ${info.tableCount}
• Schemas: ${info.schemaCount}

🔌 **Connections**
• Active: ${info.activeConnections}
• Max: ${info.maxConnections}

⏱️ **Server**
• Uptime: ${info.uptime}
• Encoding: ${info.encoding}

📋 **Version**
${info.version.split(',')[0]}
        `.trim();

        const panel = vscode.window.createWebviewPanel(
          'dbviewDatabaseInfo',
          `Database Info: ${info.databaseName}`,
          vscode.ViewColumn.One,
          {}
        );
        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h1 { font-size: 1.5em; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; margin-bottom: 8px; color: var(--vscode-textLink-foreground); }
    .stat { margin: 4px 0; padding: 4px 8px; background: var(--vscode-input-background); border-radius: 4px; }
    .stat-label { opacity: 0.8; }
    .stat-value { font-weight: bold; }
    .version { font-family: monospace; font-size: 0.9em; padding: 8px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; }
  </style>
</head>
<body>
  <h1>🗄️ ${info.databaseName}</h1>

  <div class="section">
    <div class="section-title">📊 Statistics</div>
    <div class="stat"><span class="stat-label">Size:</span> <span class="stat-value">${info.size}</span></div>
    <div class="stat"><span class="stat-label">Tables:</span> <span class="stat-value">${info.tableCount}</span></div>
    <div class="stat"><span class="stat-label">Schemas:</span> <span class="stat-value">${info.schemaCount}</span></div>
  </div>

  <div class="section">
    <div class="section-title">🔌 Connections</div>
    <div class="stat"><span class="stat-label">Active:</span> <span class="stat-value">${info.activeConnections}</span></div>
    <div class="stat"><span class="stat-label">Max:</span> <span class="stat-value">${info.maxConnections}</span></div>
  </div>

  <div class="section">
    <div class="section-title">⏱️ Server</div>
    <div class="stat"><span class="stat-label">Uptime:</span> <span class="stat-value">${info.uptime}</span></div>
    <div class="stat"><span class="stat-label">Encoding:</span> <span class="stat-value">${info.encoding}</span></div>
  </div>

  <div class="section">
    <div class="section-title">📋 PostgreSQL Version</div>
    <div class="version">${info.version.split(',')[0]}</div>
  </div>
</body>
</html>`;
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to get database info: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  const showRunningQueriesCommand = vscode.commands.registerCommand(
    "dbview.showRunningQueries",
    async () => {
      if (!connection || !client) {
        vscode.window.showWarningMessage("No active database connection");
        return;
      }
      if (!client.getRunningQueries) {
        vscode.window.showWarningMessage("Running queries not supported for this database");
        return;
      }
      try {
        const queries = await client.getRunningQueries();
        if (queries.length === 0) {
          vscode.window.showInformationMessage("No active queries found");
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          'dbviewRunningQueries',
          'Active Queries',
          vscode.ViewColumn.One,
          {}
        );

        const queryRows = queries.map(q => `
          <tr>
            <td>${q.pid}</td>
            <td>${q.user}</td>
            <td><span class="state state-${q.state}">${q.state}</span></td>
            <td>${q.duration}</td>
            <td class="query">${q.query.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>
        `).join('');

        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h1 { font-size: 1.5em; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid var(--vscode-widget-border); }
    th { background: var(--vscode-input-background); font-weight: 600; }
    .query { font-family: monospace; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .state { padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; }
    .state-active { background: #22c55e33; color: #22c55e; }
    .state-idle { background: #94a3b833; color: #94a3b8; }
    .count { color: var(--vscode-descriptionForeground); margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>⚡ Active Queries</h1>
  <div class="count">${queries.length} connection(s)</div>
  <table>
    <thead>
      <tr><th>PID</th><th>User</th><th>State</th><th>Duration</th><th>Query</th></tr>
    </thead>
    <tbody>${queryRows}</tbody>
  </table>
</body>
</html>`;
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to get running queries: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  const copyDatabaseNameCommand = vscode.commands.registerCommand(
    "dbview.copyDatabaseName",
    async (item?: SchemaTreeItem) => {
      const conn = item?.connectionInfo ?? connection;
      if (!conn) {
        vscode.window.showWarningMessage("No connection available");
        return;
      }
      if ('database' in conn && conn.database !== undefined) {
        await vscode.env.clipboard.writeText(String(conn.database));
        vscode.window.showInformationMessage(`Copied: ${conn.database}`);
      } else {
        vscode.window.showWarningMessage("Database name not available for this connection type");
      }
    }
  );

  const copyHostPortCommand = vscode.commands.registerCommand(
    "dbview.copyHostPort",
    async (item?: SchemaTreeItem) => {
      const conn = item?.connectionInfo ?? connection;
      if (!conn) {
        vscode.window.showWarningMessage("No connection available");
        return;
      }
      if ('host' in conn && 'port' in conn) {
        const hostPort = `${conn.host}:${conn.port}`;
        await vscode.env.clipboard.writeText(hostPort);
        vscode.window.showInformationMessage(`Copied: ${hostPort}`);
      } else {
        vscode.window.showWarningMessage("Host/port not available for this connection type");
      }
    }
  );

  const disconnectConnectionCommand = vscode.commands.registerCommand(
    "dbview.disconnectConnection",
    async (item?: SchemaTreeItem) => {
      // Get connection from tree item or use global connection
      const conn = item?.connectionInfo ?? connection;
      if (!conn) {
        vscode.window.showWarningMessage("No connection to disconnect");
        return;
      }

      await schemaExplorer.disconnectConnection(conn);
      vscode.window.showInformationMessage(`Disconnected from ${formatConnectionDisplay(conn)}`);
    }
  );

  const reconnectConnectionCommand = vscode.commands.registerCommand(
    "dbview.reconnectConnection",
    async (item?: SchemaTreeItem) => {
      // Get connection from tree item or use global connection
      const conn = item?.connectionInfo ?? connection;
      if (!conn) {
        vscode.window.showWarningMessage("No connection to reconnect");
        return;
      }

      vscode.window.showInformationMessage(`Reconnecting to ${formatConnectionDisplay(conn)}...`);

      const success = await schemaExplorer.reconnectConnection(conn);
      if (success) {
        vscode.window.showInformationMessage(`Reconnected to ${formatConnectionDisplay(conn)} successfully`);
      } else {
        vscode.window.showErrorMessage(`Failed to reconnect to ${formatConnectionDisplay(conn)}`);
      }
    }
  );

  const newQueryFromConnectionCommand = vscode.commands.registerCommand(
    "dbview.newQueryFromConnection",
    async (item?: SchemaTreeItem) => {
      // Get connection from tree item or use global connection
      const conn = item?.connectionInfo ?? connection;
      if (!conn) {
        vscode.window.showWarningMessage('No connection available');
        return;
      }

      // Get the appropriate client
      const targetClient = item?.connectionInfo
        ? await schemaExplorer.getOrCreateClient(item.connectionInfo)
        : client;

      if (!targetClient) {
        vscode.window.showWarningMessage('No client available');
        return;
      }

      await openQueryInPanel(context, targetClient, conn);
    }
  );

  const openERDiagramCommand = vscode.commands.registerCommand(
    "dbview.openERDiagram",
    async (item?: SchemaTreeItem) => {
      // Get connection from tree item or use global connection
      const conn = item?.connectionInfo ?? connection;
      if (!conn) {
        vscode.window.showWarningMessage('No connection available');
        return;
      }

      // Get the appropriate client
      const targetClient = item?.connectionInfo
        ? await schemaExplorer.getOrCreateClient(item.connectionInfo)
        : client;

      if (!targetClient) {
        vscode.window.showWarningMessage('No client available');
        return;
      }

      await openERDiagramInPanel(context, targetClient, conn);
    }
  );

  // Password Management Commands
  const showSecurityInfoCommand = vscode.commands.registerCommand(
    "dbview.showSecurityInfo",
    async () => {
      if (!connection) {
        vscode.window.showWarningMessage("No active connection");
        return;
      }

      const activeConnectionName = await getActiveConnectionName(context);
      const securityInfo = await getConnectionSecurityInfo(context, activeConnectionName);

      const items = [
        `Connection: ${formatConnectionDisplay(connection)}`,
        `Password Saved: ${securityInfo.passwordSaved ? "✓ Yes (encrypted in OS keychain)" : "✗ No"}`,
        `SSL/TLS: ${securityInfo.sslEnabled ? "✓ Enabled" : "✗ Disabled"}`,
        "",
        "Security Notes:",
        "• Passwords are stored using OS-level encryption",
        "• Windows: Credential Manager",
        "• macOS: Keychain",
        "• Linux: Secret Service (libsecret)"
      ];

      const selection = await vscode.window.showQuickPick(
        [
          { label: "$(key) Clear Saved Password", value: "clear", detail: "Remove password from secure storage" },
          { label: "$(x) Close", value: "close" }
        ],
        {
          placeHolder: items.join("\n"),
          ignoreFocusOut: true
        }
      );

      if (selection?.value === "clear") {
        vscode.commands.executeCommand("dbview.clearPassword");
      }
    }
  );

  const clearPasswordCommand = vscode.commands.registerCommand(
    "dbview.clearPassword",
    async () => {
      const activeConnectionName = await getActiveConnectionName(context);
      const passwordSaved = await isPasswordSaved(context, activeConnectionName);

      if (!passwordSaved) {
        vscode.window.showInformationMessage("No password is currently saved");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to clear the saved password? You will need to enter it again on next connection.",
        { modal: true },
        "Clear Password"
      );

      if (confirm === "Clear Password") {
        await clearPassword(context, activeConnectionName);
        vscode.window.showInformationMessage("Password cleared successfully");
      }
    }
  );

  const clearAllPasswordsCommand = vscode.commands.registerCommand(
    "dbview.clearAllPasswords",
    async () => {
      const connections = await getAllSavedConnections(context);
      if (connections.length === 0) {
        vscode.window.showInformationMessage("No saved connections found");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `This will clear ALL saved passwords for ${connections.length} connection(s). You will need to re-enter passwords when connecting.`,
        { modal: true },
        "Clear All Passwords"
      );

      if (confirm === "Clear All Passwords") {
        await clearAllPasswords(context);
        vscode.window.showInformationMessage(`Cleared passwords for ${connections.length} connection(s)`);
      }
    }
  );

  // Theme change listener - update webview when VS Code theme changes
  const themeChangeListener = vscode.window.onDidChangeActiveColorTheme(() => {
    console.log("[dbview] Theme changed, updating webview");
    updateWebviewTheme();
  });

  context.subscriptions.push(
    configureConnectionCommand,
    addConnectionCommand,
    refreshCommand,
    openTableCommand,
    openSqlRunnerCommand,
    openERDiagramCommand,
    switchConnectionCommand,
    manageConnectionsCommand,
    refreshConnectionCommand,
    editConnectionCommand,
    copyConnectionStringCommand,
    deleteConnectionCommand,
    openDocsCommand,
    copyTableNameCommand,
    copySchemaTableNameCommand,
    generateSelectCommand,
    refreshTableCountCommand,
    copyColumnNameCommand,
    copyColumnDefinitionCommand,
    showDatabaseInfoCommand,
    showRunningQueriesCommand,
    copyDatabaseNameCommand,
    copyHostPortCommand,
    disconnectConnectionCommand,
    reconnectConnectionCommand,
    newQueryFromConnectionCommand,
    showSecurityInfoCommand,
    clearPasswordCommand,
    clearAllPasswordsCommand,
    themeChangeListener
  );

  console.log("[dbview] Extension activated successfully");
}

export async function deactivate(): Promise<void> {
  // Cleanup all cached clients
  if (schemaExplorerInstance) {
    await schemaExplorerInstance.cleanupAllClients();
  }
}

/**
 * Format a connection config for display purposes
 */
function formatConnectionDisplay(connection: DatabaseConnectionConfig): string {
  if (connection.name) {
    return connection.name;
  }
  if ('host' in connection && 'port' in connection && 'database' in connection) {
    return `${connection.host}:${connection.port}/${connection.database}`;
  }
  if ('filePath' in connection) {
    return connection.filePath;
  }
  return connection.dbType;
}

/**
 * Format a connection config for detailed display
 */
function formatConnectionDetailedDisplay(connection: DatabaseConnectionConfig): string {
  if ('host' in connection && 'port' in connection && 'database' in connection && 'user' in connection) {
    return `${connection.user}@${connection.host}:${connection.port}/${connection.database}`;
  }
  if ('filePath' in connection) {
    return connection.filePath;
  }
  return formatConnectionDisplay(connection);
}

function buildConnectionString(connection: DatabaseConnectionConfig): string {
  // Only works for host-based databases
  if (!('host' in connection) || !('port' in connection) || !('database' in connection) || !('user' in connection)) {
    throw new Error('Connection string not supported for this database type');
  }

  const user = connection.user || '';  // Fallback for optional user (e.g., SQL Server Windows Auth)
  const encodedUser = encodeURIComponent(user);
  const password = ('password' in connection) ? connection.password : undefined;
  const encodedPassword = password ? `:${encodeURIComponent(password)}` : "";
  const auth = `${encodedUser}${encodedPassword}@`;
  const host = connection.host;
  const port = connection.port;
  const database = encodeURIComponent(connection.database);

  // Format based on database type (SQLite already filtered out by guard above)
  if (connection.dbType === 'postgres') {
    return `postgresql://${auth}${host}:${port}/${database}`;
  } else if (connection.dbType === 'mysql') {
    return `mysql://${auth}${host}:${port}/${database}`;
  } else if (connection.dbType === 'sqlserver') {
    return `mssql://${auth}${host}:${port}/${database}`;
  } else if (connection.dbType === 'mongodb') {
    return `mongodb://${auth}${host}:${port}/${database}`;
  } else {
    throw new Error(`Unknown database type: ${(connection as any).dbType}`);
  }
}
