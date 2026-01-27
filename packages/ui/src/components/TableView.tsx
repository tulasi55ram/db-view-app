import type { FC } from "react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { ColumnMetadata, TableIndex, TableStatistics, DatabaseType, SavedView, FilterCondition } from "@dbview/types";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { DataGridV2 } from "./DataGridV2";
import { VirtualDataGrid } from "./VirtualDataGrid";
import { InsertRowPanel } from "./InsertRowPanel";
import { JsonEditorPanel } from "./JsonEditorPanel";
import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu";
import { Pagination } from "./Pagination";
import { FilterBuilder } from "./FilterBuilder";
import { SavedViewsPanel } from "./SavedViewsPanel";
import { TableMetadataPanel } from "./TableMetadataPanel";
import { TableToolbar } from "./TableToolbar";
import { QuickFilterBar } from "./QuickFilterBar";
import { ImportDataDialog } from "./ImportDataDialog";
import { QuickAccessBar, type PanelType } from "./panels";
import { FloatingSelectionBar } from "./FloatingSelectionBar";
import { FilterPresets } from "./FilterPresets";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTableEditing } from "../hooks/useTableEditing";
import { useTableFilters } from "../hooks/useTableFilters";
import { useSavedViews } from "../hooks/useSavedViews";
import { formatAsCSV, formatAsJSON, formatAsSQL } from "../utils/exportFormatters";
import { parseCSV, parseJSON } from "../utils/importParsers";
import { getVsCodeApi } from "../vscode";
import {
  RefreshCw,
  Table2,
  Database,
  MoreHorizontal,
  Download,
  Copy,
  Filter,
  Columns3,
  Save,
  X,
  Trash2,
  Plus,
  Info,
  Upload,
  Bookmark
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { ExportOptions } from "@dbview/types";

export interface TableViewProps {
  schema: string;
  table: string;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  loading: boolean;
  metadata?: ColumnMetadata[];
  onRefresh?: () => void;
  limit: number;
  offset: number;
  totalRows: number | null;
  dbType?: DatabaseType;
  sorting?: Array<{ columnName: string; direction: 'asc' | 'desc' }>;
  onSortingChange?: (sorting: Array<{ columnName: string; direction: 'asc' | 'desc' }>) => void;
}

// Database type labels for status bar
const DB_TYPE_LABELS: Record<DatabaseType, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  sqlserver: 'SQL Server',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  cassandra: 'Cassandra',
};

