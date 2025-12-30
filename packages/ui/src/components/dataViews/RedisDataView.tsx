/**
 * RedisDataView - Data view component for Redis
 *
 * Features:
 * - Split layout: Key list sidebar + Type-specific viewer
 * - Server-side SCAN search with pattern matching
 * - Cursor-based pagination with "Load more"
 * - Type-aware display for STRING, HASH, LIST, SET, ZSET, STREAM
 * - Value preview with format detection
 */

import type { FC } from "react";
import { useState, useCallback, useEffect } from "react";
import type { RedisDataViewProps } from "./types";
import { DataViewToolbar, ToolbarButton, DataViewStatusBar } from "./shared";
import { RedisSidebarTree } from "./redisView/RedisSidebarTree";
import {
  RedisStringView,
  RedisHashView,
  RedisListView,
  RedisSetView,
  RedisSortedSetView,
  RedisStreamView,
  RedisRawView,
} from "./redisView/views";
import { TYPE_CONFIG, type RedisDataType } from "./redisView/types";
import { formatTTL, formatMemory } from "./redisView/utils";
import { getVsCodeApi } from "../../vscode";
import {
  Key,
  Download,
  RefreshCw,
  Clock,
  HardDrive,
  Info,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

/**
 * Key info header showing TTL and memory
 */
interface KeyInfoHeaderProps {
  keyName: string;
  keyType: RedisDataType | string; // Allow string for unknown/module types
  ttl?: number;
  memory?: number;
  onRefresh: () => void;
  loading?: boolean;
}

const KeyInfoHeader: FC<KeyInfoHeaderProps> = ({
  keyName,
  keyType,
  ttl,
  memory,
  onRefresh,
  loading = false,
}) => {
  // Safely access TYPE_CONFIG - only use if keyType is a known RedisDataType
  const config = keyType in TYPE_CONFIG ? TYPE_CONFIG[keyType as RedisDataType] : undefined;
  const Icon = config?.icon || Key;
  const ttlInfo = ttl !== undefined ? formatTTL(ttl) : null;
  const memoryStr = formatMemory(memory);

  return (
    <div className="px-4 py-3 border-b border-vscode-border bg-vscode-bg-light">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={clsx(
              "p-2 rounded-lg",
              config?.bgColor || "bg-vscode-bg"
            )}
          >
            <Icon className={clsx("w-4 h-4", config?.color || "text-vscode-text")} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-mono font-medium text-vscode-text truncate">
              {keyName}
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span
                className={clsx(
                  "text-xs font-medium uppercase",
                  config?.color || "text-vscode-text-muted"
                )}
              >
                {keyType}
              </span>
              {ttlInfo && (
                <span className={clsx("text-xs flex items-center gap-1", ttlInfo.color)}>
                  <Clock className="w-3 h-3" />
                  {ttlInfo.text}
                </span>
              )}
              {memory !== undefined && (
                <span className="text-xs text-vscode-text-muted flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {memoryStr}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors disabled:opacity-50"
          title="Refresh key data"
        >
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>
    </div>
  );
};

// Key data structure received from extension
interface KeyData {
  type: RedisDataType | string; // Allow string for unknown/module types
  value: string | null;
  ttl?: number;
  memory?: number;
  fields?: Array<{ field: string; value: string }>;
  items?: Array<{ index: number; value: string }>;
  members?: Array<{ value: string; score?: number }>;
  entries?: Array<{ id: string; fields: Record<string, unknown> }>;
  streamInfo?: {
    length: number;
    firstEntry?: string;
    lastEntry?: string;
    groups?: number;
  };
  // For unknown/module types
  rawValue?: string | null;
  jsonValue?: unknown;
  debugInfo?: string;
  encoding?: string;
  dumpHex?: string;
  isUnknownType?: boolean;
}

export const RedisDataView: FC<RedisDataViewProps> = ({
  schema,
  table,
  columns: externalColumns,
  rows,
  loading,
  totalRows,
  limit,
  offset,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  dbType,
  keyType,
  onKeyTypeChange,
  keyPattern = "",
  onKeyPatternChange,
}) => {
  const vscode = getVsCodeApi();

  // Selected key state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedKeyType, setSelectedKeyType] = useState<RedisDataType | string | null>(null);

  // Total key count (from DBSIZE)
  const [dbSize, setDbSize] = useState<number | null>(null);

  // Selected key data
  const [selectedKeyData, setSelectedKeyData] = useState<KeyData | null>(null);
  const [keyDataLoading, setKeyDataLoading] = useState(false);

  // Clear selected key when schema (database) changes
  useEffect(() => {
    setSelectedKey(null);
    setSelectedKeyType(null);
    setSelectedKeyData(null);
    setKeyDataLoading(false);
    setDbSize(null);
  }, [schema]);

  // Set up message listener for extension responses
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "REDIS_KEY_VALUE":
          if (message.key === selectedKey) {
            setSelectedKeyData(message.data);
            setKeyDataLoading(false);
          }
          break;

        case "REDIS_DBSIZE":
          setDbSize(message.size);
          break;

        case "REDIS_ERROR":
          toast.error(message.error || "Redis operation failed");
          setKeyDataLoading(false);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [selectedKey]);

  // Handle key selection from the tree sidebar
  const handleKeySelectFromTree = useCallback(
    (key: string, type: RedisDataType | string) => {
      setSelectedKey(key);
      setSelectedKeyType(type);
      setKeyDataLoading(true);
      setSelectedKeyData(null);

      // Request key data from extension
      vscode?.postMessage({
        type: "GET_REDIS_KEY_VALUE",
        schema,
        key,
      });
    },
    [vscode, schema]
  );

  // Handle refresh - re-fetch selected key data
  const handleRefresh = useCallback(() => {
    onRefresh?.();

    // Re-fetch selected key data if any
    if (selectedKey && selectedKeyType) {
      setKeyDataLoading(true);
      vscode?.postMessage({
        type: "GET_REDIS_KEY_VALUE",
        schema,
        key: selectedKey,
      });
    }
  }, [onRefresh, vscode, schema, selectedKey, selectedKeyType]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!selectedKeyData) {
      toast.error("No key selected to export");
      return;
    }
    const exportData = {
      ...selectedKeyData,
      key: selectedKey, // Override key with the selected key name
    };
    const json = JSON.stringify(exportData, null, 2);
    vscode?.postMessage({
      type: "EXPORT_DATA",
      schema,
      table: `redis_${selectedKey}`,
      content: json,
      extension: "json",
      mimeType: "application/json",
    });
  }, [vscode, schema, selectedKey, selectedKeyData]);

  // Render type-specific view
  const renderTypeView = () => {
    if (!selectedKey || !selectedKeyData) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-vscode-text-muted">
          <Info className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Select a key to view its value</p>
        </div>
      );
    }

    const commonProps = {
      keyName: selectedKey,
      loading: keyDataLoading,
      isReadOnly: true,
      onRefresh: () => handleKeySelectFromTree(selectedKey, selectedKeyData.type),
    };

    switch (selectedKeyData.type) {
      case "string":
        return <RedisStringView {...commonProps} value={selectedKeyData.value} />;

      case "hash":
        return (
          <RedisHashView {...commonProps} fields={selectedKeyData.fields || []} />
        );

      case "list":
        return (
          <RedisListView
            {...commonProps}
            items={selectedKeyData.items || []}
            totalLength={selectedKeyData.items?.length || 0}
          />
        );

      case "set":
        return (
          <RedisSetView
            {...commonProps}
            members={(selectedKeyData.members || []).map((m) => ({ value: m.value }))}
            totalCount={selectedKeyData.members?.length || 0}
          />
        );

      case "zset":
        return (
          <RedisSortedSetView
            {...commonProps}
            members={
              (selectedKeyData.members || []).map((m) => ({
                value: m.value,
                score: m.score || 0,
              }))
            }
            totalCount={selectedKeyData.members?.length || 0}
          />
        );

      case "stream":
        return (
          <RedisStreamView
            {...commonProps}
            entries={selectedKeyData.entries || []}
            streamInfo={selectedKeyData.streamInfo}
          />
        );

      // RedisJSON module types
      case "ReJSON-RL":
      case "rejson-rl":
        return (
          <RedisRawView
            {...commonProps}
            keyType={selectedKeyData.type}
            rawValue={selectedKeyData.rawValue}
            jsonValue={selectedKeyData.jsonValue}
            debugInfo={selectedKeyData.debugInfo}
            encoding={selectedKeyData.encoding}
            dumpHex={selectedKeyData.dumpHex}
          />
        );

      default:
        // For unknown types, use RedisRawView as fallback
        return (
          <RedisRawView
            {...commonProps}
            keyType={selectedKeyData.type}
            rawValue={selectedKeyData.rawValue}
            jsonValue={selectedKeyData.jsonValue}
            debugInfo={selectedKeyData.debugInfo}
            encoding={selectedKeyData.encoding}
            dumpHex={selectedKeyData.dumpHex}
          />
        );
    }
  };

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Toolbar */}
      <DataViewToolbar
        dbType={dbType}
        schema={schema}
        table={selectedKey || "Keys"}
        columnCount={0}
        rowCount={0}
        totalRows={dbSize || totalRows}
        loading={loading || keyDataLoading}
        onRefresh={handleRefresh}
        hasSelectedRows={false}
        selectedRowsCount={0}
        readOnly={true}
        leftActions={
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Download className="h-3.5 w-3.5" />}
              label="Export"
              onClick={handleExport}
              title="Export selected key as JSON"
              disabled={!selectedKeyData}
            />
          </div>
        }
      />

      {/* Main content - Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Key tree sidebar */}
        <div className="w-72 border-r border-vscode-border flex-shrink-0">
          <RedisSidebarTree
            schema={schema}
            selectedKey={selectedKey}
            onKeySelect={handleKeySelectFromTree}
            typeFilter={null}
            delimiter=":"
          />
        </div>

        {/* Key value viewer */}
        <div className="flex-1 flex flex-col overflow-hidden bg-vscode-bg">
          {selectedKey && selectedKeyData && (
            <KeyInfoHeader
              keyName={selectedKey}
              keyType={selectedKeyData.type}
              ttl={selectedKeyData.ttl}
              memory={selectedKeyData.memory}
              onRefresh={() => handleKeySelectFromTree(selectedKey, selectedKeyData.type)}
              loading={keyDataLoading}
            />
          )}

          {/* Type-specific view */}
          {renderTypeView()}
        </div>
      </div>

      {/* Status Bar */}
      <DataViewStatusBar
        dbType={dbType}
        loading={keyDataLoading}
        hasSelectedRows={false}
        selectedRowsCount={0}
        readOnly={true}
        customStatus={
          selectedKey
            ? `Key: ${selectedKey}${selectedKeyType ? ` (${selectedKeyType})` : ""}`
            : "Select a key to view"
        }
      />
    </div>
  );
};
