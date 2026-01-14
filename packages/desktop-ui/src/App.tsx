import { useCallback, useEffect } from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/design-system";
import { AppShell } from "@/layout";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";
import { DataView } from "@/components/DataView";
import { QueryViewRouter } from "@/components/QueryView";
import { FunctionView } from "@/components/FunctionView/FunctionView";
import { ERDiagramPanel } from "@/components/ERDiagramPanel";
import { AddConnectionView } from "@/components/AddConnectionView";
import { HomeView } from "@/components/HomeView";
import { SplitPane, type SplitDirection } from "@/components/SplitPane";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcuts";
import { getElectronAPI } from "@/electron";
import {
  useTabStore,
  useTabs,
  useActiveTabId,
  useSplitMode,
  useUIStore,
} from "@dbview/shared-state";
import type { Tab, ERDiagramTab } from "@dbview/types";

function AppContent() {
  const { resolvedTheme } = useTheme();

  // Use shared UI store
  const {
    showAddConnection,
    editingConnectionKey,
    sidebarRefreshTrigger,
    expandConnectionKey,
    showShortcutsDialog,
    openAddConnection,
    openEditConnection,
    closeConnectionDialog,
    triggerSidebarRefresh,
    expandAndClearConnection,
    setShowShortcutsDialog,
  } = useUIStore();

  // Use shared tab store
  const tabs = useTabs();
  const activeTabId = useActiveTabId();
  const splitMode = useSplitMode();
  const {
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    updateTab,
    reorderTabs,
    findOrCreateTableTab,
    addQueryTab,
    addERDiagramTab,
    findOrCreateFunctionTab,
    setSplitMode,
    setSecondActiveTab,
  } = useTabStore();
  const secondActiveTabId = useTabStore((s) => s.secondActiveTabId);

  const api = getElectronAPI();

  // Helper to get connection color
  const getConnectionColor = useCallback(async (connectionKey: string): Promise<string | undefined> => {
    if (!api) return undefined;
    try {
      const connections = await api.getConnections();
      const conn = connections.find((c) => {
        const cfg = c.config as Record<string, unknown>;
        const key = cfg.name
          ? `${cfg.dbType}:${cfg.name}`
          : cfg.host
          ? `${cfg.dbType}:${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`
          : `${cfg.dbType}:${JSON.stringify(cfg)}`;
        return key === connectionKey;
      });
      return (conn?.config as Record<string, unknown>)?.color as string | undefined;
    } catch (error) {
      console.error("Failed to get connection color:", error);
      return undefined;
    }
  }, [api]);

  // Split view handlers
  const splitView = useCallback((direction: SplitDirection) => {
    if (tabs.length < 2) return; // Need at least 2 tabs to split

    setSplitMode(direction);
    // Set the second pane to show a different tab
    const otherTab = tabs.find((t) => t.id !== activeTabId);
    if (otherTab) {
      setSecondActiveTab(otherTab.id);
    }
  }, [tabs, activeTabId, setSplitMode, setSecondActiveTab]);

  const closeSplit = useCallback(() => {
    setSplitMode(null);
    setSecondActiveTab(null);
  }, [setSplitMode, setSecondActiveTab]);

  // Keyboard shortcuts for split view and shortcuts dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // "?" to show keyboard shortcuts (when not typing)
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShowShortcutsDialog(true);
      }

      // Ctrl+\ or Cmd+\ to toggle split
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        if (e.shiftKey) {
          // Close split
          closeSplit();
        } else {
          // Toggle horizontal split
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

  // Close split if active tab or second tab is closed
  useEffect(() => {
    if (splitMode && secondActiveTabId) {
      const secondTabExists = tabs.some((t) => t.id === secondActiveTabId);
      if (!secondTabExists) {
        closeSplit();
      }
    }
  }, [tabs, splitMode, secondActiveTabId, closeSplit]);

  // Handlers
  const handleTableSelect = useCallback(
    async (connectionKey: string, connectionName: string, schema: string, table: string, database?: string) => {
      closeConnectionDialog();
      const connectionColor = await getConnectionColor(connectionKey);
      findOrCreateTableTab({
        schema,
        table,
        database,
        connectionName,
        connectionKey,
        connectionColor,
      });
    },
    [findOrCreateTableTab, getConnectionColor, closeConnectionDialog]
  );

  const handleFunctionSelect = useCallback(
    async (connectionKey: string, connectionName: string, schema: string, functionName: string, functionType: 'function' | 'procedure' | 'aggregate' | 'window' | 'trigger', database?: string) => {
      closeConnectionDialog();
      const connectionColor = await getConnectionColor(connectionKey);
      findOrCreateFunctionTab({
        schema,
        functionName,
        functionType,
        database,
        connectionName,
        connectionKey,
        connectionColor,
      });
    },
    [findOrCreateFunctionTab, getConnectionColor, closeConnectionDialog]
  );

  const handleQueryOpen = useCallback(
    async (connectionKey: string, connectionName: string) => {
      closeConnectionDialog();
      const connectionColor = await getConnectionColor(connectionKey);
      addQueryTab({
        connectionName,
        connectionKey,
        connectionColor,
      });
    },
    [addQueryTab, getConnectionColor, closeConnectionDialog]
  );

  const handleNewQuery = useCallback(async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const connectionColor = activeTab?.connectionKey
      ? await getConnectionColor(activeTab.connectionKey)
      : undefined;
    addQueryTab({
      connectionName: activeTab?.connectionName,
      connectionKey: activeTab?.connectionKey,
      connectionColor,
    });
  }, [tabs, activeTabId, addQueryTab, getConnectionColor]);

  const handleERDiagramOpen = useCallback(
    async (connectionKey: string, connectionName: string, schemas: string[]) => {
      closeConnectionDialog();
      // Check if ER diagram tab for this connection already exists
      const existingTab = tabs.find(
        (t) => t.type === "er-diagram" && t.connectionKey === connectionKey
      );
      if (existingTab) {
        // Update schemas and switch to existing tab
        updateTab<ERDiagramTab>(existingTab.id, { selectedSchemas: schemas });
        setActiveTab(existingTab.id);
        return;
      }

      const connectionColor = await getConnectionColor(connectionKey);
      addERDiagramTab({
        availableSchemas: schemas,
        connectionName,
        connectionKey,
        connectionColor,
      });
    },
    [tabs, addERDiagramTab, updateTab, setActiveTab, getConnectionColor, closeConnectionDialog]
  );

  const handleAddConnectionSave = useCallback(() => {
    closeConnectionDialog();
    // Trigger sidebar refresh to show the new connection
    triggerSidebarRefresh();
  }, [closeConnectionDialog, triggerSidebarRefresh]);

  const handleEditConnection = useCallback((connectionKey: string) => {
    openEditConnection(connectionKey);
  }, [openEditConnection]);

  const handleBrowseConnection = useCallback(
    (connectionKey: string) => {
      closeConnectionDialog();
      // Trigger sidebar expansion for this connection
      expandAndClearConnection(connectionKey);
    },
    [closeConnectionDialog, expandAndClearConnection]
  );

  // Handle tab updates from child components
  const handleTabUpdate = useCallback((tabId: string, updates: Partial<Tab>) => {
    updateTab(tabId, updates);
  }, [updateTab]);

  // Render a single tab's content (for split view)
  const renderTabContent = useCallback((tab: Tab | undefined) => {
    if (!tab) return null;

    if (tab.type === "table" && tab.connectionKey) {
      const tableTab = tab as import("@dbview/types").TableTab;
      // Use DataView router which handles SQL, Document, and Redis databases
      return (
        <DataView
          key={tab.id}
          connectionKey={tab.connectionKey}
          schema={tableTab.schema}
          table={tableTab.table}
          database={tableTab.database}
        />
      );
    }

    if (tab.type === "query") {
      // Cast to the expected shape for QueryViewRouter
      const queryTab = tab as import("@dbview/types").QueryTab;
      return (
        <QueryViewRouter
          key={tab.id}
          tab={{
            id: queryTab.id,
            connectionKey: queryTab.connectionKey,
            connectionName: queryTab.connectionName,
            sql: queryTab.sql,
            columns: queryTab.columns,
            rows: queryTab.rows,
            loading: queryTab.loading,
            error: queryTab.error,
            duration: queryTab.duration,
          }}
          onTabUpdate={handleTabUpdate}
        />
      );
    }

    if (tab.type === "er-diagram" && tab.connectionKey) {
      const erTab = tab as import("@dbview/types").ERDiagramTab;
      return (
        <ERDiagramPanel
          key={tab.id}
          connectionKey={tab.connectionKey}
          connectionName={tab.connectionName}
          schemas={erTab.selectedSchemas}
        />
      );
    }

    if (tab.type === "function" && tab.connectionKey) {
      const functionTab = tab as import("@dbview/types").FunctionTab;
      return (
        <FunctionView
          key={tab.id}
          connectionKey={tab.connectionKey}
          connectionName={tab.connectionName || ''}
          schema={functionTab.schema}
          functionName={functionTab.functionName}
          functionType={functionTab.functionType}
          database={functionTab.database}
          tabId={tab.id}
        />
      );
    }

    return null;
  }, [handleTabUpdate]);

  // Render all tabs (keeping them mounted to preserve state)
  const renderAllTabs = useCallback(() => {
    return tabs.map((tab) => {
      const isActive = tab.id === activeTabId;
      const isSecondPane = tab.id === secondActiveTabId;

      // In split mode, don't render here - let SplitPane handle it
      if (splitMode && (isActive || isSecondPane)) {
        return null;
      }

      // Use absolute positioning to layer tabs - active tab on top
      // This prevents virtualizer issues that occur with display:none
      const style: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        overflow: 'hidden',
        visibility: isActive ? 'visible' : 'hidden',
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 1 : 0,
      };

      if (tab.type === "table" && tab.connectionKey) {
        const tableTab = tab as import("@dbview/types").TableTab;
        // Use DataView router which handles SQL, Document, and Redis databases
        return (
          <div key={tab.id} style={style}>
            <DataView
              connectionKey={tab.connectionKey}
              schema={tableTab.schema}
              table={tableTab.table}
            />
          </div>
        );
      }

      if (tab.type === "query") {
        const queryTab = tab as import("@dbview/types").QueryTab;
        return (
          <div key={tab.id} style={style}>
            <QueryViewRouter
              tab={{
                id: queryTab.id,
                connectionKey: queryTab.connectionKey,
                connectionName: queryTab.connectionName,
                sql: queryTab.sql,
                columns: queryTab.columns,
                rows: queryTab.rows,
                loading: queryTab.loading,
                error: queryTab.error,
                duration: queryTab.duration,
              }}
              onTabUpdate={handleTabUpdate}
            />
          </div>
        );
      }

      if (tab.type === "er-diagram" && tab.connectionKey) {
        const erTab = tab as import("@dbview/types").ERDiagramTab;
        return (
          <div key={tab.id} style={style}>
            <ERDiagramPanel
              connectionKey={tab.connectionKey}
              connectionName={tab.connectionName}
              schemas={erTab.selectedSchemas}
            />
          </div>
        );
      }

      return null;
    });
  }, [tabs, activeTabId, secondActiveTabId, splitMode, handleTabUpdate]);

  // Render main content
  const renderContent = () => {
    // Show Add Connection View
    if (showAddConnection) {
      return (
        <AddConnectionView
          onSave={handleAddConnectionSave}
          onCancel={closeConnectionDialog}
          editingConnectionKey={editingConnectionKey}
        />
      );
    }

    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Empty state - no tabs open - show home view
    if (!activeTab) {
      return (
        <HomeView
          onAddConnection={openAddConnection}
          onQueryOpen={handleQueryOpen}
          onEditConnection={handleEditConnection}
          onBrowseConnection={handleBrowseConnection}
        />
      );
    }

    // Split view mode
    if (splitMode && secondActiveTabId) {
      const secondTab = tabs.find((t) => t.id === secondActiveTabId);
      return (
        <SplitPane
          direction={splitMode}
          firstPane={renderTabContent(activeTab)}
          secondPane={renderTabContent(secondTab)}
          persistKey={`split-${splitMode}`}
        />
      );
    }

    // Single view mode - render all tabs but only show active one
    return renderAllTabs();
  };

  // Convert tabs to the format expected by TabBar
  const tabBarTabs = tabs.map((tab) => ({
    id: tab.id,
    type: tab.type,
    title: tab.title,
    schema: tab.type === "table" ? (tab as import("@dbview/types").TableTab).schema : undefined,
    table: tab.type === "table" ? (tab as import("@dbview/types").TableTab).table : undefined,
    connectionKey: tab.connectionKey,
    connectionName: tab.connectionName,
    connectionColor: tab.connectionColor,
    isDirty: tab.isDirty,
  }));

  return (
    <>
      <Toaster
        theme={resolvedTheme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          },
        }}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showShortcutsDialog}
        onOpenChange={setShowShortcutsDialog}
      />

      <AppShell
        sidebar={
          <Sidebar
            onTableSelect={handleTableSelect}
            onFunctionSelect={handleFunctionSelect}
            onQueryOpen={handleQueryOpen}
            onERDiagramOpen={handleERDiagramOpen}
            onAddConnection={openAddConnection}
            onEditConnection={handleEditConnection}
            refreshTrigger={sidebarRefreshTrigger}
            expandConnectionKey={expandConnectionKey}
          />
        }
      >
        {/* Tab Bar - hide when showing Add Connection */}
        {!showAddConnection && (
          <TabBar
            tabs={tabBarTabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            onNewQuery={handleNewQuery}
            onCloseOtherTabs={closeOtherTabs}
            onCloseAllTabs={closeAllTabs}
            onReorderTabs={(reorderedTabs) => {
              // Map back to full tabs for the store
              const fullTabs = reorderedTabs.map((t) => {
                const original = tabs.find((tab) => tab.id === t.id);
                return original || t;
              }).filter((t): t is Tab => t !== undefined);
              reorderTabs(fullTabs);
            }}
            onSplitView={splitView}
            onCloseSplit={closeSplit}
            isSplitView={!!splitMode}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden bg-bg-primary relative">
          {renderContent()}
        </div>
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultMode="dark">
      <AppContent />
    </ThemeProvider>
  );
}
