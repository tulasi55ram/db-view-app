/**
 * ElectronApp - Main entry point for the Electron desktop application
 *
 * This component wraps the main App and adds:
 * - Sidebar for connection management
 * - Menu event handlers
 * - Electron-specific features
 */

import { useState, useEffect, useCallback } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { getElectronAPI } from "./electron";
import { TabBar } from "./components/TabBar";
import { TableView } from "./components/TableView";
import { SqlRunnerView } from "./components/SqlRunnerView";
import { ERDiagramPanel } from "./components/ERDiagramPanel";
import { useTabs } from "./hooks/useTabs";
import { useQueryHistory } from "./hooks/useQueryHistory";
import type { ColumnMetadata, TableTab, QueryTab, ERDiagramTab, TableInfo, ExplainPlan } from "@dbview/types";
import type { DataGridColumn } from "./components/DataGrid";

type ThemeKind = "light" | "dark";

export function ElectronApp() {
  const [theme, setTheme] = useState<ThemeKind>("dark");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [autocompleteData, setAutocompleteData] = useState<{
    schemas: string[];
    tables: TableInfo[];
    columns: Record<string, ColumnMetadata[]>;
  }>({
    schemas: [],
    tables: [],
    columns: {},
  });

  const tabManager = useTabs();
  const queryHistory = useQueryHistory();
  const api = getElectronAPI();

  // Initialize theme and set up event listeners
  useEffect(() => {
    if (!api) return;

    // Get initial theme
    api.getTheme().then(setTheme);

    // Subscribe to theme changes
    const unsubTheme = api.onThemeChange(setTheme);

    // Subscribe to menu events
    const unsubToggleSidebar = api.onMenuToggleSidebar(() => setSidebarVisible((v) => !v));
    const unsubNewQuery = api.onMenuNewQuery(() => {
      // Open new query tab for active connection
      // TODO: Get active connection from sidebar
    });

    return () => {
      unsubTheme();
      unsubToggleSidebar();
      unsubNewQuery();
    };
  }, [api]);

  // Handle table selection from sidebar
  const handleTableSelect = useCallback(
    async (connectionKey: string, schema: string, table: string) => {
      if (!api) return;

      const tabId = tabManager.findOrCreateTableTab(schema, table, 100, connectionKey);
      tabManager.updateTab<TableTab>(tabId, { loading: true });

      try {
        // Load table data
        const [data, count, metadata] = await Promise.all([
          api.loadTableRows({ connectionKey, schema, table, limit: 100, offset: 0 }),
          api.getRowCount({ connectionKey, schema, table }),
          api.getTableMetadata({ connectionKey, schema, table }),
        ]);

        tabManager.updateTab<TableTab>(tabId, {
          columns: data.columns,
          rows: data.rows,
          totalRows: count,
          metadata,
          loading: false,
        });
      } catch (error) {
        console.error("Failed to load table:", error);
        tabManager.updateTab<TableTab>(tabId, { loading: false });
      }
    },
    [api, tabManager]
  );

  // Handle query tab open from sidebar
  const handleQueryOpen = useCallback(
    (connectionKey: string) => {
      tabManager.addQueryTab(connectionKey);
    },
    [tabManager]
  );

  // Handle ER diagram open from sidebar
  const handleERDiagramOpen = useCallback(
    async (connectionKey: string, schemas: string[]) => {
      if (!api) return;

      const tabId = tabManager.addERDiagramTab(schemas);
      tabManager.updateTab<ERDiagramTab>(tabId, { loading: true });

      try {
        const diagramData = await api.getERDiagram(connectionKey, schemas);
        tabManager.updateTab<ERDiagramTab>(tabId, {
          diagramData,
          loading: false,
        });
      } catch (error) {
        console.error("Failed to load ER diagram:", error);
        tabManager.updateTab<ERDiagramTab>(tabId, {
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [api, tabManager]
  );

  // Run query
  const runQuery = useCallback(
    async (tabId: string, sql: string) => {
      if (!api) return;

      const tab = tabManager.getTab(tabId) as QueryTab | undefined;
      if (!tab || tab.type !== "query" || !tab.connectionName) return;

      tabManager.updateTab<QueryTab>(tabId, { loading: true, error: undefined });

      try {
        const result = await api.runQuery({ connectionKey: tab.connectionName, sql });

        queryHistory.addQuery(sql, true, undefined, result.rows.length);

        tabManager.updateTab<QueryTab>(tabId, {
          columns: result.columns,
          rows: result.rows,
          loading: false,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        queryHistory.addQuery(sql, false, undefined, undefined, errorMessage);

        tabManager.updateTab<QueryTab>(tabId, {
          loading: false,
          error: errorMessage,
        });
      }
    },
    [api, tabManager, queryHistory]
  );

  // Format SQL
  const formatSql = useCallback(
    async (tabId: string, sql: string) => {
      if (!api) return;

      try {
        const formatted = await api.formatSql(sql);
        tabManager.updateTab<QueryTab>(tabId, { sql: formatted });
      } catch (error) {
        console.error("Failed to format SQL:", error);
      }
    },
    [api, tabManager]
  );

  // Explain query
  const explainQuery = useCallback(
    async (tabId: string, sql: string) => {
      if (!api) return;

      const tab = tabManager.getTab(tabId) as QueryTab | undefined;
      if (!tab || tab.type !== "query" || !tab.connectionName) return;

      tabManager.updateTab<QueryTab>(tabId, {
        explainLoading: true,
        explainError: undefined,
        showExplainPanel: true,
      });

      try {
        const plan = await api.explainQuery({ connectionKey: tab.connectionName, sql });
        tabManager.updateTab<QueryTab>(tabId, {
          explainPlan: plan,
          explainLoading: false,
        });
      } catch (error) {
        tabManager.updateTab<QueryTab>(tabId, {
          explainLoading: false,
          explainError: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [api, tabManager]
  );

  // Refresh table
  const handleRefreshTable = useCallback(
    async (tabId: string) => {
      if (!api) return;

      const tab = tabManager.getTab(tabId) as TableTab | undefined;
      if (!tab || tab.type !== "table" || !tab.connectionName) return;

      tabManager.updateTab<TableTab>(tabId, { loading: true });

      try {
        const [data, count] = await Promise.all([
          api.loadTableRows({
            connectionKey: tab.connectionName,
            schema: tab.schema,
            table: tab.table,
            limit: tab.limit,
            offset: tab.offset,
            filters: tab.filters,
            filterLogic: tab.filterLogic,
          }),
          api.getRowCount({
            connectionKey: tab.connectionName,
            schema: tab.schema,
            table: tab.table,
            filters: tab.filters,
            filterLogic: tab.filterLogic,
          }),
        ]);

        tabManager.updateTab<TableTab>(tabId, {
          columns: data.columns,
          rows: data.rows,
          totalRows: count,
          loading: false,
        });
      } catch (error) {
        console.error("Failed to refresh table:", error);
        tabManager.updateTab<TableTab>(tabId, { loading: false });
      }
    },
    [api, tabManager]
  );

  // Render active tab content
  const renderTabContent = () => {
    const activeTab = tabManager.getActiveTab();
    if (!activeTab) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-sm">No tabs open</div>
          <div className="text-xs mt-2">Select a table from the sidebar or create a new query</div>
        </div>
      );
    }

    if (activeTab.type === "query") {
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
        />
      );
    }

    if (activeTab.type === "table") {
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

    if (activeTab.type === "er-diagram") {
      return (
        <ERDiagramPanel
          diagramData={activeTab.diagramData}
          loading={activeTab.loading}
          availableSchemas={activeTab.availableSchemas}
          selectedSchemas={activeTab.selectedSchemas}
          onSchemaToggle={() => {}}
          onTableClick={(schema, table) => {
            if (activeTab.connectionName) {
              handleTableSelect(activeTab.connectionName, schema, table);
            }
          }}
          onClose={() => tabManager.closeTab(activeTab.id)}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--color-bg-light)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          },
        }}
      />
      <div className="flex h-screen bg-vscode-bg">
        {/* Sidebar */}
        <Sidebar
          onTableSelect={handleTableSelect}
          onQueryOpen={handleQueryOpen}
          onERDiagramOpen={handleERDiagramOpen}
          isVisible={sidebarVisible}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {tabManager.tabs.length > 0 && (
            <TabBar
              tabs={tabManager.tabs}
              activeTabId={tabManager.activeTabId}
              onTabSelect={tabManager.switchToTab}
              onTabClose={tabManager.closeTab}
              onNewQuery={() => {
                const activeTab = tabManager.getActiveTab();
                tabManager.addQueryTab(activeTab?.connectionName);
              }}
              onCloseOtherTabs={tabManager.closeOtherTabs}
              onCloseAllTabs={tabManager.closeAllTabs}
            />
          )}
          <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
        </div>
      </div>
    </>
  );
}

function toColumn(name: string): DataGridColumn {
  return {
    key: name,
    label: name.replace(/_/g, " "),
  };
}

export default ElectronApp;
