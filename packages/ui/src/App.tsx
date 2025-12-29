import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import type { ColumnMetadata, TableTab, QueryTab, ERDiagramTab, ERDiagramData, TableInfo, ExplainPlan } from "@dbview/types";
import type { DataGridColumn } from "./components/DataGrid";
import { TableView } from "./components/TableView";
import { SqlRunnerView } from "./components/SqlRunnerView";
import { ERDiagramPanel } from "./components/ERDiagramPanel";
import { TabBar } from "./components/TabBar";
import { useTabs } from "./hooks/useTabs";
import { useQueryHistory } from "./hooks/useQueryHistory";
import { useSavedQueries } from "./hooks/useSavedQueries";
import { getVsCodeApi } from "./vscode";

type ThemeKind = 'light' | 'dark' | 'high-contrast' | 'high-contrast-light';

type IncomingMessage =
  | { type: "OPEN_TABLE"; schema: string; table: string; limit?: number; connectionName?: string }
  | { type: "OPEN_QUERY_TAB"; connectionName?: string }
  | { type: "OPEN_ER_DIAGRAM"; schemas: string[] }
  | { type: "LOAD_TABLE_ROWS"; tabId?: string; schema: string; table: string; columns: string[]; rows: Record<string, unknown>[]; limit?: number; offset?: number }
  | { type: "ROW_COUNT"; tabId?: string; totalRows: number }
  | { type: "ROW_COUNT_ERROR"; tabId?: string; error: string }
  | { type: "QUERY_RESULT"; tabId?: string; columns: string[]; rows: Record<string, unknown>[] }
  | { type: "QUERY_ERROR"; tabId?: string; message?: string }
  | { type: "TABLE_METADATA"; tabId?: string; columns: ColumnMetadata[] }
  | { type: "ER_DIAGRAM_DATA"; diagramData: ERDiagramData }
  | { type: "ER_DIAGRAM_ERROR"; error: string }
  | { type: "UPDATE_SUCCESS"; tabId?: string; rowIndex?: number }
  | { type: "UPDATE_ERROR"; tabId?: string; error: string; rowIndex?: number; column?: string }
  | { type: "INSERT_SUCCESS"; tabId?: string; newRow: Record<string, unknown> }
  | { type: "INSERT_ERROR"; tabId?: string; error: string }
  | { type: "DELETE_SUCCESS"; tabId?: string; deletedCount: number }
  | { type: "DELETE_ERROR"; tabId?: string; error: string }
  | { type: "COMMIT_SUCCESS"; tabId?: string; successCount: number }
  | { type: "COMMIT_ERROR"; tabId?: string; error: string }
  | { type: "AUTOCOMPLETE_DATA"; schemas: string[]; tables: TableInfo[]; columns: Record<string, ColumnMetadata[]> }
  | { type: "SQL_FORMATTED"; tabId: string; formattedSql: string; error?: string }
  | { type: "EXPLAIN_RESULT"; tabId: string; plan: ExplainPlan }
  | { type: "EXPLAIN_ERROR"; tabId: string; error: string }
  | { type: "THEME_CHANGE"; theme: ThemeKind };

