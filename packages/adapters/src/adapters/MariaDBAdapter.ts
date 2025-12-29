import { EventEmitter } from 'events';
import * as mysql from 'mysql2/promise';
import type { MariaDBConnectionConfig } from '@dbview/types';
import type {
  DatabaseAdapter,
  ConnectionStatus,
  ConnectionStatusEvent,
  QueryResultSet,
  TableInfo,
  ColumnInfo,
  ColumnMetadata,
  TableStatistics,
  TableIndex,
  ObjectCounts,
  DatabaseInfo,
  DatabaseHierarchy,
  FilterCondition,
  FetchOptions,
  CursorPosition,
  CursorResultSet,
  BulkOperationResult,
  BulkInsertOptions,
  BulkUpdateItem,
  BulkUpdateOptions,
  BulkDeleteOptions,
} from './DatabaseAdapter';
import { getDatabaseCapabilities } from '../capabilities/DatabaseCapabilities';

/**
 * MariaDB Database Adapter
 *
 * MariaDB is a community-developed fork of MySQL with high compatibility.
 * Key characteristics:
 * - Uses mysql2 driver (protocol-compatible with MySQL)
 * - Databases are like PostgreSQL schemas (flat hierarchy)
 * - Backtick quoting: `identifier` instead of "identifier"
 * - Parameter placeholders: ? instead of $1, $2
 * - INFORMATION_SCHEMA for metadata
 * - Default port: 3306 (same as MySQL)
 *
 * MariaDB-specific features:
 * - Better performance for certain operations
 * - Additional storage engines (Aria, ColumnStore)
 * - More advanced JSON functions
 * - Sequences (similar to PostgreSQL)
 * - System-versioned tables
 */
/**
 * Helper to get column value regardless of case
 * MariaDB/MySQL information_schema may return column names in different cases
 */
function getCol(row: any, ...names: string[]): any {
  if (!row) return undefined;
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
    if (row[name.toLowerCase()] !== undefined) return row[name.toLowerCase()];
    if (row[name.toUpperCase()] !== undefined) return row[name.toUpperCase()];
  }
  return undefined;
}

