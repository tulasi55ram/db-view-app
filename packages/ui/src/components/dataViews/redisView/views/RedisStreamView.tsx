/**
 * RedisStreamView
 *
 * View component for Redis STREAM type
 */

import { useState, useMemo, type FC } from "react";
import { RefreshCw, Copy, Search, X, Clock } from "lucide-react";
import clsx from "clsx";
import { ValuePreview } from "../ValuePreview";
import { copyToClipboard } from "../utils";
import { toast } from "sonner";
import type { StreamEntry } from "../types";

interface RedisStreamViewProps {
  keyName: string;
  entries: StreamEntry[];
  streamInfo?: {
    length: number;
    firstEntry?: string;
    lastEntry?: string;
    groups?: number;
  };
  loading: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export const RedisStreamView: FC<RedisStreamViewProps> = ({
  keyName,
  entries,
  streamInfo,
  loading,
  isReadOnly,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.id.toLowerCase().includes(query) ||
        Object.keys(e.fields).some((k) => k.toLowerCase().includes(query)) ||
        Object.values(e.fields).some((v) =>
          String(v).toLowerCase().includes(query)
        )
    );
  }, [entries, searchQuery]);

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return entries.find((e) => e.id === selectedEntryId);
  }, [entries, selectedEntryId]);

  const handleCopyId = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const success = await copyToClipboard(id);
    if (success) {
      toast.success("Entry ID copied");
    }
  };

  const formatTimestamp = (id: string): string => {
    // Stream IDs are typically timestamp-sequence format
    const parts = id.split("-");
    if (parts.length >= 1) {
      const timestamp = parseInt(parts[0], 10);
      if (!isNaN(timestamp)) {
        return new Date(timestamp).toLocaleString();
      }
    }
    return id;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-vscode-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-vscode-border bg-vscode-bg-light flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-vscode-text-muted">Stream Entries</span>
          {streamInfo && (
            <span className="text-xs text-vscode-text-muted">
              ({streamInfo.length.toLocaleString()} entries)
            </span>
          )}
          {entries.length < (streamInfo?.length || 0) && (
            <span className="text-xs text-vscode-warning">
              (showing {entries.length})
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stream info bar */}
      {streamInfo && (
        <div className="px-4 py-1.5 border-b border-vscode-border bg-vscode-bg-light/50 flex items-center gap-4 text-xs text-vscode-text-muted">
          {streamInfo.groups !== undefined && (
            <span>Consumer groups: {streamInfo.groups}</span>
          )}
          {streamInfo.firstEntry && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              First: {formatTimestamp(streamInfo.firstEntry)}
            </span>
          )}
          {streamInfo.lastEntry && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last: {formatTimestamp(streamInfo.lastEntry)}
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-2 border-b border-vscode-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="w-full pl-8 pr-8 py-1.5 bg-vscode-bg border border-vscode-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-vscode-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Entries list */}
        <div className="w-1/2 border-r border-vscode-border overflow-auto">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-vscode-text-muted text-sm">
              {searchQuery ? (
                <>
                  <p>No matching entries</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-vscode-accent hover:underline"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <p>Empty stream</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-vscode-border">
              {filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  className={clsx(
                    "w-full px-3 py-2 text-left transition-colors group",
                    selectedEntryId === entry.id
                      ? "bg-vscode-accent/10 border-l-2 border-vscode-accent"
                      : "hover:bg-vscode-bg-hover border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "text-sm font-mono truncate",
                            selectedEntryId === entry.id
                              ? "text-vscode-accent"
                              : "text-vscode-text"
                          )}
                        >
                          {entry.id}
                        </span>
                      </div>
                      <div className="text-xs text-vscode-text-muted mt-0.5">
                        {formatTimestamp(entry.id)} • {Object.keys(entry.fields).length} fields
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleCopyId(entry.id, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-vscode-bg text-vscode-text-muted hover:text-vscode-text transition-all flex-shrink-0"
                      title="Copy entry ID"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entry detail */}
        <div className="w-1/2 overflow-auto p-4">
          {selectedEntry ? (
            <div className="space-y-4">
              {/* Entry ID */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-vscode-text-muted block">Entry ID</span>
                  <span className="font-mono text-sm text-vscode-accent">
                    {selectedEntry.id}
                  </span>
                </div>
                <button
                  onClick={() => handleCopyId(selectedEntry.id)}
                  className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
                  title="Copy entry ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Timestamp */}
              <div>
                <span className="text-xs text-vscode-text-muted block">Timestamp</span>
                <span className="text-sm text-vscode-text">
                  {formatTimestamp(selectedEntry.id)}
                </span>
              </div>

              {/* Fields */}
              <div>
                <span className="text-xs text-vscode-text-muted block mb-2">
                  Fields ({Object.keys(selectedEntry.fields).length})
                </span>
                <ValuePreview value={selectedEntry.fields} showFormatBadge={false} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-vscode-text-muted text-sm">
              Select an entry to view its details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RedisStreamView;
