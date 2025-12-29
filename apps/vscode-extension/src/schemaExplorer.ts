import * as vscode from "vscode";
import type { ConnectionConfig, DatabaseConnectionConfig } from "@dbview/types";
import type { DatabaseAdapter, ConnectionStatus, ConnectionStatusEvent } from "@dbview/adapters";
import { DatabaseAdapterFactory } from "@dbview/adapters";
import { getAllSavedConnections, getActiveConnectionName } from "./connectionSettings";

export interface TableIdentifier {
  schema: string;
  table: string;
}

type ConnectionNode = { type: "connection"; sizeInBytes?: number };
type SchemasContainerNode = { type: "schemasContainer"; count: number };
type SchemaNode = { type: "schema"; schema: string };
type ObjectTypeContainerNode = {
  type: "objectTypeContainer";
  schema: string;
  objectType: "tables" | "views" | "materializedViews" | "functions" | "procedures" | "types";
  count: number;
};
type TableNode = { type: "table"; sizeBytes?: number; rowCount?: number } & TableIdentifier;
type ColumnNode = {
  type: "column";
  schema: string;
  table: string;
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
};
type ViewNode = { type: "view"; schema: string; name: string };
type MaterializedViewNode = { type: "materializedView"; schema: string; name: string };
type FunctionNode = { type: "function"; schema: string; name: string };
type ProcedureNode = { type: "procedure"; schema: string; name: string };
type TypeNode = { type: "typeNode"; schema: string; name: string };
type WelcomeNode = { type: "welcome" };
type NodeData =
  | ConnectionNode
  | SchemasContainerNode
  | SchemaNode
  | ObjectTypeContainerNode
  | TableNode
  | ColumnNode
  | ViewNode
  | MaterializedViewNode
  | FunctionNode
  | ProcedureNode
  | TypeNode
  | WelcomeNode;

