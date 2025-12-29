import { useState, useEffect, useCallback, memo } from "react";
import { Bookmark, ChevronDown, Trash2, Save, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI, type FilterPreset } from "@/electron";
import { toast } from "sonner";
import type { FilterCondition } from "@dbview/types";

interface FilterPresetsProps {
  schema: string;
  table: string;
  currentFilters: FilterCondition[];
  currentLogic: "AND" | "OR";
  onLoadPreset: (filters: FilterCondition[], logic: "AND" | "OR") => void;
}

export const FilterPresets = memo(function FilterPresets({
  schema,
  table,
  currentFilters,
  currentLogic,
  onLoadPreset,
}: FilterPresetsProps) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [loading, setLoading] = useState(false);

  const api = getElectronAPI();

  // Load presets on mount and when table changes
  useEffect(() => {
    const loadPresets = async () => {
      if (!api) return;
      try {
        const loaded = await api.getFilterPresets(schema, table);
        setPresets(loaded);
      } catch (err) {
        console.error("Failed to load filter presets:", err);
      }
    };
    loadPresets();
  }, [api, schema, table]);

  const handleSavePreset = useCallback(async () => {
    if (!api || !newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    if (currentFilters.length === 0) {
      toast.error("No filters to save");
      return;
    }

    setLoading(true);
    try {
      const preset: FilterPreset = {
        id: Date.now().toString(),
        name: newPresetName.trim(),
        filters: currentFilters.map((f) => ({
          id: f.id,
          columnName: f.columnName,
          operator: f.operator,
          value: f.value,
        })),
        logic: currentLogic,
        createdAt: Date.now(),
      };

      await api.saveFilterPreset(schema, table, preset);
      setPresets((prev) => {
        const existing = prev.findIndex((p) => p.name === preset.name);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = preset;
          return updated;
        }
        return [...prev, preset];
      });
      setNewPresetName("");
      setShowSaveDialog(false);
      toast.success(`Saved preset "${preset.name}"`);
    } catch (err) {
      console.error("Failed to save preset:", err);
      toast.error("Failed to save preset");
    } finally {
      setLoading(false);
    }
  }, [api, schema, table, currentFilters, currentLogic, newPresetName]);

  const handleLoadPreset = useCallback(
    (preset: FilterPreset) => {
      const filters: FilterCondition[] = preset.filters.map((f) => ({
        id: f.id,
        columnName: f.columnName,
        operator: f.operator as FilterCondition["operator"],
        value: f.value,
      }));
      onLoadPreset(filters, preset.logic);
      setIsOpen(false);
      toast.success(`Loaded preset "${preset.name}"`);
    },
    [onLoadPreset]
  );

  const handleDeletePreset = useCallback(
    async (presetId: string, presetName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!api) return;

      try {
        await api.deleteFilterPreset(schema, table, presetId);
        setPresets((prev) => prev.filter((p) => p.id !== presetId));
        toast.success(`Deleted preset "${presetName}"`);
      } catch (err) {
        console.error("Failed to delete preset:", err);
        toast.error("Failed to delete preset");
      }
    },
    [api, schema, table]
  );

  const hasValidFilters = currentFilters.some(
    (f) => f.columnName && (f.operator === "is_null" || f.operator === "is_not_null" || f.value)
  );

  return (
    <div className="relative">
      {/* Preset Button */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
            presets.length > 0
              ? "bg-accent/10 text-accent hover:bg-accent/20"
              : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover"
          )}
          title="Filter presets"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Presets</span>
          {presets.length > 0 && (
            <span className="ml-1 px-1 py-0.5 bg-accent/20 rounded text-[10px]">
              {presets.length}
            </span>
          )}
          <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
        </button>

        {hasValidFilters && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-bg-tertiary text-text-secondary hover:bg-bg-hover transition-colors"
            title="Save current filter as preset"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 min-w-[200px] max-w-[300px] bg-bg-primary border border-border rounded-md shadow-lg overflow-hidden">
          {presets.length === 0 ? (
            <div className="px-3 py-4 text-xs text-text-tertiary text-center">
              No saved presets
              <p className="mt-1 text-[10px]">Create filters and click Save to add a preset</p>
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className="w-full px-3 py-2 text-left hover:bg-bg-hover transition-colors group flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      {preset.filters.length} filter{preset.filters.length !== 1 && "s"} ({preset.logic})
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeletePreset(preset.id, preset.name, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/10 text-error transition-all"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSaveDialog(false)} />
          <div className="relative z-10 w-[320px] rounded-lg border border-border bg-bg-primary shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                Save Filter Preset
              </h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="p-1 rounded hover:bg-bg-hover text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Preset Name</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSavePreset();
                    if (e.key === "Escape") setShowSaveDialog(false);
                  }}
                  placeholder="My filter preset"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>
              <div className="text-[10px] text-text-tertiary">
                {currentFilters.length} filter{currentFilters.length !== 1 && "s"} with {currentLogic} logic
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-bg-secondary/50">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={loading || !newPresetName.trim()}
                className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Saving..." : "Save Preset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />}
    </div>
  );
});
