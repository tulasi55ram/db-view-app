/**
 * SqlDataView - Data view component for SQL databases
 * Supports PostgreSQL, MySQL, MariaDB, SQL Server, SQLite
 *
 * Features:
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Advanced filtering with AND/OR logic
 * - Column visibility management
 * - Sorting
 * - Saved views
 * - Export/Import
 * - Inline cell editing with type-aware editors
 */

import type { FC } from "react";
import { useEffect, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { ColumnMetadata, TableIndex, TableStatistics } from "@dbview/types";
import type { SqlDataViewProps } from "./types";
import { DB_TYPE_LABELS, getRowLabel } from "./types";
import { DataViewToolbar, ToolbarButton, DataViewStatusBar } from "./shared";
import { VirtualDataGrid } from "../VirtualDataGrid";
import { DataGrid, type DataGridColumn } from "../DataGrid";
import { JumpToRowDialog } from "../JumpToRowDialog";
import { InsertRowModal } from "../InsertRowModal";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";
import { ColumnVisibilityMenu } from "../ColumnVisibilityMenu";
import { Pagination } from "../Pagination";
import { FilterBuilder } from "../FilterBuilder";
import { SaveViewDialog } from "../SaveViewDialog";
import { SavedViewsPanel } from "../SavedViewsPanel";
import { TableMetadataPanel } from "../TableMetadataPanel";
import { QuickFilterBar } from "../QuickFilterBar";
import { ExportDataDialog } from "../ExportDataDialog";
import { ImportDataDialog } from "../ImportDataDialog";
import { useTableEditing } from "../../hooks/useTableEditing";
import { useTableFilters } from "../../hooks/useTableFilters";
import { useSavedViews } from "../../hooks/useSavedViews";
import { formatAsCSV, formatAsJSON, formatAsSQL } from "../../utils/exportFormatters";
import { parseCSV, parseJSON } from "../../utils/importParsers";
import { getVsCodeApi } from "../../vscode";
import {
  Filter,
  Save,
  X,
  Trash2,
  Plus,
  Info,
  Download,
  Upload,
  Copy,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import type { ExportOptions } from "@dbview/types";

export const SqlDataView: FC<SqlDataViewProps> = ({
  schema,
  table,
  columns,
  rows,
  loading,
  totalRows,
  limit,
  offset,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  dbType,
  readOnly = false,
  filters: externalFilters,
  filterLogic: externalFilterLogic,
  onFiltersChange,
  sorting: externalSorting,
  onSortingChange,
}) => {
  const rowCount = rows.length;
  const columnCount = columns.length;
  const vscode = getVsCodeApi();

  // Request metadata on mount or when table changes
  useEffect(() => {
    if (vscode && schema && table) {
      console.log(`[SqlDataView] Requesting metadata for ${schema}.${table}`);
      vscode.postMessage({ type: "GET_TABLE_METADATA", schema, table });
    }
  }, [vscode, schema, table]);

  // Use editing hook (only if columns are available)
  const editing = useTableEditing(rows, columns || []);
  const hasPendingChanges = editing.pendingEdits.size > 0;
  const hasSelectedRows = editing.selectedRows.size > 0;

  // Modal state
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateRowData, setDuplicateRowData] = useState<Record<string, unknown> | undefined>(undefined);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [jumpToRowDialogOpen, setJumpToRowDialogOpen] = useState(false);

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

  // Sorting state (use external if provided, otherwise local)
  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const sorting = externalSorting ?? localSorting;
  const setSorting = onSortingChange ?? setLocalSorting;

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (columns) {
      return new Set(columns.map((col) => col.name));
    }
    return new Set();
  });

  // Update visible columns when columns change
  useEffect(() => {
    if (columns) {
      setVisibleColumns(new Set(columns.map((col) => col.name)));
    }
  }, [columns]);

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
    if (metadataPanelOpen && vscode && schema && table) {
      setMetadataLoading(true);
      setMetadataResponsesReceived({ indexes: false, statistics: false });
      vscode.postMessage({ type: "GET_TABLE_INDEXES", schema, table });
      vscode.postMessage({ type: "GET_TABLE_STATISTICS", schema, table });
    }
  }, [metadataPanelOpen, vscode, schema, table]);

  // Listen for messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "INSERT_SUCCESS") {
        setIsInserting(false);
        setInsertError(null);
        setInsertModalOpen(false);
        setDuplicateRowData(undefined);
        onRefresh();
      } else if (message.type === "INSERT_ERROR") {
        setIsInserting(false);
        setInsertError(message.error);
      } else if (message.type === "TABLE_INDEXES") {
        setIndexes(message.indexes || []);
        setMetadataResponsesReceived(prev => {
          const updated = { ...prev, indexes: true };
          if (updated.indexes && updated.statistics) {
            setMetadataLoading(false);
          }
          return updated;
        });
      } else if (message.type === "TABLE_STATISTICS") {
        setStatistics(message.statistics);
        setMetadataResponsesReceived(prev => {
          const updated = { ...prev, statistics: true };
          if (updated.indexes && updated.statistics) {
            setMetadataLoading(false);
          }
          return updated;
        });
      } else if (message.type === 'EXPORT_DATA_SUCCESS') {
        toast.success('Data exported successfully', {
          description: message.filePath ? `Saved to ${message.filePath}` : undefined
        });
      } else if (message.type === 'EXPORT_DATA_ERROR') {
        toast.error('Export failed', { description: message.error });
      } else if (message.type === 'IMPORT_DATA_SUCCESS') {
        toast.success(`Successfully imported ${message.insertedCount} rows`);
        onRefresh();
      } else if (message.type === 'IMPORT_DATA_ERROR') {
        if (message.insertedCount && message.insertedCount > 0) {
          toast.warning(`Partial import: ${message.insertedCount} rows imported`, {
            description: message.errors ? message.errors.slice(0, 3).join(', ') : message.error
          });
        } else {
          toast.error('Import failed', { description: message.error });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefresh]);

  // Pagination
  const currentPage = Math.floor(offset / limit) + 1;
  const pageSize = limit;

  const handlePageChange = (page: number) => {
    onPageChange(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    onPageSizeChange(newPageSize);
  };

  // Search handler
  const handleSearch = () => {
    if (vscode && schema && table) {
      setShowFilters(false);
      vscode.postMessage({
        type: "LOAD_TABLE_ROWS",
        schema,
        table,
        limit,
        offset: 0,
        filters: filters.conditions,
        filterLogic: filters.logicOperator
      });
      vscode.postMessage({
        type: "GET_ROW_COUNT",
        schema,
        table,
        filters: filters.conditions,
        filterLogic: filters.logicOperator
      });

      if (onFiltersChange) {
        onFiltersChange(filters.conditions, filters.logicOperator);
      }
    }
  };

  // CRUD handlers
  const handleSaveChanges = () => {
    if (!columns || editing.pendingEdits.size === 0) return;

    const primaryKeyColumns = columns.filter((col) => col.isPrimaryKey).map((col) => col.name);
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
    if (!columns || editing.selectedRows.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!columns || editing.selectedRows.size === 0) return;

    const primaryKeyColumns = columns.filter((col) => col.isPrimaryKey).map((col) => col.name);
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
    setIsInserting(true);
    setInsertError(null);
    vscode?.postMessage({ type: "INSERT_ROW", schema, table, values });
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
    if (columns) {
      setVisibleColumns(new Set(columns.map((col) => col.name)));
    }
  };

  const handleHideAllColumns = () => {
    setVisibleColumns(new Set());
  };

  // Saved views handlers
  // Convert TanStack SortingState to ViewState sorting format
  const convertSortingToViewState = (tanstackSorting: SortingState): Array<{ columnName: string; direction: 'asc' | 'desc' }> => {
    return tanstackSorting.map(sort => ({
      columnName: sort.id,
      direction: sort.desc ? 'desc' : 'asc'
    }));
  };

  // Convert ViewState sorting to TanStack SortingState
  const convertViewStateToSorting = (viewStateSorting: Array<{ columnName: string; direction: 'asc' | 'desc' }>): SortingState => {
    return viewStateSorting.map(sort => ({
      id: sort.columnName,
      desc: sort.direction === 'desc'
    }));
  };

  const getCurrentViewState = () => {
    return {
      filters: filters.conditions,
      filterLogic: filters.logicOperator,
      sorting: convertSortingToViewState(sorting),
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

    filters.setAllConditions(state.filters);
    filters.setLogicOperator(state.filterLogic);

    if (state.visibleColumns.length > 0) {
      setVisibleColumns(new Set(state.visibleColumns));
    }

    if (state.sorting && Array.isArray(state.sorting)) {
      setSorting(convertViewStateToSorting(state.sorting));
    }

    if (state.pageSize && state.pageSize !== pageSize) {
      handlePageSizeChange(state.pageSize);
    }

    if (state.filters.length > 0) {
      setShowFilters(true);
    }
  };

  // Export/Import handlers
  const handleExport = (options: ExportOptions) => {
    let dataToExport = rows;
    let columnsToExport = columns?.map(m => m.name) || [];

    if (options.selectedRowsOnly && editing.selectedRows.size > 0) {
      const selectedIndices = Array.from(editing.selectedRows);
      dataToExport = selectedIndices.map(idx => rows[idx]);
    }

    let content: string;
    let extension: string;

    switch (options.format) {
      case 'csv':
        content = formatAsCSV(dataToExport, columnsToExport, options.includeHeaders);
        extension = 'csv';
        break;
      case 'json':
        content = formatAsJSON(dataToExport, columnsToExport);
        extension = 'json';
        break;
      case 'sql':
        content = formatAsSQL(dataToExport, columnsToExport, schema, table);
        extension = 'sql';
        break;
    }

    vscode?.postMessage({
      type: 'EXPORT_DATA',
      schema,
      table,
      content,
      extension,
      mimeType: options.format === 'json' ? 'application/json' : 'text/plain'
    });
  };

  const handleImport = async (format: 'csv' | 'json', content: string, hasHeaders?: boolean) => {
    try {
      const { columns: parsedColumns, rows: parsedRows } =
        format === 'csv'
          ? parseCSV(content, hasHeaders)
          : parseJSON(content);

      if (columns) {
        const tableColumns = new Set(columns.map(m => m.name));
        const invalidColumns = parsedColumns.filter(c => !tableColumns.has(c));

        if (invalidColumns.length > 0) {
          toast.error('Invalid columns', {
            description: `Columns not found in table: ${invalidColumns.join(', ')}`
          });
          return;
        }
      }

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
    const columnsToExport = columns?.map(m => m.name) || [];

    const sql = formatAsSQL(selectedRowsData, columnsToExport, schema, table);

    navigator.clipboard.writeText(sql).then(() => {
      toast.success(`Copied ${selectedIndices.length} rows as INSERT statements`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  // Convert ColumnMetadata to DataGridColumn for fallback grid
  const dataGridColumns: DataGridColumn[] = columns?.map(col => ({
    key: col.name,
    label: col.name.replace(/_/g, " ")
  })) || [];

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Toolbar */}
      <DataViewToolbar
        dbType={dbType}
        schema={schema}
        table={table}
        columnCount={columnCount}
        rowCount={rowCount}
        totalRows={totalRows}
        loading={loading}
        onRefresh={onRefresh}
        hasPendingChanges={hasPendingChanges}
        pendingChangesCount={editing.pendingEdits.size}
        hasSelectedRows={hasSelectedRows}
        selectedRowsCount={editing.selectedRows.size}
        activeViewName={savedViews.activeView?.name}
        readOnly={readOnly}
        leftActions={
          <>
            {/* Data Operations Group */}
            {columns && !readOnly && (
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
              {columns && (
                <>
                  <ColumnVisibilityMenu
                    columns={columns}
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
              {!readOnly && (
                <ToolbarButton
                  icon={<Upload className="h-3.5 w-3.5" />}
                  label="Import"
                  onClick={() => setImportDialogOpen(true)}
                  title="Import data from file"
                />
              )}
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
          </>
        }
        rightActions={
          <ToolbarButton
            icon={<Info className="h-3.5 w-3.5" />}
            onClick={() => setMetadataPanelOpen(!metadataPanelOpen)}
            primary={metadataPanelOpen}
            title="Table metadata and schema information"
          />
        }
      />

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
      {showFilters && columns && (
        <FilterBuilder
          columns={columns}
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
        {columns && columns.length > 0 ? (
          <VirtualDataGrid
            columns={columns}
            rows={rows}
            loading={loading}
            selectable={!readOnly}
            selectedRows={editing.selectedRows}
            onRowSelectionChange={editing.setRowSelection}
            editingCell={readOnly ? null : editing.editingCell}
            onStartEdit={readOnly ? undefined : editing.startEdit}
            onSaveEdit={readOnly ? undefined : editing.saveEdit}
            onCancelEdit={readOnly ? undefined : editing.cancelEdit}
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
            columns={dataGridColumns}
            rows={rows}
            loading={loading}
            showRowNumbers={true}
            emptyMessage={`No ${getRowLabel(dbType, true)} found in ${schema}.${table}`}
          />
        )}
      </main>

      {/* Status Bar */}
      <DataViewStatusBar
        dbType={dbType}
        loading={loading}
        hasPendingChanges={hasPendingChanges}
        pendingChangesCount={editing.pendingEdits.size}
        hasSelectedRows={hasSelectedRows}
        selectedRowsCount={editing.selectedRows.size}
        readOnly={readOnly}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

      {/* Modals */}
      {columns && !readOnly && (
        <>
          <InsertRowModal
            open={insertModalOpen}
            onOpenChange={setInsertModalOpen}
            columns={columns}
            onInsert={handleInsert}
            initialValues={duplicateRowData}
            isInserting={isInserting}
            insertError={insertError}
          />
          <DeleteConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            rowCount={editing.selectedRows.size}
            selectedRows={Array.from(editing.selectedRows).map((idx) => rows[idx])}
            columns={columns}
            onConfirm={confirmDelete}
          />
        </>
      )}

      {columns && (
        <SaveViewDialog
          open={saveViewDialogOpen}
          onOpenChange={setSaveViewDialogOpen}
          currentState={getCurrentViewState()}
          onSave={handleSaveView}
        />
      )}

      <TableMetadataPanel
        schema={schema}
        table={table}
        columns={columns}
        indexes={indexes}
        statistics={statistics}
        isOpen={metadataPanelOpen}
        onClose={() => setMetadataPanelOpen(false)}
        loading={metadataLoading}
      />

      <ExportDataDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        rowCount={rowCount}
        selectedRowCount={editing.selectedRows.size}
        hasFilters={filters.conditions.length > 0}
        onExport={handleExport}
      />

      {!readOnly && (
        <ImportDataDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={handleImport}
        />
      )}

      <JumpToRowDialog
        open={jumpToRowDialogOpen}
        onOpenChange={setJumpToRowDialogOpen}
        totalRows={totalRows}
        currentPage={currentPage}
        pageSize={pageSize}
        offset={offset}
        columns={columns}
        onJumpToRow={(rowIndex) => {
          console.log('[SqlDataView] Jump to row:', rowIndex);
        }}
      />
    </div>
  );
};