export class SchemaExplorerProvider implements vscode.TreeDataProvider<SchemaTreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private connectionError: string | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private statusListener: ((event: ConnectionStatusEvent) => void) | null = null;

  // Client cache for multiple connections (lazy-connect)
  private clients: Map<string, DatabaseAdapter> = new Map();
  private clientStatuses: Map<string, ConnectionStatus> = new Map();
  // Track connections that have already shown error notifications (to avoid continuous popups)
  private errorNotificationShown: Set<string> = new Set();

  constructor(
    private client: DatabaseAdapter | undefined,
    private connection: ConnectionConfig | DatabaseConnectionConfig | null = null,
    private context: vscode.ExtensionContext
  ) {
    // Initialize status from client
    this.connectionStatus = client?.status ?? 'disconnected';
    this.setupStatusListener();

    // Cache the initial client if we have a connection
    if (connection && client) {
      const key = this.getConnectionKey(connection);
      this.clients.set(key, client);
      this.clientStatuses.set(key, client.status);
    }
  }

  private getConnectionKey(conn: ConnectionConfig | DatabaseConnectionConfig): string {
    // For legacy ConnectionConfig without dbType
    const dbType = 'dbType' in conn ? conn.dbType : 'postgres';

    // Use name if available, otherwise generate a unique key based on connection details
    if (conn.name) {
      return `${dbType}:${conn.name}`;
    }

    // Generate key based on database type
    switch (dbType) {
      case 'sqlite':
        return `${dbType}:${(conn as any).filePath}`;
      case 'mongodb':
        if ((conn as any).connectionString) {
          return `${dbType}:${(conn as any).connectionString}`;
        }
        return `${dbType}:${(conn as any).user || 'anonymous'}@${(conn as any).host || 'localhost'}:${(conn as any).port || 27017}/${(conn as any).database}`;
      case 'postgres':
      case 'mysql':
      case 'sqlserver':
        // All have host:port/database structure
        return `${dbType}:${(conn as any).user}@${(conn as any).host}:${(conn as any).port}/${(conn as any).database}`;
      default:
        // Future database types or legacy - use host:port/database pattern
        return `${dbType}:${(conn as any).user}@${(conn as any).host}:${(conn as any).port}/${(conn as any).database}`;
    }
  }

  private getConnectionDisplayName(conn: ConnectionConfig | DatabaseConnectionConfig): string {
    if (conn.name) {
      return conn.name;
    }

    if ('dbType' in conn && conn.dbType === 'sqlite') {
      return conn.filePath;
    }

    // For all other types that have a database property
    if ('database' in conn && conn.database !== undefined) {
      return String(conn.database);
    }

    return 'Unknown';
  }

  // Public method to get or create a client for a specific connection
  public async getOrCreateClient(conn: ConnectionConfig | DatabaseConnectionConfig): Promise<DatabaseAdapter> {
    const key = this.getConnectionKey(conn);

    // Check if we already have a client for this connection
    if (this.clients.has(key)) {
      const existingClient = this.clients.get(key)!;
      const currentStatus = this.clientStatuses.get(key);

      // If client exists but status is disconnected or error, we need to reconnect it
      // This handles both explicit disconnects and transient failures
      if (currentStatus === 'disconnected' || currentStatus === 'error' || !currentStatus) {
        console.log(`[dbview] Cached client for ${key} is ${currentStatus || 'unknown'}, attempting reconnect...`);
        this.clientStatuses.set(key, 'connecting');

        try {
          // Connect to the database first (required for MySQL and other non-pooled adapters)
          await existingClient.connect();
          console.log(`[dbview] Cached client reconnected for ${key}`);

          const isAlive = await existingClient.ping();
          console.log(`[dbview] Ping result for cached client ${key}: ${isAlive}`);
          if (isAlive) {
            existingClient.startHealthCheck();
            this.clientStatuses.set(key, 'connected');
            console.log(`[dbview] Status set to 'connected' for cached client ${key}`);
          }
        } catch (error) {
          console.error(`[dbview] Failed to connect cached client ${key}:`, error);
          this.clientStatuses.set(key, 'error');
        }
      }

      return existingClient;
    }

    // Create new client using factory
    console.log(`[dbview] Creating new adapter for connection: ${key}`);
    // Ensure connection has dbType for factory
    const connectionConfig: DatabaseConnectionConfig = 'dbType' in conn
      ? conn as DatabaseConnectionConfig
      : { ...conn, dbType: 'postgres' as const };
    const newClient = DatabaseAdapterFactory.create(connectionConfig);

    // Set up status listener for this client
    const listener = (event: ConnectionStatusEvent) => {
      const previousStatus = this.clientStatuses.get(key);

      // Only process if status actually changed
      if (previousStatus === event.status) {
        return;
      }

      this.clientStatuses.set(key, event.status);
      // Delayed refresh to avoid being ignored during getChildren()
      setTimeout(() => this.emitter.fire(), 100);

      // Clear error notification tracking when connection recovers
      if (event.status === 'connected') {
        this.errorNotificationShown.delete(key);
      }

      // Show notification for connection errors (only once per connection until it recovers)
      if (event.status === 'error' && event.error && !this.errorNotificationShown.has(key)) {
        this.errorNotificationShown.add(key);
        vscode.window.showWarningMessage(
          `dbview: ${this.getConnectionDisplayName(conn)} - ${event.error.message}`,
          'Reconnect'
        ).then(selection => {
          if (selection === 'Reconnect') {
            this.reconnectClient(conn);
          }
        });
      }
    };

    newClient.on('statusChange', listener);

    // Cache the client first (so it's available during ping)
    this.clients.set(key, newClient);
    this.clientStatuses.set(key, 'connecting');

    // Try to connect
    try {
      // Connect to the database (required for MySQL and other non-pooled adapters)
      await newClient.connect();
      console.log(`[dbview] Client connected successfully for ${key}`);

      const isAlive = await newClient.ping();
      console.log(`[dbview] Ping result for ${key}: ${isAlive}`);
      if (isAlive) {
        newClient.startHealthCheck();
        this.clientStatuses.set(key, 'connected');
        console.log(`[dbview] Status set to 'connected' for ${key}`);
      }
    } catch (error) {
      console.error(`[dbview] Failed to connect to ${key}:`, error);
      this.clientStatuses.set(key, 'error');
    }

    return newClient;
  }

  private async reconnectClient(conn: ConnectionConfig | DatabaseConnectionConfig): Promise<void> {
    const key = this.getConnectionKey(conn);
    const existingClient = this.clients.get(key);

    if (existingClient) {
      await existingClient.disconnect();
      this.clients.delete(key);
      this.clientStatuses.delete(key);
    }

    // Clear error notification tracking so new errors can be shown
    this.errorNotificationShown.delete(key);

    // Create fresh client
    await this.getOrCreateClient(conn);
    this.emitter.fire();
  }

  getClientForConnection(conn: ConnectionConfig | DatabaseConnectionConfig): DatabaseAdapter | undefined {
    const key = this.getConnectionKey(conn);
    return this.clients.get(key);
  }

  getStatusForConnection(conn: ConnectionConfig | DatabaseConnectionConfig): ConnectionStatus {
    const key = this.getConnectionKey(conn);
    return this.clientStatuses.get(key) || 'disconnected';
  }

  // Public method to disconnect a specific connection
  async disconnectConnection(conn: DatabaseConnectionConfig): Promise<void> {
    const key = this.getConnectionKey(conn);
    console.log(`[dbview] Disconnecting connection: ${key}`);

    const existingClient = this.clients.get(key);
    if (existingClient) {
      existingClient.stopHealthCheck();
      await existingClient.disconnect();
      this.clientStatuses.set(key, 'disconnected');
      console.log(`[dbview] Connection ${key} disconnected, status set to 'disconnected'`);
      this.emitter.fire();
    }
  }

  // Public method to reconnect a specific connection
  async reconnectConnection(conn: DatabaseConnectionConfig): Promise<boolean> {
    const key = this.getConnectionKey(conn);
    console.log(`[dbview] Reconnecting connection: ${key}`);

    // Disconnect first if connected
    const existingClient = this.clients.get(key);
    if (existingClient) {
      existingClient.stopHealthCheck();
      await existingClient.disconnect();
      this.clients.delete(key);
      this.clientStatuses.delete(key);
    }

    // Clear error notification tracking so new errors can be shown
    this.errorNotificationShown.delete(key);

    // Reconnect
    this.clientStatuses.set(key, 'connecting');
    this.emitter.fire();

    try {
      // Create new adapter using factory
      const newClient = DatabaseAdapterFactory.create(conn);

      // Set up status listener
      const listener = (event: ConnectionStatusEvent) => {
        this.clientStatuses.set(key, event.status);
        setTimeout(() => this.emitter.fire(), 100);
      };
      newClient.on('statusChange', listener);

      this.clients.set(key, newClient);

      // Connect first to initialize the connection pool
      await newClient.connect();
      console.log(`[dbview] Connection ${key} reconnected successfully`);

      // Start health check to monitor connection
      newClient.startHealthCheck();
      this.emitter.fire();
      return true;
    } catch (error) {
      console.error(`[dbview] Failed to reconnect ${key}:`, error);
      this.clientStatuses.set(key, 'error');
      this.emitter.fire();
      return false;
    }
  }

  private setupStatusListener(): void {
    if (!this.client) {
      return;
    }

    // Remove previous listener if exists
    if (this.statusListener) {
      this.client.removeListener('statusChange', this.statusListener);
    }

    // Set up new status change listener
    const listener = (event: ConnectionStatusEvent) => {
      this.connectionStatus = event.status;
      this.emitter.fire();

      // Show notification for connection errors
      if (event.status === 'error' && event.error) {
        this.showConnectionErrorNotification(event.error.message);
      } else if (event.status === 'connected' && this.connectionError) {
        // Connection restored
        this.connectionError = null;
        vscode.window.showInformationMessage('dbview: Connection restored');
      }
    };

    this.statusListener = listener;
    this.client.on('statusChange', listener);
  }

  private showConnectionErrorNotification(errorMessage: string): void {
    vscode.window.showWarningMessage(
      `dbview: Connection issue - ${errorMessage}`,
      'Reconnect',
      'Dismiss'
    ).then(selection => {
      if (selection === 'Reconnect') {
        vscode.commands.executeCommand('dbview.reconnectConnection');
      }
    });
  }

  updateClient(client: DatabaseAdapter | undefined, connection: ConnectionConfig | DatabaseConnectionConfig | null = null): void {
    // Remove listener from old client
    if (this.statusListener && this.client) {
      this.client.removeListener('statusChange', this.statusListener);
    }

    this.client = client;
    this.connection = connection;
    this.connectionError = null;
    this.connectionStatus = client?.status ?? 'disconnected';

    // Cache the client
    if (connection && client) {
      const key = this.getConnectionKey(connection);
      this.clients.set(key, client);
      this.clientStatuses.set(key, client.status);
    }

    // Set up listener on new client
    this.setupStatusListener();

    // Start health check for the new client
    if (connection && client) {
      client.startHealthCheck();
    }
  }

  // Invalidate cached client (call when connection is edited)
  invalidateClient(conn: DatabaseConnectionConfig): void {
    const key = this.getConnectionKey(conn);
    console.log(`[dbview] Invalidating client cache for: ${key}`);
    const existingClient = this.clients.get(key);
    if (existingClient) {
      existingClient.stopHealthCheck();
      existingClient.disconnect();
      this.clients.delete(key);
      this.clientStatuses.delete(key);
      console.log(`[dbview] Client cache invalidated for: ${key}`);
    } else {
      console.log(`[dbview] No cached client found for: ${key}`);
    }
  }

  // Cleanup all cached clients
  async cleanupAllClients(): Promise<void> {
    for (const [_key, client] of this.clients) {
      await client.disconnect();
    }
    this.clients.clear();
    this.clientStatuses.clear();
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  refresh(): void {
    this.connectionError = null;
    this.emitter.fire();
  }

  getTreeItem(element: SchemaTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: SchemaTreeItem): Promise<SchemaTreeItem[]> {
    if (!element) {
      // Root level: show ALL saved connections
      const allConnections = await getAllSavedConnections(this.context);

      if (allConnections.length === 0) {
        return [new SchemaTreeItem({ type: "welcome" }, null)];
      }

      // Return a connection node for each saved connection
      const connectionNodes: SchemaTreeItem[] = [];

      for (const conn of allConnections) {
        const status = this.getStatusForConnection(conn);
        let sizeInBytes: number | undefined;

        // Only try to get size if we have an active client for this connection
        const existingClient = this.getClientForConnection(conn);
        if (existingClient && status === 'connected') {
          try {
            sizeInBytes = await existingClient.getDatabaseSize();
          } catch (error) {
            console.error(`[dbview] Failed to get database size for ${conn.name}:`, error);
          }
        }

        connectionNodes.push(
          new SchemaTreeItem({ type: "connection", sizeInBytes }, conn, status)
        );
      }

      return connectionNodes;
    }

    if (isWelcomeNode(element.node)) {
      return [];
    }

    if (isConnectionNode(element.node)) {
      const conn = element.connectionInfo;
      if (!conn) {
        console.error("[dbview] Connection node has no connectionInfo");
        return [];
      }

      try {
        // Lazy-connect: get or create client for this specific connection
        const client = await this.getOrCreateClient(conn);
        const schemas = await client.listSchemas();
        this.connectionError = null;

        // Clear error notification tracking on successful connection
        const key = this.getConnectionKey(conn);
        this.errorNotificationShown.delete(key);

        if (schemas.length === 0) {
          vscode.window.showWarningMessage("dbview: No schemas found in database");
        }

        // Schedule refresh to update connection status icon after tree expansion completes
        setTimeout(() => this.emitter.fire(), 500);

        return [new SchemaTreeItem({ type: "schemasContainer", count: schemas.length }, conn)];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.connectionError = errorMessage;
        const key = this.getConnectionKey(conn);

        // Only show error notification once per connection until it recovers
        if (!this.errorNotificationShown.has(key)) {
          this.errorNotificationShown.add(key);

          // Provide helpful message for authentication errors
          if (errorMessage.includes("SASL") || errorMessage.includes("password")) {
            vscode.window.showErrorMessage(
              "dbview: Authentication failed. Please reconfigure your connection with the correct password.",
              "Configure Connection"
            ).then(selection => {
              if (selection === "Configure Connection") {
                vscode.commands.executeCommand("dbview.configureConnection");
              }
            });
          } else {
            vscode.window.showErrorMessage(`dbview: Failed to connect - ${errorMessage}`);
          }
        }
        console.error("[dbview] Connection error:", error);
        return [];
      }
    }

    // Helper to get client for any element's connection
    const getClientForElement = async (el: SchemaTreeItem): Promise<DatabaseAdapter | null> => {
      const conn = el.connectionInfo;
      if (!conn) return null;
      return this.getClientForConnection(conn) || null;
    };

    if (isSchemasContainerNode(element.node)) {
      const conn = element.connectionInfo;
      if (!conn) return [];
      const client = await getClientForElement(element);
      if (!client) return [];

      try {
        const schemas = await client.listSchemas();
        return schemas.map((schema) => new SchemaTreeItem({ type: "schema", schema }, conn));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list schemas - ${errorMessage}`);
        console.error("[dbview] Error listing schemas:", error);
        return [];
      }
    }

    if (isSchemaNode(element.node)) {
      const conn = element.connectionInfo;
      if (!conn) return [];
      const client = await getClientForElement(element);
      if (!client) return [];

      const schemaName = element.node.schema;
      try {
        const counts = await client.getObjectCounts(schemaName);
        const containers: SchemaTreeItem[] = [];

        // Always show all object types, even if count is 0
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "tables", count: counts.tables }, conn));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "views", count: counts.views }, conn));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "materializedViews", count: counts.materializedViews }, conn));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "functions", count: counts.functions }, conn));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "procedures", count: counts.procedures }, conn));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "types", count: counts.types }, conn));

        return containers;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list objects in "${schemaName}" - ${errorMessage}`);
        console.error(`[dbview] Error listing objects in ${schemaName}:`, error);
        return [];
      }
    }

    if (isObjectTypeContainerNode(element.node)) {
      const conn = element.connectionInfo;
      if (!conn) return [];
      const client = await getClientForElement(element);
      if (!client) return [];

      const { schema, objectType } = element.node;
      try {
        switch (objectType) {
          case "tables": {
            const tables = await client.listTables(schema);
            return tables.map((table) =>
              new SchemaTreeItem(
                { type: "table", schema, table: table.name, sizeBytes: table.sizeBytes, rowCount: table.rowCount },
                conn
              )
            );
          }
          case "views": {
            if (!client.listViews) return [];
            const views = await client.listViews(schema);
            return views.map((name) => new SchemaTreeItem({ type: "view", schema, name }, conn));
          }
          case "materializedViews": {
            if (!client.listMaterializedViews) return [];
            const matViews = await client.listMaterializedViews(schema);
            return matViews.map((name) => new SchemaTreeItem({ type: "materializedView", schema, name }, conn));
          }
          case "functions": {
            if (!client.listFunctions) return [];
            const functions = await client.listFunctions(schema);
            return functions.map((name) => new SchemaTreeItem({ type: "function", schema, name }, conn));
          }
          case "procedures": {
            if (!client.listProcedures) return [];
            const procedures = await client.listProcedures(schema);
            return procedures.map((name) => new SchemaTreeItem({ type: "procedure", schema, name }, conn));
          }
          case "types": {
            if (!client.listTypes) return [];
            const types = await client.listTypes(schema);
            return types.map((name) => new SchemaTreeItem({ type: "typeNode", schema, name }, conn));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list ${objectType} in "${schema}" - ${errorMessage}`);
        console.error(`[dbview] Error listing ${objectType} in ${schema}:`, error);
        return [];
      }
    }

    // Handle table expansion to show columns
    if (isTableNode(element.node)) {
      const conn = element.connectionInfo;
      if (!conn) return [];
      const client = await getClientForElement(element);
      if (!client) return [];

      const { schema, table } = element.node;
      try {
        const columns = await client.listColumns(schema, table);
        return columns.map((col) =>
          new SchemaTreeItem(
            {
              type: "column",
              schema,
              table,
              name: col.name,
              dataType: col.dataType,
              isNullable: col.isNullable,
              isPrimaryKey: col.isPrimaryKey,
              isForeignKey: col.isForeignKey,
              foreignKeyRef: col.foreignKeyRef
            },
            conn
          )
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list columns for "${schema}.${table}" - ${errorMessage}`);
        console.error(`[dbview] Error listing columns for ${schema}.${table}:`, error);
        return [];
      }
    }

    return [];
  }
}

