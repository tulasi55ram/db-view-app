import { type FC } from "react";
import { Clock, Play, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: number;
  duration?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
}

export interface QueryHistoryPanelProps {
  history: QueryHistoryEntry[];
  onSelectQuery?: (sql: string) => void;
  onClearHistory?: () => void;
}

export const QueryHistoryPanel: FC<QueryHistoryPanelProps> = ({ history, onSelectQuery, onClearHistory }) => {
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

      {/* History List */}
      <div className="flex-1 overflow-auto p-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <p>No query history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...history].reverse().map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors cursor-pointer",
                  entry.success
                    ? "border-border bg-bg-primary hover:bg-bg-hover"
                    : "border-error/30 bg-error/5 hover:bg-error/10"
                )}
                onClick={() => onSelectQuery?.(entry.sql)}
              >
                {/* SQL Preview */}
                <div className="font-mono text-xs text-text-primary mb-2 line-clamp-3">{entry.sql}</div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-2xs text-text-tertiary">
                  <span>{formatTime(entry.executedAt)}</span>
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
