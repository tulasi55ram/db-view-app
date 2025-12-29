import { useState, useEffect, useCallback } from "react";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";

interface JumpToRowDialogProps {
  open: boolean;
  onClose: () => void;
  totalRows: number | null;
  currentOffset: number;
  pageSize: number;
  onJumpToRow: (rowIndex: number) => void;
  onChangePage: (newOffset: number) => void;
}

export function JumpToRowDialog({
  open,
  onClose,
  totalRows,
  currentOffset,
  pageSize,
  onJumpToRow,
  onChangePage,
}: JumpToRowDialogProps) {
  const [rowNumber, setRowNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRowNumber("");
      setError(null);
    }
  }, [open]);

  const handleJump = useCallback(() => {
    const num = parseInt(rowNumber, 10);

    if (isNaN(num) || num < 1) {
      setError("Please enter a valid row number");
      return;
    }

    if (totalRows !== null && num > totalRows) {
      setError(`Row number must be between 1 and ${totalRows.toLocaleString()}`);
      return;
    }

    // Calculate which page this row is on
    const pageStartRow = currentOffset + 1;
    const pageEndRow = currentOffset + pageSize;

    if (num >= pageStartRow && num <= pageEndRow) {
      // Row is on current page - scroll to it
      const localRowIndex = num - pageStartRow;
      onJumpToRow(localRowIndex);
      onClose();
    } else {
      // Row is on a different page - navigate to that page
      const newOffset = Math.floor((num - 1) / pageSize) * pageSize;
      onChangePage(newOffset);
      // After page change, the row should be visible
      // We'll scroll to the relative position after data loads
      onClose();
    }
  }, [rowNumber, totalRows, currentOffset, pageSize, onJumpToRow, onChangePage, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleJump();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleJump, onClose]
  );

  // Calculate current page row range for display
  const pageStartRow = currentOffset + 1;
  const pageEndRow = Math.min(currentOffset + pageSize, totalRows ?? currentOffset + pageSize);
  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = totalRows !== null ? Math.ceil(totalRows / pageSize) : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-[400px] rounded-lg border border-border bg-bg-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Jump to Row</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Row Number Input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary">Row Number</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rowNumber}
                onChange={(e) => {
                  setRowNumber(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`1-${totalRows?.toLocaleString() ?? "..."}`}
                className={cn(
                  "flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded text-sm text-text-primary",
                  "placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                )}
                autoFocus
                min={1}
                max={totalRows ?? undefined}
              />
              <button
                onClick={handleJump}
                className="px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Go
              </button>
            </div>
            <p className="text-[11px] text-text-tertiary">
              Viewing rows {pageStartRow.toLocaleString()}-{pageEndRow.toLocaleString()}
              {totalRows !== null && ` of ${totalRows.toLocaleString()}`}
              {totalPages !== null && ` (Page ${currentPage} of ${totalPages})`}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 bg-error/10 border border-error/30 rounded text-xs text-error">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-bg-secondary/50 flex items-center justify-between rounded-b-lg">
          <span className="text-[11px] text-text-tertiary">
            Shortcut:{" "}
            <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded border border-border text-[10px]">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+G
            </kbd>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
