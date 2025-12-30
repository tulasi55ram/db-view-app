/**
 * RedisSidebarTree
 *
 * Hierarchical key browser for Redis, ported from desktop app.
 * Features:
 * - Namespace tree (splits keys by delimiter ":")
 * - Lazy type loading (TYPE command on demand)
 * - TTL loading on hover
 * - Debounced search (300ms)
 * - Cursor-based pagination with "Load more"
 * - Folder expand/collapse
 */

import { useState, useCallback, useEffect, useRef, type FC } from "react";
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
  Activity,
  Search,
  RefreshCw,
  Clock,
  Key,
  MoreHorizontal,
  X,
  Copy,
} from "lucide-react";
import clsx from "clsx";
import { getVsCodeApi } from "../../../vscode";
import { toast } from "sonner";

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

export interface RedisSidebarTreeProps {
  schema: string;           // Redis DB index (e.g., "0", "1")
  selectedKey: string | null;
  onKeySelect: (key: string, type: RedisKeyType) => void;
  typeFilter?: RedisKeyType | null; // Optional type filter
  delimiter?: string;
}

// Type icons and colors (VS Code theme-compatible)
const TYPE_CONFIG: Record<RedisKeyType, { icon: typeof Hash; color: string; label: string }> = {
  string: { icon: Type, color: "text-blue-500", label: "String" },
  hash: { icon: Hash, color: "text-purple-500", label: "Hash" },
  list: { icon: List, color: "text-green-500", label: "List" },
  set: { icon: Circle, color: "text-orange-500", label: "Set" },
  zset: { icon: BarChart3, color: "text-pink-500", label: "Sorted Set" },
  stream: { icon: Activity, color: "text-cyan-500", label: "Stream" },
  unknown: { icon: Key, color: "text-vscode-text-muted", label: "Unknown" },
};

// How many keys to load per batch
const BATCH_SIZE = 100;

