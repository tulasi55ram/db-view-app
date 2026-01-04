import { useRef, useMemo, useState, useCallback, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Row,
  type ColumnResizeMode,
} from '@tanstack/react-table';
import clsx from 'clsx';
import type { ColumnMetadata } from '@dbview/types';
import { CellEditor } from './CellEditor';
import { formatCellValue } from '../utils/formatCellValue';
import { ScrollProgressBar } from './ScrollProgressBar';
import { ScrollButtons } from './ScrollButtons';
import { TableSkeleton } from './Skeleton';

// Row height constant for virtualization
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const OVERSCAN = 5;
const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 50;
const MAX_COLUMN_WIDTH = 500;

interface VirtualDataGridProps {
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  selectable?: boolean;
  selectedRows?: Set<number>;
  onRowSelectionChange?: (selectedRows: Set<number>) => void;
  editingCell?: { rowIndex: number; columnKey: string } | null;
  onStartEdit?: (rowIndex: number, columnKey: string) => void;
  onSaveEdit?: (rowIndex: number, columnKey: string, value: unknown) => void;
  onCancelEdit?: () => void;
  isPending?: (rowIndex: number, columnKey: string) => boolean;
  hasError?: (rowIndex: number, columnKey: string) => boolean;
  getEditValue?: (rowIndex: number, columnKey: string) => unknown;
  visibleColumns?: Set<string>;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  // Scroll status props
  totalRows?: number | null;
  currentPage?: number;
  pageSize?: number;
  offset?: number;
  // Jump to row callback
  onJumpToRow?: (rowIndex: number) => void;
}