export class SchemaTreeItem extends vscode.TreeItem {
  readonly connectionInfo: DatabaseConnectionConfig | null;

  constructor(
    public readonly node: NodeData,
    connectionInfo?: DatabaseConnectionConfig | null,
    connectionStatus?: ConnectionStatus
  ) {
    super(getLabel(node, connectionInfo), getCollapsibleState(node));
    this.connectionInfo = connectionInfo ?? null;

    this.contextValue = node.type;
    this.iconPath = new vscode.ThemeIcon(
      getIcon(node, connectionStatus),
      getIconColor(node, connectionStatus)
    );

    if (isTableNode(node)) {
      const sizeLabel = typeof node.sizeBytes === "number" ? formatBytes(node.sizeBytes) : undefined;
      const rowLabel = typeof node.rowCount === "number" ? formatRowCount(node.rowCount) : undefined;
      // Show row count and size in description
      const descParts: string[] = [];
      if (rowLabel) descParts.push(rowLabel);
      if (sizeLabel) descParts.push(sizeLabel);
      this.description = descParts.join(" · ");

      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.schema}.${node.table}**\n\n`);
      this.tooltip.appendMarkdown(`📁 Schema: \`${node.schema}\`\n\n`);
      if (rowLabel) {
        this.tooltip.appendMarkdown(`📊 Rows: ~${node.rowCount?.toLocaleString()}\n\n`);
      }
      if (sizeLabel) {
        this.tooltip.appendMarkdown(`💾 Size: ${sizeLabel}\n\n`);
      }
      this.tooltip.appendMarkdown(`_Click the icon or right-click → Open Table to view data_\n\n`);
      this.tooltip.appendMarkdown(`_Expand (▶) to see columns_`);
      // Don't set command property to avoid double-click issues
      // Users can: 1) Click inline icon, 2) Right-click → Open Table, 3) Expand to see columns
    }

    if (isColumnNode(node)) {
      // Build description showing type and constraints
      const constraints: string[] = [];
      if (node.isPrimaryKey) constraints.push("PK");
      if (node.isForeignKey) constraints.push("FK");
      if (!node.isNullable) constraints.push("NOT NULL");

      this.description = node.dataType + (constraints.length > 0 ? ` [${constraints.join(", ")}]` : "");

      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.name}**\n\n`);
      this.tooltip.appendMarkdown(`📋 Type: \`${node.dataType}\`\n\n`);
      if (node.isPrimaryKey) {
        this.tooltip.appendMarkdown(`🔑 Primary Key\n\n`);
      }
      if (node.isForeignKey && node.foreignKeyRef) {
        this.tooltip.appendMarkdown(`🔗 Foreign Key → \`${node.foreignKeyRef}\`\n\n`);
      }
      this.tooltip.appendMarkdown(`${node.isNullable ? "✓ Nullable" : "✗ NOT NULL"}`);
    }

    if (isViewNode(node)) {
      this.description = node.schema;
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.schema}.${node.name}**\n\n`);
      this.tooltip.appendMarkdown(`👁️ View\n\n`);
      this.tooltip.appendMarkdown(`_A stored query that can be treated as a virtual table_`);
    }

    if (isMaterializedViewNode(node)) {
      this.description = node.schema;
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.schema}.${node.name}**\n\n`);
      this.tooltip.appendMarkdown(`📊 Materialized View\n\n`);
      this.tooltip.appendMarkdown(`_A view with cached results for faster queries_`);
    }

    if (isFunctionNode(node)) {
      this.description = node.schema;
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.schema}.${node.name}**\n\n`);
      this.tooltip.appendMarkdown(`⚡ Function\n\n`);
      this.tooltip.appendMarkdown(`_A reusable SQL function_`);
    }

    if (isProcedureNode(node)) {
      this.description = node.schema;
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.schema}.${node.name}**\n\n`);
      this.tooltip.appendMarkdown(`🔧 Stored Procedure\n\n`);
      this.tooltip.appendMarkdown(`_A stored procedure that can be called_`);
    }

    if (isTypeNode(node)) {
      this.description = node.schema;
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.schema}.${node.name}**\n\n`);
      this.tooltip.appendMarkdown(`📦 Custom Type\n\n`);
      this.tooltip.appendMarkdown(`_A user-defined data type_`);
    }

    if (isSchemaNode(node)) {
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**Schema: ${node.schema}**\n\n`);
      this.tooltip.appendMarkdown(`_Expand to see database objects_`);
    }

    if (isSchemasContainerNode(node)) {
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.count} schemas found**\n\n`);
      this.tooltip.appendMarkdown(`_Expand to browse schemas_`);
    }

    if (isObjectTypeContainerNode(node)) {
      const typeDescriptions: Record<typeof node.objectType, string> = {
        tables: "Store your data in structured rows and columns",
        views: "Virtual tables based on SQL queries",
        materializedViews: "Cached query results for faster access",
        functions: "Reusable SQL functions",
        procedures: "Stored procedures for complex operations",
        types: "Custom data types"
      };
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${node.count} ${node.objectType}**\n\n`);
      this.tooltip.appendMarkdown(`_${typeDescriptions[node.objectType]}_`);
    }

    if (isConnectionNode(node) && connectionInfo) {
      const hostInfo = ('host' in connectionInfo && 'port' in connectionInfo)
        ? `${connectionInfo.host}:${connectionInfo.port}`
        : ('filePath' in connectionInfo ? connectionInfo.filePath : 'N/A');
      const readOnlyLabel = connectionInfo.readOnly ? " 🔒" : "";

      // Add connection status indicator
      let statusLabel = "";
      let statusEmoji = "";
      switch (connectionStatus) {
        case 'connecting':
          statusLabel = " 🟡 Connecting...";
          statusEmoji = "🟡";
          break;
        case 'error':
          statusLabel = " 🔴 Error";
          statusEmoji = "🔴";
          break;
        case 'disconnected':
          statusLabel = ""; // No label for disconnected - clean look
          statusEmoji = "⚪";
          break;
        case 'connected':
          statusLabel = " 🟢";
          statusEmoji = "🟢";
          break;
        default:
          statusLabel = "";
          statusEmoji = "⚪";
          break;
      }

      this.description = (node.sizeInBytes ? formatBytes(node.sizeInBytes) : hostInfo) + readOnlyLabel + statusLabel;
      this.tooltip = new vscode.MarkdownString();

      // Get connection name
      let connName = 'Database';
      if (connectionInfo.name) {
        connName = connectionInfo.name;
      } else if ('database' in connectionInfo && connectionInfo.database !== undefined) {
        connName = String(connectionInfo.database);
      } else if ('filePath' in connectionInfo) {
        connName = connectionInfo.filePath;
      }
      this.tooltip.appendMarkdown(`**${connName}**\n\n`);

      // Show connection status in tooltip
      this.tooltip.appendMarkdown(`${statusEmoji} **Status:** ${connectionStatus || 'unknown'}\n\n`);

      if (connectionInfo.readOnly) {
        this.tooltip.appendMarkdown(`🔒 **Read-Only Mode** - Write operations are blocked\n\n`);
      }
      if ('host' in connectionInfo && 'port' in connectionInfo) {
        this.tooltip.appendMarkdown(`🖥️ Host: \`${hostInfo}\`\n\n`);
      }
      if ('database' in connectionInfo) {
        this.tooltip.appendMarkdown(`📀 Database: \`${connectionInfo.database}\`\n\n`);
      }
      if ('user' in connectionInfo) {
        this.tooltip.appendMarkdown(`👤 User: \`${connectionInfo.user}\`\n\n`);
      }
      if (node.sizeInBytes) {
        this.tooltip.appendMarkdown(`💾 Size: ${formatBytes(node.sizeInBytes)}\n\n`);
      }
      this.tooltip.appendMarkdown(`---\n\n`);
      if (connectionStatus === 'disconnected' || !connectionStatus) {
        this.tooltip.appendMarkdown(`_Expand to connect • Right-click for options_`);
      } else {
        this.tooltip.appendMarkdown(`_Right-click for more options_`);
      }
    }

    if (isWelcomeNode(node)) {
      this.description = "Click to add a connection";
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**Get Started**\n\n`);
      this.tooltip.appendMarkdown(`Click to configure your first database connection.\n\n`);
      this.tooltip.appendMarkdown(`Supported: PostgreSQL`);
      this.command = {
        command: "dbview.configureConnection",
        title: "Configure Connection"
      };
    }
  }
}

function getLabel(node: NodeData, connectionInfo?: DatabaseConnectionConfig | null): string {
  if (isWelcomeNode(node)) {
    return "Connect to Database";
  }
  if (isConnectionNode(node)) {
    let baseName = "Database";
    if (connectionInfo) {
      if (connectionInfo.name) {
        baseName = connectionInfo.name;
      } else if ('database' in connectionInfo && connectionInfo.database !== undefined) {
        baseName = String(connectionInfo.database);
      } else if ('filePath' in connectionInfo) {
        baseName = connectionInfo.filePath;
      }
    }
    const readOnlyBadge = connectionInfo?.readOnly ? "🔒 " : "";
    if (node.sizeInBytes !== undefined) {
      return `${readOnlyBadge}${baseName} - ${formatBytes(node.sizeInBytes)}`;
    }
    return `${readOnlyBadge}${baseName}`;
  }
  if (isSchemasContainerNode(node)) {
    return `Schemas (${node.count})`;
  }
  if (isSchemaNode(node)) {
    return node.schema;
  }
  if (isObjectTypeContainerNode(node)) {
    const labels: Record<typeof node.objectType, string> = {
      tables: "Tables",
      views: "Views",
      materializedViews: "Materialized Views",
      functions: "Functions",
      procedures: "Procedures",
      types: "Types"
    };
    return `${labels[node.objectType]} (${node.count})`;
  }
  if (isTableNode(node)) {
    return node.table;
  }
  if (isColumnNode(node)) {
    return node.name;
  }
  if (isViewNode(node)) {
    return node.name;
  }
  if (isMaterializedViewNode(node)) {
    return node.name;
  }
  if (isFunctionNode(node)) {
    return node.name;
  }
  if (isProcedureNode(node)) {
    return node.name;
  }
  if (isTypeNode(node)) {
    return node.name;
  }
  return "Unknown";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatRowCount(count: number): string {
  if (count === 0) return "0 rows";
  if (count === 1) return "1 row";
  if (count < 1000) return `${count} rows`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K rows`;
  return `${(count / 1000000).toFixed(1)}M rows`;
}

