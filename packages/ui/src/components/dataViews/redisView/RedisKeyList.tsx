/**
 * RedisKeyList
 *
 * Sidebar component showing the list of Redis keys
 * with server-side SCAN search, pagination, and type indicators.
 */

import { useState, useEffect, useCallback, useRef, type FC } from "react";
import { Search, X, RefreshCw, Copy, Key, ChevronDown, Database } from "lucide-react";
import clsx from "clsx";
import { copyToClipboard, parseKeyNamespace } from "./utils";
import { TYPE_CONFIG, type RedisDataType } from "./types";
import { toast } from "sonner";

interface RedisKeyInfo {
  key: string;
  type?: RedisDataType;
}

interface RedisKeyListProps {
  /** List of keys (can be strings or objects with type info) */
  keys: string[] | RedisKeyInfo[];
  /** Currently selected key */
  selectedKey: string | null;
  /** Callback when a key is selected */
  onSelectKey: (key: string) => void;
  /** Whether keys are loading */
  loading: boolean;
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes (for client-side filtering) */
  onSearchChange: (query: string) => void;
  /** Total count of keys in database */
  totalCount?: number | null;
  /** Whether there are more keys to load */
  hasMore?: boolean;
  /** Callback to load more keys */
  onLoadMore?: () => void;
  /** Loading state for load more */
  loadingMore?: boolean;
  /** Callback for server-side search with pattern */
  onServerSearch?: (pattern: string) => void;
  /** Whether server search is in progress */
  serverSearchLoading?: boolean;
  /** Callback to refresh the key list */
  onRefresh?: () => void;
  /** Debounce delay for search (ms) */
  searchDebounceMs?: number;
  /** Enable server-side search */
  enableServerSearch?: boolean;
}

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const RedisKeyList: FC<RedisKeyListProps> = ({
  keys,
  selectedKey,
  onSelectKey,
  loading,
  searchQuery,
  onSearchChange,
  totalCount,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  onServerSearch,
  serverSearchLoading = false,
  onRefresh,
  searchDebounceMs = 300,
  enableServerSearch = false,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(localSearchQuery, searchDebounceMs);

  // Normalize keys to array of strings for filtering
  const keyStrings = keys.map((k) => (typeof k === "string" ? k : k.key));

  // Get key type if available
  const getKeyType = (key: string): RedisDataType | undefined => {
    const keyInfo = keys.find((k) =>
      typeof k === "string" ? k === key : k.key === key
    );
    return typeof keyInfo === "object" ? keyInfo.type : undefined;
  };

  // Trigger server search or client-side filter when debounced query changes
  useEffect(() => {
    if (enableServerSearch && onServerSearch && debouncedSearchQuery) {
      // Server-side search with pattern
      const pattern = debouncedSearchQuery.includes("*")
        ? debouncedSearchQuery
        : `*${debouncedSearchQuery}*`;
      onServerSearch(pattern);
    } else {
      // Client-side filter
      onSearchChange(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, enableServerSearch, onServerSearch, onSearchChange]);

  // Filter keys locally (when not using server search)
  const filteredKeys = enableServerSearch
    ? keyStrings // Server already filtered
    : keyStrings.filter((key) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return key.toLowerCase().includes(query);
      });

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
  };

  const handleClearSearch = () => {
    setLocalSearchQuery("");
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  const handleCopyKey = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(key);
    if (success) {
      toast.success("Key copied to clipboard");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && enableServerSearch && onServerSearch) {
      // Immediately trigger search on Enter
      const pattern = localSearchQuery.includes("*")
        ? localSearchQuery
        : `*${localSearchQuery}*`;
      onServerSearch(pattern);
    } else if (e.key === "Escape") {
      handleClearSearch();
    }
  };

  const isSearching = serverSearchLoading || loading;
  const showLoadMore = hasMore && onLoadMore && !loading && filteredKeys.length > 0;

  return (
    <div className="flex flex-col h-full bg-vscode-bg-light">
      {/* Search header */}
      <div className="p-2 border-b border-vscode-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={enableServerSearch ? "Search pattern (e.g. user:*)" : "Filter keys..."}
            className="w-full pl-8 pr-8 py-1.5 bg-vscode-bg border border-vscode-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-vscode-accent"
          />
          {localSearchQuery ? (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : isSearching ? (
            <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-vscode-text-muted" />
          ) : null}
        </div>

        {/* Stats bar */}
        {totalCount !== null && totalCount !== undefined && (
          <div className="flex items-center justify-between text-xs text-vscode-text-muted">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {totalCount.toLocaleString()} total keys
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={clsx("w-3 h-3", loading && "animate-spin")} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Keys list */}
      <div className="flex-1 overflow-auto">
        {loading && filteredKeys.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-vscode-text-muted" />
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-vscode-text-muted text-sm">
            <Key className="w-8 h-8 mb-2 opacity-40" />
            {localSearchQuery ? (
              <>
                <p>No keys matching "{localSearchQuery}"</p>
                <button
                  onClick={handleClearSearch}
                  className="mt-2 text-vscode-accent hover:underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p>No keys found</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-vscode-border">
            {filteredKeys.map((key) => {
              const { namespace, name } = parseKeyNamespace(key);
              const keyType = getKeyType(key);
              const typeConfig = keyType ? TYPE_CONFIG[keyType] : null;
              const TypeIcon = typeConfig?.icon || Key;
              const isSelected = key === selectedKey;
              const isHovered = key === hoveredKey;

              return (
                <button
                  key={key}
                  onClick={() => onSelectKey(key)}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={clsx(
                    "w-full px-3 py-2 text-left transition-colors flex items-center gap-2 group",
                    isSelected
                      ? "bg-vscode-accent/10 border-l-2 border-vscode-accent"
                      : "hover:bg-vscode-bg-hover border-l-2 border-transparent"
                  )}
                >
                  <TypeIcon
                    className={clsx(
                      "w-3.5 h-3.5 flex-shrink-0",
                      isSelected
                        ? "text-vscode-accent"
                        : typeConfig?.color || "text-vscode-text-muted"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {namespace && (
                        <span className="text-xs text-vscode-text-muted truncate">
                          {namespace}:
                        </span>
                      )}
                      <span
                        className={clsx(
                          "text-sm font-mono truncate",
                          isSelected ? "text-vscode-accent" : "text-vscode-text"
                        )}
                      >
                        {name}
                      </span>
                    </div>
                    {/* Type badge on hover */}
                    {keyType && isHovered && (
                      <span
                        className={clsx(
                          "text-[10px] uppercase font-medium mt-0.5 inline-block",
                          typeConfig?.color || "text-vscode-text-muted"
                        )}
                      >
                        {keyType}
                      </span>
                    )}
                  </div>

                  {/* Copy button */}
                  {isHovered && (
                    <button
                      onClick={(e) => handleCopyKey(key, e)}
                      className="p-1 rounded hover:bg-vscode-bg text-vscode-text-muted hover:text-vscode-text transition-colors"
                      title="Copy key"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </button>
              );
            })}

            {/* Load more button */}
            {showLoadMore && (
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="w-full px-3 py-2.5 text-center text-sm text-vscode-accent hover:bg-vscode-bg-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Load more keys
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer with counts */}
      <div className="px-3 py-1.5 border-t border-vscode-border text-xs text-vscode-text-muted flex items-center justify-between">
        <span>
          {localSearchQuery
            ? `${filteredKeys.length} matching`
            : hasMore
            ? `${filteredKeys.length}+ loaded`
            : `${filteredKeys.length} keys`}
        </span>
        {enableServerSearch && localSearchQuery && (
          <span className="text-vscode-accent">
            Pattern: {localSearchQuery.includes("*") ? localSearchQuery : `*${localSearchQuery}*`}
          </span>
        )}
      </div>
    </div>
  );
};

export default RedisKeyList;
