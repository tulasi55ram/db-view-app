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
type TableNode = { type: "table"; sizeBytes?: number } & TableIdentifier;
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
        vscode.window.showErrorMessage(`dbview: Failed to connect - ${errorMessage}`);
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
                { type: "table", schema, table: table.name, sizeBytes: table.sizeBytes },
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
    this.iconPath = new vscode.ThemeIcon(getIcon(node));

    if (isTableNode(node)) {
      const sizeLabel = typeof node.sizeBytes === "number" ? formatBytes(node.sizeBytes) : undefined;
      this.description = node.schema;
      this.tooltip = `${node.schema}.${node.table}${sizeLabel ? ` · ${sizeLabel}` : ""}`;
      this.command = {
        command: "dbview.openTable",
        title: "Open Table",
        arguments: [{ schema: node.schema, table: node.table } as TableIdentifier]
      };
    }

    if (isViewNode(node) || isMaterializedViewNode(node) || isFunctionNode(node) || isProcedureNode(node) || isTypeNode(node)) {
      this.description = node.schema;
    }

    if (isConnectionNode(node) && connectionInfo) {
      // Only show description if we don't have size info (size is already in label)
      if (!node.sizeInBytes) {
        this.description = `${connectionInfo.host}:${connectionInfo.port}/${connectionInfo.database}`;
      }
    }

    if (isWelcomeNode(node)) {
      this.description = "Click to configure your database connection";
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
    const sizeLabel = typeof node.sizeBytes === "number" ? ` (${formatBytes(node.sizeBytes)})` : "";
    return `${node.table}${sizeLabel}`;
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
      views: "preview",
      materializedViews: "layers",
      functions: "symbol-method",
      procedures: "bracket",
      types: "symbol-class"
    };
    return icons[node.objectType];
  }
  if (isTableNode(node)) {
    return "table";
  }
  if (isViewNode(node)) {
    return "preview";
  }
  if (isMaterializedViewNode(node)) {
    return "layers";
  }
  if (isFunctionNode(node)) {
    return "symbol-method";
  }
  if (isProcedureNode(node)) {
    return "bracket";
  }
  if (isTypeNode(node)) {
    return "symbol-class";
  }
  return "file";
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
