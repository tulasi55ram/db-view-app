import type { EventEmitter } from "events";

/**
 * Database types supported by dbview
 */
export type DatabaseType = 'postgres' | 'mysql' | 'sqlserver' | 'sqlite' | 'mongodb';

/**
 * Connection status for database adapters
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * Connection status change event
 */
export interface ConnectionStatusEvent {
  status: ConnectionStatus;
  message?: string;
  error?: Error;
}

/**
 * Query result set structure
 */
export interface QueryResultSet {
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * Table information
 */
export interface TableInfo {
  name: string;
  rowCount?: number;
  sizeBytes?: number;
}

/**
 * Column information
 */
export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
}

/**
 * Enhanced column metadata for editing
 */
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

/**
 * Table statistics
 */
export interface TableStatistics {
  rowCount: number;
  totalSize: string;
  tableSize: string;
  indexesSize: string;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
  lastAutoVacuum?: string | null;
  lastAutoAnalyze?: string | null;
}

/**
 * Table index information
 */
export interface TableIndex {
  name: string;
  type: 'btree' | 'hash' | 'gist' | 'gin' | 'spgist' | 'brin' | string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

/**
 * Object counts per schema/database
 */
export interface ObjectCounts {
  tables: number;
  views: number;
  materializedViews: number;
  functions: number;
  procedures: number;
  types: number;
}

/**
 * Database information
 */
export interface DatabaseInfo {
  version: string;
  size: string;
  tableCount: number;
  schemaCount: number;
  uptime?: string;
  maxConnections?: number;
  activeConnections?: number;
  databaseName: string;
  encoding?: string;
}

/**
 * Running query information
 */
export interface RunningQuery {
  pid: number | string;
  user: string;
  query: string;
  state: string;
  duration: string;
  waitEvent?: string | null;
}

/**
 * ER diagram column
 */
export interface ERDiagramColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
}

/**
 * ER diagram table
 */
export interface ERDiagramTable {
  schema: string;
  name: string;
  columns: ERDiagramColumn[];
  position?: { x: number; y: number };
}

/**
 * ER diagram relationship
 */
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

/**
 * ER diagram data
 */
export interface ERDiagramData {
  tables: ERDiagramTable[];
  relationships: ERDiagramRelationship[];
}

/**
 * Filter condition for queries
 */
export interface FilterCondition {
  id: string;
  columnName: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown; // For BETWEEN operator
}

/**
 * Filter operators
 */
export type FilterOperator =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than'
  | 'greater_or_equal' | 'less_or_equal'
  | 'is_null' | 'is_not_null'
  | 'in' | 'between';

/**
 * Fetch options for table rows
 */
export interface FetchOptions {
  limit?: number;
  offset?: number;
  filters?: FilterCondition[];
  filterLogic?: 'AND' | 'OR';
}

/**
 * Filter options
 */
export interface FilterOptions {
  filters?: FilterCondition[];
  filterLogic?: 'AND' | 'OR';
}

/**
 * EXPLAIN plan node
 */
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
  [key: string]: any;
}

/**
 * EXPLAIN plan result
 */
export interface ExplainPlan {
  Plan: ExplainNode;
  'Planning Time': number;
  'Execution Time': number;
  Triggers?: any[];
}

/**
 * Database hierarchy type
 */
export type HierarchyType = 'schema-based' | 'database-based' | 'flat';

/**
 * Database hierarchy structure
 */
export interface DatabaseHierarchy {
  type: HierarchyType;
  levels: string[]; // e.g., ['database', 'schema', 'table'] or ['database', 'table']
  systemSchemas?: string[]; // Schemas to filter out (e.g., pg_catalog, information_schema)
}

/**
 * Database capabilities - describes what features a database supports
 */
export interface DatabaseCapabilities {
  // Hierarchy
  supportsSchemas: boolean;
  supportsDatabases: boolean;
  supportsInstances: boolean;

  // Objects
  supportsTables: boolean;
  supportsViews: boolean;
  supportsMaterializedViews: boolean;
  supportsFunctions: boolean;
  supportsProcedures: boolean;
  supportsTypes: boolean;
  supportsIndexes: boolean;
  supportsTriggers: boolean;

