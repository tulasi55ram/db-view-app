import { useState, type FC } from "react";
import { Bookmark, Play, Trash2, Edit2, X, Check, Search } from "lucide-react";
import clsx from "clsx";

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedQueriesPanelProps {
  queries: SavedQuery[];
  onSelectQuery: (sql: string) => void;
  onDeleteQuery: (id: string) => void;
  onUpdateQuery: (id: string, updates: Partial<SavedQuery>) => void;
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
  const [searchTerm, setSearchTerm] = useState("");

  const handleStartEdit = (query: SavedQuery) => {
    setEditingId(query.id);
    setEditName(query.name);
    setEditDescription(query.description || "");
  };

  const handleSaveEdit = () => {
    if (editingId) {
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

  // Filter queries based on search
  const filteredQueries = searchTerm
    ? sortedQueries.filter(
        q =>
          q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.sql.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : sortedQueries;

  return (
    <div className="h-full flex flex-col bg-vscode-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-vscode-text-muted" />
          <span className="text-sm font-medium text-vscode-text">Saved Queries</span>
          {queries.length > 0 && (
            <span className="text-xs text-vscode-text-muted">({queries.length})</span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-vscode-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vscode-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search saved queries..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded bg-vscode-bg-lighter border border-vscode-border text-vscode-text placeholder-vscode-text-muted focus:outline-none focus:border-vscode-accent"
          />
        </div>
      </div>

      {/* Queries List */}
      <div className="flex-1 overflow-auto">
        {filteredQueries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted text-xs p-4">
            <Bookmark className="h-8 w-8 mb-2 opacity-30" />
            <p>{searchTerm ? "No matching queries" : "No saved queries"}</p>
            {!searchTerm && <p className="mt-1">Click "Save" to save a query</p>}
          </div>
        ) : (
          <div className="divide-y divide-vscode-border">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                className="p-3 hover:bg-vscode-bg-hover group"
              >
                {editingId === query.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded border border-vscode-border bg-vscode-bg-lighter text-vscode-text focus:outline-none focus:border-vscode-accent"
                      placeholder="Query name"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded border border-vscode-border bg-vscode-bg-lighter text-vscode-text-muted focus:outline-none focus:border-vscode-accent"
                      placeholder="Description (optional)"
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded hover:bg-vscode-bg-lighter text-vscode-text-muted hover:text-vscode-text"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 rounded hover:bg-vscode-bg-lighter text-vscode-accent"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start justify-between gap-2">
                      {/* Query Name */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-vscode-text truncate">
                          {query.name}
                        </div>
                        {/* Description */}
                        {query.description && (
                          <div className="text-2xs text-vscode-text-muted mt-0.5 truncate">
                            {query.description}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(query);
                          }}
                          className="p-1 rounded hover:bg-vscode-bg-lighter text-vscode-text-muted hover:text-vscode-text"
                          title="Edit name"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteQuery(query.id);
                          }}
                          className="p-1 rounded hover:bg-vscode-bg-lighter text-vscode-text-muted hover:text-vscode-error"
                          title="Delete query"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* SQL Preview */}
                    <code className="text-2xs font-mono text-vscode-text-muted mt-2 block bg-vscode-bg-lighter px-2 py-1.5 rounded whitespace-pre-wrap line-clamp-2 overflow-hidden">
                      {query.sql}
                    </code>

                    {/* Footer with time and load button */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-2xs text-vscode-text-muted">
                        {formatTime(query.updatedAt)}
                      </span>
                      <button
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-vscode-accent/20 text-vscode-accent hover:bg-vscode-accent/30 text-2xs font-medium transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectQuery(query.sql);
                        }}
                      >
                        <Play className="h-3 w-3" />
                        Load
                      </button>
                    </div>
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
