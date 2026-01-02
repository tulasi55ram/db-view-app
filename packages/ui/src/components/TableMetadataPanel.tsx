import { type FC } from "react";
import type { ColumnMetadata, TableIndex, TableStatistics } from "@dbview/types";
import {
  X,
  Database,
  Hash,
  Key,
  Link2,
  List,
  BarChart3,
  Calendar,
  HardDrive,
  ChevronRight,
  CheckCircle2,
  XCircle
} from "lucide-react";
import clsx from "clsx";
import { MetadataSkeleton } from "./Skeleton";
import { SidePanel } from "./panels/SidePanel";

export interface TableMetadataPanelProps {
  schema: string;
  table: string;
  columns?: ColumnMetadata[];
  indexes?: TableIndex[];
  statistics?: TableStatistics;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  variant?: "inline" | "overlay";
}

export const TableMetadataPanel: FC<TableMetadataPanelProps> = ({
  schema,
  table,
  columns = [],
  indexes = [],
  statistics,
  isOpen,
  onClose,
  loading = false,
  variant = "inline",
}) => {
  console.log('[TableMetadataPanel] ========== RENDER ==========');
  console.log('[TableMetadataPanel] isOpen:', isOpen);
  console.log('[TableMetadataPanel] loading:', loading);
  console.log('[TableMetadataPanel] schema:', schema);
  console.log('[TableMetadataPanel] table:', table);
  console.log('[TableMetadataPanel] columns:', columns?.length || 0, 'columns');
  console.log('[TableMetadataPanel] indexes:', indexes?.length || 0, 'indexes');
  console.log('[TableMetadataPanel] statistics:', statistics);

  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const primaryKeyColumns = columns.filter(col => col.isPrimaryKey);
  const foreignKeyColumns = columns.filter(col => col.isForeignKey);

  console.log('[TableMetadataPanel] primaryKeyColumns:', primaryKeyColumns.length);
  console.log('[TableMetadataPanel] foreignKeyColumns:', foreignKeyColumns.length);

  if (!isOpen) return null;

  // Content component (shared between modes)
  const content = (
    <>
      {loading ? (
        <MetadataSkeleton />
      ) : (
        <div className="space-y-6 p-4">
              {/* Statistics */}
              {statistics && (
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-vscode-text mb-3">
                    <BarChart3 className="h-4 w-4 text-vscode-accent" />
                    Statistics
                  </h3>
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-vscode-text-muted">Rows:</span>
                      <span className="text-vscode-text font-mono">{statistics.rowCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-vscode-text-muted">Total Size:</span>
                      <span className="text-vscode-text font-mono">{statistics.totalSize}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-vscode-text-muted">Table Size:</span>
                      <span className="text-vscode-text font-mono">{statistics.tableSize}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-vscode-text-muted">Indexes Size:</span>
                      <span className="text-vscode-text font-mono">{statistics.indexesSize}</span>
                    </div>
                    {(statistics.lastVacuum || statistics.lastAutoVacuum || statistics.lastAnalyze || statistics.lastAutoAnalyze) && (
                      <>
                        <div className="h-px bg-vscode-border my-2" />
                        {statistics.lastVacuum && (
                          <div className="flex items-start justify-between text-xs gap-2">
                            <span className="text-vscode-text-muted flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Last Vacuum:
                            </span>
                            <span className="text-vscode-text text-right">{formatDate(statistics.lastVacuum)}</span>
                          </div>
                        )}
                        {statistics.lastAnalyze && (
                          <div className="flex items-start justify-between text-xs gap-2">
                            <span className="text-vscode-text-muted flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Last Analyze:
                            </span>
                            <span className="text-vscode-text text-right">{formatDate(statistics.lastAnalyze)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* Primary Key */}
              {primaryKeyColumns.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-vscode-text mb-3">
                    <Key className="h-4 w-4 text-yellow-500" />
                    Primary Key
                  </h3>
                  <div className="space-y-1 pl-6">
                    {primaryKeyColumns.map(col => (
                      <div key={col.name} className="flex items-center gap-2 text-xs">
                        <ChevronRight className="h-3 w-3 text-vscode-text-muted" />
                        <code className="font-mono text-vscode-text">{col.name}</code>
                        <span className="text-vscode-text-muted">({col.type})</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Foreign Keys */}
              {foreignKeyColumns.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-vscode-text mb-3">
                    <Link2 className="h-4 w-4 text-blue-500" />
                    Foreign Keys
                  </h3>
                  <div className="space-y-2 pl-6">
                    {foreignKeyColumns.map(col => (
                      <div key={col.name} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <ChevronRight className="h-3 w-3 text-vscode-text-muted" />
                          <code className="font-mono text-vscode-text">{col.name}</code>
                        </div>
                        {col.foreignKeyRef && (
                          <div className="pl-5 text-xs text-vscode-text-muted">
                            → {col.foreignKeyRef}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Indexes */}
              {indexes.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-vscode-text mb-3">
                    <List className="h-4 w-4 text-green-500" />
                    Indexes ({indexes.length})
                  </h3>
                  <div className="space-y-3 pl-6">
                    {indexes.map(index => (
                      <div key={index.name} className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <ChevronRight className="h-3 w-3 text-vscode-text-muted" />
                          <code className="font-mono text-vscode-text">{index.name}</code>
                          {index.isPrimary && (
                            <span className="px-1.5 py-0.5 text-2xs rounded bg-yellow-500/20 text-yellow-500 uppercase">
                              Primary
                            </span>
                          )}
                          {index.isUnique && !index.isPrimary && (
                            <span className="px-1.5 py-0.5 text-2xs rounded bg-blue-500/20 text-blue-500 uppercase">
                              Unique
                            </span>
                          )}
                        </div>
                        <div className="pl-5 space-y-0.5">
                          <div className="text-xs text-vscode-text-muted">
                            Type: <span className="text-vscode-text font-mono">{index.type}</span>
                          </div>
                          <div className="text-xs text-vscode-text-muted">
                            Columns: <span className="text-vscode-text font-mono">{Array.isArray(index.columns) ? index.columns.join(', ') : index.columns}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Columns */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-vscode-text mb-3">
                  <Hash className="h-4 w-4 text-vscode-accent" />
                  Columns ({columns.length})
                </h3>
                <div className="space-y-2 pl-6">
                  {columns.length === 0 ? (
                    <div className="text-xs text-vscode-text-muted italic py-2">
                      No column metadata available. Close and reopen the panel to reload.
                    </div>
                  ) : (
                    columns.map(col => (
                    <div key={col.name} className="space-y-1 pb-2 border-b border-vscode-border last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 text-xs">
                        <code className="font-mono text-vscode-text font-semibold">{col.name}</code>
                        {col.isPrimaryKey && (
                          <Key className="h-3 w-3 text-yellow-500" title="Primary Key" />
                        )}
                        {col.isForeignKey && (
                          <Link2 className="h-3 w-3 text-blue-500" title="Foreign Key" />
                        )}
                      </div>
                      <div className="pl-0 space-y-0.5">
                        <div className="flex items-center gap-2 text-xs text-vscode-text-muted">
                          <HardDrive className="h-3 w-3" />
                          <span className="font-mono text-vscode-text">{col.type.toUpperCase()}</span>
                          {col.maxLength && (
                            <span className="text-vscode-text">({col.maxLength})</span>
                          )}
                          {col.numericPrecision && (
                            <span className="text-vscode-text">({col.numericPrecision}, {col.numericScale})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {col.nullable ? (
                            <span className="flex items-center gap-1 text-vscode-text-muted">
                              <XCircle className="h-3 w-3" />
                              Nullable
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-vscode-accent">
                              <CheckCircle2 className="h-3 w-3" />
                              NOT NULL
                            </span>
                          )}
                          {col.isAutoIncrement && (
                            <span className="px-1.5 py-0.5 text-2xs rounded bg-vscode-accent/20 text-vscode-accent uppercase">
                              Auto
                            </span>
                          )}
                          {col.isGenerated && (
                            <span className="px-1.5 py-0.5 text-2xs rounded bg-purple-500/20 text-purple-500 uppercase">
                              Generated
                            </span>
                          )}
                        </div>
                        {col.defaultValue && (
                          <div className="text-xs text-vscode-text-muted">
                            Default: <code className="text-vscode-text font-mono">{col.defaultValue}</code>
                          </div>
                        )}
                        {col.enumValues && col.enumValues.length > 0 && (
                          <div className="text-xs text-vscode-text-muted">
                            Values: <code className="text-vscode-text font-mono">{col.enumValues.join(', ')}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  )))}
                </div>
              </section>
            </div>
          )}
    </>
  );

  // Inline mode - use SidePanel wrapper
  if (variant === "inline") {
    return (
      <SidePanel
        title={`Table Metadata: ${schema}.${table}`}
        icon={<Database className="h-4 w-4" />}
        onClose={onClose}
      >
        {content}
      </SidePanel>
    );
  }

  // Overlay mode - original fixed positioning with backdrop
  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Side panel */}
      <div className="absolute top-0 right-0 bottom-0 w-[480px] bg-vscode-bg border-l border-vscode-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-vscode-border px-4 py-3 bg-vscode-bg">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="h-4 w-4 text-vscode-accent flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-vscode-text truncate">
                {table}
              </h2>
              <p className="text-xs text-vscode-text-muted truncate">
                {schema}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    </>
  );
};
