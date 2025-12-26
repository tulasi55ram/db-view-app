import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";

interface TableViewProps {
  connectionKey: string;
  schema: string;
  table: string;
}

export function TableView({ connectionKey, schema, table }: TableViewProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  const api = getElectronAPI();

  const loadData = useCallback(async () => {
    if (!api) {
      setError("Electron API not available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load table rows
      const result = await api.loadTableRows({
        connectionKey,
        schema,
        table,
        limit,
        offset,
      });

      setColumns(result.columns);
      setRows(result.rows);

      // Load row count
      const count = await api.getRowCount({
        connectionKey,
        schema,
        table,
      });

      setTotalRows(count);
    } catch (err) {
      console.error("Failed to load table data:", err);
      setError(err instanceof Error ? err.message : "Failed to load table data");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, schema, table, limit, offset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-text-secondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading table data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-error max-w-md text-center">
          <AlertCircle className="w-10 h-10" />
          <div>
            <h3 className="text-lg font-semibold mb-1">Error Loading Table</h3>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="mt-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">No Data</p>
          <p className="text-sm text-text-tertiary">
            Table {schema}.{table} is empty
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">
            {schema}.{table}
          </span>
          <span>•</span>
          <span>
            {rows.length} {rows.length === 1 ? "row" : "rows"}
            {totalRows !== null && ` of ${totalRows}`}
          </span>
        </div>
        <button
          onClick={loadData}
          className="p-1.5 rounded hover:bg-bg-hover transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bg-tertiary border-b border-border">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-left font-medium text-text-primary whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border hover:bg-bg-hover transition-colors"
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-3 py-2 text-text-primary whitespace-nowrap"
                  >
                    {formatCellValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination info */}
      {totalRows !== null && totalRows > limit && (
        <div className="h-10 px-4 flex items-center justify-between border-t border-border bg-bg-secondary text-sm text-text-secondary">
          <span>
            Showing {offset + 1}-{Math.min(offset + limit, totalRows)} of {totalRows}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className={cn(
                "px-3 py-1 rounded",
                offset === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-bg-hover"
              )}
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= totalRows}
              className={cn(
                "px-3 py-1 rounded",
                offset + limit >= totalRows
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-bg-hover"
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null) {
    return "NULL";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
