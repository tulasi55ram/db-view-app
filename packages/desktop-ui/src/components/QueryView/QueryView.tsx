import { useState, useEffect, useCallback } from "react";
import { Play, Wand2, History } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SqlEditor } from "./SqlEditor";
import { QueryResultsGrid } from "./QueryResultsGrid";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { getElectronAPI, type QueryHistoryEntry } from "@/electron";
import { toast } from "sonner";
import type { TableInfo, ColumnMetadata } from "@dbview/core";

export interface QueryViewProps {
  tab: {
    id: string;
    connectionKey?: string;
    connectionName?: string;
    sql?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    loading?: boolean;
    error?: string;
    history?: QueryHistoryEntry[];
    limitApplied?: boolean;
    limit?: number;
    hasMore?: boolean;
  };
  onTabUpdate: (
    tabId: string,
    updates: {
      sql?: string;
      columns?: string[];
      rows?: Record<string, unknown>[];
      loading?: boolean;
      error?: string;
      history?: QueryHistoryEntry[];
      isDirty?: boolean;
      limitApplied?: boolean;
      limit?: number;
      hasMore?: boolean;
    }
  ) => void;
}

export function QueryView({ tab, onTabUpdate }: QueryViewProps) {
  const [autocompleteData, setAutocompleteData] = useState<{
    schemas: string[];
    tables: TableInfo[];
    columns: Record<string, ColumnMetadata[]>;
  }>({
    schemas: [],
    tables: [],
    columns: {},
  });
  const [showHistory, setShowHistory] = useState(false);
  const [persistedHistory, setPersistedHistory] = useState<QueryHistoryEntry[]>([]);

  const api = getElectronAPI();

  // Load autocomplete data and persisted history on mount
  useEffect(() => {
    if (tab.connectionKey && api) {
      // Load autocomplete data
      api
        .getAutocompleteData(tab.connectionKey)
        .then((data) => {
          setAutocompleteData({
            schemas: data.schemas || [],
            tables: data.tables || [],
            columns: data.columns || {},
          });
        })
        .catch((err) => {
          console.error("Failed to load autocomplete data:", err);
        });

      // Load persisted query history
      api
        .getQueryHistory(tab.connectionKey)
        .then((history) => {
          setPersistedHistory(history);
        })
        .catch((err) => {
          console.error("Failed to load query history:", err);
        });
    }
  }, [tab.connectionKey, api]);

  // Handle run query
  const handleRunQuery = useCallback(async () => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      if (!tab.connectionKey) {
        toast.error("No connection selected");
      }
      return;
    }

    const startTime = Date.now();
    onTabUpdate(tab.id, { loading: true, error: undefined });

    try {
      const result = await api.runQuery({
        connectionKey: tab.connectionKey,
        sql: tab.sql,
      });

      const duration = Date.now() - startTime;

      // Add to persistent history
      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        rowCount: result.rows.length,
        success: true,
      };

      // Save to persistent storage
      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);

      // Update local state
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-10));

      onTabUpdate(tab.id, {
        columns: result.columns,
        rows: result.rows,
        loading: false,
        limitApplied: result.limitApplied,
        limit: result.limit,
        hasMore: result.hasMore,
      });

      toast.success(`Query executed successfully (${result.rows.length} rows, ${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Add failed query to persistent history
      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        success: false,
        error: error.message || "Unknown error",
      };

      // Save to persistent storage
      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);

      // Update local state
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-10));

      onTabUpdate(tab.id, {
        loading: false,
        error: error.message || "Failed to execute query",
      });

      toast.error(`Query failed: ${error.message}`);
    }
  }, [tab, onTabUpdate, api]);

  // Handle format SQL
  const handleFormatSql = useCallback(async () => {
    if (!tab.sql || !api) return;

    try {
      const formatted = await api.formatSql(tab.sql);
      onTabUpdate(tab.id, { sql: formatted, isDirty: true });
      toast.success("SQL formatted successfully");
    } catch (error: any) {
      toast.error(`Failed to format SQL: ${error.message}`);
    }
  }, [tab.sql, tab.id, onTabUpdate, api]);

  // Handle SQL change
  const handleSqlChange = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
    },
    [tab.id, onTabUpdate]
  );

  // Handle history selection
  const handleSelectFromHistory = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
    },
    [tab.id, onTabUpdate]
  );

  // Handle clear history
  const handleClearHistory = useCallback(async () => {
    if (!tab.connectionKey || !api) return;

    try {
      await api.clearQueryHistory(tab.connectionKey);
      setPersistedHistory([]);
      toast.success("Query history cleared");
    } catch (error: any) {
      toast.error(`Failed to clear history: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar - Compact, always visible */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunQuery}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3" />
            Run
            <span className="opacity-70">(Cmd+Enter)</span>
          </button>
          <button
            onClick={handleFormatSql}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-3 h-3" />
            Format
          </button>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors"
        >
          <History className="w-3 h-3" />
          History {showHistory && "✓"}
        </button>
      </div>

      {/* SQL Editor - Fixed compact height */}
      <div className="border-b border-border" style={{ height: "180px" }}>
        <SqlEditor
          value={tab.sql || ""}
          onChange={handleSqlChange}
          onRunQuery={handleRunQuery}
          loading={tab.loading || false}
          error={tab.error}
          schemas={autocompleteData.schemas}
          tables={autocompleteData.tables}
          columns={autocompleteData.columns}
          height="180px"
        />
      </div>

      {/* Warning Banner - Show when limit was auto-applied */}
      {tab.limitApplied && (
        <div className="h-9 px-4 flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/30">
          <span className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-2">
            <span>⚠️</span>
            <span>
              Showing first <strong>{tab.limit?.toLocaleString()}</strong> rows. Add LIMIT to your query for a custom
              row count.
            </span>
          </span>
          {tab.hasMore && tab.sql && (
            <button
              onClick={() => {
                if (!tab.sql) return;
                // Reload query with higher limit
                const newLimit = (tab.limit || 1000) + 1000;
                const modifiedSql = `${tab.sql.trim()}\nLIMIT ${newLimit}`;
                onTabUpdate(tab.id, { sql: modifiedSql, isDirty: true });
                handleRunQuery();
              }}
              className="text-xs text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 font-medium underline"
            >
              Load 1,000 More Rows
            </button>
          )}
        </div>
      )}

      {/* Results Area - Takes ALL remaining space */}
      <div className="flex-1 flex overflow-hidden">
        {showHistory ? (
          <PanelGroup direction="horizontal">
            {/* Results Grid */}
            <Panel defaultSize={70} minSize={50}>
              <QueryResultsGrid
                columns={tab.columns || []}
                rows={tab.rows || []}
                loading={tab.loading || false}
              />
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors cursor-col-resize" />

            {/* History Panel */}
            <Panel defaultSize={30} minSize={20} maxSize={50}>
              <QueryHistoryPanel
                history={persistedHistory}
                onSelectQuery={handleSelectFromHistory}
                onClearHistory={handleClearHistory}
              />
            </Panel>
          </PanelGroup>
        ) : (
          <QueryResultsGrid
            columns={tab.columns || []}
            rows={tab.rows || []}
            loading={tab.loading || false}
          />
        )}
      </div>
    </div>
  );
}
