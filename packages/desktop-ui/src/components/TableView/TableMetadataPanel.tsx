import { useState, useEffect } from "react";
import { X, Database, Key, Hash, FileText, BarChart3 } from "lucide-react";
import { getElectronAPI } from "@/electron";
import type { ColumnMetadata, TableIndex, TableStatistics } from "@dbview/types";
import { SidePanel } from "../panels/SidePanel";

interface TableMetadataPanelProps {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
  open: boolean;
  onClose: () => void;
  variant?: "inline" | "overlay";
}

export function TableMetadataPanel({ connectionKey, schema, table, database, open, onClose, variant = "inline" }: TableMetadataPanelProps) {
  const [metadata, setMetadata] = useState<ColumnMetadata[]>([]);
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [statistics, setStatistics] = useState<TableStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  const api = getElectronAPI();

  useEffect(() => {
    if (!open || !api) return;

    const loadMetadata = async () => {
      setLoading(true);
      try {
        const [metadataResult, indexesResult, statsResult] = await Promise.all([
          api.getTableMetadata({ connectionKey, schema, table, database }),
          api.getTableIndexes({ connectionKey, schema, table, database }),
          api.getTableStatistics({ connectionKey, schema, table, database }),
        ]);

        setMetadata(metadataResult);
        setIndexes(indexesResult);
        setStatistics(statsResult);
      } catch (error) {
        console.error("Failed to load metadata:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, [open, api, connectionKey, schema, table, database]);

  if (!open) return null;

  // Content component
  const content = loading ? (
    <div className="flex items-center justify-center h-full text-text-secondary">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span>Loading metadata...</span>
      </div>
    </div>
  ) : (
    <div className="p-4 space-y-6">
      {/* Statistics */}
      {statistics && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Statistics
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-bg-secondary rounded border border-border">
              <div className="text-xs text-text-tertiary mb-1">Rows</div>
              <div className="text-lg font-semibold text-text-primary">
                {statistics.rowCount?.toLocaleString() || "N/A"}
              </div>
            </div>
            <div className="p-3 bg-bg-secondary rounded border border-border">
              <div className="text-xs text-text-tertiary mb-1">Size</div>
              <div className="text-lg font-semibold text-text-primary">
                {statistics.totalSize || "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Columns */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Columns ({metadata.length})
        </h4>
        <div className="space-y-2">
          {metadata.map((col) => (
            <div
              key={col.name}
              className="p-3 bg-bg-secondary rounded border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{col.name}</span>
                  {col.isPrimaryKey && (
                    <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-xs rounded font-medium">
                      PK
                    </span>
                  )}
                  {col.isForeignKey && (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-500 text-xs rounded font-medium">
                      FK
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-tertiary font-mono">{col.type}</span>
              </div>
              <div className="text-xs text-text-secondary space-y-1">
                <div className="flex gap-2">
                  <span className={col.nullable ? "text-text-tertiary" : "text-text-primary"}>
                    {col.nullable ? "Nullable" : "Not Null"}
                  </span>
                  {col.defaultValue && (
                    <span className="text-text-tertiary">• Default: {col.defaultValue}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indexes */}
      {indexes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" />
            Indexes ({indexes.length})
          </h4>
          <div className="space-y-2">
            {indexes.map((idx) => (
              <div
                key={idx.name}
                className="p-3 bg-bg-secondary rounded border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{idx.name}</span>
                    {idx.isPrimary && (
                      <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-xs rounded font-medium">
                        PRIMARY
                      </span>
                    )}
                    {idx.isUnique && !idx.isPrimary && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-500 text-xs rounded font-medium">
                        UNIQUE
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-text-secondary">
                  Columns: {Array.isArray(idx.columns) ? idx.columns.join(", ") : idx.columns}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Keys */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Hash className="w-4 h-4" />
          Primary Keys
        </h4>
        <div className="p-3 bg-bg-secondary rounded border border-border">
          {metadata.filter((col) => col.isPrimaryKey).length > 0 ? (
            <div className="text-sm text-text-primary">
              {metadata
                .filter((col) => col.isPrimaryKey)
                .map((col) => col.name)
                .join(", ")}
            </div>
          ) : (
            <div className="text-sm text-text-tertiary italic">No primary key defined</div>
          )}
        </div>
      </div>
    </div>
  );

  // Inline mode - use SidePanel wrapper
  if (variant === "inline") {
    return (
      <SidePanel
        title={`Table Metadata: ${schema}.${table}`}
        icon={<Database className="w-4 h-4" />}
        onClose={onClose}
      >
        {content}
      </SidePanel>
    );
  }

  // Overlay mode - original fixed positioning with backdrop
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50">
      <div className="bg-bg-primary border-l border-border shadow-xl w-full max-w-2xl h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Database className="w-5 h-5" />
            Table Metadata: {schema}.{table}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    </div>
  );
}
