import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataGridColumn } from "./components/DataGrid";
import { TableView } from "./components/TableView";
import { SqlRunnerView } from "./components/SqlRunnerView";
import { getVsCodeApi } from "./vscode";

type IncomingMessage =
  | { type: "INIT_TABLE_VIEW"; schema: string; table: string; limit?: number }
  | { type: "LOAD_TABLE_ROWS"; schema: string; table: string; columns: string[]; rows: Record<string, unknown>[] }
  | { type: "INIT_SQL_RUNNER" }
  | { type: "QUERY_RESULT"; columns: string[]; rows: Record<string, unknown>[] }
  | { type: "QUERY_ERROR"; message?: string };

type ViewMode = "idle" | "table" | "sql";

// Empty fallback data for when VS Code API is not available
const FALLBACK_COLUMNS: DataGridColumn[] = [];
const FALLBACK_ROWS: Record<string, unknown>[] = [];

interface TableState {
  schema: string;
  table: string;
  limit: number;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  loading: boolean;
}

interface SqlState {
  sql: string;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  loading: boolean;
  error?: string;
}

function App() {
  const [view, setView] = useState<ViewMode>("idle");
  const [tableState, setTableState] = useState<TableState>({
    schema: "public",
    table: "users",
    limit: 100,
    columns: FALLBACK_COLUMNS,
    rows: FALLBACK_ROWS,
    loading: false
  });
  const [sqlState, setSqlState] = useState<SqlState>({
    sql: "SELECT NOW();",
    columns: [],
    rows: [],
    loading: false
  });

  const requestTableRows = useCallback(
    (schema: string, table: string, limit: number) => {
      console.log(`[dbview-ui] Requesting table rows: ${schema}.${table} (limit: ${limit})`);
      const vscode = getVsCodeApi();
      setTableState((prev) => ({ ...prev, schema, table, limit, loading: true }));
      if (vscode) {
        console.log(`[dbview-ui] Sending LOAD_TABLE_ROWS message to extension`);
        vscode.postMessage({ type: "LOAD_TABLE_ROWS", schema, table, limit });
      } else {
        console.log(`[dbview-ui] No VS Code API, using fallback data`);
        setTimeout(() => {
          setTableState({
            schema,
            table,
            limit,
            columns: FALLBACK_COLUMNS,
            rows: FALLBACK_ROWS,
            loading: false
          });
        }, 300);
      }
    },
    []
  );

  const runQuery = useCallback(() => {
    const vscode = getVsCodeApi();
    setSqlState((prev) => ({ ...prev, loading: true, error: undefined }));
    if (vscode) {
      vscode.postMessage({ type: "RUN_QUERY", sql: sqlState.sql });
    } else {
      setTimeout(() => {
        setSqlState((prev) => ({
          ...prev,
          loading: false,
          columns: FALLBACK_COLUMNS,
          rows: FALLBACK_ROWS
        }));
      }, 400);
    }
  }, [sqlState.sql]);

  useEffect(() => {
    const vscode = getVsCodeApi();
    if (!vscode) {
      setView("table");
      return;
    }

    const handleMessage = (event: MessageEvent<IncomingMessage>) => {
      const message = event.data;
      console.log("[dbview-ui] Received message:", message?.type, message);
      switch (message?.type) {
        case "INIT_TABLE_VIEW": {
          console.log(`[dbview-ui] Initializing table view: ${message.schema}.${message.table}`);
          setView("table");
          requestTableRows(message.schema, message.table, message.limit ?? 100);
          break;
        }
        case "LOAD_TABLE_ROWS": {
          console.log(`[dbview-ui] Loading table rows: ${message.schema}.${message.table}, ${message.rows.length} rows`);
          setView("table");
          setTableState((prev) => ({
            ...prev,
            schema: message.schema,
            table: message.table,
            columns: message.columns.map(toColumn),
            rows: message.rows,
            loading: false
          }));
          break;
        }
        case "INIT_SQL_RUNNER": {
          setView("sql");
          setSqlState((prev) => ({ ...prev, loading: false }));
          break;
        }
        case "QUERY_RESULT": {
          setView("sql");
          setSqlState((prev) => ({
            ...prev,
            loading: false,
            error: undefined,
            columns: message.columns.map(toColumn),
            rows: message.rows
          }));
          break;
        }
        case "QUERY_ERROR": {
          setView("sql");
          setSqlState((prev) => ({ ...prev, loading: false, error: message.message ?? "Query failed" }));
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [requestTableRows]);

  const refreshTable = useCallback(() => {
    console.log(`[dbview-ui] Refresh button clicked for ${tableState.schema}.${tableState.table}`);
    requestTableRows(tableState.schema, tableState.table, tableState.limit);
  }, [requestTableRows, tableState.schema, tableState.table, tableState.limit]);

  const currentView = useMemo(() => {
    if (view === "sql") {
      return (
        <SqlRunnerView
          sql={sqlState.sql}
          onSqlChange={(value) => setSqlState((prev) => ({ ...prev, sql: value }))}
          onRunQuery={runQuery}
          loading={sqlState.loading}
          error={sqlState.error}
          columns={sqlState.columns}
          rows={sqlState.rows}
        />
      );
    }

    return (
      <TableView
        schema={tableState.schema}
        table={tableState.table}
        columns={tableState.columns}
        rows={tableState.rows}
        loading={tableState.loading}
        onRefresh={refreshTable}
      />
    );
  }, [view, sqlState, tableState, runQuery, refreshTable]);

  return currentView;
}

function toColumn(name: string): DataGridColumn {
  return {
    key: name,
    label: name.replace(/_/g, " ")
  };
}

export default App;
