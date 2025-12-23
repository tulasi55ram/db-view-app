import type { FC } from "react";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { CodeMirrorSqlEditor } from "./CodeMirrorSqlEditor";
import { ExplainPlanPanel } from "./ExplainPlanPanel";
import type { QueryHistoryEntry, TableInfo, ColumnMetadata, ExplainPlan } from "@dbview/core";
import {
  Play,
  Terminal,
  Clock,
  AlertCircle,
  CheckCircle2,
  Copy,
  Trash2,
  FileCode,
  Zap
} from "lucide-react";
import clsx from "clsx";

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
  onToggleShowFavorites
}) => {
  const hasResults = columns.length > 0;
  const rowCount = rows.length;

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-vscode-border bg-vscode-bg-light px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-vscode-bg-lighter">
            <Terminal className="h-4 w-4 text-vscode-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-vscode-text-bright">SQL Runner</h1>
            <p className="text-xs text-vscode-text-muted">
              {connectionName ? (
                <span>Connected to <span className="text-vscode-accent font-medium">{connectionName}</span></span>
              ) : (
                'Execute ad-hoc queries'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <QueryHistoryPanel
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
            onRunQuery={(sql) => {
              onSqlChange(sql);
              // Trigger query execution after a brief delay to ensure state updates
              setTimeout(() => onRunQuery(), 50);
            }}
            onCopyQuery={(sql) => {
              navigator.clipboard.writeText(sql);
            }}
            onToggleShowFavorites={onToggleShowFavorites}
          />
          <div className="flex items-center gap-2">
            <kbd className="rounded bg-vscode-bg-lighter px-1.5 py-0.5 text-2xs text-vscode-text-muted">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + Enter
            </kbd>
            <span className="text-xs text-vscode-text-muted">to run</span>
          </div>
        </div>
      </header>

      {/* SQL Editor Section */}
      <section className="flex flex-col gap-3 border-b border-vscode-border bg-vscode-bg-light/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-vscode-text-muted">
            SQL Query
          </label>
          <div className="flex items-center gap-1">
            {onExplainQuery && (
              <button
                className="btn-ghost rounded p-1 text-vscode-text-muted hover:text-vscode-warning"
                title="Explain Query"
                onClick={onExplainQuery}
                disabled={loading || !sql.trim()}
              >
                <Zap className="h-3.5 w-3.5" />
              </button>
            )}
            {onFormatSql && (
              <button
                className="btn-ghost rounded p-1 text-vscode-text-muted hover:text-vscode-text"
                title="Format SQL (⇧⌘F)"
                onClick={onFormatSql}
                disabled={loading || !sql.trim()}
              >
                <FileCode className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              className="btn-ghost rounded p-1 text-vscode-text-muted hover:text-vscode-text"
              title="Copy SQL"
              onClick={() => navigator.clipboard.writeText(sql)}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              className="btn-ghost rounded p-1 text-vscode-text-muted hover:text-vscode-error"
              title="Clear"
              onClick={() => onSqlChange("")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <CodeMirrorSqlEditor
          value={sql}
          onChange={onSqlChange}
          onRunQuery={onRunQuery}
          height="144px"
          loading={loading}
          error={error}
          schemas={schemas}
          tables={tables}
          columns={columnMetadata}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className={clsx(
                "inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-all",
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
                  <Clock className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Query
                </>
              )}
            </button>

            {error && (
              <div className="flex items-center gap-1.5 text-sm text-vscode-error">
                <AlertCircle className="h-4 w-4" />
                <span className="max-w-md truncate">{error}</span>
              </div>
            )}

            {!error && hasResults && !loading && (
              <div className="flex items-center gap-1.5 text-sm text-vscode-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>Query executed successfully</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <main className="flex-1 overflow-auto p-3">
        {hasResults ? (
          <DataGrid
            columns={columns}
            rows={rows}
            loading={loading}
            showRowNumbers={true}
            emptyMessage="Query returned no results"
          />
        ) : (
          <EmptyResults loading={loading} />
        )}
      </main>

      {/* Status Bar */}
      <footer className="flex items-center justify-between border-t border-vscode-border bg-vscode-bg-light px-4 py-1.5 text-xs text-vscode-text-muted">
        <div className="flex items-center gap-4">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-vscode-warning" />
              Executing query...
            </span>
          ) : hasResults ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-success" />
              {rowCount} {rowCount === 1 ? "row" : "rows"} returned
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-text-muted" />
              Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>PostgreSQL</span>
        </div>
      </footer>

      {/* Explain Plan Panel */}
      {onCloseExplainPanel && (
        <ExplainPlanPanel
          isOpen={showExplainPanel}
          onClose={onCloseExplainPanel}
          plan={explainPlan || null}
          loading={explainLoading}
          error={explainError}
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
            Write a SQL query and press Run Query to see results
          </p>
        </div>
      </div>
    </div>
  );
};
