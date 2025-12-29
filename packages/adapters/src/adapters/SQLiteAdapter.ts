import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import type { SQLiteConnectionConfig } from '@dbview/types';
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
  FilterOptions,
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
 * SQLite Database Adapter
 *
 * Key SQLite characteristics:
 * - File-based database (no server)
 * - No user/password authentication
 * - No schemas (single main database)
 * - Double quote quoting: "identifier"
 * - Synchronous API (better-sqlite3)
 * - Positional parameters: ? for placeholders
 * - Simple data types: INTEGER, TEXT, REAL, BLOB, NULL
 */
export class SQLiteAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'sqlite' as const;
  readonly capabilities = getDatabaseCapabilities('sqlite');

  private db: Database.Database | undefined;
  private connectionConfig: SQLiteConnectionConfig;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: Error | undefined;

  constructor(config: SQLiteConnectionConfig) {
    super();
    this.connectionConfig = config;

    console.log('[SQLiteAdapter] Created with config:', {
      filePath: config.filePath,
      mode: config.mode || 'readwrite',
      readOnly: config.readOnly,
    });
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get lastError(): Error | undefined {
    return this._lastError;
  }

  private setStatus(status: ConnectionStatus, message?: string, error?: Error): void {
    const previousStatus = this._status;
    this._status = status;
    this._lastError = error;

    if (previousStatus !== status) {
      console.log(`[SQLiteAdapter] Status changed: ${previousStatus} → ${status}${message ? ` (${message})` : ''}`);
      this.emit('statusChange', { status, message, error } as ConnectionStatusEvent);
    }
  }

  // ==================== Connection Management ====================

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[SQLiteAdapter] Testing connection to:', this.connectionConfig.filePath);

      const testDb = new Database(this.connectionConfig.filePath, {
        readonly: this.connectionConfig.readOnly || this.connectionConfig.mode === 'readonly',
        fileMustExist: this.connectionConfig.mode !== 'create',
      });

      // Test query
      const result = testDb.prepare('SELECT sqlite_version() as version').get() as { version: string };
      testDb.close();

      console.log('[SQLiteAdapter] Connection test successful, version:', result.version);

      return {
        success: true,
        message: `Connected successfully to SQLite ${result.version}`,
      };
    } catch (error) {
      console.error('[SQLiteAdapter] Connection test failed:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('ENOENT') || errorMessage.includes('does not exist')) {
        return {
          success: false,
          message: `Database file not found: ${this.connectionConfig.filePath}`,
        };
      } else if (errorMessage.includes('SQLITE_CANTOPEN')) {
        return {
          success: false,
          message: `Cannot open database file. Check file permissions.`,
        };
      } else {
        return {
          success: false,
          message: errorMessage,
        };
      }
    }
  }

  async connect(): Promise<void> {
    try {
      this.setStatus('connecting', 'Opening database file');

      if (this.db) {
        console.log('[SQLiteAdapter] Database already open, closing first');
        try {
          this.db.close();
        } catch (closeError) {
          console.error('[SQLiteAdapter] Error closing existing database:', closeError);
          // Continue anyway to try opening a new connection
        }
        this.db = undefined;
      }

      this.db = new Database(this.connectionConfig.filePath, {
        readonly: this.connectionConfig.readOnly || this.connectionConfig.mode === 'readonly',
        fileMustExist: this.connectionConfig.mode !== 'create',
      });

      // Enable foreign keys (disabled by default in SQLite)
      this.db.prepare('PRAGMA foreign_keys = ON').run();

      this.setStatus('connected', 'Connected successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', 'Connection failed', err);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      console.log('[SQLiteAdapter] Closing database...');
      try {
        this.db.close();
        console.log('[SQLiteAdapter] Database closed successfully');
      } catch (error) {
        console.error('[SQLiteAdapter] Error closing database:', error);
      }
      this.db = undefined;
    }

    this.setStatus('disconnected', 'Disconnected');
  }

  async ping(): Promise<boolean> {
    if (!this.db || !this.db.open) {
      return false;
    }

    try {
      this.db.prepare('SELECT 1').get();
      if (this._status !== 'connected') {
        this.setStatus('connected', 'Ping successful');
      }
      return true;
    } catch (error) {
      console.error('[SQLiteAdapter] Ping failed:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', 'Ping failed', err);
      return false;
    }
  }

  startHealthCheck(): void {
    // SQLite is file-based, no need for health checks
    console.log('[SQLiteAdapter] Health checks not needed for SQLite (file-based)');
  }

  stopHealthCheck(): void {
    // No-op for SQLite
  }

  dispose(): void {
    this.stopHealthCheck();
    this.removeAllListeners();
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore close errors during dispose
      }
      this.db = undefined;
    }
  }

  async reconnect(): Promise<boolean> {
    try {
      await this.disconnect();
      await this.connect();
      return true;
    } catch (error) {
      console.error('[SQLiteAdapter] Reconnect failed:', error);
      return false;
    }
  }

  // ==================== Hierarchy & Discovery ====================

  async getHierarchy(): Promise<DatabaseHierarchy> {
    // SQLite has a flat hierarchy - just tables in the main database
    return {
      type: 'flat',
      levels: ['table'],
      systemSchemas: ['sqlite_master', 'sqlite_schema'],
    };
  }

  async listDatabases(): Promise<string[]> {
    // SQLite only has the main database
    return ['main'];
  }

  async listSchemas(database?: string): Promise<string[]> {
    // SQLite doesn't have schemas
    return [];
  }

  // ==================== Table Operations ====================

  async listTables(schema?: string): Promise<TableInfo[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const query = `
      SELECT
        name,
        (SELECT COUNT(*) FROM pragma_table_info(name)) as column_count
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;

    const rows = this.db.prepare(query).all() as Array<{ name: string; column_count: number }>;

    return rows.map((row) => ({
      name: row.name,
      sizeBytes: undefined, // SQLite doesn't easily provide per-table size
      rowCount: this.getQuickRowCount(row.name),
    }));
  }

  private getQuickRowCount(tableName: string): number | undefined {
    if (!this.db) {
      return undefined;
    }

    try {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.quoteIdentifier(tableName)}`).get() as { count: number };
      return result.count;
    } catch {
      return undefined;
    }
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    const tableInfo = this.db!.prepare(`PRAGMA table_info(${this.quoteIdentifier(table)})`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    // Get foreign key info
    const fkInfo = this.db!.prepare(`PRAGMA foreign_key_list(${this.quoteIdentifier(table)})`).all() as Array<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
      match: string;
    }>;

    const fkMap = new Map<string, string>();
    fkInfo.forEach((fk) => {
      fkMap.set(fk.from, `${fk.table}.${fk.to}`);
    });

    return tableInfo.map((col) => ({
      name: col.name,
      type: col.type.toLowerCase(),
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      isPrimaryKey: col.pk > 0,
      isForeignKey: fkMap.has(col.name),
      foreignKeyRef: fkMap.get(col.name) || null,
      isAutoIncrement: col.pk > 0 && col.type.toUpperCase() === 'INTEGER', // INTEGER PRIMARY KEY is auto-increment in SQLite
      isGenerated: false, // SQLite doesn't have generated columns (before 3.31)
      maxLength: undefined,
      numericPrecision: undefined,
      numericScale: undefined,
      editable: col.pk === 0 && !(col.pk > 0 && col.type.toUpperCase() === 'INTEGER'),
    }));
  }

  async fetchTableRows(schema: string, table: string, options: FetchOptions = {}): Promise<QueryResultSet> {
    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND', orderBy = [], sortColumn, sortDirection = 'ASC' } = options;
    const qualified = this.quoteIdentifier(table);

    const { whereClause, params } = this.buildWhereClause(filters, filterLogic);

    let query = `SELECT * FROM ${qualified}`;
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    // Add ORDER BY clause - sortColumn takes precedence over orderBy
    if (sortColumn) {
      query += ` ORDER BY ${this.quoteIdentifier(sortColumn)} ${sortDirection}`;
    } else if (orderBy.length > 0) {
      const orderByClause = orderBy.map(col => this.quoteIdentifier(col)).join(', ');
      query += ` ORDER BY ${orderByClause}`;
    }

    query += ` LIMIT ? OFFSET ?`;

    const allParams = [...params, limit, offset];
    const rows = this.db!.prepare(query).all(...allParams) as Record<string, unknown>[];

    return {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
    };
  }

  async getTableRowCount(schema: string, table: string, options: FilterOptions = {}): Promise<number> {
    const { filters = [], filterLogic = 'AND' } = options;
    const qualified = this.quoteIdentifier(table);

    const { whereClause, params } = this.buildWhereClause(filters, filterLogic);

    let query = `SELECT COUNT(*) as count FROM ${qualified}`;
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    const result = this.db!.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  async getActualRowCount(schema: string, table: string): Promise<number> {
    const result = this.db!.prepare(`SELECT COUNT(*) as count FROM ${this.quoteIdentifier(table)}`).get() as { count: number };
    return result.count;
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    const rowCount = await this.getActualRowCount(schema, table);

    // Get page count and page size to estimate table size
    const pageCount = this.db!.prepare(`SELECT COUNT(*) as count FROM pragma_page_list(?)`).get(table) as { count: number } | undefined;
    const pageSize = this.db!.prepare('PRAGMA page_size').get() as { page_size: number };

    const sizeBytes = (pageCount?.count || 0) * (pageSize?.page_size || 4096);

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      rowCount,
      totalSize: formatBytes(sizeBytes),
      tableSize: formatBytes(sizeBytes),
      indexesSize: '0 B', // SQLite doesn't separate index size easily
      lastVacuum: null,
      lastAnalyze: null,
      lastAutoVacuum: null,
      lastAutoAnalyze: null,
    };
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const tableInfo = this.db!.prepare(`PRAGMA table_info(${this.quoteIdentifier(table)})`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const fkInfo = this.db!.prepare(`PRAGMA foreign_key_list(${this.quoteIdentifier(table)})`).all() as Array<{
      from: string;
      table: string;
      to: string;
    }>;

    const fkMap = new Map<string, string>();
    fkInfo.forEach((fk) => {
      fkMap.set(fk.from, `${fk.table}.${fk.to}`);
    });

    return tableInfo.map((col) => ({
      name: col.name,
      dataType: col.type,
      isNullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      isPrimaryKey: col.pk > 0,
      isForeignKey: fkMap.has(col.name),
      foreignKeyRef: fkMap.get(col.name) || null,
    }));
  }

  // ==================== Optional Objects ====================

  async listViews(schema: string): Promise<string[]> {
    const rows = this.db!.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'view'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    return rows.map((row) => row.name);
  }

  async listProcedures(schema: string): Promise<string[]> {
    // SQLite doesn't have stored procedures
    return [];
  }

  async listFunctions(schema: string): Promise<string[]> {
    // SQLite has built-in functions but no user-defined functions accessible via SQL
    return [];
  }

  async listTriggers(schema: string): Promise<string[]> {
    const rows = this.db!.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'trigger'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    return rows.map((row) => row.name);
  }

  // ==================== Query Execution ====================

  async runQuery(sql: string): Promise<QueryResultSet> {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
      const rows = this.db!.prepare(sql).all() as Record<string, unknown>[];
      return {
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      };
    } else {
      // INSERT, UPDATE, DELETE, CREATE, etc.
      const result = this.db!.prepare(sql).run();
      return {
        columns: ['changes', 'lastInsertRowid'],
        rows: [{ changes: result.changes, lastInsertRowid: result.lastInsertRowid }],
      };
    }
  }

  // ==================== CRUD Operations ====================

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
      UPDATE ${this.quoteIdentifier(table)}
      SET ${this.quoteIdentifier(column)} = ?
      WHERE ${pkConditions}
    `;

    const params = [value, ...Object.values(primaryKey)];
    this.db!.prepare(query).run(...params);
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
      INSERT INTO ${this.quoteIdentifier(table)}
      (${columnList})
      VALUES (${placeholders})
    `;

    const result = this.db!.prepare(query).run(...Object.values(values));

    // Fetch the inserted row
    if (result.lastInsertRowid) {
      const metadata = await this.getTableMetadata(schema, table);
      const pkColumn = metadata.find((col) => col.isPrimaryKey);

      if (pkColumn) {
        const selectQuery = `SELECT * FROM ${this.quoteIdentifier(table)} WHERE ${this.quoteIdentifier(pkColumn.name)} = ?`;
        const insertedRow = this.db!.prepare(selectQuery).get(result.lastInsertRowid) as Record<string, unknown>;
        if (insertedRow) {
          return insertedRow;
        }
      }
    }

    // Fallback
    return { ...values, rowid: result.lastInsertRowid };
  }

  async deleteRows(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[]
  ): Promise<number> {
    if (primaryKeys.length === 0) return 0;

    const pkColumns = Object.keys(primaryKeys[0]);
    const conditions = primaryKeys.map(() => {
      return `(${pkColumns.map((col) => `${this.quoteIdentifier(col)} = ?`).join(' AND ')})`;
    }).join(' OR ');

    const query = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${conditions}`;
    const params = primaryKeys.flatMap((pk) => Object.values(pk));

    const result = this.db!.prepare(query).run(...params);
    return result.changes;
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
    const columns = Object.keys(rows[0]);
    const columnList = columns.map(c => this.quoteIdentifier(c)).join(', ');
    const placeholders = columns.map(() => '?').join(', ');

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];
    const insertedIds: unknown[] = [];

    // Use transaction for better performance
    const insertStmt = this.db!.prepare(`INSERT INTO ${this.quoteIdentifier(table)} (${columnList}) VALUES (${placeholders})`);

    const insertBatch = this.db!.transaction((batch: Record<string, unknown>[]) => {
      for (const row of batch) {
        const result = insertStmt.run(...columns.map(col => row[col]));
        insertedIds.push(result.lastInsertRowid);
      }
      return batch.length;
    });

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

      try {
        const count = insertBatch(batch);
        successCount += count;
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

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    const updateBatch = this.db!.transaction((batch: BulkUpdateItem[]) => {
      let count = 0;
      for (const update of batch) {
        const pkColumns = Object.keys(update.primaryKey);
        const valueColumns = Object.keys(update.values);

        const setClause = valueColumns.map(col => `${this.quoteIdentifier(col)} = ?`).join(', ');
        const whereClause = pkColumns.map(col => `${this.quoteIdentifier(col)} = ?`).join(' AND ');

        const sql = `UPDATE ${this.quoteIdentifier(table)} SET ${setClause} WHERE ${whereClause}`;
        const params = [...Object.values(update.values), ...Object.values(update.primaryKey)];

        const result = this.db!.prepare(sql).run(...params);
        count += result.changes;
      }
      return count;
    });

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

      try {
        successCount += updateBatch(batch);
        onProgress?.(successCount, updates.length);
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
    const pkColumns = Object.keys(primaryKeys[0]);

    let successCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    const deleteBatch = this.db!.transaction((batch: Record<string, unknown>[]) => {
      if (pkColumns.length === 1) {
        const pkCol = pkColumns[0];
        const values = batch.map(pk => pk[pkCol]);
        const placeholders = values.map(() => '?').join(', ');
        const sql = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${this.quoteIdentifier(pkCol)} IN (${placeholders})`;
        const result = this.db!.prepare(sql).run(...values);
        return result.changes;
      } else {
        const conditions = batch.map(() => {
          return `(${pkColumns.map(col => `${this.quoteIdentifier(col)} = ?`).join(' AND ')})`;
        }).join(' OR ');
        const params = batch.flatMap(pk => Object.values(pk));
        const sql = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${conditions}`;
        const result = this.db!.prepare(sql).run(...params);
        return result.changes;
      }
    });

    for (let i = 0; i < primaryKeys.length; i += batchSize) {
      const batch = primaryKeys.slice(i, Math.min(i + batchSize, primaryKeys.length));

      try {
        successCount += deleteBatch(batch);
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

    params.push(fetchLimit);
    const sql = `SELECT * FROM ${this.quoteIdentifier(table)} ${whereClause} ORDER BY ${this.quoteIdentifier(cursorColumn)} ${orderDirection} LIMIT ?`;

    let resultRows = this.db!.prepare(sql).all(...params) as Record<string, unknown>[];

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

  // ==================== Metadata ====================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const version = this.db!.prepare('SELECT sqlite_version() as version').get() as { version: string };

    // Get file size
    const fs = require('fs');
    let sizeBytes = 0;
    try {
      const stats = fs.statSync(this.connectionConfig.filePath);
      sizeBytes = stats.size;
    } catch (error) {
      console.error('[SQLiteAdapter] Failed to get file size:', error);
    }

    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

    const tableCount = this.db!.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).get() as { count: number };

    return {
      version: version.version,
      databaseName: this.connectionConfig.filePath.split('/').pop() || 'database.db',
      size: `${sizeMB} MB`,
      tableCount: tableCount.count,
      schemaCount: 0, // SQLite doesn't have schemas
      activeConnections: 1, // SQLite file-based
      encoding: 'UTF-8',
    };
  }

  async getDatabaseSize(): Promise<number> {
    const fs = require('fs');
    try {
      const stats = fs.statSync(this.connectionConfig.filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  async getObjectCounts(schema: string): Promise<ObjectCounts> {
    const tables = this.db!.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).get() as { count: number };

    const views = this.db!.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'view'
    `).get() as { count: number };

    const triggers = this.db!.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'trigger'
    `).get() as { count: number };

    return {
      tables: tables.count,
      views: views.count,
      materializedViews: 0,
      functions: 0, // SQLite doesn't expose user-defined functions
      procedures: 0,
      types: 0,
    };
  }

  async getIndexes(schema: string, table: string): Promise<TableIndex[]> {
    const indexes = this.db!.prepare(`PRAGMA index_list(${this.quoteIdentifier(table)})`).all() as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;

    const result: TableIndex[] = [];

    for (const idx of indexes) {
      const indexInfo = this.db!.prepare(`PRAGMA index_info(${this.quoteIdentifier(idx.name)})`).all() as Array<{
        seqno: number;
        cid: number;
        name: string;
      }>;

      result.push({
        name: idx.name,
        type: 'btree', // SQLite uses B-tree for indexes
        columns: indexInfo.map((info) => info.name),
        isUnique: idx.unique === 1,
        isPrimary: idx.origin === 'pk',
        definition: `INDEX ${idx.name}`,
      });
    }

    return result;
  }

  // ==================== SQL Helpers ====================

  quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  formatParameter(index: number): string {
    return '?';
  }

  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] } {
    if (!filters || filters.length === 0) {
      return { whereClause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const filter of filters) {
      if (!filter.columnName || !filter.operator) {
        continue;
      }

      const columnName = this.quoteIdentifier(filter.columnName);

      switch (filter.operator) {
        case 'equals':
          conditions.push(`${columnName} = ?`);
          params.push(filter.value);
          break;

        case 'not_equals':
          conditions.push(`${columnName} != ?`);
          params.push(filter.value);
          break;

        case 'contains':
          conditions.push(`${columnName} LIKE ?`);
          params.push(`%${filter.value}%`);
          break;

        case 'not_contains':
          conditions.push(`${columnName} NOT LIKE ?`);
          params.push(`%${filter.value}%`);
          break;

        case 'starts_with':
          conditions.push(`${columnName} LIKE ?`);
          params.push(`${filter.value}%`);
          break;

        case 'ends_with':
          conditions.push(`${columnName} LIKE ?`);
          params.push(`%${filter.value}`);
          break;

        case 'greater_than':
          conditions.push(`${columnName} > ?`);
          params.push(filter.value);
          break;

        case 'less_than':
          conditions.push(`${columnName} < ?`);
          params.push(filter.value);
          break;

        case 'greater_or_equal':
          conditions.push(`${columnName} >= ?`);
          params.push(filter.value);
          break;

        case 'less_or_equal':
          conditions.push(`${columnName} <= ?`);
          params.push(filter.value);
          break;

        case 'is_null':
          conditions.push(`${columnName} IS NULL`);
          break;

        case 'is_not_null':
          conditions.push(`${columnName} IS NOT NULL`);
          break;

        case 'between':
          if (filter.value2 !== undefined) {
            conditions.push(`${columnName} BETWEEN ? AND ?`);
            params.push(filter.value, filter.value2);
          }
          break;

        case 'in':
          // Filter out empty strings to avoid IN ('') which returns no results
          const values = (Array.isArray(filter.value)
            ? filter.value.map((v: unknown) => String(v).trim())
            : String(filter.value).split(',').map((v: string) => v.trim())
          ).filter((v: string) => v !== '');

          if (values.length > 0) {
            const placeholders = values.map(() => '?').join(', ');
            conditions.push(`${columnName} IN (${placeholders})`);
            params.push(...values);
          }
          // Skip adding clause if no valid values (treats as "no filter")
          break;
      }
    }

    if (conditions.length === 0) {
      return { whereClause: '', params: [] };
    }

    const whereClause = conditions.join(` ${logic} `);
    return { whereClause, params };
  }
}
