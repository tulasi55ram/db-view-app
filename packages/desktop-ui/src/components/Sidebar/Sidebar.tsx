import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table2,
  Folder,
  Plus,
  RefreshCw,
  Unplug,
  Play,
  Trash2,
  Edit,
  Eye,
  Layers,
  Code2,
  Terminal,
  Box,
  Key,
  Link2,
  Hash,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { IconButton, Button } from "@/primitives";
import { Tooltip } from "@/primitives/Tooltip";
import { motion, AnimatePresence } from "framer-motion";
import * as ContextMenu from "@radix-ui/react-context-menu";

// Types
interface ConnectionInfo {
  config: {
    name: string;
    dbType: string;
    host?: string;
    port?: number;
    database?: string;
    color?: string;
  };
  status: "connected" | "disconnected" | "connecting" | "error";
  error?: string;
}

interface ObjectCounts {
  tables: number;
  views: number;
  materializedViews: number;
  functions: number;
  procedures: number;
  types: number;
}

interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
}

interface TableInfo {
  name: string;
  rowCount?: number;
  sizeBytes?: number;
}

type ObjectType = "tables" | "views" | "materializedViews" | "functions" | "procedures" | "types";

type TreeNodeType =
  | "connection"
  | "schema"
  | "objectTypeContainer"
  | "table"
  | "view"
  | "materializedView"
  | "function"
  | "procedure"
  | "type"
  | "column";

interface TreeNode {
  id: string;
  type: TreeNodeType;
  name: string;
  connectionKey?: string;
  connectionName?: string; // Display name for the connection
  schema?: string;
  table?: string;
  objectType?: ObjectType;
  count?: number;
  children?: TreeNode[];
  status?: ConnectionInfo["status"];
  dbType?: string;
  color?: string; // Connection color
  isLoading?: boolean;
  // Table metadata
  rowCount?: number;
  sizeBytes?: number;
  // Column metadata
  dataType?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyRef?: string | null;
  isNullable?: boolean;
}

