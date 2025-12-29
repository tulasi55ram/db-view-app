import { useState, type FC } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { CodeMirrorSqlEditor } from "./CodeMirrorSqlEditor";
import { ExplainPlanPanel } from "./ExplainPlanPanel";
import { SqlReferencePanel } from "./SqlReferencePanel";
import { SavedQueriesPanel, type SavedQuery } from "./SavedQueriesPanel";
import { SaveQueryModal } from "./SaveQueryModal";
import type { QueryHistoryEntry, TableInfo, ColumnMetadata, ExplainPlan } from "@dbview/types";
import {
  Play,
  Terminal,
  Clock,
  AlertCircle,
  CheckCircle2,
  History,
  BookOpen,
  Activity,
  Wand2,
  Download,
  ChevronDown,
  Copy,
  Check,
  Save,
  Bookmark
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

export interface SqlRunnerViewProps {
  sql: string;
  onSqlChange: (value: string) => void;
  onRunQuery: () => void;
  onFormatSql?: () => void;
  onExplainQuery?: () => void;
  loading: boolean;
  error?: string;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  duration?: number;
  // Connection info
  connectionName?: string;
  // Autocomplete data
  schemas?: string[];
  tables?: TableInfo[];
  columnMetadata?: Record<string, ColumnMetadata[]>;
  // Explain plan
  explainPlan?: ExplainPlan | null;
  explainLoading?: boolean;
  explainError?: string;
  showExplainPanel?: boolean;
  onCloseExplainPanel?: () => void;
  // Query history props
  history: QueryHistoryEntry[];
  filteredHistory: QueryHistoryEntry[];
  favorites: QueryHistoryEntry[];
  searchTerm: string;
  showFavoritesOnly: boolean;
  onSearchChange: (term: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
  onClearNonFavorites: () => void;
  onToggleShowFavorites: () => void;
  // Saved queries props
  savedQueries?: SavedQuery[];
  onSaveQuery?: (name: string, description: string) => void;
  onDeleteSavedQuery?: (id: string) => void;
  onUpdateSavedQuery?: (id: string, updates: Partial<SavedQuery>) => void;
}

// Format execution time for display
function formatExecutionTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

// Export functions
function exportToCSV(columns: DataGridColumn[], rows: Record<string, unknown>[]) {
  const headers = columns.map(c => c.key).join(',');
  const csvRows = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  const csv = [headers, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `query_results_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToJSON(columns: DataGridColumn[], rows: Record<string, unknown>[]) {
  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `query_results_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboardAsTSV(columns: DataGridColumn[], rows: Record<string, unknown>[]): Promise<boolean> {
  const headers = columns.map(c => c.key).join('\t');
  const tsvRows = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }).join('\t')
  );
  const tsv = [headers, ...tsvRows].join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    return false;
  }
}

