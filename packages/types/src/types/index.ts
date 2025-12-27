export interface SSLConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean; // Verify server certificate
  ca?: string; // CA certificate
  key?: string; // Client private key
  cert?: string; // Client certificate
}

// ============================================
// Phase 7: Multi-Database Support
// ============================================

/**
 * Database types supported by dbview
 */
export type DatabaseType = 'postgres' | 'mysql' | 'sqlserver' | 'sqlite' | 'mongodb' | 'redis';

/**
 * PostgreSQL SSL mode options
 */
export type PostgresSslMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';

/**
 * PostgreSQL connection configuration
 */
export interface PostgresConnectionConfig {
  dbType: 'postgres';
  name?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean | SSLConfig;
  sslMode?: PostgresSslMode; // SSL verification mode
  savePassword?: boolean;
  readOnly?: boolean;
  color?: string;
}

/**
 * MySQL SSL mode options
 */
export type MySqlSslMode = 'disabled' | 'preferred' | 'required' | 'verify_ca' | 'verify_identity';

/**
 * MySQL connection configuration
 */
export interface MySQLConnectionConfig {
  dbType: 'mysql';
  name?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean | SSLConfig;
  sslMode?: MySqlSslMode; // SSL verification mode
  charset?: string; // Default: 'utf8mb4'
  savePassword?: boolean;
  readOnly?: boolean;
  color?: string;
}

/**
 * SQL Server connection configuration
 */
export interface SQLServerConnectionConfig {
  dbType: 'sqlserver';
  name?: string;
  host: string;
  port?: number; // Optional, defaults to 1433
  user?: string;
  password?: string;
  database: string;
  instanceName?: string; // e.g., 'SQLEXPRESS'
  authenticationType: 'sql' | 'windows';
  domain?: string; // For Windows Authentication
  trustServerCertificate?: boolean;
  encrypt?: boolean; // Default: true
  savePassword?: boolean;
  readOnly?: boolean;
  color?: string;
}

/**
 * SQLite connection configuration
 */
export interface SQLiteConnectionConfig {
  dbType: 'sqlite';
  name?: string;
  filePath: string; // Path to .db/.sqlite/.sqlite3 file
  mode?: 'readonly' | 'readwrite' | 'create';
  readOnly?: boolean;
  color?: string;
}

/**
 * MongoDB connection configuration
 */
export interface MongoDBConnectionConfig {
  dbType: 'mongodb';
  name?: string;
  connectionString?: string; // Full MongoDB URI
  // OR individual fields:
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  authDatabase?: string; // Default: 'admin'
  replicaSet?: string;
  ssl?: boolean;
  savePassword?: boolean;
  readOnly?: boolean;
  color?: string;
}

/**
 * Redis connection configuration
 */
export interface RedisConnectionConfig {
  dbType: 'redis';
  name?: string;
  host: string;
  port: number;
  database?: number; // Redis database index (0-15)
  username?: string; // Redis 6+ ACL username (default: 'default')
  password?: string;
  ssl?: boolean; // Enable TLS/SSL
  savePassword?: boolean;
  readOnly?: boolean;
  color?: string;
}

/**
 * Discriminated union of all database connection configurations
 */
export type DatabaseConnectionConfig =
  | PostgresConnectionConfig
  | MySQLConnectionConfig
  | SQLServerConnectionConfig
  | SQLiteConnectionConfig
  | MongoDBConnectionConfig
  | RedisConnectionConfig;

/**
 * Legacy ConnectionConfig for backward compatibility
 * @deprecated Use DatabaseConnectionConfig instead
 */
export type ConnectionConfig = PostgresConnectionConfig | (Omit<PostgresConnectionConfig, 'dbType'> & { dbType?: 'postgres' });

// Type guards
export function isPostgresConfig(config: DatabaseConnectionConfig): config is PostgresConnectionConfig {
  return config.dbType === 'postgres';
}

export function isMySQLConfig(config: DatabaseConnectionConfig): config is MySQLConnectionConfig {
  return config.dbType === 'mysql';
}

export function isSQLServerConfig(config: DatabaseConnectionConfig): config is SQLServerConnectionConfig {
  return config.dbType === 'sqlserver';
}

export function isSQLiteConfig(config: DatabaseConnectionConfig): config is SQLiteConnectionConfig {
  return config.dbType === 'sqlite';
}

export function isMongoDBConfig(config: DatabaseConnectionConfig): config is MongoDBConnectionConfig {
  return config.dbType === 'mongodb';
}

export function isRedisConfig(config: DatabaseConnectionConfig): config is RedisConnectionConfig {
  return config.dbType === 'redis';
}

export interface Column {
  name: string;
  dataType: string;
  nullable: boolean;
}

export interface Table {
  schema: string;
  name: string;
  columns: Column[];
}

