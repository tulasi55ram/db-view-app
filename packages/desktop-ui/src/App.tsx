import { useState, useCallback } from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/design-system";
import { AppShell } from "@/layout";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";
import { TableView } from "@/components/TableView";
import { AddConnectionView } from "@/components/AddConnectionView";
import { Database, Plus } from "lucide-react";

// Tab types
interface Tab {
  id: string;
  type: "table" | "query" | "er-diagram";
  title: string;
  schema?: string;
  table?: string;
  connectionKey?: string; // Unique identifier for the connection
  connectionName?: string; // Display name for the connection
  isDirty?: boolean;
}

function AppContent() {
  const { resolvedTheme } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

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

  // Handlers
  const handleTableSelect = useCallback(
    (connectionKey: string, connectionName: string, schema: string, table: string) => {
      setShowAddConnection(false);
      const existingTab = tabs.find(
        (t) => t.type === "table" && t.connectionKey === connectionKey && t.schema === schema && t.table === table
      );
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }

      addTab({
        type: "table",
        title: table,
        schema,
        table,
        connectionKey,
        connectionName,
      });
    },
    [tabs, addTab]
  );

  const handleQueryOpen = useCallback(
    (connectionKey: string, connectionName: string) => {
      setShowAddConnection(false);
      addTab({
        type: "query",
        title: "New Query",
        connectionKey,
        connectionName,
      });
    },
    [addTab]
  );

  const handleNewQuery = useCallback(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    addTab({
      type: "query",
      title: "New Query",
      connectionKey: activeTab?.connectionKey,
      connectionName: activeTab?.connectionName,
    });
  }, [tabs, activeTabId, addTab]);

  const handleAddConnectionSave = useCallback(() => {
    setShowAddConnection(false);
    // Trigger sidebar refresh to show the new connection
    setSidebarRefreshTrigger((prev) => prev + 1);
  }, []);

  // Render main content
  const renderContent = () => {
    // Show Add Connection View
    if (showAddConnection) {
      return (
        <AddConnectionView
          onSave={handleAddConnectionSave}
          onCancel={() => setShowAddConnection(false)}
        />
      );
    }

    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Empty state - no tabs open
    if (!activeTab) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <div className="w-20 h-20 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-6">
            <Database className="w-10 h-10 opacity-30" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Welcome to DBView</h2>
          <p className="text-sm text-text-tertiary mb-6 text-center max-w-md">
            Connect to a database to start exploring your data,<br />
            or select a table from the sidebar.
          </p>
          <button
            onClick={() => setShowAddConnection(true)}
            className="h-10 px-5 rounded-lg flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Connection
          </button>
        </div>
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

    // Placeholder for other tab types (query, er-diagram)
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">
            {activeTab.type === "query" ? "Query Editor" : "ER Diagram"}
          </p>
          <p className="text-sm text-text-tertiary">
            {activeTab.title}
          </p>
          <p className="text-xs text-text-tertiary mt-2">
            (Coming soon)
          </p>
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
            refreshTrigger={sidebarRefreshTrigger}
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
