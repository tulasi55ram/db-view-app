import { type FC, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/utils/cn";

export interface QueryResultsGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  loading?: boolean;
}

export const QueryResultsGrid: FC<QueryResultsGridProps> = ({ columns, rows, loading = false }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Setup virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 37, // Estimated row height in pixels
    overscan: 10, // Render 10 extra rows above and below viewport
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">
          <div className="h-8 w-8 mx-auto mb-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p>Executing query...</p>
        </div>
      </div>
    );
  }

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">No Results</p>
          <p className="text-sm text-text-tertiary">Query returned no data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* Status bar at top */}
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg-secondary text-xs text-text-secondary">
        <span className="font-medium">
          {rows.length.toLocaleString()} {rows.length === 1 ? "row" : "rows"} returned
        </span>
      </div>

      {/* Virtualized table container */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          {/* Sticky header */}
          <thead className="sticky top-0 bg-bg-tertiary border-b border-border z-10">
            <tr>
              {/* Row number column */}
              <th className="px-3 py-2 text-left font-medium text-text-secondary whitespace-nowrap w-12">#</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-medium text-text-primary whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Virtual rows container */}
            <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              <td colSpan={columns.length + 1} style={{ padding: 0, border: 'none' }}>
                <div style={{ position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.index}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <table className="w-full text-sm">
                          <tbody>
                            <tr className="border-b border-border hover:bg-bg-hover transition-colors">
                              {/* Row number */}
                              <td className="px-3 py-2 text-text-tertiary whitespace-nowrap font-mono text-xs w-12">
                                {virtualRow.index + 1}
                              </td>
                              {columns.map((column) => (
                                <td
                                  key={column}
                                  className={cn("px-3 py-2 whitespace-nowrap", getValueClassName(row[column]))}
                                >
                                  {formatCellValue(row[column])}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

function formatCellValue(value: unknown): string {
  if (value === null) {
    return "NULL";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "string" && value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  return String(value);
}

function getValueClassName(value: unknown): string {
  if (value === null) {
    return "text-text-tertiary italic";
  }
  if (typeof value === "number") {
    return "text-info font-mono";
  }
  if (typeof value === "boolean") {
    return "text-warning";
  }
  if (typeof value === "string") {
    return "text-text-primary";
  }
  return "text-text-secondary";
}
