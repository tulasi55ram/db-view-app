import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "./api";

// Create the API object
const electronAPI: ElectronAPI = {
  // Connection management
  getConnections: () => ipcRenderer.invoke("connections:getAll"),
  saveConnection: (config) => ipcRenderer.invoke("connections:save", config),
  deleteConnection: (name) => ipcRenderer.invoke("connections:delete", name),
  testConnection: (config) => ipcRenderer.invoke("connections:test", config),
  connectToDatabase: (connectionKey) => ipcRenderer.invoke("connections:connect", connectionKey),
  disconnectFromDatabase: (connectionKey) => ipcRenderer.invoke("connections:disconnect", connectionKey),
  getConnectionOrder: () => ipcRenderer.invoke("connections:getOrder"),
  saveConnectionOrder: (order) => ipcRenderer.invoke("connections:saveOrder", order),

  // Schema operations
  listDatabases: (connectionKey) => ipcRenderer.invoke("database:list", connectionKey),
  listSchemas: (connectionKey, database) => ipcRenderer.invoke("schema:list", connectionKey, database),
  listTables: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getTables", connectionKey, schema, database),
  getHierarchy: (connectionKey) => ipcRenderer.invoke("schema:getHierarchy", connectionKey),
  getObjectCounts: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getObjectCounts", connectionKey, schema, database),
  listViews: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getViews", connectionKey, schema, database),
  listMaterializedViews: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getMaterializedViews", connectionKey, schema, database),
  listFunctions: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getFunctions", connectionKey, schema, database),
  listProcedures: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getProcedures", connectionKey, schema, database),
  listTypes: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getTypes", connectionKey, schema, database),
  listTriggers: (connectionKey, schema, database) => ipcRenderer.invoke("schema:getTriggers", connectionKey, schema, database),
  listColumns: (connectionKey, schema, table) => ipcRenderer.invoke("table:getColumns", connectionKey, schema, table),

  // Function/Trigger operations
  getFunctionDetails: (connectionKey, schema, functionName) => ipcRenderer.invoke("schema:getFunctionDetails", connectionKey, schema, functionName),
  getTriggerDetails: (connectionKey, schema, triggerName) => ipcRenderer.invoke("schema:getTriggerDetails", connectionKey, schema, triggerName),
  updateFunctionDefinition: (connectionKey, definition) => ipcRenderer.invoke("schema:updateFunctionDefinition", connectionKey, definition),
  executeFunction: (connectionKey, schema, functionName, parameters) => ipcRenderer.invoke("schema:executeFunction", connectionKey, schema, functionName, parameters),

  // Table operations
  loadTableRows: (params) => ipcRenderer.invoke("table:loadRows", params),
  getRowCount: (params) => ipcRenderer.invoke("table:getRowCount", params),
  getTableMetadata: (params) => ipcRenderer.invoke("table:getMetadata", params),
  getTableStatistics: (params) => ipcRenderer.invoke("table:getStatistics", params),
  getTableIndexes: (params) => ipcRenderer.invoke("table:getIndexes", params),
  updateCell: (params) => ipcRenderer.invoke("table:updateCell", params),
  insertRow: (params) => ipcRenderer.invoke("table:insertRow", params),
  deleteRows: (params) => ipcRenderer.invoke("table:deleteRows", params),

  // Query operations
  runQuery: (params) => ipcRenderer.invoke("query:run", params),
  formatSql: (sql) => ipcRenderer.invoke("query:format", sql),
  explainQuery: (params) => ipcRenderer.invoke("query:explain", params),
  cancelQuery: (connectionKey) => ipcRenderer.invoke("query:cancel", connectionKey),

  // Saved views
  getViews: (params) => ipcRenderer.invoke("views:getAll", params),
  saveView: (params) => ipcRenderer.invoke("views:save", params),
  deleteView: (params) => ipcRenderer.invoke("views:delete", params),

  // ER Diagram
  getERDiagram: (connectionKey, schemas) => ipcRenderer.invoke("diagram:getER", connectionKey, schemas),

  // Autocomplete
  getAutocompleteData: (connectionKey) => ipcRenderer.invoke("autocomplete:getData", connectionKey),

  // Export/Import
  exportData: (params) => ipcRenderer.invoke("export:data", params),
  importData: (params) => ipcRenderer.invoke("import:data", params),

  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke("clipboard:write", text),
  readFromClipboard: () => ipcRenderer.invoke("clipboard:read"),

  // File dialogs
  showSaveDialog: (options) => ipcRenderer.invoke("dialog:showSave", options),
  showOpenDialog: (options) => ipcRenderer.invoke("dialog:showOpen", options),

  // Query history
  getQueryHistory: (connectionKey) => ipcRenderer.invoke("queryHistory:get", connectionKey),
  addQueryHistoryEntry: (connectionKey, entry) => ipcRenderer.invoke("queryHistory:add", connectionKey, entry),
  clearQueryHistory: (connectionKey) => ipcRenderer.invoke("queryHistory:clear", connectionKey),
  deleteQueryHistoryEntry: (connectionKey, entryId) => ipcRenderer.invoke("queryHistory:delete", connectionKey, entryId),
  toggleQueryHistoryStar: (connectionKey, entryId, starred) => ipcRenderer.invoke("queryHistory:toggleStar", connectionKey, entryId, starred),

  // Saved queries
  getSavedQueries: (connectionKey) => ipcRenderer.invoke("savedQueries:get", connectionKey),
  addSavedQuery: (connectionKey, query) => ipcRenderer.invoke("savedQueries:add", connectionKey, query),
  updateSavedQuery: (connectionKey, queryId, updates) => ipcRenderer.invoke("savedQueries:update", connectionKey, queryId, updates),
  deleteSavedQuery: (connectionKey, queryId) => ipcRenderer.invoke("savedQueries:delete", connectionKey, queryId),

  // Filter presets
  getFilterPresets: (schema, table) => ipcRenderer.invoke("filterPresets:getAll", { schema, table }),
  saveFilterPreset: (schema, table, preset) => ipcRenderer.invoke("filterPresets:save", { schema, table, preset }),
  deleteFilterPreset: (schema, table, presetId) => ipcRenderer.invoke("filterPresets:delete", { schema, table, presetId }),

  // Tabs persistence
  loadTabs: () => ipcRenderer.invoke("tabs:load"),
  saveTabs: (state) => ipcRenderer.invoke("tabs:save", state),

  // Theme
  getTheme: () => ipcRenderer.invoke("theme:get"),

  // Event subscriptions - return cleanup functions
  onConnectionStatusChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("connection:statusChange", listener);
    return () => {
      ipcRenderer.removeListener("connection:statusChange", listener);
    };
  },

  onThemeChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: "light" | "dark") => callback(theme);
    ipcRenderer.on("theme:change", listener);
    return () => {
      ipcRenderer.removeListener("theme:change", listener);
    };
  },

  onMenuNewQuery: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:newQuery", listener);
    return () => {
      ipcRenderer.removeListener("menu:newQuery", listener);
    };
  },

  onMenuAddConnection: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:addConnection", listener);
    return () => {
      ipcRenderer.removeListener("menu:addConnection", listener);
    };
  },

  onMenuOpenSqlite: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on("menu:openSqlite", listener);
    return () => {
      ipcRenderer.removeListener("menu:openSqlite", listener);
    };
  },

  onMenuToggleSidebar: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:toggleSidebar", listener);
    return () => {
      ipcRenderer.removeListener("menu:toggleSidebar", listener);
    };
  },

  onMenuRunQuery: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:runQuery", listener);
    return () => {
      ipcRenderer.removeListener("menu:runQuery", listener);
    };
  },

  onMenuFormatSql: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:formatSql", listener);
    return () => {
      ipcRenderer.removeListener("menu:formatSql", listener);
    };
  },

  onMenuExplainQuery: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:explainQuery", listener);
    return () => {
      ipcRenderer.removeListener("menu:explainQuery", listener);
    };
  },

  onImportProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: { current: number; total: number; percentage: number }) =>
      callback(progress);
    ipcRenderer.on("import:progress", listener);
    return () => {
      ipcRenderer.removeListener("import:progress", listener);
    };
  },

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  getAppVersion: () => ipcRenderer.invoke("updater:getVersion"),

  onUpdateStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: any) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => {
      ipcRenderer.removeListener("updater:status", listener);
    };
  },
};

// Expose in the main world
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
