import { FC } from 'react';
import {
  Plus,
  Trash2,
  Save,
  X,
  Filter,
  Columns3,
  Bookmark,
  Download,
  RefreshCw,
  MoreHorizontal,
  Database,
  Table2,
  AlertCircle
} from 'lucide-react';
import clsx from 'clsx';

interface TableToolbarProps {
  schema: string;
  table: string;
  columnCount: number;
  rowCount: number;
  loading: boolean;
  // CRUD Actions
  canEdit: boolean;
  hasSelectedRows: boolean;
  selectedCount: number;
  hasPendingChanges: boolean;
  pendingChangesCount: number;
  onInsert: () => void;
  onDelete: () => void;
  onSave: () => void;
  onDiscard: () => void;
  // Filter/View Actions
  showFilters: boolean;
  activeFiltersCount: number;
  onToggleFilters: () => void;
  onToggleColumns: () => void;
  onToggleViews: () => void;
  activeViewName?: string;
  savedViewsCount: number;
  // Utility Actions
  onRefresh: () => void;
  onExport?: () => void;
  onMore?: () => void;
}

export const TableToolbar: FC<TableToolbarProps> = ({
  schema,
  table,
  columnCount,
  rowCount,
  loading,
  canEdit,
  hasSelectedRows,
  selectedCount,
  hasPendingChanges,
  pendingChangesCount,
  onInsert,
  onDelete,
  onSave,
  onDiscard,
  showFilters,
  activeFiltersCount,
  onToggleFilters,
  onToggleColumns,
  onToggleViews,
  activeViewName,
  savedViewsCount,
  onRefresh,
  onExport,
  onMore,
}) => {
  return (
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
              {activeViewName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-vscode-accent">
                    <Bookmark className="h-3 w-3" />
                    {activeViewName}
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
              <AlertCircle className="h-3 w-3" />
              {pendingChangesCount} unsaved change{pendingChangesCount !== 1 ? 's' : ''}
            </div>
          )}
          {hasSelectedRows && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-vscode-accent/10 text-vscode-accent text-xs font-medium">
              {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-vscode-bg-light">
        <div className="flex items-center gap-2">
          {/* Data Operations Group */}
          {canEdit && (
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                icon={<Plus className="h-3.5 w-3.5" />}
                label="Insert"
                onClick={onInsert}
                tooltip="Insert new row"
                variant="default"
              />
              <ToolbarButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete"
                onClick={onDelete}
                disabled={!hasSelectedRows}
                tooltip={hasSelectedRows ? `Delete ${selectedCount} row(s)` : 'Select rows to delete'}
                variant="danger"
              />
              <div className="w-px h-5 bg-vscode-border mx-1" />
              <ToolbarButton
                icon={<Save className="h-3.5 w-3.5" />}
                label="Save"
                onClick={onSave}
                disabled={!hasPendingChanges}
                tooltip={hasPendingChanges ? `Save ${pendingChangesCount} change(s)` : 'No pending changes'}
                variant={hasPendingChanges ? 'primary' : 'default'}
              />
              <ToolbarButton
                icon={<X className="h-3.5 w-3.5" />}
                label="Discard"
                onClick={onDiscard}
                disabled={!hasPendingChanges}
                tooltip="Discard all pending changes"
                variant="default"
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
              active={showFilters || activeFiltersCount > 0}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              tooltip={activeFiltersCount > 0 ? `${activeFiltersCount} active filter(s)` : 'Toggle filters'}
              variant={activeFiltersCount > 0 ? 'accent' : 'default'}
            />
            <ToolbarButton
              icon={<Columns3 className="h-3.5 w-3.5" />}
              label="Columns"
              onClick={onToggleColumns}
              tooltip="Toggle column visibility"
              variant="default"
            />
            <ToolbarButton
              icon={<Bookmark className="h-3.5 w-3.5" />}
              label="Views"
              onClick={onToggleViews}
              badge={savedViewsCount > 0 ? savedViewsCount : undefined}
              tooltip="Saved views"
              variant={activeViewName ? 'accent' : 'default'}
              active={!!activeViewName}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-0.5">
          {onExport && (
            <ToolbarButton
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={onExport}
              tooltip="Export data"
              variant="default"
            />
          )}
          <ToolbarButton
            icon={<RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />}
            onClick={onRefresh}
            disabled={loading}
            tooltip="Refresh data"
            variant="default"
          />
          {onMore && (
            <ToolbarButton
              icon={<MoreHorizontal className="h-3.5 w-3.5" />}
              onClick={onMore}
              tooltip="More options"
              variant="default"
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Toolbar Button Component
interface ToolbarButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  badge?: number;
  tooltip?: string;
  variant?: 'default' | 'primary' | 'accent' | 'danger';
}

const ToolbarButton: FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  badge,
  tooltip,
  variant = 'default',
}) => {
  const getVariantClasses = () => {
    if (disabled) {
      return 'opacity-50 cursor-not-allowed text-vscode-text-muted';
    }

    switch (variant) {
      case 'primary':
        return 'bg-vscode-accent/10 text-vscode-accent hover:bg-vscode-accent/20';
      case 'accent':
        return 'bg-vscode-accent/10 text-vscode-accent hover:bg-vscode-accent/20';
      case 'danger':
        return 'text-vscode-text-muted hover:bg-vscode-error/10 hover:text-vscode-error';
      default:
        return active
          ? 'bg-vscode-accent/10 text-vscode-accent'
          : 'text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={clsx(
        'relative inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-all',
        getVariantClasses()
      )}
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
};