function getCollapsibleState(node: NodeData): vscode.TreeItemCollapsibleState {
  if (isConnectionNode(node)) {
    // Start collapsed - user expands to connect (lazy-connect approach)
    return vscode.TreeItemCollapsibleState.Collapsed;
  }
  if (isSchemasContainerNode(node)) {
    return vscode.TreeItemCollapsibleState.Expanded;
  }
  if (isSchemaNode(node)) {
    return vscode.TreeItemCollapsibleState.Collapsed;
  }
  if (isObjectTypeContainerNode(node)) {
    // If count is 0, don't allow expansion
    return node.count > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
  }
  if (isTableNode(node)) {
    // Tables can be expanded to show columns
    return vscode.TreeItemCollapsibleState.Collapsed;
  }
  return vscode.TreeItemCollapsibleState.None;
}

function getIcon(node: NodeData, connectionStatus?: ConnectionStatus): string {
  if (isWelcomeNode(node)) {
    return "plug";
  }
  if (isConnectionNode(node)) {
    // Show different icons based on connection status
    switch (connectionStatus) {
      case 'connecting':
        return "sync~spin";
      case 'error':
        return "warning";
      case 'disconnected':
        return "debug-disconnect";
      case 'connected':
      default:
        return "database";
    }
  }
  if (isSchemasContainerNode(node)) {
    return "folder-library";
  }
  if (isSchemaNode(node)) {
    return "symbol-namespace";
  }
  if (isObjectTypeContainerNode(node)) {
    const icons: Record<typeof node.objectType, string> = {
      tables: "table",
      views: "eye",
      materializedViews: "layers",
      functions: "symbol-method",
      procedures: "terminal",
      types: "symbol-class"
    };
    return icons[node.objectType];
  }
  if (isTableNode(node)) {
    return "table";
  }
  if (isColumnNode(node)) {
    if (node.isPrimaryKey) return "key";
    if (node.isForeignKey) return "references";
    return "symbol-field";
  }
  if (isViewNode(node)) {
    return "eye";
  }
  if (isMaterializedViewNode(node)) {
    return "layers";
  }
  if (isFunctionNode(node)) {
    return "symbol-method";
  }
  if (isProcedureNode(node)) {
    return "terminal";
  }
  if (isTypeNode(node)) {
    return "symbol-class";
  }
  return "file";
}

