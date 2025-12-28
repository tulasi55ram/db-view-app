import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw,
  Clock,
  HardDrive,
  Type,
  Hash,
  List,
  Circle,
  BarChart2,
  Activity,
  HelpCircle,
  Copy,
  Trash2,
  Timer,
  Lock,
  ChevronDown,
  Search,
  ChevronsDown,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import type { RedisDataType, RedisKeyInfo } from "./types";
import { TYPE_CONFIG } from "./types";
import { formatTTL, formatMemory, copyToClipboard } from "./utils";
import { RedisStringView } from "./views/RedisStringView";
import { RedisHashView } from "./views/RedisHashView";
import { RedisListView } from "./views/RedisListView";
import { RedisSetView } from "./views/RedisSetView";
import { RedisSortedSetView } from "./views/RedisSortedSetView";
import { RedisStreamView } from "./views/RedisStreamView";

interface RedisDataViewProps {
  connectionKey: string;
  schema: string; // Redis DB index as string (e.g., "0", "1")
  table: string;  // Key pattern like "[hash] user" or "[string] cache"
}

// Icon component mapping
const TypeIcons: Record<RedisDataType, typeof Type> = {
  string: Type,
  hash: Hash,
  list: List,
  set: Circle,
  zset: BarChart2,
  stream: Activity,
  none: HelpCircle,
};

// Page size for key loading
const PAGE_SIZE = 100;

