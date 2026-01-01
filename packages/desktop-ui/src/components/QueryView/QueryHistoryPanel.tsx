import { type FC, useState, useMemo } from "react";
import { Clock, Play, Trash2, Star } from "lucide-react";
import { cn } from "@/utils/cn";
import type { QueryHistoryEntry } from "@dbview/types";

export interface QueryHistoryPanelProps {
  history: QueryHistoryEntry[];
  onSelectQuery?: (sql: string) => void;
  onClearHistory?: () => void;
  onToggleFavorite?: (id: string) => void;
}

export const QueryHistoryPanel: FC<QueryHistoryPanelProps> = ({ history, onSelectQuery, onClearHistory, onToggleFavorite }) => {
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Filter and sort history - favorites first, then by time
  const sortedHistory = useMemo(() => {
    let filtered = [...history];
    if (showFavoritesOnly) {
      filtered = filtered.filter((entry) => entry.isFavorite);
    }
    // Sort: favorites first, then by executedAt (newest first)
    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.executedAt - a.executedAt;
    });
  }, [history, showFavoritesOnly]);

  const favoritesCount = history.filter((entry) => entry.isFavorite).length;

  return (
    <div className="h-full border-l border-border bg-bg-secondary flex flex-col">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">Query History</span>
          {history.length > 0 && (
            <span className="text-xs text-text-tertiary">({history.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {favoritesCount > 0 && (
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={cn(
                "p-1.5 rounded transition-colors",
                showFavoritesOnly
                  ? "bg-yellow-500/20 text-yellow-500"
                  : "hover:bg-bg-hover text-text-tertiary hover:text-yellow-500"
              )}
              title={showFavoritesOnly ? "Show all" : `Show favorites (${favoritesCount})`}
            >
              <Star className={cn("w-3.5 h-3.5", showFavoritesOnly && "fill-current")} />
            </button>
          )}
          {history.length > 0 && onClearHistory && (
            <button
              onClick={onClearHistory}
              className="p-1.5 rounded hover:bg-bg-hover transition-colors text-text-tertiary hover:text-error"
              title="Clear history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto p-2">
        {sortedHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm">
            {showFavoritesOnly ? (
              <>
                <Star className="w-8 h-8 mb-2 opacity-30" />
                <p>No favorite queries</p>
                <button
                  onClick={() => setShowFavoritesOnly(false)}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Show all queries
                </button>
              </>
            ) : (
              <>
                <Clock className="w-8 h-8 mb-2 opacity-30" />
                <p>No query history yet</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedHistory.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors cursor-pointer group relative",
                  entry.isFavorite && "ring-1 ring-yellow-500/30",
                  entry.success
                    ? "border-border bg-bg-primary hover:bg-bg-hover"
                    : "border-error/30 bg-error/5 hover:bg-error/10"
                )}
                onClick={() => onSelectQuery?.(entry.sql)}
              >
                {/* Favorite button - top right */}
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(entry.id);
                    }}
                    className={cn(
                      "absolute top-2 right-2 p-1 rounded transition-all",
                      entry.isFavorite
                        ? "text-yellow-500 hover:text-yellow-600"
                        : "text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-yellow-500"
                    )}
                    title={entry.isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={cn("w-3.5 h-3.5", entry.isFavorite && "fill-current")} />
                  </button>
                )}

                {/* SQL Preview */}
                <div className="font-mono text-xs text-text-primary mb-2 line-clamp-3 pr-6">{entry.sql}</div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-2xs text-text-tertiary">
                  <div className="flex items-center gap-2">
                    <span>{formatTime(entry.executedAt)}</span>
                    {entry.duration !== undefined && (
                      <span className="text-text-tertiary">
                        {entry.duration < 1000 ? `${entry.duration}ms` : `${(entry.duration / 1000).toFixed(2)}s`}
                      </span>
                    )}
                  </div>
                  {entry.success && entry.rowCount !== undefined && (
                    <span className="text-success">
                      {entry.rowCount} {entry.rowCount === 1 ? "row" : "rows"}
                    </span>
                  )}
                  {!entry.success && <span className="text-error">Failed</span>}
                </div>

                {/* Re-run button */}
                <button
                  className="mt-2 w-full px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectQuery?.(entry.sql);
                  }}
                >
                  <Play className="w-3 h-3" />
                  Re-run
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