  // Features
  supportsSQL: boolean;
  supportsExplainPlan: boolean;
  supportsForeignKeys: boolean;
  supportsJSON: boolean;
  supportsArrays: boolean;
  supportsTransactions: boolean;

  // Authentication
  supportsWindowsAuth: boolean;
  supportsSSL: boolean;

  // Connection
  supportsConnectionPooling: boolean;
  supportsHealthChecks: boolean;

  // Special characteristics
  isNoSQL: boolean;
  isFileBased: boolean;
  requiresServer: boolean;
}

/**
 * Abstract interface for database adapters
 *
 * All database-specific implementations (PostgreSQL, MySQL, SQL Server, SQLite, MongoDB)
 * must implement this interface to ensure consistent behavior across different databases.
 */
export interface DatabaseAdapter extends EventEmitter {
  /**
   * Database type identifier
   */
  readonly type: DatabaseType;

  /**
   * Database capabilities
   */
  readonly capabilities: DatabaseCapabilities;

  /**
   * Current connection status
   */
  readonly status: ConnectionStatus;

  /**
   * Last error encountered
   */
  readonly lastError: Error | undefined;

  // ==================== Connection Management ====================

  /**
   * Test database connection without establishing a persistent connection
   * @returns Result with success flag and message
   */
  testConnection(): Promise<{ success: boolean; message: string }>;

  /**
   * Establish connection to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database and cleanup resources
   */
  disconnect(): Promise<void>;

  /**
   * Ping database to check connection health
   * @returns true if connection is alive, false otherwise
   */
  ping(): Promise<boolean>;

  /**
   * Start periodic health checks
   */
  startHealthCheck(): void;

  /**
   * Stop periodic health checks
   */
  stopHealthCheck(): void;

  /**
   * Attempt to reconnect to the database
   * @returns true if reconnection successful, false otherwise
   */
  reconnect(): Promise<boolean>;

  // ==================== Hierarchy & Discovery ====================

  /**
   * List all databases (for databases that support multiple databases like SQL Server, MongoDB)
   * @returns Array of database names
   */
  listDatabases?(): Promise<string[]>;

  /**
   * List all schemas
   * For databases without schemas (MySQL, SQLite), returns empty array or single default schema
   * @param database Optional database name (for multi-database systems)
   * @returns Array of schema names
   */
  listSchemas(database?: string): Promise<string[]>;

  /**
   * Get database hierarchy structure
   * @returns Hierarchy information
   */
  getHierarchy(): Promise<DatabaseHierarchy>;

  // ==================== Table Operations ====================

  /**
   * List all tables in a schema/database
   * @param schema Schema name (or database name for databases without schemas)
   * @returns Array of table information
   */
  listTables(schema: string): Promise<TableInfo[]>;

