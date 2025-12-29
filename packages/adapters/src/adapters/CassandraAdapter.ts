import { EventEmitter } from 'events';
import type { CassandraConnectionConfig, CassandraConsistency } from '@dbview/types';
import type {
  DatabaseAdapter,
  ConnectionStatus,
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
  FetchOptions,
  FilterCondition,
  FilterOptions,
  DatabaseCapabilities,
  DatabaseHierarchy,
  CursorPosition,
  CursorResultSet,
  BulkOperationResult,
  BulkInsertOptions,
  BulkUpdateItem,
  BulkUpdateOptions,
  BulkDeleteOptions,
} from './DatabaseAdapter';

// Dynamic import for cassandra-driver to handle optional dependency
let cassandraDriver: typeof import('cassandra-driver') | null = null;
try {
  cassandraDriver = require('cassandra-driver');
} catch {
  // cassandra-driver not installed - will throw on first use
}

// Helper to get cassandra-driver or throw error
function getDriver(): typeof import('cassandra-driver') {
  if (!cassandraDriver) {
    throw new Error('cassandra-driver is not installed. Run: npm install cassandra-driver');
  }
  return cassandraDriver;
}

// Type definitions for cassandra-driver (for internal use when driver not available at compile time)
interface CassandraResultSet {
  rows: CassandraRow[];
  columns?: Array<{ name: string }>;
}

interface CassandraRow {
  [key: string]: unknown;
}

/**
 * Apache Cassandra Adapter
 *
 * Implements the DatabaseAdapter interface for Apache Cassandra databases.
 * Maps Cassandra concepts to the unified interface:
 * - Keyspaces → Databases (shown via listDatabases)
 * - Tables → Tables
 * - Rows → Rows (with partition and clustering keys)
 * - Columns → Columns
 *
 * Key Cassandra characteristics:
 * - Uses CQL (Cassandra Query Language), similar to SQL but not identical
 * - Designed for distributed, high-availability deployments
 * - Partition keys determine data distribution across nodes
 * - Clustering keys sort data within partitions
 * - No JOINs or foreign keys
 * - Tunable consistency levels
 *
 * Best practices implemented:
 * - Single Client instance reused for all operations
 * - Prepared statements for better performance
 * - Token-aware routing via localDatacenter
 * - Proper error handling with reconnection support
 */
