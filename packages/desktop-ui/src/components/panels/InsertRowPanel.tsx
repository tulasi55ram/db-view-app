import { useState, useEffect, useCallback, memo } from "react";
import { Plus, Clock } from "lucide-react";
import type { ColumnMetadata } from "@dbview/types";
import { SidePanel, SidePanelFooter } from "./SidePanel";

interface InsertRowPanelProps {
  open: boolean;
  onClose: () => void;
  onInsert: (values: Record<string, unknown>) => Promise<void>;
  columns: ColumnMetadata[];
  tableName: string;
  initialValues?: Record<string, string>;
  initialNullColumns?: Set<string>;
  /** Panel variant - "inline" for resizable side panel, "overlay" for legacy behavior */
  variant?: "inline" | "overlay";
}

// Helper to get current timestamp in various formats
function getCurrentTimestamp(type: string): string {
  const now = new Date();
  const lowerType = type.toLowerCase();

  if (lowerType === "date") {
    return now.toISOString().split("T")[0];
  }
  if (lowerType.includes("time") && !lowerType.includes("timestamp")) {
    return now.toTimeString().split(" ")[0];
  }
  // Default: full timestamp
  return now.toISOString().replace("Z", "").split(".")[0];
}

// Generate UUID v4
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const InsertRowPanel = memo(function InsertRowPanel({
  open,
  onClose,
  onInsert,
  columns,
  tableName,
  initialValues = {},
  initialNullColumns = new Set(),
  variant = "inline",
}: InsertRowPanelProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [nullColumns, setNullColumns] = useState<Set<string>>(initialNullColumns);
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when panel opens with new initial values
  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setNullColumns(new Set(initialNullColumns));
      setError(null);
    }
  }, [open, initialValues, initialNullColumns]);

  // Filter out auto-increment and generated columns
  const editableColumns = columns.filter((col) => {
    const type = col.type.toLowerCase();
    const isAutoIncrement = type.includes("serial") || type.includes("identity");
    const isNonEditable = col.editable === false || col.isGenerated === true;
    return !isAutoIncrement && !isNonEditable;
  });

  const handleValueChange = useCallback((columnName: string, value: string) => {
    setValues((prev) => ({ ...prev, [columnName]: value }));
  }, []);

  const handleNullToggle = useCallback((columnName: string, isNull: boolean) => {
    setNullColumns((prev) => {
      const newSet = new Set(prev);
      if (isNull) {
        newSet.add(columnName);
      } else {
        newSet.delete(columnName);
      }
      return newSet;
    });
  }, []);

  const handleGenerateUUID = useCallback((columnName: string) => {
    setValues((prev) => ({ ...prev, [columnName]: generateUUID() }));
  }, []);

  const handleSubmit = async () => {
    setInserting(true);
    setError(null);

    try {
      const insertValues: Record<string, unknown> = {};

      for (const col of editableColumns) {
        // Skip if null is selected
        if (nullColumns.has(col.name)) {
          insertValues[col.name] = null;
          continue;
        }

        const value = values[col.name] || "";
        const type = col.type.toLowerCase();

        // Convert based on type
        if (value === "") {
          if (col.nullable) {
            insertValues[col.name] = null;
          } else if (col.defaultValue) {
            // Skip - let database use default
            continue;
          } else {
            throw new Error(`${col.name} is required`);
          }
        } else if (type.includes("int") || type.includes("serial")) {
          const intValue = parseInt(value, 10);
          if (isNaN(intValue)) {
            throw new Error(`${col.name} must be an integer`);
          }
          insertValues[col.name] = intValue;
        } else if (type.includes("float") || type.includes("double") || type.includes("decimal") || type.includes("numeric") || type.includes("real")) {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            throw new Error(`${col.name} must be a number`);
          }
          insertValues[col.name] = numValue;
        } else if (type.includes("bool")) {
          const lowerValue = value.toLowerCase();
          if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes") {
            insertValues[col.name] = true;
          } else if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no") {
            insertValues[col.name] = false;
          } else {
            throw new Error(`${col.name} must be true or false`);
          }
        } else if (type.includes("json") || type.includes("jsonb")) {
          try {
            insertValues[col.name] = JSON.parse(value);
          } catch {
            throw new Error(`${col.name} must be valid JSON`);
          }
        } else {
          // String, date, time, etc. - pass as-is (raw database value)
          insertValues[col.name] = value;
        }
      }

      await onInsert(insertValues);
      // Reset form on success
      setValues({});
      setNullColumns(new Set());
      onClose();
    } catch (err) {
      console.error("Insert failed:", err);
      setError(err instanceof Error ? err.message : "Insert failed");
    } finally {
      setInserting(false);
    }
  };

  // Handle keyboard shortcuts - only for overlay mode (SidePanel handles its own)
  useEffect(() => {
    if (!open || variant === "inline") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, variant]);

  if (!open) return null;

  // Shared form content
  const formContent = (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {editableColumns.map((col) => {
            const isNull = nullColumns.has(col.name);
            const isRequired = !col.nullable && !col.defaultValue;
            const type = col.type.toLowerCase();
            const isUUID = type.includes("uuid") || type.includes("guid") || type.includes("uniqueidentifier");
            const isDateTime = type.includes("date") || type.includes("time") || type.includes("timestamp");
            const isBoolean = type.includes("bool");
            const isJson = type.includes("json") || type.includes("jsonb");

            return (
              <div key={col.name} className="p-3 border border-border rounded-lg bg-bg-secondary/50 space-y-2">
                {/* Column Header */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-primary">
                    <span>
                      {col.name}
                      {isRequired && <span className="text-error ml-1">*</span>}
                    </span>
                    <span className="text-[10px] text-text-tertiary font-normal px-1.5 py-0.5 bg-bg-tertiary rounded">
                      {col.type}
                    </span>
                  </label>
                  {col.nullable && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isNull}
                        onChange={(e) => handleNullToggle(col.name, e.target.checked)}
                        className="rounded w-3 h-3"
                      />
                      <span className="text-[10px] text-text-tertiary">NULL</span>
                    </label>
                  )}
                </div>

                {/* Input Field */}
                <div className="flex items-center gap-2">
                  {isBoolean ? (
                    <select
                      value={values[col.name] || ""}
                      onChange={(e) => handleValueChange(col.name, e.target.value)}
                      disabled={isNull || inserting}
                      className="w-full px-2.5 py-2 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:bg-bg-tertiary"
                    >
                      <option value="">-- Select --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : isJson ? (
                    <textarea
                      value={values[col.name] || ""}
                      onChange={(e) => handleValueChange(col.name, e.target.value)}
                      disabled={isNull || inserting}
                      placeholder='{"key": "value"}'
                      rows={3}
                      className="w-full px-2.5 py-2 bg-bg-primary border border-border rounded text-text-primary font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:bg-bg-tertiary resize-none"
                    />
                  ) : isDateTime ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={values[col.name] || ""}
                        onChange={(e) => handleValueChange(col.name, e.target.value)}
                        disabled={isNull || inserting}
                        placeholder={
                          type === "date"
                            ? "yyyy-MM-dd"
                            : type.includes("time") && !type.includes("timestamp")
                            ? "HH:mm:ss"
                            : "yyyy-MM-dd HH:mm:ss"
                        }
                        className="flex-1 px-2.5 py-2 bg-bg-primary border border-border rounded text-text-primary text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:bg-bg-tertiary"
                      />
                      <button
                        type="button"
                        onClick={() => handleValueChange(col.name, getCurrentTimestamp(col.type))}
                        disabled={isNull || inserting}
                        className="px-2.5 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                        title="Set to current time"
                      >
                        <Clock className="w-3 h-3" />
                        Now
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type={
                          type.includes("int") || type.includes("float") || type.includes("decimal") || type.includes("numeric") || type.includes("real")
                            ? "number"
                            : "text"
                        }
                        value={values[col.name] || ""}
                        onChange={(e) => handleValueChange(col.name, e.target.value)}
                        disabled={isNull || inserting}
                        placeholder={col.defaultValue ? `Default: ${col.defaultValue}` : ""}
                        className="flex-1 px-2.5 py-2 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:bg-bg-tertiary"
                      />
                      {isUUID && !isNull && (
                        <button
                          type="button"
                          onClick={() => handleGenerateUUID(col.name)}
                          disabled={inserting}
                          className="px-2.5 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs rounded transition-colors whitespace-nowrap"
                          title="Generate UUID v4"
                        >
                          Gen
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Default value hint */}
                {col.defaultValue && (
                  <p className="text-[10px] text-text-tertiary">Default: {col.defaultValue}</p>
                )}
              </div>
            );
          })}

          {/* Required fields note */}
          <div className="px-3 py-2 bg-bg-tertiary/50 rounded border border-border">
            <p className="text-[10px] text-text-tertiary">
              <span className="text-error">*</span> Required fields
            </p>
          </div>
        </div>
  );

  // Shared footer content
  const footerContent = (
    <SidePanelFooter>
      <button
        type="button"
        onClick={onClose}
        disabled={inserting}
        className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={inserting}
        className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        {inserting ? "Inserting..." : "Insert Row"}
      </button>
    </SidePanelFooter>
  );

  // Inline mode - uses SidePanel wrapper (for use inside PanelGroup)
  if (variant === "inline") {
    return (
      <SidePanel
        title={`Insert Row - ${tableName}`}
        icon={<Plus className="w-4 h-4" />}
        onClose={onClose}
        footer={footerContent}
      >
        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 bg-error/10 border-b border-error/30 text-error text-xs">
            {error}
          </div>
        )}
        {formContent}
      </SidePanel>
    );
  }

  // Overlay mode - legacy fixed positioning with backdrop
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-[400px] h-full bg-bg-primary border-l border-border shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" />
            Insert New Row - {tableName}
          </h3>
          <button
            onClick={onClose}
            disabled={inserting}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 bg-error/10 border-b border-error/30 text-error text-xs">
            {error}
          </div>
        )}

        {formContent}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-bg-secondary">
          <button
            type="button"
            onClick={onClose}
            disabled={inserting}
            className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={inserting}
            className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {inserting ? "Inserting..." : "Insert Row"}
          </button>
        </div>
      </div>
    </div>
  );
});
