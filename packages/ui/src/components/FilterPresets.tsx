/**
 * FilterPresets - Save, load, and manage filter presets for table views
 *
 * Allows users to save their current filter configuration and reload it later.
 * Presets are stored per table (schema.table) in VS Code workspace state.
 */

import { useState, useEffect, useCallback, useRef, memo, type FC } from "react";
import { Bookmark, ChevronDown, Trash2, Save, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { getVsCodeApi } from "../vscode";
import type { FilterCondition } from "@dbview/types";

// Stored filter preset structure
export interface StoredFilterPreset {
  id: string;
  name: string;
  filters: Array<{
    id: string;
    columnName: string;
    operator: string;
    value: unknown;
  }>;
  logic: "AND" | "OR";
  createdAt: number;
}

interface FilterPresetsProps {
  schema: string;
  table: string;
  currentFilters: FilterCondition[];
  currentLogic: "AND" | "OR";
  onLoadPreset: (filters: FilterCondition[], logic: "AND" | "OR") => void;
}

export const FilterPresets: FC<FilterPresetsProps> = memo(function FilterPresets({
  schema,
  table,
  currentFilters,
  currentLogic,
  onLoadPreset,
}) {
  const [presets, setPresets] = useState<StoredFilterPreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveDialogRef = useRef<HTMLDivElement>(null);

  const vscode = getVsCodeApi();

  // Load presets on mount and when table changes
  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ type: "GET_FILTER_PRESETS", schema, table });
    }
  }, [vscode, schema, table]);

  // Listen for preset responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "FILTER_PRESETS_LOADED":
          setPresets(message.presets || []);
          break;
        case "FILTER_PRESET_SAVED":
          setPresets((prev) => {
            const existing = prev.findIndex((p) => p.id === message.preset.id);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = message.preset;
              return updated;
            }
            return [...prev, message.preset];
          });
          setShowSaveDialog(false);
          setNewPresetName("");
          setLoading(false);
          toast.success(`Saved preset "${message.preset.name}"`);
          break;
        case "FILTER_PRESET_DELETED":
          setPresets((prev) => prev.filter((p) => p.id !== message.presetId));
          toast.success("Preset deleted");
          break;
        case "FILTER_PRESET_ERROR":
          setLoading(false);
          toast.error(message.error);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !saveDialogRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Save current filters as a preset
  const handleSavePreset = useCallback(() => {
    if (!vscode || !newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    if (currentFilters.length === 0) {
      toast.error("No filters to save");
      return;
    }

    setLoading(true);
    const preset: StoredFilterPreset = {
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

    vscode.postMessage({ type: "SAVE_FILTER_PRESET", schema, table, preset });
  }, [vscode, schema, table, currentFilters, currentLogic, newPresetName]);

  // Load a preset
  const handleLoadPreset = useCallback(
    (preset: StoredFilterPreset) => {
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

  // Delete a preset
  const handleDeletePreset = useCallback(
    (presetId: string, presetName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (vscode) {
        vscode.postMessage({
          type: "DELETE_FILTER_PRESET",
          schema,
          table,
          presetId,
        });
      }
    },
    [vscode, schema, table]
  );

  // Check if current filters are valid for saving
  const hasValidFilters = currentFilters.some(
    (f) =>
      f.columnName &&
      (f.operator === "is_null" || f.operator === "is_not_null" || f.value)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Preset Button with badge */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors",
            presets.length > 0
              ? "bg-vscode-accent/10 text-vscode-accent hover:bg-vscode-accent/20"
              : "text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text"
          )}
          title={
            presets.length > 0
              ? `${presets.length} saved preset${presets.length !== 1 ? "s" : ""}`
              : "No saved presets"
          }
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Presets</span>
          {presets.length > 0 && (
            <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-vscode-accent px-1 text-[10px] font-semibold text-white">
              {presets.length}
            </span>
          )}
          <ChevronDown
            className={clsx(
              "w-3 h-3 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {/* Save button - only show when filters exist */}
        {hasValidFilters && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text transition-colors"
            title="Save current filter as preset"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 min-w-[200px] max-w-[300px] bg-vscode-bg border border-vscode-border rounded-md shadow-lg overflow-hidden">
          {presets.length === 0 ? (
            <div className="px-3 py-4 text-xs text-vscode-text-muted text-center">
              No saved presets
              <div className="mt-1 text-[10px]">
                Add filters and click Save to create a preset
              </div>
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className="w-full px-3 py-2 text-left hover:bg-vscode-bg-hover transition-colors group flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-vscode-text truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-vscode-text-muted">
                      {preset.filters.length} filter
                      {preset.filters.length !== 1 && "s"} ({preset.logic})
                    </div>
                  </div>
                  <button
                    onClick={(e) =>
                      handleDeletePreset(preset.id, preset.name, e)
                    }
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-vscode-error/10 text-vscode-error transition-all"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Save New Preset Option */}
          {hasValidFilters && (
            <>
              <div className="h-px bg-vscode-border" />
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowSaveDialog(true);
                }}
                className="w-full px-3 py-2 text-left text-xs text-vscode-accent hover:bg-vscode-bg-hover transition-colors flex items-center gap-2"
              >
                <Save className="w-3 h-3" />
                Save current filters...
              </button>
            </>
          )}
        </div>
      )}

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowSaveDialog(false);
              setNewPresetName("");
            }}
          />

          {/* Dialog */}
          <div
            ref={saveDialogRef}
            className="relative z-10 w-[320px] rounded-lg border border-vscode-border bg-vscode-bg shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
              <h3 className="text-sm font-semibold text-vscode-text flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                Save Filter Preset
              </h3>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewPresetName("");
                }}
                className="p-1 rounded hover:bg-vscode-bg-hover transition-colors"
              >
                <X className="w-4 h-4 text-vscode-text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 py-3">
              <label className="block text-xs text-vscode-text-muted mb-1.5">
                Preset Name
              </label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPresetName.trim()) {
                    handleSavePreset();
                  }
                }}
                placeholder="e.g., Active Users, Recent Orders..."
                className="w-full px-3 py-2 text-sm bg-vscode-bg-light border border-vscode-border rounded focus:outline-none focus:border-vscode-accent text-vscode-text placeholder:text-vscode-text-muted"
                autoFocus
              />
              <div className="mt-2 text-[10px] text-vscode-text-muted">
                Saving {currentFilters.length} filter
                {currentFilters.length !== 1 && "s"} with {currentLogic} logic
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-vscode-border">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewPresetName("");
                }}
                className="px-3 py-1.5 text-xs text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-bg-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim() || loading}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                  newPresetName.trim() && !loading
                    ? "bg-vscode-accent text-white hover:bg-vscode-accent/90"
                    : "bg-vscode-bg-light text-vscode-text-muted cursor-not-allowed"
                )}
              >
                {loading ? "Saving..." : "Save Preset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FilterPresets.displayName = "FilterPresets";