function App() {
  const tabManager = useTabs();
  const queryHistory = useQueryHistory();
  const savedQueries = useSavedQueries();
  const queryStartTimes = useRef<Map<string, number>>(new Map());

  // Theme state - detect initial theme from document
  const [theme, setTheme] = useState<ThemeKind>(() => {
    const htmlTheme = document.documentElement.getAttribute('data-theme');
    return (htmlTheme as ThemeKind) || 'dark';
  });

  // Autocomplete data state
  const [autocompleteData, setAutocompleteData] = useState<{
    schemas: string[];
    tables: TableInfo[];
    columns: Record<string, ColumnMetadata[]>;
  }>({
    schemas: [],
    tables: [],
    columns: {}
  });

  const vscode = getVsCodeApi();

  // Notify extension that webview is ready and request autocomplete data on mount
  useEffect(() => {
    if (vscode) {
      console.log('[dbview-ui] Webview mounted, sending READY message');
      vscode.postMessage({ type: "WEBVIEW_READY" });
      vscode.postMessage({ type: "GET_AUTOCOMPLETE_DATA" });
    }
  }, [vscode]);

  // Request table rows for a specific tab
  const requestTableRows = useCallback(
    (tabId: string, schema: string, table: string, limit: number, offset: number, filters?: any[], filterLogic?: 'AND' | 'OR') => {
      console.log(`[dbview-ui] Requesting table rows for tab ${tabId}: ${schema}.${table} (limit: ${limit}, offset: ${offset})`);

      tabManager.updateTab<TableTab>(tabId, { loading: true });

      if (vscode) {
        console.log(`[dbview-ui] Sending LOAD_TABLE_ROWS message to extension`);
        vscode.postMessage({
          type: "LOAD_TABLE_ROWS",
          tabId,
          schema,
          table,
          limit,
          offset,
          filters,
          filterLogic
        });
      }
    },
    [vscode, tabManager]
  );

  // Request row count for a specific tab
  const requestRowCount = useCallback(
    (tabId: string, schema: string, table: string, filters?: any[], filterLogic?: 'AND' | 'OR') => {
      console.log(`[dbview-ui] Requesting row count for tab ${tabId}: ${schema}.${table}`);
      if (vscode) {
        vscode.postMessage({
          type: "GET_ROW_COUNT",
          tabId,
          schema,
          table,
          filters,
          filterLogic
        });
      }
    },
    [vscode]
  );

  // Run query for a specific query tab
  const runQuery = useCallback(
    (tabId: string, sql: string) => {
      console.log(`[dbview-ui] Running query for tab ${tabId}`);
      tabManager.updateTab<QueryTab>(tabId, { loading: true, error: undefined });

      // Track query start time for duration calculation
      queryStartTimes.current.set(tabId, Date.now());

      if (vscode) {
        vscode.postMessage({ type: "RUN_QUERY", tabId, sql });
      }
    },
    [vscode, tabManager]
  );

  // Format SQL for a specific query tab
  const formatSql = useCallback(
    (tabId: string, sql: string) => {
      console.log(`[dbview-ui] Formatting SQL for tab ${tabId}`);
      if (vscode && sql.trim()) {
        vscode.postMessage({ type: "FORMAT_SQL", tabId, sql });
      }
    },
    [vscode]
  );

  // Explain query for a specific query tab
  const explainQuery = useCallback(
    (tabId: string, sql: string) => {
      console.log(`[dbview-ui] Explaining query for tab ${tabId}`);
      if (vscode && sql.trim()) {
        tabManager.updateTab<QueryTab>(tabId, {
          explainLoading: true,
          explainError: undefined,
          showExplainPanel: true
        });
        vscode.postMessage({ type: "EXPLAIN_QUERY", tabId, sql });
      }
    },
    [vscode, tabManager]
  );

  // Handle incoming messages from extension
  useEffect(() => {
    if (!vscode) {
      return;
    }

    const handleMessage = (event: MessageEvent<IncomingMessage>) => {
      const message = event.data;
      console.log("[dbview-ui] Received message:", message?.type, message);

      switch (message?.type) {
        case "OPEN_TABLE": {
          console.log(`[dbview-ui] Opening table: ${message.schema}.${message.table} on ${message.connectionName}`);
          const tabId = tabManager.findOrCreateTableTab(message.schema, message.table, message.limit ?? 100, message.connectionName);

          // Request initial data
          requestTableRows(tabId, message.schema, message.table, message.limit ?? 100, 0);
          requestRowCount(tabId, message.schema, message.table);
          break;
        }

        case "OPEN_QUERY_TAB": {
          console.log(`[dbview-ui] Opening new query tab for ${message.connectionName}`);
          tabManager.addQueryTab(message.connectionName);
          break;
        }

        case "OPEN_ER_DIAGRAM": {
          console.log(`[dbview-ui] Opening ER diagram for schemas:`, message.schemas);
          const tabId = tabManager.addERDiagramTab(message.schemas);

          // Request diagram data
          if (vscode) {
            vscode.postMessage({
              type: "GET_ER_DIAGRAM",
              schemas: message.schemas
            });
          }
          break;
        }

        case "ER_DIAGRAM_DATA": {
          // Find the active ER diagram tab
          const activeTab = tabManager.getActiveTab();
          if (activeTab?.type === 'er-diagram') {
            console.log(`[dbview-ui] Received ER diagram data`);
            tabManager.updateTab<ERDiagramTab>(activeTab.id, {
              diagramData: message.diagramData,
              loading: false
            });
          }
          break;
        }

        case "ER_DIAGRAM_ERROR": {
          const activeTab = tabManager.getActiveTab();
          if (activeTab?.type === 'er-diagram') {
            console.error(`[dbview-ui] ER diagram error:`, message.error);
            tabManager.updateTab<ERDiagramTab>(activeTab.id, {
              loading: false,
              error: message.error
            });
            toast.error("Failed to load ER diagram", {
              description: message.error
            });
          }
          break;
        }

        case "LOAD_TABLE_ROWS": {
          const tabId = message.tabId || tabManager.activeTabId;
          if (!tabId) break;

          console.log(`[dbview-ui] Loading table rows for tab ${tabId}: ${message.rows.length} rows`);
          tabManager.updateTab<TableTab>(tabId, {
            schema: message.schema,
            table: message.table,
            columns: message.columns,
            rows: message.rows,
            limit: message.limit ?? 100,
            offset: message.offset ?? 0,
            loading: false
          });
          break;
        }

        case "ROW_COUNT": {
          const tabId = message.tabId || tabManager.activeTabId;
          if (!tabId) break;

          console.log(`[dbview-ui] Received row count for tab ${tabId}: ${message.totalRows}`);
          tabManager.updateTab<TableTab>(tabId, {
            totalRows: message.totalRows
          });
          break;
        }

        case "ROW_COUNT_ERROR": {
          console.error(`[dbview-ui] Row count error:`, message.error);
          // Silently fail - pagination still works without total count
          break;
        }

        case "QUERY_RESULT": {
          const tabId = message.tabId || tabManager.activeTabId;
          if (!tabId) break;

          console.log(`[dbview-ui] Query result for tab ${tabId}: ${message.rows.length} rows`);

          // Calculate query duration
          const startTime = queryStartTimes.current.get(tabId);
          const duration = startTime ? Date.now() - startTime : undefined;
          queryStartTimes.current.delete(tabId);

          // Get the SQL from the tab
          const tab = tabManager.getTab(tabId);
          if (tab?.type === 'query') {
            queryHistory.addQuery(
              tab.sql,
              true,
              duration,
              message.rows.length
            );
          }

          tabManager.updateTab<QueryTab>(tabId, {
            loading: false,
            error: undefined,
            columns: message.columns,
            rows: message.rows,
            duration
          });
          break;
        }

        case "QUERY_ERROR": {
          const tabId = message.tabId || tabManager.activeTabId;
          if (!tabId) break;

          console.error(`[dbview-ui] Query error for tab ${tabId}:`, message.message);

          // Calculate query duration
          const startTime = queryStartTimes.current.get(tabId);
          const duration = startTime ? Date.now() - startTime : undefined;
          queryStartTimes.current.delete(tabId);

          // Get the SQL from the tab
          const tab = tabManager.getTab(tabId);
          if (tab?.type === 'query') {
            queryHistory.addQuery(
              tab.sql,
              false,
              duration,
              undefined,
              message.message ?? "Query failed"
            );
          }

          tabManager.updateTab<QueryTab>(tabId, {
            loading: false,
            error: message.message ?? "Query failed"
          });
          break;
        }

        case "TABLE_METADATA": {
          const tabId = message.tabId || tabManager.activeTabId;
          if (!tabId) break;

          console.log(`[dbview-ui] Received table metadata for tab ${tabId}: ${message.columns.length} columns`);
          tabManager.updateTab<TableTab>(tabId, {
            metadata: message.columns
          });
          break;
        }

        case "UPDATE_SUCCESS": {
          console.log(`[dbview-ui] Cell update successful`);
          toast.success("Cell updated successfully");
          break;
        }

        case "UPDATE_ERROR": {
          console.error(`[dbview-ui] Cell update failed:`, message.error);
          toast.error("Failed to update cell", {
            description: message.error
          });
          break;
        }

        case "INSERT_SUCCESS": {
          console.log(`[dbview-ui] Row inserted successfully`);
          toast.success("Row inserted successfully");
          break;
        }

        case "INSERT_ERROR": {
          console.error(`[dbview-ui] Row insert failed:`, message.error);
          toast.error("Failed to insert row", {
            description: message.error
          });
          break;
        }

        case "DELETE_SUCCESS": {
          console.log(`[dbview-ui] ${message.deletedCount} row(s) deleted`);
          toast.success(`${message.deletedCount} row(s) deleted successfully`);
          break;
        }

        case "DELETE_ERROR": {
          console.error(`[dbview-ui] Row delete failed:`, message.error);
          toast.error("Failed to delete row(s)", {
            description: message.error
          });
          break;
        }

        case "COMMIT_SUCCESS": {
          console.log(`[dbview-ui] ${message.successCount} change(s) committed`);
          toast.success(`${message.successCount} change(s) committed successfully`);
          break;
        }

        case "COMMIT_ERROR": {
          console.error(`[dbview-ui] Commit failed:`, message.error);
          toast.error("Failed to commit changes", {
            description: message.error
          });
          break;
        }

        case "AUTOCOMPLETE_DATA": {
          console.log(`[dbview-ui] Received autocomplete data: ${message.schemas.length} schemas, ${message.tables.length} tables`);
          setAutocompleteData({
            schemas: message.schemas,
            tables: message.tables,
            columns: message.columns
          });
          break;
        }

        case "SQL_FORMATTED": {
          const tabId = message.tabId;
          if (message.error) {
            console.error(`[dbview-ui] SQL formatting failed:`, message.error);
            toast.error("Failed to format SQL", {
              description: message.error
            });
          } else {
            console.log(`[dbview-ui] SQL formatted successfully for tab ${tabId}`);
            tabManager.updateTab<QueryTab>(tabId, { sql: message.formattedSql });
            toast.success("SQL formatted successfully");
          }
          break;
        }

        case "EXPLAIN_RESULT": {
          const tabId = message.tabId;
          console.log(`[dbview-ui] EXPLAIN result received for tab ${tabId}`);
          tabManager.updateTab<QueryTab>(tabId, {
            explainPlan: message.plan,
            explainLoading: false,
            explainError: undefined
          });
          break;
        }

        case "EXPLAIN_ERROR": {
          const tabId = message.tabId;
          console.error(`[dbview-ui] EXPLAIN query failed for tab ${tabId}:`, message.error);
          tabManager.updateTab<QueryTab>(tabId, {
            explainLoading: false,
            explainError: message.error
          });
          toast.error("Failed to explain query", {
            description: message.error
          });
          break;
        }

        case "THEME_CHANGE": {
          console.log(`[dbview-ui] Theme changed to: ${message.theme}`);
          // Update the data-theme attribute on the HTML element
          document.documentElement.setAttribute('data-theme', message.theme);
          // Update body class for VS Code theme detection
          const bodyClass = message.theme.startsWith('high-contrast') ? 'high-contrast' : message.theme;
          document.body.className = `vscode-${bodyClass}`;
          // Update theme state for components like Toaster
          setTheme(message.theme);
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vscode, tabManager, requestTableRows, requestRowCount, queryHistory]);

  // Refresh handler for table tabs
  const handleRefreshTable = useCallback((tabId: string) => {
    const tab = tabManager.getTab(tabId);
    if (tab?.type === 'table') {
      console.log(`[dbview-ui] Refresh button clicked for tab ${tabId}: ${tab.schema}.${tab.table}`);
      requestTableRows(tabId, tab.schema, tab.table, tab.limit, tab.offset);
      requestRowCount(tabId, tab.schema, tab.table);
    }
  }, [tabManager, requestTableRows, requestRowCount]);

  // Render active tab content
  const renderTabContent = useMemo(() => {
    const activeTab = tabManager.getActiveTab();
    if (!activeTab) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-sm">No tabs open</div>
          <div className="text-xs mt-2">Click on a table in the explorer or create a new query</div>
        </div>
      );
    }

    if (activeTab.type === 'query') {
      return (
        <SqlRunnerView
          sql={activeTab.sql}
          onSqlChange={(value) => tabManager.updateTab<QueryTab>(activeTab.id, { sql: value })}
          onRunQuery={() => runQuery(activeTab.id, activeTab.sql)}
          onFormatSql={() => formatSql(activeTab.id, activeTab.sql)}
          onExplainQuery={() => explainQuery(activeTab.id, activeTab.sql)}
          loading={activeTab.loading}
          error={activeTab.error}
          columns={activeTab.columns.map(toColumn)}
          rows={activeTab.rows}
          duration={activeTab.duration}
          connectionName={activeTab.connectionName}
          schemas={autocompleteData.schemas}
          tables={autocompleteData.tables}
          columnMetadata={autocompleteData.columns}
          explainPlan={activeTab.explainPlan}
          explainLoading={activeTab.explainLoading}
          explainError={activeTab.explainError}
          showExplainPanel={activeTab.showExplainPanel}
          onCloseExplainPanel={() => tabManager.updateTab<QueryTab>(activeTab.id, { showExplainPanel: false })}
          history={queryHistory.history}
          filteredHistory={queryHistory.filteredHistory}
          favorites={queryHistory.favorites}
          searchTerm={queryHistory.searchTerm}
          showFavoritesOnly={queryHistory.showFavoritesOnly}
          onSearchChange={queryHistory.setSearchTerm}
          onToggleFavorite={queryHistory.toggleFavorite}
          onDeleteEntry={queryHistory.deleteEntry}
          onClearHistory={queryHistory.clearHistory}
          onClearNonFavorites={queryHistory.clearNonFavorites}
          onToggleShowFavorites={() => queryHistory.setShowFavoritesOnly(!queryHistory.showFavoritesOnly)}
          savedQueries={savedQueries.queries}
          onSaveQuery={(name, description) => savedQueries.addQuery(name, activeTab.sql, description)}
          onDeleteSavedQuery={savedQueries.deleteQuery}
          onUpdateSavedQuery={savedQueries.updateQuery}
        />
      );
    }

    if (activeTab.type === 'table') {
      return (
        <TableView
          schema={activeTab.schema}
          table={activeTab.table}
          columns={activeTab.columns.map(toColumn)}
          rows={activeTab.rows}
          loading={activeTab.loading}
          metadata={activeTab.metadata}
          onRefresh={() => handleRefreshTable(activeTab.id)}
          limit={activeTab.limit}
          offset={activeTab.offset}
          totalRows={activeTab.totalRows}
        />
      );
    }

    if (activeTab.type === 'er-diagram') {
      const handleSchemaToggle = (schema: string) => {
        const currentSchemas = activeTab.selectedSchemas;
        const newSchemas = currentSchemas.includes(schema)
          ? currentSchemas.filter(s => s !== schema)
          : [...currentSchemas, schema];

        tabManager.updateTab<ERDiagramTab>(activeTab.id, {
          selectedSchemas: newSchemas,
          loading: true
        });

        // Request new diagram data
        if (vscode) {
          vscode.postMessage({
            type: "GET_ER_DIAGRAM",
            schemas: newSchemas
          });
        }
      };

      const handleTableClick = (schema: string, table: string) => {
        // Open the table in a new tab
        const tabId = tabManager.findOrCreateTableTab(schema, table, 100);
        requestTableRows(tabId, schema, table, 100, 0);
        requestRowCount(tabId, schema, table);
      };

      return (
        <ERDiagramPanel
          diagramData={activeTab.diagramData}
          loading={activeTab.loading}
          availableSchemas={activeTab.availableSchemas}
          selectedSchemas={activeTab.selectedSchemas}
          onSchemaToggle={handleSchemaToggle}
          onTableClick={handleTableClick}
          onClose={() => tabManager.closeTab(activeTab.id)}
        />
      );
    }

    return null;
  }, [tabManager.tabs, tabManager.activeTabId, tabManager, runQuery, formatSql, explainQuery, handleRefreshTable, vscode, requestTableRows, requestRowCount, queryHistory, autocompleteData]);

  return (
    <>
      <Toaster
        theme={theme === 'light' || theme === 'high-contrast-light' ? 'light' : 'dark'}
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-bg-light)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          },
        }}
      />
      <div className="flex flex-col h-screen bg-vscode-bg">
        {tabManager.tabs.length > 0 && (
          <TabBar
            tabs={tabManager.tabs}
            activeTabId={tabManager.activeTabId}
            onTabSelect={tabManager.switchToTab}
            onTabClose={tabManager.closeTab}
            onNewQuery={() => {
              // Get connection name from the active tab if available
              const activeTab = tabManager.getActiveTab();
              const connectionName = activeTab?.connectionName;
              tabManager.addQueryTab(connectionName);
            }}
            onCloseOtherTabs={tabManager.closeOtherTabs}
            onCloseAllTabs={tabManager.closeAllTabs}
          />
        )}
        <div className="flex-1 overflow-hidden">
          {renderTabContent}
        </div>
      </div>
    </>
  );
}

function toColumn(name: string): DataGridColumn {
  return {
    key: name,
    label: name.replace(/_/g, " ")
  };
}

export default App;
