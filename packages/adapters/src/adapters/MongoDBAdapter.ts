import { EventEmitter } from 'events';
import { MongoClient, Db, Collection, Document, ObjectId } from 'mongodb';
import type { MongoDBConnectionConfig } from '@dbview/types';
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

/**
 * MongoDB Adapter
 *
 * Implements the DatabaseAdapter interface for MongoDB databases.
 * Maps MongoDB concepts to relational database concepts:
 * - Databases → Databases
 * - Collections → Tables
 * - Documents → Rows
 * - Fields → Columns
 */
export class MongoDBAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'mongodb' as const;
  private client: MongoClient | undefined;
  private db: Db | undefined;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private error: Error | undefined;
  private readonly connectionConfig: MongoDBConnectionConfig;

  // Track running queries for cancellation
  private runningQueries = new Map<string, AbortController>(); // queryId -> AbortController

  readonly capabilities: DatabaseCapabilities = {
    // Hierarchy
    supportsSchemas: false, // MongoDB uses databases directly, no schemas
    supportsDatabases: true,
    supportsInstances: false,

    // Objects
    supportsTables: true, // Collections are like tables
    supportsViews: true, // MongoDB supports views
    supportsMaterializedViews: false,
    supportsFunctions: false,
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: true,
    supportsTriggers: false,

    // Features
    supportsSQL: false, // MongoDB uses MQL (MongoDB Query Language)
    supportsExplainPlan: true, // MongoDB has explain()
    supportsForeignKeys: false, // No foreign keys in MongoDB
    supportsJSON: true, // Native JSON/BSON support
    supportsArrays: true, // Native array support
    supportsTransactions: true, // MongoDB 4.0+ supports transactions

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

  constructor(config: MongoDBConnectionConfig) {
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

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testClient = new MongoClient(this.buildConnectionString(), {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await testClient.connect();
      await testClient.db('admin').command({ ping: 1 });
      await testClient.close();

      return {
        success: true,
        message: 'Successfully connected to MongoDB',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async connect(): Promise<void> {
    try {
      this.connectionStatus = 'connecting';
      this.emit('statusChange', { status: 'connecting' });

      // Debug: Log connection config (without password)
      const debugConfig = { ...this.connectionConfig, password: this.connectionConfig.password ? '***' : 'NOT SET' };
      console.log('[dbview] MongoDBAdapter.connect() - config:', JSON.stringify(debugConfig));

      // Get pool configuration from connection config or use defaults
      const poolConfig = (this.connectionConfig as any).pool || {};

      this.client = new MongoClient(this.buildConnectionString(), {
        maxPoolSize: poolConfig.maxConnections ?? 20, // Increased from 10 to 20
        minPoolSize: poolConfig.minConnections ?? 0,
        serverSelectionTimeoutMS: poolConfig.connectionTimeoutMs ?? 10000,
        socketTimeoutMS: 60000,
      });

      await this.client.connect();
      this.db = this.client.db(this.connectionConfig.database);

      // Test the connection
      await this.db.command({ ping: 1 });

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
    if (this.client) {
      await this.client.close();
      this.client = undefined;
      this.db = undefined;
    }
    this.connectionStatus = 'disconnected';
    this.emit('statusChange', { status: 'disconnected' });
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.db) {
        throw new Error('Not connected to MongoDB database');
      }
      const result = await this.db.command({ ping: 1 });
      return result.ok === 1;
    } catch (error) {
      return false;
    }
  }

  startHealthCheck(): void {
    // MongoDB client has built-in connection monitoring
    // No additional health check needed
  }

  stopHealthCheck(): void {
    // MongoDB client has built-in connection monitoring
    // No additional cleanup needed
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

  // ==================== Hierarchy & Discovery ====================

  async getHierarchy(): Promise<DatabaseHierarchy> {
    return {
      type: 'database-based' as const,
      levels: ['database', 'collection'],
      systemSchemas: ['admin', 'local', 'config'],
    };
  }

  async listSchemas(): Promise<string[]> {
    // MongoDB doesn't have schemas, return empty array
    return [];
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to MongoDB');
    }

    const adminDb = this.client.db('admin');
    const result = await adminDb.admin().listDatabases();

    // Filter out system databases
    return result.databases
      .map((db) => db.name)
      .filter((name) => !['admin', 'local', 'config'].includes(name));
  }

  // ==================== Table (Collection) Operations ====================

  async listTables(schema?: string): Promise<TableInfo[]> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const collections = await this.db.listCollections().toArray();

    const tableInfos: TableInfo[] = [];

    for (const coll of collections) {
      try {
        const stats = await this.db.command({ collStats: coll.name });
        tableInfos.push({
          name: coll.name,
          rowCount: stats.count || 0,
          sizeBytes: stats.size || 0,
        });
      } catch (error) {
        // If stats fail, still add the collection
        tableInfos.push({
          name: coll.name,
          rowCount: 0,
          sizeBytes: 0,
        });
      }
    }

    return tableInfos;
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const collection = this.db.collection(table);

    // Sample documents to infer schema
    const sample = await collection.find().limit(100).toArray();

    if (sample.length === 0) {
      return [
        {
          name: '_id',
          type: 'ObjectId',
          nullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          isForeignKey: false,
          foreignKeyRef: null,
          isAutoIncrement: true,
          isGenerated: true,
          editable: false,
        },
      ];
    }

    // Collect all unique field names
    const fieldsMap = new Map<string, Set<string>>();

    for (const doc of sample) {
      this.collectFields(doc, fieldsMap);
    }

    const columns: ColumnMetadata[] = [];

    // _id is always present
    columns.push({
      name: '_id',
      type: 'ObjectId',
      nullable: false,
      defaultValue: null,
      isPrimaryKey: true,
      isForeignKey: false,
      foreignKeyRef: null,
      isAutoIncrement: true,
      isGenerated: true,
      editable: false,
    });

    // Add other fields
    for (const [field, types] of fieldsMap.entries()) {
      if (field === '_id') continue;

      const typeStr = Array.from(types).join(' | ');

      columns.push({
        name: field,
        type: typeStr,
        nullable: true, // MongoDB fields are nullable by default
        defaultValue: null,
        isPrimaryKey: false,
        isForeignKey: false,
        foreignKeyRef: null,
        isAutoIncrement: false,
        isGenerated: false,
        editable: true,
      });
    }

    return columns;
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const metadata = await this.getTableMetadata(schema, table);

    // Convert ColumnMetadata to ColumnInfo
    return metadata.map(col => ({
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
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND' } = options;

    const collection = this.db.collection(table);
    const query = this.buildMongoQuery(filters, filterLogic);

    const documents = await collection
      .find(query, { maxTimeMS: this.getQueryTimeoutMs() })
      .sort({ _id: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Convert MongoDB documents to rows
    const rows = documents.map((doc) => this.convertDocument(doc));

    // Get column names from first row or empty
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { columns, rows };
  }

  async getTableRowCount(schema: string, table: string, options: FilterOptions = {}): Promise<number> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const { filters = [], filterLogic = 'AND' } = options;

    const collection = this.db.collection(table);
    const query = this.buildMongoQuery(filters, filterLogic);

    return await collection.countDocuments(query, { maxTimeMS: this.getQueryTimeoutMs() });
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const stats = await this.db.command({ collStats: table });

    return {
      rowCount: stats.count || 0,
      totalSize: this.formatBytes(stats.size || 0),
      tableSize: this.formatBytes(stats.storageSize || 0),
      indexesSize: this.formatBytes(stats.totalIndexSize || 0),
      lastVacuum: null,
      lastAnalyze: null,
      lastAutoVacuum: null,
      lastAutoAnalyze: null,
    };
  }

  // ==================== Query Execution ====================

  /**
   * Run a MongoDB query (find or aggregation pipeline)
   *
   * Supported query formats:
   *
   * 1. Aggregation Pipeline:
   * {
   *   "collection": "users",
   *   "pipeline": [
   *     { "$match": { "status": "active" } },
   *     { "$limit": 10 }
   *   ]
   * }
   *
   * 2. Find Query:
   * {
   *   "collection": "users",
   *   "find": { "status": "active" },
   *   "projection": { "name": 1, "email": 1 },
   *   "sort": { "createdAt": -1 },
   *   "limit": 10,
   *   "skip": 0
   * }
   *
   * 3. Count Query:
   * {
   *   "collection": "users",
   *   "count": { "status": "active" }
   * }
   *
   * 4. Distinct Query:
   * {
   *   "collection": "users",
   *   "distinct": "status",
   *   "query": { "active": true }
   * }
   */
  async runQuery(query: string, queryId?: string): Promise<QueryResultSet> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    let parsedQuery: any;
    try {
      parsedQuery = JSON.parse(query);
    } catch (e) {
      throw new Error('Invalid JSON query. Please provide a valid JSON object.');
    }

    const collectionName = parsedQuery.collection;
    if (!collectionName) {
      throw new Error('Missing "collection" field. Specify which collection to query.');
    }

    const collection = this.db.collection(collectionName);
    let results: any[] = [];

    // Create AbortController for cancellation support
    let abortController: AbortController | undefined;
    if (queryId) {
      abortController = new AbortController();
      this.runningQueries.set(queryId, abortController);
    }

    try {
      // Aggregation Pipeline
      if (parsedQuery.pipeline && Array.isArray(parsedQuery.pipeline)) {
        const pipeline = parsedQuery.pipeline;
        const options = parsedQuery.options || {};

        // Add abort signal if available
        if (abortController) {
          options.signal = abortController.signal;
        }

        results = await collection.aggregate(pipeline, options).toArray();
      }
      // Find Query
      else if (parsedQuery.find !== undefined) {
        const filter = parsedQuery.find || {};
        const projection = parsedQuery.projection || {};
        const sort = parsedQuery.sort || {};
        const limit = parsedQuery.limit || 100;
        const skip = parsedQuery.skip || 0;

        const findOptions: any = {};
        if (abortController) {
          findOptions.signal = abortController.signal;
        }

        let cursor = collection.find(filter, findOptions);

        if (Object.keys(projection).length > 0) {
          cursor = cursor.project(projection);
        }
        if (Object.keys(sort).length > 0) {
          cursor = cursor.sort(sort);
        }
        if (skip > 0) {
          cursor = cursor.skip(skip);
        }
        cursor = cursor.limit(limit);

        results = await cursor.toArray();
      }
      // Count Query
      else if (parsedQuery.count !== undefined) {
        const filter = parsedQuery.count || {};
        const options: any = {};
        if (abortController) {
          options.signal = abortController.signal;
        }
        const count = await collection.countDocuments(filter, options);
        results = [{ count }];
      }
      // Distinct Query
      else if (parsedQuery.distinct) {
        const field = parsedQuery.distinct;
        const filter = parsedQuery.query || {};
        const options: any = {};
        if (abortController) {
          options.signal = abortController.signal;
        }
        const distinctValues = await collection.distinct(field, filter, options);
        results = distinctValues.map((value: any) => ({ [field]: value }));
      }
      // Default: treat as find with empty filter
      else {
        const findOptions: any = { limit: 100 };
        if (abortController) {
          findOptions.signal = abortController.signal;
        }
        results = await collection.find({}, findOptions).toArray();
      }
    } finally {
      // Clean up tracking
      if (queryId) {
        this.runningQueries.delete(queryId);
      }
    }

    // Extract columns from results
    const columns: string[] = [];
    const columnSet = new Set<string>();

    for (const doc of results) {
      for (const key of Object.keys(doc)) {
        if (!columnSet.has(key)) {
          columnSet.add(key);
          columns.push(key);
        }
      }
    }

    // Ensure _id is first if present
    const idIndex = columns.indexOf('_id');
    if (idIndex > 0) {
      columns.splice(idIndex, 1);
      columns.unshift('_id');
    }

    // Convert ObjectId and other BSON types to strings for display
    const rows = results.map((doc) => {
      const row: Record<string, unknown> = {};
      for (const key of columns) {
        const value = doc[key];
        if (value && typeof value === 'object' && value.constructor?.name === 'ObjectId') {
          row[key] = value.toString();
        } else if (value instanceof Date) {
          row[key] = value.toISOString();
        } else if (value && typeof value === 'object') {
          row[key] = JSON.stringify(value);
        } else {
          row[key] = value;
        }
      }
      return row;
    });

    return { columns, rows };
  }

  async explainQuery(query: string): Promise<any> {
    throw new Error('Explain is not yet implemented for MongoDB');
  }

  async cancelQuery(queryId: string): Promise<void> {
    const abortController = this.runningQueries.get(queryId);
    if (!abortController) {
      // Query already completed or not found
      return;
    }

    try {
      // Abort the query using AbortController
      abortController.abort();

      console.log(`[MongoDBAdapter] Successfully cancelled query ${queryId}`);
    } catch (error) {
      console.error(`[MongoDBAdapter] Failed to cancel query ${queryId}:`, error);
      throw new Error(`Failed to cancel query: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Always clean up tracking
      this.runningQueries.delete(queryId);
    }
  }

  // ==================== CRUD Operations ====================

  async insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    console.log(`[MongoDB] insertRow called - schema: ${schema}, table: ${table}`);
    console.log(`[MongoDB] Data to insert:`, JSON.stringify(data, null, 2));

    if (!this.db) {
      console.error(`[MongoDB] Not connected to database`);
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      console.error(`[MongoDB] Connection is read-only`);
      throw new Error('Cannot insert: Connection is in read-only mode');
    }

    console.log(`[MongoDB] Getting collection: ${table}`);
    const collection = this.db.collection(table);

    // Remove _id if it's empty or null
    const insertData = { ...data };
    if (insertData._id === null || insertData._id === '') {
      delete insertData._id;
      console.log(`[MongoDB] Removed empty _id from insert data`);
    }

    console.log(`[MongoDB] Final insert data:`, JSON.stringify(insertData, null, 2));
    console.log(`[MongoDB] Calling collection.insertOne...`);

    const result = await collection.insertOne(insertData);
    console.log(`[MongoDB] insertOne result:`, JSON.stringify(result, null, 2));
    console.log(`[MongoDB] Inserted ID: ${result.insertedId}`);

    // Return the inserted document
    const inserted = await collection.findOne({ _id: result.insertedId });
    console.log(`[MongoDB] Retrieved inserted document:`, inserted ? 'found' : 'not found');

    const converted = inserted ? this.convertDocument(inserted) : {};
    console.log(`[MongoDB] Returning:`, JSON.stringify(converted, null, 2));

    return converted;
  }

  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot update: Connection is in read-only mode');
    }

    const collection = this.db.collection(table);

    // Convert _id to ObjectId if needed
    const filter = this.convertWhereConditions(primaryKey);

    await collection.updateOne(filter, { $set: { [column]: value } });
  }

  async deleteRows(schema: string, table: string, primaryKeys: Record<string, unknown>[]): Promise<number> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot delete: Connection is in read-only mode');
    }

    if (primaryKeys.length === 0) {
      return 0;
    }

    const collection = this.db.collection(table);

    // Use deleteMany with $or for efficiency instead of N individual deletes
    const orConditions = primaryKeys.map(pk => this.convertWhereConditions(pk));
    const result = await collection.deleteMany({ $or: orConditions });

    return result.deletedCount;
  }

  // ==================== Bulk Operations (for large datasets) ====================

  async bulkInsert(
    schema: string,
    table: string,
    rows: Record<string, unknown>[],
    options: BulkInsertOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot insert: Connection is in read-only mode');
    }

    if (rows.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 1000, onProgress, skipErrors = false } = options;
    const collection = this.db.collection(table);

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];
    const insertedIds: unknown[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

      try {
        // Clean up _id if empty/null
        const cleanedBatch = batch.map(row => {
          const cleaned = { ...row };
          if (cleaned._id === null || cleaned._id === '') {
            delete cleaned._id;
          }
          return cleaned;
        });

        const result = await collection.insertMany(cleanedBatch, { ordered: !skipErrors });
        successCount += result.insertedCount;
        insertedIds.push(...Object.values(result.insertedIds).map(id => id.toString()));
        onProgress?.(successCount, rows.length);
      } catch (error: any) {
        if (skipErrors) {
          // For unordered inserts, some may have succeeded
          if (error.insertedCount) {
            successCount += error.insertedCount;
          }
          failureCount += batch.length - (error.insertedCount || 0);
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
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot update: Connection is in read-only mode');
    }

    if (updates.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 500, onProgress, skipErrors = false } = options;
    const collection = this.db.collection(table);

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

      try {
        // Use bulkWrite for efficiency
        const bulkOps = batch.map(update => ({
          updateOne: {
            filter: this.convertWhereConditions(update.primaryKey),
            update: { $set: update.values }
          }
        }));

        const result = await collection.bulkWrite(bulkOps, { ordered: !skipErrors });
        successCount += result.modifiedCount;
        onProgress?.(successCount, updates.length);
      } catch (error: any) {
        if (skipErrors) {
          if (error.result?.nModified) {
            successCount += error.result.nModified;
          }
          failureCount += batch.length - (error.result?.nModified || 0);
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
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot delete: Connection is in read-only mode');
    }

    if (primaryKeys.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 1000, onProgress } = options;
    const collection = this.db.collection(table);

    let successCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < primaryKeys.length; i += batchSize) {
      const batch = primaryKeys.slice(i, Math.min(i + batchSize, primaryKeys.length));

      try {
        // Use deleteMany with $or for batch efficiency
        const orConditions = batch.map(pk => this.convertWhereConditions(pk));
        const result = await collection.deleteMany({ $or: orConditions });
        successCount += result.deletedCount;
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
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const { limit = 100, filters = [], filterLogic = 'AND', sortColumn, sortDirection = 'ASC', cursor } = options;
    const collection = this.db.collection(table);

    // Default to _id for cursor if no sort column specified
    const cursorColumn = sortColumn || '_id';
    const sortDir = sortDirection === 'ASC' ? 1 : -1;

    const query = this.buildMongoQuery(filters, filterLogic);

    // Add cursor condition
    if (cursor && cursor.values[cursorColumn] !== undefined) {
      const cursorValue = this.convertValue(cursorColumn, cursor.values[cursorColumn]);
      const operator = cursor.direction === 'forward'
        ? (sortDirection === 'ASC' ? '$gt' : '$lt')
        : (sortDirection === 'ASC' ? '$lt' : '$gt');

      if (Object.keys(query).length === 0) {
        query[cursorColumn] = { [operator]: cursorValue };
      } else {
        // Combine with existing query
        if (query.$and) {
          query.$and.push({ [cursorColumn]: { [operator]: cursorValue } });
        } else if (query.$or) {
          query.$and = [{ $or: query.$or }, { [cursorColumn]: { [operator]: cursorValue } }];
          delete query.$or;
        } else {
          const existingConditions = { ...query };
          for (const key of Object.keys(existingConditions)) {
            delete query[key];
          }
          query.$and = [existingConditions, { [cursorColumn]: { [operator]: cursorValue } }];
        }
      }
    }

    const fetchLimit = limit + 1;
    const actualSortDir = cursor?.direction === 'backward' ? -sortDir : sortDir;

    const documents = await collection
      .find(query, { maxTimeMS: this.getQueryTimeoutMs() })
      .sort({ [cursorColumn]: actualSortDir } as Record<string, 1 | -1>)
      .limit(fetchLimit)
      .toArray();

    let resultRows = documents.map(doc => this.convertDocument(doc));

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

  // ==================== Filtering ====================

  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] } {
    // MongoDB doesn't use SQL WHERE clauses
    return { whereClause: '', params: [] };
  }

  // ==================== Metadata Operations ====================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    if (!this.client || !this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const adminDb = this.client.db('admin');
    const serverStatus = await adminDb.command({ serverStatus: 1 });
    const dbStats = await this.db.stats();

    const collections = await this.db.listCollections().toArray();

    return {
      version: serverStatus.version,
      size: this.formatBytes(dbStats.dataSize || 0),
      tableCount: collections.length,
      schemaCount: 0,
      uptime: this.formatDuration(serverStatus.uptime),
      maxConnections: serverStatus.connections?.available || 0,
      activeConnections: serverStatus.connections?.current || 0,
      databaseName: this.connectionConfig.database,
      encoding: 'UTF-8',
    };
  }

  async getDatabaseSize(): Promise<number> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const stats = await this.db.stats();
    return stats.dataSize || 0;
  }

  async getObjectCounts(schema?: string): Promise<ObjectCounts> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const collections = await this.db.listCollections().toArray();
    const views = collections.filter((c) => c.type === 'view');

    return {
      tables: collections.length - views.length,
      views: views.length,
      materializedViews: 0,
      functions: 0,
      procedures: 0,
      types: 0,
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const collections = await this.db.listCollections({ type: 'view' }).toArray();
    return collections.map((c) => c.name);
  }

  async listIndexes(schema: string, table: string): Promise<TableIndex[]> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const collection = this.db.collection(table);
    const indexes = await collection.indexes();

    return indexes.map((idx) => ({
      name: idx.name || 'unknown',
      type: 'btree', // MongoDB uses B-tree indexes
      columns: Object.keys(idx.key || {}),
      isUnique: idx.unique || false,
      isPrimary: idx.name === '_id_',
      definition: JSON.stringify(idx.key),
    }));
  }

  /**
   * Create an index on a collection
   */
  async createIndex(
    schema: string,
    table: string,
    keys: Record<string, 1 | -1>,
    options: { unique?: boolean; sparse?: boolean; background?: boolean; name?: string } = {}
  ): Promise<string> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot create index: Connection is in read-only mode');
    }

    const collection = this.db.collection(table);
    const indexName = await collection.createIndex(keys, {
      unique: options.unique,
      sparse: options.sparse,
      background: options.background,
      name: options.name,
    });

    return indexName;
  }

  /**
   * Drop an index from a collection
   */
  async dropIndex(schema: string, table: string, indexName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot drop index: Connection is in read-only mode');
    }

    // Cannot drop the _id index
    if (indexName === '_id_') {
      throw new Error('Cannot drop the _id index');
    }

    const collection = this.db.collection(table);
    await collection.dropIndex(indexName);
  }

  /**
   * Run an aggregation pipeline on a collection
   */
  async runAggregation(
    schema: string,
    table: string,
    pipeline: Document[],
    options: { maxTimeMS?: number; allowDiskUse?: boolean } = {}
  ): Promise<QueryResultSet> {
    if (!this.db) {
      throw new Error('Not connected to MongoDB database');
    }

    const collection = this.db.collection(table);
    const result = await collection.aggregate(pipeline, {
      maxTimeMS: options.maxTimeMS ?? this.getQueryTimeoutMs(),
      allowDiskUse: options.allowDiskUse ?? true,
    }).toArray();

    // Convert documents to rows
    const rows = result.map((doc) => this.convertDocument(doc));

    // Get columns from first row or empty
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { columns, rows };
  }

  async getRunningQueries(): Promise<RunningQuery[]> {
    if (!this.client) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      const adminDb = this.client.db('admin');
      const result = await adminDb.command({ currentOp: 1 });

      const queries: RunningQuery[] = [];

      if (result.inprog && Array.isArray(result.inprog)) {
        for (const op of result.inprog) {
          if (op.op === 'query' || op.op === 'command') {
            queries.push({
              pid: op.opid || 0,
              user: op.client || 'unknown',
              query: JSON.stringify(op.command || {}),
              state: op.op,
              duration: `${op.microsecs_running / 1000}ms`,
              waitEvent: op.waitingForLock ? 'lock' : null,
            });
          }
        }
      }

      return queries;
    } catch (error) {
      // If we don't have admin permissions, return empty array
      return [];
    }
  }

  async getERDiagram(schema?: string): Promise<ERDiagramData> {
    // MongoDB doesn't have foreign keys, so ER diagrams are not meaningful
    return {
      tables: [],
      relationships: [],
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Escape special regex characters to prevent ReDoS attacks
   * and ensure literal string matching
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get the query timeout in milliseconds
   * Used to prevent long-running queries from blocking the database
   */
  private getQueryTimeoutMs(): number {
    return (this.connectionConfig as any).queryTimeoutMs ?? 30000; // Default 30 seconds
  }

  quoteIdentifier(identifier: string): string {
    // MongoDB doesn't require quoting, but we use backticks for consistency
    return `\`${identifier}\``;
  }

  formatParameter(index: number): string {
    // MongoDB doesn't use parameter placeholders like SQL
    return `$${index}`;
  }

  private buildConnectionString(): string {
    // If a full connection string is provided, use it directly
    if (this.connectionConfig.connectionString) {
      return this.connectionConfig.connectionString;
    }

    // Otherwise build from individual fields
    const { host, port, user, password, database, authDatabase } = this.connectionConfig;

    const credentials = user && password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : '';
    // Default authDatabase to 'admin' if user credentials are provided but no authDatabase specified
    // This is the standard MongoDB authentication behavior
    const authSource = authDatabase || (user && password ? 'admin' : undefined);
    const authSourceParam = authSource ? `?authSource=${authSource}` : '';

    return `mongodb://${credentials}${host}:${port || 27017}/${database}${authSourceParam}`;
  }

  private buildMongoQuery(filters: FilterCondition[], logic: 'AND' | 'OR'): Document {
    if (filters.length === 0) {
      return {};
    }

    const conditions: Document[] = [];

    for (const filter of filters) {
      const { columnName, operator, value, value2 } = filter;

      switch (operator) {
        case 'equals':
          conditions.push({ [columnName]: this.convertValue(columnName, value) });
          break;
        case 'not_equals':
          conditions.push({ [columnName]: { $ne: this.convertValue(columnName, value) } });
          break;
        case 'contains':
          // Escape regex special chars to prevent ReDoS and ensure literal matching
          conditions.push({ [columnName]: { $regex: this.escapeRegex(String(value)), $options: 'i' } });
          break;
        case 'not_contains':
          conditions.push({ [columnName]: { $not: { $regex: this.escapeRegex(String(value)), $options: 'i' } } });
          break;
        case 'starts_with':
          conditions.push({ [columnName]: { $regex: `^${this.escapeRegex(String(value))}`, $options: 'i' } });
          break;
        case 'ends_with':
          conditions.push({ [columnName]: { $regex: `${this.escapeRegex(String(value))}$`, $options: 'i' } });
          break;
        case 'greater_than':
          conditions.push({ [columnName]: { $gt: value } });
          break;
        case 'less_than':
          conditions.push({ [columnName]: { $lt: value } });
          break;
        case 'greater_or_equal':
          conditions.push({ [columnName]: { $gte: value } });
          break;
        case 'less_or_equal':
          conditions.push({ [columnName]: { $lte: value } });
          break;
        case 'is_null':
          conditions.push({ [columnName]: null });
          break;
        case 'is_not_null':
          conditions.push({ [columnName]: { $ne: null } });
          break;
        case 'in':
          // Filter out empty strings to avoid matching empty values
          const values = (Array.isArray(value)
            ? value.map((v) => String(v).trim())
            : String(value).split(',').map((v) => v.trim())
          ).filter((v) => v !== '');
          if (values.length > 0) {
            conditions.push({ [columnName]: { $in: values } });
          }
          // Skip adding condition if no valid values (treats as "no filter")
          break;
        case 'between':
          conditions.push({ [columnName]: { $gte: value, $lte: value2 } });
          break;
      }
    }

    if (conditions.length === 0) {
      return {};
    }

    if (logic === 'OR') {
      return { $or: conditions };
    } else {
      return { $and: conditions };
    }
  }

  private collectFields(obj: any, fieldsMap: Map<string, Set<string>>, prefix = ''): void {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      const value = obj[key];
      const fieldName = prefix ? `${prefix}.${key}` : key;
      const type = this.getMongoType(value);

      if (!fieldsMap.has(fieldName)) {
        fieldsMap.set(fieldName, new Set());
      }

      fieldsMap.get(fieldName)!.add(type);

      // Recursively collect nested fields
      if (type === 'Object' && value !== null) {
        this.collectFields(value, fieldsMap, fieldName);
      }
    }
  }

  private getMongoType(value: any): string {
    if (value === null) return 'null';
    if (value instanceof ObjectId) return 'ObjectId';
    if (value instanceof Date) return 'Date';
    if (Array.isArray(value)) return 'Array';
    if (typeof value === 'object') return 'Object';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Double';
    if (typeof value === 'boolean') return 'Boolean';
    return 'Unknown';
  }

  private convertDocument(doc: Document): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key in doc) {
      if (!doc.hasOwnProperty(key)) continue;

      const value = doc[key];

      if (value instanceof ObjectId) {
        result[key] = value.toString();
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private convertWhereConditions(conditions: Record<string, unknown>): Document {
    const filter: Document = {};

    for (const key in conditions) {
      if (!conditions.hasOwnProperty(key)) continue;

      filter[key] = this.convertValue(key, conditions[key]);
    }

    return filter;
  }

  private convertValue(fieldName: string, value: unknown): any {
    // Convert _id string to ObjectId
    if (fieldName === '_id' && typeof value === 'string') {
      try {
        return new ObjectId(value);
      } catch (error) {
        return value;
      }
    }

    return value;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '0m';
  }
}
