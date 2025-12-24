import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import clsx from 'clsx';
import type { ColumnMetadata } from '@dbview/core';
import { CellEditor } from './CellEditor';
import { formatCellValue } from '../utils/formatCellValue';

interface DataGridV2Props {
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
}

export function DataGridV2({
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
}: DataGridV2Props) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);

  // Use controlled sorting if provided, otherwise use internal state
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onControlledSortingChange ?? setInternalSorting;

  // Filter columns by visibility
  const filteredColumnMetadata = useMemo(() => {
    if (!visibleColumns) return columnMetadata;
    return columnMetadata.filter((col) => visibleColumns.has(col.name));
  }, [columnMetadata, visibleColumns]);

  // Build TanStack Table columns
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [];

    // Selection checkbox column
    if (selectable) {
      cols.push({
        id: '__select',
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={table.getIsAllRowsSelected()}
              onChange={table.getToggleAllRowsSelectedHandler()}
              className="cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center px-3 py-1.5">
            <input
              type="checkbox"
              checked={selectedRows.has(row.index)}
              onChange={() => {
                const next = new Set(selectedRows);
                if (next.has(row.index)) {
                  next.delete(row.index);
                } else {
                  next.add(row.index);
                }
                onRowSelectionChange?.(next);
              }}
              className="cursor-pointer"
            />
          </div>
        ),
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
        cell: ({ row, getValue }) => {
          const rowIndex = row.index;
          const columnKey = col.name;
          const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === columnKey;
          const pending = isPending(rowIndex, columnKey);
          const error = hasError(rowIndex, columnKey);

          // Get display value (use pending edit if exists)
          const displayValue = pending ? getEditValue(rowIndex, columnKey) : getValue();

          if (isEditing) {
            return (
              <CellEditor
                value={displayValue}
                column={col}
                onSave={(newValue) => onSaveEdit?.(rowIndex, columnKey, newValue)}
                onCancel={() => onCancelEdit?.()}
              />
            );
          }

          const formatted = formatCellValue(displayValue);

          return (
            <div
              className={clsx(
                'px-3 py-1.5 transition-colors',
                pending && 'border-l-2 border-l-vscode-warning bg-vscode-warning/10',
                error && 'border-l-2 border-l-vscode-error bg-vscode-error/10',
                col.editable && 'cursor-pointer hover:bg-vscode-bg-hover'
              )}
              onDoubleClick={() => {
                if (col.editable) {
                  onStartEdit?.(rowIndex, columnKey);
                }
              }}
              title={formatted.title}
            >
              <span className={formatted.className}>{formatted.display}</span>
            </div>
          );
        },
        size: 150,
      });
    });

    return cols;
  }, [filteredColumnMetadata, selectable, selectedRows, editingCell, onRowSelectionChange, onStartEdit, onSaveEdit, onCancelEdit, isPending, hasError, getEditValue]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-vscode-text-muted">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-vscode-text-muted">
        <div className="text-4xl mb-2">📭</div>
        <div>No data found</div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-vscode-bg-lighter border-b border-vscode-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={clsx(
                    "px-3 py-2 text-left font-semibold text-vscode-text border-r border-vscode-border last:border-r-0",
                    header.column.getCanSort() && "cursor-pointer hover:bg-vscode-bg-hover"
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' ↑',
                      desc: ' ↓',
                    }[header.column.getIsSorted() as string] ?? null}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={clsx(
                "border-b border-vscode-border transition-colors",
                rowIndex % 2 === 1 ? "bg-vscode-bg/50" : "",
                "hover:bg-vscode-bg-hover/30"
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border-r border-vscode-border last:border-r-0 p-0">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
