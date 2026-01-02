/**
 * SqlToolbarActions - Toolbar button groups for SqlDataView
 */
import type { FC } from 'react';
import type { ColumnMetadata, FilterCondition, SavedView, ViewState } from '@dbview/types';
import { ToolbarButton } from '../shared';
import { ColumnVisibilityMenu } from '../../ColumnVisibilityMenu';
import { SavedViewsPanel } from '../../SavedViewsPanel';
import {
  Filter,
  Save,
  X,
  Trash2,
  Plus,
  Download,
  Upload,
  Copy,
  ArrowRight,
} from 'lucide-react';

interface SqlToolbarActionsProps {
  // Data
  columns: ColumnMetadata[] | undefined;
  readOnly: boolean;

  // Editing state
  hasPendingChanges: boolean;
  pendingEditsCount: number;
  hasSelectedRows: boolean;
  selectedRowsCount: number;

  // Filter state
  showFilters: boolean;
  filterCount: number;

  // Column visibility
  visibleColumns: Set<string>;

  // Saved views
  views: SavedView[];
  activeViewId: string | null;

  // VS Code API
  vscode: ReturnType<typeof import('../../../vscode').getVsCodeApi>;

  // Callbacks
  onInsertRow: () => void;
  onDuplicateRow: () => void;
  onDeleteRows: () => void;
  onSaveChanges: () => void;
  onDiscardChanges: () => void;
  onToggleFilters: () => void;
  onToggleColumn: (columnName: string) => void;
  onShowAllColumns: () => void;
  onHideAllColumns: () => void;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
  onExportView: (view: SavedView) => void;
  onSaveCurrentView: () => void;
  onImportView: (viewJson: string) => void;
  onExport: () => void;
  onImport: () => void;
  onCopyAsSQL: () => void;
  onJumpToRow: () => void;

  // For export dialog
  totalRows: number | null | undefined;
  pageSize: number;
  offset: number;
}

export const SqlToolbarActions: FC<SqlToolbarActionsProps> = ({
  columns,
  readOnly,
  hasPendingChanges,
  pendingEditsCount,
  hasSelectedRows,
  selectedRowsCount,
  showFilters,
  filterCount,
  visibleColumns,
  views,
  activeViewId,
  onInsertRow,
  onDuplicateRow,
  onDeleteRows,
  onSaveChanges,
  onDiscardChanges,
  onToggleFilters,
  onToggleColumn,
  onShowAllColumns,
  onHideAllColumns,
  onApplyView,
  onDeleteView,
  onExportView,
  onSaveCurrentView,
  onImportView,
  onExport,
  onImport,
  onCopyAsSQL,
  onJumpToRow,
}) => {
  return (
    <>
      {/* Data Operations Group */}
      {columns && !readOnly && (
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Insert"
            onClick={onInsertRow}
            title="Insert new row"
          />
          <ToolbarButton
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Duplicate"
            onClick={onDuplicateRow}
            disabled={!hasSelectedRows || selectedRowsCount !== 1}
            title={hasSelectedRows && selectedRowsCount === 1 ? 'Duplicate selected row' : 'Select one row to duplicate'}
          />
          <ToolbarButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Delete"
            onClick={onDeleteRows}
            disabled={!hasSelectedRows}
            title={hasSelectedRows ? `Delete ${selectedRowsCount} row(s)` : 'Select rows to delete'}
            danger
          />
          <div className="w-px h-5 bg-vscode-border mx-1" />
          <ToolbarButton
            icon={<Save className="h-3.5 w-3.5" />}
            label="Save"
            onClick={onSaveChanges}
            disabled={!hasPendingChanges}
            title={hasPendingChanges ? `Save ${pendingEditsCount} change(s)` : 'No pending changes'}
            primary={hasPendingChanges}
          />
          <ToolbarButton
            icon={<X className="h-3.5 w-3.5" />}
            label="Discard"
            onClick={onDiscardChanges}
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
          onClick={onToggleFilters}
          primary={showFilters || filterCount > 0}
          badge={filterCount > 0 ? filterCount : undefined}
          title={filterCount > 0 ? `${filterCount} active filter(s)` : 'Toggle filters'}
        />
        {columns && (
          <>
            <ColumnVisibilityMenu
              columns={columns}
              visibleColumns={visibleColumns}
              onToggleColumn={onToggleColumn}
              onShowAll={onShowAllColumns}
              onHideAll={onHideAllColumns}
            />
            <SavedViewsPanel
              views={views}
              activeViewId={activeViewId}
              onApplyView={onApplyView}
              onDeleteView={onDeleteView}
              onExportView={onExportView}
              onSaveCurrentView={onSaveCurrentView}
              onImportView={onImportView}
            />
          </>
        )}
        <div className="w-px h-5 bg-vscode-border mx-1" />
        <ToolbarButton
          icon={<Download className="h-3.5 w-3.5" />}
          label="Export"
          onClick={onExport}
          title="Export table data"
        />
        {!readOnly && (
          <ToolbarButton
            icon={<Upload className="h-3.5 w-3.5" />}
            label="Import"
            onClick={onImport}
            title="Import data from file"
          />
        )}
        {hasSelectedRows && (
          <ToolbarButton
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Copy SQL"
            onClick={onCopyAsSQL}
            title={`Copy ${selectedRowsCount} row(s) as INSERT statements`}
          />
        )}
        <div className="w-px h-5 bg-vscode-border mx-1" />
        <ToolbarButton
          icon={<ArrowRight className="h-3.5 w-3.5" />}
          label="Jump"
          onClick={onJumpToRow}
          title="Jump to row (Ctrl+G)"
        />
      </div>
    </>
  );
};