export const SqlRunnerView: FC<SqlRunnerViewProps> = ({
  sql,
  onSqlChange,
  onRunQuery,
  onFormatSql,
  onExplainQuery,
  loading,
  error,
  columns,
  rows,
  duration,
  connectionName,
  schemas = [],
  tables = [],
  columnMetadata = {},
  explainPlan,
  explainLoading = false,
  explainError,
  showExplainPanel = false,
  onCloseExplainPanel,
  history,
  filteredHistory,
  favorites,
  searchTerm,
  showFavoritesOnly,
  onSearchChange,
  onToggleFavorite,
  onDeleteEntry,
  onClearHistory,
  onClearNonFavorites,
  onToggleShowFavorites,
  savedQueries = [],
  onSaveQuery,
  onDeleteSavedQuery,
  onUpdateSavedQuery
}) => {
  const hasResults = columns.length > 0;
  const rowCount = rows.length;

  // Side panel state
  const [activePanel, setActivePanel] = useState<'history' | 'reference' | 'plan' | 'saved' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Toggle panel handler
  const togglePanel = (panel: 'history' | 'reference' | 'plan' | 'saved') => {
    if (activePanel === panel) {
      setActivePanel(null);
    } else {
      setActivePanel(panel);
      // If opening plan panel, also trigger explain query
      if (panel === 'plan' && onExplainQuery && sql.trim()) {
        onExplainQuery();
      }
    }
  };

  // Handle insert example from reference panel
  const handleInsertExample = (example: string) => {
    const currentSql = sql || "";
    const newSql = currentSql ? `${currentSql}\n\n${example}` : example;
    onSqlChange(newSql);
  };

  // Export handlers
  const handleExportCSV = () => {
    exportToCSV(columns, rows);
    toast.success("Exported to CSV");
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportToJSON(columns, rows);
    toast.success("Exported to JSON");
    setShowExportMenu(false);
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboardAsTSV(columns, rows);
    if (success) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy");
    }
    setShowExportMenu(false);
  };

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Toolbar - Compact, organized */}
      <header className="flex items-center justify-between border-b border-vscode-border bg-vscode-bg-light px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Left: Run, Format, Explain buttons */}
          <button
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              loading
                ? "bg-vscode-warning/20 text-vscode-warning"
                : "bg-vscode-accent text-white hover:bg-vscode-accent/80"
            )}
            onClick={onRunQuery}
            disabled={loading || !sql.trim()}
          >
            {loading ? (
              <>
                <Clock className="h-3.5 w-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run
              </>
            )}
          </button>

          {onFormatSql && (
            <button
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onFormatSql}
              disabled={loading || !sql.trim()}
              title="Format SQL"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Format
            </button>
          )}

          {onSaveQuery && (
            <button
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setShowSaveModal(true)}
              disabled={loading || !sql.trim()}
              title="Save Query"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          )}

          <div className="h-4 w-px bg-vscode-border mx-1" />

          {/* Connection info */}
          <div className="flex items-center gap-1.5 text-xs text-vscode-text-muted">
            <Terminal className="h-3.5 w-3.5" />
            {connectionName ? (
              <span>
                <span className="text-vscode-accent font-medium">{connectionName}</span>
              </span>
            ) : (
              'No connection'
            )}
          </div>

          <div className="h-4 w-px bg-vscode-border mx-1" />

          {/* Keyboard hint */}
          <div className="flex items-center gap-1.5 text-xs text-vscode-text-muted">
            <kbd className="rounded bg-vscode-bg-lighter px-1.5 py-0.5 text-2xs">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
            </kbd>
            <span>to run</span>
          </div>
        </div>

        {/* Right: Panel toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePanel('plan')}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              activePanel === 'plan' || showExplainPanel
                ? "bg-vscode-accent/20 text-vscode-accent"
                : "bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text"
            )}
            title="Query Plan"
          >
            <Activity className="h-3.5 w-3.5" />
            Plan
          </button>

          <button
            onClick={() => togglePanel('history')}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              activePanel === 'history'
                ? "bg-vscode-accent/20 text-vscode-accent"
                : "bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text"
            )}
            title="Query History"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>

          <button
            onClick={() => togglePanel('reference')}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              activePanel === 'reference'
                ? "bg-vscode-accent/20 text-vscode-accent"
                : "bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text"
            )}
            title="SQL Reference"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Reference
          </button>

          {onSaveQuery && (
            <button
              onClick={() => togglePanel('saved')}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                activePanel === 'saved'
                  ? "bg-vscode-accent/20 text-vscode-accent"
                  : "bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text"
              )}
              title="Saved Queries"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Saved
            </button>
          )}
        </div>
      </header>

      {/* Main content with resizable panels */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          {/* SQL Editor Panel */}
          <Panel defaultSize={30} minSize={15} maxSize={60}>
            <div className="h-full p-3 bg-vscode-bg-light/50">
              <CodeMirrorSqlEditor
                value={sql}
                onChange={onSqlChange}
                onRunQuery={onRunQuery}
                height="100%"
                loading={loading}
                error={error}
                schemas={schemas}
                tables={tables}
                columns={columnMetadata}
              />
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="h-1 bg-vscode-border hover:bg-vscode-accent transition-colors cursor-row-resize" />

          {/* Results Panel */}
          <Panel defaultSize={70} minSize={30}>
            <div className="h-full flex flex-col overflow-hidden">
              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-vscode-error/10 border-b border-vscode-error/30 text-vscode-error text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              {/* Results area with optional side panel */}
              <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal">
                  {/* Results Grid */}
                  <Panel defaultSize={activePanel ? 65 : 100} minSize={40}>
                    <div className="h-full flex flex-col">
                      {hasResults ? (
                        <>
                          {/* Results status bar */}
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-vscode-border bg-vscode-bg-light text-xs">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-vscode-success">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"}
                              </span>
                              {duration !== undefined && (
                                <span className="flex items-center gap-1 text-vscode-text-muted">
                                  <Clock className="h-3 w-3" />
                                  {formatExecutionTime(duration)}
                                </span>
                              )}
                            </div>

                            {/* Export dropdown */}
                            <div className="relative">
                              <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Export</span>
                                <ChevronDown className="h-3 w-3" />
                              </button>

                              {showExportMenu && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-vscode-bg-light border border-vscode-border rounded-lg shadow-lg z-50 py-1">
                                  <button
                                    onClick={handleExportCSV}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-vscode-bg-hover flex items-center gap-2 text-vscode-text"
                                  >
                                    <Download className="h-3.5 w-3.5 text-vscode-text-muted" />
                                    Export as CSV
                                  </button>
                                  <button
                                    onClick={handleExportJSON}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-vscode-bg-hover flex items-center gap-2 text-vscode-text"
                                  >
                                    <Download className="h-3.5 w-3.5 text-vscode-text-muted" />
                                    Export as JSON
                                  </button>
                                  <div className="border-t border-vscode-border my-1" />
                                  <button
                                    onClick={handleCopyToClipboard}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-vscode-bg-hover flex items-center gap-2 text-vscode-text"
                                  >
                                    {copied ? (
                                      <Check className="h-3.5 w-3.5 text-vscode-success" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-vscode-text-muted" />
                                    )}
                                    Copy to Clipboard
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Data grid */}
                          <div className="flex-1 overflow-auto">
                            <DataGrid
                              columns={columns}
                              rows={rows}
                              loading={loading}
                              showRowNumbers={true}
                              emptyMessage="Query returned no results"
                            />
                          </div>
                        </>
                      ) : (
                        <EmptyResults loading={loading} />
                      )}
                    </div>
                  </Panel>

                  {/* Side Panel */}
                  {activePanel && (
                    <>
                      <PanelResizeHandle className="w-1 bg-vscode-border hover:bg-vscode-accent transition-colors cursor-col-resize" />
                      <Panel defaultSize={35} minSize={20} maxSize={50}>
                        <div className="h-full border-l border-vscode-border">
                          {activePanel === 'history' && (
                            <QueryHistorySidePanel
                              history={history}
                              filteredHistory={filteredHistory}
                              favorites={favorites}
                              searchTerm={searchTerm}
                              showFavoritesOnly={showFavoritesOnly}
                              onSearchChange={onSearchChange}
                              onToggleFavorite={onToggleFavorite}
                              onDeleteEntry={onDeleteEntry}
                              onClearHistory={onClearHistory}
                              onClearNonFavorites={onClearNonFavorites}
                              onToggleShowFavorites={onToggleShowFavorites}
                              onRunQuery={(sql) => {
                                onSqlChange(sql);
                                setTimeout(() => onRunQuery(), 50);
                              }}
                              onCopyQuery={(sql) => {
                                navigator.clipboard.writeText(sql);
                                toast.success("Query copied to clipboard");
                              }}
                            />
                          )}
                          {activePanel === 'reference' && (
                            <SqlReferencePanel onSelectExample={handleInsertExample} />
                          )}
                          {activePanel === 'saved' && onDeleteSavedQuery && onUpdateSavedQuery && (
                            <SavedQueriesPanel
                              queries={savedQueries}
                              onSelectQuery={(sql) => {
                                onSqlChange(sql);
                                toast.success("Query loaded");
                              }}
                              onDeleteQuery={onDeleteSavedQuery}
                              onUpdateQuery={onUpdateSavedQuery}
                            />
                          )}
                          {activePanel === 'plan' && (
                            <ExplainPlanPanel
                              isOpen={true}
                              onClose={() => setActivePanel(null)}
                              plan={explainPlan || null}
                              loading={explainLoading}
                              error={explainError}
                            />
                          )}
                        </div>
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between border-t border-vscode-border bg-vscode-bg-light px-4 py-1 text-xs text-vscode-text-muted">
        <div className="flex items-center gap-4">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-vscode-warning" />
              Executing query...
            </span>
          ) : hasResults ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-success" />
              Query completed
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-text-muted" />
              Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>SQL</span>
        </div>
      </footer>

      {/* Save Query Modal */}
      {onSaveQuery && (
        <SaveQueryModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={(name, description) => {
            onSaveQuery(name, description);
            toast.success("Query saved");
          }}
          sql={sql}
        />
      )}
    </div>
  );
};