export const RedisSidebarTree: FC<RedisSidebarTreeProps> = ({
  schema,
  selectedKey,
  onKeySelect,
  typeFilter = null,
  delimiter = ":",
}) => {
  const vscode = getVsCodeApi();

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
  const [pendingTypeRequests, setPendingTypeRequests] = useState<Set<string>>(new Set());

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIdRef = useRef(0);

  // Build/update tree from scanned keys
  const addKeysToTree = useCallback(
    (keys: Array<{ key: string; type?: string }>, currentRoot: NamespaceNode): NamespaceNode => {
      const newRoot = { ...currentRoot, children: new Map(currentRoot.children) };

      for (const { key: fullKey, type } of keys) {
        // Apply type filter if set
        if (typeFilter && type && type !== typeFilter) {
          continue;
        }

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
              keyType: isLast ? (type as RedisKeyType) : undefined,
              children: new Map(),
              keyCount: isLast ? 1 : 0,
              isLoaded: isLast,
              isLoading: false,
              hasMore: !isLast,
              cursor: "0",
            });
          } else if (isLast) {
            const existing = currentNode.children.get(part)!;
            existing.isLeafKey = true;
            if (type) existing.keyType = type as RedisKeyType;
          }

          const child = currentNode.children.get(part)!;
          if (!isLast) {
            child.keyCount++;
            currentNode.children.set(part, { ...child, children: new Map(child.children) });
          }
          currentNode = currentNode.children.get(part)!;
        }
      }

      return newRoot;
    },
    [delimiter, typeFilter]
  );

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "REDIS_SCAN_RESULT": {
          const { keys, cursor, hasMore } = message;
          setRootNode((prev) => {
            const newRoot = addKeysToTree(keys, prev);
            return {
              ...newRoot,
              keyCount: prev.keyCount + keys.length,
              isLoaded: true,
              isLoading: false,
              hasMore,
              cursor,
            };
          });
          setIsSearching(false);
          break;
        }

        case "REDIS_DBSIZE": {
          setTotalKeyCount(message.size);
          break;
        }

        case "REDIS_KEY_INFO": {
          const { key, keyType, ttl } = message;
          // Update type in tree
          setRootNode((prev) => {
            const updateNode = (node: NamespaceNode, pathParts: string[], depth: number): NamespaceNode => {
              if (depth === pathParts.length) {
                return { ...node, keyType: keyType as RedisKeyType };
              }
              const part = pathParts[depth];
              const child = node.children.get(part);
              if (!child) return node;

              const newChildren = new Map(node.children);
              newChildren.set(part, updateNode(child, pathParts, depth + 1));
              return { ...node, children: newChildren };
            };

            const parts = key.split(delimiter);
            return updateNode(prev, parts, 0);
          });
          // Update TTL cache
          if (ttl !== undefined) {
            setKeyTTLs((prev) => new Map(prev).set(key, ttl));
          }
          setPendingTypeRequests((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          break;
        }

        case "REDIS_ERROR": {
          toast.error(message.error || "Redis operation failed");
          setIsSearching(false);
          setRootNode((prev) => ({ ...prev, isLoading: false }));
          break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [addKeysToTree, delimiter]);

  // Initial load and reset when schema (database) changes
  useEffect(() => {
    // Reset all state when database changes
    setKeyTTLs(new Map());
    setSearchQuery("");
    setSearchResults([]);
    setExpandedPaths(new Set([""]));
    setTotalKeyCount(null);
    setRootNode({
      name: "Keys",
      fullPath: "",
      isLeafKey: false,
      children: new Map(),
      keyCount: 0,
      isLoaded: false,
      isLoading: true,
      hasMore: true,
      cursor: "0",
    });

    // Request DBSIZE
    vscode?.postMessage({
      type: "GET_REDIS_DBSIZE",
      schema,
    });

    // Request initial keys
    vscode?.postMessage({
      type: "SCAN_REDIS_KEYS",
      schema,
      pattern: "*",
      cursor: "0",
      count: BATCH_SIZE * 5, // Load more initially
    });
  }, [vscode, schema]);

  // Load more keys
  const loadMoreKeys = useCallback(() => {
    if (!rootNode.hasMore || rootNode.isLoading) return;

    setRootNode((prev) => ({ ...prev, isLoading: true }));
    vscode?.postMessage({
      type: "SCAN_REDIS_KEYS",
      schema,
      pattern: searchQuery ? `*${searchQuery}*` : "*",
      cursor: rootNode.cursor,
      count: BATCH_SIZE,
    });
  }, [vscode, schema, rootNode.hasMore, rootNode.isLoading, rootNode.cursor, searchQuery]);

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        // Reset to full tree
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const pattern = query.includes("*") ? query : `*${query}*`;

      // Clear existing tree and search
      setRootNode({
        name: "Keys",
        fullPath: "",
        isLeafKey: false,
        children: new Map(),
        keyCount: 0,
        isLoaded: false,
        isLoading: true,
        hasMore: true,
        cursor: "0",
      });

      vscode?.postMessage({
        type: "SCAN_REDIS_KEYS",
        schema,
        pattern,
        cursor: "0",
        count: BATCH_SIZE,
      });
    },
    [vscode, schema]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

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
      onKeySelect(node.fullPath, node.keyType || "string");
    },
    [onKeySelect]
  );

  // Handle key hover - load type and TTL
  const handleKeyHover = useCallback(
    (fullKey: string, node: NamespaceNode) => {
      setHoveredKey(fullKey);

      // Load type and TTL if not already loaded
      if (!node.keyType && !pendingTypeRequests.has(fullKey)) {
        setPendingTypeRequests((prev) => new Set(prev).add(fullKey));
        vscode?.postMessage({
          type: "GET_REDIS_KEY_INFO",
          schema,
          key: fullKey,
        });
      }
    },
    [vscode, schema, pendingTypeRequests]
  );

  // Refresh tree
  const handleRefresh = useCallback(() => {
    setKeyTTLs(new Map());
    setSearchQuery("");
    setSearchResults([]);
    setRootNode({
      name: "Keys",
      fullPath: "",
      isLeafKey: false,
      children: new Map(),
      keyCount: 0,
      isLoaded: false,
      isLoading: true,
      hasMore: true,
      cursor: "0",
    });

    vscode?.postMessage({
      type: "GET_REDIS_DBSIZE",
      schema,
    });

    vscode?.postMessage({
      type: "SCAN_REDIS_KEYS",
      schema,
      pattern: "*",
      cursor: "0",
      count: BATCH_SIZE * 5,
    });
  }, [vscode, schema]);

  // Copy key to clipboard
  const handleCopyKey = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Key copied to clipboard");
    } catch {
      toast.error("Failed to copy key");
    }
  };

  // Format TTL for display
  const formatTTL = (ttl: number): { text: string; color: string } | null => {
    if (ttl === -1) return null; // No expiry
    if (ttl === -2) return null; // Key doesn't exist
    if (ttl < 60) return { text: `${ttl}s`, color: "text-red-500" };
    if (ttl < 3600) return { text: `${Math.floor(ttl / 60)}m`, color: "text-orange-500" };
    if (ttl < 86400) return { text: `${Math.floor(ttl / 3600)}h`, color: "text-yellow-500" };
    return { text: `${Math.floor(ttl / 86400)}d`, color: "text-green-500" };
  };

  // Render a namespace/key node recursively
  const renderNode = (node: NamespaceNode, depth: number): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.fullPath);
    const hasChildren = node.children.size > 0;
    const isLeaf = node.isLeafKey && !hasChildren;
    const isSelected = node.fullPath === selectedKey;
    const isHovered = node.fullPath === hoveredKey;

    // Sort children: folders first, then keys
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      const aIsFolder = a.children.size > 0 || !a.isLeafKey;
      const bIsFolder = b.children.size > 0 || !b.isLeafKey;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const typeConfig = node.keyType ? TYPE_CONFIG[node.keyType] : null;
    const TypeIcon = typeConfig?.icon || Key;
    const iconColor = typeConfig?.color || "text-vscode-text-muted";

    const ttl = keyTTLs.get(node.fullPath);
    const ttlInfo = ttl !== undefined ? formatTTL(ttl) : null;

    return (
      <div key={node.fullPath || "root"}>
        {/* Node row (skip for root) */}
        {node.fullPath !== "" && (
          <div
            className={clsx(
              "flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm",
              "hover:bg-vscode-bg-hover transition-colors",
              "select-none group",
              isSelected && "bg-vscode-accent/10 border-l-2 border-vscode-accent"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => (isLeaf ? handleKeyClick(node) : toggleExpand(node.fullPath))}
            onMouseEnter={() => isLeaf && handleKeyHover(node.fullPath, node)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            {/* Expand/collapse or type icon */}
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-vscode-text-muted flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-vscode-text-muted flex-shrink-0" />
              )
            ) : isLeaf ? (
              <TypeIcon className={clsx("w-3.5 h-3.5 flex-shrink-0", iconColor)} />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}

            {/* Folder icon for namespaces */}
            {hasChildren && (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              )
            )}

            {/* Node name */}
            <span className={clsx(
              "truncate flex-1",
              isLeaf ? "font-mono text-xs" : "text-vscode-text",
              isSelected && "text-vscode-accent"
            )}>
              {node.name}
            </span>

            {/* Key count for namespaces */}
            {!isLeaf && node.keyCount > 0 && (
              <span className="text-[10px] text-vscode-text-muted flex-shrink-0">
                ({node.keyCount})
              </span>
            )}

            {/* TTL badge on hover for leaf keys */}
            {isLeaf && isHovered && ttlInfo && (
              <span className={clsx("text-[10px] flex-shrink-0 flex items-center gap-0.5", ttlInfo.color)}>
                <Clock className="w-3 h-3" />
                {ttlInfo.text}
              </span>
            )}

            {/* Type badge on hover */}
            {isLeaf && isHovered && typeConfig && (
              <span className={clsx("text-[10px] flex-shrink-0 uppercase", iconColor)}>
                {node.keyType}
              </span>
            )}

            {/* Copy button on hover */}
            {isLeaf && isHovered && (
              <button
                onClick={(e) => handleCopyKey(node.fullPath, e)}
                className="p-0.5 rounded hover:bg-vscode-bg text-vscode-text-muted hover:text-vscode-text transition-colors"
                title="Copy key"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Children */}
        {(isExpanded || node.fullPath === "") && (
          <div>
            {node.isLoading && (
              <div
                className="flex items-center gap-2 px-2 py-1 text-xs text-vscode-text-muted"
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
              <div className="px-3 py-2 text-xs text-vscode-text-muted italic">
                No keys found
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-vscode-bg-light">
      {/* Search input */}
      <div className="p-2 border-b border-vscode-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keys..."
            className="w-full pl-8 pr-8 py-1.5 bg-vscode-bg border border-vscode-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-vscode-accent"
          />
          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery("");
                handleRefresh();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : isSearching ? (
            <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-vscode-text-muted" />
          ) : null}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-3 py-1.5 text-xs text-vscode-text-muted border-b border-vscode-border flex items-center justify-between">
        <span>
          {totalKeyCount !== null
            ? `${totalKeyCount.toLocaleString()} total keys`
            : "Loading..."}
        </span>
        <button
          onClick={handleRefresh}
          disabled={rootNode.isLoading}
          className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors disabled:opacity-50"
          title="Refresh keys"
        >
          <RefreshCw
            className={clsx(
              "w-3.5 h-3.5",
              rootNode.isLoading && "animate-spin"
            )}
          />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto">
        {renderNode(rootNode, 0)}

        {/* Load more button */}
        {rootNode.hasMore && !rootNode.isLoading && (
          <button
            onClick={loadMoreKeys}
            className="w-full px-3 py-2 text-xs text-vscode-accent hover:bg-vscode-bg-hover flex items-center justify-center gap-1"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            Load more keys...
          </button>
        )}
      </div>

      {/* Footer with loaded count */}
      <div className="px-3 py-1.5 border-t border-vscode-border text-xs text-vscode-text-muted">
        {searchQuery
          ? `${rootNode.keyCount} matching`
          : rootNode.hasMore
          ? `${rootNode.keyCount}+ loaded`
          : `${rootNode.keyCount} keys`
        }
      </div>
    </div>
  );
};

export default RedisSidebarTree;
