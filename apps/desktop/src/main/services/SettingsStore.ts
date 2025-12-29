import Store from "electron-store";
import type { DatabaseConnectionConfig } from "@dbview/types";

// Connection config without password (passwords stored in keytar)
export type StoredConnectionConfig = Omit<DatabaseConnectionConfig, "password">;

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: number;
  duration?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
  starred?: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: Array<{
    id: string;
    columnName: string;
    operator: string;
    value: unknown;
  }>;
  logic: "AND" | "OR";
  createdAt: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// Persisted tab state
export interface PersistedTab {
  id: string;
  type: "table" | "query" | "er-diagram";
  title: string;
  schema?: string;
  table?: string;
  connectionKey?: string;
  connectionName?: string;
  connectionColor?: string;
  // Query-specific
  sql?: string;
}

export interface TabsState {
  tabs: PersistedTab[];
  activeTabId: string | null;
}

// Saved view state (filters, sorting, visible columns)
export interface SavedViewState {
  filters: Array<{
    id: string;
    columnName: string;
    operator: string;
    value: unknown;
  }>;
  filterLogic: "AND" | "OR";
  sorting: Array<{
    columnName: string;
    direction: "asc" | "desc";
  }>;
  visibleColumns: string[];
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  schema: string;
  table: string;
  state: SavedViewState;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

interface StoreSchema {
  connections: StoredConnectionConfig[];
  activeConnectionName: string | null;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  recentSqliteFiles: string[];
  sidebarWidth: number;
  sidebarVisible: boolean;
  // Query history per connection (last 10 queries per connection)
  queryHistory: Record<string, QueryHistoryEntry[]>;
  // Filter presets per table (key: "schema.table")
  filterPresets: Record<string, FilterPreset[]>;
  // Saved views per table (key: "schema.table")
  savedViews: Record<string, SavedView[]>;
  // Saved queries per connection
  savedQueries: Record<string, SavedQuery[]>;
  // Persisted tabs state
  tabsState: TabsState | null;
  // Connection order in sidebar (array of connection keys)
  connectionOrder: string[];
}

// Lazy-initialized store (electron-store requires app.getPath which isn't available at module load)
let _store: Store<StoreSchema> | null = null;

function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({
      name: "dbview-settings",
      defaults: {
        connections: [],
        activeConnectionName: null,
        windowBounds: {
          width: 1400,
          height: 900,
        },
        recentSqliteFiles: [],
        sidebarWidth: 260,
        sidebarVisible: true,
        queryHistory: {},
        filterPresets: {},
        savedViews: {},
        savedQueries: {},
        tabsState: null,
        connectionOrder: [],
      },
    });
  }
  return _store;
}

// Connection management helpers
export function getAllConnections(): StoredConnectionConfig[] {
  return getStore().get("connections", []);
}

export function getConnection(name: string): StoredConnectionConfig | undefined {
  const connections = getAllConnections();
  return connections.find((c) => c.name === name);
}

export function saveConnection(config: StoredConnectionConfig): void {
  const connections = getAllConnections();
  const existingIndex = connections.findIndex((c) => c.name === config.name);

  if (existingIndex >= 0) {
    connections[existingIndex] = config;
  } else {
    connections.push(config);
  }

  getStore().set("connections", connections);
}

export function deleteConnectionConfig(name: string): void {
  const connections = getAllConnections().filter((c) => c.name !== name);
  getStore().set("connections", connections);

  // Clear active connection if it was deleted
  if (getStore().get("activeConnectionName") === name) {
    getStore().set("activeConnectionName", null);
  }
}

export function getActiveConnectionName(): string | null {
  return getStore().get("activeConnectionName", null);
}

export function setActiveConnectionName(name: string | null): void {
  getStore().set("activeConnectionName", name);
}

// Window bounds
export function getWindowBounds(): StoreSchema["windowBounds"] {
  return getStore().get("windowBounds");
}

export function saveWindowBounds(bounds: StoreSchema["windowBounds"]): void {
  getStore().set("windowBounds", bounds);
}

// Recent SQLite files
export function getRecentSqliteFiles(): string[] {
  return getStore().get("recentSqliteFiles", []);
}

export function addRecentSqliteFile(filePath: string): void {
  const recent = getRecentSqliteFiles().filter((f) => f !== filePath);
  recent.unshift(filePath);
  getStore().set("recentSqliteFiles", recent.slice(0, 10)); // Keep last 10
}

// Sidebar settings
export function getSidebarWidth(): number {
  return getStore().get("sidebarWidth", 260);
}

export function setSidebarWidth(width: number): void {
  getStore().set("sidebarWidth", width);
}

export function getSidebarVisible(): boolean {
  return getStore().get("sidebarVisible", true);
}

export function setSidebarVisible(visible: boolean): void {
  getStore().set("sidebarVisible", visible);
}

// Query History management
export function getQueryHistory(connectionKey: string): QueryHistoryEntry[] {
  const allHistory = getStore().get("queryHistory", {});
  return allHistory[connectionKey] || [];
}

export function addQueryHistoryEntry(connectionKey: string, entry: QueryHistoryEntry): void {
  const allHistory = getStore().get("queryHistory", {});
  const connectionHistory = allHistory[connectionKey] || [];

  // Add new entry at the end
  connectionHistory.push(entry);

  // Keep only last 10 queries
  const updatedHistory = connectionHistory.slice(-10);

  allHistory[connectionKey] = updatedHistory;
  getStore().set("queryHistory", allHistory);
}

