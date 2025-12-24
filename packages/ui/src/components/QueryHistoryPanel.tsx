import { type FC, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { QueryHistoryEntry } from "@dbview/core";
import {
  History,
  Star,
  StarOff,
  Search,
  Trash2,
  Play,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  MoreVertical,
  X
} from "lucide-react";
import clsx from "clsx";

export interface QueryHistoryPanelProps {
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
  onRunQuery: (sql: string) => void;
  onCopyQuery: (sql: string) => void;
  onToggleShowFavorites: () => void;
}

export const QueryHistoryPanel: FC<QueryHistoryPanelProps> = ({
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
  onRunQuery,
  onCopyQuery,
  onToggleShowFavorites
}) => {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const truncateSQL = (sql: string, maxLength = 60) => {
    const singleLine = sql.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= maxLength) return singleLine;
    return singleLine.substring(0, maxLength) + '...';
  };

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              history.length > 0
                ? "text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text"
                : "text-vscode-text-muted/50 hover:bg-vscode-bg-hover"
            )}
            title="Query History"
          >
            <History className="h-4 w-4" />
            <span>History</span>
            {history.length > 0 && (
              <span className="ml-0.5 rounded-full bg-vscode-accent/30 px-1.5 py-0.5 text-xs">
                {history.length}
              </span>
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 w-[500px] max-h-[600px] overflow-hidden rounded-md border border-vscode-border bg-vscode-bg-light shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            sideOffset={5}
            align="end"
          >
            {/* Header */}
            <div className="border-b border-vscode-border px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-vscode-text">Query History</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleShowFavorites}
                    className={clsx(
                      "rounded p-1 transition-colors",
                      showFavoritesOnly
                        ? "bg-vscode-accent/20 text-vscode-accent"
                        : "text-vscode-text-muted hover:bg-vscode-bg-hover"
                    )}
                    title={showFavoritesOnly ? "Show all" : "Show favorites only"}
                  >
                    <Filter className="h-4 w-4" />
                  </button>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="rounded p-1 hover:bg-vscode-bg-hover text-vscode-text-muted transition-colors"
                        title="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-50 min-w-[180px] rounded-md border border-vscode-border bg-vscode-bg-light shadow-lg"
                        sideOffset={5}
                        align="end"
                      >
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-3 py-2 text-xs text-vscode-text hover:bg-vscode-bg-hover cursor-pointer outline-none"
                          onClick={onClearNonFavorites}
                          disabled={history.length === favorites.length}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear non-favorites
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="h-px bg-vscode-border" />
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer outline-none"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear all history
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vscode-text-muted" />
                <input
                  type="text"
                  placeholder="Search queries..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent text-vscode-text placeholder:text-vscode-text-muted"
                />
                {searchTerm && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-vscode-text-muted hover:text-vscode-text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* History list */}
            <div className="max-h-[480px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-vscode-text-muted/30 mb-3" />
                  <p className="text-sm text-vscode-text-muted">
                    {searchTerm
                      ? 'No queries match your search'
                      : showFavoritesOnly
                      ? 'No favorite queries yet'
                      : 'No query history yet'}
                  </p>
                  <p className="text-xs text-vscode-text-muted mt-1">
                    {!showFavoritesOnly && !searchTerm && 'Run a query to start building your history'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-vscode-border">
                  {filteredHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="group px-3 py-2 hover:bg-vscode-bg-hover transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {entry.success ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <code className="text-xs text-vscode-text font-mono break-all flex-1">
                            {truncateSQL(entry.sql)}
                          </code>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => onToggleFavorite(entry.id)}
                            className={clsx(
                              "rounded p-1 transition-colors",
                              entry.isFavorite
                                ? "text-yellow-500 hover:bg-yellow-500/10"
                                : "text-vscode-text-muted hover:bg-vscode-bg-hover"
                            )}
                            title={entry.isFavorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            {entry.isFavorite ? (
                              <Star className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <StarOff className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onRunQuery(entry.sql);
                              setOpen(false);
                            }}
                            className="rounded p-1 text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-accent transition-colors"
                            title="Run query"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onCopyQuery(entry.sql)}
                            className="rounded p-1 text-vscode-text-muted hover:bg-vscode-bg-hover transition-colors"
                            title="Copy query"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteEntry(entry.id)}
                            className="rounded p-1 text-vscode-text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 ml-5 text-xs text-vscode-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.executedAt)}
                        </span>
                        {entry.duration !== undefined && (
                          <span>{formatDuration(entry.duration)}</span>
                        )}
                        {entry.rowCount !== undefined && (
                          <span>{entry.rowCount} {entry.rowCount === 1 ? 'row' : 'rows'}</span>
                        )}
                        {entry.error && (
                          <span className="text-red-500 truncate max-w-[200px]" title={entry.error}>
                            Error: {entry.error}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer stats */}
            {history.length > 0 && (
              <div className="border-t border-vscode-border px-3 py-2 bg-vscode-bg">
                <div className="flex items-center justify-between text-xs text-vscode-text-muted">
                  <span>
                    {filteredHistory.length} of {history.length} {history.length === 1 ? 'query' : 'queries'}
                  </span>
                  {favorites.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-vscode-border bg-vscode-bg-light p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <AlertDialog.Title className="text-lg font-semibold text-vscode-text mb-2">
              Clear Query History
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-vscode-text-muted mb-6">
              Are you sure you want to delete all query history? This will remove {history.length} {history.length === 1 ? 'query' : 'queries'} including {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}.
              <br />
              <br />
              <strong className="text-vscode-text">This action cannot be undone.</strong>
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-sm font-medium text-vscode-text hover:bg-vscode-bg-hover rounded transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => {
                    onClearHistory();
                    setDeleteDialogOpen(false);
                    setOpen(false);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-red-500 text-white hover:bg-red-600 rounded transition-colors"
                >
                  Clear All
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};
