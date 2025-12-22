import type { FC } from "react";
import { useMemo } from "react";
import clsx from "clsx";

export interface DataGridColumn {
  key: string;
  label: string;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  showRowNumbers?: boolean;
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
  selectedRowIndex?: number;
  emptyMessage?: string;
}

export const DataGrid: FC<DataGridProps> = ({
  columns,
  rows,
  loading = false,
  showRowNumbers = true,
  onRowClick,
  selectedRowIndex,
  emptyMessage = "No data to display"
}) => {
  const isEmpty = !loading && rows.length === 0;

  if (loading) {
    return <DataGridSkeleton columns={columns.length} showRowNumbers={showRowNumbers} />;
  }

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded border border-vscode-border bg-vscode-bg-light">
        <div className="text-center">
          <div className="mb-2 text-4xl opacity-30">📭</div>
          <p className="text-sm text-vscode-text-muted">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded border border-vscode-border bg-vscode-bg-light">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-vscode-bg-lighter">
          <tr>
            {showRowNumbers && (
              <th className="w-12 border-b border-r border-vscode-border px-3 py-2 text-center text-xs font-medium text-vscode-text-muted">
                #
              </th>
            )}
            {columns.map((column, index) => (
              <th
                key={column.key}
                className={clsx(
                  "border-b border-vscode-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-vscode-text-muted",
                  index < columns.length - 1 && "border-r"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{column.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row, rowIndex)}
              className={clsx(
                "group transition-colors",
                rowIndex % 2 === 1 && "bg-vscode-bg/50",
                onRowClick && "cursor-pointer",
                selectedRowIndex === rowIndex
                  ? "bg-vscode-bg-active"
                  : "hover:bg-vscode-bg-hover"
              )}
            >
              {showRowNumbers && (
                <td className="border-r border-vscode-border/50 px-3 py-1.5 text-center text-xs text-vscode-text-muted">
                  {rowIndex + 1}
                </td>
              )}
              {columns.map((column, colIndex) => (
                <td
                  key={column.key}
                  className={clsx(
                    "px-3 py-1.5 font-mono text-sm",
                    colIndex < columns.length - 1 && "border-r border-vscode-border/30"
                  )}
                >
                  <CellValue value={row[column.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Cell value component with type-based formatting
const CellValue: FC<{ value: unknown }> = ({ value }) => {
  const { display, className, title } = useMemo(() => formatCellValue(value), [value]);

  return (
    <span className={clsx("block truncate", className)} title={title}>
      {display}
    </span>
  );
};

interface FormattedValue {
  display: string;
  className: string;
  title?: string;
}

function formatCellValue(value: unknown): FormattedValue {
  if (value === null) {
    return { display: "NULL", className: "cell-null", title: "NULL" };
  }

  if (value === undefined) {
    return { display: "—", className: "text-vscode-text-muted", title: "undefined" };
  }

  if (typeof value === "boolean") {
    return {
      display: value ? "true" : "false",
      className: value ? "cell-boolean" : "cell-boolean opacity-70",
      title: String(value)
    };
  }

  if (typeof value === "number") {
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return { display: formatted, className: "cell-number", title: String(value) };
  }

  if (value instanceof Date) {
    const iso = value.toISOString();
    return { display: iso, className: "text-vscode-text", title: iso };
  }

  if (Array.isArray(value)) {
    const json = JSON.stringify(value);
    return {
      display: `[${value.length}]`,
      className: "cell-json",
      title: json
    };
  }

  if (typeof value === "object") {
    const json = JSON.stringify(value, null, 2);
    return {
      display: "{...}",
      className: "cell-json",
      title: json
    };
  }

  const str = String(value);
  const isLong = str.length > 100;
  return {
    display: isLong ? str.slice(0, 100) + "…" : str,
    className: "text-vscode-text",
    title: str
  };
}

// Skeleton loader for loading state
const DataGridSkeleton: FC<{ columns: number; showRowNumbers: boolean }> = ({
  columns,
  showRowNumbers
}) => {
  const skeletonRows = 8;
  const totalCols = showRowNumbers ? columns + 1 : columns;

  return (
    <div className="overflow-hidden rounded border border-vscode-border bg-vscode-bg-light">
      <table className="min-w-full">
        <thead className="bg-vscode-bg-lighter">
          <tr>
            {Array.from({ length: totalCols }).map((_, i) => (
              <th key={i} className="border-b border-vscode-border px-3 py-2">
                <div className="skeleton h-4 w-20 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 1 ? "bg-vscode-bg/50" : ""}>
              {Array.from({ length: totalCols }).map((_, colIndex) => (
                <td key={colIndex} className="px-3 py-1.5">
                  <div
                    className="skeleton h-4 rounded"
                    style={{ width: `${60 + Math.random() * 40}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