export const TableView: FC<TableViewProps> = ({
  schema,
  table,
  columns,
  rows,
  loading,
  metadata,
  onRefresh,
  limit,
  offset,
  totalRows,
  dbType = 'postgres',
  sorting: initialSorting,
  onSortingChange
}) => {
  const rowCount = rows.length;
  const columnCount = columns.length;
  const vscode = getVsCodeApi();

  // Request metadata on mount or when table changes
  useEffect(() => {
    if (vscode && schema && table) {
      console.log(`[TableView] Requesting metadata for ${schema}.${table}`);
      vscode.postMessage({ type: "GET_TABLE_METADATA", schema, table });
    }
  }, [vscode, schema, table]);

  // Use editing hook (only if metadata is available)
  const editing = useTableEditing(rows, metadata || []);
  const hasPendingChanges = editing.pendingEdits.size > 0;
  const hasSelectedRows = editing.selectedRows.size > 0;

  // Modal state
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [duplicateRowData, setDuplicateRowData] = useState<Record<string, unknown> | undefined>(undefined);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // JSON editor panel state
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonEditorData, setJsonEditorData] = useState<{
    rowIndex: number;
    columnKey: string;
    value: unknown;
  } | null>(null);

  // Reference for virtual grid scroll
  const virtualGridRef = { current: { scrollToRow: (_: number) => {} } };

  // Insert operation state
  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const filters = useTableFilters();

  // Saved views state
  const savedViews = useSavedViews(schema, table);

  // Metadata panel state
  const [metadataPanelOpen, setMetadataPanelOpen] = useState(false);
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [statistics, setStatistics] = useState<TableStatistics | undefined>(undefined);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataResponsesReceived, setMetadataResponsesReceived] = useState({ indexes: false, statistics: false });

  // Compute active panel for resizable layout
  const activePanel: PanelType | null = useMemo(() => {
    if (insertModalOpen) return "insert";
    if (jsonEditorOpen && jsonEditorData) return "json-editor";
    if (metadataPanelOpen) return "metadata";
    return null;
  }, [insertModalOpen, jsonEditorOpen, jsonEditorData, metadataPanelOpen]);

  // Auto-add first condition when filter panel opens
  useEffect(() => {
    if (showFilters && filters.conditions.length === 0) {
      filters.addCondition();
    }
  }, [showFilters]);

  // Request indexes and statistics when metadata panel opens
  useEffect(() => {
    console.log(`[TableView] Metadata panel open effect triggered. Panel open: ${metadataPanelOpen}, vscode: ${!!vscode}, schema: ${schema}, table: ${table}`);
    if (metadataPanelOpen && vscode && schema && table) {
      console.log(`[TableView] ========== METADATA PANEL OPENED ==========`);
      console.log(`[TableView] Schema: ${schema}, Table: ${table}`);
      console.log(`[TableView] Setting loading = true`);
      setMetadataLoading(true);
      setMetadataResponsesReceived({ indexes: false, statistics: false });
      console.log(`[TableView] Sending GET_TABLE_INDEXES message`);
      vscode.postMessage({ type: "GET_TABLE_INDEXES", schema, table });
      console.log(`[TableView] Sending GET_TABLE_STATISTICS message`);
      vscode.postMessage({ type: "GET_TABLE_STATISTICS", schema, table });
    }
  }, [metadataPanelOpen, vscode, schema, table]);

  // Define executeDelete before the useEffect that uses it
  const executeDelete = useCallback(() => {
    if (!metadata || editing.selectedRows.size === 0) return;

    const primaryKeyColumns = metadata.filter((col) => col.isPrimaryKey).map((col) => col.name);
    const selectedIndices = Array.from(editing.selectedRows);
    const primaryKeys = selectedIndices.map((idx) => {
      const row = rows[idx];
      const pk: Record<string, unknown> = {};
      primaryKeyColumns.forEach((col) => {
        pk[col] = row[col];
      });
      return pk;
    });

    vscode?.postMessage({ type: "DELETE_ROWS", schema, table, primaryKeys });
    editing.clearSelection();
  }, [metadata, editing, rows, vscode, schema, table]);

  // Listen for INSERT_SUCCESS/INSERT_ERROR messages and delete confirmation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "CONFIRM_DELETE_RESULT") {
        // Handle VS Code native dialog response
        if (message.confirmed) {
          executeDelete();
        }
      } else if (message.type === "JUMP_TO_ROW_RESULT") {
        // Handle VS Code native InputBox result for Jump to Row
        console.log('[TableView] Jump to row:', message.rowIndex);
        // The VirtualDataGrid would handle scrolling if we had a ref to it
      } else if (message.type === "SAVE_VIEW_RESULT") {
        // Handle VS Code native InputBox result for Save View
        const { name, description, isDefault } = message;
        const state = getCurrentViewState();
        savedViews.saveView(name, description, state, isDefault);
      } else if (message.type === "EXPORT_RESULT") {
        // Handle VS Code native QuickPick result for Export
        const { options } = message;
        handleExport(options);
      } else if (message.type === "INSERT_SUCCESS") {
        console.log('[TableView] Received INSERT_SUCCESS, closing modal and refreshing');
        setIsInserting(false);
        setInsertError(null);
        setInsertModalOpen(false);
        setDuplicateRowData(undefined);

        // Refresh the table data
        if (vscode) {
          vscode.postMessage({
            type: "LOAD_TABLE_ROWS",
            schema,
            table,
            limit,
            offset,
            filters: filters.conditions,
            filterLogic: filters.logicOperator
          });
        }
      } else if (message.type === "INSERT_ERROR") {
        console.log('[TableView] Received INSERT_ERROR:', message.error);
        setIsInserting(false);
        setInsertError(message.error);
        // Keep modal open to show error
      } else if (message.type === "TABLE_INDEXES") {
        console.log('[TableView] ========== Received TABLE_INDEXES ==========');
        console.log('[TableView] Indexes:', message.indexes);
        console.log('[TableView] Number of indexes:', message.indexes?.length || 0);
        setIndexes(message.indexes || []);
        setMetadataResponsesReceived(prev => {
          const updated = { ...prev, indexes: true };
          console.log('[TableView] Updated response tracker:', updated);
          // If both responses received, stop loading
          if (updated.indexes && updated.statistics) {
            console.log('[TableView] Both responses received! Setting loading = false');
            setMetadataLoading(false);
          } else {
            console.log('[TableView] Waiting for statistics response...');
          }
          return updated;
        });
      } else if (message.type === "TABLE_STATISTICS") {
        console.log('[TableView] ========== Received TABLE_STATISTICS ==========');
        console.log('[TableView] Statistics:', message.statistics);
        setStatistics(message.statistics);
        setMetadataResponsesReceived(prev => {
          const updated = { ...prev, statistics: true };
          console.log('[TableView] Updated response tracker:', updated);
          // If both responses received, stop loading
          if (updated.indexes && updated.statistics) {
            console.log('[TableView] Both responses received! Setting loading = false');
            setMetadataLoading(false);
          } else {
            console.log('[TableView] Waiting for indexes response...');
          }
          return updated;
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vscode, schema, table, limit, offset, filters, executeDelete]);

  // Manual search handler
  const handleSearch = () => {
    if (vscode && schema && table) {
      console.log(`[TableView] Executing search with ${filters.conditions.length} conditions`);
      // Auto-close filter panel after search to show results
      setShowFilters(false);
      vscode.postMessage({
        type: "LOAD_TABLE_ROWS",
        schema,
        table,
        limit,
        offset: 0, // Reset to first page when searching
        filters: filters.conditions,
        filterLogic: filters.logicOperator
      });

      // Also update row count with filters
      vscode.postMessage({
        type: "GET_ROW_COUNT",
        schema,
        table,
        filters: filters.conditions,
        filterLogic: filters.logicOperator
      });
    }
  };

  // Pagination state
  const currentPage = Math.floor(offset / limit) + 1;
  const pageSize = limit;

  const handlePageChange = (page: number) => {
    const newOffset = (page - 1) * pageSize;
    if (vscode) {
      vscode.postMessage({
        type: "LOAD_TABLE_ROWS",
        schema,
        table,
        limit: pageSize,
        offset: newOffset,
        filters: filters.conditions,
        filterLogic: filters.logicOperator
      });
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    if (vscode) {
      // Reset to page 1 when changing page size
      vscode.postMessage({
        type: "LOAD_TABLE_ROWS",
        schema,
        table,
        limit: newPageSize,
        offset: 0,
        filters: filters.conditions,
        filterLogic: filters.logicOperator
      });
    }
  };

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (metadata) {
      return new Set(metadata.map((col) => col.name));
    }
    return new Set();
  });

  // Sorting state - initialize from props if provided
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (initialSorting && initialSorting.length > 0) {
      return initialSorting.map(s => ({
        id: s.columnName,
        desc: s.direction === 'desc'
      }));
    }
    return [];
  });

  // Helper to get current view state (defined early for use in useEffect)
  const getCurrentViewState = useCallback(() => {
    return {
      filters: filters.conditions,
      filterLogic: filters.logicOperator,
      sorting: sorting.map(sort => ({
        columnName: sort.id,
        direction: sort.desc ? 'desc' as const : 'asc' as const
      })),
      visibleColumns: Array.from(visibleColumns),
      pageSize: pageSize
    };
  }, [filters.conditions, filters.logicOperator, sorting, visibleColumns, pageSize]);

  // Handle sorting changes - notify parent for server-side sorting
  const handleSortingChange = useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    // Handle both updater function and direct value from TanStack Table
    const newSorting = typeof updaterOrValue === 'function'
      ? updaterOrValue(sorting)
      : updaterOrValue;

    setSorting(newSorting);

    // Notify parent component if callback is provided
    if (onSortingChange) {
      const sortingData = newSorting.map(sort => ({
        columnName: sort.id,
        direction: sort.desc ? 'desc' as const : 'asc' as const
      }));
      onSortingChange(sortingData);
    }
  }, [sorting, onSortingChange]);

  // Update visible columns when metadata changes
  useEffect(() => {
    if (metadata) {
      setVisibleColumns(new Set(metadata.map((col) => col.name)));
    }
  }, [metadata]);

  // CRUD action handlers
  const handleSaveChanges = () => {
    if (!metadata || editing.pendingEdits.size === 0) return;

    const primaryKeyColumns = metadata.filter((col) => col.isPrimaryKey).map((col) => col.name);
    if (primaryKeyColumns.length === 0) {
      toast.error("Cannot save changes", {
        description: "This table has no primary key defined"
      });
      return;
    }

    const edits = Array.from(editing.pendingEdits.values()).map((edit) => {
      const row = rows[edit.rowIndex];
      const primaryKey: Record<string, unknown> = {};
      primaryKeyColumns.forEach((col) => {
        primaryKey[col] = row[col];
      });
      return {
        primaryKey,
        columnKey: edit.columnKey,
        newValue: edit.newValue
      };
    });

    vscode?.postMessage({ type: "COMMIT_CHANGES", schema, table, edits });
    editing.discardAllEdits(true); // Silent - don't show "discarded" toast when saving
  };

  const handleDeleteRows = () => {
    if (!metadata || editing.selectedRows.size === 0) return;
    // Send confirmation request to VS Code for native dialog
    vscode?.postMessage({
      type: "CONFIRM_DELETE",
      rowCount: editing.selectedRows.size
    });
  };

  const handleInsertRow = () => {
    setDuplicateRowData(undefined);
    setInsertError(null);
    setIsInserting(false);
    setInsertModalOpen(true);
  };

  const handleDuplicateRow = () => {
    if (!hasSelectedRows || editing.selectedRows.size !== 1) {
      toast.error("Select exactly one row to duplicate");
      return;
    }

    const selectedRowIndex = Array.from(editing.selectedRows)[0];
    const selectedRow = rows[selectedRowIndex];

    if (selectedRow) {
      setDuplicateRowData(selectedRow);
      setInsertError(null);
      setIsInserting(false);
      setInsertModalOpen(true);
    }
  };

  // Copy selected rows to clipboard
  const handleCopySelectedRows = useCallback(() => {
    if (editing.selectedRows.size === 0) return;

    const selectedIndices = Array.from(editing.selectedRows).sort((a, b) => a - b);
    const selectedData = selectedIndices.map(idx => rows[idx]);
    const columnNames = metadata?.map(m => m.name) || columns.map(c => c.key);

    // Format as tab-separated values with header
    const header = columnNames.join('\t');
    const dataRows = selectedData.map(row =>
      columnNames.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }).join('\t')
    );
    const text = [header, ...dataRows].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copied ${selectedData.length} row${selectedData.length === 1 ? '' : 's'} to clipboard`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  }, [editing.selectedRows, rows, metadata, columns]);

  const handleInsert = (values: Record<string, unknown>) => {
    console.log('[TableView] handleInsert called with values:', values);
    console.log('[TableView] Sending INSERT_ROW message:', { schema, table, values });

    // Set loading state and clear previous errors
    setIsInserting(true);
    setInsertError(null);

    vscode?.postMessage({ type: "INSERT_ROW", schema, table, values });
    // Don't clear duplicate data or close modal yet - wait for backend response
  };

  // Handle opening panels from QuickAccessBar
  const handleOpenPanel = useCallback((panel: PanelType) => {
    switch (panel) {
      case "insert":
        handleInsertRow();
        break;
      case "json-editor":
        // Can only open if we have a selected cell with JSON data
        break;
      case "metadata":
        setMetadataPanelOpen(true);
        break;
      default:
        break;
    }
  }, []);

  // JSON editor handlers
  const handleStartEdit = useCallback((rowIndex: number, columnKey: string) => {
    const column = metadata?.find(c => c.name === columnKey);
    const value = rows[rowIndex]?.[columnKey];

    // Check if this is a JSON/JSONB/Array column OR if the value is an array/object - open side panel instead
    const isJsonColumn = column && (column.type === 'json' || column.type === 'jsonb');
    const isArrayColumn = column && (column.type === 'array' || column.type.includes('[]'));
    const isArrayOrObjectValue = Array.isArray(value) || (typeof value === 'object' && value !== null && !(value instanceof Date));

    if (isJsonColumn || isArrayColumn || isArrayOrObjectValue) {
      setJsonEditorData({ rowIndex, columnKey, value });
      setJsonEditorOpen(true);
      return false;
    }

    // For non-JSON columns, use default inline editor
    return editing.startEdit(rowIndex, columnKey);
  }, [metadata, rows, editing]);

  const handleJsonEditorSave = useCallback((value: unknown) => {
    if (jsonEditorData) {
      editing.saveEdit(jsonEditorData.rowIndex, jsonEditorData.columnKey, value);
    }
    setJsonEditorOpen(false);
    setJsonEditorData(null);
  }, [jsonEditorData, editing]);

  // Column visibility handlers
  const handleToggleColumn = (columnName: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        next.delete(columnName);
      } else {
        next.add(columnName);
      }
      return next;
    });
  };

  const handleShowAllColumns = () => {
    if (metadata) {
      setVisibleColumns(new Set(metadata.map((col) => col.name)));
    }
  };

  const handleHideAllColumns = () => {
    setVisibleColumns(new Set());
  };

  // Saved views handlers
  const handleSaveView = (name: string, description: string, isDefault: boolean) => {
    const state = getCurrentViewState();
    savedViews.saveView(name, description, state, isDefault);
  };

  const handleApplyView = (view: SavedView) => {
    const state = savedViews.applyView(view);

    // Apply filters from the view
    filters.setAllConditions(state.filters);
    filters.setLogicOperator(state.filterLogic);

    // Apply column visibility
    if (state.visibleColumns.length > 0) {
      setVisibleColumns(new Set(state.visibleColumns));
    }

    // Apply sorting (convert from ViewState format to SortingState format)
    if (state.sorting && Array.isArray(state.sorting)) {
      setSorting(state.sorting.map(sort => ({
        id: sort.columnName,
        desc: sort.direction === 'desc'
      })));
    }

    // Apply page size
    if (state.pageSize && state.pageSize !== pageSize) {
      handlePageSizeChange(state.pageSize);
    }

    // Show filters if there are any
    if (state.filters.length > 0) {
      setShowFilters(true);
    }
  };

  // Handle loading a filter preset
  const handleLoadFilterPreset = useCallback((loadedFilters: FilterCondition[], logic: "AND" | "OR") => {
    filters.setAllConditions(loadedFilters);
    filters.setLogicOperator(logic);
    setShowFilters(true);

    // Trigger search with new filters
    if (vscode && schema && table) {
      vscode.postMessage({
        type: "LOAD_TABLE_ROWS",
        schema,
        table,
        limit,
        offset: 0, // Reset to first page
        filters: loadedFilters,
        filterLogic: logic
      });

      vscode.postMessage({
        type: "GET_ROW_COUNT",
        schema,
        table,
        filters: loadedFilters,
        filterLogic: logic
      });
    }
  }, [filters, vscode, schema, table, limit]);

  // Listen for export/import responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[TableView] Received message:', message.type, message);

      switch (message.type) {
        case 'EXPORT_DATA_SUCCESS':
          toast.success('Data exported successfully', {
            description: message.filePath ? `Saved to ${message.filePath}` : undefined
          });
          break;
        case 'EXPORT_DATA_CANCELLED':
          // User cancelled the save dialog - no action needed
          break;
        case 'EXPORT_DATA_ERROR':
          toast.error('Export failed', { description: message.error });
          break;
        case 'IMPORT_DATA_SUCCESS':
          toast.success(`Successfully imported ${message.insertedCount} rows`);
          break;
        case 'IMPORT_DATA_ERROR':
          if (message.insertedCount && message.insertedCount > 0) {
            toast.warning(`Partial import: ${message.insertedCount} rows imported`, {
              description: message.errors ? message.errors.slice(0, 3).join(', ') : message.error
            });
          } else {
            toast.error('Import failed', { description: message.error });
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Export/Import handlers
  const handleExport = (options: ExportOptions) => {
    console.log('[TableView] handleExport called with options:', options);

    let dataToExport = rows;
    let columnsToExport = metadata?.map(m => m.name) || columns.map(c => c.key);

    // Filter selected rows if option enabled
    if (options.selectedRowsOnly && editing.selectedRows.size > 0) {
      const selectedIndices = Array.from(editing.selectedRows);
      dataToExport = selectedIndices.map(idx => rows[idx]);
    }

    console.log('[TableView] Exporting', dataToExport.length, 'rows with', columnsToExport.length, 'columns');

    // Format data based on format
    let content: string;
    let extension: string;
    let mimeType: string;

    switch (options.format) {
      case 'csv':
        content = formatAsCSV(dataToExport, columnsToExport, options.includeHeaders);
        extension = 'csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = formatAsJSON(dataToExport, columnsToExport);
        extension = 'json';
        mimeType = 'application/json';
        break;
      case 'sql':
        content = formatAsSQL(dataToExport, columnsToExport, schema, table);
        extension = 'sql';
        mimeType = 'text/plain';
        break;
    }

    console.log('[TableView] Sending EXPORT_DATA message to extension');

    // Send to extension for file save
    vscode?.postMessage({
      type: 'EXPORT_DATA',
      schema,
      table,
      content,
      extension,
      mimeType
    });
  };

  const handleImport = async (format: 'csv' | 'json', content: string, hasHeaders?: boolean) => {
    try {
      // Parse file content
      const { columns: parsedColumns, rows: parsedRows } =
        format === 'csv'
          ? parseCSV(content, hasHeaders)
          : parseJSON(content);

      // Validate columns match table metadata
      if (metadata) {
        const tableColumns = new Set(metadata.map(m => m.name));
        const invalidColumns = parsedColumns.filter(c => !tableColumns.has(c));

        if (invalidColumns.length > 0) {
          toast.error('Invalid columns', {
            description: `Columns not found in table: ${invalidColumns.join(', ')}`
          });
          return;
        }
      }

      // Send import request to backend
      vscode?.postMessage({
        type: 'IMPORT_DATA',
        schema,
        table,
        rows: parsedRows
      });

      setImportDialogOpen(false);
      toast.success(`Importing ${parsedRows.length} rows...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Import failed', { description: errorMessage });
    }
  };

  // State for more menu dropdown
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [moreMenuOpen]);

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Compact Single-Row Toolbar (like desktop) */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-vscode-border bg-vscode-bg-light">
        {/* Left: Table Info */}
        <div className="flex items-center gap-2 text-sm text-vscode-text-muted">
          <span className="font-medium text-vscode-text">
            {schema}.{table}
          </span>
          <span>•</span>
          <span>{loading ? 'Loading...' : `${rowCount} rows`}{totalRows !== null && ` of ${totalRows.toLocaleString()}`}</span>
          {hasPendingChanges && (
            <>
              <span>•</span>
              <span className="text-vscode-warning font-medium">
                {editing.pendingEdits.size} pending
              </span>
            </>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Save/Discard - only show when pending changes */}
          {hasPendingChanges && (
            <>
              <button
                onClick={handleSaveChanges}
                className="px-2 py-1 rounded bg-vscode-accent hover:bg-vscode-accent/90 transition-colors flex items-center gap-1.5 text-xs text-white font-medium"
                title={`Save ${editing.pendingEdits.size} change(s)`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save ({editing.pendingEdits.size})</span>
              </button>
              <button
                onClick={editing.discardAllEdits}
                className="p-1.5 rounded hover:bg-vscode-bg-hover transition-colors text-vscode-text-muted"
                title="Discard all changes"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-vscode-border mx-1" />
            </>
          )}

          {/* Insert Button */}
          {metadata && (
            <button
              onClick={handleInsertRow}
              className="p-1.5 rounded hover:bg-vscode-bg-hover transition-colors text-vscode-text-muted hover:text-vscode-text"
              title="Insert new row"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              "p-1.5 rounded transition-colors flex items-center gap-1",
              (showFilters || filters.conditions.length > 0)
                ? "bg-vscode-accent/20 text-vscode-accent"
                : "hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text"
            )}
            title={filters.conditions.length > 0 ? `${filters.conditions.length} active filter(s)` : 'Toggle filters'}
          >
            <Filter className="w-4 h-4" />
            {filters.conditions.length > 0 && (
              <span className="text-[10px] font-semibold">{filters.conditions.length}</span>
            )}
          </button>

          {/* Filter Presets */}
          <FilterPresets
            schema={schema}
            table={table}
            currentFilters={filters.conditions}
            currentLogic={filters.logicOperator}
            onLoadPreset={handleLoadFilterPreset}
          />

          {/* Column Visibility */}
          {metadata && (
            <ColumnVisibilityMenu
              columns={metadata}
              visibleColumns={visibleColumns}
              onToggleColumn={handleToggleColumn}
              onShowAll={handleShowAllColumns}
              onHideAll={handleHideAllColumns}
            />
          )}

          {/* Saved Views */}
          <SavedViewsPanel
            views={savedViews.views}
            activeViewId={savedViews.activeViewId}
            onApplyView={handleApplyView}
            onDeleteView={savedViews.deleteView}
            onExportView={(view) => {
              const json = JSON.stringify(view, null, 2);
              navigator.clipboard.writeText(json).then(() => {
                toast.success('View exported to clipboard');
              });
            }}
            onSaveCurrentView={() => {
              vscode?.postMessage({ type: "SHOW_SAVE_VIEW_DIALOG" });
            }}
            onImportView={() => {
              toast.info('Import view feature coming soon');
            }}
          />

          <div className="w-px h-5 bg-vscode-border mx-1" />

          {/* More Menu (dropdown for secondary features) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="p-1.5 rounded hover:bg-vscode-bg-hover transition-colors text-vscode-text-muted hover:text-vscode-text"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-vscode-bg border border-vscode-border rounded shadow-lg py-1">
                {/* Export */}
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors flex items-center gap-2"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    vscode?.postMessage({
                      type: "SHOW_EXPORT_DIALOG",
                      selectedRowCount: editing.selectedRows.size,
                      hasFilters: filters.conditions.length > 0
                    });
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>

                {/* Import */}
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors flex items-center gap-2"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setImportDialogOpen(true);
                  }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import
                </button>

                <div className="h-px bg-vscode-border my-1" />

                {/* Table Info */}
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors flex items-center gap-2"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setMetadataPanelOpen(!metadataPanelOpen);
                  }}
                >
                  <Info className="w-3.5 h-3.5" />
                  Table Info
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded hover:bg-vscode-bg-hover transition-colors text-vscode-text-muted hover:text-vscode-text disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Quick Filter Bar with Filter Chips */}
      {filters.conditions.length > 0 && (
        <QuickFilterBar
          conditions={filters.conditions}
          onRemoveFilter={filters.removeCondition}
          onClearAll={filters.clearAll}
          onOpenFilters={() => setShowFilters(true)}
          totalRows={totalRows}
        />
      )}

      {/* Filter Panel */}
      {showFilters && metadata && (
        <FilterBuilder
          columns={metadata}
          conditions={filters.conditions}
          logicOperator={filters.logicOperator}
          onAddAfter={filters.addAfter}
          onRemoveCondition={filters.removeCondition}
          onUpdateCondition={filters.updateCondition}
          onClearAll={filters.clearAll}
          onLogicOperatorChange={filters.setLogicOperator}
          onSearch={handleSearch}
          totalRows={totalRows}
          loading={loading}
        />
      )}

      {/* Data Grid - with resizable panels */}
      <main className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId={`tableview-panels-${schema}-${table}`}>
          {/* Main content panel */}
          <Panel id="main" minSize={40}>
            <div className="relative h-full">
              {metadata && metadata.length > 0 ? (
                <VirtualDataGrid
                  columns={metadata}
                  rows={rows}
                  loading={loading}
                  selectable={true}
                  selectedRows={editing.selectedRows}
                  onRowSelectionChange={editing.setRowSelection}
                  editingCell={editing.editingCell}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={editing.saveEdit}
                  onCancelEdit={editing.cancelEdit}
                  isPending={editing.isPending}
                  hasError={editing.hasError}
                  getEditValue={editing.getEditValue}
                  visibleColumns={visibleColumns}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  totalRows={totalRows}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  offset={offset}
                />
              ) : (
                <DataGrid
                  columns={columns}
                  rows={rows}
                  loading={loading}
                  showRowNumbers={true}
                  emptyMessage={`No rows found in ${schema}.${table}`}
                />
              )}

              {/* Floating Selection Bar */}
              <FloatingSelectionBar
                selectedCount={editing.selectedRows.size}
                onCopy={handleCopySelectedRows}
                onDuplicate={handleDuplicateRow}
                onDelete={handleDeleteRows}
                onClearSelection={editing.clearSelection}
                isReadOnly={!metadata}
              />
            </div>
          </Panel>

          {/* Resize handle - only show when panel is active */}
          {activePanel && (
            <>
              <PanelResizeHandle className="w-1 hover:bg-vscode-accent transition-colors cursor-col-resize group">
                <div className="w-1 h-full group-hover:bg-vscode-accent/30 transition-colors" />
              </PanelResizeHandle>

              {/* Side panel */}
              <Panel id="side" defaultSize={30} minSize={20} maxSize={50}>
                {/* Insert Row Panel */}
                {activePanel === "insert" && metadata && (
                  <InsertRowPanel
                    open={insertModalOpen}
                    onOpenChange={setInsertModalOpen}
                    columns={metadata}
                    onInsert={handleInsert}
                    initialValues={duplicateRowData}
                    isInserting={isInserting}
                    insertError={insertError}
                    variant="inline"
                  />
                )}

                {/* JSON Editor Panel */}
                {activePanel === "json-editor" && jsonEditorData && (
                  <JsonEditorPanel
                    open={jsonEditorOpen}
                    onOpenChange={setJsonEditorOpen}
                    value={jsonEditorData.value}
                    onSave={handleJsonEditorSave}
                    columnName={jsonEditorData.columnKey}
                    rowIndex={jsonEditorData.rowIndex}
                    variant="inline"
                  />
                )}

                {/* Table Metadata Panel */}
                {activePanel === "metadata" && (
                  <TableMetadataPanel
                    schema={schema}
                    table={table}
                    columns={metadata}
                    indexes={indexes}
                    statistics={statistics}
                    isOpen={metadataPanelOpen}
                    onClose={() => setMetadataPanelOpen(false)}
                    loading={metadataLoading}
                    variant="inline"
                  />
                )}
              </Panel>
            </>
          )}

          {/* Quick Access Bar - only show when no panel is active */}
          {!activePanel && (
            <QuickAccessBar
              onOpenPanel={handleOpenPanel}
              activePanel={activePanel}
              hasUnsavedChanges={hasPendingChanges}
              hasSelectedCell={false}
            />
          )}
        </PanelGroup>
      </main>

      {/* Status Bar */}
      <footer className="flex items-center justify-between border-t border-vscode-border bg-vscode-bg-light px-4 py-1.5 text-xs text-vscode-text-muted">
        <div className="flex items-center gap-4">
          <span>
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-vscode-warning" />
                Loading data...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-vscode-success" />
                Connected
              </span>
            )}
          </span>
          {metadata && hasPendingChanges && (
            <span className="flex items-center gap-1.5 text-vscode-warning">
              <span className="h-2 w-2 rounded-full bg-vscode-warning" />
              {editing.pendingEdits.size} unsaved change{editing.pendingEdits.size !== 1 ? 's' : ''}
            </span>
          )}
          {metadata && hasSelectedRows && (
            <span className="flex items-center gap-1.5">
              {editing.selectedRows.size} row{editing.selectedRows.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {metadata && <span>Editable</span>}
          <span>{DB_TYPE_LABELS[dbType]}</span>
        </div>
      </footer>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

      {/* Import Dialog */}
      <ImportDataDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
      />
    </div>
  );
};

// Toolbar Button Component
interface ToolbarButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
  danger?: boolean;
  badge?: number;
}

const ToolbarButton: FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  disabled,
  title,
  primary,
  danger,
  badge
}) => (
  <button
    className={clsx(
      "relative inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-40",
      danger
        ? "text-vscode-text-muted hover:bg-vscode-error/10 hover:text-vscode-error"
        : primary
          ? "bg-vscode-accent/20 text-vscode-accent hover:bg-vscode-accent/30"
          : "text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text"
    )}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {icon}
    {label && <span>{label}</span>}
    {badge !== undefined && badge > 0 && (
      <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-vscode-accent px-1 text-[10px] font-semibold text-white">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);
