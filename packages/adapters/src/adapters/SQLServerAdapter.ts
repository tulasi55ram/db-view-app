import { EventEmitter } from 'events';
import * as sql from 'mssql';
import type { SQLServerConnectionConfig } from '@dbview/types';
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
  ExplainPlan,
  ERDiagramData,
  ERDiagramTable,
  ERDiagramRelationship,
  RunningQuery,
} from './DatabaseAdapter';
import { getDatabaseCapabilities } from '../capabilities/DatabaseCapabilities';

/**
 * SQL Server Database Adapter
 *
 * Key SQL Server differences:
 * - Square bracket quoting: [identifier] instead of "identifier"
 * - TOP instead of LIMIT for row limiting
 * - OFFSET/FETCH NEXT for pagination
 * - Windows and SQL Server authentication
 * - Named instances support
 * - System databases: master, tempdb, model, msdb
 * - INFORMATION_SCHEMA and sys schema for metadata
 */
export class SQLServerAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'sqlserver' as const;
  readonly capabilities = getDatabaseCapabilities('sqlserver');

  private pool: sql.ConnectionPool | undefined;
  private config: sql.config;
  private connectionConfig: SQLServerConnectionConfig;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: Error | undefined;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelayMs = 2000;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  constructor(config: SQLServerConnectionConfig) {
    super();
    this.connectionConfig = config;

    // Build SQL Server connection config
    const server = config.instanceName
      ? `${config.host}\\${config.instanceName}`
      : config.host;

    this.config = {
      server,
      port: config.port || 1433,
      database: config.database,
      options: {
        encrypt: config.encrypt !== false, // Default: true
        trustServerCertificate: config.trustServerCertificate !== false, // Default: true for local dev
        enableArithAbort: true,
        connectTimeout: 10000, // 10 seconds
        requestTimeout: 60000, // 60 seconds
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    // Authentication
    if (config.authenticationType === 'windows') {
      // Windows Authentication (NTLM)
      this.config.authentication = {
        type: 'ntlm',
        options: {
          domain: config.domain || '',
          userName: config.user || '',
          password: config.password || '',
        },
      };
    } else {
      // SQL Server Authentication
      this.config.user = config.user;
      this.config.password = config.password;
    }

    console.log('[SQLServerAdapter] Created with config:', {
      server,
      port: this.config.port,
      database: this.config.database,
      authType: config.authenticationType,
      hasPassword: !!config.password,
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
      console.log(`[SQLServerAdapter] Status changed: ${previousStatus} → ${status}${message ? ` (${message})` : ''}`);
      this.emit('statusChange', { status, message, error } as ConnectionStatusEvent);
    }
  }

  // ==================== Connection Management ====================

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const testPool = new sql.ConnectionPool(this.config);

    try {
      console.log('[SQLServerAdapter] Testing connection...');
      await testPool.connect();

      const result = await testPool.request().query('SELECT @@VERSION as version');
      const version = result.recordset[0]?.version;

      console.log('[SQLServerAdapter] Connection test successful:', version);

      const versionMatch = version?.match(/Microsoft SQL Server (\d+)/);
      const versionNumber = versionMatch ? versionMatch[1] : 'unknown';

      await testPool.close();

      return {
        success: true,
        message: `Connected successfully to SQL Server ${versionNumber}`,
      };
    } catch (error) {
      console.error('[SQLServerAdapter] Connection test failed:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Login failed')) {
        return {
          success: false,
          message: 'Authentication failed. Please check your username and password.',
        };
      } else if (errorMessage.includes('ECONNREFUSED')) {
        return {
          success: false,
          message: `Cannot connect to ${this.config.server}:${this.config.port}. Is SQL Server running?`,
        };
      } else if (errorMessage.includes('timeout')) {
        return {
          success: false,
          message: 'Connection timeout. Please check the server address and firewall settings.',
        };
      } else if (errorMessage.includes('Cannot open database')) {
        return {
          success: false,
          message: `Database "${this.config.database}" does not exist or you don't have permission.`,
        };
      } else {
        return {
          success: false,
          message: errorMessage,
        };
      }
    } finally {
      if (testPool.connected) {
        await testPool.close().catch(() => {});
      }
    }
  }

  async connect(): Promise<void> {
    try {
      this.setStatus('connecting', 'Establishing connection');

      // If pool already exists and is connected, just verify the connection
      if (this.pool?.connected && this._status === 'connected') {
        console.log('[SQLServerAdapter] Pool already connected, skipping reconnect');
        return;
      }

      // Close existing pool if any
      if (this.pool) {
        console.log('[SQLServerAdapter] Closing existing pool before reconnecting');
        await this.pool.close();
      }

      this.pool = new sql.ConnectionPool(this.config);

      // Add error handlers
      this.pool.on('error', (err) => {
        console.error('[SQLServerAdapter] Pool error:', err);
        this.setStatus('error', 'Pool error', err);
      });

      await this.pool.connect();

      // Test the connection
      await this.pool.request().query('SELECT 1');

      this.setStatus('connected', 'Connected successfully');
      this.reconnectAttempts = 0;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', 'Connection failed', err);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.pool) {
      console.log('[SQLServerAdapter] Disconnecting pool...');
      try {
        await this.pool.close();
        console.log('[SQLServerAdapter] Pool disconnected successfully');
      } catch (error) {
        console.error('[SQLServerAdapter] Error disconnecting pool:', error);
      }
      this.pool = undefined;
    }

    this.setStatus('disconnected', 'Disconnected');
    this.reconnectAttempts = 0;
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.pool || !this.pool.connected) {
        return false;
      }

      await this.pool.request().query('SELECT 1');

      if (this._status !== 'connected') {
        this.setStatus('connected', 'Health check passed');
        this.reconnectAttempts = 0;
      }
      return true;
    } catch (error) {
      console.error('[SQLServerAdapter] Health check failed:', error);
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
        console.error('[SQLServerAdapter] Health check error:', error);
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
      this.pool.close().catch(() => {});
      this.pool = undefined;
    }
  }

  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[SQLServerAdapter] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.setStatus('disconnected', 'Max reconnect attempts reached');
      return false;
    }

    this.reconnectAttempts++;
    this.setStatus('connecting', `Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      // Close existing pool
      if (this.pool) {
        await this.pool.close().catch(() => {});
        this.pool = undefined;
      }

      // Wait before reconnecting
      await new Promise((resolve) => setTimeout(resolve, this.reconnectDelayMs));

      // Create new pool and test connection
      this.pool = new sql.ConnectionPool(this.config);
      await this.pool.connect();
      await this.pool.request().query('SELECT 1');

      this.setStatus('connected', 'Reconnected successfully');
      this.reconnectAttempts = 0;
      return true;
    } catch (error) {
      console.error(`[SQLServerAdapter] Reconnect attempt ${this.reconnectAttempts} failed:`, error);
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error', 'Reconnect failed', err);
      return false;
    }
  }

  // ==================== Hierarchy & Discovery ====================

  async getHierarchy(): Promise<DatabaseHierarchy> {
    // SQL Server uses database -> schema -> table hierarchy
    return {
      type: 'schema-based',
      levels: ['database', 'schema', 'table'],
      systemSchemas: ['sys', 'INFORMATION_SCHEMA', 'guest'],
    };
  }

  async listDatabases(): Promise<string[]> {
    const result = await this.query<{ name: string }>(`
      SELECT name
      FROM sys.databases
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
        AND state_desc = 'ONLINE'
      ORDER BY name
    `);

    return result.recordset.map((row) => row.name);
  }

  async listSchemas(database?: string): Promise<string[]> {
    // SQL Server requires switching databases or using fully qualified names
    // For simplicity, list schemas from current database
    const result = await this.query<{ schema_name: string }>(`
      SELECT name as schema_name
      FROM sys.schemas
      WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin',
                         'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader',
                         'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
      ORDER BY name
    `);

    return result.recordset.map((row) => row.schema_name);
  }

  // ==================== Table Operations ====================

  async listTables(schema: string): Promise<TableInfo[]> {
    const result = await this.query<{
      table_name: string;
      total_bytes: number | null;
      row_count: number | null;
    }>(`
      SELECT
        t.TABLE_NAME as table_name,
        SUM(p.rows) as row_count,
        SUM(a.total_pages) * 8 * 1024 as total_bytes
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.tables st ON t.TABLE_NAME = st.name
      LEFT JOIN sys.indexes i ON st.object_id = i.object_id
      LEFT JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE t.TABLE_SCHEMA = @schema
        AND t.TABLE_TYPE = 'BASE TABLE'
      GROUP BY t.TABLE_NAME
      ORDER BY t.TABLE_NAME
    `, { schema });

    return result.recordset.map((row) => ({
      name: row.table_name,
      sizeBytes: row.total_bytes || undefined,
      rowCount: row.row_count || undefined,
    }));
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    const result = await this.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_primary_key: number;
      is_identity: number;
      is_computed: number;
    }>(`
      SELECT
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        c.IS_NULLABLE as is_nullable,
        c.COLUMN_DEFAULT as column_default,
        c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
        c.NUMERIC_PRECISION as numeric_precision,
        c.NUMERIC_SCALE as numeric_scale,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
        COLUMNPROPERTY(OBJECT_ID(@schema + '.' + @table), c.COLUMN_NAME, 'IsIdentity') as is_identity,
        COLUMNPROPERTY(OBJECT_ID(@schema + '.' + @table), c.COLUMN_NAME, 'IsComputed') as is_computed
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
          AND tc.TABLE_NAME = ku.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = @schema
          AND tc.TABLE_NAME = @table
      ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = @schema
        AND c.TABLE_NAME = @table
      ORDER BY c.ORDINAL_POSITION
    `, { schema, table });

    // Get foreign key information
    const fkMap = await this.getForeignKeyMap(schema, table);

    return result.recordset.map((row) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key === 1,
      isForeignKey: fkMap.has(row.column_name),
      foreignKeyRef: fkMap.get(row.column_name) || null,
      isAutoIncrement: row.is_identity === 1,
      isGenerated: row.is_computed === 1,
      maxLength: row.character_maximum_length || undefined,
      numericPrecision: row.numeric_precision || undefined,
      numericScale: row.numeric_scale || undefined,
      editable: row.is_primary_key !== 1 && row.is_identity !== 1 && row.is_computed !== 1,
    }));
  }

  /**
   * Get foreign key references for a table
   * Returns a map of column name to referenced schema.table.column
   */
  private async getForeignKeyMap(schema: string, table: string): Promise<Map<string, string>> {
    const result = await this.query<{
      column_name: string;
      referenced_schema: string;
      referenced_table: string;
      referenced_column: string;
    }>(`
      SELECT
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS column_name,
        OBJECT_SCHEMA_NAME(fc.referenced_object_id) AS referenced_schema,
        OBJECT_NAME(fc.referenced_object_id) AS referenced_table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS referenced_column
      FROM sys.foreign_key_columns fc
      JOIN sys.tables t ON fc.parent_object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = @schema
        AND t.name = @table
    `, { schema, table });

    const fkMap = new Map<string, string>();
    for (const row of result.recordset) {
      const ref = `${row.referenced_table}.${row.referenced_column}`;
      fkMap.set(row.column_name, ref);
    }

    return fkMap;
  }

  async fetchTableRows(schema: string, table: string, options: FetchOptions = {}): Promise<QueryResultSet> {
    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND', orderBy = [], sortColumn, sortDirection = 'ASC' } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    const { whereClause, params } = this.buildWhereClauseNamed(filters, filterLogic);

    // SQL Server pagination using OFFSET/FETCH NEXT (requires ORDER BY)
    let query = `SELECT * FROM ${qualified}`;
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    // SQL Server requires ORDER BY for OFFSET/FETCH
    // sortColumn takes precedence over orderBy
    let orderByClause: string;
    if (sortColumn) {
      orderByClause = `${this.quoteIdentifier(sortColumn)} ${sortDirection}`;
    } else if (orderBy.length > 0) {
      // Use provided orderBy columns
      orderByClause = orderBy.map(col => this.quoteIdentifier(col)).join(', ');
    } else {
      // Fall back to primary key or first column
      const metadata = await this.getTableMetadata(schema, table);
      const pkColumns = metadata.filter((col) => col.isPrimaryKey);
      orderByClause = pkColumns.length > 0
        ? this.quoteIdentifier(pkColumns[0].name)
        : this.quoteIdentifier(metadata[0]?.name || 'id');
    }

    query += ` ORDER BY ${orderByClause}`;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const request = this.pool!.request();

    // Add WHERE clause parameters
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    // Add pagination parameters
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const result = await request.query(query);
    return this.createResultSet(result);
  }

  async getTableRowCount(schema: string, table: string, options: FilterOptions = {}): Promise<number> {
    const { filters = [], filterLogic = 'AND' } = options;
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;

    const { whereClause, params } = this.buildWhereClauseNamed(filters, filterLogic);

    let query = `SELECT COUNT(*) as count FROM ${qualified}`;
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    const request = this.pool!.request();
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query<{ count: number }>(query);
    return result.recordset[0]?.count || 0;
  }

  async getActualRowCount(schema: string, table: string): Promise<number> {
    const qualified = `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`;
    const result = await this.query<{ count: number }>(`SELECT COUNT(*) as count FROM ${qualified}`);
    return result.recordset[0]?.count || 0;
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    const result = await this.query<{
      row_count: number;
      total_pages: number;
      used_pages: number;
      data_pages: number;
      last_update: Date | null;
    }>(`
      SELECT
        SUM(p.rows) as row_count,
        SUM(a.total_pages) as total_pages,
        SUM(a.used_pages) as used_pages,
        SUM(a.data_pages) as data_pages,
        MAX(s.last_user_update) as last_update
      FROM sys.tables t
      JOIN sys.schemas sc ON t.schema_id = sc.schema_id
      JOIN sys.indexes i ON t.object_id = i.object_id
      JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      JOIN sys.allocation_units a ON p.partition_id = a.container_id
      LEFT JOIN sys.dm_db_index_usage_stats s ON t.object_id = s.object_id
      WHERE sc.name = @schema
        AND t.name = @table
      GROUP BY sc.name, t.name
    `, { schema, table });

    const row = result.recordset[0];
    if (!row) {
      throw new Error(`Table ${schema}.${table} not found`);
    }

    const formatBytes = (pages: number): string => {
      const bytes = pages * 8 * 1024; // Each page is 8KB
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      rowCount: row.row_count || 0,
      totalSize: formatBytes(row.total_pages || 0),
      tableSize: formatBytes(row.data_pages || 0),
      indexesSize: formatBytes((row.total_pages || 0) - (row.data_pages || 0)),
      lastVacuum: null, // SQL Server doesn't have vacuum
      lastAnalyze: row.last_update ? row.last_update.toISOString() : null,
      lastAutoVacuum: null,
      lastAutoAnalyze: null,
    };
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      is_primary_key: boolean;
    }>(`
      SELECT
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        c.IS_NULLABLE as is_nullable,
        c.COLUMN_DEFAULT as column_default,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = @schema
          AND tc.TABLE_NAME = @table
      ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = @schema
        AND c.TABLE_NAME = @table
      ORDER BY c.ORDINAL_POSITION
    `, { schema, table });

    // Get foreign key information
    const fkMap = await this.getForeignKeyMap(schema, table);

    return result.recordset.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: fkMap.has(row.column_name),
      foreignKeyRef: fkMap.get(row.column_name) || null,
    }));
  }

  // ==================== Optional Objects ====================

  async listViews(schema: string): Promise<string[]> {
    const result = await this.query<{ table_name: string }>(`
      SELECT TABLE_NAME as table_name
      FROM INFORMATION_SCHEMA.VIEWS
      WHERE TABLE_SCHEMA = @schema
      ORDER BY TABLE_NAME
    `, { schema });

    return result.recordset.map((row) => row.table_name);
  }

  async listProcedures(schema: string): Promise<string[]> {
    const result = await this.query<{ routine_name: string }>(`
      SELECT ROUTINE_NAME as routine_name
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_SCHEMA = @schema
        AND ROUTINE_TYPE = 'PROCEDURE'
      ORDER BY ROUTINE_NAME
    `, { schema });

    return result.recordset.map((row) => row.routine_name);
  }

  async listFunctions(schema: string): Promise<string[]> {
    const result = await this.query<{ routine_name: string }>(`
      SELECT ROUTINE_NAME as routine_name
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_SCHEMA = @schema
        AND ROUTINE_TYPE = 'FUNCTION'
      ORDER BY ROUTINE_NAME
    `, { schema });

    return result.recordset.map((row) => row.routine_name);
  }

  async listTriggers(schema: string): Promise<string[]> {
    const result = await this.query<{ trigger_name: string }>(`
      SELECT tr.name as trigger_name
      FROM sys.triggers tr
      JOIN sys.tables t ON tr.parent_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = @schema
      ORDER BY tr.name
    `, { schema });

    return result.recordset.map((row) => row.trigger_name);
  }

  // ==================== Query Execution ====================

  async runQuery(sql: string): Promise<QueryResultSet> {
    const result = await this.pool!.request().query(sql);
    return this.createResultSet(result);
  }

  async explainQuery(querySQL: string): Promise<ExplainPlan> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }

    try {
      // SQL Server uses SET SHOWPLAN_XML to get execution plan without running the query
      const request = this.pool.request();

      // Enable SHOWPLAN_XML to get execution plan
      await request.query('SET SHOWPLAN_XML ON');

      try {
        // Get the execution plan (query is compiled but not executed)
        const result = await request.query(querySQL);

        // The XML plan is in the first column of the first row
        const xmlPlan = result.recordset?.[0]?.['Microsoft SQL Server 2005 XML Showplan'] ||
                        result.recordset?.[0]?.['XML_F52E2B61-18A1-11d1-B105-00805F49916B'] ||
                        (result.recordset?.[0] && Object.values(result.recordset[0])[0]);

        if (!xmlPlan || typeof xmlPlan !== 'string') {
          throw new Error('Failed to retrieve execution plan');
        }

        // Parse the XML to extract relevant information
        const planInfo = this.parseExecutionPlanXML(xmlPlan);

        return planInfo;
      } finally {
        // Always turn off SHOWPLAN_XML
        await this.pool.request().query('SET SHOWPLAN_XML OFF');
      }
    } catch (error) {
      console.error('[SQLServerAdapter] Error getting execution plan:', error);

      // Return a minimal plan with error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        Plan: {
          'Node Type': 'Error',
          'Startup Cost': 0,
          'Total Cost': 0,
          'Plan Rows': 0,
          'Plan Width': 0,
          'Error': errorMessage,
        },
        'Planning Time': 0,
        'Execution Time': 0,
      };
    }
  }

  /**
   * Parse SQL Server XML execution plan and convert to ExplainPlan format
   */
  private parseExecutionPlanXML(xmlPlan: string): ExplainPlan {
    // Extract key metrics from the XML plan using regex (avoiding XML parser dependency)
    // This is a simplified parser - a full implementation would use an XML parser

    // Extract estimated cost
    const costMatch = xmlPlan.match(/StatementSubTreeCost="([^"]+)"/);
    const totalCost = costMatch ? parseFloat(costMatch[1]) : 0;

    // Extract estimated rows
    const rowsMatch = xmlPlan.match(/EstimateRows="([^"]+)"/);
    const planRows = rowsMatch ? parseFloat(rowsMatch[1]) : 0;

    // Extract operation type from the first RelOp
    const opMatch = xmlPlan.match(/PhysicalOp="([^"]+)"/);
    const nodeType = opMatch ? opMatch[1] : 'Query Plan';

    // Extract logical operation
    const logicalOpMatch = xmlPlan.match(/LogicalOp="([^"]+)"/);
    const logicalOp = logicalOpMatch ? logicalOpMatch[1] : undefined;

    // Extract CPU and I/O costs
    const cpuMatch = xmlPlan.match(/EstimateCPU="([^"]+)"/);
    const ioMatch = xmlPlan.match(/EstimateIO="([^"]+)"/);
    const cpuCost = cpuMatch ? parseFloat(cpuMatch[1]) : 0;
    const ioCost = ioMatch ? parseFloat(ioMatch[1]) : 0;

    // Extract compile time if available
    const compileTimeMatch = xmlPlan.match(/CompileTime="([^"]+)"/);
    const compileTime = compileTimeMatch ? parseInt(compileTimeMatch[1]) : 0;

    // Extract memory grant if available
    const memoryGrantMatch = xmlPlan.match(/SerialDesiredMemory="([^"]+)"/);
    const memoryGrant = memoryGrantMatch ? parseInt(memoryGrantMatch[1]) : undefined;

    // Build the plan object
    const plan: ExplainPlan = {
      Plan: {
        'Node Type': nodeType,
        'Startup Cost': cpuCost,
        'Total Cost': totalCost,
        'Plan Rows': Math.round(planRows),
        'Plan Width': 0, // SQL Server doesn't have this concept
        ...(logicalOp && { 'Logical Operation': logicalOp }),
        ...(ioCost > 0 && { 'I/O Cost': ioCost }),
        ...(memoryGrant && { 'Memory Grant (KB)': memoryGrant }),
      },
      'Planning Time': compileTime,
      'Execution Time': 0, // SHOWPLAN_XML doesn't execute the query
    };

    return plan;
  }

  // ==================== CRUD Operations ====================

  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    const whereConditions = Object.keys(primaryKey)
      .map((key) => `${this.quoteIdentifier(key)} = @pk_${key}`)
      .join(' AND ');

    const query = `
      UPDATE ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      SET ${this.quoteIdentifier(column)} = @value
      WHERE ${whereConditions}
    `;

    const request = this.pool!.request();
    request.input('value', value);
    Object.entries(primaryKey).forEach(([key, val]) => {
      request.input(`pk_${key}`, val);
    });

    await request.query(query);
  }

  async insertRow(
    schema: string,
    table: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const columns = Object.keys(values);
    const columnList = columns.map((col) => this.quoteIdentifier(col)).join(', ');
    const paramList = columns.map((col) => `@${col}`).join(', ');

    const query = `
      INSERT INTO ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      (${columnList})
      OUTPUT INSERTED.*
      VALUES (${paramList})
    `;

    const request = this.pool!.request();
    Object.entries(values).forEach(([key, val]) => {
      request.input(key, val);
    });

    const result = await request.query(query);
    return result.recordset[0] as Record<string, unknown>;
  }

  async deleteRows(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[]
  ): Promise<number> {
    if (primaryKeys.length === 0) return 0;

    const pkColumns = Object.keys(primaryKeys[0]);
    const conditions = primaryKeys
      .map((_, i) => {
        const pkConditions = pkColumns
          .map((col) => `${this.quoteIdentifier(col)} = @pk_${i}_${col}`)
          .join(' AND ');
        return `(${pkConditions})`;
      })
      .join(' OR ');

    const query = `
      DELETE FROM ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}
      WHERE ${conditions}
    `;

    const request = this.pool!.request();
    primaryKeys.forEach((pk, i) => {
      Object.entries(pk).forEach(([key, val]) => {
        request.input(`pk_${i}_${key}`, val);
      });
    });

    const result = await request.query(query);
    return result.rowsAffected[0] || 0;
  }

  // ==================== Metadata ====================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const [versionResult, sizeResult, connResult] = await Promise.all([
      this.query<{ version: string }>('SELECT @@VERSION as version'),
      this.query<{ size_mb: number }>(`
        SELECT SUM(size) * 8 / 1024 as size_mb
        FROM sys.master_files
        WHERE database_id = DB_ID()
      `),
      this.query<{ connection_count: number }>(`
        SELECT COUNT(*) as connection_count
        FROM sys.dm_exec_sessions
        WHERE database_id = DB_ID()
      `),
    ]);

    const tableCountResult = await this.query<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);

    const schemaCountResult = await this.query<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM sys.schemas
      WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
    `);

    return {
      version: versionResult.recordset[0]?.version || 'Unknown',
      databaseName: this.config.database || 'Unknown',
      size: `${sizeResult.recordset[0]?.size_mb || 0} MB`,
      tableCount: tableCountResult.recordset[0]?.count || 0,
      schemaCount: schemaCountResult.recordset[0]?.count || 0,
      activeConnections: connResult.recordset[0]?.connection_count || 0,
      encoding: 'UTF-8',
    };
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.query<{ size_bytes: number }>(`
      SELECT SUM(size) * 8 * 1024 as size_bytes
      FROM sys.master_files
      WHERE database_id = DB_ID()
    `);

    return result.recordset[0]?.size_bytes || 0;
  }

  async getObjectCounts(schema: string): Promise<ObjectCounts> {
    const [tables, views, procedures, functions] = await Promise.all([
      this.query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = @schema AND TABLE_TYPE = 'BASE TABLE'
      `, { schema }),
      this.query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.VIEWS
        WHERE TABLE_SCHEMA = @schema
      `, { schema }),
      this.query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_SCHEMA = @schema AND ROUTINE_TYPE = 'PROCEDURE'
      `, { schema }),
      this.query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_SCHEMA = @schema AND ROUTINE_TYPE = 'FUNCTION'
      `, { schema }),
    ]);

    return {
      tables: tables.recordset[0]?.count || 0,
      views: views.recordset[0]?.count || 0,
      materializedViews: 0, // SQL Server doesn't have materialized views
      functions: functions.recordset[0]?.count || 0,
      procedures: procedures.recordset[0]?.count || 0,
      types: 0,
    };
  }

  async getRunningQueries(): Promise<RunningQuery[]> {
    const result = await this.query<{
      session_id: number;
      login_name: string;
      query_text: string;
      status: string;
      duration_ms: number;
      wait_type: string | null;
    }>(`
      SELECT
        s.session_id,
        s.login_name,
        LEFT(t.text, 200) as query_text,
        r.status,
        r.total_elapsed_time as duration_ms,
        r.wait_type
      FROM sys.dm_exec_sessions s
      LEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id
      OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
      WHERE s.session_id != @@SPID
        AND s.is_user_process = 1
      ORDER BY r.total_elapsed_time DESC
    `);

    return result.recordset.map((row) => ({
      pid: row.session_id,
      user: row.login_name,
      query: row.query_text || '',
      state: row.status || 'sleeping',
      duration: row.duration_ms ? `${Math.floor(row.duration_ms / 1000)}s` : '-',
      waitEvent: row.wait_type,
    }));
  }

  async getIndexes(schema: string, table: string): Promise<TableIndex[]> {
    const result = await this.query<{
      index_name: string;
      index_type: string;
      is_unique: boolean;
      is_primary: boolean;
      columns: string;
    }>(`
      SELECT
        i.name as index_name,
        i.type_desc as index_type,
        i.is_unique as is_unique,
        i.is_primary_key as is_primary,
        STRING_AGG(c.name, ', ') as columns
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE s.name = @schema AND t.name = @table
      GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key
      ORDER BY i.name
    `, { schema, table });

    return result.recordset.map((row) => ({
      name: row.index_name,
      type: row.index_type.toLowerCase(),
      columns: row.columns.split(', '),
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      definition: `${row.index_type} INDEX`,
    }));
  }

  // ==================== SQL Helpers ====================

  quoteIdentifier(identifier: string): string {
    return `[${identifier.replace(/]/g, ']]')}]`;
  }

  formatParameter(index: number): string {
    return `@param${index}`;
  }

  /**
   * Build WHERE clause with named parameters (SQL Server specific)
   * @private
   */
  private buildWhereClauseNamed(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: Record<string, unknown> } {
    if (!filters || filters.length === 0) {
      return { whereClause: '', params: {} };
    }

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};
    let paramIndex = 0;

    for (const filter of filters) {
      if (!filter.columnName || !filter.operator) {
        continue;
      }

      const columnName = this.quoteIdentifier(filter.columnName);
      const paramName = `filter${paramIndex}`;

      switch (filter.operator) {
        case 'equals':
          conditions.push(`${columnName} = @${paramName}`);
          params[paramName] = filter.value;
          paramIndex++;
          break;

        case 'not_equals':
          conditions.push(`${columnName} != @${paramName}`);
          params[paramName] = filter.value;
          paramIndex++;
          break;

        case 'contains':
          conditions.push(`${columnName} LIKE @${paramName}`);
          params[paramName] = `%${filter.value}%`;
          paramIndex++;
          break;

        case 'not_contains':
          conditions.push(`${columnName} NOT LIKE @${paramName}`);
          params[paramName] = `%${filter.value}%`;
          paramIndex++;
          break;

        case 'starts_with':
          conditions.push(`${columnName} LIKE @${paramName}`);
          params[paramName] = `${filter.value}%`;
          paramIndex++;
          break;

        case 'ends_with':
          conditions.push(`${columnName} LIKE @${paramName}`);
          params[paramName] = `%${filter.value}`;
          paramIndex++;
          break;

        case 'greater_than':
          conditions.push(`${columnName} > @${paramName}`);
          params[paramName] = filter.value;
          paramIndex++;
          break;

        case 'less_than':
          conditions.push(`${columnName} < @${paramName}`);
          params[paramName] = filter.value;
          paramIndex++;
          break;

        case 'greater_or_equal':
          conditions.push(`${columnName} >= @${paramName}`);
          params[paramName] = filter.value;
          paramIndex++;
          break;

        case 'less_or_equal':
          conditions.push(`${columnName} <= @${paramName}`);
          params[paramName] = filter.value;
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
            conditions.push(`${columnName} BETWEEN @${paramName} AND @${paramName}_2`);
            params[paramName] = filter.value;
            params[`${paramName}_2`] = filter.value2;
            paramIndex++;
          }
          break;

        case 'in':
          // Filter out empty strings to avoid IN ('') which returns no results
          const values = (Array.isArray(filter.value)
            ? filter.value.map((v: unknown) => String(v).trim())
            : String(filter.value).split(',').map((v: string) => v.trim())
          ).filter((v: string) => v !== '');

          if (values.length > 0) {
            const placeholders = values.map((_: string, i: number) => `@${paramName}_${i}`).join(', ');
            conditions.push(`${columnName} IN (${placeholders})`);
            values.forEach((val: string, i: number) => {
              params[`${paramName}_${i}`] = val;
            });
            paramIndex++;
          }
          // Skip adding clause if no valid values (treats as "no filter")
          break;
      }
    }

    if (conditions.length === 0) {
      return { whereClause: '', params: {} };
    }

    const whereClause = conditions.join(` ${logic} `);
    return { whereClause, params };
  }

  /**
   * Build WHERE clause - public interface implementation
   * Converts to array format for interface compatibility
   */
  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] } {
    const { whereClause, params: namedParams } = this.buildWhereClauseNamed(filters, logic);
    // Convert named params to array (though SQL Server doesn't use this format internally)
    return { whereClause, params: Object.values(namedParams) };
  }

  // ==================== Private Helper Methods ====================

  private async query<T = any>(sqlQuery: string, params?: Record<string, unknown>): Promise<sql.IResult<T>> {
    if (!this.pool || !this.pool.connected) {
      throw new Error('Not connected to SQL Server database');
    }

    try {
      const request = this.pool.request();

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          request.input(key, value);
        });
      }

      const result = await request.query<T>(sqlQuery);

      if (this._status !== 'connected') {
        this.setStatus('connected', 'Query executed successfully');
        this.reconnectAttempts = 0;
      }

      return result;
    } catch (error) {
      console.error('[SQLServerAdapter] Query failed:', error);

      const err = error instanceof Error ? error : new Error(String(error));
      const isConnectionError = this.isConnectionError(err);

      if (isConnectionError) {
        this.setStatus('error', 'Connection lost', err);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log('[SQLServerAdapter] Attempting auto-reconnect...');
          const reconnected = await this.reconnect();

          if (reconnected) {
            console.log('[SQLServerAdapter] Retrying query after reconnect...');
            return this.query<T>(sqlQuery, params);
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
      'Connection lost',
      'Connection closed',
      'socket hang up',
      'Connection is closed',
    ];

    const errorMessage = error.message.toLowerCase();
    return connectionErrorPatterns.some((pattern) => errorMessage.includes(pattern.toLowerCase()));
  }

  private createResultSet(result: sql.IResult<Record<string, unknown>>): QueryResultSet {
    const columns = result.recordset.columns
      ? Object.keys(result.recordset.columns)
      : result.recordset.length > 0
        ? Object.keys(result.recordset[0])
        : [];

    // For non-SELECT queries (INSERT/UPDATE/DELETE), return affected rows
    if (columns.length === 0 && result.rowsAffected && result.rowsAffected.length > 0) {
      const totalAffected = result.rowsAffected.reduce((sum, count) => sum + count, 0);
      return {
        columns: ['command', 'affected_rows'],
        rows: [{
          command: 'COMMAND',
          affected_rows: totalAffected
        }]
      };
    }

    return {
      columns,
      rows: result.recordset as Record<string, unknown>[],
    };
  }
}
