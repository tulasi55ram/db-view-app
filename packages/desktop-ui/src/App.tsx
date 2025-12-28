import { useState, useCallback, useEffect } from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/design-system";
import { AppShell } from "@/layout";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";
import { TableView } from "@/components/TableView";
import { RedisDataView } from "@/components/RedisDataView";
import { QueryView } from "@/components/QueryView";
import { ERDiagramPanel } from "@/components/ERDiagramPanel";
import { AddConnectionView } from "@/components/AddConnectionView";
import { HomeView } from "@/components/HomeView";
import { SplitPane, type SplitDirection } from "@/components/SplitPane";
import { getElectronAPI } from "@/electron";

// Tab types
interface Tab {
  id: string;
  type: "table" | "query" | "er-diagram";
  title: string;
  schema?: string;
  table?: string;
  connectionKey?: string; // Unique identifier for the connection
  connectionName?: string; // Display name for the connection
  connectionColor?: string; // Custom color for the connection
  isDirty?: boolean;

  // Query-specific fields
  sql?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  loading?: boolean;
  error?: string;
  limitApplied?: boolean; // Whether an automatic LIMIT was applied
  limit?: number; // The limit value that was applied
  hasMore?: boolean; // Whether there are potentially more rows

  // ER Diagram fields
  schemas?: string[]; // Schemas to show in ER diagram
}