interface SidebarProps {
  onTableSelect: (connectionKey: string, connectionName: string, schema: string, table: string) => void;
  onQueryOpen: (connectionKey: string, connectionName: string) => void;
  onAddConnection: () => void;
  onEditConnection: (connectionKey: string) => void;
  refreshTrigger?: number;
  expandConnectionKey?: string | null; // Connection to expand when Browse is clicked
}

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper to format row count
function formatRowCount(count: number): string {
  if (count < 1000) return `${count} rows`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K rows`;
  return `${(count / 1000000).toFixed(1)}M rows`;
}

export function Sidebar({ onTableSelect, onQueryOpen, onAddConnection, onEditConnection, refreshTrigger, expandConnectionKey }: SidebarProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const api = (window as any).electronAPI;

  // Load connections on mount and when refreshTrigger changes
  useEffect(() => {
    loadConnections();

    // Subscribe to connection status changes
    const unsubscribe = api?.onConnectionStatusChange?.((data: any) => {
      setConnections((prev) =>
        prev.map((c) =>
          getConnectionKey(c.config) === data.connectionKey
            ? { ...c, status: data.status }
            : c
        )
      );
    });

    return () => unsubscribe?.();
  }, [refreshTrigger]);

  // Build tree when connections change
  useEffect(() => {
    const nodes: TreeNode[] = connections.map((conn) => {
      const name = conn.config.name || getConnectionDisplayName(conn.config);
      return {
        id: getConnectionKey(conn.config),
        type: "connection" as const,
        name,
        connectionKey: getConnectionKey(conn.config),
        connectionName: name,
        status: conn.status,
        dbType: conn.config.dbType,
        color: conn.config.color,
        children: [],
      };
    });
    setTreeData(nodes);
  }, [connections]);

  const loadConnections = async () => {
    if (!api) return;
    setIsRefreshing(true);
    try {
      const conns = await api.getConnections();
      setConnections(conns);
    } catch (error) {
      console.error("Failed to load connections:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getConnectionKey = (config: any): string => {
    const dbType = config.dbType || "postgres";
    if (config.name) return `${dbType}:${config.name}`;
    if (config.filePath) return `${dbType}:${config.filePath}`;
    if (config.host) {
      return `${dbType}:${config.user}@${config.host}:${config.port}/${config.database}`;
    }
    return `${dbType}:${JSON.stringify(config)}`;
  };

  const getConnectionDisplayName = (config: any): string => {
    if (config.name) return config.name;
    if (config.database) return String(config.database);
    if (config.filePath) return config.filePath.split("/").pop() || "SQLite";
    return config.dbType;
  };

  const loadSchemas = async (connectionKey: string, connectionName: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      const schemas = await api.listSchemas(connectionKey);
      return schemas.map((schema: string) => ({
        id: `${connectionKey}:schema:${schema}`,
        type: "schema" as const,
        name: schema,
        connectionKey,
        connectionName,
        schema,
        children: [],
      }));
    } catch (error) {
      console.error("Failed to load schemas:", error);
      return [];
    }
  };

  const loadObjectTypeContainers = async (connectionKey: string, connectionName: string, schema: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      const counts: ObjectCounts = await api.getObjectCounts(connectionKey, schema);
      const containers: TreeNode[] = [
        { id: `${connectionKey}:${schema}:tables`, type: "objectTypeContainer", name: "Tables", objectType: "tables", count: counts.tables, connectionKey, connectionName, schema, children: [] },
        { id: `${connectionKey}:${schema}:views`, type: "objectTypeContainer", name: "Views", objectType: "views", count: counts.views, connectionKey, connectionName, schema, children: [] },
        { id: `${connectionKey}:${schema}:materializedViews`, type: "objectTypeContainer", name: "Materialized Views", objectType: "materializedViews", count: counts.materializedViews, connectionKey, connectionName, schema, children: [] },
        { id: `${connectionKey}:${schema}:functions`, type: "objectTypeContainer", name: "Functions", objectType: "functions", count: counts.functions, connectionKey, connectionName, schema, children: [] },
        { id: `${connectionKey}:${schema}:procedures`, type: "objectTypeContainer", name: "Procedures", objectType: "procedures", count: counts.procedures, connectionKey, connectionName, schema, children: [] },
        { id: `${connectionKey}:${schema}:types`, type: "objectTypeContainer", name: "Types", objectType: "types", count: counts.types, connectionKey, connectionName, schema, children: [] },
      ];
      return containers;
    } catch (error) {
      console.error("Failed to load object counts:", error);
      return [];
    }
  };

  const loadObjectsForType = async (connectionKey: string, connectionName: string, schema: string, objectType: ObjectType): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      switch (objectType) {
        case "tables": {
          const tables: TableInfo[] = await api.listTables(connectionKey, schema);
          return tables.map((table) => ({
            id: `${connectionKey}:${schema}:table:${table.name}`,
            type: "table" as const,
            name: table.name,
            connectionKey,
            connectionName,
            schema,
            table: table.name,
            rowCount: table.rowCount,
            sizeBytes: table.sizeBytes,
            children: [],
          }));
        }
        case "views": {
          const views: string[] = await api.listViews(connectionKey, schema);
          return views.map((name) => ({
            id: `${connectionKey}:${schema}:view:${name}`,
            type: "view" as const,
            name,
            connectionKey,
            connectionName,
            schema,
          }));
        }
        case "materializedViews": {
          const matViews: string[] = await api.listMaterializedViews(connectionKey, schema);
          return matViews.map((name) => ({
            id: `${connectionKey}:${schema}:matview:${name}`,
            type: "materializedView" as const,
            name,
            connectionKey,
            connectionName,
            schema,
          }));
        }
        case "functions": {
          const functions: string[] = await api.listFunctions(connectionKey, schema);
          return functions.map((name) => ({
            id: `${connectionKey}:${schema}:function:${name}`,
            type: "function" as const,
            name,
            connectionKey,
            connectionName,
            schema,
          }));
        }
        case "procedures": {
          const procedures: string[] = await api.listProcedures(connectionKey, schema);
          return procedures.map((name) => ({
            id: `${connectionKey}:${schema}:procedure:${name}`,
            type: "procedure" as const,
            name,
            connectionKey,
            connectionName,
            schema,
          }));
        }
        case "types": {
          const types: string[] = await api.listTypes(connectionKey, schema);
          return types.map((name) => ({
            id: `${connectionKey}:${schema}:type:${name}`,
            type: "type" as const,
            name,
            connectionKey,
            connectionName,
            schema,
          }));
        }
        default:
          return [];
      }
    } catch (error) {
      console.error(`Failed to load ${objectType}:`, error);
      return [];
    }
  };

  const loadColumns = async (connectionKey: string, connectionName: string, schema: string, table: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      const columns: ColumnInfo[] = await api.listColumns(connectionKey, schema, table);
      return columns.map((col) => ({
        id: `${connectionKey}:${schema}:${table}:column:${col.name}`,
        type: "column" as const,
        name: col.name,
        connectionKey,
        connectionName,
        schema,
        table,
        dataType: col.dataType,
        isPrimaryKey: col.isPrimaryKey,
        isForeignKey: col.isForeignKey,
        foreignKeyRef: col.foreignKeyRef,
        isNullable: col.isNullable,
      }));
    } catch (error) {
      console.error("Failed to load columns:", error);
      return [];
    }
  };

  // Helper function to update tree data
  const updateTreeNode = (nodes: TreeNode[], nodeId: string, update: Partial<TreeNode>): TreeNode[] => {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, ...update };
      }
      if (node.children) {
        return { ...node, children: updateTreeNode(node.children, nodeId, update) };
      }
      return node;
    });
  };

  const toggleNode = useCallback(
    async (node: TreeNode) => {
      const isExpanded = expandedNodes.has(node.id);

      if (isExpanded) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
        return;
      }

      // Expand node
      setExpandedNodes((prev) => new Set(prev).add(node.id));

      // Load children if needed
      if (node.type === "connection" && (!node.children || node.children.length === 0)) {
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          if (api && node.connectionKey && node.connectionName) {
            await api.connectToDatabase(node.connectionKey);
            const schemas = await loadSchemas(node.connectionKey, node.connectionName);
            setTreeData((prev) => updateTreeNode(prev, node.id, { children: schemas, status: "connected" }));
          }
        } catch (error) {
          console.error("Failed to connect:", error);
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      } else if (node.type === "schema" && (!node.children || node.children.length === 0) && node.connectionKey && node.connectionName && node.schema) {
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          const containers = await loadObjectTypeContainers(node.connectionKey, node.connectionName, node.schema);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: containers }));
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      } else if (node.type === "objectTypeContainer" && (!node.children || node.children.length === 0) && node.connectionKey && node.connectionName && node.schema && node.objectType && (node.count ?? 0) > 0) {
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          const objects = await loadObjectsForType(node.connectionKey, node.connectionName, node.schema, node.objectType);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: objects }));
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      } else if (node.type === "table" && (!node.children || node.children.length === 0) && node.connectionKey && node.connectionName && node.schema && node.table) {
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          const columns = await loadColumns(node.connectionKey, node.connectionName, node.schema, node.table);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: columns }));
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            return next;
          });
        }
      }
    },
    [expandedNodes, api]
  );

  // Handle expandConnectionKey prop - expand connection when Browse is clicked
  useEffect(() => {
    if (!expandConnectionKey || treeData.length === 0) return;

    const connectionNode = treeData.find((node) => node.connectionKey === expandConnectionKey);
    if (!connectionNode) return;

    // Only expand if not already expanded
    if (!expandedNodes.has(connectionNode.id)) {
      toggleNode(connectionNode);
    }
  }, [expandConnectionKey, treeData, expandedNodes, toggleNode]);

  const handleTableClick = (node: TreeNode) => {
    if ((node.type === "table" || node.type === "view") && node.connectionKey && node.connectionName && node.schema) {
      // For tables, use node.table; for views, use node.name
      const tableName = node.type === "table" ? (node.table || node.name) : node.name;
      onTableSelect(node.connectionKey, node.connectionName, node.schema, tableName);
    }
  };

  const handleDisconnect = async (connectionKey: string) => {
    await api?.disconnectFromDatabase(connectionKey);
    loadConnections();
  };

  const handleDelete = async (name: string) => {
    await api?.deleteConnection(name);
    loadConnections();
  };

  // Get icon for node type
  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case "connection":
        return Database;
      case "schema":
        return Folder;
      case "objectTypeContainer":
        switch (node.objectType) {
          case "tables": return Table2;
          case "views": return Eye;
          case "materializedViews": return Layers;
          case "functions": return Code2;
          case "procedures": return Terminal;
          case "types": return Box;
          default: return Folder;
        }
      case "table":
        return Table2;
      case "view":
        return Eye;
      case "materializedView":
        return Layers;
      case "function":
        return Code2;
      case "procedure":
        return Terminal;
      case "type":
        return Box;
      case "column":
        if (node.isPrimaryKey) return Key;
        if (node.isForeignKey) return Link2;
        return Hash;
      default:
        return Folder;
    }
  };

  // Get icon color
  const getIconColor = (node: TreeNode): string => {
    switch (node.type) {
      case "connection":
        switch (node.status) {
          case "connected": return "text-emerald-400";
          case "connecting": return "text-yellow-400";
          case "error": return "text-red-400";
          default: return "text-text-tertiary";
        }
      case "schema":
        return "text-purple-400";
      case "objectTypeContainer":
        switch (node.objectType) {
          case "tables": return "text-blue-400";
          case "views": return "text-orange-400";
          case "materializedViews": return "text-purple-400";
          case "functions": return "text-yellow-400";
          case "procedures": return "text-red-400";
          case "types": return "text-emerald-400";
          default: return "text-text-secondary";
        }
      case "table":
        return "text-blue-400";
      case "view":
        return "text-orange-400";
      case "materializedView":
        return "text-purple-400";
      case "function":
        return "text-yellow-400";
      case "procedure":
        return "text-red-400";
      case "type":
        return "text-emerald-400";
      case "column":
        if (node.isPrimaryKey) return "text-yellow-400";
        if (node.isForeignKey) return "text-purple-400";
        return "text-text-secondary";
      default:
        return "text-text-secondary";
    }
  };

  // Check if node is expandable
  const isExpandable = (node: TreeNode): boolean => {
    switch (node.type) {
      case "connection":
      case "schema":
      case "table":
        return true;
      case "objectTypeContainer":
        return (node.count ?? 0) > 0;
      default:
        return false;
    }
  };

  // Get node description
  const getNodeDescription = (node: TreeNode): string | null => {
    switch (node.type) {
      case "connection":
        return node.dbType?.toUpperCase() || null;
      case "objectTypeContainer":
        return `(${node.count})`;
      case "table":
        const parts: string[] = [];
        if (node.rowCount !== undefined) parts.push(formatRowCount(node.rowCount));
        if (node.sizeBytes !== undefined) parts.push(formatBytes(node.sizeBytes));
        return parts.length > 0 ? parts.join(" · ") : null;
      case "column":
        const constraints: string[] = [];
        if (node.isPrimaryKey) constraints.push("PK");
        if (node.isForeignKey) constraints.push("FK");
        if (!node.isNullable) constraints.push("NOT NULL");
        const typeStr = node.dataType || "";
        return constraints.length > 0 ? `${typeStr} [${constraints.join(", ")}]` : typeStr;
      default:
        return null;
    }
  };

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const hasChildren = isExpandable(node);

    const IconComponent = getNodeIcon(node);
    const iconColor = getIconColor(node);
    const description = getNodeDescription(node);

    // Determine the click behavior based on node type
    const handleNodeClick = () => {
      // For tables and views, open the data instead of expanding
      if (node.type === "table" || node.type === "view") {
        handleTableClick(node);
      } else if (hasChildren) {
        toggleNode(node);
      }
    };

    const handleChevronClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNode(node);
    };

    return (
      <div key={node.id}>
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm relative",
                "hover:bg-bg-hover transition-colors duration-fast",
                "select-none group"
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={handleNodeClick}
            >
              {/* Color indicator for connections */}
              {node.type === "connection" && node.color && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{ backgroundColor: node.color }}
                />
              )}

              {/* Expand/Collapse Icon */}
              {hasChildren ? (
                isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-text-tertiary flex-shrink-0" />
                ) : isExpanded ? (
                  <div
                    className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0 hover:text-text-primary cursor-pointer"
                    onClick={handleChevronClick}
                  >
                    <ChevronDown className="w-full h-full" />
                  </div>
                ) : (
                  <div
                    className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0 hover:text-text-primary cursor-pointer"
                    onClick={handleChevronClick}
                  >
                    <ChevronRight className="w-full h-full" />
                  </div>
                )
              ) : (
                <span className="w-3.5 flex-shrink-0" />
              )}

              {/* Connection color dot (optional, as an alternative to the left bar) */}
              {node.type === "connection" && node.color && (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: node.color }}
                />
              )}

              {/* Node Icon */}
              <IconComponent className={cn("w-4 h-4 flex-shrink-0", iconColor)} />

              {/* Node Name */}
              <span className="truncate flex-1 text-text-primary">{node.name}</span>

              {/* Description */}
              {description && (
                <span className="text-2xs text-text-tertiary truncate max-w-[120px]">
                  {description}
                </span>
              )}
            </div>
          </ContextMenu.Trigger>

          {/* Context Menu for Connections */}
          {node.type === "connection" && (
            <ContextMenu.Portal>
              <ContextMenu.Content
                className={cn(
                  "min-w-[160px] py-1 rounded-md",
                  "bg-bg-tertiary border border-border shadow-panel",
                  "animate-scale-in origin-top-left z-50"
                )}
              >
                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                  onSelect={() => node.connectionKey && node.connectionName && onQueryOpen(node.connectionKey, node.connectionName)}
                >
                  <Play className="w-3.5 h-3.5" />
                  New Query
                </ContextMenu.Item>

                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                  onSelect={() => node.connectionKey && onEditConnection(node.connectionKey)}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Connection
                </ContextMenu.Item>

                {node.status === "connected" && (
                  <ContextMenu.Item
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                    onSelect={() => node.connectionKey && handleDisconnect(node.connectionKey)}
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    Disconnect
                  </ContextMenu.Item>
                )}

                <ContextMenu.Separator className="h-px bg-border my-1" />

                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none text-error"
                  onSelect={() => handleDelete(node.name)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          )}

          {/* Context Menu for Tables */}
          {node.type === "table" && (
            <ContextMenu.Portal>
              <ContextMenu.Content
                className={cn(
                  "min-w-[160px] py-1 rounded-md",
                  "bg-bg-tertiary border border-border shadow-panel",
                  "animate-scale-in origin-top-left z-50"
                )}
              >
                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                  onSelect={() => handleTableClick(node)}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Open Table
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                  onSelect={() => node.connectionKey && node.connectionName && onQueryOpen(node.connectionKey, node.connectionName)}
                >
                  <Play className="w-3.5 h-3.5" />
                  New Query
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          )}
        </ContextMenu.Root>

        {/* Children */}
        <AnimatePresence>
          {isExpanded && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {node.children.map((child) => renderNode(child, depth + 1))}
              {node.children.length === 0 && !isLoading && (
                <div
                  className="text-xs text-text-tertiary italic py-1"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
                >
                  {node.type === "connection" && "No schemas"}
                  {node.type === "schema" && "Loading..."}
                  {node.type === "objectTypeContainer" && "Empty"}
                  {node.type === "table" && "No columns"}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Connections
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip content="Refresh">
            <IconButton
              icon={<RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />}
              size="sm"
              aria-label="Refresh connections"
              onClick={loadConnections}
            />
          </Tooltip>
          <Tooltip content="Add Connection">
            <IconButton
              icon={<Plus className="w-3.5 h-3.5" />}
              size="sm"
              aria-label="Add connection"
              onClick={onAddConnection}
            />
          </Tooltip>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary p-4 text-center">
            <Database className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm mb-2">No connections</p>
            <Button size="sm" onClick={onAddConnection} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Connection
            </Button>
          </div>
        ) : (
          treeData.map((node) => renderNode(node))
        )}
      </div>
    </div>
  );
}