// Empty state when no results yet
const EmptyResults: FC<{ loading: boolean }> = ({ loading }) => {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Clock className="h-8 w-8 animate-spin text-vscode-accent" />
          <p className="text-sm text-vscode-text-muted">Executing query...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vscode-bg-light">
          <Terminal className="h-6 w-6 text-vscode-text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-vscode-text">No results yet</p>
          <p className="text-xs text-vscode-text-muted">
            Write a SQL query and press Run to see results
          </p>
        </div>
      </div>
    </div>
  );
};

// Query History Side Panel (simplified version for side panel)
interface QueryHistorySidePanelProps {
  history: QueryHistoryEntry[];
  filteredHistory: QueryHistoryEntry[];
  favorites: QueryHistoryEntry[];
  searchTerm: string;
  showFavoritesOnly: boolean;
  onSearchChange: (term: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
  onClearNonFavorites: () => void;
  onToggleShowFavorites: () => void;
  onRunQuery: (sql: string) => void;
  onCopyQuery: (sql: string) => void;
}

const QueryHistorySidePanel: FC<QueryHistorySidePanelProps> = ({
  filteredHistory,
  searchTerm,
  showFavoritesOnly,
  onSearchChange,
  onToggleFavorite,
  onDeleteEntry,
  onClearHistory,
  onToggleShowFavorites,
  onRunQuery,
  onCopyQuery
}) => {
  return (
    <div className="h-full flex flex-col bg-vscode-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-vscode-text-muted" />
          <span className="text-sm font-medium text-vscode-text">History</span>
          <span className="text-xs text-vscode-text-muted">({filteredHistory.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleShowFavorites}
            className={clsx(
              "p-1 rounded text-xs",
              showFavoritesOnly ? "text-vscode-warning" : "text-vscode-text-muted hover:text-vscode-text"
            )}
            title={showFavoritesOnly ? "Show all" : "Show favorites only"}
          >
            ★
          </button>
          <button
            onClick={onClearHistory}
            className="p-1 rounded text-xs text-vscode-text-muted hover:text-vscode-error"
            title="Clear history"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-vscode-border">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search queries..."
          className="w-full px-2 py-1.5 text-xs rounded bg-vscode-bg-lighter border border-vscode-border text-vscode-text placeholder-vscode-text-muted focus:outline-none focus:border-vscode-accent"
        />
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted text-xs p-4">
            <History className="h-8 w-8 mb-2 opacity-30" />
            <p>No queries in history</p>
          </div>
        ) : (
          <div className="divide-y divide-vscode-border">
            {filteredHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-2 hover:bg-vscode-bg-hover group"
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="text-xs text-vscode-text font-mono line-clamp-2 flex-1">
                    {entry.sql}
                  </code>
                  <button
                    onClick={() => onToggleFavorite(entry.id)}
                    className={clsx(
                      "text-xs flex-shrink-0",
                      entry.isFavorite ? "text-vscode-warning" : "text-vscode-text-muted opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {entry.isFavorite ? "★" : "☆"}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2 text-2xs text-vscode-text-muted">
                    <span className={entry.success ? "text-vscode-success" : "text-vscode-error"}>
                      {entry.success ? "✓" : "✗"}
                    </span>
                    {entry.duration && <span>{entry.duration}ms</span>}
                    {entry.rowCount !== undefined && <span>{entry.rowCount} rows</span>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => onRunQuery(entry.sql)}
                      className="px-1.5 py-0.5 text-2xs rounded bg-vscode-accent/20 text-vscode-accent hover:bg-vscode-accent/30"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => onCopyQuery(entry.sql)}
                      className="px-1.5 py-0.5 text-2xs rounded text-vscode-text-muted hover:bg-vscode-bg-lighter"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => onDeleteEntry(entry.id)}
                      className="px-1.5 py-0.5 text-2xs rounded text-vscode-error/70 hover:text-vscode-error hover:bg-vscode-bg-lighter"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
