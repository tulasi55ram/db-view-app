import { useState, useEffect, useCallback, memo } from "react";
import { X, Bookmark, Star, Trash2, Clock, Filter } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import type { SavedView, FilterCondition } from "@dbview/types";

interface SavedViewsPanelProps {
  open: boolean;
  onClose: () => void;
  schema: string;
  table: string;
  onLoadView: (view: SavedView) => void;
  currentFilters: FilterCondition[];
  currentFilterLogic: "AND" | "OR";
  currentSortColumn: string | null;
  currentSortDirection: "ASC" | "DESC";
}

export const SavedViewsPanel = memo(function SavedViewsPanel({
  open,
  onClose,
  schema,
  table,
  onLoadView,
  currentFilters,
  currentFilterLogic,
  currentSortColumn,
  currentSortDirection,
}: SavedViewsPanelProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);

  const api = getElectronAPI();

  // Load views when panel opens
  useEffect(() => {
    const loadViews = async () => {
      if (!open || !api) return;
      setLoading(true);
      try {
        const loaded = await api.getViews({ schema, table });
        setViews(loaded);
      } catch (err) {
        console.error("Failed to load views:", err);
        toast.error("Failed to load saved views");
      } finally {
        setLoading(false);
      }
    };
    loadViews();
  }, [api, open, schema, table]);

  const handleSaveView = useCallback(
    async (name: string, description: string, isDefault: boolean) => {
      if (!api) return;

      const view: SavedView = {
        id: Date.now().toString(),
        name,
        description: description || undefined,
        schema,
        table,
        state: {
          filters: currentFilters,
          filterLogic: currentFilterLogic,
          sorting: currentSortColumn
            ? [{ columnName: currentSortColumn, direction: currentSortDirection.toLowerCase() as "asc" | "desc" }]
            : [],
          visibleColumns: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDefault,
      };

      try {
        await api.saveView({ schema, table, view });
        setViews((prev) => [...prev.filter((v) => v.id !== view.id), view]);
        toast.success(`Saved view "${name}"`);
      } catch (err) {
        console.error("Failed to save view:", err);
        toast.error("Failed to save view");
      }
    },
    [api, schema, table, currentFilters, currentFilterLogic, currentSortColumn, currentSortDirection]
  );

  const handleDeleteView = useCallback(
    async (viewId: string, viewName: string) => {
      if (!api) return;

      try {
        await api.deleteView({ schema, table, viewId });
        setViews((prev) => prev.filter((v) => v.id !== viewId));
        toast.success(`Deleted view "${viewName}"`);
      } catch (err) {
        console.error("Failed to delete view:", err);
        toast.error("Failed to delete view");
      }
    },
    [api, schema, table]
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-[360px] h-full bg-bg-primary border-l border-border shadow-xl flex flex-col animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-accent" />
            Saved Views
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
              Loading views...
            </div>
          ) : views.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <Bookmark className="w-8 h-8 text-text-tertiary mb-2" />
              <p className="text-sm text-text-secondary">No saved views</p>
              <p className="text-xs text-text-tertiary mt-1">
                Create filters and sorting, then save as a view
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {views.map((view) => (
                <div
                  key={view.id}
                  className="p-3 hover:bg-bg-hover transition-colors group cursor-pointer"
                  onClick={() => {
                    onLoadView(view);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {view.name}
                        </span>
                        {view.isDefault && (
                          <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      {view.description && (
                        <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                          {view.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteView(view.id, view.name);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/10 text-error transition-all"
                      title="Delete view"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-text-tertiary">
                    {view.state.filters.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Filter className="w-3 h-3" />
                        {view.state.filters.length} filter{view.state.filters.length !== 1 && "s"}
                      </span>
                    )}
                    {view.state.sorting.length > 0 && (
                      <span>
                        Sorted by {view.state.sorting[0].columnName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(view.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Save Section */}
        <div className="border-t border-border p-3 bg-bg-secondary/50">
          <QuickSaveView
            currentFilters={currentFilters}
            existingNames={views.map((v) => v.name)}
            onSave={handleSaveView}
          />
        </div>
      </div>
    </div>
  );
});

// Quick save component
const QuickSaveView = memo(function QuickSaveView({
  currentFilters,
  existingNames,
  onSave,
}: {
  currentFilters: FilterCondition[];
  existingNames: string[];
  onSave: (name: string, description: string, isDefault: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a view name");
      return;
    }
    if (existingNames.includes(trimmedName)) {
      toast.error("A view with this name already exists");
      return;
    }
    onSave(trimmedName, "", isDefault);
    setName("");
    setIsDefault(false);
  };

  const hasFilters = currentFilters.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder={hasFilters ? "Save current view as..." : "No filters to save"}
          disabled={!hasFilters}
          className="flex-1 px-2.5 py-1.5 bg-bg-primary border border-border rounded text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSave}
          disabled={!hasFilters || !name.trim()}
          className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
      </div>
      <label className={cn("flex items-center gap-1.5 cursor-pointer", !hasFilters && "opacity-50 pointer-events-none")}>
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          disabled={!hasFilters}
          className="rounded w-3 h-3"
        />
        <span className="text-[10px] text-text-tertiary">Set as default</span>
      </label>
    </div>
  );
});
