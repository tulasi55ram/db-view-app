/**
 * InsertRowPanel - Slide-out panel for inserting new rows
 * Slides in from the right side of the table view
 */

import { useState, useEffect, type FC, useRef } from "react";
import type { ColumnMetadata } from "@dbview/types";
import { X, Sparkles, Plus, Clock } from "lucide-react";
import clsx from "clsx";
import { SidePanel } from "./panels/SidePanel";

export interface InsertRowPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnMetadata[];
  onInsert: (values: Record<string, unknown>) => void;
  initialValues?: Record<string, unknown>;
  isInserting?: boolean;
  insertError?: string | null;
  variant?: "inline" | "overlay";
}

// Helper function to convert value to form string
const valueToFormString = (val: unknown, colType: string): string => {
  if (val === null || val === undefined) {
    return "";
  }

  // JSON/JSONB columns
  if (colType === "json" || colType === "jsonb") {
    return typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
  }

  // Array columns (text[], integer[], etc.)
  if (Array.isArray(val)) {
    const escaped = val.map(item => {
      if (item === null) return 'NULL';
      const str = String(item);
      if (/[,"\\\s{}]/.test(str)) {
        const escapedStr = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${escapedStr}"`;
      }
      return str;
    });
    return `{${escaped.join(',')}}`;
  }

  // For all other types including date/time, just return the string representation
  // This preserves the database format as-is

  // Boolean
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  return String(val);
};

export const InsertRowPanel: FC<InsertRowPanelProps> = ({
  open,
  onOpenChange,
  columns,
  onInsert,
  initialValues,
  isInserting = false,
  insertError = null,
  variant = "inline",
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize form values
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    columns.forEach((col) => {
      if (!col.isAutoIncrement && !col.isGenerated) {
        if (initialValues && col.name in initialValues) {
          initial[col.name] = valueToFormString(initialValues[col.name], col.type);
        } else {
          initial[col.name] = col.defaultValue || "";
        }
      }
    });
    return initial;
  });

  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (initialValues) {
      columns.forEach((col) => {
        if (initialValues[col.name] === null) {
          initial[col.name] = true;
        }
      });
    }
    return initial;
  });

  // Reset form when panel opens or initialValues change
  useEffect(() => {
    if (open) {
      const newValues: Record<string, string> = {};
      const newNullFlags: Record<string, boolean> = {};

      columns.forEach((col) => {
        if (!col.isAutoIncrement && !col.isGenerated) {
          if (initialValues && col.name in initialValues) {
            const val = initialValues[col.name];
            if (val === null) {
              newValues[col.name] = "";
              newNullFlags[col.name] = true;
            } else {
              newValues[col.name] = valueToFormString(val, col.type);
            }
          } else {
            newValues[col.name] = col.defaultValue || "";
          }
        }
      });

      setFormValues(newValues);
      setNullFlags(newNullFlags);
    }
  }, [open, initialValues, columns]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Get insertable columns
  const insertableColumns = columns.filter((col) => !col.isAutoIncrement && !col.isGenerated);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const values: Record<string, unknown> = {};
    const errors: string[] = [];

    insertableColumns.forEach((col) => {
      const rawValue = formValues[col.name] || "";

      // Check if explicitly set to NULL
      if (nullFlags[col.name]) {
        values[col.name] = null;
        return;
      }

      // Parse based on type
      if (rawValue === "" && col.nullable) {
        values[col.name] = null;
      } else if (col.type === "boolean") {
        values[col.name] = rawValue === "true" || rawValue === "1" || rawValue === "t";
      } else if (
        col.type === "integer" ||
        col.type === "bigint" ||
        col.type === "smallint"
      ) {
        if (rawValue === "") {
          values[col.name] = null;
        } else {
          const parsed = parseInt(rawValue.trim(), 10);
          if (isNaN(parsed) || rawValue.trim() !== String(parsed)) {
            errors.push(`${col.name}: Invalid integer value "${rawValue}"`);
            return;
          }
          values[col.name] = parsed;
        }
      } else if (
        col.type === "numeric" ||
        col.type === "decimal" ||
        col.type === "real" ||
        col.type === "double precision"
      ) {
        if (rawValue === "") {
          values[col.name] = null;
        } else {
          const trimmed = rawValue.trim();
          const parsed = parseFloat(trimmed);
          if (isNaN(parsed)) {
            errors.push(`${col.name}: Invalid numeric value "${rawValue}"`);
            return;
          }
          if (col.type === "numeric" || col.type === "decimal") {
            values[col.name] = trimmed;
          } else {
            values[col.name] = parsed;
          }
        }
      } else if (col.type === "json" || col.type === "jsonb") {
        if (rawValue === "") {
          values[col.name] = null;
        } else {
          try {
            values[col.name] = JSON.parse(rawValue);
          } catch (err) {
            errors.push(`${col.name}: Invalid JSON - ${err instanceof Error ? err.message : 'parse error'}`);
            return;
          }
        }
      } else {
        values[col.name] = rawValue === "" ? null : rawValue;
      }
    });

    if (errors.length > 0) {
      alert('Validation errors:\n\n' + errors.join('\n'));
      return;
    }

    onInsert(values);
  };

  const handleValueChange = (columnName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [columnName]: value }));
    if (nullFlags[columnName]) {
      setNullFlags((prev) => {
        const next = { ...prev };
        delete next[columnName];
        return next;
      });
    }
  };

  const toggleNull = (columnName: string) => {
    setNullFlags((prev) => ({
      ...prev,
      [columnName]: !prev[columnName]
    }));
  };

  const generateUuid = (columnName: string) => {
    const uuid = crypto.randomUUID();
    handleValueChange(columnName, uuid);
  };

  const setCurrentDateTime = (columnName: string, colType: string) => {
    const now = new Date();
    let formattedValue = '';

    // Format based on column type in PostgreSQL now() format
    const lowerType = colType.toLowerCase();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

    // Check for timestamp first (timestamp, timestamptz, datetime)
    if (lowerType.includes('stamp') || (lowerType.includes('date') && lowerType.includes('time'))) {
      // PostgreSQL now() format: YYYY-MM-DD HH:MM:SS.mmm
      formattedValue = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    } else if (lowerType.includes('time')) {
      // time, timetz - with milliseconds
      formattedValue = `${hours}:${minutes}:${seconds}.${milliseconds}`;
    } else if (lowerType.includes('date')) {
      // date - just date
      formattedValue = `${year}-${month}-${day}`;
    }

    handleValueChange(columnName, formattedValue);
  };

  if (!open) return null;

  // Form content component (shared between inline and overlay modes)
  const formContent = (
    <>
      {/* Description */}
      <div className="px-4 py-2 text-xs text-vscode-text-muted border-b border-vscode-border">
        Fields marked with <span className="text-vscode-error">*</span> are required.
      </div>

      {/* Error Display */}
      {insertError && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-vscode-error/10 border border-vscode-error/30 text-vscode-error">
          <div className="flex items-start gap-2">
            <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium">Failed to insert row</p>
              <p className="text-xs mt-1 opacity-90">{insertError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form Content - Scrollable */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
          {insertableColumns.map((col) => (
            <div key={col.name} className="space-y-1">
              <label
                htmlFor={`field-${col.name}`}
                className="text-xs font-medium text-vscode-text flex items-center gap-1.5"
              >
                <span>
                  {col.name}
                  {!col.nullable && <span className="text-vscode-error">*</span>}
                </span>
                <span className="text-2xs text-vscode-text-muted font-normal">
                  {col.type}
                </span>
                {col.nullable && (
                  <button
                    type="button"
                    onClick={() => toggleNull(col.name)}
                    className={clsx(
                      "ml-auto text-2xs px-1.5 py-0.5 rounded transition-colors",
                      nullFlags[col.name]
                        ? "bg-vscode-warning/20 text-vscode-warning"
                        : "bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text-muted"
                    )}
                    title="Set this field to NULL"
                  >
                    {nullFlags[col.name] ? "NULL" : "NULL?"}
                  </button>
                )}
              </label>

              {col.type === "boolean" ? (
                <select
                  id={`field-${col.name}`}
                  value={formValues[col.name] || ""}
                  onChange={(e) => handleValueChange(col.name, e.target.value)}
                  disabled={nullFlags[col.name]}
                  className="w-full px-2 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  required={!col.nullable && !nullFlags[col.name]}
                >
                  <option value="">Select...</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : col.type === "text" || col.type.includes("char") ? (
                <textarea
                  id={`field-${col.name}`}
                  value={formValues[col.name] || ""}
                  onChange={(e) => handleValueChange(col.name, e.target.value)}
                  disabled={nullFlags[col.name]}
                  rows={2}
                  maxLength={col.maxLength || undefined}
                  className="w-full px-2 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                  required={!col.nullable && !nullFlags[col.name]}
                  placeholder={col.defaultValue || undefined}
                />
              ) : col.type === "json" || col.type === "jsonb" ? (
                <textarea
                  id={`field-${col.name}`}
                  value={formValues[col.name] || ""}
                  onChange={(e) => handleValueChange(col.name, e.target.value)}
                  disabled={nullFlags[col.name]}
                  rows={3}
                  className="w-full px-2 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                  required={!col.nullable && !nullFlags[col.name]}
                  placeholder='{"key": "value"}'
                />
              ) : col.type === "uuid" ? (
                <div className="flex gap-1.5">
                  <input
                    id={`field-${col.name}`}
                    type="text"
                    value={formValues[col.name] || ""}
                    onChange={(e) => handleValueChange(col.name, e.target.value)}
                    disabled={nullFlags[col.name]}
                    className="flex-1 px-2 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    required={!col.nullable && !nullFlags[col.name]}
                    placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => generateUuid(col.name)}
                    disabled={nullFlags[col.name]}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-2xs font-medium rounded bg-vscode-accent/10 hover:bg-vscode-accent/20 text-vscode-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate new UUID"
                  >
                    <Sparkles className="h-3 w-3" />
                  </button>
                </div>
              ) : col.type.toLowerCase().includes("date") || col.type.toLowerCase().includes("time") || col.type.toLowerCase().includes("stamp") ? (
                <div className="flex gap-1.5">
                  <input
                    id={`field-${col.name}`}
                    type="text"
                    value={formValues[col.name] || ""}
                    onChange={(e) => handleValueChange(col.name, e.target.value)}
                    disabled={nullFlags[col.name]}
                    className="flex-1 px-2 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    required={!col.nullable && !nullFlags[col.name]}
                    placeholder={col.defaultValue || "YYYY-MM-DD HH:MM:SS"}
                  />
                  <button
                    type="button"
                    onClick={() => setCurrentDateTime(col.name, col.type)}
                    disabled={nullFlags[col.name]}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-2xs font-medium rounded bg-vscode-accent/10 hover:bg-vscode-accent/20 text-vscode-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Set to current date/time"
                  >
                    <Clock className="h-3 w-3" />
                    Now
                  </button>
                </div>
              ) : (
                <input
                  id={`field-${col.name}`}
                  type={
                    col.type.includes("int") || col.type.includes("numeric")
                      ? "number"
                      : "text"
                  }
                  value={formValues[col.name] || ""}
                  onChange={(e) => handleValueChange(col.name, e.target.value)}
                  disabled={nullFlags[col.name]}
                  step={col.type.includes("numeric") || col.type.includes("decimal") ? "any" : undefined}
                  maxLength={col.maxLength || undefined}
                  className="w-full px-2 py-1.5 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  required={!col.nullable && !nullFlags[col.name]}
                  placeholder={col.defaultValue || undefined}
                />
              )}

              {col.maxLength && (
                <p className="text-2xs text-vscode-text-muted">
                  Max: {col.maxLength}
                </p>
              )}
            </div>
          ))}
      </form>
    </>
  );

  // Footer component (shared between modes)
  const footerContent = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="px-3 py-1.5 text-xs font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isInserting}
        onClick={handleSubmit}
        className={clsx(
          "px-3 py-1.5 text-xs font-medium rounded bg-vscode-accent hover:bg-vscode-accent/90 text-white transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {isInserting ? 'Inserting...' : 'Insert Row'}
      </button>
    </div>
  );

  // Inline mode - use SidePanel wrapper
  if (variant === "inline") {
    return (
      <SidePanel
        title={initialValues ? 'Duplicate Row' : 'Insert New Row'}
        icon={<Plus className="h-4 w-4" />}
        onClose={() => onOpenChange(false)}
        footer={footerContent}
      >
        {formContent}
      </SidePanel>
    );
  }

  // Overlay mode - original fixed positioning with backdrop
  return (
    <>
      {/* Backdrop - subtle overlay */}
      <div
        className="absolute inset-0 bg-black/20 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        className={clsx(
          "absolute top-0 right-0 h-full w-[380px] max-w-[90%] z-50",
          "bg-vscode-bg-light border-l border-vscode-border shadow-xl",
          "flex flex-col",
          "animate-in slide-in-from-right duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-vscode-bg-lighter">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-vscode-accent" />
            <h2 className="text-sm font-semibold text-vscode-text-bright">
              {initialValues ? 'Duplicate Row' : 'Insert New Row'}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Close panel"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {formContent}

        {/* Footer - Fixed at bottom */}
        <div className="px-4 py-3 border-t border-vscode-border bg-vscode-bg-lighter">
          {footerContent}
        </div>
      </div>
    </>
  );
};
