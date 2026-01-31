import { useState, useEffect, useCallback, useRef } from "react";
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
  Lock,
  GitBranch,
  WifiOff,
  Wifi,
  GripVertical,
  Copy,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { IconButton, Button } from "@/primitives";
import { Tooltip } from "@/primitives/Tooltip";
import { useTheme } from "@/design-system";
import { motion, AnimatePresence } from "framer-motion";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { toast } from "sonner";
import { RedisSidebarTree } from "./RedisSidebarTree";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Types
interface ConnectionInfo {
  config: {
    name: string;
    dbType: string;
    host?: string;
    port?: number;
    database?: string;
    color?: string;
    readOnly?: boolean;
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
  | "database"
  | "schema"
  | "objectTypeContainer"
  | "table"
  | "view"
  | "materializedView"
  | "function"
  | "procedure"
  | "trigger"
  | "type"
  | "column";

interface TreeNode {
  id: string;
  type: TreeNodeType;
  name: string;
  connectionKey?: string;
  connectionName?: string; // Display name for the connection
  database?: string; // Database name (for multi-database connections)
  schema?: string;
  table?: string;
  objectType?: ObjectType;
  count?: number;
  children?: TreeNode[];
  status?: ConnectionInfo["status"];
  dbType?: string;
  color?: string; // Connection color
  readOnly?: boolean; // Connection read-only status
  isLoading?: boolean;
  showAllDatabases?: boolean; // Whether connection shows all databases
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
  onTableSelect: (connectionKey: string, connectionName: string, schema: string, table: string, database?: string) => void;
  onFunctionSelect?: (connectionKey: string, connectionName: string, schema: string, functionName: string, functionType: 'function' | 'procedure' | 'aggregate' | 'window' | 'trigger', database?: string) => void;
  onQueryOpen: (connectionKey: string, connectionName: string) => void;
  onERDiagramOpen?: (connectionKey: string, connectionName: string, schemas: string[]) => void;
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

// Sortable connection item props
interface SortableConnectionItemProps {
  node: TreeNode;
  children: (props: { attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode;
}

// Sortable wrapper for connection nodes
function SortableConnectionItem({ node, children }: SortableConnectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "shadow-lg rounded-md bg-bg-secondary")}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// Helper to format row count - uses "docs" for MongoDB/Elasticsearch, "rows" for SQL DBs
function formatRowCount(count: number, dbType?: string): string {
  const isDocumentDB = dbType === "mongodb" || dbType === "elasticsearch";
  const unit = isDocumentDB ? "docs" : "rows";
  if (count < 1000) return `${count} ${unit}`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K ${unit}`;
  return `${(count / 1000000).toFixed(1)}M ${unit}`;
}

export function Sidebar({ onTableSelect, onFunctionSelect, onQueryOpen, onERDiagramOpen, onAddConnection, onEditConnection, refreshTrigger, expandConnectionKey }: SidebarProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [connectionOrder, setConnectionOrder] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Theme toggle
  const { resolvedTheme, toggleTheme } = useTheme();

  // Track previous status for notifications
  const previousStatusRef = useRef<Map<string, ConnectionInfo["status"]>>(new Map());

  const api = (window as any).electronAPI;

  // DnD sensors for connection reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load connections on mount and when refreshTrigger changes
  useEffect(() => {
    loadConnections();

    // Track last error toast time to prevent spamming
    const lastErrorToastTime = new Map<string, number>();
    const ERROR_TOAST_THROTTLE_MS = 10000; // Only show error toast once per 10 seconds per connection

    // Subscribe to connection status changes
    const unsubscribe = api?.onConnectionStatusChange?.((data: any) => {
      const { connectionKey, status, connectionName } = data;
      const previousStatus = previousStatusRef.current.get(connectionKey);

      // Show toast notifications for status changes
      if (previousStatus && previousStatus !== status) {
        const name = connectionName || connectionKey.split(':').pop() || 'Connection';

        if (status === 'disconnected' && previousStatus === 'connected') {
          toast.error(`Connection lost: ${name}`, {
            description: 'The database connection was lost',
            icon: <WifiOff className="w-4 h-4" />,
            duration: 5000,
          });
        } else if (status === 'connected' && (previousStatus === 'disconnected' || previousStatus === 'error')) {
          toast.success(`Connection restored: ${name}`, {
            description: 'Database connection re-established',
            icon: <Wifi className="w-4 h-4" />,
            duration: 3000,
          });
        } else if (status === 'error' && previousStatus !== 'error') {
          // Only show error toast if we weren't already in error state
          // and if we haven't shown an error toast recently
          const now = Date.now();
          const lastToastTime = lastErrorToastTime.get(connectionKey) || 0;

          if (now - lastToastTime > ERROR_TOAST_THROTTLE_MS) {
            toast.error(`Connection error: ${name}`, {
              description: data.error || 'An error occurred with the database connection',
              icon: <WifiOff className="w-4 h-4" />,
              duration: 5000,
            });
            lastErrorToastTime.set(connectionKey, now);
          }
        }
      }

      // Update status tracking
      previousStatusRef.current.set(connectionKey, status);

      setConnections((prev) =>
        prev.map((c) =>
          getConnectionKey(c.config) === connectionKey
            ? { ...c, status }
            : c
        )
      );
    });

    return () => unsubscribe?.();
  }, [refreshTrigger]);

  // Build tree when connections change, respecting saved order
  // IMPORTANT: Preserve existing children (schemas, tables, etc.) when rebuilding
  useEffect(() => {
    setTreeData((prevTreeData) => {
      // Create a map of existing nodes to preserve their children
      const existingNodesMap = new Map<string, TreeNode>();
      prevTreeData.forEach((node) => {
        existingNodesMap.set(node.id, node);
      });

      const nodes: TreeNode[] = connections.map((conn) => {
        const name = conn.config.name || getConnectionDisplayName(conn.config);
        const nodeId = getConnectionKey(conn.config);
        const existingNode = existingNodesMap.get(nodeId);
        const showAllDatabases = (conn.config as any).showAllDatabases;

        return {
          id: nodeId,
          type: "connection" as const,
          name,
          connectionKey: nodeId,
          connectionName: name,
          status: conn.status,
          dbType: conn.config.dbType,
          color: conn.config.color,
          readOnly: conn.config.readOnly,
          showAllDatabases,
          // Preserve existing children if they exist
          children: existingNode?.children || [],
        };
      });

      // Sort nodes based on saved order
      if (connectionOrder.length > 0) {
        nodes.sort((a, b) => {
          const indexA = connectionOrder.indexOf(a.id);
          const indexB = connectionOrder.indexOf(b.id);
          // If not in order array, put at the end
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      return nodes;
    });
  }, [connections, connectionOrder]);

  const loadConnections = async () => {
    if (!api) return;
    setIsRefreshing(true);
    try {
      const conns = await api.getConnections();
      setConnections(conns);

      // Load saved connection order
      const savedOrder = await api.getConnectionOrder?.() || [];
      setConnectionOrder(savedOrder);

      // Initialize status tracking for notifications
      conns.forEach((conn: ConnectionInfo) => {
        const key = getConnectionKey(conn.config);
        if (!previousStatusRef.current.has(key)) {
          previousStatusRef.current.set(key, conn.status);
        }
      });
    } catch (error) {
      console.error("Failed to load connections:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle drag end for connection reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = treeData.findIndex((node) => node.id === active.id);
      const newIndex = treeData.findIndex((node) => node.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedData = arrayMove(treeData, oldIndex, newIndex);
        setTreeData(reorderedData);

        // Save the new order
        const newOrder = reorderedData.map((node) => node.id);
        setConnectionOrder(newOrder);

        // Persist to storage
        await api?.saveConnectionOrder?.(newOrder);
      }
    }
  }, [treeData, api]);

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

  const loadDatabases = async (connectionKey: string, connectionName: string, dbType?: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      const databases = await api.listDatabases(connectionKey);
      return databases.map((database: string) => ({
        id: `${connectionKey}:database:${database}`,
        type: "database" as const,
        name: database,
        connectionKey,
        connectionName,
        database,
        dbType,
        children: [],
      }));
    } catch (error) {
      console.error("Failed to load databases:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load databases: ${errorMessage}`);
      return [];
    }
  };

  const loadSchemas = async (connectionKey: string, connectionName: string, database?: string, dbType?: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      const schemas = await api.listSchemas(connectionKey, database);
      return schemas.map((schema: string) => ({
        id: `${connectionKey}:${database ? `database:${database}:` : ''}schema:${schema}`,
        type: "schema" as const,
        name: schema,
        connectionKey,
        connectionName,
        database,
        schema,
        dbType,
        children: [],
      }));
    } catch (error) {
      console.error("Failed to load schemas:", error);
      return [];
    }
  };

