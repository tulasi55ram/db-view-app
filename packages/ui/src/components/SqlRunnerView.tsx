import type { FC, ChangeEvent } from "react";
import { DataGrid, type DataGridColumn } from "./DataGrid";

export interface SqlRunnerViewProps {
  sql: string;
  onSqlChange: (value: string) => void;
  onRunQuery: () => void;
  loading: boolean;
  error?: string;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
}

export const SqlRunnerView: FC<SqlRunnerViewProps> = ({
  sql,
  onSqlChange,
  onRunQuery,
  loading,
  error,
  columns,
  rows
}) => {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-3">
        <h1 className="text-xl font-semibold">SQL Runner</h1>
        <p className="text-sm text-slate-500">Execute ad-hoc queries</p>
      </header>
      <section className="flex flex-col gap-3 border-b border-slate-900 bg-slate-900/40 px-4 py-4">
        <label className="text-xs uppercase tracking-widest text-slate-500">SQL</label>
        <textarea
          className="h-32 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-sm text-slate-100 shadow-inner focus:border-brand focus:outline-none"
          value={sql}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onSqlChange(event.target.value)}
          placeholder="SELECT * FROM public.users LIMIT 50;"
        />
        <div className="flex items-center gap-3">
          <button
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-brand-dark"
            onClick={onRunQuery}
            disabled={loading}
          >
            {loading ? "Running…" : "Run Query"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </section>
      <main className="flex-1 overflow-auto p-4">
        {columns.length ? (
          <DataGrid columns={columns} rows={rows} />
        ) : (
          <p className="text-sm text-slate-500">Run a query to see results.</p>
        )}
      </main>
    </div>
  );
};
