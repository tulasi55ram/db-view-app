import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Hash,
  Type,
  List,
  Circle,
  BarChart3,
  Radio,
  Search,
  RefreshCw,
  Clock,
  Key,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { Tooltip } from "@/primitives/Tooltip";

// Redis key types
type RedisKeyType = "string" | "hash" | "list" | "set" | "zset" | "stream" | "unknown";

interface KeyInfo {
  name: string;        // Display name (last segment)
  fullKey: string;     // Full Redis key
  type?: RedisKeyType; // Loaded on demand
  ttl?: number;        // Loaded on hover (-1 = no expiry, -2 = doesn't exist)
}

interface NamespaceNode {
  name: string;
  fullPath: string;
  isLeafKey: boolean;      // True if this is an actual Redis key (not just a namespace)
  keyType?: RedisKeyType;  // Only for leaf keys
  children: Map<string, NamespaceNode>;
  keyCount: number;        // Estimated count of keys under this namespace
  isLoaded: boolean;
  isLoading: boolean;
  hasMore: boolean;        // For pagination
  cursor: string;          // SCAN cursor for loading more
}

interface RedisSidebarTreeProps {
  connectionKey: string;
  connectionName: string;
  onKeySelect: (connectionKey: string, connectionName: string, schema: string, keyName: string) => void;
  delimiter?: string;
}

// Type icons and colors
const TYPE_CONFIG: Record<RedisKeyType, { icon: typeof Hash; color: string; label: string }> = {
  string: { icon: Type, color: "text-green-400", label: "String" },
  hash: { icon: Hash, color: "text-blue-400", label: "Hash" },
  list: { icon: List, color: "text-orange-400", label: "List" },
  set: { icon: Circle, color: "text-purple-400", label: "Set" },
  zset: { icon: BarChart3, color: "text-pink-400", label: "Sorted Set" },
  stream: { icon: Radio, color: "text-cyan-400", label: "Stream" },
  unknown: { icon: Key, color: "text-text-tertiary", label: "Unknown" },
};

// How many keys to load per batch
const BATCH_SIZE = 100;

