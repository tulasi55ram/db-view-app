import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import type { ConnectionConfig, PostgresConnectionConfig } from "@dbview/types";
import { EventEmitter } from "events";
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
  RunningQuery,
  ERDiagramData,
  FilterCondition,
  FetchOptions,
  FilterOptions,
  DatabaseHierarchy,
  ExplainPlan,
  CursorPosition,
  CursorResultSet,
  BulkOperationResult,
  BulkInsertOptions,
  BulkUpdateItem,
  BulkUpdateOptions,
  BulkDeleteOptions,
} from "./DatabaseAdapter";
import { getDatabaseCapabilities } from "../capabilities/DatabaseCapabilities";
import { buildSqlFilter } from "@dbview/core";

const DEFAULT_CONFIG: PoolConfig = process.env.DBVIEW_DATABASE_URL
  ? { connectionString: process.env.DBVIEW_DATABASE_URL }
  : {
      host: process.env.DBVIEW_PG_HOST ?? "localhost",
      port: Number(process.env.DBVIEW_PG_PORT ?? 5432),
      user: process.env.DBVIEW_PG_USER ?? "postgres",
      password: process.env.DBVIEW_PG_PASSWORD ?? "postgres",
      database: process.env.DBVIEW_PG_DB ?? "postgres"
    };

interface TableListRow {
  table_name: string;
  total_bytes: string | number | null;
  row_count: string | number | null;
}

/**
 * PostgreSQL database adapter
 */
