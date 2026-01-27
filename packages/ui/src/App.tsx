import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { ColumnMetadata, TableTab, ERDiagramTab, TableInfo, Tab } from "@dbview/types";
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
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import clsx from "clsx";

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
    setSplitMode,
    setSecondActiveTab,
  } = useTabStore();

  // Split view state
  const splitMode = useTabStore((s) => s.splitMode);
  const secondActiveTabId = useTabStore((s) => s.secondActiveTabId);

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

  // Split view handlers
  const splitView = useCallback((direction: "horizontal" | "vertical") => {
    if (tabs.length < 2) return;

    setSplitMode(direction);
    // Set second pane to a different tab
    const otherTab = tabs.find((t) => t.id !== activeTabId);
    if (otherTab) {
      setSecondActiveTab(otherTab.id);
    }
  }, [tabs, activeTabId, setSplitMode, setSecondActiveTab]);

  const closeSplit = useCallback(() => {
    setSplitMode(null);
    setSecondActiveTab(null);
  }, [setSplitMode, setSecondActiveTab]);

  // Auto-close split when second tab is closed
  useEffect(() => {
    if (splitMode && secondActiveTabId) {
      const secondTabExists = tabs.some((t) => t.id === secondActiveTabId);
      if (!secondTabExists) {
        closeSplit();
      }
    }
  }, [tabs, splitMode, secondActiveTabId, closeSplit]);

  // Keyboard shortcut for split view (Ctrl+\ or Cmd+\)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        if (e.shiftKey) {
          closeSplit();
        } else {
          if (splitMode) {
            closeSplit();
          } else {
            splitView("horizontal");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [splitMode, splitView, closeSplit]);

  // Render tab content for any tab (not just active)
  const renderTabContent = useCallback((tab: Tab | undefined) => {
    if (!tab) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-sm">No tabs open</div>
          <div className="text-xs mt-2">Click on a table in the explorer or create a new query</div>
        </div>
      );
    }

    if (tab.type === 'query') {
      const dbType = tab.dbType;

      // Route to ConnectedDocumentQueryView for MongoDB, Elasticsearch, Cassandra
      if (dbType === 'mongodb' || dbType === 'elasticsearch' || dbType === 'cassandra') {
        return (
          <ConnectedDocumentQueryView
            key={tab.id}
            dbType={dbType}
            collections={autocompleteData.tables.map(t => t.name)}
          />
        );
      }

      // Route to ConnectedRedisQueryView for Redis
      if (dbType === 'redis') {
        return <ConnectedRedisQueryView key={tab.id} />;
      }

      // Default: ConnectedSqlRunnerView for SQL databases
      return (
        <ConnectedSqlRunnerView
          key={tab.id}
          schemas={autocompleteData.schemas}
          tables={autocompleteData.tables}
          columnMetadata={autocompleteData.columns}
        />
      );
    }

    if (tab.type === 'table') {
      // Use DataViewContainer for document/NoSQL databases when metadata is available
      if (tab.dbType && tab.metadata && tab.metadata.length > 0) {
        const isDocumentDb = ['mongodb', 'elasticsearch', 'cassandra'].includes(tab.dbType);
        const isRedis = tab.dbType === 'redis';

        if (isDocumentDb || isRedis) {
          return (
            <DataViewContainer
              key={tab.id}
              dbType={tab.dbType}
              schema={tab.schema}
              table={tab.table}
              columns={tab.metadata}
              rows={tab.rows}
              loading={tab.loading}
              totalRows={tab.totalRows ?? 0}
              limit={tab.limit}
              offset={tab.offset}
              onPageChange={(page) => {
                const newOffset = (page - 1) * tab.limit;
                requestTableRows(tab.id, tab.schema, tab.table, tab.limit, newOffset);
              }}
              onPageSizeChange={(size) => {
                requestTableRows(tab.id, tab.schema, tab.table, size, 0);
              }}
              onRefresh={() => handleRefreshTable(tab.id)}
              readOnly={tab.readOnly ?? false}
            />
          );
        }
      }

      // Default: Use TableView for SQL databases or when metadata isn't loaded yet
      return (
        <TableView
          key={tab.id}
          schema={tab.schema}
          table={tab.table}
          columns={tab.columns.map(toColumn)}
          rows={tab.rows}
          loading={tab.loading}
          metadata={tab.metadata}
          onRefresh={() => handleRefreshTable(tab.id)}
          limit={tab.limit}
          offset={tab.offset}
          totalRows={tab.totalRows}
          dbType={tab.dbType}
          sorting={tab.sorting}
          onSortingChange={(sorting) => handleSortingChange(tab.id, sorting)}
        />
      );
    }

    if (tab.type === 'er-diagram') {
      const handleSchemaToggle = (schema: string) => {
        const currentSchemas = tab.selectedSchemas;
        const newSchemas = currentSchemas.includes(schema)
          ? currentSchemas.filter(s => s !== schema)
          : [...currentSchemas, schema];

        updateTab<ERDiagramTab>(tab.id, {
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
          key={tab.id}
          diagramData={tab.diagramData}
          loading={tab.loading}
          availableSchemas={tab.availableSchemas}
          selectedSchemas={tab.selectedSchemas}
          onSchemaToggle={handleSchemaToggle}
          onTableClick={handleTableClick}
          onClose={() => closeTab(tab.id)}
        />
      );
    }

    return null;
  }, [autocompleteData, handleRefreshTable, handleSortingChange, vscode, requestTableRows, requestRowCount, updateTab, closeTab, findOrCreateTableTab]);

  // Get the active and second tabs
  const activeTab = getActiveTab();
  const secondTab = secondActiveTabId ? tabs.find((t) => t.id === secondActiveTabId) : undefined;

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
            onSplitView={splitView}
            onCloseSplit={closeSplit}
            isSplitView={!!splitMode}
          />
        )}
        <div className="flex-1 overflow-hidden">
          {splitMode && secondTab ? (
            <PanelGroup
              direction={splitMode === "horizontal" ? "horizontal" : "vertical"}
              autoSaveId="dbview-split-view"
            >
              <Panel id="first" minSize={20}>
                <div className="h-full overflow-hidden">
                  {renderTabContent(activeTab)}
                </div>
              </Panel>
              <PanelResizeHandle
                className={clsx(
                  "transition-colors group",
                  splitMode === "horizontal"
                    ? "w-1 hover:bg-vscode-accent cursor-col-resize"
                    : "h-1 hover:bg-vscode-accent cursor-row-resize"
                )}
              >
                <div
                  className={clsx(
                    "transition-colors",
                    splitMode === "horizontal"
                      ? "w-1 h-full group-hover:bg-vscode-accent/30"
                      : "h-1 w-full group-hover:bg-vscode-accent/30"
                  )}
                />
              </PanelResizeHandle>
              <Panel id="second" minSize={20}>
                <div className="h-full overflow-hidden">
                  {renderTabContent(secondTab)}
                </div>
              </Panel>
            </PanelGroup>
          ) : (
            renderTabContent(activeTab)
          )}
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
