import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Plus, Trash2, Info, Save, X, Check, Copy, ArrowUp, ArrowDown, ArrowUpDown, Download, Upload, Lock, Bookmark } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import type { ColumnMetadata, FilterCondition } from "@dbview/types";
import { FilterBuilder } from "./FilterBuilder";
import { FilterChips } from "./FilterChips";
import { TableMetadataPanel } from "./TableMetadataPanel";
import { ExportDataDialog, type ExportOptions } from "./ExportDataDialog";
import { ImportDataDialog } from "./ImportDataDialog";
import { ScrollProgressBar } from "./ScrollProgressBar";
import { ScrollButtons } from "./ScrollButtons";
import { JumpToRowDialog } from "./JumpToRowDialog";
import { FilterPresets } from "./FilterPresets";
import { SavedViewsPanel } from "./SavedViewsPanel";
import { DateTimePopover } from "../editors/DateTimePopover";
import { JSONEditor } from "../editors/JSONEditor";
import { formatAsCSV, formatAsJSON, formatAsSQL } from "@/utils/exportFormatters";
import { parseCSV, parseJSON } from "@/utils/importParsers";

interface TableViewProps {
  connectionKey: string;
  schema: string;
  table: string;
}

interface EditingCell {
  rowIndex: number;
  column: string;
  value: string;
}

interface PendingEdit {
  rowIndex: number;
  column: string;
  originalValue: unknown;
  newValue: string;
}

