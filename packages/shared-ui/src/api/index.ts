/**
 * Platform-agnostic API module
 *
 * This module provides a unified API interface that works across:
 * - Electron (desktop app)
 * - VS Code webview
 * - Web browser (future)
 */

import type { DatabaseAPI, Platform } from "./types";

// Re-export all types
export * from "./types";

// Platform detection
declare global {
  interface Window {
    electronAPI?: DatabaseAPI;
    vscodeAPI?: {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
  }
}

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  if (typeof window === "undefined") {
    return "web"; // SSR or Node.js
  }

  if ("electronAPI" in window && window.electronAPI !== undefined) {
    return "electron";
  }

  if ("vscodeAPI" in window && window.vscodeAPI !== undefined) {
    return "vscode";
  }

  return "web";
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return detectPlatform() === "electron";
}

/**
 * Check if running in VS Code webview
 */
export function isVSCode(): boolean {
  return detectPlatform() === "vscode";
}

/**
 * Check if running in web browser
 */
export function isWeb(): boolean {
  return detectPlatform() === "web";
}

// API instance cache
let apiInstance: DatabaseAPI | null = null;

/**
 * Get the platform-specific API instance
 * Returns the appropriate implementation based on detected platform
 */
export function getAPI(): DatabaseAPI | undefined {
  if (apiInstance) {
    return apiInstance;
  }

  const platform = detectPlatform();

  switch (platform) {
    case "electron":
      // Electron API is exposed directly on window
      apiInstance = window.electronAPI || null;
      break;
    case "vscode":
      // VS Code API needs to be created from the vscode bridge
      // This will be implemented in vscodeApi.ts
      apiInstance = createVSCodeAPI();
      break;
    case "web":
      // Web API not implemented yet
      apiInstance = null;
      break;
  }

  return apiInstance || undefined;
}

/**
 * Create VS Code API wrapper
 * This wraps the postMessage API to provide a Promise-based interface
 */
