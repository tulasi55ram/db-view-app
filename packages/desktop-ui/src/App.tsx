import { useState, useCallback } from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/design-system";
import { AppShell } from "@/layout";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";
import { TableView } from "@/components/TableView";
import { QueryView } from "@/components/QueryView";
import { AddConnectionView } from "@/components/AddConnectionView";
import { HomeView } from "@/components/HomeView";

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
}

function AppContent() {
  const { resolvedTheme } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [editingConnectionKey, setEditingConnectionKey] = useState<string | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [expandConnectionKey, setExpandConnectionKey] = useState<string | null>(null);

  const api = (window as any).electronAPI;

  // Helper to get connection color
  const getConnectionColor = useCallback(async (connectionKey: string): Promise<string | undefined> => {
    if (!api) return undefined;
    try {
      const connections = await api.getConnections();
      const conn = connections.find((c: any) => {
        const key = c.config.name
          ? `${c.config.dbType}:${c.config.name}`
          : c.config.host
          ? `${c.config.dbType}:${c.config.user}@${c.config.host}:${c.config.port}/${c.config.database}`
          : `${c.config.dbType}:${JSON.stringify(c.config)}`;
        return key === connectionKey;
      });
      return conn?.config?.color;
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

    // Render actual tab content
    if (activeTab.type === "table" && activeTab.schema && activeTab.table && activeTab.connectionKey) {
      return (
        <TableView
          connectionKey={activeTab.connectionKey}
          schema={activeTab.schema}
          table={activeTab.table}
        />
      );
    }

    // Render query tab
    if (activeTab.type === "query") {
      return <QueryView tab={activeTab} onTabUpdate={updateQueryTab} />;
    }

    // Placeholder for ER diagram
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">ER Diagram</p>
          <p className="text-sm text-text-tertiary">{activeTab.title}</p>
          <p className="text-xs text-text-tertiary mt-2">(Coming soon)</p>
        </div>
      </div>
    );
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
          />
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden bg-bg-primary">
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
