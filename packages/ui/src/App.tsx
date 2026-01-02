import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import type { ColumnMetadata, TableTab, ERDiagramTab, TableInfo } from "@dbview/types";
import type { DataGridColumn } from "./components/DataGrid";
import { TableView } from "./components/TableView";
import { DataViewContainer } from "./components/dataViews";
import { ConnectedSqlRunnerView } from "./components/ConnectedSqlRunnerView";
import { ConnectedDocumentQueryView } from "./components/ConnectedDocumentQueryView";
import { ConnectedRedisQueryView } from "./components/ConnectedRedisQueryView";
import { ERDiagramPanel } from "./components/ERDiagramPanel";
import { TabBar } from "./components/TabBar";
import { useTabStore, useQueryHistoryStore } from "@dbview/shared-state";
import { useAppMessages } from "./hooks/useAppMessages";
import { getVsCodeApi } from "./vscode";

type ThemeKind = 'light' | 'dark' | 'high-contrast' | 'high-contrast-light';

function App() {
  // Zustand store for tab management
  const {
    tabs,
    activeTabId,
    closeTab,
    updateTab,
    findOrCreateTableTab,
    addQueryTab,
    addERDiagramTab,
    getTab,
    getActiveTab,
  } = useTabStore();

  // Query history store
  const { addQuery: addQueryToHistory, setFilterDbType } = useQueryHistoryStore();

  // Update history filter when active tab changes
  useEffect(() => {
    const activeTab = getActiveTab();
    if (activeTab?.type === 'query') {
      setFilterDbType(activeTab.dbType);
    } else if (activeTab?.type === 'table') {
      setFilterDbType(activeTab.dbType);
    } else {
      setFilterDbType(undefined);
    }
  }, [activeTabId, getActiveTab, setFilterDbType]);

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
      vscode.postMessage({ type: "WEBVIEW_READY" });
      vscode.postMessage({ type: "GET_AUTOCOMPLETE_DATA" });
    }
  }, [vscode]);

  // Request table rows for a specific tab
  const requestTableRows = useCallback(
    (tabId: string, schema: string, table: string, limit: number, offset: number, filters?: any[], filterLogic?: 'AND' | 'OR', sorting?: Array<{ columnName: string; direction: 'asc' | 'desc' }>) => {
      updateTab<TableTab>(tabId, { loading: true });

      if (vscode) {
        vscode.postMessage({
          type: "LOAD_TABLE_ROWS",
          tabId,
          schema,
          table,
          limit,
          offset,
          filters,
          filterLogic,
          sorting
        });
      }
    },
    [vscode, updateTab]
  );

  // Request row count for a specific tab
  const requestRowCount = useCallback(
    (tabId: string, schema: string, table: string, filters?: any[], filterLogic?: 'AND' | 'OR') => {
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

  // Use the message handler hook
  useAppMessages({
    vscode,
    tabs,
    activeTabId,
    findOrCreateTableTab,
    addQueryTab,
    addERDiagramTab,
    getActiveTab,
    getTab,
    updateTab,
    requestTableRows,
    requestRowCount,
    addQueryToHistory,
    setAutocompleteData,
    setTheme,
  });

  // Refresh handler for table tabs
  const handleRefreshTable = useCallback((tabId: string) => {
    let tab = getTab(tabId);

    if (!tab) {
      tab = getActiveTab();
      if (tab) {
        tabId = tab.id;
      }
    }

    if (tab?.type === 'table') {
      try {
        requestTableRows(tabId, tab.schema, tab.table, tab.limit, tab.offset, undefined, undefined, tab.sorting);
        requestRowCount(tabId, tab.schema, tab.table);
      } catch (error) {
        console.error(`[dbview-ui] Error refreshing table:`, error);
      }
    }
  }, [getTab, getActiveTab, requestTableRows, requestRowCount]);

  // Handle sorting changes for table tabs
  const handleSortingChange = useCallback((tabId: string, sorting: Array<{ columnName: string; direction: 'asc' | 'desc' }>) => {
    const tab = getTab(tabId);
    if (tab?.type === 'table') {
      // Update tab state with new sorting
      updateTab<TableTab>(tabId, { sorting });

      // Fetch fresh data with new sorting
      requestTableRows(tabId, tab.schema, tab.table, tab.limit, tab.offset, undefined, undefined, sorting);
    }
  }, [getTab, updateTab, requestTableRows]);

  // Render active tab content
  const renderTabContent = useMemo(() => {
    const activeTab = getActiveTab();
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
      const dbType = activeTab.dbType;

      // Route to ConnectedDocumentQueryView for MongoDB, Elasticsearch, Cassandra
      if (dbType === 'mongodb' || dbType === 'elasticsearch' || dbType === 'cassandra') {
        return (
          <ConnectedDocumentQueryView
            dbType={dbType}
            collections={autocompleteData.tables.map(t => t.name)}
          />
        );
      }

      // Route to ConnectedRedisQueryView for Redis
      if (dbType === 'redis') {
        return <ConnectedRedisQueryView />;
      }

      // Default: ConnectedSqlRunnerView for SQL databases
      return (
        <ConnectedSqlRunnerView
          schemas={autocompleteData.schemas}
          tables={autocompleteData.tables}
          columnMetadata={autocompleteData.columns}
        />
      );
    }

    if (activeTab.type === 'table') {
      // Use DataViewContainer for document/NoSQL databases when metadata is available
      if (activeTab.dbType && activeTab.metadata && activeTab.metadata.length > 0) {
        const isDocumentDb = ['mongodb', 'elasticsearch', 'cassandra'].includes(activeTab.dbType);
        const isRedis = activeTab.dbType === 'redis';

        if (isDocumentDb || isRedis) {
          return (
            <DataViewContainer
              dbType={activeTab.dbType}
              schema={activeTab.schema}
              table={activeTab.table}
              columns={activeTab.metadata}
              rows={activeTab.rows}
              loading={activeTab.loading}
              totalRows={activeTab.totalRows ?? 0}
              limit={activeTab.limit}
              offset={activeTab.offset}
              onPageChange={(page) => {
                const newOffset = (page - 1) * activeTab.limit;
                requestTableRows(activeTab.id, activeTab.schema, activeTab.table, activeTab.limit, newOffset);
              }}
              onPageSizeChange={(size) => {
                requestTableRows(activeTab.id, activeTab.schema, activeTab.table, size, 0);
              }}
              onRefresh={() => handleRefreshTable(activeTab.id)}
              readOnly={activeTab.readOnly ?? false}
            />
          );
        }
      }

      // Default: Use TableView for SQL databases or when metadata isn't loaded yet
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
          dbType={activeTab.dbType}
          sorting={activeTab.sorting}
          onSortingChange={(sorting) => handleSortingChange(activeTab.id, sorting)}
        />
      );
    }

    if (activeTab.type === 'er-diagram') {
      const handleSchemaToggle = (schema: string) => {
        const currentSchemas = activeTab.selectedSchemas;
        const newSchemas = currentSchemas.includes(schema)
          ? currentSchemas.filter(s => s !== schema)
          : [...currentSchemas, schema];

        updateTab<ERDiagramTab>(activeTab.id, {
          selectedSchemas: newSchemas,
          loading: true
        });

        if (vscode) {
          vscode.postMessage({
            type: "GET_ER_DIAGRAM",
            schemas: newSchemas
          });
        }
      };

      const handleTableClick = (schema: string, table: string) => {
        const tabId = findOrCreateTableTab({ schema, table, limit: 100 });
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
          onClose={() => closeTab(activeTab.id)}
        />
      );
    }

    return null;
  }, [tabs, activeTabId, getActiveTab, updateTab, closeTab, findOrCreateTableTab, handleRefreshTable, vscode, requestTableRows, requestRowCount, autocompleteData]);

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
        {tabs.length > 0 && (
          <TabBar
            onNewQuery={() => {
              const activeTab = getActiveTab();
              const connectionName = activeTab?.connectionName;
              const dbType = activeTab?.type === 'table' ? activeTab.dbType :
                             activeTab?.type === 'query' ? activeTab.dbType : undefined;

              addQueryTab({ connectionName, dbType });
            }}
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