export function clearQueryHistory(connectionKey: string): void {
  const allHistory = getStore().get("queryHistory", {});
  delete allHistory[connectionKey];
  getStore().set("queryHistory", allHistory);
}

export function deleteQueryHistoryEntry(connectionKey: string, entryId: string): void {
  const allHistory = getStore().get("queryHistory", {});
  const connectionHistory = allHistory[connectionKey] || [];

  allHistory[connectionKey] = connectionHistory.filter(entry => entry.id !== entryId);
  getStore().set("queryHistory", allHistory);
}

export function toggleQueryHistoryStar(connectionKey: string, entryId: string, starred: boolean): void {
  const allHistory = getStore().get("queryHistory", {});
  const connectionHistory = allHistory[connectionKey] || [];

  const updatedHistory = connectionHistory.map(entry =>
    entry.id === entryId ? { ...entry, starred } : entry
  );

  allHistory[connectionKey] = updatedHistory;
  getStore().set("queryHistory", allHistory);
}

// Saved Queries management
export function getSavedQueries(connectionKey: string): SavedQuery[] {
  const allQueries = getStore().get("savedQueries", {});
  return allQueries[connectionKey] || [];
}

export function addSavedQuery(connectionKey: string, query: SavedQuery): void {
  const allQueries = getStore().get("savedQueries", {});
  const connectionQueries = allQueries[connectionKey] || [];

  // Check if query with same id exists (update)
  const existingIndex = connectionQueries.findIndex(q => q.id === query.id);
  if (existingIndex >= 0) {
    connectionQueries[existingIndex] = query;
  } else {
    connectionQueries.push(query);
  }

  allQueries[connectionKey] = connectionQueries;
  getStore().set("savedQueries", allQueries);
}

export function updateSavedQuery(connectionKey: string, queryId: string, updates: Partial<SavedQuery>): void {
  const allQueries = getStore().get("savedQueries", {});
  const connectionQueries = allQueries[connectionKey] || [];

  const updatedQueries = connectionQueries.map(query =>
    query.id === queryId ? { ...query, ...updates, updatedAt: Date.now() } : query
  );

  allQueries[connectionKey] = updatedQueries;
  getStore().set("savedQueries", allQueries);
}

export function deleteSavedQuery(connectionKey: string, queryId: string): void {
  const allQueries = getStore().get("savedQueries", {});
  const connectionQueries = allQueries[connectionKey] || [];

  allQueries[connectionKey] = connectionQueries.filter(query => query.id !== queryId);
  getStore().set("savedQueries", allQueries);
}

// Filter Presets management
function getPresetKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function getFilterPresets(schema: string, table: string): FilterPreset[] {
  const allPresets = getStore().get("filterPresets", {});
  const key = getPresetKey(schema, table);
  return allPresets[key] || [];
}

export function saveFilterPreset(schema: string, table: string, preset: FilterPreset): void {
  const allPresets = getStore().get("filterPresets", {});
  const key = getPresetKey(schema, table);
  const tablePresets = allPresets[key] || [];

  // Check if preset with same name exists
  const existingIndex = tablePresets.findIndex(p => p.name === preset.name);
  if (existingIndex >= 0) {
    tablePresets[existingIndex] = preset;
  } else {
    tablePresets.push(preset);
  }

  allPresets[key] = tablePresets;
  getStore().set("filterPresets", allPresets);
}

export function deleteFilterPreset(schema: string, table: string, presetId: string): void {
  const allPresets = getStore().get("filterPresets", {});
  const key = getPresetKey(schema, table);
  const tablePresets = allPresets[key] || [];

  allPresets[key] = tablePresets.filter(p => p.id !== presetId);
  getStore().set("filterPresets", allPresets);
}

// Tabs persistence
export function getTabsState(): TabsState | null {
  return getStore().get("tabsState", null);
}

export function saveTabsState(state: TabsState): void {
  getStore().set("tabsState", state);
}

// Saved Views management
function getViewKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function getSavedViews(schema: string, table: string): SavedView[] {
  const allViews = getStore().get("savedViews", {});
  const key = getViewKey(schema, table);
  return allViews[key] || [];
}

export function saveSavedView(schema: string, table: string, view: SavedView): void {
  const allViews = getStore().get("savedViews", {});
  const key = getViewKey(schema, table);
  const tableViews = allViews[key] || [];

  // If setting as default, unset other defaults
  if (view.isDefault) {
    tableViews.forEach((v) => {
      if (v.id !== view.id) {
        v.isDefault = false;
      }
    });
  }

  // Check if view with same id exists
  const existingIndex = tableViews.findIndex((v) => v.id === view.id);
  if (existingIndex >= 0) {
    tableViews[existingIndex] = view;
  } else {
    tableViews.push(view);
  }

  allViews[key] = tableViews;
  getStore().set("savedViews", allViews);
}

export function deleteSavedView(schema: string, table: string, viewId: string): void {
  const allViews = getStore().get("savedViews", {});
  const key = getViewKey(schema, table);
  const tableViews = allViews[key] || [];

  allViews[key] = tableViews.filter((v) => v.id !== viewId);
  getStore().set("savedViews", allViews);
}

// Connection order management
export function getConnectionOrder(): string[] {
  return getStore().get("connectionOrder", []);
}

export function saveConnectionOrder(order: string[]): void {
  getStore().set("connectionOrder", order);
}
