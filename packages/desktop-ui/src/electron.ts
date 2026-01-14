/**
 * Electron API wrapper for desktop-ui
 */

import type {
  DatabaseConnectionConfig,
  ColumnMetadata,
  SavedView,
  ERDiagramData,
  FilterCondition,
  TableInfo,
  TableStatistics,
  TableIndex,
  ExplainPlan,
  ObjectCounts,
  ColumnInfo,
} from "@dbview/types";

// Auto-updater types
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateStatus {
  status: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  info?: UpdateInfo;
  progress?: UpdateProgress;
  error?: string;
}

// Declare the Electron API interface
export interface ElectronAPI {
  // Connection management
  getConnections(): Promise<ConnectionInfo[]>;
  saveConnection(config: DatabaseConnectionConfig): Promise<void>;
  deleteConnection(name: string): Promise<void>;
  testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string }>;
  connectToDatabase(connectionKey: string): Promise<void>;
  disconnectFromDatabase(connectionKey: string): Promise<void>;

  // Schema operations
  listDatabases(connectionKey: string): Promise<string[]>;
  listSchemas(connectionKey: string): Promise<string[]>;
  listTables(connectionKey: string, schema: string): Promise<TableInfo[]>;
  getHierarchy(connectionKey: string): Promise<unknown>;
  getObjectCounts(connectionKey: string, schema: string): Promise<ObjectCounts>;
  listViews(connectionKey: string, schema: string): Promise<string[]>;
  listMaterializedViews(connectionKey: string, schema: string): Promise<string[]>;
  listFunctions(connectionKey: string, schema: string): Promise<string[]>;
  listProcedures(connectionKey: string, schema: string): Promise<string[]>;
  listTypes(connectionKey: string, schema: string): Promise<string[]>;
  listColumns(connectionKey: string, schema: string, table: string, database?: string): Promise<ColumnInfo[]>;

  // Table operations
  loadTableRows(params: LoadTableRowsParams): Promise<{ columns: string[]; rows: Record<string, unknown>[] }>;
  getRowCount(params: GetRowCountParams): Promise<number>;
  getTableMetadata(params: GetTableMetadataParams): Promise<ColumnMetadata[]>;
  getTableStatistics(params: GetTableMetadataParams): Promise<TableStatistics>;
  getTableIndexes(params: GetTableMetadataParams): Promise<TableIndex[]>;
  updateCell(params: UpdateCellParams): Promise<void>;
  insertRow(params: InsertRowParams): Promise<Record<string, unknown>>;
  deleteRows(params: DeleteRowsParams): Promise<number>;

  // Query operations
  runQuery(params: RunQueryParams): Promise<QueryResult>;
  formatSql(sql: string): Promise<string>;
  explainQuery(params: ExplainQueryParams): Promise<ExplainPlan>;
  cancelQuery(connectionKey: string): Promise<void>;

  // Saved views
  getViews(params: GetViewsParams): Promise<SavedView[]>;
  saveView(params: SaveViewParams): Promise<void>;
  deleteView(params: DeleteViewParams): Promise<void>;

  // ER Diagram
  getERDiagram(connectionKey: string, schemas: string[]): Promise<ERDiagramData>;

  // Autocomplete
  getAutocompleteData(connectionKey: string): Promise<AutocompleteData>;

  // Export/Import
  exportData(params: ExportDataParams): Promise<string | null>;
  importData(params: ImportDataParams): Promise<ImportResult>;

  // MongoDB-specific operations
  createIndex?(params: CreateIndexParams): Promise<string>;
  dropIndex?(params: DropIndexParams): Promise<void>;
  runAggregation?(params: RunAggregationParams): Promise<QueryResult>;

  // Clipboard
  copyToClipboard(text: string): Promise<void>;
  readFromClipboard(): Promise<string>;

  // File dialogs
  showSaveDialog(options: SaveDialogOptions): Promise<DialogResult>;
  showOpenDialog(options: OpenDialogOptions): Promise<DialogResult>;

  // Query history
  getQueryHistory(connectionKey: string): Promise<QueryHistoryEntry[]>;
  addQueryHistoryEntry(connectionKey: string, entry: QueryHistoryEntry): Promise<void>;
  clearQueryHistory(connectionKey: string): Promise<void>;
  deleteQueryHistoryEntry(connectionKey: string, entryId: string): Promise<void>;
  toggleQueryHistoryStar(connectionKey: string, entryId: string, starred: boolean): Promise<void>;

  // Saved queries
  getSavedQueries(connectionKey: string): Promise<SavedQuery[]>;
  addSavedQuery(connectionKey: string, query: SavedQuery): Promise<void>;
  updateSavedQuery(connectionKey: string, queryId: string, updates: Partial<SavedQuery>): Promise<void>;
  deleteSavedQuery(connectionKey: string, queryId: string): Promise<void>;

  // Filter presets
  getFilterPresets(schema: string, table: string, database?: string): Promise<FilterPreset[]>;
  saveFilterPreset(schema: string, table: string, preset: FilterPreset, database?: string): Promise<void>;
  deleteFilterPreset(schema: string, table: string, presetId: string, database?: string): Promise<void>;

  // Tabs persistence
  loadTabs(): Promise<TabsState | null>;
  saveTabs(state: TabsState): Promise<void>;

  // Theme
  getTheme(): Promise<"light" | "dark">;

  // Event subscriptions
  onConnectionStatusChange(callback: (data: { connectionKey: string; status: string }) => void): () => void;
  onThemeChange(callback: (theme: "light" | "dark") => void): () => void;
  onMenuNewQuery(callback: () => void): () => void;
  onMenuAddConnection(callback: () => void): () => void;
  onMenuOpenSqlite(callback: (filePath: string) => void): () => void;
  onMenuToggleSidebar(callback: () => void): () => void;
  onMenuRunQuery(callback: () => void): () => void;
  onMenuFormatSql(callback: () => void): () => void;
  onMenuExplainQuery(callback: () => void): () => void;

  // Auto-updater
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<boolean>;
  installUpdate(): Promise<boolean>;
  getAppVersion(): Promise<string>;
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;
}

