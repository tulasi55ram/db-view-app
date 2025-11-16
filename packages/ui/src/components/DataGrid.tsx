import type { FC } from "react";

export interface DataGridColumn {
  key: string;
  label: string;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
}

export const DataGrid: FC<DataGridProps> = ({ columns, rows }) => {
  return (
    <div className="overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-inner">
      <table className="min-w-full text-left text-sm text-slate-200">
        <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-slate-800/60">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 text-slate-100">
                  {formatCellValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
