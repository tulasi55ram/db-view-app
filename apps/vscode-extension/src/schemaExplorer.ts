import * as vscode from "vscode";
import type { ConnectionConfig } from "@dbview/core";
import { PostgresClient } from "./postgresClient";

export interface TableIdentifier {
  schema: string;
  table: string;
}

type ConnectionNode = { type: "connection" };
type SchemaNode = { type: "schema"; schema: string };
type TableNode = { type: "table" } & TableIdentifier;
type WelcomeNode = { type: "welcome" };
type NodeData = ConnectionNode | SchemaNode | TableNode | WelcomeNode;

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
    this.client = client;
    this.connection = connection;
    this.connectionError = null;
  }

  refresh(): void {
    this.connectionError = null;
    this.emitter.fire();
  }

  getTreeItem(element: SchemaTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: SchemaTreeItem): Promise<SchemaTreeItem[]> {
    console.log("[dbview] getChildren called, element:", element ? element.node.type : "root");

    if (!element) {
      // If no connection is configured, show welcome screen
      if (!this.connection) {
        console.log("[dbview] No connection, showing welcome node");
        return [new SchemaTreeItem({ type: "welcome" }, null)];
      }
      console.log("[dbview] Returning connection node");
      return [new SchemaTreeItem({ type: "connection" }, this.connection)];
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
        return schemas.map((schema) => new SchemaTreeItem({ type: "schema", schema }, this.connection));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.connectionError = errorMessage;
        vscode.window.showErrorMessage(`dbview: Failed to connect - ${errorMessage}`);
        console.error("[dbview] Connection error:", error);
        return [];
      }
    }

    if (isSchemaNode(element.node)) {
      const schemaName = element.node.schema;
      try {
        const tables = await this.client.listTables(schemaName);
        if (tables.length === 0) {
          vscode.window.showInformationMessage(`dbview: No tables found in schema "${schemaName}"`);
        }
        return tables.map((table) => new SchemaTreeItem({ type: "table", schema: schemaName, table }, this.connection));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`dbview: Failed to list tables in "${schemaName}" - ${errorMessage}`);
        console.error(`[dbview] Error listing tables in ${schemaName}:`, error);
        return [];
      }
    }

    return [];
  }
}

export class SchemaTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: NodeData,
    connectionInfo?: ConnectionConfig | null
  ) {
    super(getLabel(node, connectionInfo), getCollapsibleState(node));

    this.contextValue = node.type;
    this.iconPath = new vscode.ThemeIcon(getIcon(node));

    if (isTableNode(node)) {
      this.description = node.schema;
      this.command = {
        command: "dbview.openTable",
        title: "Open Table",
        arguments: [{ schema: node.schema, table: node.table } as TableIdentifier]
      };
    }

    if (isConnectionNode(node) && connectionInfo) {
      this.description = `${connectionInfo.host}:${connectionInfo.port}/${connectionInfo.database}`;
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
    return connectionInfo ? connectionInfo.database : "Postgres (default)";
  }
  if (isSchemaNode(node)) {
    return node.schema;
  }
  return node.table;
}

function getCollapsibleState(node: NodeData): vscode.TreeItemCollapsibleState {
  if (isConnectionNode(node) || isSchemaNode(node)) {
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
  if (isSchemaNode(node)) {
    return "symbol-namespace";
  }
  return "table";
}

function isWelcomeNode(node: NodeData): node is WelcomeNode {
  return node.type === "welcome";
}

function isConnectionNode(node: NodeData): node is ConnectionNode {
  return node.type === "connection";
}

function isSchemaNode(node: NodeData): node is SchemaNode {
  return node.type === "schema";
}

function isTableNode(node: NodeData): node is TableNode {
  return node.type === "table";
}