export class CassandraAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'cassandra' as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private error: Error | undefined;
  private readonly connectionConfig: CassandraConnectionConfig;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private preparedStatements: Map<string, unknown> = new Map();

  readonly capabilities: DatabaseCapabilities = {
    // Hierarchy
    supportsSchemas: false, // Cassandra uses keyspaces, not schemas
    supportsDatabases: true, // Keyspaces are like databases
    supportsInstances: false,

    // Objects
    supportsTables: true,
    supportsViews: true, // Cassandra 3.0+ has materialized views
    supportsMaterializedViews: true,
    supportsFunctions: true, // User-defined functions
    supportsProcedures: false,
    supportsTypes: true, // User-defined types
    supportsIndexes: true, // Secondary indexes
    supportsTriggers: true,

    // Features
    supportsSQL: false, // Uses CQL (similar but not SQL)
    supportsExplainPlan: true, // TRACING
    supportsForeignKeys: false, // No foreign keys
    supportsJSON: true, // Native JSON support
    supportsArrays: true, // Lists, Sets, Maps
    supportsTransactions: false, // Only lightweight transactions (LWT)

    // Authentication
    supportsWindowsAuth: false,
    supportsSSL: true,

    // Connection
    supportsConnectionPooling: true,
    supportsHealthChecks: true,

    // Special characteristics
    isNoSQL: true,
    isFileBased: false,
    requiresServer: true,
  };

  constructor(config: CassandraConnectionConfig) {
    super();
    this.connectionConfig = config;
  }

  get status(): ConnectionStatus {
    return this.connectionStatus;
  }

  get lastError(): Error | undefined {
    return this.error;
  }

  // ==================== Connection Management ====================

  /**
   * Map consistency level string to Cassandra driver constant
   */
  private getConsistencyLevel(level?: CassandraConsistency): number {
    const driver = getDriver();
    const { types } = driver;
    const consistencyMap: Record<CassandraConsistency, number> = {
      any: types.consistencies.any,
      one: types.consistencies.one,
      two: types.consistencies.two,
      three: types.consistencies.three,
      quorum: types.consistencies.quorum,
      all: types.consistencies.all,
      localQuorum: types.consistencies.localQuorum,
      eachQuorum: types.consistencies.eachQuorum,
      serial: types.consistencies.serial,
      localSerial: types.consistencies.localSerial,
      localOne: types.consistencies.localOne,
    };
    return consistencyMap[level || 'localQuorum'] || types.consistencies.localQuorum;
  }

  /**
   * Build client configuration from connection config
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildClientConfig(): any {
    const driver = getDriver();
    const { types, policies, auth } = driver;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      contactPoints: this.connectionConfig.contactPoints,
      localDataCenter: this.connectionConfig.localDatacenter,
      keyspace: this.connectionConfig.keyspace,
      protocolOptions: {
        port: this.connectionConfig.port || 9042,
      },
      socketOptions: {
        connectTimeout: this.connectionConfig.connectTimeout || 5000,
        readTimeout: this.connectionConfig.requestTimeout || 12000,
      },
      queryOptions: {
        consistency: this.getConsistencyLevel(this.connectionConfig.consistency),
        prepare: true, // Always use prepared statements for performance
      },
      pooling: {
        coreConnectionsPerHost: {
          [types.distance.local]: this.connectionConfig.poolSize || 2,
          [types.distance.remote]: 1,
        },
      },
      policies: {
        loadBalancing: new policies.loadBalancing.TokenAwarePolicy(
          new policies.loadBalancing.DCAwareRoundRobinPolicy(this.connectionConfig.localDatacenter)
        ),
        retry: new policies.retry.RetryPolicy(),
        reconnection: new policies.reconnection.ExponentialReconnectionPolicy(1000, 10 * 60 * 1000),
      },
    };

    // Authentication
    if (this.connectionConfig.username && this.connectionConfig.password) {
      config.authProvider = new auth.PlainTextAuthProvider(
        this.connectionConfig.username,
        this.connectionConfig.password
      );
    }

    // SSL/TLS
    if (this.connectionConfig.ssl) {
      config.sslOptions = this.connectionConfig.sslOptions || {
        rejectUnauthorized: true,
      };
    }

    return config;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const driver = getDriver();
    const { Client } = driver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let testClient: any;
    try {
      testClient = new Client({
        ...this.buildClientConfig(),
        socketOptions: {
          connectTimeout: 5000,
          readTimeout: 5000,
        },
      });

      await testClient.connect();

      // Verify we can query the system keyspace
      const result = await testClient.execute('SELECT release_version FROM system.local');
      const version = result.rows[0]?.release_version || 'unknown';

      return {
        success: true,
        message: `Successfully connected to Cassandra cluster (version ${version})`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      if (testClient) {
        await testClient.shutdown().catch(() => {});
      }
    }
  }

  async connect(): Promise<void> {
    try {
      this.connectionStatus = 'connecting';
      this.emit('statusChange', { status: 'connecting' });

      const driver = getDriver();
      const { Client } = driver;
      this.client = new Client(this.buildClientConfig());

      await this.client.connect();

      // Verify connection by querying system table
      await this.client.execute('SELECT release_version FROM system.local');

      this.connectionStatus = 'connected';
      this.error = undefined;
      this.emit('statusChange', { status: 'connected' });
    } catch (error) {
      this.connectionStatus = 'error';
      this.error = error instanceof Error ? error : new Error(String(error));
      this.emit('statusChange', {
        status: 'error',
        error: this.error,
        message: this.error.message,
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    this.preparedStatements.clear();

    if (this.client) {
      await this.client.shutdown();
      this.client = undefined;
    }

    this.connectionStatus = 'disconnected';
    this.emit('statusChange', { status: 'disconnected' });
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.execute('SELECT key FROM system.local WHERE key = \'local\'');
      return true;
    } catch (error) {
      return false;
    }
  }

  startHealthCheck(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      const isAlive = await this.ping();
      if (!isAlive && this.connectionStatus === 'connected') {
        this.connectionStatus = 'error';
        this.emit('statusChange', {
          status: 'error',
          message: 'Health check failed',
        });
      }
    }, 30000); // Check every 30 seconds
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  async reconnect(): Promise<boolean> {
    try {
      await this.disconnect();
      await this.connect();
      return true;
    } catch (error) {
      return false;
    }
  }

  dispose(): void {
    this.stopHealthCheck();
    this.preparedStatements.clear();
    this.removeAllListeners();
    if (this.client) {
      this.client.shutdown().catch(() => {});
      this.client = undefined;
    }
  }

  // ==================== Hierarchy & Discovery ====================

  async getHierarchy(): Promise<DatabaseHierarchy> {
    return {
      type: 'database-based' as const,
      levels: ['keyspace', 'table'],
      systemSchemas: ['system', 'system_auth', 'system_distributed', 'system_schema', 'system_traces', 'system_views'],
    };
  }

  async listSchemas(): Promise<string[]> {
    // Cassandra doesn't have schemas, keyspaces are the top level
    return [];
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const result = await this.client.execute(
      'SELECT keyspace_name FROM system_schema.keyspaces'
    );

    const systemKeyspaces = ['system', 'system_auth', 'system_distributed', 'system_schema', 'system_traces', 'system_views'];

    return result.rows
      .map((row: CassandraRow) => row.keyspace_name as string)
      .filter((name: string) => !systemKeyspaces.includes(name));
  }

  // ==================== Table Operations ====================

  async listTables(schema?: string): Promise<TableInfo[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    const result = await this.client.execute(
      'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    const tableInfos: TableInfo[] = [];

    for (const row of result.rows) {
      const tableName = row.table_name;

      // Get table size estimation (not exact due to Cassandra's distributed nature)
      try {
        const countResult = await this.client.execute(
          `SELECT COUNT(*) as count FROM ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(tableName)}`,
          [],
          { prepare: true, fetchSize: 1 }
        );
        tableInfos.push({
          name: tableName,
          rowCount: Number(countResult.rows[0]?.count || 0),
          sizeBytes: 0, // Cassandra doesn't provide table size easily
        });
      } catch (error) {
        // If count fails (e.g., timeout on large tables), still add the table
        tableInfos.push({
          name: tableName,
          rowCount: undefined,
          sizeBytes: 0,
        });
      }
    }

    return tableInfos;
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    // Get column information from system_schema.columns
    const columnsResult = await this.client.execute(
      `SELECT column_name, type, kind, position, clustering_order
       FROM system_schema.columns
       WHERE keyspace_name = ? AND table_name = ?`,
      [keyspace, table],
      { prepare: true }
    );

    // Get partition key and clustering key info
    const partitionKeys = new Set<string>();
    const clusteringKeys = new Set<string>();

    for (const row of columnsResult.rows) {
      if (row.kind === 'partition_key') {
        partitionKeys.add(row.column_name);
      } else if (row.kind === 'clustering') {
        clusteringKeys.add(row.column_name);
      }
    }

    const columns: ColumnMetadata[] = columnsResult.rows.map((row: CassandraRow) => {
      const columnName = row.column_name as string;
      const columnType = row.type as string;
      const isPartitionKey = partitionKeys.has(columnName);
      const isClusteringKey = clusteringKeys.has(columnName);
      const isPrimaryKey = isPartitionKey || isClusteringKey;

      // Determine key kind for wide-column model visualization
      const keyKind: 'partition' | 'clustering' | 'regular' = isPartitionKey
        ? 'partition'
        : isClusteringKey
        ? 'clustering'
        : 'regular';

      return {
        name: columnName,
        type: this.formatCassandraType(columnType),
        nullable: !isPrimaryKey, // Primary key columns are not nullable
        defaultValue: null, // Cassandra doesn't have default values
        isPrimaryKey,
        isForeignKey: false, // Cassandra doesn't have foreign keys
        foreignKeyRef: null,
        isAutoIncrement: false, // Cassandra doesn't have auto-increment
        isGenerated: false,
        editable: !isPartitionKey, // Partition keys can't be updated
        sortable: true,
        keyKind, // For Cassandra wide-column visualization
      };
    });

    // Sort: partition keys first, then clustering keys, then regular columns
    return columns.sort((a, b) => {
      const aScore = partitionKeys.has(a.name) ? 0 : clusteringKeys.has(a.name) ? 1 : 2;
      const bScore = partitionKeys.has(b.name) ? 0 : clusteringKeys.has(b.name) ? 1 : 2;
      return aScore - bScore;
    });
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const metadata = await this.getTableMetadata(schema, table);

    return metadata.map((col) => ({
      name: col.name,
      dataType: col.type,
      isNullable: col.nullable,
      defaultValue: col.defaultValue,
      isPrimaryKey: col.isPrimaryKey,
      isForeignKey: col.isForeignKey,
      foreignKeyRef: col.foreignKeyRef,
    }));
  }

  async fetchTableRows(
    schema: string,
    table: string,
    options: FetchOptions = {}
  ): Promise<QueryResultSet> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND', sortColumn, sortDirection = 'ASC' } = options;
    const keyspace = schema || this.connectionConfig.keyspace;

    // Build CQL query
    let cql = `SELECT * FROM ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}`;
    const params: unknown[] = [];

    // Add WHERE clause for filters
    if (filters.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        cql += ` WHERE ${whereClause} ALLOW FILTERING`;
        params.push(...whereParams);
      }
    }

    // Note: Cassandra doesn't support OFFSET natively
    // We use paging internally but present it as offset/limit to the interface
    cql += ` LIMIT ?`;
    params.push(limit + offset);

    const result = await this.client.execute(cql, params, {
      prepare: true,
      fetchSize: limit + offset,
    });

    // Skip the offset rows and take limit rows
    const allRows = result.rows.map((row: CassandraRow) => this.convertRow(row));
    const rows = allRows.slice(offset, offset + limit);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : await this.getColumnNames(keyspace, table);

    return {
      columns,
      rows,
      limitApplied: true,
      limit,
      hasMore: result.rows.length > offset + limit,
    };
  }

  async getTableRowCount(schema: string, table: string, options: FilterOptions = {}): Promise<number> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const { filters = [], filterLogic = 'AND' } = options;
    const keyspace = schema || this.connectionConfig.keyspace;

    let cql = `SELECT COUNT(*) as count FROM ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}`;
    const params: unknown[] = [];

    if (filters.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        cql += ` WHERE ${whereClause} ALLOW FILTERING`;
        params.push(...whereParams);
      }
    }

    const result = await this.client.execute(cql, params, { prepare: true });
    return Number(result.rows[0]?.count || 0);
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    // Get row count (approximate for large tables)
    let rowCount = 0;
    try {
      const countResult = await this.client.execute(
        `SELECT COUNT(*) as count FROM ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}`,
        [],
        { prepare: true }
      );
      rowCount = Number(countResult.rows[0]?.count || 0);
    } catch (error) {
      // Count may timeout on very large tables
    }

    // Cassandra doesn't easily provide table size through CQL
    // Would need nodetool or JMX for accurate sizes
    return {
      rowCount,
      totalSize: 'N/A', // Would require nodetool tablestats
      tableSize: 'N/A',
      indexesSize: 'N/A',
      lastVacuum: null,
      lastAnalyze: null,
      lastAutoVacuum: null,
      lastAutoAnalyze: null,
    };
  }

  // ==================== Query Execution ====================

  async runQuery(cql: string): Promise<QueryResultSet> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    // Check for read-only mode
    if (this.connectionConfig.readOnly) {
      const upperCql = cql.trim().toUpperCase();
      if (upperCql.startsWith('INSERT') ||
          upperCql.startsWith('UPDATE') ||
          upperCql.startsWith('DELETE') ||
          upperCql.startsWith('DROP') ||
          upperCql.startsWith('TRUNCATE') ||
          upperCql.startsWith('ALTER') ||
          upperCql.startsWith('CREATE')) {
        throw new Error('Cannot execute write operations in read-only mode');
      }
    }

    const result = await this.client.execute(cql, [], { prepare: false });

    if (!result.rows || result.rows.length === 0) {
      return {
        columns: result.columns?.map((c: { name: string }) => c.name) || [],
        rows: [],
      };
    }

    const rows = result.rows.map((row: CassandraRow) => this.convertRow(row));
    const columns = Object.keys(rows[0]);

    return { columns, rows };
  }

  async explainQuery(cql: string): Promise<any> {
    // Cassandra uses TRACING for query analysis
    // This would require enabling tracing and then querying system_traces
    throw new Error('Use CQL TRACING ON/OFF for query analysis in Cassandra');
  }

  // ==================== CRUD Operations ====================

  async insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot insert: Connection is in read-only mode');
    }

    const keyspace = schema || this.connectionConfig.keyspace;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const cql = `INSERT INTO ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}
                 (${columns.map((c) => this.quoteIdentifier(c)).join(', ')})
                 VALUES (${placeholders})`;

    await this.client.execute(cql, values, { prepare: true });

    // Cassandra doesn't return the inserted row, return what was provided
    return data;
  }

  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot update: Connection is in read-only mode');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    // Build WHERE clause from primary key
    const pkColumns = Object.keys(primaryKey);
    const pkValues = Object.values(primaryKey);
    const whereClause = pkColumns.map((col) => `${this.quoteIdentifier(col)} = ?`).join(' AND ');

    const cql = `UPDATE ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}
                 SET ${this.quoteIdentifier(column)} = ?
                 WHERE ${whereClause}`;

    await this.client.execute(cql, [value, ...pkValues], { prepare: true });
  }

  async deleteRows(schema: string, table: string, primaryKeys: Record<string, unknown>[]): Promise<number> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot delete: Connection is in read-only mode');
    }

    if (primaryKeys.length === 0) {
      return 0;
    }

    const keyspace = schema || this.connectionConfig.keyspace;
    let deletedCount = 0;

    // Cassandra requires individual deletes or batch
    // Use batch for efficiency
    const queries = primaryKeys.map((pk) => {
      const pkColumns = Object.keys(pk);
      const whereClause = pkColumns.map((col) => `${this.quoteIdentifier(col)} = ?`).join(' AND ');
      return {
        query: `DELETE FROM ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)} WHERE ${whereClause}`,
        params: Object.values(pk),
      };
    });

    // Execute in batches of 100 to avoid large batch warnings
    const batchSize = 100;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, Math.min(i + batchSize, queries.length));
      await this.client.batch(batch, { prepare: true });
      deletedCount += batch.length;
    }

    return deletedCount;
  }

  // ==================== Bulk Operations ====================

  async bulkInsert(
    schema: string,
    table: string,
    rows: Record<string, unknown>[],
    options: BulkInsertOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot insert: Connection is in read-only mode');
    }

    if (rows.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 50, onProgress, skipErrors = false } = options;
    const keyspace = schema || this.connectionConfig.keyspace;

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    // Get column names from first row
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const cql = `INSERT INTO ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}
                 (${columns.map((c) => this.quoteIdentifier(c)).join(', ')})
                 VALUES (${placeholders})`;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

      try {
        const queries = batch.map((row) => ({
          query: cql,
          params: columns.map((col) => row[col]),
        }));

        await this.client.batch(queries, { prepare: true });
        successCount += batch.length;
        onProgress?.(successCount, rows.length);
      } catch (error) {
        if (skipErrors) {
          failureCount += batch.length;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : String(error),
          });
        } else {
          throw error;
        }
      }
    }

    return {
      successCount,
      failureCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async bulkUpdate(
    schema: string,
    table: string,
    updates: BulkUpdateItem[],
    options: BulkUpdateOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot update: Connection is in read-only mode');
    }

    if (updates.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 50, onProgress, skipErrors = false } = options;
    const keyspace = schema || this.connectionConfig.keyspace;

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

      try {
        const queries = batch.map((update) => {
          const setClauses = Object.keys(update.values)
            .map((col) => `${this.quoteIdentifier(col)} = ?`)
            .join(', ');
          const whereClauses = Object.keys(update.primaryKey)
            .map((col) => `${this.quoteIdentifier(col)} = ?`)
            .join(' AND ');

          return {
            query: `UPDATE ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)} SET ${setClauses} WHERE ${whereClauses}`,
            params: [...Object.values(update.values), ...Object.values(update.primaryKey)],
          };
        });

        await this.client.batch(queries, { prepare: true });
        successCount += batch.length;
        onProgress?.(successCount, updates.length);
      } catch (error) {
        if (skipErrors) {
          failureCount += batch.length;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : String(error),
          });
        } else {
          throw error;
        }
      }
    }

    return {
      successCount,
      failureCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async bulkDelete(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[],
    options: BulkDeleteOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot delete: Connection is in read-only mode');
    }

    if (primaryKeys.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 50, onProgress } = options;

    let successCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < primaryKeys.length; i += batchSize) {
      const batch = primaryKeys.slice(i, Math.min(i + batchSize, primaryKeys.length));

      try {
        const deleted = await this.deleteRows(schema, table, batch);
        successCount += deleted;
        onProgress?.(successCount, primaryKeys.length);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      successCount,
      failureCount: primaryKeys.length - successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async fetchTableRowsWithCursor(
    schema: string,
    table: string,
    options: FetchOptions = {}
  ): Promise<CursorResultSet> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const { limit = 100, filters = [], filterLogic = 'AND', sortColumn, sortDirection = 'ASC', cursor } = options;
    const keyspace = schema || this.connectionConfig.keyspace;

    // Build CQL query
    let cql = `SELECT * FROM ${this.quoteIdentifier(keyspace)}.${this.quoteIdentifier(table)}`;
    const params: unknown[] = [];

    // Build WHERE clause
    const conditions: string[] = [];

    // Add filter conditions
    if (filters.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(filters, filterLogic);
      if (whereClause) {
        conditions.push(whereClause);
        params.push(...whereParams);
      }
    }

    // Add cursor condition if present
    if (cursor && sortColumn && cursor.values[sortColumn] !== undefined) {
      const operator = cursor.direction === 'forward'
        ? (sortDirection === 'ASC' ? '>' : '<')
        : (sortDirection === 'ASC' ? '<' : '>');
      conditions.push(`${this.quoteIdentifier(sortColumn)} ${operator} ?`);
      params.push(cursor.values[sortColumn]);
    }

    if (conditions.length > 0) {
      cql += ` WHERE ${conditions.join(' AND ')} ALLOW FILTERING`;
    }

    cql += ` LIMIT ?`;
    params.push(limit + 1);

    const result = await this.client.execute(cql, params, { prepare: true });

    let rows = result.rows.map((row: CassandraRow) => this.convertRow(row));
    const hasMore = rows.length > limit;
    if (hasMore) {
      rows = rows.slice(0, limit);
    }

    if (cursor?.direction === 'backward') {
      rows.reverse();
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : await this.getColumnNames(keyspace, table);

    let nextCursor: CursorPosition | undefined;
    let prevCursor: CursorPosition | undefined;

    if (rows.length > 0 && sortColumn) {
      const lastRow = rows[rows.length - 1];
      const firstRow = rows[0];

      if (hasMore || cursor) {
        nextCursor = {
          values: { [sortColumn]: lastRow[sortColumn] },
          direction: 'forward',
        };
      }
      if (cursor) {
        prevCursor = {
          values: { [sortColumn]: firstRow[sortColumn] },
          direction: 'backward',
        };
      }
    }

    return {
      columns,
      rows,
      hasNextPage: hasMore,
      hasPrevPage: !!cursor,
      nextCursor,
      prevCursor,
    };
  }

  // ==================== Metadata Operations ====================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    // Get cluster info
    const localResult = await this.client.execute('SELECT * FROM system.local');
    const localRow = localResult.rows[0];

    // Get table count
    const tablesResult = await this.client.execute(
      'SELECT COUNT(*) as count FROM system_schema.tables WHERE keyspace_name = ?',
      [this.connectionConfig.keyspace],
      { prepare: true }
    );

    // Get keyspace count (excluding system)
    const keyspacesResult = await this.client.execute(
      'SELECT COUNT(*) as count FROM system_schema.keyspaces'
    );

    return {
      version: localRow?.release_version || 'unknown',
      size: 'N/A', // Would require nodetool
      tableCount: Number(tablesResult.rows[0]?.count || 0),
      schemaCount: Number(keyspacesResult.rows[0]?.count || 0),
      uptime: 'N/A', // Not available via CQL
      maxConnections: undefined,
      activeConnections: undefined,
      databaseName: this.connectionConfig.keyspace,
      encoding: 'UTF-8',
    };
  }

  async getDatabaseSize(): Promise<number> {
    // Cassandra doesn't provide database size via CQL
    // Would require nodetool tablestats
    return 0;
  }

  async getObjectCounts(schema?: string): Promise<ObjectCounts> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    // Count tables
    const tablesResult = await this.client.execute(
      'SELECT COUNT(*) as count FROM system_schema.tables WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    // Count views (materialized views)
    const viewsResult = await this.client.execute(
      'SELECT COUNT(*) as count FROM system_schema.views WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    // Count functions
    const functionsResult = await this.client.execute(
      'SELECT COUNT(*) as count FROM system_schema.functions WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    // Count types
    const typesResult = await this.client.execute(
      'SELECT COUNT(*) as count FROM system_schema.types WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    return {
      tables: Number(tablesResult.rows[0]?.count || 0),
      views: Number(viewsResult.rows[0]?.count || 0),
      materializedViews: Number(viewsResult.rows[0]?.count || 0),
      functions: Number(functionsResult.rows[0]?.count || 0),
      procedures: 0, // Cassandra doesn't have stored procedures
      types: Number(typesResult.rows[0]?.count || 0),
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    const result = await this.client.execute(
      'SELECT view_name FROM system_schema.views WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    return result.rows.map((row: CassandraRow) => row.view_name as string);
  }

  async listMaterializedViews(schema?: string): Promise<string[]> {
    return this.listViews(schema);
  }

  async listFunctions(schema?: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    const result = await this.client.execute(
      'SELECT function_name FROM system_schema.functions WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    return result.rows.map((row: CassandraRow) => row.function_name as string);
  }

  async listTypes(schema?: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    const result = await this.client.execute(
      'SELECT type_name FROM system_schema.types WHERE keyspace_name = ?',
      [keyspace],
      { prepare: true }
    );

    return result.rows.map((row: CassandraRow) => row.type_name as string);
  }

  async listIndexes(schema: string, table: string): Promise<TableIndex[]> {
    if (!this.client) {
      throw new Error('Not connected to Cassandra');
    }

    const keyspace = schema || this.connectionConfig.keyspace;

    const result = await this.client.execute(
      `SELECT index_name, kind, options FROM system_schema.indexes
       WHERE keyspace_name = ? AND table_name = ?`,
      [keyspace, table],
      { prepare: true }
    );

    return result.rows.map((row: CassandraRow) => {
      const options = (row.options as Record<string, string>) || {};
      const indexName = row.index_name as string;
      const kind = row.kind as string;
      return {
        name: indexName,
        type: kind || 'secondary',
        columns: options.target ? [options.target] : [],
        isUnique: false, // Cassandra indexes are not unique
        isPrimary: false,
        definition: `CREATE INDEX ${indexName} ON ${keyspace}.${table} (${options.target || ''})`,
      };
    });
  }

  async getRunningQueries(): Promise<RunningQuery[]> {
    // Cassandra doesn't provide running query information via CQL
    // Would require JMX or nodetool
    return [];
  }

  async getERDiagram(schema?: string): Promise<ERDiagramData> {
    // Cassandra doesn't have foreign keys, so ER diagrams are not meaningful
    return {
      tables: [],
      relationships: [],
    };
  }

  // ==================== Helper Methods ====================

  quoteIdentifier(identifier: string): string {
    // Cassandra uses double quotes for identifiers
    // Escape existing double quotes
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  formatParameter(index: number): string {
    // Cassandra uses ? for positional parameters
    return '?';
  }

  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] } {
    if (filters.length === 0) {
      return { whereClause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const filter of filters) {
      const { columnName, operator, value, value2 } = filter;
      const quotedColumn = this.quoteIdentifier(columnName);

      switch (operator) {
        case 'equals':
          conditions.push(`${quotedColumn} = ?`);
          params.push(value);
          break;
        case 'not_equals':
          // Cassandra doesn't support != directly, use IN with NOT
          conditions.push(`${quotedColumn} != ?`);
          params.push(value);
          break;
        case 'contains':
          // Cassandra doesn't have LIKE, requires SASI index or Solr
          conditions.push(`${quotedColumn} LIKE ?`);
          params.push(`%${value}%`);
          break;
        case 'starts_with':
          conditions.push(`${quotedColumn} LIKE ?`);
          params.push(`${value}%`);
          break;
        case 'ends_with':
          conditions.push(`${quotedColumn} LIKE ?`);
          params.push(`%${value}`);
          break;
        case 'greater_than':
          conditions.push(`${quotedColumn} > ?`);
          params.push(value);
          break;
        case 'less_than':
          conditions.push(`${quotedColumn} < ?`);
          params.push(value);
          break;
        case 'greater_or_equal':
          conditions.push(`${quotedColumn} >= ?`);
          params.push(value);
          break;
        case 'less_or_equal':
          conditions.push(`${quotedColumn} <= ?`);
          params.push(value);
          break;
        case 'is_null':
          conditions.push(`${quotedColumn} = null`);
          break;
        case 'is_not_null':
          conditions.push(`${quotedColumn} != null`);
          break;
        case 'in':
          const values = Array.isArray(value)
            ? value
            : String(value).split(',').map((v) => v.trim());
          if (values.length > 0) {
            conditions.push(`${quotedColumn} IN (${values.map(() => '?').join(', ')})`);
            params.push(...values);
          }
          break;
        case 'between':
          conditions.push(`${quotedColumn} >= ? AND ${quotedColumn} <= ?`);
          params.push(value, value2);
          break;
      }
    }

    // Note: Cassandra has limited OR support in WHERE clauses
    const whereClause = conditions.join(logic === 'OR' ? ' OR ' : ' AND ');
    return { whereClause, params };
  }

  /**
   * Format Cassandra type for display
   */
  private formatCassandraType(type: string): string {
    // Make types more readable
    return type
      .replace(/frozen<(.+)>/g, '$1 (frozen)')
      .replace(/list<(.+)>/g, 'list<$1>')
      .replace(/set<(.+)>/g, 'set<$1>')
      .replace(/map<(.+),\s*(.+)>/g, 'map<$1, $2>');
  }

  /**
   * Convert Cassandra row to plain object
   */
  private convertRow(row: CassandraRow): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(row)) {
      if (key.startsWith('_')) continue; // Skip internal properties

      const value = row[key];
      result[key] = this.convertValue(value);
    }

    return result;
  }

  /**
   * Convert Cassandra value to JS-friendly format
   */
  private convertValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    // Get driver types if available
    const driver = cassandraDriver;
    if (driver) {
      const { types } = driver;

      // Handle Cassandra-specific types
      if (value instanceof types.Uuid || value instanceof types.TimeUuid) {
        return (value as { toString(): string }).toString();
      }

      if (value instanceof types.Long) {
        return (value as { toNumber(): number }).toNumber();
      }

      if (value instanceof types.BigDecimal) {
        return (value as { toString(): string }).toString();
      }

      if (value instanceof types.InetAddress) {
        return (value as { toString(): string }).toString();
      }

      if (value instanceof types.LocalDate) {
        return (value as { toString(): string }).toString();
      }

      if (value instanceof types.LocalTime) {
        return (value as { toString(): string }).toString();
      }

      if (value instanceof types.Duration) {
        return (value as { toString(): string }).toString();
      }
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
      return `[binary: ${value.length} bytes]`;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.convertValue(v));
    }

    if (value instanceof Set) {
      return Array.from(value).map((v) => this.convertValue(v));
    }

    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      value.forEach((v, k) => {
        obj[String(k)] = this.convertValue(v);
      });
      return obj;
    }

    if (typeof value === 'object') {
      // Handle UDTs and other objects
      return JSON.stringify(value);
    }

    return value;
  }

  /**
   * Get column names for a table
   */
  private async getColumnNames(keyspace: string, table: string): Promise<string[]> {
    const result = await this.client!.execute(
      'SELECT column_name FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ?',
      [keyspace, table],
      { prepare: true }
    );
    return result.rows.map((row: CassandraRow) => row.column_name as string);
  }
}
