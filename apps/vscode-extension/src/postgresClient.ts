import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import type { ConnectionConfig, FilterCondition } from "@dbview/core";
import { EventEmitter } from "events";

export interface QueryResultSet {
  columns: string[];
  rows: Record<string, unknown>[];
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ConnectionStatusEvent {
  status: ConnectionStatus;
  message?: string;
  error?: Error;
}

export interface ObjectCounts {
  tables: number;
  views: number;
  materializedViews: number;
  functions: number;
  procedures: number;
  types: number;
}

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

interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef: string | null;
}

export class PostgresClient extends EventEmitter {
  private readonly config: PoolConfig;
  private pool: Pool | undefined;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: Error | undefined;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelayMs = 2000;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  constructor(connection?: ConnectionConfig) {
    super();
    this.config = connection ? toPoolConfig(connection) : DEFAULT_CONFIG;
    console.log("[dbview] PostgresClient created with config:", {
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

  /**
   * Start periodic health checks
   */
  startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      await this.ping();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Check if the connection is alive
   */
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

  /**
   * Attempt to reconnect to the database
   */
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

  async listSchemas(): Promise<string[]> {
    const result = await this.query<{ schema_name: string }>(
      `select schema_name
       from information_schema.schemata
       where schema_name not in ('pg_catalog', 'information_schema')
       order by schema_name`
    );
    return result.rows.map((row) => row.schema_name);
  }

  async listTables(schema: string): Promise<{ name: string; sizeBytes?: number; rowCount?: number }[]> {
    const result = await this.query<TableListRow>(
      `SELECT
        t.table_name,
        pg_total_relation_size(
          quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)
        ) as total_bytes,
        COALESCE(
          NULLIF(s.n_live_tup, 0),
          NULLIF(c.reltuples::bigint, -1),
          0
        ) as row_count
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

    // For tables showing 0 rows, do a quick actual count (likely missing stats)
    // This helps for newly created tables or tables that haven't been analyzed
    const countsToFetch = tables
      .filter(t => t.rowCount === 0)
      .map(async (table) => {
        try {
          const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table.name)}`;
          const countResult = await this.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${qualified}`);
          const actualCount = parseInt(countResult.rows[0]?.count ?? "0", 10);
          return { tableName: table.name, count: actualCount };
        } catch (error) {
          console.error(`[dbview] Failed to count rows in ${schema}.${table.name}:`, error);
          return { tableName: table.name, count: 0 };
        }
      });

    if (countsToFetch.length > 0) {
      console.log(`[dbview] Fetching actual counts for ${countsToFetch.length} tables with missing stats...`);
      const actualCounts = await Promise.all(countsToFetch);
      // Update tables with actual counts
      actualCounts.forEach(({ tableName, count }) => {
        const table = tables.find(t => t.name === tableName);
        if (table) {
          table.rowCount = count;
        }
      });
    }

    return tables;
  }

  async fetchTableRows(
    schema: string,
    table: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: FilterCondition[];
      filterLogic?: 'AND' | 'OR';
    } = {}
  ): Promise<QueryResultSet> {
    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND' } = options;
    const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;

    // Build WHERE clause from filters
    const { whereClause, params } = buildWhereClause(filters, filterLogic);

    // Build final query
    let sql = `SELECT * FROM ${qualified}`;
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const result = await this.query(sql, [...params, limit, offset]);
    return createResultSet(result);
  }

  async getTableRowCount(
    schema: string,
    table: string,
    options: {
      filters?: FilterCondition[];
      filterLogic?: 'AND' | 'OR';
    } = {}
  ): Promise<number> {
    const { filters = [], filterLogic = 'AND' } = options;
    const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;

    // If filters are applied, we must do exact count
    if (filters.length > 0) {
      const { whereClause, params } = buildWhereClause(filters, filterLogic);
      let sql = `SELECT COUNT(*) as count FROM ${qualified}`;
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
      const countResult = await this.query<{ count: string }>(sql, params);
      return parseInt(countResult.rows[0]?.count ?? "0", 10);
    }

    // No filters: use pg_class.reltuples for fast estimate
    const estimateResult = await this.query<{ estimate: string }>(
      `SELECT c.reltuples::bigint as estimate
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2`,
      [schema, table]
    );

    const estimate = parseInt(estimateResult.rows[0]?.estimate ?? "-1", 10);

    if (estimate >= 0) {
      return estimate;
    }

    // Fallback to exact COUNT (slower for large tables)
    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${qualified}`
    );

    return parseInt(countResult.rows[0]?.count ?? "0", 10);
  }

  async runQuery(sql: string): Promise<QueryResultSet> {
    const result = await this.query(sql);
    return createResultSet(result);
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.query<{ size: string }>(
      `select pg_database_size(current_database()) as size`
    );
    return parseInt(result.rows[0]?.size ?? "0", 10);
  }

  async getDatabaseInfo(): Promise<{
    version: string;
    size: string;
    tableCount: number;
    schemaCount: number;
    uptime: string;
    maxConnections: number;
    activeConnections: number;
    databaseName: string;
    encoding: string;
  }> {
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

  async getRunningQueries(): Promise<Array<{
    pid: number;
    user: string;
    query: string;
    state: string;
    duration: string;
    waitEvent: string | null;
  }>> {
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

  private async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
    retryOnError = true
  ): Promise<QueryResult<T>> {
    try {
      const pool = this.pool ?? (this.pool = new Pool(this.config));
      const result = await pool.query<T>(text, params);

      // Mark as connected on successful query
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

        // Try to reconnect if this is a connection error and retry is allowed
        if (retryOnError && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log("[dbview] Attempting auto-reconnect...");
          const reconnected = await this.reconnect();

          if (reconnected) {
            console.log("[dbview] Retrying query after reconnect...");
            // Retry the query once after successful reconnect
            return this.query<T>(text, params, false);
          }
        }
      }

      throw error;
    }
  }

  /**
   * Check if an error is a connection-related error
   */
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

  // ============================================
  // Phase 2: CRUD Operations for Data Editing
  // ============================================

  /**
   * Get enhanced table metadata with all information needed for editing
   */
  async getTableMetadata(schema: string, table: string): Promise<import('@dbview/core').ColumnMetadata[]> {
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

  /**
   * Get indexes for a table
   */
  async getIndexes(schema: string, table: string): Promise<import('@dbview/core').TableIndex[]> {
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
      columns: row.columns,
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      definition: row.definition,
    }));
  }

  /**
   * Get table statistics
   */
  async getTableStatistics(schema: string, table: string): Promise<import('@dbview/core').TableStatistics> {
    // Get size information
    const sizeSql = `
      SELECT
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_relation_size(c.oid)) as table_size,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as indexes_size,
        (SELECT count(*) FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}) as row_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2;
    `;

    // Get vacuum/analyze stats
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

  /**
   * Get ER diagram data for specified schemas
   */
  async getERDiagramData(schemas: string[]): Promise<import('@dbview/core').ERDiagramData> {
    // Fetch all tables and their columns
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

    // Fetch all foreign key relationships
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

    // Group columns by table
    const tablesMap = new Map<string, import('@dbview/core').ERDiagramTable>();

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

    // Build relationships array
    const relationships: import('@dbview/core').ERDiagramRelationship[] = relationshipsResult.rows.map((row: any) => ({
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

  /**
   * Update a single cell value
   */
  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    const whereClause = Object.keys(primaryKey)
      .map((key, i) => `${quoteIdentifier(key)} = $${i + 1}`)
      .join(' AND ');

    const sql = `
      UPDATE ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
      SET ${quoteIdentifier(column)} = $${Object.keys(primaryKey).length + 1}
      WHERE ${whereClause}
    `;

    const params = [...Object.values(primaryKey), value];
    await this.query(sql, params);
  }

  /**
   * Insert a new row and return the inserted row with generated values
   */
  async insertRow(
    schema: string,
    table: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    console.log(`[PostgresClient] ========== INSERT ROW ==========`);
    console.log(`[PostgresClient] Schema: ${schema}`);
    console.log(`[PostgresClient] Table: ${table}`);
    console.log(`[PostgresClient] Values:`, values);

    const columns = Object.keys(values);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const sql = `
      INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
      (${columns.map(quoteIdentifier).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    console.log(`[PostgresClient] Generated SQL:`, sql.trim());
    console.log(`[PostgresClient] Parameters (${Object.values(values).length}):`, Object.values(values));

    const result = await this.query(sql, Object.values(values));

    console.log(`[PostgresClient] Query executed successfully`);
    console.log(`[PostgresClient] Rows returned: ${result.rows.length}`);
    console.log(`[PostgresClient] Inserted row:`, result.rows[0]);

    return result.rows[0] as Record<string, unknown>;
  }

  /**
   * Delete one or more rows by primary keys
   */
  async deleteRows(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[]
  ): Promise<number> {
    if (primaryKeys.length === 0) return 0;

    // Build WHERE clause for multiple rows
    const pkColumns = Object.keys(primaryKeys[0]);
    const conditions = primaryKeys.map((pk, i) => {
      const pkConditions = pkColumns.map((col, j) =>
        `${quoteIdentifier(col)} = $${i * pkColumns.length + j + 1}`
      ).join(' AND ');
      return `(${pkConditions})`;
    }).join(' OR ');

    const sql = `
      DELETE FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
      WHERE ${conditions}
    `;

    const params = primaryKeys.flatMap(pk => Object.values(pk));
    const result = await this.query(sql, params);
    return result.rowCount || 0;
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.pool) {
      console.log("[dbview] Disconnecting PostgresClient pool...");
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

  /**
   * Reset reconnect attempts counter (e.g., after manual reconnect)
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function buildWhereClause(
  filters: FilterCondition[],
  logic: 'AND' | 'OR'
): { whereClause: string; params: unknown[] } {
  if (!filters || filters.length === 0) {
    return { whereClause: '', params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const filter of filters) {
    // Skip incomplete filters
    if (!filter.columnName || !filter.operator) {
      continue;
    }

    const columnName = quoteIdentifier(filter.columnName);

    switch (filter.operator) {
      case 'equals':
        conditions.push(`${columnName} = $${paramIndex}`);
        params.push(filter.value);
        paramIndex++;
        break;

      case 'not_equals':
        conditions.push(`${columnName} != $${paramIndex}`);
        params.push(filter.value);
        paramIndex++;
        break;

      case 'contains':
        conditions.push(`${columnName}::text ILIKE $${paramIndex}`);
        params.push(`%${filter.value}%`);
        paramIndex++;
        break;

      case 'not_contains':
        conditions.push(`${columnName}::text NOT ILIKE $${paramIndex}`);
        params.push(`%${filter.value}%`);
        paramIndex++;
        break;

      case 'starts_with':
        conditions.push(`${columnName}::text ILIKE $${paramIndex}`);
        params.push(`${filter.value}%`);
        paramIndex++;
        break;

      case 'ends_with':
        conditions.push(`${columnName}::text ILIKE $${paramIndex}`);
        params.push(`%${filter.value}`);
        paramIndex++;
        break;

      case 'greater_than':
        conditions.push(`${columnName} > $${paramIndex}`);
        params.push(filter.value);
        paramIndex++;
        break;

      case 'less_than':
        conditions.push(`${columnName} < $${paramIndex}`);
        params.push(filter.value);
        paramIndex++;
        break;

      case 'greater_or_equal':
        conditions.push(`${columnName} >= $${paramIndex}`);
        params.push(filter.value);
        paramIndex++;
        break;

      case 'less_or_equal':
        conditions.push(`${columnName} <= $${paramIndex}`);
        params.push(filter.value);
        paramIndex++;
        break;

      case 'is_null':
        conditions.push(`${columnName} IS NULL`);
        break;

      case 'is_not_null':
        conditions.push(`${columnName} IS NOT NULL`);
        break;

      case 'between':
        if (filter.value2 !== undefined) {
          conditions.push(`${columnName} BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          params.push(filter.value, filter.value2);
          paramIndex += 2;
        }
        break;

      case 'in':
        // Assuming value is comma-separated string or array
        const values = Array.isArray(filter.value)
          ? filter.value
          : String(filter.value).split(',').map(v => v.trim());

        if (values.length > 0) {
          const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
          conditions.push(`${columnName} IN (${placeholders})`);
          params.push(...values);
          paramIndex += values.length;
        }
        break;
    }
  }

  if (conditions.length === 0) {
    return { whereClause: '', params: [] };
  }

  const whereClause = conditions.join(` ${logic} `);
  return { whereClause, params };
}

function createResultSet(result: QueryResult): QueryResultSet {
  const columns = result.fields.map((field) => field.name);
  return {
    columns,
    rows: result.rows as Record<string, unknown>[]
  };
}

function toPoolConfig(connection: ConnectionConfig): PoolConfig {
  // Handle SSL configuration
  let sslConfig: boolean | { rejectUnauthorized?: boolean; ca?: string; key?: string; cert?: string } | undefined;

  if (connection.ssl) {
    if (typeof connection.ssl === 'boolean') {
      // Simple SSL mode - use default SSL
      sslConfig = connection.ssl;
    } else {
      // Advanced SSL configuration
      sslConfig = {
        rejectUnauthorized: connection.ssl.rejectUnauthorized ?? true,
        ca: connection.ssl.ca,
        key: connection.ssl.key,
        cert: connection.ssl.cert
      };
    }
  }

  return {
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password ?? '',
    database: connection.database,
    ssl: sslConfig,
    // Connection timeout settings
    connectionTimeoutMillis: 10000,  // 10 seconds to establish connection
    idleTimeoutMillis: 30000,        // 30 seconds before idle connections are closed
    max: 10,                          // Maximum number of clients in the pool
    // Query timeout (optional - can be set per query if needed)
    statement_timeout: 60000         // 60 seconds max query time
  };
}

export async function testConnection(
  connection: ConnectionConfig
): Promise<{ success: boolean; message: string }> {
  const config = toPoolConfig(connection);
  const pool = new Pool(config);

  try {
    console.log("[dbview] Testing connection to:", {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user
    });

    // Test the connection with a simple query
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT version()");
      const version = result.rows[0]?.version;

      console.log("[dbview] Connection test successful:", version);

      // Extract PostgreSQL version number
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

    // Provide more helpful error messages
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
        message: `Cannot connect to ${connection.host}:${connection.port}. Is PostgreSQL running?`
      };
    } else if (errorMessage.includes("does not exist")) {
      return {
        success: false,
        message: `Database "${connection.database}" does not exist.`
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