export type Row = Record<string, unknown>;

// ============================================
// Phase 2: Data Editing Types
// ============================================

// PostgreSQL type mapping
export type PostgreSQLType =
  | 'boolean'
  | 'integer' | 'bigint' | 'smallint'
  | 'numeric' | 'decimal' | 'real' | 'double precision'
  | 'varchar' | 'text' | 'char' | 'character varying'
  | 'date' | 'timestamp' | 'timestamp without time zone' | 'timestamp with time zone'
  | 'timestamptz' | 'time' | 'timetz'
  | 'json' | 'jsonb'
  | 'uuid'
  | 'bytea'
  | 'array'
  | 'enum'
  | 'USER-DEFINED'
  | string; // fallback for custom types

// Enhanced column metadata for editing
export interface ColumnMetadata {
  name: string;
  type: PostgreSQLType;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
  isAutoIncrement: boolean;
  isGenerated: boolean; // GENERATED ALWAYS AS columns
  maxLength?: number;
  numericPrecision?: number;
  numericScale?: number;
  enumValues?: string[];
  editable: boolean; // computed: not PK and not auto-increment and not generated
}

// Cell edit tracking
export interface CellEdit {
  rowIndex: number;
  columnKey: string;
  originalValue: unknown;
  newValue: unknown;
  timestamp: number;
}

// Table edit state
export interface TableEditState {
  pendingEdits: Map<string, CellEdit>;
  selectedRows: Set<number>;
  editingCell: { rowIndex: number; columnKey: string } | null;
  errors: Map<string, string>;
}

// Message types for CRUD operations (UI → Extension)
export type CRUDMessage =
  | { type: 'GET_TABLE_METADATA'; schema: string; table: string }
  | { type: 'UPDATE_CELL'; schema: string; table: string; primaryKey: Record<string, unknown>; column: string; value: unknown; rowIndex?: number }
  | { type: 'INSERT_ROW'; schema: string; table: string; values: Record<string, unknown> }
  | { type: 'DELETE_ROWS'; schema: string; table: string; primaryKeys: Record<string, unknown>[] }
  | { type: 'COMMIT_CHANGES'; schema: string; table: string; edits: Array<{ primaryKey: Record<string, unknown>; columnKey: string; newValue: unknown }> };

// Response types for CRUD operations (Extension → UI)
export type CRUDResponse =
  | { type: 'TABLE_METADATA'; columns: ColumnMetadata[] }
  | { type: 'UPDATE_SUCCESS'; rowIndex?: number }
  | { type: 'UPDATE_ERROR'; error: string; rowIndex?: number; column?: string }
  | { type: 'INSERT_SUCCESS'; newRow: Record<string, unknown> }
  | { type: 'INSERT_ERROR'; error: string }
  | { type: 'DELETE_SUCCESS'; deletedCount: number }
  | { type: 'DELETE_ERROR'; error: string }
  | { type: 'COMMIT_SUCCESS'; successCount: number }
  | { type: 'COMMIT_ERROR'; error: string; failedEdits?: CellEdit[] };

// ============================================
// Phase 3.2: Advanced Filtering Types
// ============================================

export type FilterOperator =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than'
  | 'greater_or_equal' | 'less_or_equal'
  | 'is_null' | 'is_not_null'
  | 'in' | 'between';

export interface FilterCondition {
  id: string;
  columnName: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown; // For BETWEEN operator
}

export interface FilterPreset {
  name: string;
  conditions: FilterCondition[];
  logicOperator: 'AND' | 'OR';
}

// ============================================
// Phase 3.3: Saved Views Types
// ============================================

