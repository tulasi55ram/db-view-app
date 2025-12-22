import * as vscode from "vscode";
import type { ConnectionConfig } from "@dbview/core";
import { PostgresClient } from "./postgresClient";

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

  constructor(
    private client: PostgresClient,
    private connection: ConnectionConfig | null = null,
    private context: vscode.ExtensionContext
  ) {}

  updateClient(client: PostgresClient, connection: ConnectionConfig | null = null): void {
    console.log("[dbview] updateClient called with connection:", connection);
    this.client = client;
    this.connection = connection;
    this.connectionError = null;
  }

  refresh(): void {
    console.log("[dbview] refresh called, firing tree data change event");
    this.connectionError = null;
    this.emitter.fire();
  }

  getTreeItem(element: SchemaTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: SchemaTreeItem): Promise<SchemaTreeItem[]> {
    console.log("[dbview] getChildren called, element:", element ? element.node.type : "root");
    console.log("[dbview] Current connection:", this.connection);

    if (!element) {
      // If no connection is configured, show welcome screen
      if (!this.connection) {
        console.log("[dbview] No connection, showing welcome node");
        return [new SchemaTreeItem({ type: "welcome" }, null)];
      }
      console.log("[dbview] Returning connection node with connection:", this.connection);

      // Get database size
      try {
        const sizeInBytes = await this.client.getDatabaseSize();
        return [new SchemaTreeItem({ type: "connection", sizeInBytes }, this.connection)];
      } catch (error) {
        console.error("[dbview] Failed to get database size:", error);
        return [new SchemaTreeItem({ type: "connection" }, this.connection)];
      }
    }

    if (isWelcomeNode(element.node)) {
      return [];
    }

    if (isConnectionNode(element.node)) {
      console.log("[dbview] Fetching schemas from database...");
      try {
        const schemas = await this.client.listSchemas();
        this.connectionError = null;
        console.log("[dbview] Schemas fetched:", schemas);
        if (schemas.length === 0) {
          vscode.window.showWarningMessage("dbview: No schemas found in database");
        }
        return [new SchemaTreeItem({ type: "schemasContainer", count: schemas.length }, this.connection)];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.connectionError = errorMessage;

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
        console.error("[dbview] Connection error:", error);
        return [];
      }
    }

    if (isSchemasContainerNode(element.node)) {
      try {
        const schemas = await this.client.listSchemas();
        return schemas.map((schema) => new SchemaTreeItem({ type: "schema", schema }, this.connection));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list schemas - ${errorMessage}`);
        console.error("[dbview] Error listing schemas:", error);
        return [];
      }
    }

    if (isSchemaNode(element.node)) {
      const schemaName = element.node.schema;
      try {
        const counts = await this.client.getObjectCounts(schemaName);
        const containers: SchemaTreeItem[] = [];

        // Always show all object types, even if count is 0
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "tables", count: counts.tables }, this.connection));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "views", count: counts.views }, this.connection));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "materializedViews", count: counts.materializedViews }, this.connection));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "functions", count: counts.functions }, this.connection));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "procedures", count: counts.procedures }, this.connection));
        containers.push(new SchemaTreeItem({ type: "objectTypeContainer", schema: schemaName, objectType: "types", count: counts.types }, this.connection));

        return containers;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list objects in "${schemaName}" - ${errorMessage}`);
        console.error(`[dbview] Error listing objects in ${schemaName}:`, error);
        return [];
      }
    }

    if (isObjectTypeContainerNode(element.node)) {
      const { schema, objectType } = element.node;
      try {
        switch (objectType) {
          case "tables": {
            const tables = await this.client.listTables(schema);
            return tables.map((table) =>
              new SchemaTreeItem(
                { type: "table", schema, table: table.name, sizeBytes: table.sizeBytes, rowCount: table.rowCount },
                this.connection
              )
            );
          }
          case "views": {
            const views = await this.client.listViews(schema);
            return views.map((name) => new SchemaTreeItem({ type: "view", schema, name }, this.connection));
          }
          case "materializedViews": {
            const matViews = await this.client.listMaterializedViews(schema);
            return matViews.map((name) => new SchemaTreeItem({ type: "materializedView", schema, name }, this.connection));
          }
          case "functions": {
            const functions = await this.client.listFunctions(schema);
            return functions.map((name) => new SchemaTreeItem({ type: "function", schema, name }, this.connection));
          }
          case "procedures": {
            const procedures = await this.client.listProcedures(schema);
            return procedures.map((name) => new SchemaTreeItem({ type: "procedure", schema, name }, this.connection));
          }
          case "types": {
            const types = await this.client.listTypes(schema);
            return types.map((name) => new SchemaTreeItem({ type: "typeNode", schema, name }, this.connection));
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
      const { schema, table } = element.node;
      try {
        const columns = await this.client.listColumns(schema, table);
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
            this.connection
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
  readonly connectionInfo: ConnectionConfig | null;

  constructor(
    public readonly node: NodeData,
    connectionInfo?: ConnectionConfig | null
  ) {
    super(getLabel(node, connectionInfo), getCollapsibleState(node));
    this.connectionInfo = connectionInfo ?? null;

    this.contextValue = node.type;
    this.iconPath = new vscode.ThemeIcon(getIcon(node), getIconColor(node));

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
      this.tooltip.appendMarkdown(`_Click to view data, expand to see columns_`);
      this.command = {
        command: "dbview.openTable",
        title: "Open Table",
        arguments: [{ schema: node.schema, table: node.table } as TableIdentifier]
      };
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
      const hostInfo = `${connectionInfo.host}:${connectionInfo.port}`;
      this.description = node.sizeInBytes ? formatBytes(node.sizeInBytes) : hostInfo;
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`**${connectionInfo.name || connectionInfo.database}**\n\n`);
      this.tooltip.appendMarkdown(`🖥️ Host: \`${hostInfo}\`\n\n`);
      this.tooltip.appendMarkdown(`📀 Database: \`${connectionInfo.database}\`\n\n`);
      this.tooltip.appendMarkdown(`👤 User: \`${connectionInfo.user}\`\n\n`);
      if (node.sizeInBytes) {
        this.tooltip.appendMarkdown(`💾 Size: ${formatBytes(node.sizeInBytes)}\n\n`);
      }
      this.tooltip.appendMarkdown(`---\n\n`);
      this.tooltip.appendMarkdown(`_Right-click for more options_`);
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

function getLabel(node: NodeData, connectionInfo?: ConnectionConfig | null): string {
  if (isWelcomeNode(node)) {
    return "Connect to Database";
  }
  if (isConnectionNode(node)) {
    const baseName = connectionInfo ? (connectionInfo.name || connectionInfo.database) : "Postgres (default)";
    if (node.sizeInBytes !== undefined) {
      return `${baseName} - ${formatBytes(node.sizeInBytes)}`;
    }
    return baseName;
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
    return vscode.TreeItemCollapsibleState.Expanded;
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

function getIcon(node: NodeData): string {
  if (isWelcomeNode(node)) {
    return "plug";
  }
  if (isConnectionNode(node)) {
    return "database";
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

function getIconColor(node: NodeData): vscode.ThemeColor | undefined {
  if (isWelcomeNode(node)) {
    return new vscode.ThemeColor("charts.blue");
  }
  if (isConnectionNode(node)) {
    return new vscode.ThemeColor("charts.green");
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