export class MariaDBAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'mariadb' as const;
  readonly capabilities = getDatabaseCapabilities('mariadb');

  private pool: mysql.Pool | undefined;
  private config: mysql.PoolOptions;
  private connectionConfig: MariaDBConnectionConfig;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: Error | undefined;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly baseReconnectDelayMs = 1000;

  constructor(config: MariaDBConnectionConfig) {
    super();

    this.connectionConfig = config;

    // Get pool configuration from connection config or use defaults
    const poolConfig = (config as any).pool || {};

    this.config = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset || 'utf8mb4',

      // Connection pool settings (best practices for MariaDB)
      connectionLimit: poolConfig.maxConnections ?? 20,       // Increased from 10 to 20
      waitForConnections: true,  // Queue requests when no connections available
      queueLimit: 0,             // Unlimited queue (0 = no limit)
      maxIdle: 10,               // Max idle connections (same as connectionLimit)
      idleTimeout: 60000,        // Close idle connections after 60s (must be < server wait_timeout)

      // Connection stability settings
      enableKeepAlive: true,           // Prevent connections from being closed by server wait_timeout
      keepAliveInitialDelay: 10000,    // Start keepalive after 10s of idle
      connectTimeout: 10000,           // 10s timeout for initial connection

      // Date/time handling
      timezone: 'Z',                   // Use UTC for consistency (can be overridden)
      dateStrings: false,              // Return Date objects, not strings

      // SSL configuration
      ssl: typeof config.ssl === 'boolean'
        ? (config.ssl ? {} : undefined)
        : config.ssl
          ? {
              rejectUnauthorized: config.ssl.rejectUnauthorized,
              ca: config.ssl.ca,
              key: config.ssl.key,
              cert: config.ssl.cert,
            }
          : undefined,
    };
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get lastError(): Error | undefined {
    return this._lastError;
  }

  private setStatus(status: ConnectionStatus, error?: Error): void {
    this._status = status;
    this._lastError = error;

    const event: ConnectionStatusEvent = { status, error };
    this.emit('statusChange', event);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testConn = await mysql.createConnection(this.config);
      await testConn.ping();
      await testConn.end();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    }
  }

  async connect(): Promise<void> {
    try {
      this.setStatus('connecting');

      // If pool already exists and is connected, just verify the connection
      if (this.pool && this._status === 'connected') {
        console.log('[MariaDBAdapter] Pool already exists and connected, skipping reconnect');
        return;
      }

      // Close existing pool if any
      if (this.pool) {
        console.log('[MariaDBAdapter] Closing existing pool before reconnecting');
        await this.pool.end();
      }

      this.pool = mysql.createPool(this.config);

      // Test the connection
      const connection = await this.pool.getConnection();
      try {
        await connection.ping();
        this.setStatus('connected');
        console.log('[MariaDBAdapter] Connected successfully');
      } finally {
        connection.release();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', err);
      console.error('[MariaDBAdapter] Connection failed:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.pool) {
      try {
        await this.pool.end();
        console.log('[MariaDBAdapter] Disconnected successfully');
      } catch (error) {
        console.error('[MariaDBAdapter] Error during disconnect:', error);
      }
      this.pool = undefined;
    }

    this.setStatus('disconnected');
  }

  async ping(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const connection = await this.pool.getConnection();
      try {
        await connection.ping();
        if (this._status === 'error') {
          this.setStatus('connected');
        }
        return true;
      } finally {
        connection.release();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', err);
      return false;
    }
  }

  startHealthCheck(): void {
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.ping();
      } catch (error) {
        console.error('[MariaDBAdapter] Health check error:', error);
        const err = error instanceof Error ? error : new Error(String(error));
        this.setStatus('error', err);
      }
    }, 30000); // Check every 30 seconds
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  dispose(): void {
    this.stopHealthCheck();
    this.removeAllListeners();
    if (this.pool) {
      this.pool.end().catch(() => {});
      this.pool = undefined;
    }
  }

  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[MariaDBAdapter] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return false;
    }

    this.reconnectAttempts++;
    const delay = this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[MariaDBAdapter] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} after ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.disconnect();
      await this.connect();
      this.reconnectAttempts = 0; // Reset on success
      console.log('[MariaDBAdapter] Reconnect successful');
      return true;
    } catch (error) {
      console.error(`[MariaDBAdapter] Reconnect attempt ${this.reconnectAttempts} failed:`, error);

      // Try again if we haven't exceeded max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        return this.reconnect();
      }

      return false;
    }
  }

  /**
   * Reset reconnect attempts counter (call when connection is manually established)
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  async getHierarchy(): Promise<DatabaseHierarchy> {
    // MariaDB uses a flat hierarchy - databases are the top level (same as MySQL)
    return {
      type: 'database-based',
      levels: ['database', 'table'],
      systemSchemas: ['information_schema', 'mysql', 'performance_schema', 'sys'],
    };
  }

  async listSchemas(database?: string): Promise<string[]> {
    // In MariaDB, schemas are databases (same as MySQL)
    return this.listDatabases();
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.execute<any[]>('SHOW DATABASES');

    // Filter out system databases
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
    return rows
      .map((row: any) => getCol(row, 'Database', 'database', 'DATABASE'))
      .filter((db: string) => db && !systemDbs.includes(db));
  }

  async listTables(schema: string): Promise<TableInfo[]> {
    const query = `
      SELECT
        TABLE_NAME as tbl_name,
        (DATA_LENGTH + INDEX_LENGTH) as size_bytes,
        TABLE_ROWS as row_count
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);

    return rows.map((row: any) => ({
      // Handle case sensitivity - MariaDB may return column names in different cases
      name: row.tbl_name || row.TBL_NAME || row.name || row.NAME || row.TABLE_NAME || row.table_name,
      sizeBytes: parseInt(row.size_bytes || row.SIZE_BYTES || 0) || undefined,
      rowCount: parseInt(row.row_count || row.ROW_COUNT || 0) || undefined,
    }));
  }

  async listViews(schema: string): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME as view_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'VIEW'
      ORDER BY TABLE_NAME
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);
    // Handle case sensitivity - MariaDB may return column names in different cases
    return rows.map((row: any) => row.view_name || row.VIEW_NAME || row.table_name || row.TABLE_NAME);
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    // Get column information
    const columnsQuery = `
      SELECT
        COLUMN_NAME as col_name,
        DATA_TYPE as data_type,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as col_default,
        COLUMN_KEY as col_key,
        EXTRA as extra
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position
    `;

    const [rows] = await this.execute<any[]>(columnsQuery, [schema, table]);

    // Get foreign key information
    const fkMap = await this.getForeignKeyMap(schema, table);

    return rows.map((row: any) => {
      const name = getCol(row, 'col_name', 'COLUMN_NAME', 'column_name', 'name');
      const dataType = getCol(row, 'data_type', 'DATA_TYPE');
      const isNullable = getCol(row, 'is_nullable', 'IS_NULLABLE');
      const colDefault = getCol(row, 'col_default', 'COLUMN_DEFAULT', 'column_default');
      const colKey = getCol(row, 'col_key', 'COLUMN_KEY', 'column_key');

      return {
        name,
        dataType,
        isNullable: isNullable === 'YES',
        defaultValue: colDefault,
        isPrimaryKey: colKey === 'PRI',
        isForeignKey: fkMap.has(name),
        foreignKeyRef: fkMap.get(name) || null,
      };
    });
  }

  /**
   * Get foreign key references for a table
   * Returns a map of column name to referenced table.column
   */
  private async getForeignKeyMap(schema: string, table: string): Promise<Map<string, string>> {
    const fkQuery = `
      SELECT
        COLUMN_NAME as col_name,
        REFERENCED_TABLE_SCHEMA as ref_schema,
        REFERENCED_TABLE_NAME as ref_table,
        REFERENCED_COLUMN_NAME as ref_column
      FROM information_schema.key_column_usage
      WHERE table_schema = ?
        AND table_name = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `;

    const [fkRows] = await this.execute<any[]>(fkQuery, [schema, table]);

    const fkMap = new Map<string, string>();
    for (const fk of fkRows) {
      const colName = getCol(fk, 'col_name', 'COLUMN_NAME', 'column_name');
      const refTable = getCol(fk, 'ref_table', 'REFERENCED_TABLE_NAME', 'referenced_table_name');
      const refColumn = getCol(fk, 'ref_column', 'REFERENCED_COLUMN_NAME', 'referenced_column_name');
      if (colName && refTable && refColumn) {
        const ref = `${refTable}.${refColumn}`;
        fkMap.set(colName, ref);
      }
    }

    return fkMap;
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    return this.getTableColumns(schema, table);
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    const query = `
      SELECT
        COLUMN_NAME as col_name,
        DATA_TYPE as data_type,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as col_default,
        COLUMN_KEY as col_key,
        EXTRA as extra,
        CHARACTER_MAXIMUM_LENGTH as max_len,
        NUMERIC_PRECISION as num_precision,
        NUMERIC_SCALE as num_scale
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position
    `;

    const [rows] = await this.execute<any[]>(query, [schema, table]);

    // Get foreign key information
    const fkMap = await this.getForeignKeyMap(schema, table);

    return rows.map((row: any) => {
      const name = getCol(row, 'col_name', 'COLUMN_NAME', 'column_name', 'name');
      const type = getCol(row, 'data_type', 'DATA_TYPE', 'type');
      const isNullable = getCol(row, 'is_nullable', 'IS_NULLABLE');
      const defaultValue = getCol(row, 'col_default', 'COLUMN_DEFAULT', 'column_default', 'default_value');
      const colKey = getCol(row, 'col_key', 'COLUMN_KEY', 'column_key');
      const extra = getCol(row, 'extra', 'EXTRA') || '';
      const maxLength = getCol(row, 'max_len', 'CHARACTER_MAXIMUM_LENGTH', 'max_length');
      const numPrecision = getCol(row, 'num_precision', 'NUMERIC_PRECISION', 'numeric_precision');
      const numScale = getCol(row, 'num_scale', 'NUMERIC_SCALE', 'numeric_scale');

      const isForeignKey = fkMap.has(name);
      return {
        name,
        type,
        nullable: isNullable === 'YES',
        defaultValue,
        isPrimaryKey: colKey === 'PRI',
        isForeignKey,
        foreignKeyRef: fkMap.get(name) || null,
        isAutoIncrement: extra.toLowerCase().includes('auto_increment'),
        isGenerated: extra.toUpperCase().includes('GENERATED'),
        maxLength: maxLength ? parseInt(maxLength) : undefined,
        numericPrecision: numPrecision ? parseInt(numPrecision) : undefined,
        numericScale: numScale ? parseInt(numScale) : undefined,
        editable: colKey !== 'PRI' && !extra.toLowerCase().includes('auto_increment') && !extra.toUpperCase().includes('GENERATED'),
      };
    });
  }

  async getObjectCounts(schema: string): Promise<ObjectCounts> {
    const tablesQuery = `
      SELECT COUNT(*) as cnt
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
    `;

    const viewsQuery = `
      SELECT COUNT(*) as cnt
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'VIEW'
    `;

    const [tablesResult] = await this.execute<any[]>(tablesQuery, [schema]);
    const [viewsResult] = await this.execute<any[]>(viewsQuery, [schema]);

    // Helper to get count value handling case sensitivity
    const getCount = (result: any[]): number => {
      if (!result || result.length === 0) return 0;
      const row = result[0];
      // Try different possible column names
      return parseInt(row.cnt || row.CNT || row.count || row.COUNT || row['COUNT(*)'] || 0);
    };

    return {
      tables: getCount(tablesResult),
      views: getCount(viewsResult),
      materializedViews: 0, // MariaDB doesn't have materialized views
      functions: 0, // Would need SHOW FUNCTION STATUS
      procedures: 0, // Would need SHOW PROCEDURE STATUS
      types: 0, // MariaDB doesn't have user-defined types like PostgreSQL
    };
  }

  async fetchTableData(
    schema: string,
    table: string,
    limit: number = 100,
    offset: number = 0,
    filters?: FilterCondition[],
    filterLogic: 'AND' | 'OR' = 'AND',
    orderBy?: string[],
    sortColumn?: string,
    sortDirection: 'ASC' | 'DESC' = 'ASC'
  ): Promise<QueryResultSet> {
    // Use MAX_EXECUTION_TIME optimizer hint to prevent long-running queries (MariaDB 10.1.1+)
    const timeoutMs = this.getQueryTimeoutMs();
    let query = `SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ * FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    const params: unknown[] = [];

    if (filters && filters.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    // Add ORDER BY clause - sortColumn takes precedence over orderBy
    if (sortColumn) {
      query += ` ORDER BY ${this.quoteIdentifier(sortColumn)} ${sortDirection}`;
    } else if (orderBy && orderBy.length > 0) {
      const orderByClause = orderBy.map(col => this.quoteIdentifier(col)).join(', ');
      query += ` ORDER BY ${orderByClause}`;
    }

    // MariaDB doesn't handle placeholders well for LIMIT/OFFSET, use direct values
    const safeLimit = Math.max(0, parseInt(String(limit)));
    const safeOffset = Math.max(0, parseInt(String(offset)));
    query += ` LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const [rows] = await this.execute<any[]>(query, params);

    return {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows: rows,
    };
  }

  async fetchTableRows(
    schema: string,
    table: string,
    options?: FetchOptions
  ): Promise<QueryResultSet> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const filters = options?.filters;
    const filterLogic = options?.filterLogic ?? 'AND';
    const orderBy = options?.orderBy;
    const sortColumn = options?.sortColumn;
    const sortDirection = options?.sortDirection ?? 'ASC';

    return this.fetchTableData(schema, table, limit, offset, filters, filterLogic, orderBy, sortColumn, sortDirection);
  }

  async getTableRowCount(
    schema: string,
    table: string,
    options?: { filters?: FilterCondition[]; filterLogic?: 'AND' | 'OR' }
  ): Promise<number> {
    const filters = options?.filters;
    const filterLogic = options?.filterLogic ?? 'AND';
    return this.countTableRows(schema, table, filters, filterLogic);
  }

  async countTableRows(
    schema: string,
    table: string,
    filters?: FilterCondition[],
    filterLogic: 'AND' | 'OR' = 'AND'
  ): Promise<number> {
    const timeoutMs = this.getQueryTimeoutMs();
    let query = `SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ COUNT(*) as cnt FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    const params: unknown[] = [];

    if (filters && filters.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    const [rows] = await this.execute<any[]>(query, params);
    const count = getCol(rows[0], 'cnt', 'count', 'COUNT(*)', 'CNT', 'COUNT');
    return parseInt(count) || 0;
  }

  /**
   * Check if SQL query has a LIMIT clause
   */
  private hasLimitClause(sql: string): boolean {
    // Remove comments and normalize whitespace
    const normalized = sql
      .replace(/--[^\n]*\n/g, ' ') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();

    // Check for LIMIT clause (should be near the end)
    return /\blimit\s+\d+/.test(normalized);
  }

  private isSelectQuery(sql: string): boolean {
    // Remove comments and normalize whitespace
    const normalized = sql
      .replace(/--[^\n]*\n/g, ' ') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();

    // Check if query starts with SELECT (or WITH...SELECT for CTEs)
    return /^(select|with)\b/.test(normalized);
  }

  async runQuery(sql: string): Promise<QueryResultSet> {
    const DEFAULT_LIMIT = 1000;
    let executedSql = sql;
    let limitApplied = false;

    // Only apply LIMIT to SELECT queries
    if (this.isSelectQuery(sql) && !this.hasLimitClause(sql)) {
      // Auto-append LIMIT for safety
      executedSql = `${sql.trim()}\nLIMIT ${DEFAULT_LIMIT}`;
      limitApplied = true;
    }

    const [rows] = await this.execute<any[]>(executedSql);

    // Check if this is a command result (INSERT/UPDATE/DELETE)
    const isCommandResult = rows && typeof (rows as any).affectedRows === 'number';

    const resultSet: QueryResultSet = isCommandResult
      ? {
          columns: ['command', 'affected_rows', 'insert_id'],
          rows: [{
            command: 'COMMAND',
            affected_rows: (rows as any).affectedRows || 0,
            insert_id: (rows as any).insertId || null
          }]
        }
      : {
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          rows: rows,
        };

    // Add metadata about limiting
    if (limitApplied) {
      resultSet.limitApplied = true;
      resultSet.limit = DEFAULT_LIMIT;
      resultSet.hasMore = rows.length === DEFAULT_LIMIT;
    }

    return resultSet;
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    const query = `
      SELECT
        TABLE_ROWS as row_cnt,
        DATA_LENGTH + INDEX_LENGTH as total_sz,
        DATA_LENGTH as table_sz,
        INDEX_LENGTH as indexes_sz,
        UPDATE_TIME as last_upd
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
    `;

    const [rows] = await this.execute<any[]>(query, [schema, table]);
    const row = rows[0];

    if (!row) {
      throw new Error(`Table ${schema}.${table} not found`);
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const rowCount = getCol(row, 'row_cnt', 'TABLE_ROWS', 'table_rows', 'row_count');
    const totalSize = getCol(row, 'total_sz', 'total_size');
    const tableSize = getCol(row, 'table_sz', 'DATA_LENGTH', 'data_length', 'table_size');
    const indexesSize = getCol(row, 'indexes_sz', 'INDEX_LENGTH', 'index_length', 'indexes_size');
    const lastUpdate = getCol(row, 'last_upd', 'UPDATE_TIME', 'update_time', 'last_update');

    return {
      rowCount: parseInt(rowCount) || 0,
      totalSize: formatBytes(parseInt(totalSize) || 0),
      tableSize: formatBytes(parseInt(tableSize) || 0),
      indexesSize: formatBytes(parseInt(indexesSize) || 0),
      lastVacuum: null, // MariaDB doesn't have vacuum
      lastAnalyze: lastUpdate || null,
      lastAutoVacuum: null,
      lastAutoAnalyze: null,
    };
  }

  async getDatabaseSize(): Promise<number> {
    const query = `
      SELECT
        SUM(DATA_LENGTH + INDEX_LENGTH) as sz_bytes
      FROM information_schema.tables
      WHERE table_schema = ?
    `;

    const [rows] = await this.execute<any[]>(query, [this.config.database]);
    const sizeBytes = getCol(rows[0], 'sz_bytes', 'size_bytes', 'SZ_BYTES');
    return parseInt(sizeBytes || '0');
  }

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const [versionRows] = await this.execute<any[]>('SELECT VERSION() as ver');
    const [sizeRows] = await this.execute<any[]>(`
      SELECT
        SUM(DATA_LENGTH + INDEX_LENGTH) as sz_bytes
      FROM information_schema.tables
      WHERE table_schema = ?
    `, [this.config.database]);

    const [tableCountRows] = await this.execute<any[]>(`
      SELECT COUNT(*) as cnt
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
    `, [this.config.database]);

    const [connRows] = await this.execute<any[]>('SHOW STATUS LIKE "Threads_connected"');
    const [maxConnRows] = await this.execute<any[]>('SHOW VARIABLES LIKE "max_connections"');
    const [uptimeRows] = await this.execute<any[]>('SHOW STATUS LIKE "Uptime"');
    const [charsetRows] = await this.execute<any[]>('SELECT @@character_set_database as db_charset');

    const sizeBytes = getCol(sizeRows[0], 'sz_bytes', 'size_bytes', 'SZ_BYTES') || 0;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

    // SHOW STATUS returns Variable_name and Value columns
    const connValue = getCol(connRows[0], 'Value', 'value', 'VALUE') || '0';
    const maxConnValue = getCol(maxConnRows[0], 'Value', 'value', 'VALUE') || '0';
    const uptimeValue = getCol(uptimeRows[0], 'Value', 'value', 'VALUE') || '0';

    const uptimeSeconds = parseInt(uptimeValue);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    const version = getCol(versionRows[0], 'ver', 'version', 'VERSION') || 'Unknown';
    const tableCount = getCol(tableCountRows[0], 'cnt', 'count', 'COUNT', 'CNT') || 0;
    const charset = getCol(charsetRows[0], 'db_charset', 'charset', 'CHARSET') || 'Unknown';

    return {
      databaseName: this.config.database as string,
      version,
      size: `${sizeMB} MB`,
      tableCount: parseInt(tableCount) || 0,
      schemaCount: 1, // Current database only
      activeConnections: parseInt(connValue),
      maxConnections: parseInt(maxConnValue),
      uptime: `${days}d ${hours}h ${minutes}m`,
      encoding: charset,
    };
  }

  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    const pkConditions = Object.keys(primaryKey)
      .map((key) => `${this.quoteIdentifier(key)} = ?`)
      .join(' AND ');

    const query = `
      UPDATE ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      SET ${this.quoteIdentifier(column)} = ?
      WHERE ${pkConditions}
    `;

    const params = [value, ...Object.values(primaryKey)];
    await this.execute(query, params);
  }

  async insertRow(
    schema: string,
    table: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const columns = Object.keys(values);
    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map((col) => this.quoteIdentifier(col)).join(', ');

    const query = `
      INSERT INTO ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      (${columnList})
      VALUES (${placeholders})
    `;

    const [result] = await this.execute(query, Object.values(values));
    const insertId = (result as any).insertId;

    // Fetch the inserted row to get auto-generated values
    if (insertId) {
      // Try to fetch by the auto-increment ID
      const metadata = await this.getTableMetadata(schema, table);
      const autoIncrementCol = metadata.find(col => col.isAutoIncrement);

      if (autoIncrementCol) {
        const selectQuery = `
          SELECT * FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
          WHERE ${this.quoteIdentifier(autoIncrementCol.name)} = ?
        `;
        const [rows] = await this.execute<any[]>(selectQuery, [insertId]);
        if (rows.length > 0) {
          return rows[0];
        }
      }
    }

    // Fallback: return the values that were inserted
    return values;
  }

  async deleteRows(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[]
  ): Promise<number> {
    if (primaryKeys.length === 0) {
      return 0;
    }

    const pkColumns = Object.keys(primaryKeys[0]);
    const conditions = primaryKeys.map(() => {
      return `(${pkColumns.map((col) => `${this.quoteIdentifier(col)} = ?`).join(' AND ')})`;
    }).join(' OR ');

    const query = `
      DELETE FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      WHERE ${conditions}
    `;

    const params = primaryKeys.flatMap((pk) => Object.values(pk));
    const [result] = await this.execute(query, params);

    return (result as any).affectedRows || 0;
  }

  // ==================== Bulk Operations (for large datasets) ====================

  async bulkInsert(
    schema: string,
    table: string,
    rows: Record<string, unknown>[],
    options: BulkInsertOptions = {}
  ): Promise<BulkOperationResult> {
    if (rows.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 1000, onProgress, skipErrors = false } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    const columns = Object.keys(rows[0]);
    const columnList = columns.map(c => this.quoteIdentifier(c)).join(', ');

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];
    const insertedIds: unknown[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

      try {
        const params: unknown[] = [];
        const valuesClauses: string[] = [];

        for (const row of batch) {
          const placeholders: string[] = [];
          for (const col of columns) {
            params.push(row[col]);
            placeholders.push('?');
          }
          valuesClauses.push(`(${placeholders.join(', ')})`);
        }

        const sql = `INSERT INTO ${qualified} (${columnList}) VALUES ${valuesClauses.join(', ')}`;
        const [result] = await this.execute(sql, params);
        const affectedRows = (result as any).affectedRows || 0;
        successCount += affectedRows;

        const insertId = (result as any).insertId;
        if (insertId) {
          for (let j = 0; j < affectedRows; j++) {
            insertedIds.push(insertId + j);
          }
        }

        onProgress?.(successCount, rows.length);
      } catch (error) {
        if (skipErrors) {
          failureCount += batch.length;
          errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
        } else {
          throw error;
        }
      }
    }

    return { successCount, failureCount, errors: errors.length > 0 ? errors : undefined, insertedIds };
  }

  async bulkUpdate(
    schema: string,
    table: string,
    updates: BulkUpdateItem[],
    options: BulkUpdateOptions = {}
  ): Promise<BulkOperationResult> {
    if (updates.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 500, onProgress, skipErrors = false } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

      try {
        const connection = await this.pool!.getConnection();
        try {
          await connection.beginTransaction();

          for (const update of batch) {
            const pkColumns = Object.keys(update.primaryKey);
            const valueColumns = Object.keys(update.values);

            const setClause = valueColumns.map(col => `${this.quoteIdentifier(col)} = ?`).join(', ');
            const whereClause = pkColumns.map(col => `${this.quoteIdentifier(col)} = ?`).join(' AND ');

            const sql = `UPDATE ${qualified} SET ${setClause} WHERE ${whereClause}`;
            const params = [...Object.values(update.values), ...Object.values(update.primaryKey)];

            const [result] = await connection.execute(sql, params);
            successCount += (result as any).affectedRows || 0;
          }

          await connection.commit();
          onProgress?.(successCount, updates.length);
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } catch (error) {
        if (skipErrors) {
          failureCount += batch.length;
          errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
        } else {
          throw error;
        }
      }
    }

    return { successCount, failureCount, errors: errors.length > 0 ? errors : undefined };
  }

  async bulkDelete(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[],
    options: BulkDeleteOptions = {}
  ): Promise<BulkOperationResult> {
    if (primaryKeys.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 1000, onProgress } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    const pkColumns = Object.keys(primaryKeys[0]);

    let successCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < primaryKeys.length; i += batchSize) {
      const batch = primaryKeys.slice(i, Math.min(i + batchSize, primaryKeys.length));

      try {
        if (pkColumns.length === 1) {
          const pkCol = pkColumns[0];
          const values = batch.map(pk => pk[pkCol]);
          const placeholders = values.map(() => '?').join(', ');

          const sql = `DELETE FROM ${qualified} WHERE ${this.quoteIdentifier(pkCol)} IN (${placeholders})`;
          const [result] = await this.execute(sql, values);
          successCount += (result as any).affectedRows || 0;
        } else {
          const params: unknown[] = [];
          const conditions = batch.map(pk => {
            const pkConditions = pkColumns.map(col => {
              params.push(pk[col]);
              return `${this.quoteIdentifier(col)} = ?`;
            }).join(' AND ');
            return `(${pkConditions})`;
          }).join(' OR ');

          const sql = `DELETE FROM ${qualified} WHERE ${conditions}`;
          const [result] = await this.execute(sql, params);
          successCount += (result as any).affectedRows || 0;
        }

        onProgress?.(successCount, primaryKeys.length);
      } catch (error) {
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { successCount, failureCount: primaryKeys.length - successCount, errors: errors.length > 0 ? errors : undefined };
  }

  async fetchTableRowsWithCursor(
    schema: string,
    table: string,
    options: FetchOptions = {}
  ): Promise<CursorResultSet> {
    const { limit = 100, filters = [], filterLogic = 'AND', sortColumn, sortDirection = 'ASC', cursor } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    const metadata = await this.getTableMetadata(schema, table);
    const pkColumns = metadata.filter(col => col.isPrimaryKey).map(col => col.name);
    const cursorColumn = sortColumn || (pkColumns.length > 0 ? pkColumns[0] : metadata[0]?.name);

    if (!cursorColumn) {
      throw new Error('Cannot perform cursor pagination: no sort column or primary key found');
    }

    const { whereClause: filterWhere, params: filterParams } = this.buildWhereClause(filters, filterLogic);
    const params: unknown[] = [...filterParams];

    let cursorCondition = '';
    if (cursor && cursor.values[cursorColumn] !== undefined) {
      const cursorValue = cursor.values[cursorColumn];
      const operator = cursor.direction === 'forward'
        ? (sortDirection === 'ASC' ? '>' : '<')
        : (sortDirection === 'ASC' ? '<' : '>');
      params.push(cursorValue);
      cursorCondition = `${this.quoteIdentifier(cursorColumn)} ${operator} ?`;
    }

    let whereClause = '';
    if (filterWhere && cursorCondition) {
      whereClause = `WHERE (${filterWhere}) AND ${cursorCondition}`;
    } else if (filterWhere) {
      whereClause = `WHERE ${filterWhere}`;
    } else if (cursorCondition) {
      whereClause = `WHERE ${cursorCondition}`;
    }

    const fetchLimit = limit + 1;
    const orderDirection = cursor?.direction === 'backward'
      ? (sortDirection === 'ASC' ? 'DESC' : 'ASC')
      : sortDirection;

    const timeoutMs = this.getQueryTimeoutMs();
    const sql = `SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ * FROM ${qualified} ${whereClause} ORDER BY ${this.quoteIdentifier(cursorColumn)} ${orderDirection} LIMIT ${fetchLimit}`;

    const [rows] = await this.execute<any[]>(sql, params);
    let resultRows = rows as Record<string, unknown>[];

    const hasMore = resultRows.length > limit;
    if (hasMore) resultRows = resultRows.slice(0, limit);
    if (cursor?.direction === 'backward') resultRows.reverse();

    let nextCursor: CursorPosition | undefined;
    let prevCursor: CursorPosition | undefined;

    if (resultRows.length > 0) {
      const lastRow = resultRows[resultRows.length - 1];
      const firstRow = resultRows[0];

      if (hasMore || cursor) {
        nextCursor = { values: { [cursorColumn]: lastRow[cursorColumn] }, direction: 'forward' };
      }
      if (cursor) {
        prevCursor = { values: { [cursorColumn]: firstRow[cursorColumn] }, direction: 'backward' };
      }
    }

    return {
      columns: resultRows.length > 0 ? Object.keys(resultRows[0]) : [],
      rows: resultRows,
      hasNextPage: hasMore,
      hasPrevPage: !!cursor,
      nextCursor,
      prevCursor
    };
  }

  /**
   * List functions in a schema/database
   */
  async listFunctions(schema: string): Promise<string[]> {
    const query = `
      SELECT ROUTINE_NAME as func_name
      FROM information_schema.routines
      WHERE routine_schema = ?
        AND routine_type = 'FUNCTION'
      ORDER BY ROUTINE_NAME
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);
    return rows.map((row: any) => getCol(row, 'func_name', 'ROUTINE_NAME', 'routine_name') || '');
  }

  /**
   * List procedures in a schema/database
   */
  async listProcedures(schema: string): Promise<string[]> {
    const query = `
      SELECT ROUTINE_NAME as proc_name
      FROM information_schema.routines
      WHERE routine_schema = ?
        AND routine_type = 'PROCEDURE'
      ORDER BY ROUTINE_NAME
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);
    return rows.map((row: any) => getCol(row, 'proc_name', 'ROUTINE_NAME', 'routine_name') || '');
  }

  /**
   * List triggers in a schema/database
   */
  async listTriggers(schema: string): Promise<string[]> {
    const query = `
      SELECT TRIGGER_NAME as trig_name
      FROM information_schema.triggers
      WHERE trigger_schema = ?
      ORDER BY TRIGGER_NAME
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);
    return rows.map((row: any) => getCol(row, 'trig_name', 'TRIGGER_NAME', 'trigger_name') || '');
  }

  /**
   * Get indexes for a table
   */
  async getIndexes(schema: string, table: string): Promise<TableIndex[]> {
    const query = `
      SELECT
        INDEX_NAME as idx_name,
        COLUMN_NAME as col_name,
        NON_UNIQUE as non_unique,
        SEQ_IN_INDEX as seq_num,
        INDEX_TYPE as idx_type
      FROM information_schema.statistics
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;

    const [rows] = await this.execute<any[]>(query, [schema, table]);

    // Group columns by index name
    const indexMap = new Map<string, { index: TableIndex; columns: string[] }>();

    for (const row of rows) {
      const indexName = getCol(row, 'idx_name', 'INDEX_NAME', 'index_name');
      const columnName = getCol(row, 'col_name', 'COLUMN_NAME', 'column_name');
      const nonUnique = getCol(row, 'non_unique', 'NON_UNIQUE');
      const indexType = getCol(row, 'idx_type', 'INDEX_TYPE', 'index_type') || 'BTREE';

      if (!indexMap.has(indexName)) {
        indexMap.set(indexName, {
          index: {
            name: indexName,
            columns: [],
            isUnique: nonUnique === 0 || nonUnique === '0',
            isPrimary: indexName === 'PRIMARY',
            type: indexType.toLowerCase(),
            definition: '', // Will be filled after collecting all columns
          },
          columns: [],
        });
      }

      indexMap.get(indexName)!.columns.push(columnName);
    }

    // Build definitions and finalize indexes
    const result: TableIndex[] = [];
    for (const [, { index, columns }] of indexMap) {
      index.columns = columns;
      const uniqueStr = index.isUnique ? 'UNIQUE ' : '';
      const typeStr = index.type.toUpperCase();
      index.definition = `${uniqueStr}INDEX ${this.quoteIdentifier(index.name)} USING ${typeStr} (${columns.map(c => this.quoteIdentifier(c)).join(', ')})`;
      result.push(index);
    }

    return result;
  }

  /**
   * Explain a query for execution plan analysis
   */
  async explainQuery(sql: string): Promise<any> {
    const explainSql = `EXPLAIN ${sql}`;
    const [rows] = await this.execute<any[]>(explainSql);

    return {
      plan: rows,
      format: 'traditional',
    };
  }

  quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  formatParameter(index: number): string {
    return '?';
  }

  /**
   * Get the query timeout in milliseconds for MAX_EXECUTION_TIME hint
   * MariaDB 10.1.1+ supports this optimizer hint
   */
  private getQueryTimeoutMs(): number {
    return (this.connectionConfig as any).queryTimeoutMs ?? 30000; // Default 30 seconds
  }

  buildWhereClause(
    filters: FilterCondition[],
    logic: 'AND' | 'OR'
  ): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const filter of filters) {
      const column = this.quoteIdentifier(filter.columnName);

      switch (filter.operator) {
        case 'equals':
          conditions.push(`${column} = ?`);
          params.push(filter.value);
          break;
        case 'not_equals':
          conditions.push(`${column} != ?`);
          params.push(filter.value);
          break;
        case 'contains':
          conditions.push(`${column} LIKE ?`);
          params.push(`%${filter.value}%`);
          break;
        case 'not_contains':
          conditions.push(`${column} NOT LIKE ?`);
          params.push(`%${filter.value}%`);
          break;
        case 'starts_with':
          conditions.push(`${column} LIKE ?`);
          params.push(`${filter.value}%`);
          break;
        case 'ends_with':
          conditions.push(`${column} LIKE ?`);
          params.push(`%${filter.value}`);
          break;
        case 'greater_than':
          conditions.push(`${column} > ?`);
          params.push(filter.value);
          break;
        case 'less_than':
          conditions.push(`${column} < ?`);
          params.push(filter.value);
          break;
        case 'greater_or_equal':
          conditions.push(`${column} >= ?`);
          params.push(filter.value);
          break;
        case 'less_or_equal':
          conditions.push(`${column} <= ?`);
          params.push(filter.value);
          break;
        case 'is_null':
          conditions.push(`${column} IS NULL`);
          break;
        case 'is_not_null':
          conditions.push(`${column} IS NOT NULL`);
          break;
        case 'in':
          // Handle both arrays and comma-separated strings from UI
          // Filter out empty strings to avoid IN ('') which returns no results
          const values = (Array.isArray(filter.value)
            ? filter.value.map(v => String(v).trim())
            : String(filter.value).split(',').map(v => v.trim())
          ).filter(v => v !== '');

          if (values.length > 0) {
            const placeholders = values.map(() => '?').join(', ');
            conditions.push(`${column} IN (${placeholders})`);
            params.push(...values);
          }
          // Skip adding clause if no valid values (treats as "no filter")
          break;
        case 'between':
          conditions.push(`${column} BETWEEN ? AND ?`);
          params.push(filter.value, filter.value2);
          break;
      }
    }

    const whereClause = conditions.join(` ${logic} `);
    return { whereClause, params };
  }

  /**
   * Check if an error is a connection-related error that might benefit from retry
   */
  private isConnectionError(error: any): boolean {
    if (!error) return false;

    // MySQL/MariaDB error codes that indicate connection issues
    const connectionErrorCodes = [
      'ECONNREFUSED',      // Connection refused
      'ECONNRESET',        // Connection reset
      'ETIMEDOUT',         // Connection timed out
      'ENOTFOUND',         // DNS lookup failed
      'PROTOCOL_CONNECTION_LOST',  // Connection lost
      'ER_CON_COUNT_ERROR',        // Too many connections
    ];

    // MySQL/MariaDB error numbers for connection issues
    const connectionErrorNumbers = [
      2002,  // Can't connect to local MySQL server
      2003,  // Can't connect to MySQL server
      2006,  // MySQL server has gone away
      2013,  // Lost connection to MySQL server during query
      1040,  // Too many connections
      1042,  // Unable to connect to any of the specified MySQL hosts
      1043,  // Bad handshake
      1152,  // Aborted connection
      1158,  // Got an error reading communication packets
      1159,  // Got timeout reading communication packets
      1160,  // Got an error writing communication packets
      1161,  // Got timeout writing communication packets
    ];

    const code = error.code || error.errno;
    const errno = error.errno;

    return connectionErrorCodes.includes(code) ||
           connectionErrorNumbers.includes(errno) ||
           (error.message && error.message.includes('Connection lost'));
  }

  private async execute<T = any>(sql: string, params?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
    if (!this.pool) {
      throw new Error('Not connected to MariaDB database');
    }

    try {
      return await this.pool.execute<any>(sql, params);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if this is a connection error
      if (this.isConnectionError(error)) {
        console.error('[MariaDBAdapter] Connection error detected:', err.message);
        this.setStatus('error', err);

        // The pool should handle reconnection automatically,
        // but we mark the status as error so the UI can show it
      } else {
        // For non-connection errors (query errors), we don't change status
        // as the connection might still be valid
        console.error('[MariaDBAdapter] Query error:', err.message);
      }

      throw err;
    }
  }
}