export interface ViewState {
  filters: FilterCondition[];
  filterLogic: 'AND' | 'OR';
  sorting: Array<{ columnName: string; direction: 'asc' | 'desc' }>;
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

// ============================================
// Phase 3.4: Multi-Tab Support Types
// ============================================

export type TabType = 'table' | 'query' | 'er-diagram';

export interface BaseTab {
  id: string;
  type: TabType;
  title: string;
  createdAt: number;
  connectionName?: string; // Which connection this tab belongs to
}

export interface TableTab extends BaseTab {
  type: 'table';
  schema: string;
  table: string;
  limit: number;
  offset: number;
  totalRows: number | null;
  columns: string[];
  rows: Record<string, unknown>[];
  loading: boolean;
  metadata?: ColumnMetadata[];
}

export interface QueryTab extends BaseTab {
  type: 'query';
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  loading: boolean;
  error?: string;
  explainPlan?: ExplainPlan | null;
  explainLoading?: boolean;
  explainError?: string;
  showExplainPanel?: boolean;
}

export interface ERDiagramTab extends BaseTab {
  type: 'er-diagram';
  availableSchemas: string[];
  selectedSchemas: string[];
  diagramData: ERDiagramData | null;
  loading: boolean;
  error?: string;
}

export type Tab = TableTab | QueryTab | ERDiagramTab;

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

// ============================================
// Phase 4.1: Table Metadata Panel Types
// ============================================

export interface TableIndex {
  name: string;
  type: 'btree' | 'hash' | 'gist' | 'gin' | 'spgist' | 'brin' | string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface TableStatistics {
  rowCount: number;
  totalSize: string; // e.g., "2.4 MB"
  tableSize: string;
  indexesSize: string;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
  lastAutoVacuum?: string | null;
  lastAutoAnalyze?: string | null;
}

// ============================================
// Phase 4.2: ER Diagram Types
// ============================================

export interface ERDiagramColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
}

export interface ERDiagramTable {
  schema: string;
  name: string;
  columns: ERDiagramColumn[];
  position?: { x: number; y: number };
}

export interface ERDiagramRelationship {
  id: string;
  sourceTable: string;
  sourceSchema: string;
  sourceColumn: string;
  targetTable: string;
  targetSchema: string;
  targetColumn: string;
  constraintName: string;
}

export interface ERDiagramData {
  tables: ERDiagramTable[];
  relationships: ERDiagramRelationship[];
}

// ============================================
// Phase 4.3: Query History Types
// ============================================

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: number;
  duration?: number; // Execution time in milliseconds
  rowCount?: number; // Number of rows returned
  success: boolean;
  error?: string;
  isFavorite?: boolean;
}

export interface QueryHistoryState {
  entries: QueryHistoryEntry[];
  maxEntries: number; // Limit stored history (e.g., 100)
}

// ============================================
// Phase 5.1: SQL Editor Enhancement Types
// ============================================

export interface AutocompleteRequest {
  type: 'GET_AUTOCOMPLETE_DATA';
  tabId: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  rowCount?: number;
  sizeBytes?: number;
}

// Column info for schema explorer tree
export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
}

// Object counts per schema
export interface ObjectCounts {
  tables: number;
  views: number;
  materializedViews: number;
  functions: number;
  procedures: number;
  types: number;
}

export interface AutocompleteData {
  schemas: string[];
  tables: TableInfo[];
  columns: Record<string, ColumnMetadata[]>; // Key: schema.table
  functions?: Array<{ name: string; returnType: string }>;
}

export interface FormatSqlRequest {
  type: 'FORMAT_SQL';
  tabId: string;
  sql: string;
}

export interface FormatSqlResponse {
  type: 'SQL_FORMATTED';
  tabId: string;
  formattedSql: string;
  error?: string;
}

export interface ExplainQueryRequest {
  type: 'EXPLAIN_QUERY';
  tabId: string;
  sql: string;
}

export interface ExplainNode {
  'Node Type': string;
  'Startup Cost': number;
  'Total Cost': number;
  'Plan Rows': number;
  'Plan Width': number;
  'Actual Startup Time'?: number;
  'Actual Total Time'?: number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Filter'?: string;
  'Rows Removed by Filter'?: number;
  'Plans'?: ExplainNode[];
  [key: string]: any; // PostgreSQL EXPLAIN can have many fields
}

export interface ExplainPlan {
  Plan: ExplainNode;
  'Planning Time': number;
  'Execution Time': number;
  Triggers?: any[];
}

export interface ExplainQueryResponse {
  type: 'EXPLAIN_RESULT';
  tabId: string;
  plan: ExplainPlan | null;
  error?: string;
}

// ============================================
// Phase 5.3: Data Export/Import Types
// ============================================

export type ExportFormat = 'csv' | 'json' | 'sql';

export interface ExportOptions {
  format: ExportFormat;
  includeHeaders?: boolean; // CSV only
  selectedRowsOnly?: boolean;
  applyCurrentFilters?: boolean;
  encoding?: string; // Default: UTF-8
}

export interface ExportDataRequest {
  type: 'EXPORT_DATA';
  schema: string;
  table: string;
  options: ExportOptions;
  rows: Record<string, unknown>[]; // Data from current view
  columns: string[]; // Column names
  selectedRowIndices?: number[]; // If selectedRowsOnly = true
  filters?: FilterCondition[]; // If applyCurrentFilters = true
  filterLogic?: 'AND' | 'OR';
}

export interface ExportDataResponse {
  type: 'EXPORT_DATA_SUCCESS' | 'EXPORT_DATA_ERROR';
  error?: string;
}

export interface ImportDataRequest {
  type: 'IMPORT_DATA';
  schema: string;
  table: string;
  format: 'csv' | 'json';
  fileContent: string;
}

export interface ImportDataResponse {
  type: 'IMPORT_DATA_SUCCESS' | 'IMPORT_DATA_ERROR';
  insertedCount?: number;
  error?: string;
  errors?: string[]; // Per-row errors
}