export function TableView({ connectionKey, schema, table }: TableViewProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [metadata, setMetadata] = useState<ColumnMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(new Map());
  // Undo stack for cell edits (stores cell keys in order of editing)
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [insertingRow, setInsertingRow] = useState<Record<string, string> | null>(null);
  const [insertingRowNullColumns, setInsertingRowNullColumns] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterLogic, setFilterLogic] = useState<"AND" | "OR">("AND");
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Virtual scrolling state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 0 });
  const [showJumpToRowDialog, setShowJumpToRowDialog] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Saved views state
  const [showSavedViewsPanel, setShowSavedViewsPanel] = useState(false);

  // MongoDB document editor state for insert/clone
  const [documentEditor, setDocumentEditor] = useState<{
    open: boolean;
    value: string;
    isClone?: boolean;
  } | null>(null);

  // Column widths state (persisted per table)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const storageKey = `dbview-col-widths-${schema}-${table}`;
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Persist column widths
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      try {
        const storageKey = `dbview-col-widths-${schema}-${table}`;
        localStorage.setItem(storageKey, JSON.stringify(columnWidths));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [columnWidths, schema, table]);

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[column] || 150;
  }, [columnWidths]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(60, resizeStartWidth.current + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingColumn]);

  // Advanced type editor state
  const [dateTimeEditor, setDateTimeEditor] = useState<{
    open: boolean;
    rowIndex: number;
    column: string;
    value: string;
    columnType: string;
    anchorRect: DOMRect | null;
  } | null>(null);

  const [jsonEditor, setJsonEditor] = useState<{
    open: boolean;
    rowIndex: number;
    column: string;
    value: string;
    columnType: string;
  } | null>(null);

  const api = getElectronAPI();

  // Fetch connection config to check read-only status
  useEffect(() => {
    const fetchConnectionConfig = async () => {
      if (!api) return;
      try {
        const connections = await api.getConnections();
        const connection = connections.find((c) => {
          const key = c.config.name
            ? `${c.config.dbType}:${c.config.name}`
            : (c.config as any).host
            ? `${c.config.dbType}:${(c.config as any).user}@${(c.config as any).host}:${(c.config as any).port}/${(c.config as any).database}`
            : `${c.config.dbType}:${JSON.stringify(c.config)}`;
          return key === connectionKey;
        });
        if (connection?.config && 'readOnly' in connection.config) {
          setIsReadOnly(Boolean(connection.config.readOnly));
        }
      } catch (error) {
        console.error("Failed to fetch connection config:", error);
      }
    };
    fetchConnectionConfig();
  }, [api, connectionKey]);

  const loadData = useCallback(async () => {
    if (!api) {
      toast.error("Electron API not available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // First load metadata to get primary key columns
      const metadataResult = await api.getTableMetadata({
        connectionKey,
        schema,
        table,
      });

      // Get primary key columns for stable ordering
      const pkColumns = metadataResult
        .filter((col) => col.isPrimaryKey)
        .map((col) => col.name);

      // Load rows and count in parallel with ORDER BY on primary key
      const [rowsResult, count] = await Promise.all([
        api.loadTableRows({
          connectionKey,
          schema,
          table,
          limit,
          offset,
          filters: filters.length > 0 ? filters : undefined,
          filterLogic: filters.length > 0 ? filterLogic : undefined,
          orderBy: !sortColumn && pkColumns.length > 0 ? pkColumns : undefined,
          sortColumn: sortColumn || undefined,
          sortDirection: sortColumn ? sortDirection : undefined,
        }),
        api.getRowCount({
          connectionKey,
          schema,
          table,
          filters: filters.length > 0 ? filters : undefined,
          filterLogic: filters.length > 0 ? filterLogic : undefined,
        }),
      ]);

      setMetadata(metadataResult);
      setColumns(rowsResult.columns);
      setRows(rowsResult.rows);
      setTotalRows(count);
    } catch (err) {
      console.error("Failed to load table data:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load table data");
      // Set empty data on error so UI still renders
      setRows([]);
      setColumns([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, schema, table, limit, offset, filters, filterLogic, sortColumn, sortDirection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get primary key columns
  const getPrimaryKeyColumns = useCallback((): string[] => {
    return metadata.filter((col) => col.isPrimaryKey).map((col) => col.name);
  }, [metadata]);

  // Get primary key value for a row
  const getPrimaryKeyValue = useCallback(
    (row: Record<string, unknown>): Record<string, unknown> => {
      const pkColumns = getPrimaryKeyColumns();
      const pkValue: Record<string, unknown> = {};
      pkColumns.forEach((col) => {
        pkValue[col] = row[col];
      });
      return pkValue;
    },
    [getPrimaryKeyColumns]
  );

  // Handle cell update - now tracks pending edits instead of immediately saving
  const handleCellUpdate = useCallback(
    (rowIndex: number, column: string, newValue: string) => {
      const row = rows[rowIndex];
      const originalValue = row[column];

      // Check if we have a primary key
      const pkColumns = getPrimaryKeyColumns();
      if (pkColumns.length === 0) {
        toast.error("Cannot edit: Table has no primary key");
        return;
      }

      // Don't track if value hasn't changed
      const formattedOriginal = formatCellValueForEdit(originalValue);
      if (newValue === formattedOriginal) {
        return;
      }

      // Validate the new value based on column type
      const colMetadata = metadata.find((m) => m.name === column);
      if (colMetadata) {
        // Handle NULL values
        if (newValue.toUpperCase() !== "NULL") {
          // Type validation
          const type = colMetadata.type.toLowerCase();
          if (type.includes("int") || type.includes("serial")) {
            const parsed = parseInt(newValue, 10);
            if (isNaN(parsed)) {
              toast.error(`Invalid integer value for column ${column}`);
              return;
            }
          } else if (type.includes("float") || type.includes("double") || type.includes("decimal") || type.includes("numeric")) {
            const parsed = parseFloat(newValue);
            if (isNaN(parsed)) {
              toast.error(`Invalid number value for column ${column}`);
              return;
            }
          } else if (type.includes("bool")) {
            const lowerValue = newValue.toLowerCase();
            if (!["true", "false", "1", "0", "yes", "no"].includes(lowerValue)) {
              toast.error(`Invalid boolean value for column ${column}`);
              return;
            }
          } else if (type.includes("json") || type.includes("jsonb")) {
            try {
              JSON.parse(newValue);
            } catch (e) {
              toast.error(`Invalid JSON value for column ${column}`);
              return;
            }
          }
        }
      }

      // Track the pending edit
      const cellKey = `${rowIndex}-${column}`;
      const pendingEdit: PendingEdit = {
        rowIndex,
        column,
        originalValue,
        newValue,
      };

      setPendingEdits((prev) => new Map(prev).set(cellKey, pendingEdit));
      // Add to undo stack (only if not already the most recent)
      setUndoStack((prev) => {
        const filtered = prev.filter((k) => k !== cellKey);
        return [...filtered, cellKey];
      });
      toast.success("Change tracked", { description: "Click Save to commit changes, Ctrl+Z to undo" });
    },
    [rows, metadata, getPrimaryKeyColumns]
  );

  // Undo last cell edit
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      toast.info("Nothing to undo");
      return;
    }

    const lastCellKey = undoStack[undoStack.length - 1];

    // Remove from pending edits
    setPendingEdits((prev) => {
      const newMap = new Map(prev);
      newMap.delete(lastCellKey);
      return newMap;
    });

    // Remove from undo stack
    setUndoStack((prev) => prev.slice(0, -1));

    toast.success("Undo successful", { description: "Last change reverted" });
  }, [undoStack]);

  // Detect if this is a MongoDB connection
  const isMongoDB = connectionKey.startsWith("mongodb:");

  // Handle cell double-click
  const handleCellDoubleClick = useCallback((
    event: React.MouseEvent<HTMLTableCellElement>,
    rowIndex: number,
    column: string,
    currentValue: unknown
  ) => {
    if (isReadOnly) {
      toast.error("Read-only connection", { description: "This connection is in read-only mode" });
      return;
    }

    // Get the cell's bounding rect for popover positioning
    const cellRect = event.currentTarget.getBoundingClientRect();

    // Get column metadata to determine the type
    const colMetadata = metadata.find((m) => m.name === column);
    const type = colMetadata?.type.toLowerCase() || "";

    // For MongoDB, show the entire document in JSON editor
    if (isMongoDB) {
      const row = rows[rowIndex];
      // Build the full document, parsing any stringified JSON back to objects
      const fullDocument: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === "object" && parsed !== null) {
              fullDocument[key] = parsed;
              continue;
            }
          } catch {
            // Not JSON, keep as string
          }
        }
        fullDocument[key] = value;
      }
      setJsonEditor({
        open: true,
        rowIndex,
        column: "_document", // Special marker for full document editing
        value: JSON.stringify(fullDocument, null, 2),
        columnType: "MongoDB Document",
      });
      return;
    }

    // For SQL databases, use JSON editor only for json/jsonb types
    const isJsonType = type.includes("json") || type.includes("jsonb");

    if (isJsonType) {
      setJsonEditor({
        open: true,
        rowIndex,
        column,
        value: formatCellValueForEdit(currentValue),
        columnType: colMetadata?.type || "JSON",
      });
      return;
    }

    // Check for date/time types - open DateTime popover anchored to cell
    if (
      type.includes("timestamp") ||
      type.includes("date") ||
      type.includes("time") ||
      type.includes("datetime")
    ) {
      setDateTimeEditor({
        open: true,
        rowIndex,
        column,
        value: formatCellValueForEdit(currentValue),
        columnType: colMetadata?.type || "DateTime",
        anchorRect: cellRect,
      });
      return;
    }

    // Default: use inline editing for other types
    setEditingCell({
      rowIndex,
      column,
      value: formatCellValueForEdit(currentValue),
    });
  }, [isReadOnly, metadata, isMongoDB, rows]);

  // Handle edit commit
  const handleEditCommit = useCallback(() => {
    if (!editingCell) return;

    const { rowIndex, column, value } = editingCell;
    const currentValue = rows[rowIndex][column];
    const formattedCurrent = formatCellValueForEdit(currentValue);

    // Only update if value changed
    if (value !== formattedCurrent) {
      handleCellUpdate(rowIndex, column, value);
    }

    setEditingCell(null);
  }, [editingCell, rows, handleCellUpdate]);

  // Handle edit cancel
  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Handle DateTime editor save
  const handleDateTimeEditorSave = useCallback((value: string) => {
    if (!dateTimeEditor) return;
    const { rowIndex, column } = dateTimeEditor;
    handleCellUpdate(rowIndex, column, value);
    setDateTimeEditor(null);
  }, [dateTimeEditor, handleCellUpdate]);

  // Handle JSON editor save
  const handleJsonEditorSave = useCallback(async (value: string) => {
    if (!jsonEditor || !api) return;
    const { rowIndex, column } = jsonEditor;

    // For MongoDB full document editing
    if (column === "_document" && isMongoDB) {
      try {
        const newDocument = JSON.parse(value);
        if (typeof newDocument !== "object" || newDocument === null || Array.isArray(newDocument)) {
          toast.error("Invalid document: must be a JSON object");
          return;
        }

        const row = rows[rowIndex];
        const _id = row._id;

        if (!_id) {
          toast.error("Cannot update: document has no _id");
          return;
        }

        // Update the entire document by replacing all fields (except _id)
        // We'll update each changed field individually
        const originalDoc: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(row)) {
          if (typeof val === "string") {
            try {
              const parsed = JSON.parse(val);
              if (typeof parsed === "object" && parsed !== null) {
                originalDoc[key] = parsed;
                continue;
              }
            } catch {
              // Not JSON
            }
          }
          originalDoc[key] = val;
        }

        // Find all changed fields and update them
        const changedFields: string[] = [];
        for (const [key, newVal] of Object.entries(newDocument)) {
          if (key === "_id") continue;
          const oldVal = originalDoc[key];
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changedFields.push(key);
            // Update each changed field
            await api.updateCell({
              connectionKey,
              schema,
              table,
              primaryKey: { _id },
              column: key,
              value: newVal,
            });
          }
        }

        // Check for deleted fields (in original but not in new)
        for (const key of Object.keys(originalDoc)) {
          if (key === "_id") continue;
          if (!(key in newDocument)) {
            changedFields.push(key);
            // Set deleted fields to null (or we could use $unset)
            await api.updateCell({
              connectionKey,
              schema,
              table,
              primaryKey: { _id },
              column: key,
              value: null,
            });
          }
        }

        if (changedFields.length > 0) {
          await loadData();
          toast.success(`Updated ${changedFields.length} field(s)`);
        } else {
          toast.info("No changes detected");
        }

        setJsonEditor(null);
      } catch (err) {
        console.error("Failed to update document:", err);
        if (err instanceof SyntaxError) {
          toast.error("Invalid JSON: " + err.message);
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to update document");
        }
      }
      return;
    }

    // For single cell updates (SQL databases or single fields)
    handleCellUpdate(rowIndex, column, value);
    setJsonEditor(null);
  }, [jsonEditor, handleCellUpdate, api, isMongoDB, rows, connectionKey, schema, table, loadData]);

  // Handle MongoDB document editor save (for insert/clone)
  const handleDocumentEditorSave = useCallback(async (jsonValue: string) => {
    if (!api || !documentEditor) return;

    try {
      // Parse the JSON document
      const document = JSON.parse(jsonValue);

      if (typeof document !== "object" || document === null || Array.isArray(document)) {
        toast.error("Invalid document: must be a JSON object");
        return;
      }

      // Remove _id if present (let MongoDB generate it)
      delete document._id;

      // Insert the document
      await api.insertRow({
        connectionKey,
        schema,
        table,
        values: document,
      });

      // Close the editor and reload data
      setDocumentEditor(null);

      // Reset to first page and reload data
      if (offset !== 0) {
        setOffset(0);
      } else {
        await loadData();
      }

      toast.success(documentEditor.isClone ? "Document cloned successfully" : "Document inserted successfully");
    } catch (err) {
      console.error("Failed to insert document:", err);
      if (err instanceof SyntaxError) {
        toast.error("Invalid JSON: " + err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to insert document");
      }
    }
  }, [api, documentEditor, connectionKey, schema, table, offset, loadData]);

  // Save all pending edits
  const handleSaveAllEdits = useCallback(async () => {
    if (!api || pendingEdits.size === 0) return;

    const pkColumns = getPrimaryKeyColumns();
    if (pkColumns.length === 0) {
      toast.error("Cannot save: Table has no primary key");
      return;
    }

    const editsArray = Array.from(pendingEdits.values());
    let successCount = 0;
    let failCount = 0;

    // Process each edit
    for (const edit of editsArray) {
      try {
        const row = rows[edit.rowIndex];
        const primaryKey = getPrimaryKeyValue(row);

        // Convert value based on column type
        const colMetadata = metadata.find((m) => m.name === edit.column);
        let convertedValue: unknown = edit.newValue;

        if (colMetadata) {
          // Handle NULL values
          if (edit.newValue.toUpperCase() === "NULL") {
            convertedValue = null;
          } else {
            // Type conversion based on column type
            const type = colMetadata.type.toLowerCase();
            if (type.includes("int") || type.includes("serial")) {
              convertedValue = parseInt(edit.newValue, 10);
            } else if (type.includes("float") || type.includes("double") || type.includes("decimal") || type.includes("numeric")) {
              convertedValue = parseFloat(edit.newValue);
            } else if (type.includes("bool")) {
              const lowerValue = edit.newValue.toLowerCase();
              if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes") {
                convertedValue = true;
              } else if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no") {
                convertedValue = false;
              }
            } else if (type.includes("json") || type.includes("jsonb")) {
              convertedValue = JSON.parse(edit.newValue);
            }
            // For strings and dates, keep as string (database will handle conversion)
          }
        }

        // Call the API to update the cell
        await api.updateCell({
          connectionKey,
          schema,
          table,
          primaryKey,
          column: edit.column,
          value: convertedValue,
        });

        successCount++;
      } catch (err) {
        console.error(`Failed to update cell ${edit.column} at row ${edit.rowIndex}:`, err);

        // Show detailed error message to user
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Extract the actual constraint violation message if available
        const constraintMatch = errorMessage.match(/violates check constraint "([^"]+)"/);
        const friendlyMessage = constraintMatch
          ? `Invalid value for ${edit.column}: violates constraint "${constraintMatch[1]}"`
          : `Failed to update ${edit.column}: ${errorMessage}`;

        toast.error(friendlyMessage, {
          description: `Row ${edit.rowIndex + 1}, value: "${edit.newValue}"`,
          duration: 5000,
        });

        failCount++;
      }
    }

    // Clear pending edits, undo stack, and reload data
    setPendingEdits(new Map());
    setUndoStack([]);
    await loadData();

    if (failCount === 0) {
      toast.success(`Saved ${successCount} change${successCount === 1 ? "" : "s"} successfully`);
    } else {
      toast.warning(`Saved ${successCount} change${successCount === 1 ? "" : "s"}, ${failCount} failed`);
    }
  }, [api, pendingEdits, rows, metadata, connectionKey, schema, table, getPrimaryKeyColumns, getPrimaryKeyValue, loadData]);

  // Discard all pending edits
  const handleDiscardAllEdits = useCallback(() => {
    setPendingEdits(new Map());
    setUndoStack([]);
    toast.info("All changes discarded");
  }, []);

  // Start inline row insertion
  const handleStartInsert = useCallback(() => {
    // For MongoDB, use the document JSON editor
    if (isMongoDB) {
      // Create a template document with example fields
      const templateDoc: Record<string, unknown> = {};
      metadata.forEach((col) => {
        if (col.name === "_id") return; // Skip _id, MongoDB will auto-generate
        const type = col.type.toLowerCase();
        if (type.includes("string")) templateDoc[col.name] = "";
        else if (type.includes("int") || type.includes("double")) templateDoc[col.name] = 0;
        else if (type.includes("bool")) templateDoc[col.name] = false;
        else if (type.includes("array")) templateDoc[col.name] = [];
        else if (type.includes("object")) templateDoc[col.name] = {};
        else if (type.includes("date")) templateDoc[col.name] = new Date().toISOString();
        else templateDoc[col.name] = null;
      });
      setDocumentEditor({
        open: true,
        value: JSON.stringify(templateDoc, null, 2),
        isClone: false,
      });
      return;
    }

    // For SQL databases, use inline row insertion
    const initialValues: Record<string, string> = {};
    metadata.forEach((col) => {
      const type = col.type.toLowerCase();
      const isAutoIncrement = type.includes("serial") || type.includes("identity");
      const isNonEditable = col.editable === false || col.isGenerated === true;
      // Skip auto-increment, generated, and non-editable columns
      if (!isAutoIncrement && !isNonEditable) {
        initialValues[col.name] = "";
      }
    });
    setInsertingRow(initialValues);
    setInsertingRowNullColumns(new Set());
  }, [metadata, isMongoDB]);

  // Handle inserting row value change
  const handleInsertingRowChange = useCallback((column: string, value: string) => {
    setInsertingRow((prev) => {
      if (!prev) return prev;
      return { ...prev, [column]: value };
    });
  }, []);

  // Toggle NULL for inserting row column
  const handleInsertingRowToggleNull = useCallback((column: string) => {
    setInsertingRowNullColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.add(column);
        // Clear the input value when NULL is checked
        setInsertingRow((prevRow) => {
          if (!prevRow) return prevRow;
          return { ...prevRow, [column]: "" };
        });
      }
      return newSet;
    });
  }, []);

  // Generate UUID for a column
  const handleGenerateUUID = useCallback((column: string) => {
    // Generate a random UUID v4
    const uuid = crypto.randomUUID();
    setInsertingRow((prev) => {
      if (!prev) return prev;
      return { ...prev, [column]: uuid };
    });
    // Uncheck NULL if it was checked
    setInsertingRowNullColumns((prev) => {
      const newSet = new Set(prev);
      newSet.delete(column);
      return newSet;
    });
  }, []);

  // Generate MongoDB ObjectId
  const handleGenerateObjectId = useCallback((column: string) => {
    // Generate a MongoDB ObjectId (24 hex characters)
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const randomValue = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    const objectId = timestamp + machineId + randomValue + counter;

    setInsertingRow((prev) => {
      if (!prev) return prev;
      return { ...prev, [column]: objectId };
    });
    // Uncheck NULL if it was checked
    setInsertingRowNullColumns((prev) => {
      const newSet = new Set(prev);
      newSet.delete(column);
      return newSet;
    });
  }, []);

  // Detect if this is MongoDB or Redis based on metadata
  const isMongoDBOrRedis = useCallback((): { isMongo: boolean; isRedis: boolean } => {
    const hasObjectId = metadata.some(col => col.type.toLowerCase().includes('objectid'));
    const hasKey = metadata.some(col => col.name === '_key');
    return {
      isMongo: hasObjectId || metadata.some(col => col.name === '_id' && col.type === 'ObjectId'),
      isRedis: hasKey
    };
  }, [metadata]);

  // Save the inserting row
  const handleSaveInsertingRow = useCallback(async () => {
    if (!api || !insertingRow) return;

    try {
      const insertValues: Record<string, unknown> = {};

      // Get editable columns - skip auto-increment, generated, and non-editable columns
      const editableColumns = metadata.filter((col) => {
        const type = col.type.toLowerCase();
        const isAutoIncrement = type.includes("serial") || type.includes("identity");
        // Check if column is explicitly marked as non-editable or generated
        const isNonEditable = col.editable === false || col.isGenerated === true;
        return !isAutoIncrement && !isNonEditable;
      });

      for (const col of editableColumns) {
        // Skip if null is selected
        if (insertingRowNullColumns.has(col.name)) {
          insertValues[col.name] = null;
          continue;
        }

        const value = insertingRow[col.name] || "";
        const type = col.type.toLowerCase();

        // Convert based on type
        if (value === "") {
          if (col.nullable) {
            insertValues[col.name] = null;
          } else if (col.defaultValue) {
            // Skip - let database use default
            continue;
          } else {
            toast.error(`${col.name} is required`);
            return;
          }
        } else if (type.includes("int") || type.includes("serial")) {
          const intValue = parseInt(value, 10);
          if (isNaN(intValue)) {
            toast.error(`${col.name} must be an integer`);
            return;
          }
          insertValues[col.name] = intValue;
        } else if (type.includes("float") || type.includes("double") || type.includes("decimal") || type.includes("numeric")) {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            toast.error(`${col.name} must be a number`);
            return;
          }
          insertValues[col.name] = numValue;
        } else if (type.includes("bool")) {
          const lowerValue = value.toLowerCase();
          if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes") {
            insertValues[col.name] = true;
          } else if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no") {
            insertValues[col.name] = false;
          } else {
            toast.error(`${col.name} must be true or false`);
            return;
          }
        } else if (type.includes("json") || type.includes("jsonb")) {
          try {
            insertValues[col.name] = JSON.parse(value);
          } catch (e) {
            toast.error(`${col.name} must be valid JSON`);
            return;
          }
        } else {
          // String or date
          insertValues[col.name] = value;
        }
      }

      await api.insertRow({
        connectionKey,
        schema,
        table,
        values: insertValues,
      });

      // Clear inserting state
      setInsertingRow(null);
      setInsertingRowNullColumns(new Set());

      // Reset to first page and reload data
      if (offset !== 0) {
        setOffset(0); // This will trigger loadData via useEffect
      } else {
        await loadData(); // Already on first page, just reload
      }

      toast.success("Row inserted successfully");
    } catch (err) {
      console.error("Failed to insert row:", err);
      toast.error(err instanceof Error ? err.message : "Failed to insert row");
    }
  }, [api, insertingRow, insertingRowNullColumns, metadata, connectionKey, schema, table, offset, loadData]);

  // Cancel inline row insertion
  const handleCancelInsert = useCallback(() => {
    setInsertingRow(null);
    setInsertingRowNullColumns(new Set());
  }, []);

  // Duplicate selected row
  const handleDuplicateRow = useCallback(() => {
    if (selectedRows.size !== 1) return;

    // Get the selected row index
    const selectedIndex = Array.from(selectedRows)[0];
    const selectedRow = rows[selectedIndex];

    if (!selectedRow) return;

    // For MongoDB, use the document JSON editor with the cloned document
    if (isMongoDB) {
      // Clone the document, removing _id so MongoDB generates a new one
      const clonedDoc: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(selectedRow)) {
        if (key === "_id") continue; // Skip _id for cloning
        // Parse JSON strings back to objects for proper display
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === "object" && parsed !== null) {
              clonedDoc[key] = parsed;
              continue;
            }
          } catch {
            // Not JSON, keep as string
          }
        }
        clonedDoc[key] = value;
      }
      setDocumentEditor({
        open: true,
        value: JSON.stringify(clonedDoc, null, 2),
        isClone: true,
      });
      setSelectedRows(new Set()); // Clear selection
      return;
    }

    // For SQL databases, use inline row insertion
    const duplicatedValues: Record<string, string> = {};
    const nullColumns = new Set<string>();

    metadata.forEach((col) => {
      const type = col.type.toLowerCase();
      const isAutoIncrement = type.includes("serial") || type.includes("identity");
      const isNonEditable = col.editable === false || col.isGenerated === true;

      // Skip auto-increment, generated, and non-editable columns
      if (isAutoIncrement || isNonEditable) {
        return;
      }

      const value = selectedRow[col.name];

      // Handle NULL values
      if (value === null || value === undefined) {
        nullColumns.add(col.name);
        duplicatedValues[col.name] = "";
      } else if (typeof value === "object") {
        // Handle JSON objects
        duplicatedValues[col.name] = JSON.stringify(value);
      } else if (typeof value === "boolean") {
        duplicatedValues[col.name] = value ? "true" : "false";
      } else {
        duplicatedValues[col.name] = String(value);
      }
    });

    setInsertingRow(duplicatedValues);
    setInsertingRowNullColumns(nullColumns);
    setSelectedRows(new Set()); // Clear selection
    toast.info("Row duplicated. Edit and save to insert.");
  }, [selectedRows, rows, metadata, isMongoDB]);

  // Handle row deletion
  const handleDeleteRows = useCallback(async () => {
    if (!api || selectedRows.size === 0) return;

    const pkColumns = getPrimaryKeyColumns();
    if (pkColumns.length === 0) {
      toast.error("Cannot delete: Table has no primary key");
      return;
    }

    if (!confirm(`Delete ${selectedRows.size} row(s)?`)) {
      return;
    }

    try {
      const primaryKeys: Record<string, unknown>[] = [];
      selectedRows.forEach((rowIndex) => {
        const row = rows[rowIndex];
        primaryKeys.push(getPrimaryKeyValue(row));
      });

      await api.deleteRows({
        connectionKey,
        schema,
        table,
        primaryKeys,
      });

      setSelectedRows(new Set());
      await loadData();
      toast.success(`Deleted ${selectedRows.size} row(s)`);
    } catch (err) {
      console.error("Failed to delete rows:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete rows");
    }
  }, [api, selectedRows, rows, connectionKey, schema, table, getPrimaryKeyColumns, getPrimaryKeyValue, loadData]);

  // Handle row selection toggle
  const toggleRowSelection = useCallback((rowIndex: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  }, []);

  // Handle select all toggle
  const toggleSelectAll = useCallback(() => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((_, i) => i)));
    }
  }, [selectedRows.size, rows.length]);

  // Handle filter apply
  const handleFilterApply = useCallback((newFilters: FilterCondition[], logic: "AND" | "OR") => {
    setFilters(newFilters);
    setFilterLogic(logic);
    setOffset(0); // Reset to first page when filters change
  }, []);

  // Handle individual filter removal
  const handleRemoveFilter = useCallback((index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    setOffset(0); // Reset to first page when filters change
  }, [filters]);

  // Handle column sort toggle
  const handleColumnSort = useCallback((column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column, or clear if already DESC
      if (sortDirection === "ASC") {
        setSortDirection("DESC");
      } else {
        // Clear sort (third click)
        setSortColumn(null);
        setSortDirection("ASC");
      }
    } else {
      // New column, start with ASC
      setSortColumn(column);
      setSortDirection("ASC");
    }
    setOffset(0); // Reset to first page when sort changes
  }, [sortColumn, sortDirection]);

  // Handle export
  const handleExport = useCallback(
    async (options: ExportOptions) => {
      if (!api) {
        toast.error("Electron API not available");
        return;
      }

      try {
        // Get rows to export
        let exportRows = rows;

        if (options.selectedRowsOnly && selectedRows.size > 0) {
          exportRows = Array.from(selectedRows).map((idx) => rows[idx]);
        }

        if (exportRows.length === 0) {
          toast.error("No data to export");
          return;
        }

        // Format the data
        let content: string;
        let extension: string;

        switch (options.format) {
          case "csv":
            content = formatAsCSV(exportRows, columns, options.includeHeaders);
            extension = "csv";
            break;
          case "json":
            content = formatAsJSON(exportRows);
            extension = "json";
            break;
          case "sql":
            content = formatAsSQL(exportRows, columns, schema, table);
            extension = "sql";
            break;
          default:
            throw new Error(`Unknown format: ${options.format}`);
        }

        // Save the file using the export:data IPC handler
        const filePath = await api.exportData({
          connectionKey,
          schema,
          table,
          content,
          extension,
        });

        if (filePath) {
          toast.success(`Exported ${exportRows.length} rows to ${filePath}`);
        }
      } catch (err) {
        console.error("Export failed:", err);
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    },
    [api, rows, columns, selectedRows, schema, table, connectionKey]
  );

  // Handle import
  const handleImport = useCallback(
    async (format: "csv" | "json", content: string, hasHeaders?: boolean) => {
      if (!api) {
        toast.error("Electron API not available");
        return;
      }

      try {
        // Parse the file content
        let parsedRows: Record<string, unknown>[];

        if (format === "csv") {
          const result = parseCSV(content, hasHeaders ?? true);
          parsedRows = result.rows;
        } else {
          const result = parseJSON(content);
          parsedRows = result.rows;
        }

        if (parsedRows.length === 0) {
          toast.error("No rows to import");
          return;
        }

        // Import the rows
        const result = await api.importData({
          connectionKey,
          schema,
          table,
          rows: parsedRows,
        });

        if (result.errors && result.errors.length > 0) {
          toast.warning(
            `Imported ${result.insertedCount} rows with ${result.errors.length} errors`,
            { description: result.errors[0] }
          );
        } else {
          toast.success(`Successfully imported ${result.insertedCount} rows`);
        }

        // Reload the data
        await loadData();
        setShowImportDialog(false);
      } catch (err) {
        console.error("Import failed:", err);
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    },
    [api, connectionKey, schema, table, loadData]
  );

  // Store reference to FilterBuilder to open it
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);

  // Row height for scroll calculations
  const ROW_HEIGHT = 36;

  // Handle scroll events for progress bar and visible range
  const handleScroll = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    setScrollProgress(progress);

    // Calculate visible row range (approximate, accounting for header)
    const headerHeight = 40;
    const startRow = Math.floor(Math.max(0, scrollTop - headerHeight) / ROW_HEIGHT);
    const visibleRows = Math.ceil(clientHeight / ROW_HEIGHT);
    const endRow = Math.min(startRow + visibleRows, rows.length);
    setVisibleRowRange({ start: startRow, end: endRow });
  }, [rows.length]);

  // Scroll to top/bottom handlers
  const scrollToTop = useCallback(() => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = tableContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, []);

  // Jump to specific row
  const handleJumpToRow = useCallback((rowIndex: number) => {
    const container = tableContainerRef.current;
    if (container) {
      const headerHeight = 40;
      const targetScrollTop = headerHeight + rowIndex * ROW_HEIGHT;
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }, []);

  // Handle page change from JumpToRowDialog
  const handleChangePage = useCallback((newOffset: number) => {
    setOffset(newOffset);
  }, []);

  // Copy selected rows to clipboard
  const handleCopySelectedRows = useCallback(() => {
    if (selectedRows.size === 0) return;

    const selectedData = Array.from(selectedRows)
      .sort((a, b) => a - b)
      .map(idx => rows[idx]);

    // Format as tab-separated values (TSV) for spreadsheet compatibility
    const headers = columns.join('\t');
    const rowsText = selectedData.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }).join('\t')
    ).join('\n');

    const clipboardText = `${headers}\n${rowsText}`;
    navigator.clipboard.writeText(clipboardText);
    toast.success(`Copied ${selectedRows.size} row${selectedRows.size === 1 ? '' : 's'} to clipboard`);
  }, [selectedRows, rows, columns]);

  // Copy single cell to clipboard
  const handleCopyCellToClipboard = useCallback((rowIndex: number, column: string) => {
    const row = rows[rowIndex];
    const value = row[column];
    let textToCopy: string;

    if (value === null || value === undefined) {
      textToCopy = '';
    } else if (typeof value === 'object') {
      textToCopy = JSON.stringify(value, null, 2);
    } else {
      textToCopy = String(value);
    }

    navigator.clipboard.writeText(textToCopy);
    toast.success('Cell value copied to clipboard');
  }, [rows]);

  // Track focused cell for copy
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; column: string } | null>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if focus is within the table or no specific element is focused
      const container = tableContainerRef.current;
      if (!container) return;

      // Skip if user is typing in an input, textarea, or contenteditable (CodeMirror)
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement)?.isContentEditable;

      // Skip if a modal/dialog is open (check for dialog elements or role="dialog")
      const isModalOpen = document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-state="open"]') !== null;

      // Copy shortcut: Ctrl+C / Cmd+C (when not typing and no modal open)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !isTyping && !isModalOpen) {
        if (selectedRows.size > 0) {
          e.preventDefault();
          handleCopySelectedRows();
          return;
        } else if (focusedCell) {
          e.preventDefault();
          handleCopyCellToClipboard(focusedCell.rowIndex, focusedCell.column);
          return;
        }
      }

      // Undo shortcut: Ctrl+Z / Cmd+Z (when not typing and no modal open)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isTyping && !isModalOpen) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Focus search with "/" key (when not typing and no modal open)
      if (e.key === "/" && !isTyping && !isModalOpen && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Find and focus the search input
        const searchInput = document.querySelector('input[placeholder*="Quick search"]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // Jump to row dialog: Ctrl+G / Cmd+G (when no modal open)
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && !isTyping && !isModalOpen) {
        e.preventDefault();
        setShowJumpToRowDialog(true);
        return;
      }

      // Pagination shortcuts (work globally when not typing and no modal open)
      if ((e.ctrlKey || e.metaKey) && !isTyping && !isModalOpen && totalRows !== null) {
        const totalPages = Math.ceil(totalRows / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        if (e.key === "ArrowLeft" && currentPage > 1) {
          e.preventDefault();
          setOffset(Math.max(0, offset - limit));
          return;
        } else if (e.key === "ArrowRight" && currentPage < totalPages) {
          e.preventDefault();
          setOffset(offset + limit);
          return;
        } else if (e.key === "Home") {
          e.preventDefault();
          setOffset(0);
          return;
        } else if (e.key === "End") {
          e.preventDefault();
          setOffset(Math.floor((totalRows - 1) / limit) * limit);
          return;
        }
      }

      // Only handle scroll Home/End if container has focus or is hovered
      if (!container.contains(activeElement) && activeElement !== container) {
        return;
      }

      if (e.key === "Home" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        scrollToTop();
      } else if (e.key === "End" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        scrollToBottom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scrollToTop, scrollToBottom, totalRows, limit, offset, selectedRows, focusedCell, handleCopySelectedRows, handleCopyCellToClipboard, handleUndo]);

  // Initial scroll handler setup
  useEffect(() => {
    handleScroll();
  }, [handleScroll, rows]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">
            {schema ? `${schema}.${table}` : table}
          </span>
          {isReadOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-xs font-medium">
              <Lock className="w-3 h-3" />
              Read-only
            </span>
          )}
          <span>•</span>
          <span>
            {rows.length} {rows.length === 1 ? "row" : "rows"}
            {totalRows !== null && ` of ${totalRows}`}
          </span>
          {selectedRows.size > 0 && (
            <>
              <span>•</span>
              <span className="text-accent">{selectedRows.size} selected</span>
            </>
          )}
          {pendingEdits.size > 0 && (
            <>
              <span>•</span>
              <span className="text-orange-500 font-medium">
                {pendingEdits.size} pending change{pendingEdits.size === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pendingEdits.size > 0 && (
            <>
              <button
                onClick={handleSaveAllEdits}
                className="px-2 py-1.5 rounded bg-accent hover:bg-accent/90 transition-colors flex items-center gap-1.5 text-sm text-white font-medium"
                title="Save all pending changes"
              >
                <Save className="w-4 h-4" />
                <span>Save ({pendingEdits.size})</span>
              </button>
              <button
                onClick={handleDiscardAllEdits}
                className="p-1.5 rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm text-text-secondary"
                title="Discard all pending changes"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Discard</span>
              </button>
            </>
          )}
          {insertingRow && (
            <>
              <button
                onClick={handleSaveInsertingRow}
                className="px-2 py-1.5 rounded bg-accent hover:bg-accent/90 transition-colors flex items-center gap-1.5 text-sm text-white font-medium"
                title="Save new row"
              >
                <Check className="w-4 h-4" />
                <span>Save Row</span>
              </button>
              <button
                onClick={handleCancelInsert}
                className="p-1.5 rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm text-text-secondary"
                title="Cancel insert"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
            </>
          )}
          <button
            onClick={handleStartInsert}
            disabled={insertingRow !== null || isReadOnly}
            className={cn(
              "p-1.5 rounded transition-colors flex items-center gap-1 text-sm",
              insertingRow === null && !isReadOnly
                ? "hover:bg-bg-hover text-text-primary"
                : "opacity-50 cursor-not-allowed text-text-tertiary"
            )}
            title={isReadOnly ? "Read-only connection" : insertingRow === null ? "Insert Row" : "Already inserting a row"}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Insert</span>
          </button>
          {selectedRows.size > 0 && (
            <button
              onClick={handleCopySelectedRows}
              className="p-1.5 rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm text-text-primary"
              title={`Copy ${selectedRows.size} row${selectedRows.size === 1 ? '' : 's'} to clipboard (Ctrl+C)`}
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copy</span>
            </button>
          )}
          {selectedRows.size === 1 && !insertingRow && !isReadOnly && (
            <button
              onClick={handleDuplicateRow}
              className="p-1.5 rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm text-text-primary"
              title="Duplicate Selected Row"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
          )}
          {selectedRows.size > 0 && !isReadOnly && (
            <button
              onClick={handleDeleteRows}
              className="p-1.5 rounded hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm text-error"
              title="Delete Selected Rows"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          <div className="w-px h-5 bg-border mx-1" /> {/* Separator */}
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={rows.length === 0}
            className={cn(
              "p-1.5 rounded transition-colors flex items-center gap-1 text-sm",
              rows.length > 0
                ? "hover:bg-bg-hover text-text-primary"
                : "opacity-50 cursor-not-allowed text-text-tertiary"
            )}
            title="Export Data"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            disabled={isReadOnly}
            className={cn(
              "p-1.5 rounded transition-colors flex items-center gap-1 text-sm",
              !isReadOnly
                ? "hover:bg-bg-hover text-text-primary"
                : "opacity-50 cursor-not-allowed text-text-tertiary"
            )}
            title={isReadOnly ? "Read-only connection" : "Import Data"}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <div className="w-px h-5 bg-border mx-1" /> {/* Separator */}
          <button
            onClick={() => setShowSavedViewsPanel(true)}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Saved Views"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMetadataPanel(true)}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Table Info"
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            onClick={loadData}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filter Chips Bar - Always visible */}
      <div className="px-4 py-2 border-b border-border bg-bg-secondary/50 flex items-center gap-3">
        <FilterChips
          filters={filters}
          logic={filterLogic}
          onRemove={handleRemoveFilter}
          onEdit={() => setShowFilterBuilder(true)}
          onAddFilter={() => setShowFilterBuilder(true)}
        />
        <div className="flex-shrink-0">
          <FilterPresets
            schema={schema}
            table={table}
            currentFilters={filters}
            currentLogic={filterLogic}
            onLoadPreset={(loadedFilters, loadedLogic) => {
              setFilters(loadedFilters);
              setFilterLogic(loadedLogic);
              setOffset(0);
            }}
          />
        </div>
      </div>

      {/* Expandable Filter Builder Panel */}
      <FilterBuilder
        columns={metadata}
        onApply={handleFilterApply}
        initialFilters={filters}
        initialLogic={filterLogic}
        open={showFilterBuilder}
        onOpenChange={setShowFilterBuilder}
      />

      {/* Scroll Progress Bar */}
      <ScrollProgressBar progress={scrollProgress} />

      {/* Table Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Table with scroll */}
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-auto"
          onScroll={handleScroll}
          tabIndex={0}
        >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-text-secondary">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading table data...</span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <div className="text-center">
              <p className="text-lg mb-2">No Data</p>
              <p className="text-sm text-text-tertiary">
                {filters.length > 0
                  ? "No rows match the current filters. Try adjusting or clearing them."
                  : schema ? `Table ${schema}.${table} is empty` : `Collection ${table} is empty`}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-bg-tertiary border-b border-border shadow-sm">
              <tr>
                <th className="px-3 py-2 w-10 bg-bg-tertiary">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === rows.length && rows.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                    title="Select all"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="group text-left font-medium text-text-primary whitespace-nowrap bg-bg-tertiary cursor-pointer hover:bg-bg-hover select-none transition-colors relative"
                    style={{ width: columnWidths[column] || "auto", minWidth: 60 }}
                    onClick={() => handleColumnSort(column)}
                    title={`Sort by ${column}${sortColumn === column ? (sortDirection === "ASC" ? " (ascending)" : " (descending)") : ""}`}
                  >
                    <div className="flex items-center gap-1 px-3 py-2">
                      <span className="truncate">{column}</span>
                      {sortColumn === column ? (
                        sortDirection === "ASC" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/50 transition-colors",
                        resizingColumn === column && "bg-accent"
                      )}
                      onMouseDown={(e) => handleResizeStart(e, column)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Inline inserting row */}
              {insertingRow && (
                <tr className="border-b-2 border-accent bg-accent/5">
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center">
                      <span className="text-xs text-accent font-medium">New</span>
                    </div>
                  </td>
                  {columns.map((column) => {
                    const colMetadata = metadata.find((m) => m.name === column);
                    if (!colMetadata) return <td key={column} className="px-3 py-2"></td>;

                    const type = colMetadata.type.toLowerCase();
                    const isAutoIncrement = type.includes("serial") || type.includes("identity");
                    const isNonEditable = colMetadata.editable === false || colMetadata.isGenerated === true;
                    const isNull = insertingRowNullColumns.has(column);
                    const isRequired = !colMetadata.nullable && !colMetadata.defaultValue;

                    // Skip auto-increment, generated, and non-editable columns
                    if (isAutoIncrement || isNonEditable) {
                      return (
                        <td key={column} className="px-3 py-2 text-text-tertiary italic text-xs">
                          {isAutoIncrement ? "Auto" : colMetadata.isGenerated ? "Generated" : "N/A"}
                        </td>
                      );
                    }

                    const isUUID = type.includes("uuid") || type.includes("guid") || type.includes("uniqueidentifier");
                    const isObjectId = type.toLowerCase().includes("objectid");
                    const { isMongo } = isMongoDBOrRedis();

                    return (
                      <td key={column} className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {/* Input field */}
                          <div className="flex-1 min-w-0">
                            {type.includes("bool") ? (
                              <select
                                value={insertingRow[column] || ""}
                                onChange={(e) => handleInsertingRowChange(column, e.target.value)}
                                disabled={isNull}
                                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                              >
                                <option value="">--</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : type.includes("json") || type.includes("jsonb") || (isMongo && type.includes("object")) ? (
                              <textarea
                                value={insertingRow[column] || ""}
                                onChange={(e) => handleInsertingRowChange(column, e.target.value)}
                                disabled={isNull}
                                placeholder="{}"
                                rows={1}
                                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 resize-none"
                              />
                            ) : (
                              <input
                                type={
                                  type.includes("int") || type.includes("float") || type.includes("decimal") || type.includes("numeric")
                                    ? "number"
                                    : type.includes("date") || type.includes("time")
                                    ? "datetime-local"
                                    : "text"
                                }
                                value={insertingRow[column] || ""}
                                onChange={(e) => handleInsertingRowChange(column, e.target.value)}
                                disabled={isNull}
                                placeholder={
                                  isRequired
                                    ? "Required"
                                    : colMetadata.defaultValue
                                    ? `Default: ${colMetadata.defaultValue}`
                                    : isUUID
                                    ? "UUID (click Gen)"
                                    : isObjectId
                                    ? "ObjectId (click Gen)"
                                    : ""
                                }
                                className={cn(
                                  "w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50",
                                  isRequired && "border-orange-500"
                                )}
                              />
                            )}
                          </div>

                          {/* UUID Generate button */}
                          {isUUID && !isNull && (
                            <button
                              onClick={() => handleGenerateUUID(column)}
                              className="px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent text-xs rounded transition-colors whitespace-nowrap"
                              title="Generate UUID v4"
                            >
                              Gen
                            </button>
                          )}

                          {/* MongoDB ObjectId Generate button */}
                          {isObjectId && !isNull && (
                            <button
                              onClick={() => handleGenerateObjectId(column)}
                              className="px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent text-xs rounded transition-colors whitespace-nowrap"
                              title="Generate MongoDB ObjectId"
                            >
                              Gen
                            </button>
                          )}

                          {/* NULL checkbox for nullable columns */}
                          {colMetadata.nullable && (
                            <label
                              className={cn(
                                "flex items-center gap-0.5 text-xs whitespace-nowrap cursor-pointer transition-colors",
                                isNull ? "text-accent font-medium" : "text-text-tertiary hover:text-text-secondary"
                              )}
                              title={isNull ? "Uncheck to enter a value" : "Check to set NULL"}
                            >
                              <input
                                type="checkbox"
                                checked={isNull}
                                onChange={() => handleInsertingRowToggleNull(column)}
                                className="rounded w-3 h-3"
                              />
                              <span className="hidden xl:inline text-[10px]">NULL</span>
                            </label>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Existing rows */}
              {rows.map((row, rowIndex) => {
                return (
                  <tr
                    key={rowIndex}
                    className={cn(
                      "border-b border-border hover:bg-bg-hover transition-colors",
                      selectedRows.has(rowIndex) && "bg-accent/10"
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(rowIndex)}
                        onChange={() => toggleRowSelection(rowIndex)}
                        className="rounded"
                      />
                    </td>
                    {columns.map((column) => {
                      const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column;
                      const cellKey = `${rowIndex}-${column}`;
                      const hasPendingEdit = pendingEdits.has(cellKey);
                      const pendingEdit = pendingEdits.get(cellKey);

                      // Get the display value - either pending edit or original
                      const displayValue = hasPendingEdit && pendingEdit ? pendingEdit.newValue : row[column];
                      const displayText = formatCellValue(displayValue);

                      const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.column === column;

                      return (
                        <td
                          key={column}
                          className={cn(
                            "px-3 py-2 text-text-primary whitespace-nowrap relative overflow-hidden",
                            !isEditing && "cursor-pointer hover:bg-bg-tertiary/50",
                            hasPendingEdit && "border-2 border-orange-500 bg-orange-500/10",
                            isFocused && !hasPendingEdit && "ring-1 ring-accent/50 bg-accent/5"
                          )}
                          style={{ width: columnWidths[column] || "auto", maxWidth: columnWidths[column] || "none" }}
                          onClick={() => !isEditing && setFocusedCell({ rowIndex, column })}
                          onDoubleClick={(e) => !isEditing && handleCellDoubleClick(e, rowIndex, column, row[column])}
                          title={hasPendingEdit ? "Pending change - Click Save to commit" : "Click to select, double-click to edit, Ctrl+C to copy"}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({ ...editingCell, value: e.target.value })
                              }
                              onBlur={handleEditCommit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleEditCommit();
                                } else if (e.key === "Escape") {
                                  handleEditCancel();
                                }
                              }}
                              autoFocus
                              className="w-full min-w-[100px] px-2 py-1 bg-bg-primary border border-accent rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          ) : (
                            <span className={cn(
                              displayValue === null && "text-text-tertiary italic",
                              hasPendingEdit && "font-medium"
                            )}>
                              {displayText}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>

        {/* Scroll Buttons */}
        <ScrollButtons
          onScrollToTop={scrollToTop}
          onScrollToBottom={scrollToBottom}
          showTopButton={scrollProgress > 10}
          showBottomButton={scrollProgress < 90}
        />

        {/* Visible Row Indicator */}
        {rows.length > 0 && (
          <div className="absolute bottom-2 left-4 px-2 py-1 rounded bg-bg-tertiary border border-border text-xs text-text-secondary shadow-sm">
            Rows {visibleRowRange.start + 1}-{Math.min(visibleRowRange.end, rows.length)} of {rows.length}
            {totalRows !== null && totalRows > rows.length && (
              <span className="text-text-tertiary"> (page {Math.floor(offset / limit) + 1})</span>
            )}
          </div>
        )}
      </div>

      {/* Pagination info */}
      {totalRows !== null && totalRows > 0 && (
        <div className="h-10 px-4 flex items-center justify-between border-t border-border bg-bg-secondary text-sm text-text-secondary">
          <div className="flex items-center gap-3">
            <span>
              Showing {offset + 1}-{Math.min(offset + limit, totalRows)} of {totalRows.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs">Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* First Page */}
            <button
              onClick={() => setOffset(0)}
              disabled={offset === 0}
              className={cn(
                "px-2 py-1 rounded text-xs",
                offset === 0
                  ? "opacity-50 cursor-not-allowed text-text-tertiary"
                  : "hover:bg-bg-hover text-text-secondary"
              )}
              title="First page (Ctrl+Home)"
            >
              First
            </button>
            {/* Previous Page */}
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className={cn(
                "px-3 py-1 rounded",
                offset === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-bg-hover"
              )}
              title="Previous page (Ctrl+←)"
            >
              Previous
            </button>
            {/* Page Indicator & Jump */}
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-xs text-text-tertiary">Page</span>
              <input
                type="number"
                min={1}
                max={Math.ceil(totalRows / limit)}
                value={Math.floor(offset / limit) + 1}
                onChange={(e) => {
                  const page = parseInt(e.target.value, 10);
                  if (!isNaN(page) && page >= 1 && page <= Math.ceil(totalRows / limit)) {
                    setOffset((page - 1) * limit);
                  }
                }}
                className="w-12 px-1.5 py-0.5 bg-bg-primary border border-border rounded text-text-primary text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent"
                title="Jump to page"
              />
              <span className="text-xs text-text-tertiary">of {Math.ceil(totalRows / limit)}</span>
            </div>
            {/* Next Page */}
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= totalRows}
              className={cn(
                "px-3 py-1 rounded",
                offset + limit >= totalRows
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-bg-hover"
              )}
              title="Next page (Ctrl+→)"
            >
              Next
            </button>
            {/* Last Page */}
            <button
              onClick={() => setOffset(Math.floor((totalRows - 1) / limit) * limit)}
              disabled={offset + limit >= totalRows}
              className={cn(
                "px-2 py-1 rounded text-xs",
                offset + limit >= totalRows
                  ? "opacity-50 cursor-not-allowed text-text-tertiary"
                  : "hover:bg-bg-hover text-text-secondary"
              )}
              title="Last page (Ctrl+End)"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Table Metadata Panel */}
      <TableMetadataPanel
        connectionKey={connectionKey}
        schema={schema}
        table={table}
        open={showMetadataPanel}
        onClose={() => setShowMetadataPanel(false)}
      />

      {/* Export Data Dialog */}
      <ExportDataDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        rowCount={totalRows ?? rows.length}
        selectedRowCount={selectedRows.size}
        hasFilters={filters.length > 0}
        onExport={handleExport}
      />

      {/* Import Data Dialog */}
      <ImportDataDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImport}
      />

      {/* Jump to Row Dialog */}
      <JumpToRowDialog
        open={showJumpToRowDialog}
        onClose={() => setShowJumpToRowDialog(false)}
        totalRows={totalRows}
        currentOffset={offset}
        pageSize={limit}
        onJumpToRow={handleJumpToRow}
        onChangePage={handleChangePage}
      />

      {/* Saved Views Panel */}
      <SavedViewsPanel
        open={showSavedViewsPanel}
        onClose={() => setShowSavedViewsPanel(false)}
        schema={schema}
        table={table}
        currentFilters={filters}
        currentFilterLogic={filterLogic}
        currentSortColumn={sortColumn}
        currentSortDirection={sortDirection}
        onLoadView={(view) => {
          setFilters(view.state.filters);
          setFilterLogic(view.state.filterLogic);
          if (view.state.sorting.length > 0) {
            setSortColumn(view.state.sorting[0].columnName);
            setSortDirection(view.state.sorting[0].direction.toUpperCase() as "ASC" | "DESC");
          }
          setOffset(0);
          toast.success(`Loaded view "${view.name}"`);
        }}
      />

      {/* DateTime Popover - anchored to cell */}
      {dateTimeEditor && (
        <DateTimePopover
          open={dateTimeEditor.open}
          onClose={() => setDateTimeEditor(null)}
          value={dateTimeEditor.value}
          onChange={handleDateTimeEditorSave}
          columnName={dateTimeEditor.column}
          columnType={dateTimeEditor.columnType}
          anchorRect={dateTimeEditor.anchorRect}
        />
      )}

      {/* JSON Editor Modal */}
      {jsonEditor && (
        <JSONEditor
          open={jsonEditor.open}
          onClose={() => setJsonEditor(null)}
          value={jsonEditor.value}
          onChange={handleJsonEditorSave}
          columnName={jsonEditor.column}
          columnType={jsonEditor.columnType}
        />
      )}

      {/* MongoDB Document Editor Modal (for insert/clone) */}
      {documentEditor && (
        <JSONEditor
          open={documentEditor.open}
          onClose={() => setDocumentEditor(null)}
          value={documentEditor.value}
          onChange={handleDocumentEditorSave}
          columnName={documentEditor.isClone ? "Clone Document" : "New Document"}
          columnType="MongoDB Document"
        />
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null) {
    return "NULL";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatCellValueForEdit(value: unknown): string {
  if (value === null) {
    return "NULL";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}