// Parameter types
export interface ConnectionInfo {
  config: Omit<DatabaseConnectionConfig, "password">;
  status: "connected" | "disconnected" | "connecting" | "error";
  error?: string;
}

export interface LoadTableRowsParams {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
  limit: number;
  offset: number;
  filters?: FilterCondition[];
  filterLogic?: "AND" | "OR";
  orderBy?: string[];
  sortColumn?: string;
  sortDirection?: "ASC" | "DESC";
}

export interface GetRowCountParams {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
  filters?: FilterCondition[];
  filterLogic?: "AND" | "OR";
}

export interface GetTableMetadataParams {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
}

export interface UpdateCellParams {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
  primaryKey: Record<string, unknown>;
  column: string;
  value: unknown;
}

export interface InsertRowParams {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
  values: Record<string, unknown>;
}

export interface DeleteRowsParams {
  connectionKey: string;
  schema: string;
  table: string;
  database?: string;
  primaryKeys: Record<string, unknown>[];
}

export interface RunQueryParams {
  connectionKey: string;
  sql: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  limitApplied?: boolean;
  limit?: number;
  hasMore?: boolean;
}

export interface ExplainQueryParams {
  connectionKey: string;
  sql: string;
}

export interface GetViewsParams {
  schema: string;
  table: string;
}

export interface SaveViewParams {
  schema: string;
  table: string;
  view: SavedView;
}

export interface DeleteViewParams {
  schema: string;
  table: string;
  viewId: string;
}

export interface ExportDataParams {
  connectionKey: string;
  schema: string;
  table: string;
  content: string;
  extension: string;
}

export interface ImportDataParams {
  connectionKey: string;
  schema: string;
  table: string;
  rows: Record<string, unknown>[];
}

export interface AutocompleteData {
  schemas: string[];
  tables: TableInfo[];
  columns: Record<string, ColumnMetadata[]>;
}

export interface ImportResult {
  insertedCount: number;
  errors?: string[];
}

// MongoDB-specific operation params
export interface CreateIndexParams {
  connectionKey: string;
  schema: string;
  table: string;
  keys: Record<string, 1 | -1>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    name?: string;
  };
}

export interface DropIndexParams {
  connectionKey: string;
  schema: string;
  table: string;
  indexName: string;
}

export interface RunAggregationParams {
  connectionKey: string;
  schema: string;
  table: string;
  pipeline: Record<string, unknown>[];
  options?: {
    maxTimeMS?: number;
    allowDiskUse?: boolean;
  };
}

export interface SaveDialogOptions {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface OpenDialogOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<"openFile" | "openDirectory" | "multiSelections">;
}

export interface DialogResult {
  canceled: boolean;
  filePaths: string[];
}

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

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
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
  sql?: string;
}

export interface TabsState {
  tabs: PersistedTab[];
  activeTabId: string | null;
}

// Declare the global window interface extension
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window && window.electronAPI !== undefined;
}

/**
 * Get the Electron API if available
 */
export function getElectronAPI(): ElectronAPI | undefined {
  if (isElectron()) {
    return window.electronAPI;
  }
  return undefined;
}
