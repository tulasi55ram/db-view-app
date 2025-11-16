import type { FC } from "react";
import { DataGrid, type DataGridColumn } from "./DataGrid";

export interface TableViewProps {
  schema: string;
  table: string;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  loading: boolean;
  onRefresh?: () => void;
}

export const TableView: FC<TableViewProps> = ({
  schema,
  table,
  columns,
  rows,
  loading,
  onRefresh
}) => {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{schema}</p>
          <h1 className="text-xl font-semibold">{table}</h1>
        </div>
        <button
          className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 transition hover:bg-slate-800"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>
      <main className="flex-1 overflow-auto p-4">
        {columns.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <DataGrid columns={columns} rows={rows} />
        )}
      </main>
    </div>
  );
};

const EmptyState: FC<{ loading: boolean }> = ({ loading }) => (
  <div className="flex h-full items-center justify-center text-slate-400">
    {loading ? "Loading rows…" : "No data"}
  </div>
);