export function RedisSidebarTree({
  connectionKey,
  connectionName,
  onKeySelect,
  delimiter = ":",
}: RedisSidebarTreeProps) {
  // Root namespace node
  const [rootNode, setRootNode] = useState<NamespaceNode>({
    name: "Keys",
    fullPath: "",
    isLeafKey: false,
    children: new Map(),
    keyCount: 0,
    isLoaded: false,
    isLoading: false,
    hasMore: true,
    cursor: "0",
  });

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KeyInfo[]>([]);
  const [totalKeyCount, setTotalKeyCount] = useState<number | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [keyTTLs, setKeyTTLs] = useState<Map<string, number>>(new Map());

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const api = getElectronAPI();

  // Get total key count via DBSIZE
  const loadTotalKeyCount = useCallback(async () => {
    if (!api) return;
    try {
      const result = await api.runQuery({ connectionKey, sql: "DBSIZE" });
      const count = result.rows?.[0] ? Number(Object.values(result.rows[0])[0]) : 0;
      setTotalKeyCount(count);
    } catch (err) {
      console.error("Failed to get DBSIZE:", err);
    }
  }, [api, connectionKey]);

  // Scan keys matching pattern (returns only key names, no TYPE/TTL)
  const scanKeyNames = useCallback(
    async (pattern: string, cursor: string = "0", count: number = BATCH_SIZE): Promise<{ keys: string[]; nextCursor: string }> => {
      if (!api) return { keys: [], nextCursor: "0" };

      try {
        const scanResult = await api.runQuery({
          connectionKey,
          sql: `SCAN ${cursor} MATCH ${pattern} COUNT ${count}`,
        });

        if (!scanResult.rows || scanResult.rows.length < 2) {
          return { keys: [], nextCursor: "0" };
        }

        const cursorRow = scanResult.rows[0] as Record<string, unknown>;
        const keysRow = scanResult.rows[1] as Record<string, unknown>;

        const nextCursor = String(cursorRow.value ?? "0");
        const scannedKeys = (keysRow.value as string[]) || [];

        return { keys: scannedKeys, nextCursor };
      } catch (err) {
        console.error("Failed to scan keys:", err);
        return { keys: [], nextCursor: "0" };
      }
    },
    [api, connectionKey]
  );

  // Get type for a single key
  const getKeyType = useCallback(
    async (key: string): Promise<RedisKeyType> => {
      if (!api) return "unknown";
      try {
        const result = await api.runQuery({ connectionKey, sql: `TYPE ${key}` });
        const type = result.rows?.[0] ? String(Object.values(result.rows[0])[0]) : "unknown";
        return type as RedisKeyType;
      } catch {
        return "unknown";
      }
    },
    [api, connectionKey]
  );

  // Get TTL for a key (called on hover)
  const getKeyTTL = useCallback(
    async (key: string): Promise<number> => {
      if (!api) return -1;
      try {
        const result = await api.runQuery({ connectionKey, sql: `TTL ${key}` });
        return result.rows?.[0] ? Number(Object.values(result.rows[0])[0]) : -1;
      } catch {
        return -1;
      }
    },
    [api, connectionKey]
  );

  // Build/update tree from scanned keys
  const addKeysToTree = useCallback(
    (keys: string[], currentRoot: NamespaceNode): NamespaceNode => {
      const newRoot = { ...currentRoot, children: new Map(currentRoot.children) };

      for (const fullKey of keys) {
        const parts = fullKey.split(delimiter);
        let currentNode = newRoot;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isLast = i === parts.length - 1;
          const fullPath = parts.slice(0, i + 1).join(delimiter);

          if (!currentNode.children.has(part)) {
            currentNode.children.set(part, {
              name: part,
              fullPath,
              isLeafKey: isLast,
              children: new Map(),
              keyCount: isLast ? 1 : 0,
              isLoaded: isLast, // Leaf keys are "loaded"
              isLoading: false,
              hasMore: !isLast,
              cursor: "0",
            });
          } else if (isLast) {
            // Mark existing node as also being a leaf key
            const existing = currentNode.children.get(part)!;
            existing.isLeafKey = true;
          }

          const child = currentNode.children.get(part)!;
          if (!isLast) {
            child.keyCount++;
            // Clone the children map for immutability
            currentNode.children.set(part, { ...child, children: new Map(child.children) });
          }
          currentNode = currentNode.children.get(part)!;
        }
      }

      return newRoot;
    },
    [delimiter]
  );

  // Load initial keys (first batch)
  const loadInitialKeys = useCallback(async () => {
    setRootNode((prev) => ({ ...prev, isLoading: true }));

    let allKeys: string[] = [];
    let cursor = "0";
    let iterations = 0;
    const maxIterations = 10; // Limit initial scan

    // Scan multiple batches to get a good initial set
    do {
      const { keys, nextCursor } = await scanKeyNames("*", cursor, BATCH_SIZE);
      allKeys = [...allKeys, ...keys];
      cursor = nextCursor;
      iterations++;
    } while (cursor !== "0" && allKeys.length < 500 && iterations < maxIterations);

    const hasMore = cursor !== "0";

    setRootNode((prev) => {
      const newRoot = addKeysToTree(allKeys, {
        ...prev,
        children: new Map(),
        keyCount: allKeys.length,
        isLoaded: true,
        isLoading: false,
        hasMore,
        cursor,
      });
      return newRoot;
    });
  }, [scanKeyNames, addKeysToTree]);

  // Load more keys for root
  const loadMoreKeys = useCallback(async () => {
    if (!rootNode.hasMore || rootNode.isLoading) return;

    setRootNode((prev) => ({ ...prev, isLoading: true }));

    const { keys, nextCursor } = await scanKeyNames("*", rootNode.cursor, BATCH_SIZE);
    const hasMore = nextCursor !== "0";

    setRootNode((prev) => {
      const newRoot = addKeysToTree(keys, prev);
      return {
        ...newRoot,
        keyCount: prev.keyCount + keys.length,
        isLoading: false,
        hasMore,
        cursor: nextCursor,
      };
    });
  }, [rootNode.hasMore, rootNode.isLoading, rootNode.cursor, scanKeyNames, addKeysToTree]);

  // Load type for a leaf key when expanded/visible
  const loadKeyType = useCallback(
    async (fullPath: string) => {
      const type = await getKeyType(fullPath);

      setRootNode((prev) => {
        const updateNode = (node: NamespaceNode, pathParts: string[], depth: number): NamespaceNode => {
          if (depth === pathParts.length) {
            return { ...node, keyType: type };
          }

          const part = pathParts[depth];
          const child = node.children.get(part);
          if (!child) return node;

          const newChildren = new Map(node.children);
          newChildren.set(part, updateNode(child, pathParts, depth + 1));
          return { ...node, children: newChildren };
        };

        const parts = fullPath.split(delimiter);
        return updateNode(prev, parts, 0);
      });
    },
    [getKeyType, delimiter]
  );

  // Handle key hover - load TTL and type
  const handleKeyHover = useCallback(
    async (fullKey: string, node: NamespaceNode) => {
      setHoveredKey(fullKey);

      // Load type if not already loaded
      if (!node.keyType) {
        loadKeyType(fullKey);
      }

      // Load TTL if not already loaded
      if (!keyTTLs.has(fullKey)) {
        const ttl = await getKeyTTL(fullKey);
        setKeyTTLs((prev) => new Map(prev).set(fullKey, ttl));
      }
    },
    [getKeyTTL, keyTTLs, loadKeyType]
  );

  // Search keys
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const pattern = `*${query}*`;
      const { keys } = await scanKeyNames(pattern, "0", 50);

      // Get types for search results
      const results: KeyInfo[] = await Promise.all(
        keys.map(async (fullKey) => {
          const type = await getKeyType(fullKey);
          return {
            name: fullKey.split(delimiter).pop() || fullKey,
            fullKey,
            type,
          };
        })
      );

      setSearchResults(results);
      setIsSearching(false);
    },
    [scanKeyNames, getKeyType, delimiter]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

  // Initial load
  useEffect(() => {
    loadTotalKeyCount();
    loadInitialKeys();
  }, [loadTotalKeyCount, loadInitialKeys]);

  // Toggle namespace expansion
  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle key click
  const handleKeyClick = useCallback(
    (node: NamespaceNode) => {
      if (!node.isLeafKey) return;

      const type = node.keyType || "string";
      const tableName = `[${type}] ${node.fullPath}`;
      onKeySelect(connectionKey, connectionName, "", tableName);
    },
    [connectionKey, connectionName, onKeySelect]
  );

  // Format TTL for display
  const formatTTL = (ttl: number): { text: string; color: string } | null => {
    if (ttl === -1) return null; // No expiry
    if (ttl === -2) return null; // Key doesn't exist
    if (ttl < 60) return { text: `${ttl}s`, color: "text-red-400" };
    if (ttl < 3600) return { text: `${Math.floor(ttl / 60)}m`, color: "text-orange-400" };
    if (ttl < 86400) return { text: `${Math.floor(ttl / 3600)}h`, color: "text-yellow-400" };
    return { text: `${Math.floor(ttl / 86400)}d`, color: "text-green-400" };
  };

  // Render a namespace/key node recursively
  const renderNode = (node: NamespaceNode, depth: number): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.fullPath);
    const hasChildren = node.children.size > 0;
    const isLeaf = node.isLeafKey && !hasChildren;

    // Sort children: folders first, then keys
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      // Folders (has children or not a leaf) come first
      const aIsFolder = a.children.size > 0 || !a.isLeafKey;
      const bIsFolder = b.children.size > 0 || !b.isLeafKey;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const typeConfig = node.keyType ? TYPE_CONFIG[node.keyType] : null;
    const TypeIcon = typeConfig?.icon || Key;
    const iconColor = typeConfig?.color || "text-text-tertiary";

    const ttl = keyTTLs.get(node.fullPath);
    const ttlInfo = ttl !== undefined ? formatTTL(ttl) : null;

    return (
      <div key={node.fullPath || "root"}>
        {/* Node row (skip for root) */}
        {node.fullPath !== "" && (
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm",
              "hover:bg-bg-hover transition-colors duration-fast",
              "select-none group"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => (isLeaf ? handleKeyClick(node) : toggleExpand(node.fullPath))}
            onMouseEnter={() => isLeaf && handleKeyHover(node.fullPath, node)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            {/* Expand/collapse or type icon */}
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              )
            ) : isLeaf ? (
              <TypeIcon className={cn("w-3.5 h-3.5 flex-shrink-0", iconColor)} />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}

            {/* Folder icon for namespaces */}
            {hasChildren && (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              )
            )}

            {/* Node name */}
            <span className={cn(
              "truncate flex-1",
              isLeaf ? "font-mono text-xs" : "text-text-primary"
            )}>
              {node.name}
            </span>

            {/* Key count for namespaces */}
            {!isLeaf && node.keyCount > 0 && (
              <span className="text-2xs text-text-tertiary flex-shrink-0">
                ({node.keyCount})
              </span>
            )}

            {/* TTL badge on hover for leaf keys */}
            {isLeaf && hoveredKey === node.fullPath && ttlInfo && (
              <Tooltip content={`Expires in ${ttlInfo.text}`}>
                <span className={cn("text-2xs flex-shrink-0 flex items-center gap-0.5", ttlInfo.color)}>
                  <Clock className="w-3 h-3" />
                  {ttlInfo.text}
                </span>
              </Tooltip>
            )}

            {/* Type badge on hover */}
            {isLeaf && hoveredKey === node.fullPath && typeConfig && (
              <span className={cn("text-2xs flex-shrink-0", iconColor)}>
                {typeConfig.label}
              </span>
            )}
          </div>
        )}

        {/* Children */}
        {(isExpanded || node.fullPath === "") && (
          <div>
            {node.isLoading && (
              <div
                className="flex items-center gap-2 px-2 py-1 text-xs text-text-tertiary"
                style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                Loading...
              </div>
            )}

            {/* Render children */}
            {sortedChildren.map((child) => renderNode(child, depth + 1))}

            {/* Empty state */}
            {!node.isLoading && sortedChildren.length === 0 && node.fullPath === "" && (
              <div className="px-3 py-2 text-xs text-text-tertiary italic">
                No keys found
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render search results
  const renderSearchResults = () => {
    if (isSearching) {
      return (
        <div className="flex items-center justify-center py-4 text-text-tertiary">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          Searching...
        </div>
      );
    }

    if (searchResults.length === 0) {
      return (
        <div className="py-4 text-center text-text-tertiary text-sm">
          No keys found matching "{searchQuery}"
        </div>
      );
    }

    return (
      <div className="py-1">
        <div className="px-3 py-1 text-xs text-text-secondary">
          {searchResults.length} results
        </div>
        {searchResults.map((key) => {
          const typeConfig = key.type ? TYPE_CONFIG[key.type] : TYPE_CONFIG.unknown;
          const TypeIcon = typeConfig.icon;

          return (
            <div
              key={key.fullKey}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-sm",
                "hover:bg-bg-hover transition-colors"
              )}
              onClick={() => {
                const tableName = `[${key.type || "string"}] ${key.fullKey}`;
                onKeySelect(connectionKey, connectionName, "", tableName);
              }}
            >
              <TypeIcon className={cn("w-3.5 h-3.5 flex-shrink-0", typeConfig.color)} />
              <span className="truncate flex-1 text-text-primary font-mono text-xs">
                {key.fullKey}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keys..."
            className="w-full pl-7 pr-2 py-1 bg-bg-primary border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-3 py-1.5 text-xs text-text-secondary border-b border-border flex items-center justify-between">
        <span>
          {totalKeyCount !== null
            ? `${totalKeyCount.toLocaleString()} total keys`
            : "Loading..."}
        </span>
        <Tooltip content="Refresh keys">
          <button
            onClick={() => {
              // Clear caches
              setKeyTTLs(new Map());
              setSearchResults([]);
              setSearchQuery("");
              // Reload data
              loadTotalKeyCount();
              loadInitialKeys();
            }}
            className="p-1 rounded hover:bg-bg-hover transition-colors"
            disabled={rootNode.isLoading}
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5",
                rootNode.isLoading ? "animate-spin text-accent" : "text-text-tertiary hover:text-text-primary"
              )}
            />
          </button>
        </Tooltip>
      </div>

      {/* Tree or search results */}
      <div className="flex-1 overflow-auto">
        {searchQuery ? (
          renderSearchResults()
        ) : (
          <>
            {renderNode(rootNode, 0)}

            {/* Load more button */}
            {rootNode.hasMore && !rootNode.isLoading && (
              <button
                onClick={loadMoreKeys}
                className="w-full px-3 py-2 text-xs text-accent hover:bg-bg-hover flex items-center justify-center gap-1"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                Load more keys...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