  const loadObjectTypeContainers = async (connectionKey: string, connectionName: string, schema: string, dbType?: string, database?: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      const counts: ObjectCounts = await api.getObjectCounts(connectionKey, schema, database);

      // Use appropriate terminology and show only relevant items based on database type
      const isMongoDB = dbType === "mongodb";
      const isRedis = dbType === "redis";
      const isElasticsearch = dbType === "elasticsearch";

      // For MongoDB, only show Collections (and optionally Views for aggregation pipelines)
      if (isMongoDB) {
        const containers: TreeNode[] = [
          { id: `${connectionKey}:${schema}:tables`, type: "objectTypeContainer", name: "Collections", objectType: "tables", count: counts.tables, connectionKey, connectionName, schema, dbType, database, children: [] },
        ];
        // Only show Views if there are any (MongoDB aggregation views)
        if (counts.views > 0) {
          containers.push({ id: `${connectionKey}:${schema}:views`, type: "objectTypeContainer", name: "Views", objectType: "views", count: counts.views, connectionKey, connectionName, schema, dbType, database, children: [] });
        }
        return containers;
      }

      // For Elasticsearch, only show Indices
      if (isElasticsearch) {
        const containers: TreeNode[] = [
          { id: `${connectionKey}:${schema}:tables`, type: "objectTypeContainer", name: "Indices", objectType: "tables", count: counts.tables, connectionKey, connectionName, schema, dbType, database, children: [] },
        ];
        return containers;
      }

      // For Redis, only show Keys
      if (isRedis) {
        const containers: TreeNode[] = [
          { id: `${connectionKey}:${schema}:tables`, type: "objectTypeContainer", name: "Keys", objectType: "tables", count: counts.tables, connectionKey, connectionName, schema, dbType, database, children: [] },
        ];
        return containers;
      }

      // For Cassandra, show Tables, Materialized Views, Functions, and User-Defined Types
      // Cassandra doesn't have stored procedures or regular views (only materialized views)
      const isCassandra = dbType === "cassandra";
      if (isCassandra) {
        const cassandraDbPrefix = database ? `database:${database}:` : '';
        const containers: TreeNode[] = [
          { id: `${connectionKey}:${cassandraDbPrefix}${schema}:tables`, type: "objectTypeContainer", name: "Tables", objectType: "tables", count: counts.tables, connectionKey, connectionName, schema, dbType, database, children: [] },
        ];
        // Only show Materialized Views if there are any
        if (counts.materializedViews > 0) {
          containers.push({ id: `${connectionKey}:${cassandraDbPrefix}${schema}:materializedViews`, type: "objectTypeContainer", name: "Materialized Views", objectType: "materializedViews", count: counts.materializedViews, connectionKey, connectionName, schema, dbType, database, children: [] });
        }
        // Only show Functions (UDFs) if there are any
        if (counts.functions > 0) {
          containers.push({ id: `${connectionKey}:${cassandraDbPrefix}${schema}:functions`, type: "objectTypeContainer", name: "Functions", objectType: "functions", connectionKey, connectionName, schema, dbType, database, children: [] });
        }
        // Only show User-Defined Types if there are any
        if (counts.types > 0) {
          containers.push({ id: `${connectionKey}:${cassandraDbPrefix}${schema}:types`, type: "objectTypeContainer", name: "User-Defined Types", objectType: "types", count: counts.types, connectionKey, connectionName, schema, dbType, database, children: [] });
        }
        return containers;
      }

      // For SQL databases, show all object types
      // Include database in ID when in showAllDatabases mode to avoid conflicts
      const dbPrefix = database ? `database:${database}:` : '';
      const containers: TreeNode[] = [
        { id: `${connectionKey}:${dbPrefix}${schema}:tables`, type: "objectTypeContainer", name: "Tables", objectType: "tables", count: counts.tables, connectionKey, connectionName, schema, dbType, database, children: [] },
        { id: `${connectionKey}:${dbPrefix}${schema}:views`, type: "objectTypeContainer", name: "Views", objectType: "views", count: counts.views, connectionKey, connectionName, schema, dbType, database, children: [] },
        { id: `${connectionKey}:${dbPrefix}${schema}:materializedViews`, type: "objectTypeContainer", name: "Materialized Views", objectType: "materializedViews", count: counts.materializedViews, connectionKey, connectionName, schema, dbType, database, children: [] },
        { id: `${connectionKey}:${dbPrefix}${schema}:functions`, type: "objectTypeContainer", name: "Functions", objectType: "functions", count: counts.functions, connectionKey, connectionName, schema, dbType, database, children: [] },
        { id: `${connectionKey}:${dbPrefix}${schema}:procedures`, type: "objectTypeContainer", name: "Procedures", objectType: "procedures", count: counts.procedures, connectionKey, connectionName, schema, dbType, database, children: [] },
        { id: `${connectionKey}:${dbPrefix}${schema}:types`, type: "objectTypeContainer", name: "Types", objectType: "types", count: counts.types, connectionKey, connectionName, schema, dbType, database, children: [] },
      ];
      return containers;
    } catch (error) {
      console.error("Failed to load object counts:", error);
      return [];
    }
  };

  const loadObjectsForType = async (connectionKey: string, connectionName: string, schema: string, objectType: ObjectType, dbType?: string, database?: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      // Include database in ID when in showAllDatabases mode to avoid conflicts
      const dbPrefix = database ? `database:${database}:` : '';
      switch (objectType) {
        case "tables": {
          const tables: TableInfo[] = await api.listTables(connectionKey, schema, database);
          return tables.map((table) => ({
            id: `${connectionKey}:${dbPrefix}${schema}:table:${table.name}`,
            type: "table" as const,
            name: table.name,
            connectionKey,
            connectionName,
            schema,
            database,
            dbType,
            table: table.name,
            rowCount: table.rowCount,
            sizeBytes: table.sizeBytes,
            children: [],
          }));
        }
        case "views": {
          const views: string[] = await api.listViews(connectionKey, schema, database);
          return views.map((name) => ({
            id: `${connectionKey}:${dbPrefix}${schema}:view:${name}`,
            type: "view" as const,
            name,
            connectionKey,
            connectionName,
            schema,
            database,
            dbType,
          }));
        }
        case "materializedViews": {
          const matViews: string[] = await api.listMaterializedViews(connectionKey, schema, database);
          return matViews.map((name) => ({
            id: `${connectionKey}:${dbPrefix}${schema}:matview:${name}`,
            type: "materializedView" as const,
            name,
            connectionKey,
            connectionName,
            schema,
            database,
            dbType,
          }));
        }
        case "functions": {
          const functions: string[] = await api.listFunctions(connectionKey, schema, database);
          return functions.map((name) => ({
            id: `${connectionKey}:${dbPrefix}${schema}:function:${name}`,
            type: "function" as const,
            name,
            connectionKey,
            connectionName,
            schema,
            database,
            dbType,
          }));
        }
        case "procedures": {
          const procedures: string[] = await api.listProcedures(connectionKey, schema, database);
          return procedures.map((name) => ({
            id: `${connectionKey}:${dbPrefix}${schema}:procedure:${name}`,
            type: "procedure" as const,
            name,
            connectionKey,
            connectionName,
            schema,
            database,
            dbType,
          }));
        }
        case "types": {
          const types: string[] = await api.listTypes(connectionKey, schema, database);
          return types.map((name) => ({
            id: `${connectionKey}:${dbPrefix}${schema}:type:${name}`,
            type: "type" as const,
            name,
            connectionKey,
            connectionName,
            schema,
            database,
            dbType,
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

  const loadColumns = async (connectionKey: string, connectionName: string, schema: string, table: string, database?: string): Promise<TreeNode[]> => {
    if (!api) return [];
    try {
      // Include database in ID when in showAllDatabases mode to avoid conflicts
      const dbPrefix = database ? `database:${database}:` : '';
      const columns: ColumnInfo[] = await api.listColumns(connectionKey, schema, table, database);
      return columns.map((col) => ({
        id: `${connectionKey}:${dbPrefix}${schema}:${table}:column:${col.name}`,
        type: "column" as const,
        name: col.name,
        connectionKey,
        connectionName,
        schema,
        table,
        database,
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

  // Helper function to find database for a node by traversing up the tree
  const findDatabaseForNode = (nodes: TreeNode[], nodeId: string): string | undefined => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node.database;
      }
      if (node.children) {
        const result = findDatabaseForNode(node.children, nodeId);
        if (result !== undefined) {
          return result;
        }
        // If this node has a database and we're searching in its children, return this node's database
        if (node.database && node.children.some(child => findNodeById(child, nodeId))) {
          return node.database;
        }
      }
    }
    return undefined;
  };

  // Helper to check if a node or its descendants contain a specific ID
  const findNodeById = (node: TreeNode, nodeId: string): boolean => {
    if (node.id === nodeId) return true;
    if (node.children) {
      return node.children.some(child => findNodeById(child, nodeId));
    }
    return false;
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

            // Check if this is a NoSQL database that doesn't use schemas
            // Cassandra uses keyspaces instead of schemas, so we treat it like other NoSQL DBs
            const noSchemaDatabases = ["mongodb", "redis", "elasticsearch", "cassandra"];
            const isNoSchemaDb = noSchemaDatabases.includes(node.dbType || "");

            if (isNoSchemaDb) {
              // For MongoDB/Redis/Elasticsearch/Cassandra, load object type containers directly (no schema level)
              // Use empty string as the "schema" since these DBs don't have schemas
              const containers = await loadObjectTypeContainers(node.connectionKey, node.connectionName, "", node.dbType);
              setTreeData((prev) => updateTreeNode(prev, node.id, { children: containers, status: "connected" }));
            } else if (node.showAllDatabases) {
              // For SQL databases with showAllDatabases, load database list first
              const databases = await loadDatabases(node.connectionKey, node.connectionName, node.dbType);
              setTreeData((prev) => updateTreeNode(prev, node.id, { children: databases, status: "connected" }));
            } else {
              // For SQL databases, load schemas first
              const schemas = await loadSchemas(node.connectionKey, node.connectionName, undefined, node.dbType);
              setTreeData((prev) => updateTreeNode(prev, node.id, { children: schemas, status: "connected" }));
            }
          }
        } catch (error) {
          console.error("Failed to connect:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Connection failed: ${errorMessage}`);
          // Update node status to show error
          setTreeData((prev) => updateTreeNode(prev, node.id, { status: "error" }));
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      } else if (node.type === "database" && (!node.children || node.children.length === 0) && node.connectionKey && node.connectionName && node.database) {
        // Handle database node expansion - load schemas for this database
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          const schemas = await loadSchemas(node.connectionKey, node.connectionName, node.database, node.dbType);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: schemas }));
        } catch (error) {
          console.error("Failed to load database schemas:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to load database schemas: ${errorMessage}`);
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
          const containers = await loadObjectTypeContainers(node.connectionKey, node.connectionName, node.schema, node.dbType, node.database);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: containers }));
        } catch (error) {
          console.error("Failed to load schema objects:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to load schema objects: ${errorMessage}`);
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      } else if (node.type === "objectTypeContainer" && (!node.children || node.children.length === 0) && node.connectionKey && node.connectionName && node.schema !== undefined && node.objectType && (node.count ?? 0) > 0) {
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          // Get database from the parent schema node if in showAllDatabases mode
          // We need to traverse up to find the database
          const database = node.database || findDatabaseForNode(treeData, node.id);
          const objects = await loadObjectsForType(node.connectionKey, node.connectionName, node.schema, node.objectType, node.dbType, database);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: objects }));
        } catch (error) {
          console.error("Failed to load objects:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to load objects: ${errorMessage}`);
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      } else if (node.type === "table" && (!node.children || node.children.length === 0) && node.connectionKey && node.connectionName && node.schema !== undefined && node.table) {
        // Note: node.schema can be empty string for NoSQL databases (MongoDB, Redis)
        setLoadingNodes((prev) => new Set(prev).add(node.id));
        try {
          const columns = await loadColumns(node.connectionKey, node.connectionName, node.schema, node.table, node.database);
          setTreeData((prev) => updateTreeNode(prev, node.id, { children: columns }));
        } catch (error) {
          console.error("Failed to load table columns:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to load columns: ${errorMessage}`);
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
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
    // Note: node.schema can be empty string for NoSQL databases (MongoDB, Redis)
    // so we check for undefined instead of truthy
    if ((node.type === "table" || node.type === "view") && node.connectionKey && node.connectionName && node.schema !== undefined) {
      // For tables, use node.table; for views, use node.name
      const tableName = node.type === "table" ? (node.table || node.name) : node.name;
      onTableSelect(node.connectionKey, node.connectionName, node.schema, tableName, node.database);
    }
  };

  const handleFunctionClick = (node: TreeNode) => {
    if ((node.type === "function" || node.type === "procedure" || node.type === "trigger") &&
        node.connectionKey && node.connectionName && node.schema !== undefined && onFunctionSelect) {
      onFunctionSelect(
        node.connectionKey,
        node.connectionName,
        node.schema,
        node.name,
        node.type as 'function' | 'procedure' | 'trigger',
        node.database
      );
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

  // Generate unique name for duplicated connection
  const generateUniqueName = (baseName: string, existingNames: string[]): string => {
    let newName = `${baseName} (Copy)`;
    let counter = 2;
    while (existingNames.includes(newName)) {
      newName = `${baseName} (Copy ${counter})`;
      counter++;
    }
    return newName;
  };

  // Duplicate a connection
  const handleDuplicateConnection = async (connectionKey: string, originalName: string) => {
    if (!api) return;

    try {
      const allConnections = await api.getConnections();
      const original = allConnections.find(
        (c: ConnectionInfo) => getConnectionKey(c.config) === connectionKey
      );

      if (!original) {
        toast.error("Connection not found");
        return;
      }

      const existingNames = allConnections.map((c: ConnectionInfo) => c.config.name || "");
      const newName = generateUniqueName(originalName, existingNames);

      const newConfig = {
        ...original.config,
        name: newName,
      };

      await api.saveConnection(newConfig);
      loadConnections();
      toast.success(`Duplicated as "${newName}"`);
    } catch (error) {
      toast.error(`Failed to duplicate: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Get icon for node type
  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case "connection":
        return Database;
      case "database":
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
      case "database":
        return "text-cyan-400";
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
      case "database":
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
        // Table metadata is now shown as badges, not text description
        return null;
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

  const renderNode = (node: TreeNode, depth: number = 0, dragHandleProps?: { attributes: any; listeners: any }): React.ReactNode => {
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
      } else if (node.type === "function" || node.type === "procedure" || node.type === "trigger") {
        handleFunctionClick(node);
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
                "flex items-center py-1 cursor-pointer text-sm relative",
                "hover:bg-bg-hover transition-colors duration-fast",
                "select-none group"
              )}
              onClick={handleNodeClick}
            >
              {/* Color indicator for connections */}
              {node.type === "connection" && node.color && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{ backgroundColor: node.color }}
                />
              )}

              {/* Fixed-width drag handle gutter - always present for consistent alignment */}
              <div className="w-6 flex-shrink-0 flex items-center justify-center">
                {node.type === "connection" && dragHandleProps ? (
                  <div
                    {...dragHandleProps.attributes}
                    {...dragHandleProps.listeners}
                    className={cn(
                      "cursor-grab active:cursor-grabbing touch-none flex items-center justify-center",
                      "opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                ) : null}
              </div>

              {/* Content area with depth-based indentation */}
              <div
                className="flex items-center gap-1.5 flex-1 pr-2"
                style={{ paddingLeft: `${depth * 16}px` }}
              >
              {/* Expand/Collapse Icon */}
              {hasChildren ? (
                <div className="w-3.5 h-3.5 flex-shrink-0 relative">
                  <AnimatePresence mode="wait" initial={false}>
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0"
                      >
                        <RefreshCw className="w-full h-full animate-spin text-text-tertiary" />
                      </motion.div>
                    ) : isExpanded ? (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: -90 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute inset-0 text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
                        onClick={handleChevronClick}
                      >
                        <ChevronDown className="w-full h-full" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="collapsed"
                        initial={{ opacity: 0, rotate: 90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 90 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute inset-0 text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
                        onClick={handleChevronClick}
                      >
                        <ChevronRight className="w-full h-full" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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

              {/* Read-Only Lock Icon */}
              {node.type === "connection" && node.readOnly && (
                <Tooltip content="Read-only connection">
                  <Lock className="w-3 h-3 flex-shrink-0 text-amber-400" />
                </Tooltip>
              )}

              {/* Node Name */}
              <Tooltip content={node.name}>
                <span className="whitespace-nowrap text-text-primary">{node.name}</span>
              </Tooltip>

              {/* Table Badges - Row count and size */}
              {node.type === "table" && (
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  {node.rowCount !== undefined && node.rowCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/15 text-blue-400">
                      {formatRowCount(node.rowCount, node.dbType)}
                    </span>
                  )}
                  {node.sizeBytes !== undefined && node.sizeBytes > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/15 text-purple-400">
                      {formatBytes(node.sizeBytes)}
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              {description && (
                <Tooltip content={description}>
                  <span className="text-2xs text-text-tertiary whitespace-nowrap">
                    {description}
                  </span>
                </Tooltip>
              )}
              </div>
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

                {node.status === "connected" && onERDiagramOpen && (
                  <ContextMenu.Item
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                    onSelect={async () => {
                      if (node.connectionKey && node.connectionName) {
                        try {
                          // Get schemas from the connection's children
                          const schemas = node.children?.filter(c => c.type === "schema").map(s => s.name) || [];
                          if (schemas.length === 0 && api) {
                            // If no schemas loaded yet, fetch them
                            const fetchedSchemas = await api.listSchemas(node.connectionKey);
                            onERDiagramOpen(node.connectionKey, node.connectionName, fetchedSchemas);
                          } else {
                            onERDiagramOpen(node.connectionKey, node.connectionName, schemas);
                          }
                        } catch (error) {
                          console.error("Failed to load schemas for ER diagram:", error);
                          toast.error("Failed to load schemas", {
                            description: error instanceof Error ? error.message : "Connection error",
                          });
                        }
                      }
                    }}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    ER Diagram
                  </ContextMenu.Item>
                )}

                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                  onSelect={() => node.connectionKey && onEditConnection(node.connectionKey)}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Connection
                </ContextMenu.Item>

                <ContextMenu.Item
                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                  onSelect={() => node.connectionKey && handleDuplicateConnection(node.connectionKey, node.name)}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
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

          {/* Context Menu for Schemas */}
          {node.type === "schema" && (
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
                {onERDiagramOpen && (
                  <ContextMenu.Item
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                    onSelect={() => {
                      if (node.connectionKey && node.connectionName && node.schema) {
                        onERDiagramOpen(node.connectionKey, node.connectionName, [node.schema]);
                      }
                    }}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    ER Diagram
                  </ContextMenu.Item>
                )}
              </ContextMenu.Content>
            </ContextMenu.Portal>
          )}

          {/* Context Menu for Tables/Collections */}
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
                  {node.dbType === "mongodb" ? "Open Collection" : node.dbType === "elasticsearch" ? "Open Index" : "Open Table"}
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
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Special handling for Redis Keys - use RedisSidebarTree */}
              {node.type === "objectTypeContainer" &&
               node.objectType === "tables" &&
               node.dbType === "redis" &&
               node.connectionKey &&
               node.connectionName ? (
                <RedisSidebarTree
                  connectionKey={node.connectionKey}
                  connectionName={node.connectionName}
                  onKeySelect={onTableSelect}
                />
              ) : (
                <>
                  {node.children?.map((child) => renderNode(child, depth + 1))}
                  {(!node.children || node.children.length === 0) && !isLoading && (
                    <div
                      className="text-xs text-text-tertiary italic py-1"
                      style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}
                    >
                      {node.type === "connection" && "No schemas"}
                      {node.type === "schema" && "Loading..."}
                      {node.type === "objectTypeContainer" && "Empty"}
                      {node.type === "table" && "No columns"}
                    </div>
                  )}
                </>
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
          <Tooltip content={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}>
            <IconButton
              icon={resolvedTheme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              size="sm"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            />
          </Tooltip>
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
          <div className="min-w-max">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={treeData.map((node) => node.id)}
                strategy={verticalListSortingStrategy}
              >
                {treeData.map((node) => (
                  <SortableConnectionItem key={node.id} node={node}>
                    {({ attributes, listeners }: { attributes: any; listeners: any }) =>
                      renderNode(node, 0, { attributes, listeners })
                    }
                  </SortableConnectionItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}
