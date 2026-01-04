import type { FC } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ColumnMetadata } from "@dbview/types";
import { AlertTriangle } from "lucide-react";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowCount: number;
  selectedRows: Record<string, unknown>[];
  columns: ColumnMetadata[];
  onConfirm: () => void;
}

export const DeleteConfirmDialog: FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  rowCount,
  selectedRows,
  columns,
  onConfirm
}) => {
  const primaryKeyColumns = columns.filter((col) => col.isPrimaryKey);
  const hasNoPrimaryKey = primaryKeyColumns.length === 0;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg border border-red-500/50 bg-vscode-bg-light p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <AlertDialog.Title className="text-lg font-semibold text-vscode-text-bright">
                Delete {rowCount} {rowCount === 1 ? "Row" : "Rows"}?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-vscode-text-muted">
                {hasNoPrimaryKey ? (
                  <span className="text-red-400">
                    Warning: This table has no primary key. Deletion may affect unintended rows.
                  </span>
                ) : (
                  <>
                    This action cannot be undone. This will permanently delete{" "}
                    {rowCount === 1 ? "this row" : `these ${rowCount} rows`} from the database.
                  </>
                )}
              </AlertDialog.Description>

              {!hasNoPrimaryKey && selectedRows.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-vscode-text-muted">
                    {selectedRows.length <= 10
                      ? "Rows to be deleted:"
                      : `Showing ${Math.min(10, selectedRows.length)} of ${selectedRows.length} rows:`}
                  </p>
                  <div className="max-h-[200px] overflow-y-auto rounded border border-vscode-border bg-vscode-bg p-2 space-y-1.5">
                    {selectedRows.slice(0, 10).map((row, idx) => {
                      // Show primary keys and up to 2 other identifying columns
                      const displayColumns = [
                        ...primaryKeyColumns,
                        ...columns.filter((col) => !col.isPrimaryKey).slice(0, 2)
                      ];

                      return (
                        <div key={idx} className="text-xs font-mono text-vscode-text border-b border-vscode-border/30 last:border-0 pb-1.5 last:pb-0">
                          {displayColumns.map((col, colIdx) => (
                            <div key={col.name} className="truncate">
                              {colIdx === 0 && primaryKeyColumns.length > 0 && (
                                <span className="text-vscode-text-muted mr-1">#{idx + 1}</span>
                              )}
                              <span className="text-vscode-text-muted">{col.name}:</span>{" "}
                              <span className={col.isPrimaryKey ? "text-vscode-accent font-semibold" : "text-vscode-text"}>
                                {String(row[col.name] ?? "NULL")}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {selectedRows.length > 10 && (
                      <div className="text-xs text-vscode-warning italic pt-1.5 text-center">
                        ... and {selectedRows.length - 10} more rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {columns.some((col) => col.isForeignKey) && (
                <div className="mt-4 rounded border border-vscode-warning/50 bg-vscode-warning/10 p-3">
                  <p className="text-xs text-vscode-warning flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    This table has foreign key constraints. Deleting these rows may fail if referenced by other tables.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 text-sm font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium rounded bg-vscode-error hover:bg-vscode-error/90 text-white transition-colors"
              >
                {hasNoPrimaryKey ? "Delete Anyway" : "Delete"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