function createVSCodeAPI(): DatabaseAPI | null {
  const vscode = window.vscodeAPI;
  if (!vscode) {
    return null;
  }

  // Message ID counter for correlating requests/responses
  let messageId = 0;
  const pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const eventListeners = new Map<string, Set<(data: unknown) => void>>();

  // Listen for messages from extension
  window.addEventListener("message", (event) => {
    const message = event.data;

    // Handle response to a request
    if (message.requestId !== undefined && pendingRequests.has(message.requestId)) {
      const { resolve, reject } = pendingRequests.get(message.requestId)!;
      pendingRequests.delete(message.requestId);

      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.data);
      }
      return;
    }

    // Handle event broadcast
    if (message.event) {
      const listeners = eventListeners.get(message.event);
      if (listeners) {
        listeners.forEach((callback) => callback(message.data));
      }
    }
  });

  // Helper to send request and wait for response
  function request<T>(type: string, params?: object): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });

      vscode!.postMessage({
        type,
        requestId: id,
        ...(params as Record<string, unknown> || {}),
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${type}`));
        }
      }, 30000);
    });
  }

  // Helper to subscribe to events
  function subscribe(event: string, callback: (data: unknown) => void): () => void {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback);

    return () => {
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  // Implement DatabaseAPI interface
  const api: DatabaseAPI = {
    // Connection management
    getConnections: () => request("GET_CONNECTIONS"),
    saveConnection: (config) => request("SAVE_CONNECTION", { config }),
    deleteConnection: (name) => request("DELETE_CONNECTION", { name }),
    testConnection: (config) => request("TEST_CONNECTION", { config }),
    connectToDatabase: (connectionKey) => request("CONNECT", { connectionKey }),
    disconnectFromDatabase: (connectionKey) => request("DISCONNECT", { connectionKey }),

    // Schema operations
    listSchemas: (connectionKey) => request("LIST_SCHEMAS", { connectionKey }),
    listTables: (connectionKey, schema) => request("LIST_TABLES", { connectionKey, schema }),
    getHierarchy: (connectionKey) => request("GET_HIERARCHY", { connectionKey }),
    getObjectCounts: (connectionKey, schema) => request("GET_OBJECT_COUNTS", { connectionKey, schema }),
    listViews: (connectionKey, schema) => request("LIST_VIEWS", { connectionKey, schema }),
    listMaterializedViews: (connectionKey, schema) => request("LIST_MATERIALIZED_VIEWS", { connectionKey, schema }),
    listFunctions: (connectionKey, schema) => request("LIST_FUNCTIONS", { connectionKey, schema }),
    listProcedures: (connectionKey, schema) => request("LIST_PROCEDURES", { connectionKey, schema }),
    listTypes: (connectionKey, schema) => request("LIST_TYPES", { connectionKey, schema }),
    listColumns: (connectionKey, schema, table) => request("LIST_COLUMNS", { connectionKey, schema, table }),

    // Table operations
    loadTableRows: (params) => request("LOAD_TABLE_ROWS", params),
    getRowCount: (params) => request("GET_ROW_COUNT", params),
    getTableMetadata: (params) => request("GET_TABLE_METADATA", params),
    getTableStatistics: (params) => request("GET_TABLE_STATISTICS", params),
    getTableIndexes: (params) => request("GET_TABLE_INDEXES", params),
    updateCell: (params) => request("UPDATE_CELL", params),
    insertRow: (params) => request("INSERT_ROW", params),
    deleteRows: (params) => request("DELETE_ROWS", params),

    // Query operations
    runQuery: (params) => request("RUN_QUERY", params),
    formatSql: (sql) => request("FORMAT_SQL", { sql }),
    explainQuery: (params) => request("EXPLAIN_QUERY", params),

    // Saved views
    getViews: (params) => request("GET_VIEWS", params),
    saveView: (params) => request("SAVE_VIEW", params),
    deleteView: (params) => request("DELETE_VIEW", params),

    // ER Diagram
    getERDiagram: (connectionKey, schemas) => request("GET_ER_DIAGRAM", { connectionKey, schemas }),

    // Autocomplete
    getAutocompleteData: (connectionKey) => request("GET_AUTOCOMPLETE_DATA", { connectionKey }),

    // Export/Import
    exportData: (params) => request("EXPORT_DATA", params),
    importData: (params) => request("IMPORT_DATA", params),

    // Clipboard
    copyToClipboard: (text) => request("COPY_TO_CLIPBOARD", { text }),

    // Query history
    getQueryHistory: (connectionKey) => request("GET_QUERY_HISTORY", { connectionKey }),
    addQueryHistoryEntry: (connectionKey, entry) => request("ADD_QUERY_HISTORY", { connectionKey, entry }),
    clearQueryHistory: (connectionKey) => request("CLEAR_QUERY_HISTORY", { connectionKey }),
    deleteQueryHistoryEntry: (connectionKey, entryId) => request("DELETE_QUERY_HISTORY_ENTRY", { connectionKey, entryId }),
    toggleQueryHistoryStar: (connectionKey, entryId, starred) => request("TOGGLE_QUERY_STAR", { connectionKey, entryId, starred }),

    // Saved queries
    getSavedQueries: (connectionKey) => request("GET_SAVED_QUERIES", { connectionKey }),
    addSavedQuery: (connectionKey, query) => request("ADD_SAVED_QUERY", { connectionKey, query }),
    updateSavedQuery: (connectionKey, queryId, updates) => request("UPDATE_SAVED_QUERY", { connectionKey, queryId, updates }),
    deleteSavedQuery: (connectionKey, queryId) => request("DELETE_SAVED_QUERY", { connectionKey, queryId }),

    // Filter presets
    getFilterPresets: (schema, table) => request("GET_FILTER_PRESETS", { schema, table }),
    saveFilterPreset: (schema, table, preset) => request("SAVE_FILTER_PRESET", { schema, table, preset }),
    deleteFilterPreset: (schema, table, presetId) => request("DELETE_FILTER_PRESET", { schema, table, presetId }),

    // Theme
    getTheme: () => request("GET_THEME"),

    // Event subscriptions
    onConnectionStatusChange: (callback) => subscribe("CONNECTION_STATUS_CHANGE", callback as (data: unknown) => void),
    onThemeChange: (callback) => subscribe("THEME_CHANGE", callback as (data: unknown) => void),
  };

  return api;
}

// Backward compatibility exports
export { getAPI as getElectronAPI };