// Memoized row component for performance
const VirtualRow = memo(function VirtualRow({
  row,
  style,
  isSelected,
  onSelectRow,
  editingCell,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isPending,
  hasError,
  getEditValue,
  columnMetadata,
  isEven,
}: {
  row: Row<Record<string, unknown>>;
  style: React.CSSProperties;
  isSelected: boolean;
  onSelectRow: (index: number) => void;
  editingCell?: { rowIndex: number; columnKey: string } | null;
  onStartEdit?: (rowIndex: number, columnKey: string) => void;
  onSaveEdit?: (rowIndex: number, columnKey: string, value: unknown) => void;
  onCancelEdit?: () => void;
  isPending: (rowIndex: number, columnKey: string) => boolean;
  hasError: (rowIndex: number, columnKey: string) => boolean;
  getEditValue: (rowIndex: number, columnKey: string) => unknown;
  columnMetadata: Map<string, ColumnMetadata>;
  isEven: boolean;
}) {
  const rowIndex = row.index;

  return (
    <div
      className={clsx(
        'flex border-b border-vscode-border transition-colors',
        isEven ? 'bg-vscode-bg/50' : '',
        isSelected && 'bg-vscode-accent/10',
        'hover:bg-vscode-bg-hover/30'
      )}
      style={style}
    >
      {row.getVisibleCells().map((cell) => {
        const columnKey = cell.column.id;
        const colMeta = columnMetadata.get(columnKey);
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === columnKey;
        const pending = isPending(rowIndex, columnKey);
        const error = hasError(rowIndex, columnKey);
        const displayValue = pending ? getEditValue(rowIndex, columnKey) : cell.getValue();

        return (
          <div
            key={cell.id}
            className="border-r border-vscode-border flex-shrink-0"
            style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
          >
            {columnKey === '__select' ? (
              <div className="flex items-center justify-center px-3 h-full">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectRow(rowIndex);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                />
              </div>
            ) : isEditing && colMeta ? (
              <CellEditor
                value={displayValue}
                column={colMeta}
                onSave={(newValue) => onSaveEdit?.(rowIndex, columnKey, newValue)}
                onCancel={() => onCancelEdit?.()}
              />
            ) : (
              <div
                className={clsx(
                  'px-3 py-2 h-full flex items-center transition-colors truncate',
                  pending && 'border-l-2 border-l-vscode-warning bg-vscode-warning/10',
                  error && 'border-l-2 border-l-vscode-error bg-vscode-error/10',
                  colMeta?.editable && 'cursor-pointer hover:bg-vscode-bg-hover'
                )}
                onDoubleClick={() => {
                  if (colMeta?.editable) {
                    onStartEdit?.(rowIndex, columnKey);
                  }
                }}
                title={formatCellValue(displayValue).title}
              >
                <span className={clsx('truncate', formatCellValue(displayValue).className)}>
                  {formatCellValue(displayValue).display}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export function VirtualDataGrid({
  columns: columnMetadata,
  rows,
  loading = false,
  selectable = false,
  selectedRows = new Set(),
  onRowSelectionChange,
  editingCell,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isPending = () => false,
  hasError = () => false,
  getEditValue = () => undefined,
  visibleColumns,
  sorting: controlledSorting,
  onSortingChange: onControlledSortingChange,
  totalRows,
  currentPage = 1,
  pageSize = 100,
  offset = 0,
}: VirtualDataGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 0 });

  // Use controlled sorting if provided, otherwise use internal state
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onControlledSortingChange ?? setInternalSorting;

  // Filter columns by visibility
  const filteredColumnMetadata = useMemo(() => {
    if (!visibleColumns) return columnMetadata;
    return columnMetadata.filter((col) => visibleColumns.has(col.name));
  }, [columnMetadata, visibleColumns]);

  // Create column metadata map for quick lookup
  const columnMetadataMap = useMemo(() => {
    const map = new Map<string, ColumnMetadata>();
    columnMetadata.forEach((col) => map.set(col.name, col));
    return map;
  }, [columnMetadata]);

  // Handle row selection
  const handleSelectRow = useCallback((rowIndex: number) => {
    const next = new Set(selectedRows);
    if (next.has(rowIndex)) {
      next.delete(rowIndex);
    } else {
      next.add(rowIndex);
    }
    onRowSelectionChange?.(next);
  }, [selectedRows, onRowSelectionChange]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === rows.length) {
      onRowSelectionChange?.(new Set());
    } else {
      onRowSelectionChange?.(new Set(rows.map((_, i) => i)));
    }
  }, [selectedRows, rows, onRowSelectionChange]);

  // Build TanStack Table columns
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [];

    // Selection checkbox column
    if (selectable) {
      cols.push({
        id: '__select',
        header: () => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={rows.length > 0 && selectedRows.size === rows.length}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectAll();
              }}
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer"
            />
          </div>
        ),
        cell: () => null, // Rendered in VirtualRow
        size: 40,
        enableSorting: false,
        enableResizing: false,
      });
    }

    // Data columns
    filteredColumnMetadata.forEach((col) => {
      cols.push({
        accessorKey: col.name,
        header: col.name,
        cell: () => null, // Rendered in VirtualRow
        size: DEFAULT_COLUMN_WIDTH,
        minSize: MIN_COLUMN_WIDTH,
        maxSize: MAX_COLUMN_WIDTH,
        enableResizing: true,
      });
    });

    return cols;
  }, [filteredColumnMetadata, selectable, rows.length, selectedRows.size, handleSelectAll]);

  // Column resize mode - onChange for real-time resizing
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Enable server-side sorting
    columnResizeMode,
    enableColumnResizing: true,
  });

  const { rows: tableRows } = table.getRowModel();

  // Virtual row renderer
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Calculate total width for horizontal scrolling
  const totalWidth = useMemo(() => {
    return table.getAllColumns().reduce((acc, col) => acc + (col.getSize() || 150), 0);
  }, [table]);

  // Debounce helper for scroll performance
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update scroll progress and visible range with debouncing
  const handleScroll = useCallback(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

    // Update progress immediately for smooth progress bar
    setScrollProgress(progress);

    // Debounce the visible row range calculation
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const startRow = Math.floor(scrollTop / ROW_HEIGHT);
      const endRow = Math.min(startRow + Math.ceil(clientHeight / ROW_HEIGHT), tableRows.length);
      setVisibleRowRange({ start: startRow, end: endRow });
    }, 16); // ~60fps
  }, [tableRows.length]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll handlers
  const scrollToTop = useCallback(() => {
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    const scrollElement = parentRef.current;
    if (scrollElement) {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if focus is within the grid
      if (!parentRef.current?.contains(document.activeElement) &&
          document.activeElement !== parentRef.current) {
        return;
      }

      if (e.key === 'Home' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        scrollToTop();
      } else if (e.key === 'End' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        scrollToBottom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollToTop, scrollToBottom]);

  // Initial scroll handler setup
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  if (loading) {
    return (
      <div className="h-full overflow-hidden">
        <TableSkeleton
          columns={columns.length || 5}
          rows={Math.floor((typeof window !== 'undefined' ? window.innerHeight : 600) / ROW_HEIGHT)}
          showRowNumbers={selectable}
          rowHeight={ROW_HEIGHT}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted">
        <div className="text-4xl mb-2">📭</div>
        <div>No data found</div>
      </div>
    );
  }

  // Calculate actual row range for status display
  const displayStartRow = offset + visibleRowRange.start + 1;
  const displayEndRow = Math.min(offset + visibleRowRange.end, totalRows ?? offset + rows.length);

  return (
    <div className="relative h-full flex flex-col">
      {/* Scroll Progress Bar */}
      <ScrollProgressBar progress={scrollProgress} />

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        tabIndex={0}
      >
        {/* Fixed width container for horizontal scroll */}
        <div style={{ minWidth: totalWidth, width: 'fit-content' }}>
          {/* Sticky Header */}
          <div
            className="sticky top-0 z-20 bg-vscode-bg-lighter flex border-b border-vscode-border"
            style={{ height: HEADER_HEIGHT, minWidth: totalWidth }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex">
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className={clsx(
                      'relative px-3 py-2 flex items-center font-semibold text-vscode-text border-r border-vscode-border flex-shrink-0',
                      header.column.getCanSort() && 'cursor-pointer hover:bg-vscode-bg-hover select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.column.getSize(), minWidth: header.column.getSize() }}
                  >
                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                      {header.column.id === '__select' ? (
                        <div className="flex items-center justify-center w-full">
                          <input
                            type="checkbox"
                            checked={rows.length > 0 && selectedRows.size === rows.length}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectAll();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                          />
                        </div>
                      ) : (
                        <>
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </>
                      )}
                    </div>
                    {/* Column resize handle */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          // Reset to default width on double-click
                          header.column.resetSize();
                        }}
                        className={clsx(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          'hover:bg-vscode-accent transition-colors',
                          header.column.getIsResizing() && 'bg-vscode-accent'
                        )}
                        title="Drag to resize column, double-click to reset"
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Virtual Body */}
          <div
            style={{
              height: `${totalSize}px`,
              position: 'relative',
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              const isSelected = selectedRows.has(virtualRow.index);

              return (
                <VirtualRow
                  key={row.id}
                  row={row}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  isSelected={isSelected}
                  onSelectRow={handleSelectRow}
                  editingCell={editingCell}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  isPending={isPending}
                  hasError={hasError}
                  getEditValue={getEditValue}
                  columnMetadata={columnMetadataMap}
                  isEven={virtualRow.index % 2 === 1}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Scroll Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-vscode-bg-light border-t border-vscode-border text-xs text-vscode-text-muted flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Rows {displayStartRow.toLocaleString()}-{displayEndRow.toLocaleString()}
            {totalRows !== null && ` of ${totalRows.toLocaleString()}`}
          </span>
          {currentPage && pageSize && (
            <>
              <span className="text-vscode-border">|</span>
              <span>Page {currentPage}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-vscode-text-muted">
          <span className="text-[10px]">Home/End to scroll</span>
        </div>
      </div>

      {/* Floating Scroll Buttons */}
      <ScrollButtons
        onScrollToTop={scrollToTop}
        onScrollToBottom={scrollToBottom}
        showTopButton={scrollProgress > 10}
        showBottomButton={scrollProgress < 90}
      />
    </div>
  );
}
