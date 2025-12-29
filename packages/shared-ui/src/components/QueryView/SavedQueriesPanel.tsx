import { type FC, useState } from "react";
import { Bookmark, Play, Trash2, Edit2, X, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import type { SavedQuery } from "@/electron";

export interface SavedQueriesPanelProps {
  queries: SavedQuery[];
  onSelectQuery?: (sql: string) => void;
  onDeleteQuery?: (id: string) => void;
  onUpdateQuery?: (id: string, updates: Partial<SavedQuery>) => void;
}

export const SavedQueriesPanel: FC<SavedQueriesPanelProps> = ({
  queries,
  onSelectQuery,
  onDeleteQuery,
  onUpdateQuery,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleStartEdit = (query: SavedQuery) => {
    setEditingId(query.id);
    setEditName(query.name);
    setEditDescription(query.description || "");
  };

  const handleSaveEdit = () => {
    if (editingId && onUpdateQuery) {
      onUpdateQuery(editingId, {
        name: editName.trim() || "Untitled Query",
        description: editDescription.trim() || undefined,
      });
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // Sort queries by updatedAt descending (most recently updated first)
  const sortedQueries = [...queries].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="h-full border-l border-border bg-bg-secondary flex flex-col">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">Saved Queries</span>
          {queries.length > 0 && (
            <span className="text-xs text-text-tertiary">({queries.length})</span>
          )}
        </div>
      </div>

      {/* Queries List */}
      <div className="flex-1 overflow-auto p-2">
        {sortedQueries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm">
            <Bookmark className="w-8 h-8 mb-2 opacity-30" />
            <p>No saved queries</p>
            <p className="text-xs mt-1">Click "Save" to save a query</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedQueries.map((query) => (
              <div
                key={query.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors group relative",
                  "border-border bg-bg-primary hover:bg-bg-hover"
                )}
              >
                {editingId === query.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 text-sm rounded border border-border bg-bg-primary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="Query name"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-border bg-bg-primary text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="Description (optional)"
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 rounded hover:bg-bg-hover text-accent hover:text-accent"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    {/* Actions - top right */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(query);
                        }}
                        className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
                        title="Edit name"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {onDeleteQuery && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteQuery(query.id);
                          }}
                          className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-error"
                          title="Delete query"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Query Name */}
                    <div className="font-medium text-sm text-text-primary mb-1 pr-14">
                      {query.name}
                    </div>

                    {/* Description */}
                    {query.description && (
                      <div className="text-xs text-text-secondary mb-2">
                        {query.description}
                      </div>
                    )}

                    {/* SQL Preview */}
                    <div className="font-mono text-xs text-text-tertiary mb-2 line-clamp-2 bg-bg-tertiary px-2 py-1 rounded">
                      {query.sql}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-2xs text-text-tertiary">
                      <span>{formatTime(query.updatedAt)}</span>
                    </div>

                    {/* Load button */}
                    <button
                      className="mt-2 w-full px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectQuery?.(query.sql);
                      }}
                    >
                      <Play className="w-3 h-3" />
                      Load Query
                    </button>
                  </>
                )}
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

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
