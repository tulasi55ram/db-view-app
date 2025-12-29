/**
 * VSCodeApp - VS Code Extension UI using shared-ui components
 *
 * This component provides UI/UX parity with the desktop app by using
 * shared-ui components that work across both platforms via the unified API.
 */

import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
// Import design system from shared-ui
import { ThemeProvider, useTheme } from "@dbview/shared-ui/design-system";
// Import components from shared-ui - these handle their own data fetching via getAPI()
import {
  DataView,
  QueryViewRouter,
  ERDiagramPanel,
} from "@dbview/shared-ui/components";
// Use local TabBar for VS Code-specific styling
import { TabBar } from "./components/TabBar";
import { getVsCodeApi } from "./vscode";

// Tab types matching shared-ui patterns
interface Tab {
  id: string;
  type: "table" | "query" | "er-diagram";
  title: string;
  schema?: string;
  table?: string;
  connectionKey?: string;
  connectionName?: string;

  // Query-specific fields
  sql?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  loading?: boolean;
  error?: string;
  limitApplied?: boolean;
  limit?: number;
  hasMore?: boolean;
  duration?: number;
  isDirty?: boolean;

  // ER Diagram fields
  schemas?: string[];
}

// Incoming messages from extension
type IncomingMessage =
  | {
      type: "OPEN_TABLE";
      schema: string;
      table: string;
      limit?: number;
      connectionKey?: string;
      connectionName?: string;
    }
  | { type: "OPEN_QUERY_TAB"; connectionKey?: string; connectionName?: string }
  | {
      type: "OPEN_ER_DIAGRAM";
      schemas: string[];
      connectionKey?: string;
      connectionName?: string;
    }
  | { type: "THEME_CHANGE"; theme: "light" | "dark" | "high-contrast" };

function VSCodeAppContent() {
  const { resolvedTheme } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const vscode = getVsCodeApi();

  // Notify extension that webview is ready
  useEffect(() => {
    if (vscode) {
      console.log("[VSCodeApp] Webview mounted, sending READY message");
      vscode.postMessage({ type: "WEBVIEW_READY" });
    }
  }, [vscode]);

  // Tab management
  const addTab = useCallback((tab: Omit<Tab, "id">) => {
    const id = `${tab.type}-${Date.now()}`;
    const newTab = { ...tab, id };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    return id;
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        }
        return newTabs;
      });
    },
    [activeTabId]
  );

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id === tabId));
    setActiveTabId(tabId);
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }, []);

  // Find existing tab or create new one
  const findOrCreateTableTab = useCallback(
    (
      connectionKey: string,
      connectionName: string | undefined,
      schema: string,
      table: string
    ) => {
      // Check for existing tab
      const existingTab = tabs.find(
        (t) =>
          t.type === "table" &&
          t.connectionKey === connectionKey &&
          t.schema === schema &&
          t.table === table
      );
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return existingTab.id;
      }

      // Create new tab
      return addTab({
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

  // Handle incoming messages from extension
  useEffect(() => {
    if (!vscode) return;

    const handleMessage = (event: MessageEvent<IncomingMessage>) => {
      const message = event.data;
      console.log("[VSCodeApp] Received message:", message?.type, message);

      switch (message?.type) {
        case "OPEN_TABLE": {
          console.log(
            `[VSCodeApp] Opening table: ${message.schema}.${message.table} on ${message.connectionKey}`
          );
          findOrCreateTableTab(
            message.connectionKey || "",
            message.connectionName,
            message.schema,
            message.table
          );
          break;
        }

        case "OPEN_QUERY_TAB": {
          console.log(`[VSCodeApp] Opening new query tab for ${message.connectionKey}`);
          addTab({
            type: "query",
            title: "New Query",
            connectionKey: message.connectionKey,
            connectionName: message.connectionName,
            sql: "",
            columns: [],
            rows: [],
            loading: false,
          });
          break;
        }

        case "OPEN_ER_DIAGRAM": {
          console.log(`[VSCodeApp] Opening ER diagram for schemas:`, message.schemas);
          // Check for existing ER diagram tab for this connection
          const existingTab = tabs.find(
            (t) => t.type === "er-diagram" && t.connectionKey === message.connectionKey
          );
          if (existingTab) {
            // Update schemas and switch to existing tab
            updateTab(existingTab.id, { schemas: message.schemas });
            setActiveTabId(existingTab.id);
          } else {
            addTab({
              type: "er-diagram",
              title: "ER Diagram",
              connectionKey: message.connectionKey,
              connectionName: message.connectionName,
              schemas: message.schemas,
            });
          }
          break;
        }

        case "THEME_CHANGE": {
          console.log(`[VSCodeApp] Theme changed to: ${message.theme}`);
          // Theme is handled by ThemeProvider listening to onThemeChange events
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vscode, tabs, addTab, updateTab, findOrCreateTableTab]);

  // Handle creating new query from tab bar
  const handleNewQuery = useCallback(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    addTab({
      type: "query",
      title: "New Query",
      connectionKey: activeTab?.connectionKey,
      connectionName: activeTab?.connectionName,
      sql: "",
      columns: [],
      rows: [],
      loading: false,
    });
  }, [tabs, activeTabId, addTab]);

  // Render tab content
  const renderTabContent = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);

    if (!activeTab) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-text-secondary">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-sm">No tabs open</div>
          <div className="text-xs mt-2 text-text-tertiary">
            Click on a table in the explorer or create a new query
          </div>
        </div>
      );
    }

    if (activeTab.type === "table" && activeTab.schema !== undefined && activeTab.table && activeTab.connectionKey) {
      return (
        <DataView
          key={activeTab.id}
          connectionKey={activeTab.connectionKey}
          schema={activeTab.schema}
          table={activeTab.table}
        />
      );
    }

    if (activeTab.type === "query") {
      return (
        <QueryViewRouter
          key={activeTab.id}
          tab={activeTab}
          onTabUpdate={updateTab}
        />
      );
    }

    if (activeTab.type === "er-diagram" && activeTab.connectionKey && activeTab.schemas) {
      return (
        <ERDiagramPanel
          key={activeTab.id}
          connectionKey={activeTab.connectionKey}
          connectionName={activeTab.connectionName}
          schemas={activeTab.schemas}
        />
      );
    }

    return null;
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
      <div className="flex flex-col h-screen bg-bg-primary">
        {tabs.length > 0 && (
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
        <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
      </div>
    </>
  );
}

export function VSCodeApp() {
  return (
    <ThemeProvider defaultMode="system">
      <VSCodeAppContent />
    </ThemeProvider>
  );
}

export default VSCodeApp;
