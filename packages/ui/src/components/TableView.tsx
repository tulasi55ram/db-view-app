import type { FC } from "react";
import { useEffect, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { ColumnMetadata, TableIndex, TableStatistics } from "@dbview/core";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { DataGridV2 } from "./DataGridV2";
import { VirtualDataGrid } from "./VirtualDataGrid";
import { JumpToRowDialog } from "./JumpToRowDialog";
import { InsertRowModal } from "./InsertRowModal";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu";
import { Pagination } from "./Pagination";
import { FilterBuilder } from "./FilterBuilder";
import { SaveViewDialog } from "./SaveViewDialog";
import { SavedViewsPanel } from "./SavedViewsPanel";
import { TableMetadataPanel } from "./TableMetadataPanel";
import { TableToolbar } from "./TableToolbar";
import { QuickFilterBar } from "./QuickFilterBar";
import { ExportDataDialog } from "./ExportDataDialog";
import { ImportDataDialog } from "./ImportDataDialog";
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
  ArrowRight,
  Bookmark
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { ExportOptions } from "@dbview/core";

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
}

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
  totalRows
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateRowData, setDuplicateRowData] = useState<Record<string, unknown> | undefined>(undefined);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [jumpToRowDialogOpen, setJumpToRowDialogOpen] = useState(false);

  // Reference for virtual grid scroll
  const virtualGridRef = { current: { scrollToRow: (_: number) => {} } };

  // Insert operation state
  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const filters = useTableFilters();

  // Saved views state
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const savedViews = useSavedViews(schema, table);

  // Metadata panel state
  const [metadataPanelOpen, setMetadataPanelOpen] = useState(false);
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [statistics, setStatistics] = useState<TableStatistics | undefined>(undefined);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataResponsesReceived, setMetadataResponsesReceived] = useState({ indexes: false, statistics: false });

  // Auto-add first condition when filter panel opens
  useEffect(() => {
    if (showFilters && filters.conditions.length === 0) {
      filters.addCondition();
    }
  }, [showFilters]);

  // Keyboard shortcut for Jump to Row (Ctrl+G / Cmd+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setJumpToRowDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Listen for INSERT_SUCCESS/INSERT_ERROR messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "INSERT_SUCCESS") {
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
  }, [vscode, schema, table, limit, offset, filters, statistics, indexes]);

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

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([]);

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
    editing.discardAllEdits();
  };

  const handleDeleteRows = () => {
    if (!metadata || editing.selectedRows.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
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

  const handleInsert = (values: Record<string, unknown>) => {
    console.log('[TableView] handleInsert called with values:', values);
    console.log('[TableView] Sending INSERT_ROW message:', { schema, table, values });

    // Set loading state and clear previous errors
    setIsInserting(true);
    setInsertError(null);

    vscode?.postMessage({ type: "INSERT_ROW", schema, table, values });
    // Don't clear duplicate data or close modal yet - wait for backend response
  };

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
  const getCurrentViewState = () => {
    return {
      filters: filters.conditions,
      filterLogic: filters.logicOperator,
      sorting: sorting,
      visibleColumns: Array.from(visibleColumns),
      pageSize: pageSize
    };
  };

  const handleSaveView = (name: string, description: string, isDefault: boolean) => {
    const state = getCurrentViewState();
    savedViews.saveView(name, description, state, isDefault);
  };

  const handleApplyView = (view: any) => {
    const state = savedViews.applyView(view);

    // Apply filters from the view
    filters.setAllConditions(state.filters);
    filters.setLogicOperator(state.filterLogic);

    // Apply column visibility
    if (state.visibleColumns.length > 0) {
      setVisibleColumns(new Set(state.visibleColumns));
    }

    // Apply sorting
    if (state.sorting && Array.isArray(state.sorting)) {
      setSorting(state.sorting);
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
    let columnsToExport = metadata?.map(m => m.name) || columns;

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

  const handleCopyAsSQL = () => {
    if (editing.selectedRows.size === 0) {
      toast.error('No rows selected');
      return;
    }

    const selectedIndices = Array.from(editing.selectedRows);
    const selectedRowsData = selectedIndices.map(idx => rows[idx]);
    const columnsToExport = metadata?.map(m => m.name) || columns;

    const sql = formatAsSQL(selectedRowsData, columnsToExport, schema, table);

    navigator.clipboard.writeText(sql).then(() => {
      toast.success(`Copied ${selectedIndices.length} rows as INSERT statements`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* NEW: Enhanced Toolbar with inline controls */}
      <div className="flex flex-col border-b border-vscode-border bg-vscode-bg">
        {/* Header Row - Table Info */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-vscode-bg-light/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-vscode-accent/10">
              <Table2 className="h-4 w-4 text-vscode-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-vscode-text-muted font-medium">{schema}</span>
                <span className="text-xs text-vscode-text-muted">/</span>
                <h1 className="text-sm font-semibold text-vscode-text-bright">{table}</h1>
              </div>
              <div className="flex items-center gap-3 text-xs text-vscode-text-muted mt-0.5">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {columnCount} columns
                </span>
                <span>•</span>
                <span>{loading ? 'Loading...' : `${rowCount.toLocaleString()} rows`}</span>
                {savedViews.activeView && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-vscode-accent">
                      <Bookmark className="h-3 w-3" />
                      {savedViews.activeView.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {hasPendingChanges && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-vscode-warning/10 text-vscode-warning text-xs font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-vscode-warning animate-pulse" />
                {editing.pendingEdits.size} unsaved change{editing.pendingEdits.size !== 1 ? 's' : ''}
              </div>
            )}
            {hasSelectedRows && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-vscode-accent/10 text-vscode-accent text-xs font-medium">
                {editing.selectedRows.size} row{editing.selectedRows.size !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-vscode-bg-light">
          <div className="flex items-center gap-2">
            {/* Data Operations Group */}
            {metadata && (
              <div className="flex items-center gap-0.5">
                <ToolbarButton
                  icon={<Plus className="h-3.5 w-3.5" />}
                  label="Insert"
                  onClick={handleInsertRow}
                  title="Insert new row"
                />
                <ToolbarButton
                  icon={<Copy className="h-3.5 w-3.5" />}
                  label="Duplicate"
                  onClick={handleDuplicateRow}
                  disabled={!hasSelectedRows || editing.selectedRows.size !== 1}
                  title={hasSelectedRows && editing.selectedRows.size === 1 ? 'Duplicate selected row' : 'Select one row to duplicate'}
                />
                <ToolbarButton
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label="Delete"
                  onClick={handleDeleteRows}
                  disabled={!hasSelectedRows}
                  title={hasSelectedRows ? `Delete ${editing.selectedRows.size} row(s)` : 'Select rows to delete'}
                  danger
                />
                <div className="w-px h-5 bg-vscode-border mx-1" />
                <ToolbarButton
                  icon={<Save className="h-3.5 w-3.5" />}
                  label="Save"
                  onClick={handleSaveChanges}
                  disabled={!hasPendingChanges}
                  title={hasPendingChanges ? `Save ${editing.pendingEdits.size} change(s)` : 'No pending changes'}
                  primary={hasPendingChanges}
                />
                <ToolbarButton
                  icon={<X className="h-3.5 w-3.5" />}
                  label="Discard"
                  onClick={editing.discardAllEdits}
                  disabled={!hasPendingChanges}
                  title="Discard all pending changes"
                />
                <div className="w-px h-5 bg-vscode-border mx-1" />
              </div>
            )}

            {/* View Controls Group */}
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                icon={<Filter className="h-3.5 w-3.5" />}
                label="Filters"
                onClick={() => setShowFilters(!showFilters)}
                primary={showFilters || filters.conditions.length > 0}
                badge={filters.conditions.length > 0 ? filters.conditions.length : undefined}
                title={filters.conditions.length > 0 ? `${filters.conditions.length} active filter(s)` : 'Toggle filters'}
              />
              {metadata && (
                <>
                  <ColumnVisibilityMenu
                    columns={metadata}
                    visibleColumns={visibleColumns}
                    onToggleColumn={handleToggleColumn}
                    onShowAll={handleShowAllColumns}
                    onHideAll={handleHideAllColumns}
                  />
                  <SavedViewsPanel
                    views={savedViews.views}
                    activeViewId={savedViews.activeViewId}
                    onApplyView={handleApplyView}
                    onDeleteView={savedViews.deleteView}
                    onExportView={savedViews.exportView}
                    onSaveCurrentView={() => setSaveViewDialogOpen(true)}
                    onImportView={savedViews.importView}
                  />
                </>
              )}
              <div className="w-px h-5 bg-vscode-border mx-1" />
              <ToolbarButton
                icon={<Download className="h-3.5 w-3.5" />}
                label="Export"
                onClick={() => setExportDialogOpen(true)}
                title="Export table data"
              />
              <ToolbarButton
                icon={<Upload className="h-3.5 w-3.5" />}
                label="Import"
                onClick={() => setImportDialogOpen(true)}
                title="Import data from file"
              />
              {hasSelectedRows && (
                <ToolbarButton
                  icon={<Copy className="h-3.5 w-3.5" />}
                  label="Copy SQL"
                  onClick={handleCopyAsSQL}
                  title={`Copy ${editing.selectedRows.size} row(s) as INSERT statements`}
                />
              )}
              <div className="w-px h-5 bg-vscode-border mx-1" />
              <ToolbarButton
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                label="Jump"
                onClick={() => setJumpToRowDialogOpen(true)}
                title="Jump to row (Ctrl+G)"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Info className="h-3.5 w-3.5" />}
              onClick={() => {
                console.log(`[TableView] Info button clicked. Current state: ${metadataPanelOpen}, will toggle to: ${!metadataPanelOpen}`);
                setMetadataPanelOpen(!metadataPanelOpen);
              }}
              primary={metadataPanelOpen}
              title="Table metadata and schema information"
            />
            <ToolbarButton
              icon={<RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />}
              onClick={onRefresh}
              disabled={loading}
              title="Refresh data"
            />
            <ToolbarButton
              icon={<MoreHorizontal className="h-3.5 w-3.5" />}
              title="More options"
              disabled
            />
          </div>
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

      {/* Data Grid */}
      <main className="flex-1 overflow-hidden">
        {metadata && metadata.length > 0 ? (
          <VirtualDataGrid
            columns={metadata}
            rows={rows}
            loading={loading}
            selectable={true}
            selectedRows={editing.selectedRows}
            onRowSelectionChange={editing.setRowSelection}
            editingCell={editing.editingCell}
            onStartEdit={editing.startEdit}
            onSaveEdit={editing.saveEdit}
            onCancelEdit={editing.cancelEdit}
            isPending={editing.isPending}
            hasError={editing.hasError}
            getEditValue={editing.getEditValue}
            visibleColumns={visibleColumns}
            sorting={sorting}
            onSortingChange={setSorting}
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
          <span>PostgreSQL</span>
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

      {/* Insert Row Modal */}
      {metadata && (
        <InsertRowModal
          open={insertModalOpen}
          onOpenChange={setInsertModalOpen}
          columns={metadata}
          onInsert={handleInsert}
          initialValues={duplicateRowData}
          isInserting={isInserting}
          insertError={insertError}
        />
      )}

      {/* Delete Confirm Dialog */}
      {metadata && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          rowCount={editing.selectedRows.size}
          selectedRows={Array.from(editing.selectedRows).map((idx) => rows[idx])}
          columns={metadata}
          onConfirm={confirmDelete}
        />
      )}

      {/* Save View Dialog */}
      {metadata && (
        <SaveViewDialog
          open={saveViewDialogOpen}
          onOpenChange={setSaveViewDialogOpen}
          currentState={getCurrentViewState()}
          onSave={handleSaveView}
        />
      )}

      {/* Table Metadata Panel */}
      <TableMetadataPanel
        schema={schema}
        table={table}
        columns={metadata}
        indexes={indexes}
        statistics={statistics}
        isOpen={metadataPanelOpen}
        onClose={() => setMetadataPanelOpen(false)}
        loading={metadataLoading}
      />

      {/* Export Dialog */}
      <ExportDataDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        rowCount={rowCount}
        selectedRowCount={editing.selectedRows.size}
        hasFilters={filters.conditions.length > 0}
        onExport={handleExport}
      />

      {/* Import Dialog */}
      <ImportDataDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
      />

      {/* Jump to Row Dialog */}
      <JumpToRowDialog
        open={jumpToRowDialogOpen}
        onOpenChange={setJumpToRowDialogOpen}
        totalRows={totalRows}
        currentPage={currentPage}
        pageSize={pageSize}
        offset={offset}
        columns={metadata}
        onJumpToRow={(rowIndex) => {
          // The VirtualDataGrid will handle the scrolling internally
          console.log('[TableView] Jump to row:', rowIndex);
        }}
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