export function RedisDataView({ connectionKey, schema, table }: RedisDataViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [keyInfo, setKeyInfo] = useState<RedisKeyInfo | null>(null);
  const [keyType, setKeyType] = useState<RedisDataType>('none');
  const [keys, setKeys] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalEstimate, setTotalEstimate] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showTTLEditor, setShowTTLEditor] = useState(false);
  const [ttlInput, setTTLInput] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<RedisDataType>('string');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyTTL, setNewKeyTTL] = useState('');

  const listRef = useRef<HTMLDivElement>(null);
  const api = getElectronAPI();

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filterQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterQuery]);

  // Parse table name to get type and prefix
  // Format: "[type] prefix" e.g., "[hash] user" or "[string] cache"
  const parseTableName = useCallback((tableName: string): { type: RedisDataType; prefix: string } => {
    const match = tableName.match(/^\[(\w+)\]\s*(.*)$/);
    if (match) {
      return {
        type: match[1] as RedisDataType,
        prefix: match[2] || '*',
      };
    }
    return { type: 'string', prefix: tableName };
  }, []);

  const { type: parsedType } = parseTableName(table);

  // Load keys matching the pattern (with pagination)
  const loadKeys = useCallback(async (append = false) => {
    if (!api) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setKeys([]);
      }

      const currentOffset = append ? keys.length : 0;

      // Fetch keys using the existing loadTableRows which handles Redis key fetching
      const result = await api.loadTableRows({
        connectionKey,
        schema,
        table,
        limit: PAGE_SIZE + 1, // Fetch one extra to check if there are more
        offset: currentOffset,
      });

      // Extract unique keys from the result
      const newKeys = [...new Set(result.rows.map((row) => String(row._key)))];

      // Check if there are more keys
      const fetchedMore = newKeys.length > PAGE_SIZE;
      setHasMore(fetchedMore);

      // Only keep PAGE_SIZE keys
      const keysToAdd = fetchedMore ? newKeys.slice(0, PAGE_SIZE) : newKeys;

      if (append) {
        setKeys(prev => [...prev, ...keysToAdd]);
      } else {
        setKeys(keysToAdd);
        setKeyType(parsedType);

        // Estimate total count (rough estimate based on first batch)
        if (fetchedMore) {
          // If we got more than PAGE_SIZE, estimate there might be many more
          setTotalEstimate(null); // Show "100+" format
        } else {
          setTotalEstimate(keysToAdd.length);
        }
      }

      // Select first key if none selected
      if (!append && keysToAdd.length > 0 && !selectedKey) {
        setSelectedKey(keysToAdd[0]);
      }
    } catch (err) {
      console.error("Failed to load Redis keys:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [api, connectionKey, schema, table, parsedType, selectedKey, keys.length]);

  // Load more keys
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadKeys(true);
    }
  }, [loadKeys, loadingMore, hasMore]);

  // Filter keys locally
  const filteredKeys = useMemo(() => {
    if (!debouncedFilter) return keys;
    const lower = debouncedFilter.toLowerCase();
    return keys.filter(key => key.toLowerCase().includes(lower));
  }, [keys, debouncedFilter]);

  // Load key info (TTL, memory, etc.)
  const loadKeyInfo = useCallback(async (key: string) => {
    if (!api) return;

    try {
      // Use raw query to get key info
      const ttlResult = await api.runQuery({
        connectionKey,
        sql: `TTL ${key}`,
      });

      const typeResult = await api.runQuery({
        connectionKey,
        sql: `TYPE ${key}`,
      });

      // Try to get memory usage (may fail on older Redis)
      let memoryUsage: number | undefined;
      try {
        const memResult = await api.runQuery({
          connectionKey,
          sql: `MEMORY USAGE ${key}`,
        });
        if (memResult.rows?.[0]) {
          memoryUsage = Number(Object.values(memResult.rows[0])[0]);
        }
      } catch {
        // Memory command not supported
      }

      const ttl = ttlResult.rows?.[0] ? Number(Object.values(ttlResult.rows[0])[0]) : -1;
      const type = typeResult.rows?.[0] ? String(Object.values(typeResult.rows[0])[0]) as RedisDataType : 'none';

      setKeyInfo({
        key,
        type,
        ttl,
        memoryUsage,
      });
    } catch (err) {
      console.error("Failed to load key info:", err);
    }
  }, [api, connectionKey]);

  // Check read-only status
  useEffect(() => {
    const fetchConnectionConfig = async () => {
      if (!api) return;
      try {
        const connections = await api.getConnections();
        const connection = connections.find((c) => {
          const cfg = c.config as Record<string, unknown>;
          const key = cfg.name
            ? `${cfg.dbType}:${cfg.name}`
            : `${cfg.dbType}:${JSON.stringify(cfg)}`;
          return key === connectionKey;
        });
        if (connection?.config && 'readOnly' in connection.config) {
          setIsReadOnly(Boolean(connection.config.readOnly));
        }
      } catch (error) {
        console.error("Failed to fetch connection config:", error);
      }
    };
    fetchConnectionConfig();
  }, [api, connectionKey]);

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Load key info when selected key changes
  useEffect(() => {
    if (selectedKey) {
      loadKeyInfo(selectedKey);
    }
  }, [selectedKey, loadKeyInfo]);

  // Handle TTL update
  const handleSetTTL = async () => {
    if (!api || !selectedKey || !ttlInput) return;

    try {
      const ttlSeconds = parseInt(ttlInput, 10);
      if (isNaN(ttlSeconds) || ttlSeconds < 0) {
        toast.error("Invalid TTL value");
        return;
      }

      if (ttlSeconds === 0) {
        // Remove TTL (persist key)
        await api.runQuery({
          connectionKey,
          sql: `PERSIST ${selectedKey}`,
        });
        toast.success("TTL removed - key will not expire");
      } else {
        await api.runQuery({
          connectionKey,
          sql: `EXPIRE ${selectedKey} ${ttlSeconds}`,
        });
        toast.success(`TTL set to ${ttlSeconds} seconds`);
      }

      setShowTTLEditor(false);
      setTTLInput('');
      loadKeyInfo(selectedKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set TTL");
    }
  };

  // Handle key deletion
  const handleDeleteKey = async () => {
    if (!api || !selectedKey) return;

    if (!confirm(`Delete key "${selectedKey}"?`)) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `DEL ${selectedKey}`,
      });
      toast.success("Key deleted");
      setSelectedKey(null);
      loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete key");
    }
  };

  // Handle add new key
  const handleAddKey = async () => {
    if (!api || !newKeyName.trim()) {
      toast.error("Key name is required");
      return;
    }

    try {
      let command: string;
      const keyName = newKeyName.trim();
      const value = newKeyValue.trim();

      switch (newKeyType) {
        case 'string':
          command = `SET ${keyName} ${JSON.stringify(value || '')}`;
          break;
        case 'hash':
          if (!value) {
            // Create empty hash with a placeholder field
            command = `HSET ${keyName} "__placeholder__" ""`;
          } else {
            // Parse value as JSON object for hash
            try {
              const obj = JSON.parse(value);
              if (typeof obj !== 'object' || Array.isArray(obj)) {
                toast.error("Hash value must be a JSON object");
                return;
              }
              // Quote both field keys and values
              const fields = Object.entries(obj).flatMap(([k, v]) => {
                const quotedKey = `"${String(k).replace(/"/g, '\\"')}"`;
                const quotedValue = `"${String(v).replace(/"/g, '\\"')}"`;
                return [quotedKey, quotedValue];
              });
              if (fields.length === 0) {
                command = `HSET ${keyName} "__placeholder__" ""`;
              } else {
                command = `HSET ${keyName} ${fields.join(' ')}`;
              }
            } catch {
              toast.error("Invalid JSON for hash value");
              return;
            }
          }
          break;
        case 'list':
          if (!value) {
            // Push empty placeholder
            command = `RPUSH ${keyName} ""`;
          } else {
            try {
              const arr = JSON.parse(value);
              if (!Array.isArray(arr)) {
                toast.error("List value must be a JSON array");
                return;
              }
              const items = arr.map(v => JSON.stringify(v));
              command = `RPUSH ${keyName} ${items.join(' ')}`;
            } catch {
              // Treat as single value
              command = `RPUSH ${keyName} ${JSON.stringify(value)}`;
            }
          }
          break;
        case 'set':
          if (!value) {
            command = `SADD ${keyName} ""`;
          } else {
            try {
              const arr = JSON.parse(value);
              if (!Array.isArray(arr)) {
                toast.error("Set value must be a JSON array");
                return;
              }
              const members = arr.map(v => JSON.stringify(v));
              command = `SADD ${keyName} ${members.join(' ')}`;
            } catch {
              command = `SADD ${keyName} ${JSON.stringify(value)}`;
            }
          }
          break;
        case 'zset':
          if (!value) {
            command = `ZADD ${keyName} 0 ""`;
          } else {
            try {
              // Expect array of [score, member] pairs or object {member: score}
              const data = JSON.parse(value);
              if (Array.isArray(data)) {
                const args = data.flatMap(([score, member]) => [score, JSON.stringify(member)]);
                command = `ZADD ${keyName} ${args.join(' ')}`;
              } else if (typeof data === 'object') {
                const args = Object.entries(data).flatMap(([member, score]) => [score, JSON.stringify(member)]);
                command = `ZADD ${keyName} ${args.join(' ')}`;
              } else {
                command = `ZADD ${keyName} 0 ${JSON.stringify(value)}`;
              }
            } catch {
              command = `ZADD ${keyName} 0 ${JSON.stringify(value)}`;
            }
          }
          break;
        case 'stream':
          // For streams, add an entry with fields
          if (!value) {
            command = `XADD ${keyName} * "field" "value"`;
          } else {
            try {
              const obj = JSON.parse(value);
              if (typeof obj !== 'object' || Array.isArray(obj)) {
                toast.error("Stream value must be a JSON object");
                return;
              }
              // Quote both field keys and values
              const fields = Object.entries(obj).flatMap(([k, v]) => {
                const quotedKey = `"${String(k).replace(/"/g, '\\"')}"`;
                const quotedValue = `"${String(v).replace(/"/g, '\\"')}"`;
                return [quotedKey, quotedValue];
              });
              command = `XADD ${keyName} * ${fields.join(' ')}`;
            } catch {
              command = `XADD ${keyName} * "value" "${value.replace(/"/g, '\\"')}"`;
            }
          }
          break;
        default:
          command = `SET ${keyName} ${JSON.stringify(value || '')}`;
      }

      await api.runQuery({ connectionKey, sql: command });

      // Set TTL if specified
      if (newKeyTTL.trim()) {
        const ttlSeconds = parseInt(newKeyTTL.trim(), 10);
        if (!isNaN(ttlSeconds) && ttlSeconds > 0) {
          await api.runQuery({
            connectionKey,
            sql: `EXPIRE ${keyName} ${ttlSeconds}`,
          });
        }
      }

      toast.success(`Key "${keyName}" created`);
      setShowAddKeyDialog(false);
      setNewKeyName('');
      setNewKeyValue('');
      setNewKeyTTL('');
      setNewKeyType('string');
      loadKeys();
      setSelectedKey(keyName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    }
  };

  // Copy key name
  const handleCopyKey = async () => {
    if (!selectedKey) return;
    const success = await copyToClipboard(selectedKey);
    if (success) {
      toast.success("Key name copied");
    }
  };

  // Handle scroll to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load more when user scrolls to bottom (within 100px)
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loadingMore) {
      handleLoadMore();
    }
  }, [hasMore, loadingMore, handleLoadMore]);

  // Get type icon component
  const TypeIcon = TypeIcons[keyType];
  const typeConfig = TYPE_CONFIG[keyType];
  const ttlInfo = keyInfo ? formatTTL(keyInfo.ttl) : null;

  // Format key count display
  const keyCountDisplay = useMemo(() => {
    if (loading) return "Loading...";
    if (totalEstimate !== null) {
      return `${totalEstimate} key${totalEstimate !== 1 ? 's' : ''}`;
    }
    return `${keys.length}${hasMore ? '+' : ''} key${keys.length !== 1 ? 's' : ''}`;
  }, [loading, totalEstimate, keys.length, hasMore]);

  // Render the appropriate view based on data type
  const renderDataView = () => {
    if (!selectedKey) {
      return (
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          <div className="text-center">
            <p className="text-lg mb-2">No Key Selected</p>
            <p className="text-sm text-text-tertiary">
              Select a key from the list to view its data
            </p>
          </div>
        </div>
      );
    }

    const viewProps = {
      connectionKey,
      schema,
      table,
      keyName: selectedKey,
      isReadOnly,
      onRefresh: loadKeys,
    };

    switch (keyType) {
      case 'string':
        return <RedisStringView {...viewProps} />;
      case 'hash':
        return <RedisHashView {...viewProps} />;
      case 'list':
        return <RedisListView {...viewProps} />;
      case 'set':
        return <RedisSetView {...viewProps} />;
      case 'zset':
        return <RedisSortedSetView {...viewProps} />;
      case 'stream':
        return <RedisStreamView {...viewProps} />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <p>Unknown data type: {keyType}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          {/* Type Badge */}
          <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-tertiary", typeConfig.color)}>
            <TypeIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{typeConfig.name}</span>
          </div>

          {/* Key Selector Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-primary border border-border hover:bg-bg-hover transition-colors"
              onClick={() => {/* Could add a dropdown here */}}
            >
              <span className="text-sm font-mono truncate max-w-[200px]">
                {selectedKey || "Select key..."}
              </span>
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>

          {/* Key Count */}
          <span className="text-sm text-text-secondary">
            {keyCountDisplay}
          </span>

          {isReadOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-xs font-medium">
              <Lock className="w-3 h-3" />
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Add New Key Button */}
          {!isReadOnly && (
            <button
              onClick={() => setShowAddKeyDialog(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
              title="Add new key"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Key</span>
            </button>
          )}

          {/* Key Info Pills */}
          {keyInfo && (
            <>
              {/* TTL Badge */}
              <button
                onClick={() => !isReadOnly && setShowTTLEditor(!showTTLEditor)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  ttlInfo?.urgent ? "bg-red-500/15" : "bg-bg-tertiary hover:bg-bg-hover",
                  ttlInfo?.color
                )}
                title={isReadOnly ? "Read-only mode" : "Click to edit TTL"}
                disabled={isReadOnly}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{ttlInfo?.text}</span>
              </button>

              {/* Memory Usage */}
              {keyInfo.memoryUsage !== undefined && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-tertiary text-xs text-text-secondary">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>{formatMemory(keyInfo.memoryUsage)}</span>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="w-px h-5 bg-border mx-1" />

          <button
            onClick={handleCopyKey}
            disabled={!selectedKey}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary disabled:opacity-50"
            title="Copy key name"
          >
            <Copy className="w-4 h-4" />
          </button>

          {!isReadOnly && (
            <button
              onClick={handleDeleteKey}
              disabled={!selectedKey}
              className="p-1.5 rounded hover:bg-bg-hover transition-colors text-error disabled:opacity-50"
              title="Delete key"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => loadKeys()}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* TTL Editor Popover */}
      {showTTLEditor && (
        <div className="px-4 py-2 border-b border-border bg-bg-tertiary flex items-center gap-3">
          <Timer className="w-4 h-4 text-text-secondary" />
          <span className="text-sm text-text-secondary">Set TTL:</span>
          <input
            type="number"
            value={ttlInput}
            onChange={(e) => setTTLInput(e.target.value)}
            placeholder="Seconds (0 = no expiry)"
            className="w-40 px-2 py-1 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            min="0"
          />
          <button
            onClick={handleSetTTL}
            className="px-3 py-1 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setShowTTLEditor(false);
              setTTLInput('');
            }}
            className="px-3 py-1 rounded bg-bg-hover text-text-secondary text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Key List Sidebar */}
        <div className="w-64 border-r border-border bg-bg-secondary overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter keys..."
                className="w-full pl-8 pr-3 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Keys List with Infinite Scroll */}
          <div
            ref={listRef}
            className="flex-1 overflow-auto"
            onScroll={handleScroll}
          >
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <RefreshCw className="w-5 h-5 animate-spin text-text-tertiary" />
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="p-4 text-center text-text-tertiary text-sm">
                {keys.length === 0 ? "No keys found" : "No matching keys"}
              </div>
            ) : (
              <div className="py-1">
                {filteredKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm font-mono truncate transition-colors",
                      selectedKey === key
                        ? "bg-accent/10 text-accent border-l-2 border-accent"
                        : "hover:bg-bg-hover text-text-primary"
                    )}
                    title={key}
                  >
                    {key}
                  </button>
                ))}

                {/* Load More Indicator */}
                {hasMore && !debouncedFilter && (
                  <div className="px-3 py-2">
                    {loadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-text-tertiary text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading more...
                      </div>
                    ) : (
                      <button
                        onClick={handleLoadMore}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm transition-colors"
                      >
                        <ChevronsDown className="w-4 h-4" />
                        Load more keys
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with loaded count */}
          {keys.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border text-xs text-text-tertiary">
              {debouncedFilter
                ? `${filteredKeys.length} of ${keys.length} loaded`
                : `${keys.length} loaded${hasMore ? ' (scroll for more)' : ''}`
              }
            </div>
          )}
        </div>

        {/* Data View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderDataView()}
        </div>
      </div>

      {/* Add New Key Dialog */}
      {showAddKeyDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-lg font-medium text-text-primary">Add New Key</h3>
              <button
                onClick={() => {
                  setShowAddKeyDialog(false);
                  setNewKeyName('');
                  setNewKeyValue('');
                  setNewKeyTTL('');
                  setNewKeyType('string');
                }}
                className="p-1 rounded hover:bg-bg-hover transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Key Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Key Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., user:123 or cache:session"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              {/* Key Type */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Type
                </label>
                <select
                  value={newKeyType}
                  onChange={(e) => setNewKeyType(e.target.value as RedisDataType)}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="string">String</option>
                  <option value="hash">Hash</option>
                  <option value="list">List</option>
                  <option value="set">Set</option>
                  <option value="zset">Sorted Set</option>
                  <option value="stream">Stream</option>
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Value {newKeyType !== 'string' && <span className="text-text-tertiary">(optional)</span>}
                </label>
                <textarea
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder={
                    newKeyType === 'string' ? 'Enter string value...' :
                    newKeyType === 'hash' ? '{"field1": "value1", "field2": "value2"}' :
                    newKeyType === 'list' ? '["item1", "item2", "item3"]' :
                    newKeyType === 'set' ? '["member1", "member2", "member3"]' :
                    newKeyType === 'zset' ? '{"member1": 1, "member2": 2}' :
                    newKeyType === 'stream' ? '{"field1": "value1"}' :
                    'Enter value...'
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  {newKeyType === 'hash' && 'JSON object: {"field": "value"}'}
                  {newKeyType === 'list' && 'JSON array: ["item1", "item2"] or single value'}
                  {newKeyType === 'set' && 'JSON array: ["member1", "member2"] or single value'}
                  {newKeyType === 'zset' && 'Object: {"member": score} or array: [[score, "member"]]'}
                  {newKeyType === 'stream' && 'JSON object for stream entry fields'}
                </p>
              </div>

              {/* TTL */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  TTL (seconds) <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  type="number"
                  value={newKeyTTL}
                  onChange={(e) => setNewKeyTTL(e.target.value)}
                  placeholder="Leave empty for no expiry"
                  min="0"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => {
                  setShowAddKeyDialog(false);
                  setNewKeyName('');
                  setNewKeyValue('');
                  setNewKeyTTL('');
                  setNewKeyType('string');
                }}
                className="px-4 py-2 rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKey}
                disabled={!newKeyName.trim()}
                className="px-4 py-2 rounded-md bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
