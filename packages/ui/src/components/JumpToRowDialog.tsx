import { useState, useEffect, useCallback, type FC } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ArrowRight, Search } from 'lucide-react';
import type { ColumnMetadata } from '@dbview/types';

interface JumpToRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRows: number | null;
  currentPage: number;
  pageSize: number;
  offset: number;
  columns?: ColumnMetadata[];
  onJumpToRow: (rowIndex: number) => void;
  onSearchByColumn?: (column: string, value: string) => void;
}

export const JumpToRowDialog: FC<JumpToRowDialogProps> = ({
  open,
  onOpenChange,
  totalRows,
  currentPage,
  pageSize,
  offset,
  columns = [],
  onJumpToRow,
  onSearchByColumn,
}) => {
  const [rowNumber, setRowNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchColumn, setSearchColumn] = useState('');
  const [searchValue, setSearchValue] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRowNumber('');
      setError(null);
      setSearchColumn(columns[0]?.name || '');
      setSearchValue('');
    }
  }, [open, columns]);

  const handleJump = useCallback(() => {
    const num = parseInt(rowNumber, 10);

    if (isNaN(num) || num < 1) {
      setError('Please enter a valid row number');
      return;
    }

    if (totalRows !== null && num > totalRows) {
      setError(`Row number must be between 1 and ${totalRows.toLocaleString()}`);
      return;
    }

    // Calculate which row index within the current page
    // If the row is on the current page, scroll to it directly
    const pageStartRow = offset + 1;
    const pageEndRow = offset + pageSize;

    if (num >= pageStartRow && num <= pageEndRow) {
      // Row is on current page - scroll to it
      const localRowIndex = num - pageStartRow;
      onJumpToRow(localRowIndex);
      onOpenChange(false);
    } else {
      // Row is on a different page - need to change page first
      // For now, just show an error since we'd need page navigation
      setError(`Row ${num} is on page ${Math.ceil(num / pageSize)}. Navigate to that page first.`);
    }
  }, [rowNumber, totalRows, offset, pageSize, onJumpToRow, onOpenChange]);

  const handleSearch = useCallback(() => {
    if (!searchColumn || !searchValue.trim()) {
      setError('Please select a column and enter a search value');
      return;
    }

    onSearchByColumn?.(searchColumn, searchValue.trim());
    onOpenChange(false);
  }, [searchColumn, searchValue, onSearchByColumn, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleJump();
    }
  }, [handleJump]);

  // Calculate current page row range for display
  const pageStartRow = offset + 1;
  const pageEndRow = Math.min(offset + pageSize, totalRows ?? offset + pageSize);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] bg-vscode-bg-light border border-vscode-border rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
            <Dialog.Title className="text-sm font-semibold text-vscode-text-bright flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-vscode-accent" />
              Jump to Row
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Row Number Input */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-vscode-text-muted">
                Row Number
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={rowNumber}
                  onChange={(e) => {
                    setRowNumber(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`1-${totalRows?.toLocaleString() ?? '...'}`}
                  className="flex-1 px-3 py-2 bg-vscode-bg border border-vscode-border rounded text-sm text-vscode-text placeholder:text-vscode-text-muted focus:outline-none focus:border-vscode-accent"
                  autoFocus
                  min={1}
                  max={totalRows ?? undefined}
                />
                <button
                  onClick={handleJump}
                  className="px-4 py-2 bg-vscode-accent text-white rounded text-sm font-medium hover:bg-vscode-accent/90 transition-colors"
                >
                  Go
                </button>
              </div>
              <p className="text-[11px] text-vscode-text-muted">
                Current view: rows {pageStartRow.toLocaleString()}-{pageEndRow.toLocaleString()}
                {totalRows !== null && ` of ${totalRows.toLocaleString()}`}
              </p>
            </div>

            {/* Divider */}
            {columns.length > 0 && onSearchByColumn && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-vscode-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-vscode-bg-light text-xs text-vscode-text-muted">
                      Or search by column
                    </span>
                  </div>
                </div>

                {/* Column Search */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={searchColumn}
                      onChange={(e) => setSearchColumn(e.target.value)}
                      className="w-1/3 px-2 py-2 bg-vscode-bg border border-vscode-border rounded text-sm text-vscode-text focus:outline-none focus:border-vscode-accent"
                    >
                      {columns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Search value..."
                      className="flex-1 px-3 py-2 bg-vscode-bg border border-vscode-border rounded text-sm text-vscode-text placeholder:text-vscode-text-muted focus:outline-none focus:border-vscode-accent"
                    />
                    <button
                      onClick={handleSearch}
                      className="px-3 py-2 bg-vscode-bg-lighter border border-vscode-border rounded hover:bg-vscode-bg-hover transition-colors"
                      title="Search"
                    >
                      <Search className="h-4 w-4 text-vscode-text" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="px-3 py-2 bg-vscode-error/10 border border-vscode-error/30 rounded text-xs text-vscode-error">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-vscode-border bg-vscode-bg/50 flex items-center justify-between">
            <span className="text-[11px] text-vscode-text-muted">
              Shortcut: <kbd className="px-1.5 py-0.5 bg-vscode-bg rounded border border-vscode-border text-[10px]">Ctrl+G</kbd>
            </span>
            <Dialog.Close asChild>
              <button className="px-3 py-1.5 text-xs text-vscode-text-muted hover:text-vscode-text">
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
