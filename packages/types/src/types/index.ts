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
export type DatabaseType = 'postgres' | 'mysql' | 'mariadb' | 'sqlserver' | 'sqlite' | 'mongodb' | 'redis' | 'elasticsearch' | 'cassandra';

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
 * MariaDB SSL mode options (same as MySQL)
 */
export type MariaDBSslMode = 'disabled' | 'preferred' | 'required' | 'verify_ca' | 'verify_identity';

/**
 * MariaDB connection configuration
 * MariaDB is a MySQL-compatible fork with additional features
 */
export interface MariaDBConnectionConfig {
  dbType: 'mariadb';
  name?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean | SSLConfig;
  sslMode?: MariaDBSslMode; // SSL verification mode
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
 * Elasticsearch connection configuration
 */
export interface ElasticsearchConnectionConfig {
  dbType: 'elasticsearch';
  name?: string;
  // Single node or multiple nodes
  node?: string; // e.g., 'https://localhost:9200'
  nodes?: string[]; // Multiple nodes for cluster
  // Cloud connection (Elastic Cloud)
  cloudId?: string; // Elastic Cloud ID
  // Authentication
  username?: string;
  password?: string;
  apiKey?: string; // API key authentication (recommended for production)
  // SSL/TLS
  ssl?: boolean;
  caFingerprint?: string; // For self-signed certificates
  rejectUnauthorized?: boolean; // Default: true
  // Connection options
  requestTimeout?: number; // Default: 30000ms
  pingTimeout?: number; // Default: 3000ms
  maxRetries?: number; // Default: 3
  // Common fields
  savePassword?: boolean;
  readOnly?: boolean;
  color?: string;
}

/**
 * Cassandra consistency levels
 */
export type CassandraConsistency =
  | 'any'
  | 'one'
  | 'two'
  | 'three'
  | 'quorum'
  | 'all'
  | 'localQuorum'
  | 'eachQuorum'
  | 'serial'
  | 'localSerial'
  | 'localOne';

/**
 * Cassandra connection configuration
 */
export interface CassandraConnectionConfig {
  dbType: 'cassandra';
  name?: string;
  // Contact points (multiple nodes for fault tolerance)
  contactPoints: string[]; // e.g., ['node1.example.com', 'node2.example.com']
  port: number; // Default: 9042
  // Keyspace (like a database in relational DBs)
  keyspace: string;
  // Datacenter (required for token-aware routing)
  localDatacenter: string;
  // Authentication (optional - depends on cluster config)
  username?: string;
  password?: string;
  // SSL/TLS
  ssl?: boolean;
  sslOptions?: {
    rejectUnauthorized?: boolean;
    ca?: string; // CA certificate
    cert?: string; // Client certificate
    key?: string; // Client key
  };
  // Consistency level (default: localQuorum)
  consistency?: CassandraConsistency;
  // Connection options
  connectTimeout?: number; // Default: 5000ms
  requestTimeout?: number; // Default: 12000ms
  // Connection pooling
  poolSize?: number; // Connections per host (default: 1)
  // Common fields
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
  | MariaDBConnectionConfig
  | SQLServerConnectionConfig
  | SQLiteConnectionConfig
  | MongoDBConnectionConfig
  | RedisConnectionConfig
  | ElasticsearchConnectionConfig
  | CassandraConnectionConfig;

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

export function isMariaDBConfig(config: DatabaseConnectionConfig): config is MariaDBConnectionConfig {
  return config.dbType === 'mariadb';
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

export function isElasticsearchConfig(config: DatabaseConnectionConfig): config is ElasticsearchConnectionConfig {
  return config.dbType === 'elasticsearch';
}

export function isCassandraConfig(config: DatabaseConnectionConfig): config is CassandraConnectionConfig {
  return config.dbType === 'cassandra';
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
  /** For Cassandra: 'partition' | 'clustering' | 'regular' */
  keyKind?: 'partition' | 'clustering' | 'regular';
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

export type TabType = 'table' | 'query' | 'er-diagram' | 'function';

export interface BaseTab {
  id: string;
  type: TabType;
  title: string;
  createdAt: number;
  connectionName?: string; // Display name for the connection
  connectionKey?: string; // Unique identifier for the connection
  connectionColor?: string; // Custom color for the connection (Desktop only)
  isDirty?: boolean; // Whether the tab has unsaved changes
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
  /** Database type for rendering appropriate view */
  dbType?: DatabaseType;
  /** Whether the connection is read-only */
  readOnly?: boolean;
  /** Sorting state for server-side sorting */
  sorting?: Array<{ columnName: string; direction: 'asc' | 'desc' }>;
  /** MongoDB-specific: view mode */
  mongoViewMode?: 'table' | 'json';
  /** MongoDB-specific: expanded document IDs */
  expandedDocuments?: string[];
  /** Redis-specific: current key type filter */
  redisKeyType?: 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream';
  /** Redis-specific: key pattern filter */
  redisKeyPattern?: string;
}

export interface QueryTab extends BaseTab {
  type: 'query';
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  loading: boolean;
  error?: string;
  duration?: number;
  explainPlan?: ExplainPlan | null;
  explainLoading?: boolean;
  explainError?: string;
  showExplainPanel?: boolean;
  /** Database type for routing to correct query editor */
  dbType?: DatabaseType;
}

export interface ERDiagramTab extends BaseTab {
  type: 'er-diagram';
  availableSchemas: string[];
  selectedSchemas: string[];
  diagramData: ERDiagramData | null;
  loading: boolean;
  error?: string;
}

export interface FunctionTab extends BaseTab {
  type: 'function';
  schema: string;
  functionName: string;
  functionType: 'function' | 'procedure' | 'aggregate' | 'window' | 'trigger';
  loading: boolean;
  definition?: string; // Cached function definition
  functionDetails?: FunctionDetails | TriggerDetails; // Cached metadata
  error?: string;
  /** Database type */
  dbType?: DatabaseType;
}

export type Tab = TableTab | QueryTab | ERDiagramTab | FunctionTab;

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
  dbType?: DatabaseType; // Database type for filtering history by db
}

export interface QueryHistoryState {
  entries: QueryHistoryEntry[];
  maxEntries: number; // Limit stored history (e.g., 100)
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
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

// ============================================
// Function/Procedure/Trigger Viewer Types
// ============================================

/**
 * PostgreSQL function volatility classification
 */
export type FunctionVolatility = 'i' | 's' | 'v'; // immutable | stable | volatile

/**
 * PostgreSQL function/procedure kind
 */
export type FunctionKind = 'f' | 'p' | 'a' | 'w'; // function | procedure | aggregate | window

/**
 * Parameter mode for function/procedure parameters
 */
export type ParameterMode = 'IN' | 'OUT' | 'INOUT' | 'VARIADIC' | 'TABLE';

/**
 * Function parameter details
 */
export interface FunctionParameter {
  name: string;
  type: string; // PostgreSQL type name
  mode: ParameterMode;
  defaultValue?: string;
  position: number;
}

/**
 * Complete function/procedure details from PostgreSQL
 */
export interface FunctionDetails {
  name: string;
  schema: string;
  language: string; // e.g., 'sql', 'plpgsql', 'plpython3u'
  definition: string; // Full CREATE FUNCTION/PROCEDURE statement
  arguments: string; // Human-readable argument list
  returnType: string; // Return type description
  volatility: FunctionVolatility;
  isStrict: boolean; // Returns NULL on NULL input
  isSecurityDefiner: boolean; // Executes with function owner's privileges
  cost: number; // Estimated execution cost
  estimatedRows: number; // Estimated rows returned (for set-returning functions)
  kind: FunctionKind;
  parameters: FunctionParameter[];
  description?: string; // Comment/documentation
  oid?: number; // PostgreSQL object identifier
}

/**
 * Trigger timing
 */
export type TriggerTiming = 'BEFORE' | 'AFTER' | 'INSTEAD OF';

/**
 * Trigger event types
 */
export type TriggerEvent = 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';

/**
 * Complete trigger details from PostgreSQL
 */
export interface TriggerDetails {
  name: string;
  schema: string;
  tableName: string;
  functionName: string;
  definition: string; // Full CREATE TRIGGER statement
  isEnabled: boolean;
  timing: TriggerTiming;
  events: TriggerEvent[];
  description?: string;
}

/**
 * Function execution result
 */
export interface FunctionExecutionResult {
  success: boolean;
  result?: any; // Scalar value, array, or table result
  columns?: string[]; // For set-returning functions
  rows?: Record<string, unknown>[]; // For set-returning functions
  error?: string;
  executionTime?: number; // Milliseconds
  rowCount?: number;
}
