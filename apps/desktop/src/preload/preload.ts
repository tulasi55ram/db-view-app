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

  // Schema operations
  listSchemas: (connectionKey) => ipcRenderer.invoke("schema:list", connectionKey),
  listTables: (connectionKey, schema) => ipcRenderer.invoke("schema:getTables", connectionKey, schema),
  getHierarchy: (connectionKey) => ipcRenderer.invoke("schema:getHierarchy", connectionKey),

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

  // File dialogs
  showSaveDialog: (options) => ipcRenderer.invoke("dialog:showSave", options),
  showOpenDialog: (options) => ipcRenderer.invoke("dialog:showOpen", options),

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
};

// Expose in the main world
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
