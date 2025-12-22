import { FC, useCallback, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;       // 1-indexed
  pageSize: number;          // rows per page
  totalRows: number | null;  // null if not yet known
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  loading = false
}) => {
  const [gotoPageInput, setGotoPageInput] = useState('');

  const totalPages = totalRows !== null ? Math.ceil(totalRows / pageSize) : null;
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = totalRows !== null
    ? Math.min(currentPage * pageSize, totalRows)
    : currentPage * pageSize;

  const canGoPrevious = currentPage > 1;
  const canGoNext = totalPages !== null ? currentPage < totalPages : true;

  const handleFirst = useCallback(() => {
    if (canGoPrevious) onPageChange(1);
  }, [canGoPrevious, onPageChange]);

  const handlePrevious = useCallback(() => {
    if (canGoPrevious) onPageChange(currentPage - 1);
  }, [canGoPrevious, currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (canGoNext) onPageChange(currentPage + 1);
  }, [canGoNext, currentPage, onPageChange]);

  const handleLast = useCallback(() => {
    if (totalPages !== null) onPageChange(totalPages);
  }, [totalPages, onPageChange]);

  const handleGotoPage = useCallback(() => {
    const page = parseInt(gotoPageInput, 10);
    if (isNaN(page) || page < 1) return;

    if (totalPages !== null && page > totalPages) {
      onPageChange(totalPages);
    } else {
      onPageChange(page);
    }
    setGotoPageInput('');
  }, [gotoPageInput, totalPages, onPageChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGotoPage();
    } else if (e.key === 'Escape') {
      setGotoPageInput('');
    }
  }, [handleGotoPage]);

  // Keyboard shortcuts (Ctrl+Arrow)
  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (canGoPrevious) onPageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (canGoNext) onPageChange(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [currentPage, canGoPrevious, canGoNext, onPageChange]);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-vscode-border bg-vscode-bg-light text-xs">
      {/* Row Info */}
      <div className="flex items-center gap-2 text-vscode-text-muted">
        <span>
          Showing {startRow}-{endRow}
          {totalRows !== null && ` of ${totalRows.toLocaleString()}`} rows
        </span>

        {/* Page Size Selector */}
        <span className="mx-2">|</span>
        <label className="flex items-center gap-1.5">
          Per page:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-vscode-bg-lighter border border-vscode-border rounded px-2 py-0.5 text-vscode-text cursor-pointer hover:bg-vscode-bg-hover"
            disabled={loading}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        <PaginationButton
          onClick={handleFirst}
          disabled={!canGoPrevious || loading}
          title="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </PaginationButton>

        <PaginationButton
          onClick={handlePrevious}
          disabled={!canGoPrevious || loading}
          title="Previous page (Ctrl+←)"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PaginationButton>

        {/* Go to Page Input */}
        <div className="flex items-center gap-1.5">
          <span className="text-vscode-text-muted">Page</span>
          <input
            type="text"
            value={gotoPageInput || currentPage}
            onChange={(e) => setGotoPageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleGotoPage}
            className="w-12 bg-vscode-bg-lighter border border-vscode-border rounded px-2 py-0.5 text-center text-vscode-text"
            disabled={loading}
          />
          {totalPages !== null && (
            <>
              <span className="text-vscode-text-muted">of</span>
              <span className="text-vscode-text">{totalPages.toLocaleString()}</span>
            </>
          )}
        </div>

        <PaginationButton
          onClick={handleNext}
          disabled={!canGoNext || loading}
          title="Next page (Ctrl+→)"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PaginationButton>

        <PaginationButton
          onClick={handleLast}
          disabled={!canGoNext || loading || totalPages === null}
          title="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </PaginationButton>
      </div>
    </div>
  );
};

interface PaginationButtonProps {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}

const PaginationButton: FC<PaginationButtonProps> = ({ onClick, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-vscode-bg-hover text-vscode-text"
  >
    {children}
  </button>
);
