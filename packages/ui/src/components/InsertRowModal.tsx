import { useState, useEffect, type FC } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ColumnMetadata } from "@dbview/types";
import { X, Sparkles } from "lucide-react";
import clsx from "clsx";

export interface InsertRowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnMetadata[];
  onInsert: (values: Record<string, unknown>) => void;
  initialValues?: Record<string, unknown>;
  isInserting?: boolean;
  insertError?: string | null;
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
    // Escape array elements: quote strings with special chars, escape quotes and backslashes
    const escaped = val.map(item => {
      if (item === null) return 'NULL';
      const str = String(item);
      // If contains comma, quotes, backslash, or whitespace, needs quoting
      if (/[,"\\\s{}]/.test(str)) {
        // Escape backslashes and quotes
        const escapedStr = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${escapedStr}"`;
      }
      return str;
    });
    return `{${escaped.join(',')}}`;
  }

  // Date/Timestamp columns - convert to ISO format for datetime-local input
  if (val instanceof Date) {
    // Format: YYYY-MM-DDTHH:mm (for datetime-local input)
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    const hours = String(val.getHours()).padStart(2, '0');
    const minutes = String(val.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Boolean
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  // Everything else as string
  return String(val);
};

export const InsertRowModal: FC<InsertRowModalProps> = ({
  open,
  onOpenChange,
  columns,
  onInsert,
  initialValues,
  isInserting = false,
  insertError = null
}) => {
  // Initialize form values
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    columns.forEach((col) => {
      if (!col.isAutoIncrement && !col.isGenerated) {
        // Use initialValues if provided, otherwise use default
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

  // Reset form when modal opens or initialValues change
  useEffect(() => {
    if (open) {
      console.log('[InsertRowModal] ========== MODAL OPENED ==========');
      console.log('[InsertRowModal] Initial values provided:', initialValues);
      console.log('[InsertRowModal] Total columns:', columns.length);

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
            console.log(`  - ${col.name}: ${val} (from initialValues)`);
          } else {
            newValues[col.name] = col.defaultValue || "";
            console.log(`  - ${col.name}: ${col.defaultValue || ""} (default)`);
          }
        } else {
          const reason = col.isAutoIncrement ? 'auto-increment' : 'generated';
          console.log(`  - ${col.name}: SKIPPED (${reason})`);
        }
      });

      console.log('[InsertRowModal] Form initialized with values:', newValues);
      console.log('[InsertRowModal] NULL flags:', newNullFlags);

      setFormValues(newValues);
      setNullFlags(newNullFlags);
    }
  }, [open, initialValues, columns]);

  // Get insertable columns (exclude auto-increment and generated columns)
  const insertableColumns = columns.filter((col) => !col.isAutoIncrement && !col.isGenerated);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log('[InsertRowModal] ========== FORM SUBMITTED ==========');
    console.log('[InsertRowModal] handleSubmit called - event:', e.type);
    console.log('[InsertRowModal] ========== VALIDATION STARTED ==========');
    console.log('[InsertRowModal] Form values:', formValues);
    console.log('[InsertRowModal] Null flags:', nullFlags);
    console.log('[InsertRowModal] Initial values:', initialValues);
    console.log('[InsertRowModal] Total insertable columns:', insertableColumns.length);

    const values: Record<string, unknown> = {};
    const errors: string[] = [];
    const validationLog: Array<{column: string, type: string, rawValue: string, parsedValue: unknown, status: string}> = [];

    insertableColumns.forEach((col) => {
      const rawValue = formValues[col.name] || "";
      let parsedValue: unknown;
      let status = 'success';

      console.log(`[InsertRowModal] Processing column: ${col.name} (${col.type})`);
      console.log(`  - Nullable: ${col.nullable}`);
      console.log(`  - Is NULL flag set: ${!!nullFlags[col.name]}`);
      console.log(`  - Raw value: "${rawValue}"`);

      // Check if explicitly set to NULL
      if (nullFlags[col.name]) {
        parsedValue = null;
        values[col.name] = null;
        console.log(`  ✓ Set to NULL (explicit NULL flag)`);
        validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status: 'null_flag'});
        return;
      }

      // Parse based on type
      if (rawValue === "" && col.nullable) {
        parsedValue = null;
        values[col.name] = null;
        console.log(`  ✓ Set to NULL (empty & nullable)`);
        validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status: 'empty_nullable'});
      } else if (col.type === "boolean") {
        parsedValue = rawValue === "true" || rawValue === "1" || rawValue === "t";
        values[col.name] = parsedValue;
        console.log(`  ✓ Parsed as boolean: ${parsedValue}`);
        validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status});
      } else if (
        col.type === "integer" ||
        col.type === "bigint" ||
        col.type === "smallint"
      ) {
        if (rawValue === "") {
          parsedValue = null;
          values[col.name] = null;
          console.log(`  ✓ Set to NULL (empty integer field)`);
          validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status: 'empty'});
        } else {
          const parsed = parseInt(rawValue.trim(), 10);
          if (isNaN(parsed) || rawValue.trim() !== String(parsed)) {
            status = 'error';
            const errorMsg = `${col.name}: Invalid integer value "${rawValue}"`;
            errors.push(errorMsg);
            console.log(`  ✗ VALIDATION FAILED: ${errorMsg}`);
            validationLog.push({column: col.name, type: col.type, rawValue, parsedValue: undefined, status});
            return;
          }
          parsedValue = parsed;
          values[col.name] = parsed;
          console.log(`  ✓ Parsed as integer: ${parsed}`);
          validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status});
        }
      } else if (
        col.type === "numeric" ||
        col.type === "decimal" ||
        col.type === "real" ||
        col.type === "double precision"
      ) {
        if (rawValue === "") {
          parsedValue = null;
          values[col.name] = null;
          console.log(`  ✓ Set to NULL (empty numeric field)`);
          validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status: 'empty'});
        } else {
          const trimmed = rawValue.trim();
          // Validate numeric format but keep as string to preserve precision
          const parsed = parseFloat(trimmed);
          if (isNaN(parsed)) {
            status = 'error';
            const errorMsg = `${col.name}: Invalid numeric value "${rawValue}"`;
            errors.push(errorMsg);
            console.log(`  ✗ VALIDATION FAILED: ${errorMsg}`);
            validationLog.push({column: col.name, type: col.type, rawValue, parsedValue: undefined, status});
            return;
          }
          // For NUMERIC/DECIMAL, keep as string to preserve precision
          // For REAL/DOUBLE, use number for proper handling
          if (col.type === "numeric" || col.type === "decimal") {
            parsedValue = trimmed;  // Keep as string to preserve precision
            values[col.name] = trimmed;
            console.log(`  ✓ Parsed as numeric string (preserving precision): "${trimmed}"`);
          } else {
            parsedValue = parsed;
            values[col.name] = parsed;
            console.log(`  ✓ Parsed as floating point: ${parsed}`);
          }
          validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status});
        }
      } else if (col.type === "json" || col.type === "jsonb") {
        if (rawValue === "") {
          parsedValue = null;
          values[col.name] = null;
          console.log(`  ✓ Set to NULL (empty JSON field)`);
          validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status: 'empty'});
        } else {
          try {
            parsedValue = JSON.parse(rawValue);
            values[col.name] = parsedValue;
            console.log(`  ✓ Parsed as JSON:`, parsedValue);
            validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status});
          } catch (err) {
            status = 'error';
            const errorMsg = `${col.name}: Invalid JSON - ${err instanceof Error ? err.message : 'parse error'}`;
            errors.push(errorMsg);
            console.log(`  ✗ VALIDATION FAILED: ${errorMsg}`);
            validationLog.push({column: col.name, type: col.type, rawValue, parsedValue: undefined, status});
            return;
          }
        }
      } else {
        parsedValue = rawValue === "" ? null : rawValue;
        values[col.name] = parsedValue;
        console.log(`  ✓ Parsed as string: "${parsedValue}"`);
        validationLog.push({column: col.name, type: col.type, rawValue, parsedValue, status});
      }
    });

    console.log('[InsertRowModal] ========== VALIDATION SUMMARY ==========');
    console.table(validationLog);
    console.log('[InsertRowModal] Total errors:', errors.length);
    console.log('[InsertRowModal] Validation passed:', errors.length === 0);

    // Show validation errors
    if (errors.length > 0) {
      console.error('[InsertRowModal] ========== VALIDATION FAILED ==========');
      console.error('[InsertRowModal] Errors:', errors);
      alert('Validation errors:\n\n' + errors.join('\n'));
      return;
    }

    console.log('[InsertRowModal] ========== VALIDATION SUCCESSFUL ==========');
    console.log('[InsertRowModal] Final values to insert:', values);
    console.log('[InsertRowModal] Calling onInsert with values:', JSON.stringify(values, null, 2));

    onInsert(values);

    console.log('[InsertRowModal] onInsert called, waiting for backend response...');
    // Don't close modal here - wait for INSERT_SUCCESS/INSERT_ERROR message
  };

  const handleValueChange = (columnName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [columnName]: value }));
    // Clear NULL flag when user types
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
    // Generate UUID v4
    const uuid = crypto.randomUUID();
    handleValueChange(columnName, uuid);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg border border-vscode-border bg-vscode-bg-light p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-vscode-text-bright">
              Insert New Row
            </Dialog.Title>
            <Dialog.Close className="rounded-sm opacity-70 ring-offset-vscode-bg transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-vscode-accent focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-vscode-text-muted mb-6">
            Fill in the values for the new row. Fields marked with * are required.
          </Dialog.Description>

          {/* Error Display */}
          {insertError && (
            <div className="mb-4 p-3 rounded-lg bg-vscode-error/10 border border-vscode-error/30 text-vscode-error">
              <div className="flex items-start gap-2">
                <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Failed to insert row</p>
                  <p className="text-xs mt-1 opacity-90">{insertError}</p>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            onInvalid={(e) => {
              console.log('[InsertRowModal] ========== HTML5 VALIDATION FAILED ==========');
              console.log('[InsertRowModal] Invalid field:', (e.target as HTMLInputElement).name || (e.target as HTMLInputElement).id);
              console.log('[InsertRowModal] Validation message:', (e.target as HTMLInputElement).validationMessage);
              console.log('[InsertRowModal] Field value:', (e.target as HTMLInputElement).value);
            }}
            className="space-y-4"
          >
            {insertableColumns.map((col) => (
              <div key={col.name} className="space-y-1.5">
                <label
                  htmlFor={`field-${col.name}`}
                  className="text-sm font-medium text-vscode-text flex items-center gap-2"
                >
                  <span>
                    {col.name}
                    {!col.nullable && <span className="text-red-500">*</span>}
                  </span>
                  <span className="text-xs text-vscode-text-muted font-normal">
                    ({col.type})
                  </span>
                  {col.nullable && (
                    <button
                      type="button"
                      onClick={() => toggleNull(col.name)}
                      className={clsx(
                        "ml-auto text-xs px-2 py-0.5 rounded transition-colors",
                        nullFlags[col.name]
                          ? "bg-vscode-warning/20 text-vscode-warning"
                          : "bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text-muted"
                      )}
                      title="Set this field to NULL"
                    >
                      {nullFlags[col.name] ? "NULL" : "Set NULL"}
                    </button>
                  )}
                  {!col.nullable && (
                    <span className="ml-auto text-xs text-vscode-text-muted" title="This field cannot be NULL">
                      Required
                    </span>
                  )}
                </label>

                {col.type === "boolean" ? (
                  <select
                    id={`field-${col.name}`}
                    value={formValues[col.name] || ""}
                    onChange={(e) => handleValueChange(col.name, e.target.value)}
                    disabled={nullFlags[col.name]}
                    className="w-full px-3 py-2 text-sm bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-2 focus:ring-vscode-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
                    rows={3}
                    maxLength={col.maxLength || undefined}
                    className="w-full px-3 py-2 text-sm bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-2 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                    required={!col.nullable && !nullFlags[col.name]}
                    placeholder={col.defaultValue || undefined}
                  />
                ) : col.type === "json" || col.type === "jsonb" ? (
                  <textarea
                    id={`field-${col.name}`}
                    value={formValues[col.name] || ""}
                    onChange={(e) => handleValueChange(col.name, e.target.value)}
                    disabled={nullFlags[col.name]}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-2 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                    required={!col.nullable && !nullFlags[col.name]}
                    placeholder='{"key": "value"}'
                  />
                ) : col.type === "uuid" ? (
                  <div className="flex gap-2">
                    <input
                      id={`field-${col.name}`}
                      type="text"
                      value={formValues[col.name] || ""}
                      onChange={(e) => handleValueChange(col.name, e.target.value)}
                      disabled={nullFlags[col.name]}
                      className="flex-1 px-3 py-2 text-sm bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-2 focus:ring-vscode-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      required={!col.nullable && !nullFlags[col.name]}
                      placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => generateUuid(col.name)}
                      disabled={nullFlags[col.name]}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded bg-vscode-accent/10 hover:bg-vscode-accent/20 text-vscode-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate new UUID"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Generate</span>
                    </button>
                  </div>
                ) : (
                  <input
                    id={`field-${col.name}`}
                    type={
                      col.type.includes("int") || col.type.includes("numeric")
                        ? "number"
                        : col.type.includes("date") || col.type.includes("time")
                        ? "datetime-local"
                        : "text"
                    }
                    value={formValues[col.name] || ""}
                    onChange={(e) => handleValueChange(col.name, e.target.value)}
                    disabled={nullFlags[col.name]}
                    step={col.type.includes("numeric") || col.type.includes("decimal") ? "any" : undefined}
                    maxLength={col.maxLength || undefined}
                    className="w-full px-3 py-2 text-sm bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-2 focus:ring-vscode-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    required={!col.nullable && !nullFlags[col.name]}
                    placeholder={col.defaultValue || undefined}
                  />
                )}

                {col.maxLength && (
                  <p className="text-xs text-vscode-text-muted">
                    Max length: {col.maxLength}
                  </p>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t border-vscode-border">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isInserting}
                onClick={() => {
                  console.log('[InsertRowModal] ========== INSERT BUTTON CLICKED ==========');
                  console.log('[InsertRowModal] Button clicked, form should submit...');
                }}
                className={clsx(
                  "px-4 py-2 text-sm font-medium rounded bg-vscode-accent hover:bg-vscode-accent/90 text-white transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isInserting ? 'Inserting...' : 'Insert Row'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
