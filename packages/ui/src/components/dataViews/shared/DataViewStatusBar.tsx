/**
 * Shared status bar component for all data views
 */

import type { FC } from "react";
import type { DatabaseType } from "@dbview/types";
import { DB_TYPE_LABELS, getRowLabel } from "../types";

interface DataViewStatusBarProps {
  dbType: DatabaseType;
  loading: boolean;
  connected?: boolean;
  hasPendingChanges?: boolean;
  pendingChangesCount?: number;
  hasSelectedRows?: boolean;
  selectedRowsCount?: number;
  readOnly?: boolean;
  customStatus?: string;
}

export const DataViewStatusBar: FC<DataViewStatusBarProps> = ({
  dbType,
  loading,
  connected = true,
  hasPendingChanges,
  pendingChangesCount = 0,
  hasSelectedRows,
  selectedRowsCount = 0,
  readOnly,
  customStatus,
}) => {
  return (
    <footer className="flex items-center justify-between border-t border-vscode-border bg-vscode-bg-light px-4 py-1.5 text-xs text-vscode-text-muted">
      <div className="flex items-center gap-4">
        <span>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-vscode-warning" />
              Loading data...
            </span>
          ) : connected ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-success" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-error" />
              Disconnected
            </span>
          )}
        </span>
        {hasPendingChanges && (
          <span className="flex items-center gap-1.5 text-vscode-warning">
            <span className="h-2 w-2 rounded-full bg-vscode-warning" />
            {pendingChangesCount} unsaved change{pendingChangesCount !== 1 ? 's' : ''}
          </span>
        )}
        {hasSelectedRows && (
          <span className="flex items-center gap-1.5">
            {selectedRowsCount} {getRowLabel(dbType, selectedRowsCount !== 1)} selected
          </span>
        )}
        {customStatus && (
          <span className="flex items-center gap-1.5">
            {customStatus}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {readOnly ? (
          <span className="text-vscode-warning">Read-only</span>
        ) : (
          <span>Editable</span>
        )}
        <span>{DB_TYPE_LABELS[dbType]}</span>
      </div>
    </footer>
  );
};
