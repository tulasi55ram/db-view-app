import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Key,
  Layers,
  Hash,
  RefreshCw,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { CassandraValueCell } from "./CassandraValueCell";
import type { ColumnMetadata } from "@dbview/types";

interface CassandraPartitionViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  rows: Record<string, unknown>[];
  columns: string[];
  metadata: ColumnMetadata[];
  loading: boolean;
  onRefresh: () => void;
}

interface PartitionGroup {
  partitionKey: Record<string, unknown>;
  partitionKeyStr: string;
  rows: Record<string, unknown>[];
  isExpanded: boolean;
}

/**
 * CassandraPartitionView - Wide-column store visualization
 *
 * This view properly represents Cassandra's data model:
 * - Groups rows by partition key (shows data locality)
 * - Displays clustering key hierarchy within partitions
 * - Highlights the key structure (partition vs clustering)
 * - Shows sparse columns appropriately
 * - Provides partition-level statistics
 */
export function CassandraPartitionView({
  connectionKey: _connectionKey,
  schema: _schema,
  table: _table,
  rows,
  columns,
  metadata,
  loading,
  onRefresh: _onRefresh,
}: CassandraPartitionViewProps) {
  const [expandedPartitions, setExpandedPartitions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"partition" | "flat">("partition");

  // Identify partition keys and clustering keys from metadata using keyKind
  const keyInfo = useMemo(() => {
    const partitionKeys: string[] = [];
    const clusteringKeys: string[] = [];
    const regularColumns: string[] = [];

    for (const col of metadata) {
      // Use keyKind if available (Cassandra adapter provides this)
      if (col.keyKind === 'partition') {
        partitionKeys.push(col.name);
      } else if (col.keyKind === 'clustering') {
        clusteringKeys.push(col.name);
      } else if (col.keyKind === 'regular') {
        regularColumns.push(col.name);
      } else {
        // Fallback for when keyKind is not available (non-Cassandra or old data)
        if (col.isPrimaryKey && !col.editable) {
          partitionKeys.push(col.name);
        } else if (col.isPrimaryKey) {
          clusteringKeys.push(col.name);
        } else {
          regularColumns.push(col.name);
        }
      }
    }

    // If we couldn't distinguish, treat first PK column as partition
    if (partitionKeys.length === 0 && clusteringKeys.length > 0) {
      partitionKeys.push(clusteringKeys.shift()!);
    }

    return { partitionKeys, clusteringKeys, regularColumns };
  }, [metadata]);

  // Group rows by partition key
  const partitionGroups = useMemo((): PartitionGroup[] => {
    const groups = new Map<string, PartitionGroup>();

    for (const row of rows) {
      // Build partition key
      const partitionKey: Record<string, unknown> = {};
      for (const pk of keyInfo.partitionKeys) {
        partitionKey[pk] = row[pk];
      }
      const partitionKeyStr = JSON.stringify(partitionKey);

      if (!groups.has(partitionKeyStr)) {
        groups.set(partitionKeyStr, {
          partitionKey,
          partitionKeyStr,
          rows: [],
          isExpanded: expandedPartitions.has(partitionKeyStr),
        });
      }
      groups.get(partitionKeyStr)!.rows.push(row);
    }

    return Array.from(groups.values());
  }, [rows, keyInfo.partitionKeys, expandedPartitions]);

  // Toggle partition expansion
  const togglePartition = useCallback((partitionKeyStr: string) => {
    setExpandedPartitions((prev) => {
      const next = new Set(prev);
      if (next.has(partitionKeyStr)) {
        next.delete(partitionKeyStr);
      } else {
        next.add(partitionKeyStr);
      }
      return next;
    });
  }, []);

  // Expand/collapse all
  const expandAll = useCallback(() => {
    setExpandedPartitions(new Set(partitionGroups.map((g) => g.partitionKeyStr)));
  }, [partitionGroups]);

  const collapseAll = useCallback(() => {
    setExpandedPartitions(new Set());
  }, []);

  // Copy partition key
  const copyPartitionKey = useCallback((partitionKey: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(partitionKey, null, 2));
    toast.success("Partition key copied");
  }, []);

  // Statistics
  const stats = useMemo(() => ({
    totalRows: rows.length,
    partitionCount: partitionGroups.length,
    avgRowsPerPartition: partitionGroups.length > 0
      ? Math.round(rows.length / partitionGroups.length * 10) / 10
      : 0,
    maxRowsInPartition: Math.max(...partitionGroups.map((g) => g.rows.length), 0),
  }), [rows, partitionGroups]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with key structure info */}
      <div className="px-4 py-2 border-b border-border bg-bg-secondary/50">
        <div className="flex items-center justify-between">
          {/* Key Structure */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-text-secondary">Partition:</span>
              {keyInfo.partitionKeys.map((pk, i) => (
                <span key={pk} className="px-1.5 py-0.5 bg-yellow-500/15 text-yellow-500 rounded font-medium">
                  {pk}
                  {i < keyInfo.partitionKeys.length - 1 && ", "}
                </span>
              ))}
            </div>
            {keyInfo.clusteringKeys.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-text-secondary">Clustering:</span>
                {keyInfo.clusteringKeys.map((ck, i) => (
                  <span key={ck} className="px-1.5 py-0.5 bg-blue-500/15 text-blue-500 rounded font-medium">
                    {ck}
                    {i < keyInfo.clusteringKeys.length - 1 && ", "}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("partition")}
              className={cn(
                "px-2 py-1 rounded text-xs transition-colors",
                viewMode === "partition"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-bg-hover"
              )}
            >
              Partition View
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={cn(
                "px-2 py-1 rounded text-xs transition-colors",
                viewMode === "flat"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-bg-hover"
              )}
            >
              Flat View
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
          <span>
            <Hash className="w-3 h-3 inline mr-1" />
            {stats.partitionCount} partitions
          </span>
          <span>{stats.totalRows} total rows</span>
          <span>~{stats.avgRowsPerPartition} rows/partition</span>
          {stats.maxRowsInPartition > 10 && (
            <span className="text-amber-500">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Max {stats.maxRowsInPartition} rows (wide partition)
            </span>
          )}
        </div>

        {/* Expand/Collapse controls */}
        {viewMode === "partition" && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={expandAll}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Expand All
            </button>
            <span className="text-text-tertiary">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "partition" ? (
          <PartitionGroupList
            groups={partitionGroups}
            keyInfo={keyInfo}
            metadata={metadata}
            columns={columns}
            onToggle={togglePartition}
            onCopyPartitionKey={copyPartitionKey}
          />
        ) : (
          <FlatTableView
            rows={rows}
            columns={columns}
            metadata={metadata}
            keyInfo={keyInfo}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Partition Group List
// ============================================

interface PartitionGroupListProps {
  groups: PartitionGroup[];
  keyInfo: {
    partitionKeys: string[];
    clusteringKeys: string[];
    regularColumns: string[];
  };
  metadata: ColumnMetadata[];
  columns: string[];
  onToggle: (partitionKeyStr: string) => void;
  onCopyPartitionKey: (partitionKey: Record<string, unknown>) => void;
}

function PartitionGroupList({
  groups,
  keyInfo,
  metadata,
  columns,
  onToggle,
  onCopyPartitionKey,
}: PartitionGroupListProps) {
  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
        No data
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => (
        <PartitionGroupItem
          key={group.partitionKeyStr}
          group={group}
          keyInfo={keyInfo}
          metadata={metadata}
          columns={columns}
          onToggle={() => onToggle(group.partitionKeyStr)}
          onCopyPartitionKey={() => onCopyPartitionKey(group.partitionKey)}
        />
      ))}
    </div>
  );
}

// ============================================
// Partition Group Item
// ============================================

interface PartitionGroupItemProps {
  group: PartitionGroup;
  keyInfo: {
    partitionKeys: string[];
    clusteringKeys: string[];
    regularColumns: string[];
  };
  metadata: ColumnMetadata[];
  columns: string[];
  onToggle: () => void;
  onCopyPartitionKey: () => void;
}

function PartitionGroupItem({
  group,
  keyInfo,
  metadata,
  columns: _columns,
  onToggle,
  onCopyPartitionKey,
}: PartitionGroupItemProps) {
  const [isExpanded, setIsExpanded] = useState(group.isExpanded);

  useEffect(() => {
    setIsExpanded(group.isExpanded);
  }, [group.isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle();
  };

  // Format partition key for display
  const formatPartitionKey = () => {
    return keyInfo.partitionKeys.map((pk) => {
      const value = group.partitionKey[pk];
      if (typeof value === "string" && value.length > 20) {
        return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
      }
      return String(value);
    }).join(", ");
  };

  return (
    <div className="bg-bg-primary">
      {/* Partition Header */}
      <div
        className="flex items-center gap-2 px-4 py-2 hover:bg-bg-hover cursor-pointer transition-colors group"
        onClick={handleToggle}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-tertiary" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-tertiary" />
        )}

        <Key className="w-4 h-4 text-yellow-500" />

        <span className="font-mono text-sm text-yellow-500/90">
          {formatPartitionKey()}
        </span>

        <span className="text-xs text-text-tertiary">
          ({group.rows.length} {group.rows.length === 1 ? "row" : "rows"})
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyPartitionKey();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-tertiary rounded transition-opacity"
          title="Copy partition key"
        >
          <Copy className="w-3 h-3 text-text-tertiary" />
        </button>

        {group.rows.length > 100 && (
          <span className="ml-auto text-xs text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Wide partition
          </span>
        )}
      </div>

      {/* Expanded Content - Clustering Rows */}
      {isExpanded && (
        <div className="border-l-4 border-yellow-500/30 ml-4 bg-bg-secondary/30">
          <table className="w-full text-sm">
            <thead className="bg-bg-tertiary/50 sticky top-0">
              <tr>
                {/* Clustering key columns */}
                {keyInfo.clusteringKeys.map((ck) => (
                  <th
                    key={ck}
                    className="px-3 py-1.5 text-left text-xs font-medium text-blue-500"
                  >
                    <Layers className="w-3 h-3 inline mr-1" />
                    {ck}
                  </th>
                ))}
                {/* Regular columns */}
                {keyInfo.regularColumns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-1.5 text-left text-xs font-medium text-text-secondary"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {group.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-bg-hover/50">
                  {/* Clustering key values */}
                  {keyInfo.clusteringKeys.map((ck) => (
                    <td key={ck} className="px-3 py-1.5 text-blue-500/90 font-mono text-xs">
                      <CassandraValueCell
                        value={row[ck]}
                        columnName={ck}
                        columnType={metadata.find((m) => m.name === ck)?.type || "text"}
                        isCompact={true}
                      />
                    </td>
                  ))}
                  {/* Regular column values */}
                  {keyInfo.regularColumns.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-text-primary">
                      <CassandraValueCell
                        value={row[col]}
                        columnName={col}
                        columnType={metadata.find((m) => m.name === col)?.type || "text"}
                        isCompact={true}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// Flat Table View (Traditional)
// ============================================

interface FlatTableViewProps {
  rows: Record<string, unknown>[];
  columns: string[];
  metadata: ColumnMetadata[];
  keyInfo: {
    partitionKeys: string[];
    clusteringKeys: string[];
    regularColumns: string[];
  };
}

function FlatTableView({ rows, columns, metadata, keyInfo }: FlatTableViewProps) {
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
        No data
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-bg-tertiary sticky top-0">
        <tr>
          {columns.map((col) => {
            const isPartitionKey = keyInfo.partitionKeys.includes(col);
            const isClusteringKey = keyInfo.clusteringKeys.includes(col);

            return (
              <th
                key={col}
                className={cn(
                  "px-3 py-2 text-left text-xs font-medium whitespace-nowrap",
                  isPartitionKey && "text-yellow-500",
                  isClusteringKey && "text-blue-500",
                  !isPartitionKey && !isClusteringKey && "text-text-secondary"
                )}
              >
                {isPartitionKey && <Key className="w-3 h-3 inline mr-1" />}
                {isClusteringKey && <Layers className="w-3 h-3 inline mr-1" />}
                {col}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-bg-hover">
            {columns.map((col) => {
              const isPartitionKey = keyInfo.partitionKeys.includes(col);
              const isClusteringKey = keyInfo.clusteringKeys.includes(col);

              return (
                <td
                  key={col}
                  className={cn(
                    "px-3 py-2",
                    isPartitionKey && "bg-yellow-500/5",
                    isClusteringKey && "bg-blue-500/5"
                  )}
                >
                  <CassandraValueCell
                    value={row[col]}
                    columnName={col}
                    columnType={metadata.find((m) => m.name === col)?.type || "text"}
                    isCompact={true}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default CassandraPartitionView;
