import { EventEmitter } from 'events';
import * as mysql from 'mysql2/promise';
import type { MySQLConnectionConfig } from '@dbview/types';
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
import { buildSqlFilter } from "@dbview/core";

/**
 * MySQL Database Adapter
 *
 * Key MySQL differences:
 * - Databases are like PostgreSQL schemas (flat hierarchy)
 * - Backtick quoting: `identifier` instead of "identifier"
 * - Parameter placeholders: ? instead of $1, $2
 * - INFORMATION_SCHEMA for metadata
 * - Default port: 3306
 */
export class MySQLAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'mysql' as const;
  readonly capabilities = getDatabaseCapabilities('mysql');

  private pool: mysql.Pool | undefined;
  private config: mysql.PoolOptions;
  private connectionConfig: MySQLConnectionConfig;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: Error | undefined;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly baseReconnectDelayMs = 1000;

  constructor(config: MySQLConnectionConfig) {
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
      connectionLimit: poolConfig.maxConnections ?? 20, // Increased default from 10 to 20
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: poolConfig.connectionTimeoutMs ?? 10000,
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
        console.log('[MySQLAdapter] Pool already exists and connected, skipping reconnect');
        return;
      }

      // Close existing pool if any
      if (this.pool) {
        console.log('[MySQLAdapter] Closing existing pool before reconnecting');
        await this.pool.end();
      }

      this.pool = mysql.createPool(this.config);

      // Test the connection
      const connection = await this.pool.getConnection();
      try {
        await connection.ping();
        this.setStatus('connected');
        console.log('[MySQLAdapter] Connected successfully');
      } finally {
        connection.release();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', err);
      console.error('[MySQLAdapter] Connection failed:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.pool) {
      try {
        await this.pool.end();
        console.log('[MySQLAdapter] Disconnected successfully');
      } catch (error) {
        console.error('[MySQLAdapter] Error during disconnect:', error);
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
        console.error('[MySQLAdapter] Health check error:', error);
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
      console.log(`[MySQLAdapter] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return false;
    }

    this.reconnectAttempts++;
    const delay = this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[MySQLAdapter] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} after ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.disconnect();
      await this.connect();
      this.reconnectAttempts = 0; // Reset on success
      console.log('[MySQLAdapter] Reconnect successful');
      return true;
    } catch (error) {
      console.error(`[MySQLAdapter] Reconnect attempt ${this.reconnectAttempts} failed:`, error);

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
    // MySQL uses a flat hierarchy - databases are the top level
    return {
      type: 'database-based',
      levels: ['database', 'table'],
      systemSchemas: ['information_schema', 'mysql', 'performance_schema', 'sys'],
    };
  }

  async listSchemas(database?: string): Promise<string[]> {
    // In MySQL, schemas are databases
    return this.listDatabases();
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.execute<any[]>('SHOW DATABASES');

    // Filter out system databases
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
    return rows
      .map((row: any) => row.Database)
      .filter((db: string) => !systemDbs.includes(db));
  }

  async listTables(schema: string): Promise<TableInfo[]> {
    const query = `
      SELECT
        table_name as name,
        (data_length + index_length) as size_bytes,
        table_rows as row_count
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);

    return rows.map((row: any) => ({
      name: row.name,
      sizeBytes: row.size_bytes ? parseInt(row.size_bytes) : undefined,
      rowCount: row.row_count ? parseInt(row.row_count) : undefined,
    }));
  }

  async listViews(schema: string): Promise<string[]> {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'VIEW'
      ORDER BY table_name
    `;

    const [rows] = await this.execute<any[]>(query, [schema]);
    return rows.map((row: any) => row.table_name);
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    // Get column information
    const columnsQuery = `
      SELECT
        column_name as name,
        data_type,
        is_nullable,
        column_default,
        column_key,
        extra
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position
    `;

    const [rows] = await this.execute<any[]>(columnsQuery, [schema, table]);

    // Get foreign key information
    const fkMap = await this.getForeignKeyMap(schema, table);

    return rows.map((row: any) => ({
      name: row.name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      isPrimaryKey: row.column_key === 'PRI',
      isForeignKey: fkMap.has(row.name),
      foreignKeyRef: fkMap.get(row.name) || null,
    }));
  }

  /**
   * Get foreign key references for a table
   * Returns a map of column name to referenced table.column
   */
  private async getForeignKeyMap(schema: string, table: string): Promise<Map<string, string>> {
    const fkQuery = `
      SELECT
        kcu.column_name,
        kcu.referenced_table_schema,
        kcu.referenced_table_name,
        kcu.referenced_column_name
      FROM information_schema.key_column_usage kcu
      WHERE kcu.table_schema = ?
        AND kcu.table_name = ?
        AND kcu.referenced_table_name IS NOT NULL
    `;

    const [fkRows] = await this.execute<any[]>(fkQuery, [schema, table]);

    const fkMap = new Map<string, string>();
    for (const fk of fkRows) {
      const ref = `${fk.referenced_table_name}.${fk.referenced_column_name}`;
      fkMap.set(fk.column_name, ref);
    }

    return fkMap;
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    return this.getTableColumns(schema, table);
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    const query = `
      SELECT
        column_name as name,
        data_type as type,
        is_nullable,
        column_default as default_value,
        column_key,
        extra,
        character_maximum_length as max_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position
    `;

    const [rows] = await this.execute<any[]>(query, [schema, table]);

    // Get foreign key information
    const fkMap = await this.getForeignKeyMap(schema, table);

    return rows.map((row: any) => {
      const extra = row.extra || '';
      const isForeignKey = fkMap.has(row.name);
      return {
        name: row.name,
        type: row.type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.default_value,
        isPrimaryKey: row.column_key === 'PRI',
        isForeignKey,
        foreignKeyRef: fkMap.get(row.name) || null,
        isAutoIncrement: extra.includes('auto_increment'),
        isGenerated: extra.includes('GENERATED'),
        maxLength: row.max_length ? parseInt(row.max_length) : undefined,
        numericPrecision: row.numeric_precision ? parseInt(row.numeric_precision) : undefined,
        numericScale: row.numeric_scale ? parseInt(row.numeric_scale) : undefined,
        editable: row.column_key !== 'PRI' && !extra.includes('auto_increment') && !extra.includes('GENERATED'),
      };
    });
  }

  async getObjectCounts(schema: string): Promise<ObjectCounts> {
    const tablesQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
    `;

    const viewsQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'VIEW'
    `;

    const [tablesResult] = await this.execute<any[]>(tablesQuery, [schema]);
    const [viewsResult] = await this.execute<any[]>(viewsQuery, [schema]);

    return {
      tables: tablesResult[0]?.count || 0,
      views: viewsResult[0]?.count || 0,
      materializedViews: 0, // MySQL doesn't have materialized views
      functions: 0, // Would need SHOW FUNCTION STATUS
      procedures: 0, // Would need SHOW PROCEDURE STATUS
      types: 0, // MySQL doesn't have user-defined types like PostgreSQL
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
    // Use MAX_EXECUTION_TIME optimizer hint to prevent long-running queries (MySQL 5.7.8+)
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

    // MySQL doesn't handle placeholders well for LIMIT/OFFSET, use direct values
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
    let query = `SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ COUNT(*) as count FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    const params: unknown[] = [];

    if (filters && filters.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    const [rows] = await this.execute<any[]>(query, params);
    return rows[0]?.count || 0;
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
        table_rows as row_count,
        data_length + index_length as total_size,
        data_length as table_size,
        index_length as indexes_size,
        update_time as last_update
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

    return {
      rowCount: parseInt(row.row_count) || 0,
      totalSize: formatBytes(parseInt(row.total_size) || 0),
      tableSize: formatBytes(parseInt(row.table_size) || 0),
      indexesSize: formatBytes(parseInt(row.indexes_size) || 0),
      lastVacuum: null, // MySQL doesn't have vacuum
      lastAnalyze: row.last_update || null,
      lastAutoVacuum: null,
      lastAutoAnalyze: null,
    };
  }

  async getDatabaseSize(): Promise<number> {
    const query = `
      SELECT
        SUM(data_length + index_length) as size_bytes
      FROM information_schema.tables
      WHERE table_schema = ?
    `;

    const [rows] = await this.execute<any[]>(query, [this.config.database]);
    return parseInt(rows[0]?.size_bytes || '0');
  }

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const [versionRows] = await this.execute<any[]>('SELECT VERSION() as version');
    const [sizeRows] = await this.execute<any[]>(`
      SELECT
        SUM(data_length + index_length) as size_bytes
      FROM information_schema.tables
      WHERE table_schema = ?
    `, [this.config.database]);

    const [tableCountRows] = await this.execute<any[]>(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
    `, [this.config.database]);

    const [connRows] = await this.execute<any[]>('SHOW STATUS LIKE "Threads_connected"');
    const [maxConnRows] = await this.execute<any[]>('SHOW VARIABLES LIKE "max_connections"');
    const [uptimeRows] = await this.execute<any[]>('SHOW STATUS LIKE "Uptime"');
    const [charsetRows] = await this.execute<any[]>('SELECT @@character_set_database as charset');

    const sizeBytes = sizeRows[0]?.size_bytes || 0;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

    const uptimeSeconds = parseInt(uptimeRows[0]?.Value || '0');
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    return {
      databaseName: this.config.database as string,
      version: versionRows[0]?.version || 'Unknown',
      size: `${sizeMB} MB`,
      tableCount: tableCountRows[0]?.count || 0,
      schemaCount: 1, // Current database only
      activeConnections: parseInt(connRows[0]?.Value || '0'),
      maxConnections: parseInt(maxConnRows[0]?.Value || '0'),
      uptime: `${days}d ${hours}h ${minutes}m`,
      encoding: charsetRows[0]?.charset || 'Unknown',
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

  /**
   * Insert multiple rows efficiently using multi-row INSERT syntax
   */
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
          const placeholders = columns.map(() => {
            params.push(row[columns[params.length % columns.length]]);
            return '?';
          });
          // Fix: push values correctly
          params.length = params.length - columns.length; // Reset
          for (const col of columns) {
            params.push(row[col]);
          }
          valuesClauses.push(`(${placeholders.join(', ')})`);
        }

        const sql = `INSERT INTO ${qualified} (${columnList}) VALUES ${valuesClauses.join(', ')}`;
        const [result] = await this.execute(sql, params);
        const affectedRows = (result as any).affectedRows || 0;
        successCount += affectedRows;

        // Get last insert ID
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
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : String(error)
          });
        } else {
          throw error;
        }
      }
    }

    return { successCount, failureCount, errors: errors.length > 0 ? errors : undefined, insertedIds };
  }

  /**
   * Update multiple rows efficiently using transactions
   */
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
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : String(error)
          });
        } else {
          throw error;
        }
      }
    }

    return { successCount, failureCount, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Delete multiple rows efficiently using batched IN clauses
   */
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
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      successCount,
      failureCount: primaryKeys.length - successCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Fetch rows using cursor-based (keyset) pagination
   */
  async fetchTableRowsWithCursor(
    schema: string,
    table: string,
    options: FetchOptions = {}
  ): Promise<CursorResultSet> {
    const {
      limit = 100,
      filters = [],
      filterLogic = 'AND',
      sortColumn,
      sortDirection = 'ASC',
      cursor
    } = options;

    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    // Get primary key columns for cursor if no sort column specified
    const metadata = await this.getTableMetadata(schema, table);
    const pkColumns = metadata.filter(col => col.isPrimaryKey).map(col => col.name);
    const cursorColumn = sortColumn || (pkColumns.length > 0 ? pkColumns[0] : metadata[0]?.name);

    if (!cursorColumn) {
      throw new Error('Cannot perform cursor pagination: no sort column or primary key found');
    }

    const { whereClause: filterWhere, params: filterParams } = this.buildWhereClause(filters, filterLogic);
    const params: unknown[] = [...filterParams];

    // Build cursor condition
    let cursorCondition = '';
    if (cursor && cursor.values[cursorColumn] !== undefined) {
      const cursorValue = cursor.values[cursorColumn];
      const operator = cursor.direction === 'forward'
        ? (sortDirection === 'ASC' ? '>' : '<')
        : (sortDirection === 'ASC' ? '<' : '>');

      params.push(cursorValue);
      cursorCondition = `${this.quoteIdentifier(cursorColumn)} ${operator} ?`;
    }

    // Build WHERE clause
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
    const sql = `
      SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ * FROM ${qualified}
      ${whereClause}
      ORDER BY ${this.quoteIdentifier(cursorColumn)} ${orderDirection}
      LIMIT ${fetchLimit}
    `;

    const [rows] = await this.execute<any[]>(sql, params);
    let resultRows = rows as Record<string, unknown>[];

    const hasMore = resultRows.length > limit;
    if (hasMore) {
      resultRows = resultRows.slice(0, limit);
    }

    if (cursor?.direction === 'backward') {
      resultRows.reverse();
    }

    let nextCursor: CursorPosition | undefined;
    let prevCursor: CursorPosition | undefined;

    if (resultRows.length > 0) {
      const lastRow = resultRows[resultRows.length - 1];
      const firstRow = resultRows[0];

      if (hasMore || cursor) {
        nextCursor = {
          values: { [cursorColumn]: lastRow[cursorColumn] },
          direction: 'forward'
        };
      }

      if (cursor) {
        prevCursor = {
          values: { [cursorColumn]: firstRow[cursorColumn] },
          direction: 'backward'
        };
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

  quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  formatParameter(index: number): string {
    return '?';
  }

  /**
   * Get the query timeout in milliseconds for MAX_EXECUTION_TIME hint
   * MySQL 5.7.8+ and MariaDB 10.1.1+ support this optimizer hint
   */
  private getQueryTimeoutMs(): number {
    return (this.connectionConfig as any).queryTimeoutMs ?? 30000; // Default 30 seconds
  }

  buildWhereClause(
    filters: FilterCondition[],
    logic: 'AND' | 'OR'
  ): { whereClause: string; params: unknown[] } {
    // Delegate to @dbview/core filter builder
    return buildSqlFilter(filters, logic, {
      dbType: 'mysql',
      quoteIdentifier: this.quoteIdentifier.bind(this),
    });
  }

  private async execute<T = any>(sql: string, params?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
    if (!this.pool) {
      throw new Error('Not connected to MySQL database');
    }

    try {
      return await this.pool.execute<any>(sql, params);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', err);
      throw err;
    }
  }
}