  /**
   * Get table metadata for editing
   * @param schema Schema name
   * @param table Table name
   * @returns Array of column metadata
   */
  getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]>;

  /**
   * Fetch rows from a table
   * @param schema Schema name
   * @param table Table name
   * @param options Fetch options (limit, offset, filters)
   * @returns Query result set
   */
  fetchTableRows(schema: string, table: string, options?: FetchOptions): Promise<QueryResultSet>;

  /**
   * Get total row count for a table
   * @param schema Schema name
   * @param table Table name
   * @param options Filter options
   * @returns Row count
   */
  getTableRowCount(schema: string, table: string, options?: FilterOptions): Promise<number>;

  /**
   * Get actual row count for a specific table using COUNT(*)
   * WARNING: This may be expensive on large tables as it performs a full scan
   * @param schema Schema name
   * @param table Table name
   * @returns Promise resolving to the exact row count
   */
  getActualRowCount?(schema: string, table: string): Promise<number>;

  /**
   * Get table statistics
   * @param schema Schema name
   * @param table Table name
   * @returns Table statistics
   */
  getTableStatistics(schema: string, table: string): Promise<TableStatistics>;

  /**
   * List columns in a table
   * @param schema Schema name
   * @param table Table name
   * @returns Array of column information
   */
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>;

  // ==================== Optional Objects ====================

  /**
   * List views in a schema (if supported)
   * @param schema Schema name
   * @returns Array of view names
   */
  listViews?(schema: string): Promise<string[]>;

  /**
   * List materialized views in a schema (if supported)
   * @param schema Schema name
   * @returns Array of materialized view names
   */
  listMaterializedViews?(schema: string): Promise<string[]>;

  /**
   * List functions in a schema (if supported)
   * @param schema Schema name
   * @returns Array of function names
   */
  listFunctions?(schema: string): Promise<string[]>;

  /**
   * List stored procedures in a schema (if supported)
   * @param schema Schema name
   * @returns Array of procedure names
   */
  listProcedures?(schema: string): Promise<string[]>;

  /**
   * List user-defined types in a schema (if supported)
   * @param schema Schema name
   * @returns Array of type names
   */
  listTypes?(schema: string): Promise<string[]>;

  /**
   * List triggers in a schema (if supported)
   * @param schema Schema name
   * @returns Array of trigger names
   */
  listTriggers?(schema: string): Promise<string[]>;

  // ==================== Query Execution ====================

  /**
   * Execute a raw SQL query
   * @param sql SQL query string
   * @returns Query result set
   */
  runQuery(sql: string): Promise<QueryResultSet>;

  /**
   * Get EXPLAIN plan for a query (if supported)
   * @param sql SQL query string
   * @returns EXPLAIN plan result
   */
  explainQuery?(sql: string): Promise<ExplainPlan>;

  // ==================== CRUD Operations ====================

  /**
   * Update a single cell value
   * @param schema Schema name
   * @param table Table name
   * @param primaryKey Primary key values to identify the row
   * @param column Column name to update
   * @param value New value
   */
  updateCell(schema: string, table: string, primaryKey: Record<string, unknown>, column: string, value: unknown): Promise<void>;

  /**
   * Insert a new row
   * @param schema Schema name
   * @param table Table name
   * @param values Column values for the new row
   * @returns Inserted row with generated values
   */
  insertRow(schema: string, table: string, values: Record<string, unknown>): Promise<Record<string, unknown>>;

  /**
   * Delete rows by primary keys
   * @param schema Schema name
   * @param table Table name
   * @param primaryKeys Array of primary key values
   * @returns Number of rows deleted
   */
  deleteRows(schema: string, table: string, primaryKeys: Record<string, unknown>[]): Promise<number>;

  // ==================== Metadata ====================

  /**
   * Get database information
   * @returns Database info
   */
  getDatabaseInfo(): Promise<DatabaseInfo>;

  /**
   * Get total database size in bytes
   * @returns Size in bytes
   */
  getDatabaseSize(): Promise<number>;

  /**
   * Get object counts for a schema
   * @param schema Schema name
   * @returns Object counts
   */
  getObjectCounts(schema: string): Promise<ObjectCounts>;

  /**
   * Get currently running queries (if supported)
   * @returns Array of running queries
   */
  getRunningQueries?(): Promise<RunningQuery[]>;

  /**
   * Get table indexes (if supported)
   * @param schema Schema name
   * @param table Table name
   * @returns Array of indexes
   */
  getIndexes?(schema: string, table: string): Promise<TableIndex[]>;

  /**
   * Get ER diagram data (if supported)
   * @param schemas Array of schema names to include
   * @returns ER diagram data
   */
  getERDiagramData?(schemas: string[]): Promise<ERDiagramData>;

  // ==================== SQL Helpers ====================

  /**
   * Quote an identifier (table name, column name, etc.) for safe use in SQL
   * Database-specific implementation (e.g., double quotes for PostgreSQL, backticks for MySQL)
   * @param identifier Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(identifier: string): string;

  /**
   * Format a parameter placeholder for prepared statements
   * Database-specific implementation (e.g., $1 for PostgreSQL, ? for MySQL)
   * @param index Parameter index (1-based)
   * @returns Formatted parameter placeholder
   */
  formatParameter(index: number): string;

  /**
   * Build WHERE clause from filter conditions
   * @param filters Array of filter conditions
   * @param logic Logic operator (AND/OR)
   * @returns WHERE clause SQL and parameter values
   */
  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] };
}