function AppContent() {
  const { resolvedTheme } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [editingConnectionKey, setEditingConnectionKey] = useState<string | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [expandConnectionKey, setExpandConnectionKey] = useState<string | null>(null);

  // Split view state
  const [splitMode, setSplitMode] = useState<SplitDirection | null>(null);
  const [secondActiveTabId, setSecondActiveTabId] = useState<string | null>(null);

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

  // Tab management
  const addTab = useCallback((tab: Omit<Tab, "id">) => {
    const id = `${tab.type}-${Date.now()}`;
    const newTab = { ...tab, id };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    return id;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id === tabId));
    setActiveTabId(tabId);
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const updateQueryTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }, []);

  const reorderTabs = useCallback((reorderedTabs: Tab[]) => {
    setTabs(reorderedTabs);
  }, []);

  // Split view handlers
  const splitView = useCallback((direction: SplitDirection) => {
    if (tabs.length < 2) return; // Need at least 2 tabs to split

    setSplitMode(direction);
    // Set the second pane to show a different tab
    const otherTab = tabs.find((t) => t.id !== activeTabId);
    if (otherTab) {
      setSecondActiveTabId(otherTab.id);
    }
  }, [tabs, activeTabId]);

  const closeSplit = useCallback(() => {
    setSplitMode(null);
    setSecondActiveTabId(null);
  }, []);

  // Keyboard shortcuts for split view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    async (connectionKey: string, connectionName: string, schema: string, table: string) => {
      setShowAddConnection(false);
      const existingTab = tabs.find(
        (t) => t.type === "table" && t.connectionKey === connectionKey && t.schema === schema && t.table === table
      );
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }

      const connectionColor = await getConnectionColor(connectionKey);
      addTab({
        type: "table",
        title: table,
        schema,
        table,
        connectionKey,
        connectionName,
        connectionColor,
      });
    },
    [tabs, addTab, getConnectionColor]
  );

  const handleQueryOpen = useCallback(
    async (connectionKey: string, connectionName: string) => {
      setShowAddConnection(false);
      const connectionColor = await getConnectionColor(connectionKey);
      addTab({
        type: "query",
        title: "New Query",
        connectionKey,
        connectionName,
        connectionColor,
        sql: "",
        columns: [],
        rows: [],
        loading: false,
      });
    },
    [addTab, getConnectionColor]
  );

  const handleNewQuery = useCallback(async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const connectionColor = activeTab?.connectionKey
      ? await getConnectionColor(activeTab.connectionKey)
      : undefined;
    addTab({
      type: "query",
      title: "New Query",
      connectionKey: activeTab?.connectionKey,
      connectionName: activeTab?.connectionName,
      connectionColor,
      sql: "",
      columns: [],
      rows: [],
      loading: false,
    });
  }, [tabs, activeTabId, addTab]);

  const handleERDiagramOpen = useCallback(
    async (connectionKey: string, connectionName: string, schemas: string[]) => {
      setShowAddConnection(false);
      // Check if ER diagram tab for this connection already exists
      const existingTab = tabs.find(
        (t) => t.type === "er-diagram" && t.connectionKey === connectionKey
      );
      if (existingTab) {
        // Update schemas and switch to existing tab
        setTabs((prev) =>
          prev.map((t) => (t.id === existingTab.id ? { ...t, schemas } : t))
        );
        setActiveTabId(existingTab.id);
        return;
      }

      const connectionColor = await getConnectionColor(connectionKey);
      addTab({
        type: "er-diagram",
        title: "ER Diagram",
        connectionKey,
        connectionName,
        connectionColor,
        schemas,
      });
    },
    [tabs, addTab, getConnectionColor]
  );

  const handleAddConnectionSave = useCallback(() => {
    setShowAddConnection(false);
    setEditingConnectionKey(null);
    // Trigger sidebar refresh to show the new connection
    setSidebarRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleEditConnection = useCallback((connectionKey: string) => {
    setEditingConnectionKey(connectionKey);
    setShowAddConnection(true);
  }, []);

  const handleBrowseConnection = useCallback(
    (connectionKey: string) => {
      setShowAddConnection(false);
      // Trigger sidebar expansion for this connection
      setExpandConnectionKey(connectionKey);
      // Reset after a short delay to allow re-triggering if needed
      setTimeout(() => setExpandConnectionKey(null), 100);
    },
    []
  );

  // Render a single tab's content (for split view)
  const renderTabContent = useCallback((tab: Tab | undefined) => {
    if (!tab) return null;

    if (tab.type === "table" && tab.schema !== undefined && tab.table && tab.connectionKey) {
      // Use RedisDataView for Redis connections
      if (tab.connectionKey.startsWith("redis:")) {
        return (
          <RedisDataView
            key={tab.id}
            connectionKey={tab.connectionKey}
            schema={tab.schema}
            table={tab.table}
          />
        );
      }
      return (
        <TableView
          key={tab.id}
          connectionKey={tab.connectionKey}
          schema={tab.schema}
          table={tab.table}
        />
      );
    }

    if (tab.type === "query") {
      return <QueryView key={tab.id} tab={tab} onTabUpdate={updateQueryTab} />;
    }

    if (tab.type === "er-diagram" && tab.connectionKey && tab.schemas) {
      return (
        <ERDiagramPanel
          key={tab.id}
          connectionKey={tab.connectionKey}
          connectionName={tab.connectionName}
          schemas={tab.schemas}
        />
      );
    }

    return null;
  }, [updateQueryTab]);

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

      if (tab.type === "table" && tab.schema !== undefined && tab.table && tab.connectionKey) {
        // Use RedisDataView for Redis connections
        if (tab.connectionKey.startsWith("redis:")) {
          return (
            <div key={tab.id} style={style}>
              <RedisDataView
                connectionKey={tab.connectionKey}
                schema={tab.schema}
                table={tab.table}
              />
            </div>
          );
        }
        return (
          <div key={tab.id} style={style}>
            <TableView
              connectionKey={tab.connectionKey}
              schema={tab.schema}
              table={tab.table}
            />
          </div>
        );
      }

      if (tab.type === "query") {
        return (
          <div key={tab.id} style={style}>
            <QueryView tab={tab} onTabUpdate={updateQueryTab} />
          </div>
        );
      }

      if (tab.type === "er-diagram" && tab.connectionKey && tab.schemas) {
        return (
          <div key={tab.id} style={style}>
            <ERDiagramPanel
              connectionKey={tab.connectionKey}
              connectionName={tab.connectionName}
              schemas={tab.schemas}
            />
          </div>
        );
      }

      return null;
    });
  }, [tabs, activeTabId, secondActiveTabId, splitMode, updateQueryTab]);

  // Render main content
  const renderContent = () => {
    // Show Add Connection View
    if (showAddConnection) {
      return (
        <AddConnectionView
          onSave={handleAddConnectionSave}
          onCancel={() => {
            setShowAddConnection(false);
            setEditingConnectionKey(null);
          }}
          editingConnectionKey={editingConnectionKey}
        />
      );
    }

    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Empty state - no tabs open - show home view
    if (!activeTab) {
      return (
        <HomeView
          onAddConnection={() => setShowAddConnection(true)}
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

      <AppShell
        sidebar={
          <Sidebar
            onTableSelect={handleTableSelect}
            onQueryOpen={handleQueryOpen}
            onERDiagramOpen={handleERDiagramOpen}
            onAddConnection={() => setShowAddConnection(true)}
            onEditConnection={handleEditConnection}
            refreshTrigger={sidebarRefreshTrigger}
            expandConnectionKey={expandConnectionKey}
          />
        }
      >
        {/* Tab Bar - hide when showing Add Connection */}
        {!showAddConnection && (
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
            onNewQuery={handleNewQuery}
            onCloseOtherTabs={closeOtherTabs}
            onCloseAllTabs={closeAllTabs}
            onReorderTabs={reorderTabs}
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
