/**
 * Shared toolbar component for all data views
 * Provides consistent UI across SQL, MongoDB, and Redis views
 */

import type { FC, ReactNode } from "react";
import type { DatabaseType } from "@dbview/types";
import { DB_TYPE_LABELS, getSchemaLabel, getTableLabel, getRowLabel } from "../types";
import {
  RefreshCw,
  Table2,
  Database,
  FileJson,
  Key,
  MoreHorizontal,
} from "lucide-react";
import clsx from "clsx";

interface DataViewToolbarProps {
  // Context
  dbType: DatabaseType;
  schema: string;
  table: string;

  // Stats
  columnCount: number;
  rowCount: number;
  totalRows: number | null;
  loading: boolean;

  // Actions
  onRefresh: () => void;

  // Status indicators
  hasPendingChanges?: boolean;
  pendingChangesCount?: number;
  hasSelectedRows?: boolean;
  selectedRowsCount?: number;

  // Active view indicator (for saved views)
  activeViewName?: string;

  // Custom actions slot
  leftActions?: ReactNode;
  rightActions?: ReactNode;

  // Read-only mode
  readOnly?: boolean;
}

export const DataViewToolbar: FC<DataViewToolbarProps> = ({
  dbType,
  schema,
  table,
  columnCount,
  rowCount,
  totalRows,
  loading,
  onRefresh,
  hasPendingChanges,
  pendingChangesCount = 0,
  hasSelectedRows,
  selectedRowsCount = 0,
  activeViewName,
  leftActions,
  rightActions,
  readOnly,
}) => {
  const schemaLabel = getSchemaLabel(dbType);
  const tableLabel = getTableLabel(dbType);
  const rowLabel = getRowLabel(dbType, true);

  // Get appropriate icon based on database type
  const getIcon = () => {
    switch (dbType) {
      case 'mongodb':
        return <FileJson className="h-4 w-4 text-vscode-accent" />;
      case 'redis':
        return <Key className="h-4 w-4 text-vscode-accent" />;
      default:
        return <Table2 className="h-4 w-4 text-vscode-accent" />;
    }
  };

  return (
    <div className="flex flex-col border-b border-vscode-border bg-vscode-bg">
      {/* Header Row - Table Info */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-vscode-bg-light/50">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-vscode-accent/10">
            {getIcon()}
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
              <span>
                {loading ? 'Loading...' : `${rowCount.toLocaleString()} ${rowLabel}`}
                {totalRows !== null && totalRows !== rowCount && ` of ${totalRows.toLocaleString()}`}
              </span>
              <span>•</span>
              <span className="text-vscode-accent">{DB_TYPE_LABELS[dbType]}</span>
              {readOnly && (
                <>
                  <span>•</span>
                  <span className="text-vscode-warning">Read-only</span>
                </>
              )}
              {activeViewName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-vscode-accent">
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
              <div className="h-1.5 w-1.5 rounded-full bg-vscode-warning animate-pulse" />
              {pendingChangesCount} unsaved change{pendingChangesCount !== 1 ? 's' : ''}
            </div>
          )}
          {hasSelectedRows && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-vscode-accent/10 text-vscode-accent text-xs font-medium">
              {selectedRowsCount} {getRowLabel(dbType, selectedRowsCount !== 1)} selected
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-vscode-bg-light">
        <div className="flex items-center gap-2">
          {leftActions}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-0.5">
          {rightActions}
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
  );
};

// Toolbar Button Component (exported for use in specific views)
export interface ToolbarButtonProps {
  icon: ReactNode;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
  danger?: boolean;
  badge?: number;
}

export const ToolbarButton: FC<ToolbarButtonProps> = ({
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
