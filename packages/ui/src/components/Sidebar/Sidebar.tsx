import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Database, Table2, Columns, Plus, RefreshCw, MoreVertical, Plug, Unplug, FileQuestion } from "lucide-react";
import { getElectronAPI, type ConnectionInfo, type ElectronAPI } from "../../electron";
import { AddConnectionDialog } from "./AddConnectionDialog";
import clsx from "clsx";
import type { TableInfo, DatabaseConnectionConfig } from "@dbview/core";

interface SidebarProps {
  onTableSelect: (connectionKey: string, schema: string, table: string) => void;
  onQueryOpen: (connectionKey: string) => void;
  onERDiagramOpen: (connectionKey: string, schemas: string[]) => void;
  isVisible: boolean;
  width: number;
  onWidthChange: (width: number) => void;
}

interface TreeNode {
  id: string;
  type: "connection" | "schema" | "table";
  name: string;
  connectionKey?: string;
  schema?: string;
  children?: TreeNode[];
  status?: ConnectionInfo["status"];
  dbType?: string;
  isLoading?: boolean;
}

export function Sidebar({ onTableSelect, onQueryOpen, onERDiagramOpen, isVisible, width, onWidthChange }: SidebarProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  const api = getElectronAPI();

  // Load connections on mount
  useEffect(() => {
    loadConnections();

    // Subscribe to connection status changes
    const unsubscribe = api?.onConnectionStatusChange((data) => {
      setConnections((prev) =>
        prev.map((c) => (getConnectionKey(c.config) === data.connectionKey ? { ...c, status: data.status as any } : c))
      );
    });

    // Subscribe to menu events
    const unsubAddConnection = api?.onMenuAddConnection(() => setIsAddDialogOpen(true));

    return () => {
      unsubscribe?.();
      unsubAddConnection?.();
    };
  }, [api]);

  // Build tree data when connections change
  useEffect(() => {
    const nodes: TreeNode[] = connections.map((conn) => ({
      id: getConnectionKey(conn.config),
      type: "connection" as const,
      name: conn.config.name || getConnectionDisplayName(conn.config),
      connectionKey: getConnectionKey(conn.config),
      status: conn.status,
      dbType: conn.config.dbType,
      children: [],
    }));
    setTreeData(nodes);
  }, [connections]);

  const loadConnections = async () => {
    if (!api) return;
    try {
      const conns = await api.getConnections();
      setConnections(conns);
    } catch (error) {
      console.error("Failed to load connections:", error);
    }
  };

  const getConnectionKey = (config: Omit<DatabaseConnectionConfig, "password">): string => {
    const dbType = config.dbType || "postgres";
    if (config.name) return `${dbType}:${config.name}`;
    if ("filePath" in config) return `${dbType}:${(config as any).filePath}`;
    if ("host" in config) {
      return `${dbType}:${(config as any).user}@${(config as any).host}:${(config as any).port}/${(config as any).database}`;
    }
    return `${dbType}:${JSON.stringify(config)}`;
  };

  const getConnectionDisplayName = (config: Omit<DatabaseConnectionConfig, "password">): string => {
    if (config.name) return config.name;
    if ("database" in config) return String((config as any).database);
    if ("filePath" in config) return (config as any).filePath.split("/").pop() || "SQLite";
    return config.dbType;
  };

  const loadSchemas = useCallback(
    async (connectionKey: string): Promise<TreeNode[]> => {
      if (!api) return [];
      try {
        const schemas = await api.listSchemas(connectionKey);
        return schemas.map((schema) => ({
          id: `${connectionKey}:${schema}`,
          type: "schema" as const,
          name: schema,
          connectionKey,
          schema,
          children: [],
        }));
      } catch (error) {
        console.error("Failed to load schemas:", error);
        return [];
      }
    },
    [api]
  );

  const loadTables = useCallback(
    async (connectionKey: string, schema: string): Promise<TreeNode[]> => {
      if (!api) return [];
      try {
        const tables = await api.listTables(connectionKey, schema);
        return tables.map((table) => ({
          id: `${connectionKey}:${schema}:${table.name}`,
          type: "table" as const,
          name: table.name,
          connectionKey,
          schema,
        }));
      } catch (error) {
        console.error("Failed to load tables:", error);
        return [];
      }
    },
    [api]
  );

  const toggleNode = useCallback(
    async (node: TreeNode) => {
      const isExpanded = expandedNodes.has(node.id);

      if (isExpanded) {
        // Collapse
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      } else {
        // Expand and load children if needed
        setExpandedNodes((prev) => new Set(prev).add(node.id));

        if (node.type === "connection" && node.children?.length === 0) {
          // Connect and load schemas
          setLoadingNodes((prev) => new Set(prev).add(node.id));
          try {
            if (api && node.connectionKey) {
              await api.connectToDatabase(node.connectionKey);
              const schemas = await loadSchemas(node.connectionKey);
              setTreeData((prev) =>
                prev.map((n) => (n.id === node.id ? { ...n, children: schemas, status: "connected" } : n))
              );
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
        } else if (node.type === "schema" && node.children?.length === 0 && node.connectionKey && node.schema) {
          // Load tables
          setLoadingNodes((prev) => new Set(prev).add(node.id));
          try {
            const tables = await loadTables(node.connectionKey, node.schema);
            setTreeData((prev) =>
              prev.map((conn) => ({
                ...conn,
                children: conn.children?.map((schema) => (schema.id === node.id ? { ...schema, children: tables } : schema)),
              }))
            );
          } finally {
            setLoadingNodes((prev) => {
              const next = new Set(prev);
              next.delete(node.id);
              return next;
            });
          }
        }
      }
    },
    [expandedNodes, api, loadSchemas, loadTables]
  );

  const handleTableClick = (node: TreeNode) => {
    if (node.type === "table" && node.connectionKey && node.schema) {
      onTableSelect(node.connectionKey, node.schema, node.name);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleConnectionAdded = () => {
    setIsAddDialogOpen(false);
    loadConnections();
  };

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const hasChildren = node.type !== "table";

    const IconComponent = node.type === "connection" ? Database : node.type === "schema" ? Columns : Table2;

    const statusColor =
      node.status === "connected"
        ? "text-green-500"
        : node.status === "error"
          ? "text-red-500"
          : node.status === "connecting"
            ? "text-yellow-500"
            : "text-gray-400";

    return (
      <div key={node.id}>
        <div
          className={clsx(
            "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-vscode-list-hover text-sm",
            "select-none"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => (hasChildren ? toggleNode(node) : handleTableClick(node))}
          onDoubleClick={() => node.type === "table" && handleTableClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {hasChildren ? (
            isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )
          ) : (
            <span className="w-4" />
          )}
          <IconComponent className={clsx("w-4 h-4", node.type === "connection" ? statusColor : "text-gray-400")} />
          <span className="truncate flex-1">{node.name}</span>
          {node.type === "connection" && node.dbType && (
            <span className="text-xs text-gray-500 uppercase">{node.dbType}</span>
          )}
        </div>

        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.children.length === 0 && !isLoading && (
              <div className="text-xs text-gray-500 italic" style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}>
                {node.type === "connection" ? "No schemas" : "No tables"}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="h-full flex flex-col bg-vscode-sideBar border-r border-vscode-sideBar-border" style={{ width }}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-sideBar-border">
          <span className="text-sm font-medium text-vscode-sideBar-foreground">Connections</span>
          <div className="flex items-center gap-1">
            <button
              onClick={loadConnections}
              className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsAddDialogOpen(true)}
              className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground"
              title="Add Connection"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-auto">
          {treeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center">
              <Database className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No connections</p>
              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="mt-2 text-sm text-blue-500 hover:underline"
              >
                Add your first connection
              </button>
            </div>
          ) : (
            <div className="py-1">{treeData.map((node) => renderNode(node))}</div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onNewQuery={(connectionKey) => {
            onQueryOpen(connectionKey);
            setContextMenu(null);
          }}
          onDisconnect={async (connectionKey) => {
            await api?.disconnectFromDatabase(connectionKey);
            loadConnections();
            setContextMenu(null);
          }}
          onDelete={async (name) => {
            await api?.deleteConnection(name);
            loadConnections();
            setContextMenu(null);
          }}
        />
      )}

      {/* Add Connection Dialog */}
      <AddConnectionDialog isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} onSave={handleConnectionAdded} />
    </>
  );
}

// Context Menu Component
interface ContextMenuProps {
  x: number;
  y: number;
  node: TreeNode;
  onClose: () => void;
  onNewQuery: (connectionKey: string) => void;
  onDisconnect: (connectionKey: string) => void;
  onDelete: (name: string) => void;
}

function ContextMenu({ x, y, node, onClose, onNewQuery, onDisconnect, onDelete }: ContextMenuProps) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  if (node.type !== "connection") return null;

  return (
    <div
      className="fixed bg-vscode-menu-background border border-vscode-menu-border rounded shadow-lg py-1 z-50"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full px-4 py-1.5 text-left text-sm hover:bg-vscode-list-hover flex items-center gap-2"
        onClick={() => node.connectionKey && onNewQuery(node.connectionKey)}
      >
        <FileQuestion className="w-4 h-4" />
        New Query
      </button>
      {node.status === "connected" && (
        <button
          className="w-full px-4 py-1.5 text-left text-sm hover:bg-vscode-list-hover flex items-center gap-2"
          onClick={() => node.connectionKey && onDisconnect(node.connectionKey)}
        >
          <Unplug className="w-4 h-4" />
          Disconnect
        </button>
      )}
      <div className="border-t border-vscode-menu-border my-1" />
      <button
        className="w-full px-4 py-1.5 text-left text-sm hover:bg-vscode-list-hover text-red-400 flex items-center gap-2"
        onClick={() => onDelete(node.name)}
      >
        Delete Connection
      </button>
    </div>
  );
}
