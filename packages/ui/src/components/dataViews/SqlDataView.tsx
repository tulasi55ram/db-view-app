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
import { useEffect, useState, useCallback } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { TableIndex, TableStatistics } from "@dbview/types";
import type { SqlDataViewProps } from "./types";
import { getRowLabel } from "./types";
import { DataViewToolbar, DataViewStatusBar } from "./shared";
import { SqlToolbarActions, useSqlCrud, useSqlExport, useSqlMessages } from "./sql";
import { VirtualDataGrid } from "../VirtualDataGrid";
import { DataGrid, type DataGridColumn } from "../DataGrid";
import { InsertRowPanel } from "../InsertRowPanel";
import { Pagination } from "../Pagination";
import { FilterBuilder } from "../FilterBuilder";
import { TableMetadataPanel } from "../TableMetadataPanel";
import { QuickFilterBar } from "../QuickFilterBar";
import { ImportDataDialog } from "../ImportDataDialog";
import { useTableEditing } from "../../hooks/useTableEditing";
import { useTableFilters } from "../../hooks/useTableFilters";
import { useSavedViews } from "../../hooks/useSavedViews";
import { getVsCodeApi } from "../../vscode";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { ToolbarButton } from "./shared";

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

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

  // Pagination
  const currentPage = Math.floor(offset / limit) + 1;
  const pageSize = limit;

  // CRUD operations hook
  const crud = useSqlCrud({
    schema,
    table,
    columns,
    rows,
    editing,
    vscode,
  });

  // Export/Import operations hook
  const exportOps = useSqlExport({
    schema,
    table,
    columns,
    rows,
    selectedRows: editing.selectedRows,
    vscode,
    setImportDialogOpen,
  });

  // Keyboard shortcut for Jump to Row (Ctrl+G / Cmd+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        vscode?.postMessage({
          type: "SHOW_JUMP_TO_ROW",
          totalRows,
          pageSize: limit,
          offset
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vscode, totalRows, limit, offset]);

  // Request indexes and statistics when metadata panel opens
  useEffect(() => {
    if (metadataPanelOpen && vscode && schema && table) {
      setMetadataLoading(true);
      setMetadataResponsesReceived({ indexes: false, statistics: false });
      vscode.postMessage({ type: "GET_TABLE_INDEXES", schema, table });
      vscode.postMessage({ type: "GET_TABLE_STATISTICS", schema, table });
    }
  }, [metadataPanelOpen, vscode, schema, table]);

  // Message handler hook
  useSqlMessages({
    onRefresh,
    executeDelete: crud.executeDelete,
    handleExport: exportOps.handleExport,
    filters: {
      conditions: filters.conditions,
      logicOperator: filters.logicOperator,
    },
    sorting,
    visibleColumns,
    pageSize,
    savedViews,
    setIsInserting: crud.setIsInserting,
    setInsertError: crud.setInsertError,
    setInsertModalOpen: crud.setInsertModalOpen,
    setDuplicateRowData: crud.setDuplicateRowData,
    setIndexes,
    setStatistics,
    setMetadataLoading,
    setMetadataResponsesReceived,
  });

  // Listen for toast messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'EXPORT_DATA_SUCCESS') {
        toast.success('Data exported successfully', {
          description: message.filePath ? `Saved to ${message.filePath}` : undefined
        });
      } else if (message.type === 'EXPORT_DATA_ERROR') {
        toast.error('Export failed', { description: message.error });
      } else if (message.type === 'IMPORT_DATA_SUCCESS') {
        toast.success(`Successfully imported ${message.insertedCount} rows`);
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
  }, []);

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

  // Saved views helpers
  const convertSortingToViewState = (tanstackSorting: SortingState) => {
    return tanstackSorting.map(sort => ({
      columnName: sort.id,
      direction: sort.desc ? 'desc' as const : 'asc' as const
    }));
  };

  const convertViewStateToSorting = (viewStateSorting: Array<{ columnName: string; direction: 'asc' | 'desc' }>): SortingState => {
    return viewStateSorting.map(sort => ({
      id: sort.columnName,
      desc: sort.direction === 'desc'
    }));
  };

  const getCurrentViewState = () => ({
    filters: filters.conditions,
    filterLogic: filters.logicOperator,
    sorting: convertSortingToViewState(sorting),
    visibleColumns: Array.from(visibleColumns),
    pageSize: pageSize
  });

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
      onPageSizeChange(state.pageSize);
    }

    if (state.filters.length > 0) {
      setShowFilters(true);
    }
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
        hasPendingChanges={crud.hasPendingChanges}
        pendingChangesCount={editing.pendingEdits.size}
        hasSelectedRows={crud.hasSelectedRows}
        selectedRowsCount={editing.selectedRows.size}
        activeViewName={savedViews.activeView?.name}
        readOnly={readOnly}
        leftActions={
          <SqlToolbarActions
            columns={columns}
            readOnly={readOnly}
            hasPendingChanges={crud.hasPendingChanges}
            pendingEditsCount={editing.pendingEdits.size}
            hasSelectedRows={crud.hasSelectedRows}
            selectedRowsCount={editing.selectedRows.size}
            showFilters={showFilters}
            filterCount={filters.conditions.length}
            visibleColumns={visibleColumns}
            views={savedViews.views}
            activeViewId={savedViews.activeViewId}
            vscode={vscode}
            onInsertRow={crud.handleInsertRow}
            onDuplicateRow={crud.handleDuplicateRow}
            onDeleteRows={crud.handleDeleteRows}
            onSaveChanges={crud.handleSaveChanges}
            onDiscardChanges={editing.discardAllEdits}
            onToggleFilters={() => setShowFilters(!showFilters)}
            onToggleColumn={handleToggleColumn}
            onShowAllColumns={handleShowAllColumns}
            onHideAllColumns={handleHideAllColumns}
            onApplyView={handleApplyView}
            onDeleteView={savedViews.deleteView}
            onExportView={savedViews.exportView}
            onSaveCurrentView={() => {
              vscode?.postMessage({
                type: "SHOW_SAVE_VIEW",
                currentState: getCurrentViewState()
              });
            }}
            onImportView={savedViews.importView}
            onExport={() => {
              vscode?.postMessage({
                type: "SHOW_EXPORT_DIALOG",
                selectedRowCount: editing.selectedRows.size,
                hasFilters: filters.conditions.length > 0
              });
            }}
            onImport={() => setImportDialogOpen(true)}
            onCopyAsSQL={exportOps.handleCopyAsSQL}
            onJumpToRow={() => {
              vscode?.postMessage({
                type: "SHOW_JUMP_TO_ROW",
                totalRows,
                pageSize,
                offset
              });
            }}
            totalRows={totalRows}
            pageSize={pageSize}
            offset={offset}
          />
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
        hasPendingChanges={crud.hasPendingChanges}
        pendingChangesCount={editing.pendingEdits.size}
        hasSelectedRows={crud.hasSelectedRows}
        selectedRowsCount={editing.selectedRows.size}
        readOnly={readOnly}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
      />

      {/* Insert Row Panel */}
      {columns && !readOnly && (
        <InsertRowPanel
          open={crud.insertModalOpen}
          onOpenChange={crud.setInsertModalOpen}
          columns={columns}
          onInsert={crud.handleInsert}
          initialValues={crud.duplicateRowData}
          isInserting={crud.isInserting}
          insertError={crud.insertError}
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

      {!readOnly && (
        <ImportDataDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={exportOps.handleImport}
        />
      )}
    </div>
  );
};