function getIconColor(node: NodeData, connectionStatus?: ConnectionStatus): vscode.ThemeColor | undefined {
  if (isWelcomeNode(node)) {
    return new vscode.ThemeColor("charts.blue");
  }
  if (isConnectionNode(node)) {
    // Show different colors based on connection status
    switch (connectionStatus) {
      case 'connecting':
        return new vscode.ThemeColor("charts.yellow");
      case 'error':
        return new vscode.ThemeColor("charts.red");
      case 'disconnected':
        return new vscode.ThemeColor("disabledForeground");
      case 'connected':
      default:
        return new vscode.ThemeColor("charts.green");
    }
  }
  if (isSchemasContainerNode(node)) {
    return new vscode.ThemeColor("charts.yellow");
  }
  if (isSchemaNode(node)) {
    return new vscode.ThemeColor("charts.purple");
  }
  if (isObjectTypeContainerNode(node)) {
    const colors: Record<typeof node.objectType, string> = {
      tables: "charts.blue",
      views: "charts.orange",
      materializedViews: "charts.purple",
      functions: "charts.yellow",
      procedures: "charts.red",
      types: "charts.green"
    };
    return new vscode.ThemeColor(colors[node.objectType]);
  }
  if (isTableNode(node)) {
    return new vscode.ThemeColor("charts.blue");
  }
  if (isColumnNode(node)) {
    if (node.isPrimaryKey) return new vscode.ThemeColor("charts.yellow");
    if (node.isForeignKey) return new vscode.ThemeColor("charts.purple");
    return undefined; // Default color for regular columns
  }
  if (isViewNode(node)) {
    return new vscode.ThemeColor("charts.orange");
  }
  if (isMaterializedViewNode(node)) {
    return new vscode.ThemeColor("charts.purple");
  }
  if (isFunctionNode(node)) {
    return new vscode.ThemeColor("charts.yellow");
  }
  if (isProcedureNode(node)) {
    return new vscode.ThemeColor("charts.red");
  }
  if (isTypeNode(node)) {
    return new vscode.ThemeColor("charts.green");
  }
  return undefined;
}

function isWelcomeNode(node: NodeData): node is WelcomeNode {
  return node.type === "welcome";
}

function isConnectionNode(node: NodeData): node is ConnectionNode {
  return node.type === "connection";
}

function isSchemasContainerNode(node: NodeData): node is SchemasContainerNode {
  return node.type === "schemasContainer";
}

function isSchemaNode(node: NodeData): node is SchemaNode {
  return node.type === "schema";
}

function isObjectTypeContainerNode(node: NodeData): node is ObjectTypeContainerNode {
  return node.type === "objectTypeContainer";
}

function isTableNode(node: NodeData): node is TableNode {
  return node.type === "table";
}

function isColumnNode(node: NodeData): node is ColumnNode {
  return node.type === "column";
}

function isViewNode(node: NodeData): node is ViewNode {
  return node.type === "view";
}

function isMaterializedViewNode(node: NodeData): node is MaterializedViewNode {
  return node.type === "materializedView";
}

function isFunctionNode(node: NodeData): node is FunctionNode {
  return node.type === "function";
}

function isProcedureNode(node: NodeData): node is ProcedureNode {
  return node.type === "procedure";
}

function isTypeNode(node: NodeData): node is TypeNode {
  return node.type === "typeNode";
}