export class PostgresAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'postgres' as const;
  readonly capabilities = getDatabaseCapabilities('postgres');

  private readonly config: PoolConfig;
  private pool: Pool | undefined;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: Error | undefined;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelayMs = 2000;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  constructor(connection?: ConnectionConfig | PostgresConnectionConfig) {
    super();
    this.config = connection ? toPoolConfig(connection) : DEFAULT_CONFIG;
    console.log("[dbview] PostgresAdapter created with config:", {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      hasPassword: !!this.config.password
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
      console.log(`[dbview] Connection status changed: ${previousStatus} → ${status}${message ? ` (${message})` : ''}`);
      this.emit('statusChange', { status, message, error } as ConnectionStatusEvent);
    }
  }

  // ==================== Connection Management ====================

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const pool = new Pool(this.config);

    try {
      console.log("[dbview] Testing connection to:", {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user
      });

      const client = await pool.connect();
      try {
        const result = await client.query("SELECT version()");
        const version = result.rows[0]?.version;

        console.log("[dbview] Connection test successful:", version);

        const versionMatch = version?.match(/PostgreSQL ([\d.]+)/);
        const versionNumber = versionMatch ? versionMatch[1] : "unknown";

        return {
          success: true,
          message: `Connected successfully to PostgreSQL ${versionNumber}`
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("[dbview] Connection test failed:", error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("password authentication failed")) {
        return {
          success: false,
          message: "Authentication failed. Please check your username and password."
        };
      } else if (errorMessage.includes("SASL") || errorMessage.includes("client password must be a string")) {
        return {
          success: false,
          message: "Authentication failed. Please provide a password for this connection."
        };
      } else if (errorMessage.includes("ECONNREFUSED")) {
        return {
          success: false,
          message: `Cannot connect to ${this.config.host}:${this.config.port}. Is PostgreSQL running?`
        };
      } else if (errorMessage.includes("does not exist")) {
        return {
          success: false,
          message: `Database "${this.config.database}" does not exist.`
        };
      } else {
        return {
          success: false,
          message: errorMessage
        };
      }
    } finally {
      await pool.end();
    }
  }

  async connect(): Promise<void> {
    try {
      this.setStatus('connecting', 'Establishing connection');

      // If pool already exists and is connected, just verify the connection
      if (this.pool && this._status === 'connected') {
        console.log("[dbview] PostgresAdapter: Pool already exists and connected, skipping reconnect");
        return;
      }

      // Close existing pool if any
      if (this.pool) {
        console.log("[dbview] PostgresAdapter: Closing existing pool before reconnecting");
        await this.pool.end();
      }

      this.pool = new Pool(this.config);

      // Test the connection
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        this.setStatus('connected', 'Connected successfully');
        this.reconnectAttempts = 0;
      } finally {
        client.release();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', 'Connection failed', err);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.pool) {
      console.log("[dbview] Disconnecting PostgresAdapter pool...");
      try {
        await this.pool.end();
        console.log("[dbview] Pool disconnected successfully");
      } catch (error) {
        console.error("[dbview] Error disconnecting pool:", error);
      }
      this.pool = undefined;
    }

    this.setStatus('disconnected', 'Disconnected');
    this.reconnectAttempts = 0;
  }

  async ping(): Promise<boolean> {
    try {
      const pool = this.pool ?? (this.pool = new Pool(this.config));
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        if (this._status !== 'connected') {
          this.setStatus('connected', 'Health check passed');
          this.reconnectAttempts = 0;
        }
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("[dbview] Health check failed:", error);
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', 'Health check failed', err);
      return false;
    }
  }

  startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.ping();
      } catch (error) {
        console.error("[dbview] Health check error:", error);
        const err = error instanceof Error ? error : new Error(String(error));
        this.setStatus('error', 'Health check failed', err);
      }
    }, this.healthCheckIntervalMs);
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
      console.log(`[dbview] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.setStatus('disconnected', 'Max reconnect attempts reached');
      return false;
    }

    this.reconnectAttempts++;
    this.setStatus('connecting', `Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      // Close existing pool
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = undefined;
      }

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelayMs));

      // Create new pool and test connection
      this.pool = new Pool(this.config);
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        this.setStatus('connected', 'Reconnected successfully');
        this.reconnectAttempts = 0;
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`[dbview] Reconnect attempt ${this.reconnectAttempts} failed:`, error);
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', `Reconnect failed`, err);
      return false;
    }
  }

  // ==================== Hierarchy & Discovery ====================

  async getHierarchy(): Promise<DatabaseHierarchy> {
    return {
      type: 'schema-based',
      levels: ['schema', 'table'],
      systemSchemas: ['pg_catalog', 'information_schema'],
    };
  }

  async listSchemas(): Promise<string[]> {
    const result = await this.query<{ schema_name: string }>(
      `select schema_name
       from information_schema.schemata
       where schema_name not in ('pg_catalog', 'information_schema')
       order by schema_name`
    );
    return result.rows.map((row) => row.schema_name);
  }

  // ==================== Table Operations ====================

  async listTables(schema: string): Promise<TableInfo[]> {
    const result = await this.query<TableListRow>(
      `SELECT
        t.table_name,
        pg_total_relation_size(
          quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)
        ) as total_bytes,
        CASE
          WHEN c.reltuples = -1 THEN NULL
          WHEN c.reltuples = 0 AND pg_table_size(c.oid) = 0 THEN 0
          WHEN s.n_live_tup IS NOT NULL AND s.n_live_tup > 0 THEN s.n_live_tup
          ELSE c.reltuples::bigint
        END as row_count
       FROM information_schema.tables t
       LEFT JOIN pg_stat_user_tables s
         ON t.table_schema = s.schemaname AND t.table_name = s.relname
       LEFT JOIN pg_namespace n ON n.nspname = t.table_schema
       LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = n.oid
       WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
       ORDER BY t.table_name`,
      [schema]
    );

    const tables = result.rows.map((row) => {
      const rawSize = row.total_bytes;
      const sizeNumber =
        typeof rawSize === "number"
          ? rawSize
          : rawSize !== null && rawSize !== undefined
            ? Number.parseInt(String(rawSize), 10)
            : undefined;
      const rawCount = row.row_count;
      const rowCount =
        typeof rawCount === "number"
          ? rawCount
          : rawCount !== null && rawCount !== undefined
            ? Number.parseInt(String(rawCount), 10)
            : undefined;
      return {
        name: row.table_name,
        sizeBytes: Number.isNaN(sizeNumber ?? NaN) ? undefined : sizeNumber,
        rowCount: Number.isNaN(rowCount ?? NaN) ? undefined : rowCount
      };
    });

    return tables;
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    const query = `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.is_generated,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        COALESCE(pk.is_primary_key, false) as is_primary_key,
        COALESCE(fk.is_foreign_key, false) as is_foreign_key,
        fk.foreign_key_ref,
        CASE WHEN c.column_default LIKE 'nextval%' THEN true ELSE false END as is_auto_increment
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name, true as is_primary_key
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) pk ON c.column_name = pk.column_name
      LEFT JOIN (
        SELECT
          kcu.column_name,
          true as is_foreign_key,
          ccu.table_schema || '.' || ccu.table_name || '.' || ccu.column_name as foreign_key_ref
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) fk ON c.column_name = fk.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `;

    const result = await this.query(query, [schema, table]);

    return result.rows.map((row: any) => {
      const isGenerated = row.is_generated === 'ALWAYS';
      return {
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        foreignKeyRef: row.foreign_key_ref,
        isAutoIncrement: row.is_auto_increment,
        isGenerated: isGenerated,
        maxLength: row.character_maximum_length,
        numericPrecision: row.numeric_precision,
        numericScale: row.numeric_scale,
        editable: !row.is_primary_key && !row.is_auto_increment && !isGenerated,
      };
    });
  }

  async fetchTableRows(schema: string, table: string, options: FetchOptions = {}): Promise<QueryResultSet> {
    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND', orderBy = [], sortColumn, sortDirection = 'ASC', sorting } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    const { whereClause, params } = this.buildWhereClause(filters, filterLogic);

    let sql = `SELECT * FROM ${qualified}`;
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    // Add ORDER BY clause - sorting array takes precedence, then sortColumn, then orderBy
    if (sorting && sorting.length > 0) {
      const orderByClause = sorting.map(sort =>
        `${this.quoteIdentifier(sort.columnName)} ${sort.direction.toUpperCase()}`
      ).join(', ');
      sql += ` ORDER BY ${orderByClause}`;
    } else if (sortColumn) {
      sql += ` ORDER BY ${this.quoteIdentifier(sortColumn)} ${sortDirection}`;
    } else if (orderBy.length > 0) {
      const orderByClause = orderBy.map(col => this.quoteIdentifier(col)).join(', ');
      sql += ` ORDER BY ${orderByClause}`;
    }

    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const result = await this.query(sql, [...params, limit, offset]);
    return createResultSet(result);
  }

  async getTableRowCount(schema: string, table: string, options: FilterOptions = {}): Promise<number> {
    const { filters = [], filterLogic = 'AND' } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    // Build WHERE clause if filters are provided
    let sql = `SELECT COUNT(*) as count FROM ${qualified}`;
    let params: unknown[] = [];

    if (filters.length > 0) {
      const { whereClause, params: filterParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        params = filterParams;
      }
    }

    // Always use COUNT(*) for accuracy instead of pg_class.reltuples estimate
    const countResult = await this.query<{ count: string }>(sql, params);
    return parseInt(countResult.rows[0]?.count ?? "0", 10);
  }

  /**
   * Get actual row count via COUNT(*) - may be slow on large tables
   * Use this sparingly and only when exact counts are needed
   */
  async getActualRowCount(schema: string, table: string): Promise<number> {
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    try {
      const countResult = await this.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${qualified}`
      );
      return parseInt(countResult.rows[0]?.count ?? "0", 10);
    } catch (error) {
      console.error(`[dbview] Failed to count rows in ${schema}.${table}:`, error);
      throw error;
    }
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    const sizeSql = `
      SELECT
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_relation_size(c.oid)) as table_size,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as indexes_size,
        (SELECT count(*) FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}) as row_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2;
    `;

    const statsSql = `
      SELECT
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND relname = $2;
    `;

    const [sizeResult, statsResult] = await Promise.all([
      this.query(sizeSql, [schema, table]),
      this.query(statsSql, [schema, table])
    ]);

    const sizeRow = sizeResult.rows[0];
    const statsRow = statsResult.rows[0] || {};

    return {
      rowCount: parseInt(sizeRow.row_count) || 0,
      totalSize: sizeRow.total_size || '0 bytes',
      tableSize: sizeRow.table_size || '0 bytes',
      indexesSize: sizeRow.indexes_size || '0 bytes',
      lastVacuum: statsRow.last_vacuum ? new Date(statsRow.last_vacuum).toISOString() : null,
      lastAutoVacuum: statsRow.last_autovacuum ? new Date(statsRow.last_autovacuum).toISOString() : null,
      lastAnalyze: statsRow.last_analyze ? new Date(statsRow.last_analyze).toISOString() : null,
      lastAutoAnalyze: statsRow.last_autoanalyze ? new Date(statsRow.last_autoanalyze).toISOString() : null,
    };
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      is_primary_key: boolean;
      is_foreign_key: boolean;
      foreign_key_ref: string | null;
    }>(
      `SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        COALESCE(pk.is_primary_key, false) as is_primary_key,
        COALESCE(fk.is_foreign_key, false) as is_foreign_key,
        fk.foreign_key_ref
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.column_name, true as is_primary_key
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = $1
           AND tc.table_name = $2
       ) pk ON c.column_name = pk.column_name
       LEFT JOIN (
         SELECT
           kcu.column_name,
           true as is_foreign_key,
           ccu.table_schema || '.' || ccu.table_name || '.' || ccu.column_name as foreign_key_ref
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
           AND tc.table_schema = ccu.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = $1
           AND tc.table_name = $2
       ) fk ON c.column_name = fk.column_name
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, table]
    );

    return result.rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      foreignKeyRef: row.foreign_key_ref
    }));
  }

  // ==================== Optional Objects ====================

  async listViews(schema: string): Promise<string[]> {
    const result = await this.query<{ table_name: string }>(
      `select table_name
       from information_schema.views
       where table_schema = $1
       order by table_name`,
      [schema]
    );
    return result.rows.map((row) => row.table_name);
  }

  async listMaterializedViews(schema: string): Promise<string[]> {
    const result = await this.query<{ matviewname: string }>(
      `select matviewname
       from pg_matviews
       where schemaname = $1
       order by matviewname`,
      [schema]
    );
    return result.rows.map((row) => row.matviewname);
  }

  async listFunctions(schema: string): Promise<string[]> {
    const result = await this.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'f'
       order by p.proname`,
      [schema]
    );
    return result.rows.map((row) => row.proname);
  }

  async listProcedures(schema: string): Promise<string[]> {
    const result = await this.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'p'
       order by p.proname`,
      [schema]
    );
    return result.rows.map((row) => row.proname);
  }

  async listTypes(schema: string): Promise<string[]> {
    const result = await this.query<{ typname: string }>(
      `select t.typname
       from pg_type t
       join pg_namespace n on t.typnamespace = n.oid
       where n.nspname = $1 and t.typtype in ('c', 'e', 'd')
       order by t.typname`,
      [schema]
    );
    return result.rows.map((row) => row.typname);
  }

  // ==================== Query Execution ====================

  async runQuery(sql: string): Promise<QueryResultSet> {
    const result = await this.query(sql);
    return createResultSet(result);
  }

  async explainQuery(sql: string): Promise<ExplainPlan> {
    const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`;
    const result = await this.query(explainSql);
    return result.rows[0]['QUERY PLAN'][0] as ExplainPlan;
  }

  // ==================== CRUD Operations ====================

  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    const whereClause = Object.keys(primaryKey)
      .map((key, i) => `${this.quoteIdentifier(key)} = $${i + 1}`)
      .join(' AND ');

    const sql = `
      UPDATE ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      SET ${this.quoteIdentifier(column)} = $${Object.keys(primaryKey).length + 1}
      WHERE ${whereClause}
    `;

    const params = [...Object.values(primaryKey), value];
    await this.query(sql, params);
  }

  async insertRow(
    schema: string,
    table: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    console.log(`[PostgresAdapter] ========== INSERT ROW ==========`);
    console.log(`[PostgresAdapter] Schema: ${schema}`);
    console.log(`[PostgresAdapter] Table: ${table}`);
    console.log(`[PostgresAdapter] Values:`, values);

    const columns = Object.keys(values);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const sql = `
      INSERT INTO ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      (${columns.map(c => this.quoteIdentifier(c)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    console.log(`[PostgresAdapter] Generated SQL:`, sql.trim());
    console.log(`[PostgresAdapter] Parameters (${Object.values(values).length}):`, Object.values(values));

    const result = await this.query(sql, Object.values(values));

    console.log(`[PostgresAdapter] Query executed successfully`);
    console.log(`[PostgresAdapter] Rows returned: ${result.rows.length}`);
    console.log(`[PostgresAdapter] Inserted row:`, result.rows[0]);

    return result.rows[0] as Record<string, unknown>;
  }

  async deleteRows(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[]
  ): Promise<number> {
    if (primaryKeys.length === 0) return 0;

    const pkColumns = Object.keys(primaryKeys[0]);
    const conditions = primaryKeys.map((pk, i) => {
      const pkConditions = pkColumns.map((col, j) =>
        `${this.quoteIdentifier(col)} = $${i * pkColumns.length + j + 1}`
      ).join(' AND ');
      return `(${pkConditions})`;
    }).join(' OR ');

    const sql = `
      DELETE FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      WHERE ${conditions}
    `;

    const params = primaryKeys.flatMap(pk => Object.values(pk));
    const result = await this.query(sql, params);
    return result.rowCount || 0;
  }

  // ==================== Bulk Operations (for large datasets) ====================

  /**
   * Insert multiple rows efficiently using multi-row INSERT syntax
   * Processes rows in batches to avoid memory issues with large datasets
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

    // Process in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

      try {
        // Build multi-row VALUES clause
        const params: unknown[] = [];
        const valuesClauses: string[] = [];

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const placeholders = columns.map((col, k) => {
            params.push(row[col]);
            return `$${j * columns.length + k + 1}`;
          });
          valuesClauses.push(`(${placeholders.join(', ')})`);
        }

        const sql = `
          INSERT INTO ${qualified} (${columnList})
          VALUES ${valuesClauses.join(', ')}
          RETURNING *
        `;

        const result = await this.query(sql, params);
        successCount += result.rowCount || 0;

        // Collect inserted IDs (first column, usually primary key)
        if (result.rows.length > 0) {
          const firstCol = Object.keys(result.rows[0])[0];
          insertedIds.push(...result.rows.map(r => r[firstCol]));
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
   * Update multiple rows efficiently
   * Uses a single query with CASE expressions for better performance
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

    // Process in batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

      try {
        // For each update in the batch, execute individually within a transaction
        // This is safer and handles different column updates per row
        const pool = this.pool ?? (this.pool = new Pool(this.config));
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          for (const update of batch) {
            const pkColumns = Object.keys(update.primaryKey);
            const valueColumns = Object.keys(update.values);

            const setClause = valueColumns.map((col, idx) =>
              `${this.quoteIdentifier(col)} = $${idx + 1}`
            ).join(', ');

            const whereClause = pkColumns.map((col, idx) =>
              `${this.quoteIdentifier(col)} = $${valueColumns.length + idx + 1}`
            ).join(' AND ');

            const sql = `UPDATE ${qualified} SET ${setClause} WHERE ${whereClause}`;
            const params = [...Object.values(update.values), ...Object.values(update.primaryKey)];

            const result = await client.query(sql, params);
            successCount += result.rowCount || 0;
          }

          await client.query('COMMIT');
          onProgress?.(successCount, updates.length);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
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

    // Process in batches
    for (let i = 0; i < primaryKeys.length; i += batchSize) {
      const batch = primaryKeys.slice(i, Math.min(i + batchSize, primaryKeys.length));

      try {
        // Build WHERE clause with OR conditions for composite keys
        // or IN clause for single-column keys
        if (pkColumns.length === 1) {
          // Single-column primary key - use efficient IN clause
          const pkCol = pkColumns[0];
          const values = batch.map(pk => pk[pkCol]);
          const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

          const sql = `DELETE FROM ${qualified} WHERE ${this.quoteIdentifier(pkCol)} IN (${placeholders})`;
          const result = await this.query(sql, values);
          successCount += result.rowCount || 0;
        } else {
          // Composite primary key - use OR conditions
          const params: unknown[] = [];
          const conditions = batch.map((pk, idx) => {
            const pkConditions = pkColumns.map((col, j) => {
              params.push(pk[col]);
              return `${this.quoteIdentifier(col)} = $${idx * pkColumns.length + j + 1}`;
            }).join(' AND ');
            return `(${pkConditions})`;
          }).join(' OR ');

          const sql = `DELETE FROM ${qualified} WHERE ${conditions}`;
          const result = await this.query(sql, params);
          successCount += result.rowCount || 0;
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
   * More efficient than OFFSET for large datasets - O(1) instead of O(n)
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
      cursorCondition = `${this.quoteIdentifier(cursorColumn)} ${operator} $${params.length}`;
    }

    // Build WHERE clause combining filters and cursor
    let whereClause = '';
    if (filterWhere && cursorCondition) {
      whereClause = `WHERE (${filterWhere}) AND ${cursorCondition}`;
    } else if (filterWhere) {
      whereClause = `WHERE ${filterWhere}`;
    } else if (cursorCondition) {
      whereClause = `WHERE ${cursorCondition}`;
    }

    // Fetch one extra row to determine if there are more pages
    const fetchLimit = limit + 1;
    params.push(fetchLimit);

    const orderDirection = cursor?.direction === 'backward'
      ? (sortDirection === 'ASC' ? 'DESC' : 'ASC')
      : sortDirection;

    const sql = `
      SELECT * FROM ${qualified}
      ${whereClause}
      ORDER BY ${this.quoteIdentifier(cursorColumn)} ${orderDirection}
      LIMIT $${params.length}
    `;

    const result = await this.query(sql, params);
    let rows = result.rows as Record<string, unknown>[];

    // Check if there are more pages
    const hasMore = rows.length > limit;
    if (hasMore) {
      rows = rows.slice(0, limit);
    }

    // Reverse rows if we were paginating backward
    if (cursor?.direction === 'backward') {
      rows.reverse();
    }

    // Build cursor positions
    let nextCursor: CursorPosition | undefined;
    let prevCursor: CursorPosition | undefined;

    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const firstRow = rows[0];

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
      columns: result.fields.map(f => f.name),
      rows,
      hasNextPage: hasMore,
      hasPrevPage: !!cursor,
      nextCursor,
      prevCursor
    };
  }

  // ==================== Metadata ====================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const [versionResult, statsResult, connectionsResult, uptimeResult] = await Promise.all([
      this.query<{ version: string; database: string; encoding: string }>(`
        SELECT
          version() as version,
          current_database() as database,
          pg_encoding_to_char(encoding) as encoding
        FROM pg_database
        WHERE datname = current_database()
      `),
      this.query<{ size: string; table_count: string; schema_count: string }>(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as size,
          (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema'))::text as table_count,
          (SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema'))::text as schema_count
      `),
      this.query<{ max_conn: string; active_conn: string }>(`
        SELECT
          setting as max_conn,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active')::text as active_conn
        FROM pg_settings WHERE name = 'max_connections'
      `),
      this.query<{ uptime: string }>(`
        SELECT
          CASE
            WHEN EXTRACT(DAYS FROM now() - pg_postmaster_start_time()) > 0
            THEN EXTRACT(DAYS FROM now() - pg_postmaster_start_time())::int || 'd ' ||
                 EXTRACT(HOURS FROM now() - pg_postmaster_start_time())::int || 'h'
            ELSE EXTRACT(HOURS FROM now() - pg_postmaster_start_time())::int || 'h ' ||
                 EXTRACT(MINUTES FROM now() - pg_postmaster_start_time())::int || 'm'
          END as uptime
      `)
    ]);

    return {
      version: versionResult.rows[0]?.version ?? 'Unknown',
      databaseName: versionResult.rows[0]?.database ?? 'Unknown',
      encoding: versionResult.rows[0]?.encoding ?? 'Unknown',
      size: statsResult.rows[0]?.size ?? '0 bytes',
      tableCount: parseInt(statsResult.rows[0]?.table_count ?? '0', 10),
      schemaCount: parseInt(statsResult.rows[0]?.schema_count ?? '0', 10),
      maxConnections: parseInt(connectionsResult.rows[0]?.max_conn ?? '0', 10),
      activeConnections: parseInt(connectionsResult.rows[0]?.active_conn ?? '0', 10),
      uptime: uptimeResult.rows[0]?.uptime ?? 'Unknown'
    };
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.query<{ size: string }>(
      `select pg_database_size(current_database()) as size`
    );
    return parseInt(result.rows[0]?.size ?? "0", 10);
  }

  async getObjectCounts(schema: string): Promise<ObjectCounts> {
    const tablesResult = await this.query<{ count: string }>(
      `select count(*) as count
       from information_schema.tables
       where table_schema = $1 and table_type = 'BASE TABLE'`,
      [schema]
    );

    const viewsResult = await this.query<{ count: string }>(
      `select count(*) as count
       from information_schema.views
       where table_schema = $1`,
      [schema]
    );

    const matViewsResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_matviews
       where schemaname = $1`,
      [schema]
    );

    const functionsResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'f'`,
      [schema]
    );

    const proceduresResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'p'`,
      [schema]
    );

    const typesResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_type t
       join pg_namespace n on t.typnamespace = n.oid
       where n.nspname = $1 and t.typtype in ('c', 'e', 'd')`,
      [schema]
    );

    return {
      tables: parseInt(tablesResult.rows[0]?.count ?? "0", 10),
      views: parseInt(viewsResult.rows[0]?.count ?? "0", 10),
      materializedViews: parseInt(matViewsResult.rows[0]?.count ?? "0", 10),
      functions: parseInt(functionsResult.rows[0]?.count ?? "0", 10),
      procedures: parseInt(proceduresResult.rows[0]?.count ?? "0", 10),
      types: parseInt(typesResult.rows[0]?.count ?? "0", 10)
    };
  }

  async getRunningQueries(): Promise<RunningQuery[]> {
    const result = await this.query<{
      pid: number;
      usename: string;
      query: string;
      state: string;
      duration: string;
      wait_event: string | null;
    }>(`
      SELECT
        pid,
        usename,
        LEFT(query, 200) as query,
        state,
        CASE
          WHEN state = 'active' THEN
            EXTRACT(EPOCH FROM (now() - query_start))::int || 's'
          ELSE '-'
        END as duration,
        wait_event
      FROM pg_stat_activity
      WHERE state IS NOT NULL
        AND pid != pg_backend_pid()
        AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY query_start DESC NULLS LAST
      LIMIT 20
    `);

    return result.rows.map(row => ({
      pid: row.pid,
      user: row.usename,
      query: row.query,
      state: row.state,
      duration: row.duration,
      waitEvent: row.wait_event
    }));
  }

  async getIndexes(schema: string, table: string): Promise<TableIndex[]> {
    const sql = `
      SELECT
        i.indexname as index_name,
        i.indexdef as definition,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        am.amname as index_type,
        ARRAY(
          SELECT a.attname
          FROM pg_attribute a
          WHERE a.attrelid = ix.indrelid
            AND a.attnum = ANY(ix.indkey)
          ORDER BY array_position(ix.indkey, a.attnum)
        ) as columns
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.tablename
      JOIN pg_namespace n ON n.nspname = i.schemaname AND n.oid = c.relnamespace
      JOIN pg_index ix ON ix.indexrelid = (
        SELECT oid FROM pg_class WHERE relname = i.indexname AND relnamespace = n.oid
      )
      JOIN pg_class ic ON ic.oid = ix.indexrelid
      JOIN pg_am am ON am.oid = ic.relam
      WHERE i.schemaname = $1 AND i.tablename = $2
      ORDER BY i.indexname;
    `;

    const result = await this.query(sql, [schema, table]);
    return result.rows.map((row: any) => ({
      name: row.index_name,
      type: row.index_type,
      columns: Array.isArray(row.columns) ? row.columns : [],
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      definition: row.definition,
    }));
  }

  async getERDiagramData(schemas: string[]): Promise<ERDiagramData> {
    const tablesSql = `
      SELECT
        n.nspname as schema,
        c.relname as table_name,
        a.attname as column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
        a.attnotnull as not_null,
        COALESCE(i.indisprimary, false) as is_primary,
        COALESCE(fk.is_foreign, false) as is_foreign
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_index i ON i.indrelid = c.oid AND a.attnum = ANY(i.indkey) AND i.indisprimary
      LEFT JOIN (
        SELECT DISTINCT
          conrelid,
          conkey[1] as attnum,
          true as is_foreign
        FROM pg_constraint
        WHERE contype = 'f'
      ) fk ON fk.conrelid = c.oid AND fk.attnum = a.attnum
      WHERE c.relkind = 'r'
        AND n.nspname = ANY($1)
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY n.nspname, c.relname, a.attnum;
    `;

    const relationshipsSql = `
      SELECT
        con.conname as constraint_name,
        n1.nspname as source_schema,
        t1.relname as source_table,
        a1.attname as source_column,
        n2.nspname as target_schema,
        t2.relname as target_table,
        a2.attname as target_column
      FROM pg_constraint con
      JOIN pg_class t1 ON t1.oid = con.conrelid
      JOIN pg_namespace n1 ON n1.oid = t1.relnamespace
      JOIN pg_class t2 ON t2.oid = con.confrelid
      JOIN pg_namespace n2 ON n2.oid = t2.relnamespace
      JOIN pg_attribute a1 ON a1.attrelid = con.conrelid AND a1.attnum = con.conkey[1]
      JOIN pg_attribute a2 ON a2.attrelid = con.confrelid AND a2.attnum = con.confkey[1]
      WHERE con.contype = 'f'
        AND n1.nspname = ANY($1)
      ORDER BY n1.nspname, t1.relname;
    `;

    const [tablesResult, relationshipsResult] = await Promise.all([
      this.query(tablesSql, [schemas]),
      this.query(relationshipsSql, [schemas])
    ]);

    const tablesMap = new Map<string, import('@dbview/types').ERDiagramTable>();

    for (const row of tablesResult.rows) {
      const key = `${row.schema}.${row.table_name}`;

      if (!tablesMap.has(key)) {
        tablesMap.set(key, {
          schema: row.schema,
          name: row.table_name,
          columns: []
        });
      }

      const table = tablesMap.get(key)!;
      table.columns.push({
        name: row.column_name,
        type: row.data_type,
        isPrimaryKey: row.is_primary,
        isForeignKey: row.is_foreign,
        isNullable: !row.not_null
      });
    }

    const relationships: import('@dbview/types').ERDiagramRelationship[] = relationshipsResult.rows.map((row: any) => ({
      id: `${row.source_schema}.${row.source_table}.${row.source_column}-${row.target_schema}.${row.target_table}.${row.target_column}`,
      sourceSchema: row.source_schema,
      sourceTable: row.source_table,
      sourceColumn: row.source_column,
      targetSchema: row.target_schema,
      targetTable: row.target_table,
      targetColumn: row.target_column,
      constraintName: row.constraint_name
    }));

    return {
      tables: Array.from(tablesMap.values()),
      relationships
    };
  }

  // ==================== SQL Helpers ====================

  quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  formatParameter(index: number): string {
    return `$${index}`;
  }

  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] } {
    // Delegate to @dbview/core filter builder
    return buildSqlFilter(filters, logic, {
      dbType: 'postgres',
      quoteIdentifier: this.quoteIdentifier.bind(this),
    });
  }

  // ==================== Private Helper Methods ====================

  private async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
    retryOnError = true
  ): Promise<QueryResult<T>> {
    try {
      const pool = this.pool ?? (this.pool = new Pool(this.config));
      const result = await pool.query<T>(text, params);

      if (this._status !== 'connected') {
        this.setStatus('connected', 'Query executed successfully');
        this.reconnectAttempts = 0;
      }

      return result;
    } catch (error) {
      console.error("[dbview] Query failed:", error);

      const err = error instanceof Error ? error : new Error(String(error));
      const isConnectionError = this.isConnectionError(err);

      if (isConnectionError) {
        this.setStatus('error', 'Connection lost', err);

        if (retryOnError && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log("[dbview] Attempting auto-reconnect...");
          const reconnected = await this.reconnect();

          if (reconnected) {
            console.log("[dbview] Retrying query after reconnect...");
            return this.query<T>(text, params, false);
          }
        }
      }

      throw error;
    }
  }

  private isConnectionError(error: Error): boolean {
    const connectionErrorPatterns = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'Connection terminated',
      'Connection refused',
      'Connection timed out',
      'client has encountered a connection error',
      'terminating connection due to administrator command',
      'server closed the connection unexpectedly',
      'SSL connection has been closed unexpectedly'
    ];

    const errorMessage = error.message.toLowerCase();
    return connectionErrorPatterns.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }
}

// Helper functions

function createResultSet(result: QueryResult): QueryResultSet {
  const columns = result.fields.map((field) => field.name);

  // For non-SELECT queries (INSERT/UPDATE/DELETE), fields will be empty
  // but rowCount will be set. Create a virtual result showing affected rows.
  if (columns.length === 0 && result.rowCount !== undefined && result.rowCount !== null) {
    return {
      columns: ['command', 'affected_rows'],
      rows: [{
        command: result.command || 'COMMAND',
        affected_rows: result.rowCount
      }]
    };
  }

  return {
    columns,
    rows: result.rows as Record<string, unknown>[]
  };
}

function toPoolConfig(connection: ConnectionConfig | PostgresConnectionConfig): PoolConfig {
  let sslConfig: boolean | { rejectUnauthorized?: boolean; ca?: string; key?: string; cert?: string } | undefined;

  // Handle sslMode if provided (takes precedence over ssl boolean)
  const sslMode = (connection as PostgresConnectionConfig).sslMode;
  if (sslMode) {
    switch (sslMode) {
      case 'disable':
        sslConfig = false;
        break;
      case 'require':
        // Encrypt but don't verify certificate
        sslConfig = { rejectUnauthorized: false };
        break;
      case 'verify-ca':
      case 'verify-full':
        // Verify certificate (verify-full also checks hostname automatically in node-postgres)
        sslConfig = { rejectUnauthorized: true };
        break;
    }
  } else if (connection.ssl) {
    if (typeof connection.ssl === 'boolean') {
      sslConfig = connection.ssl;
    } else {
      sslConfig = {
        rejectUnauthorized: connection.ssl.rejectUnauthorized ?? true,
        ca: connection.ssl.ca,
        key: connection.ssl.key,
        cert: connection.ssl.cert
      };
    }
  }

  // Get pool configuration from connection config or use defaults
  const poolConfig = (connection as any).pool || {};

  return {
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password ?? '',
    database: connection.database,
    ssl: sslConfig,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMs ?? 10000,
    idleTimeoutMillis: poolConfig.idleTimeoutMs ?? 30000,
    min: poolConfig.minConnections ?? 0,
    max: poolConfig.maxConnections ?? 20, // Increased default from 10 to 20 for better concurrency
    statement_timeout: 60000
  };
}

/**
 * Test a PostgreSQL connection
 * @deprecated Use PostgresAdapter.testConnection() instead
 */
export async function testConnection(
  connection: ConnectionConfig | PostgresConnectionConfig
): Promise<{ success: boolean; message: string }> {
  const adapter = new PostgresAdapter(connection);
  return adapter.testConnection();
}
