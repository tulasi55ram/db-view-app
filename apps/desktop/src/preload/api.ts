// Local type definitions for the preload script
// These mirror the types from @dbview/core but are defined locally to avoid import issues

export interface DatabaseConnectionConfig {
  dbType: "postgres" | "mysql" | "sqlserver" | "sqlite" | "mongodb" | "redis";
  name?: string;
  host?: string;
  port?: number;
  database?: string | number;
  user?: string;
  password?: string;
  filePath?: string;
  connectionString?: string;
  readOnly?: boolean;
  [key: string]: any;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
  isAutoIncrement: boolean;
  isGenerated: boolean;
  maxLength?: number;
  numericPrecision?: number;
  numericScale?: number;
  enumValues?: string[];
  editable: boolean;
}

// Filter operator type matching @dbview/core
export type FilterOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "starts_with" | "ends_with"
  | "greater_than" | "less_than"
  | "greater_or_equal" | "less_or_equal"
  | "is_null" | "is_not_null"
  | "in" | "between";

export interface FilterCondition {
  id: string;
  columnName: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown;
}

// View state for SavedView
export interface ViewState {
  filters: FilterCondition[];
  filterLogic: "AND" | "OR";
  sorting: Array<{ columnName: string; direction: "asc" | "desc" }>;
  visibleColumns: string[];
  pageSize?: number;
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  schema: string;
  table: string;
  state: ViewState;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

export interface ERDiagramData {
  tables: any[];
  relationships: any[];
}

export interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  sizeBytes?: number;
}

export interface TableStatistics {
  rowCount: number;
  totalSize: string;
  tableSize: string;
  indexesSize: string;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
}

export interface TableIndex {
  name: string;
  type: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface ExplainPlan {
  Plan: any;
  "Planning Time": number;
  "Execution Time": number;
  Triggers?: any[];
}

// Connection test result
export interface TestConnectionResult {
  success: boolean;
  message: string;
}

// Connection with status info
export interface ConnectionInfo {
  config: Omit<DatabaseConnectionConfig, "password">;
  status: "connected" | "disconnected" | "connecting" | "error";
  error?: string;
}

// Table data result
export interface TableDataResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

// Query result
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

// Import result
export interface ImportResult {
  insertedCount: number;
  errors?: string[];
}

// Autocomplete data
export interface AutocompleteData {
  schemas: string[];
  tables: TableInfo[];
  columns: Record<string, ColumnMetadata[]>;
}

// Load table rows params
export interface LoadTableRowsParams {
  connectionKey: string;
  schema: string;
  table: string;
  limit: number;
  offset: number;
  filters?: FilterCondition[];
  filterLogic?: "AND" | "OR";
}

// Row count params
export interface GetRowCountParams {
  connectionKey: string;
  schema: string;
  table: string;
  filters?: FilterCondition[];
  filterLogic?: "AND" | "OR";
}

// Table metadata params
export interface GetTableMetadataParams {
  connectionKey: string;
  schema: string;
  table: string;
}

// Update cell params
export interface UpdateCellParams {
  connectionKey: string;
  schema: string;
  table: string;
  primaryKey: Record<string, unknown>;
  column: string;
  value: unknown;
}

// Insert row params
export interface InsertRowParams {
  connectionKey: string;
  schema: string;
  table: string;
  values: Record<string, unknown>;
}

// Delete rows params
export interface DeleteRowsParams {
  connectionKey: string;
  schema: string;
  table: string;
  primaryKeys: Record<string, unknown>[];
}

// Run query params
export interface RunQueryParams {
  connectionKey: string;
  sql: string;
}

// Explain query params
export interface ExplainQueryParams {
  connectionKey: string;
  sql: string;
}

// Get views params
export interface GetViewsParams {
  schema: string;
  table: string;
}

// Save view params
export interface SaveViewParams {
  schema: string;
  table: string;
  view: SavedView;
}

// Delete view params
export interface DeleteViewParams {
  schema: string;
  table: string;
  viewId: string;
}

// Export data params
export interface ExportDataParams {
  connectionKey: string;
  schema: string;
  table: string;
  content: string;
  extension: string;
}

// Import data params
export interface ImportDataParams {
  connectionKey: string;
  schema: string;
  table: string;
  rows: Record<string, unknown>[];
}

// Dialog options
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

// The complete Electron API exposed to the renderer
export interface ElectronAPI {
  // Connection management
  getConnections(): Promise<ConnectionInfo[]>;
  saveConnection(config: DatabaseConnectionConfig): Promise<void>;
  deleteConnection(name: string): Promise<void>;
  testConnection(config: DatabaseConnectionConfig): Promise<TestConnectionResult>;
  connectToDatabase(connectionKey: string): Promise<void>;
  disconnectFromDatabase(connectionKey: string): Promise<void>;

  // Schema operations
  listSchemas(connectionKey: string): Promise<string[]>;
  listTables(connectionKey: string, schema: string): Promise<TableInfo[]>;
  getHierarchy(connectionKey: string): Promise<any>;

  // Table operations
  loadTableRows(params: LoadTableRowsParams): Promise<TableDataResult>;
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

  // Clipboard
  copyToClipboard(text: string): Promise<void>;

  // File dialogs
  showSaveDialog(options: SaveDialogOptions): Promise<DialogResult>;
  showOpenDialog(options: OpenDialogOptions): Promise<DialogResult>;

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
}

// Declare the global window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
