import { useState } from "react";
import { X, Clock } from "lucide-react";
import type { ColumnMetadata } from "@dbview/types";

interface InsertRowModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (values: Record<string, unknown>) => Promise<void>;
  columns: ColumnMetadata[];
  tableName: string;
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

export function InsertRowModal({ open, onClose, onInsert, columns, tableName }: InsertRowModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [nullColumns, setNullColumns] = useState<Set<string>>(new Set());
  const [inserting, setInserting] = useState(false);

  // Filter out auto-increment columns
  const editableColumns = columns.filter((col) => {
    const type = col.type.toLowerCase();
    return !type.includes("serial") && !type.includes("identity");
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInserting(true);

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
        } else if (type.includes("float") || type.includes("double") || type.includes("decimal") || type.includes("numeric")) {
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
          } catch (e) {
            throw new Error(`${col.name} must be valid JSON`);
          }
        } else {
          // String or date
          insertValues[col.name] = value;
        }
      }

      await onInsert(insertValues);
      setValues({});
      setNullColumns(new Set());
      onClose();
    } catch (error) {
      console.error("Insert failed:", error);
      throw error;
    } finally {
      setInserting(false);
    }
  };

  return (
    <div className="border-b border-border bg-bg-secondary">
      {/* Expandable Panel Content */}
      {open && (
        <div className="animate-slideDown max-h-[70vh] overflow-y-auto flex flex-col">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-tertiary">
            <h3 className="text-sm font-semibold text-text-primary">Insert New Row - {tableName}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-hover transition-colors"
              disabled={inserting}
              title="Collapse insert panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="px-4 py-3 space-y-3">
            {editableColumns.map((col) => {
              const isNull = nullColumns.has(col.name);
              const isRequired = !col.nullable && !col.defaultValue;

              return (
                <div key={col.name} className="p-3 border border-border rounded bg-bg-primary space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-primary">
                    <span>
                      {col.name}
                      {isRequired && <span className="text-error ml-1">*</span>}
                    </span>
                    <span className="text-xs text-text-tertiary font-normal">({col.type})</span>
                    {col.nullable && (
                      <label className="flex items-center gap-1 text-xs text-text-secondary font-normal ml-auto">
                        <input
                          type="checkbox"
                          checked={isNull}
                          onChange={(e) => {
                            const newNullColumns = new Set(nullColumns);
                            if (e.target.checked) {
                              newNullColumns.add(col.name);
                            } else {
                              newNullColumns.delete(col.name);
                            }
                            setNullColumns(newNullColumns);
                          }}
                          className="rounded"
                        />
                        Set NULL
                      </label>
                    )}
                  </label>

                  {col.type.toLowerCase().includes("bool") ? (
                    <select
                      value={values[col.name] || ""}
                      onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
                      disabled={isNull || inserting}
                      className="w-full px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    >
                      <option value="">-- Select --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : col.type.toLowerCase().includes("json") ? (
                    <textarea
                      value={values[col.name] || ""}
                      onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
                      disabled={isNull || inserting}
                      placeholder='{"key": "value"}'
                      rows={3}
                      className="w-full px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    />
                  ) : col.type.toLowerCase().includes("date") || col.type.toLowerCase().includes("time") || col.type.toLowerCase().includes("timestamp") ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={values[col.name] || ""}
                        onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
                        disabled={isNull || inserting}
                        placeholder={
                          col.type.toLowerCase() === "date"
                            ? "yyyy-MM-dd"
                            : col.type.toLowerCase().includes("time") && !col.type.toLowerCase().includes("timestamp")
                            ? "HH:mm:ss"
                            : "yyyy-MM-dd HH:mm:ss"
                        }
                        className="flex-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setValues({ ...values, [col.name]: getCurrentTimestamp(col.type) })}
                        disabled={isNull || inserting}
                        className="px-2 py-1.5 bg-bg-tertiary hover:bg-bg-hover border border-border rounded text-text-secondary text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                        title="Set to current time"
                      >
                        <Clock className="w-3 h-3" />
                        Now
                      </button>
                    </div>
                  ) : (
                    <input
                      type={
                        col.type.toLowerCase().includes("int") ||
                        col.type.toLowerCase().includes("float") ||
                        col.type.toLowerCase().includes("decimal") ||
                        col.type.toLowerCase().includes("numeric")
                          ? "number"
                          : "text"
                      }
                      value={values[col.name] || ""}
                      onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
                      disabled={isNull || inserting}
                      placeholder={col.defaultValue ? `Default: ${col.defaultValue}` : ""}
                      className="w-full px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    />
                  )}

                  {col.defaultValue && (
                    <p className="text-xs text-text-tertiary">Default: {col.defaultValue}</p>
                  )}
                </div>
              );
            })}

            <div className="px-3 py-2 bg-bg-tertiary/50 rounded border border-border">
              <p className="text-xs text-text-tertiary">* Required fields</p>
            </div>
          </div>

          {/* Footer - Sticky */}
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-bg-tertiary">
            <button
              type="button"
              onClick={onClose}
              disabled={inserting}
              className="px-3 py-1.5 rounded bg-bg-secondary hover:bg-bg-hover text-text-primary text-xs transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={inserting}
              className="px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {inserting ? "Inserting..." : "Insert Row"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
