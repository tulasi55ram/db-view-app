import { EventEmitter } from 'events';
import { Client, estypes } from '@elastic/elasticsearch';
import type { ElasticsearchConnectionConfig } from '@dbview/types';
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
  BulkOperationResult,
  BulkInsertOptions,
  BulkUpdateItem,
  BulkUpdateOptions,
  BulkDeleteOptions,
} from './DatabaseAdapter';

/**
 * Elasticsearch Adapter
 *
 * Implements the DatabaseAdapter interface for Elasticsearch.
 * Maps Elasticsearch concepts to relational database concepts:
 * - Indices → Tables
 * - Documents → Rows
 * - Mappings/Fields → Columns
 * - _id → Primary key
 */
export class ElasticsearchAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = 'elasticsearch' as const;
  private client: Client | undefined;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private error: Error | undefined;
  private readonly connectionConfig: ElasticsearchConnectionConfig;

  // Cache for index mappings to avoid repeated API calls
  // Key: index name, Value: { mapping, metadata with sortable info, timestamp }
  private mappingCache: Map<string, {
    mapping: Record<string, any>;
    metadata: ColumnMetadata[];
    timestamp: number;
  }> = new Map();
  private readonly MAPPING_CACHE_TTL = 60000; // 1 minute cache TTL

  // Deep pagination support
  // Elasticsearch default max_result_window is 10,000
  private readonly MAX_RESULT_WINDOW = 10000;
  // Cache for Point-in-Time IDs for consistent deep pagination
  // Key: index name, Value: { pitId, timestamp }
  private pitCache: Map<string, { pitId: string; timestamp: number }> = new Map();
  private readonly PIT_KEEP_ALIVE = '5m'; // Keep PIT alive for 5 minutes
  private readonly PIT_CACHE_TTL = 240000; // Refresh PIT after 4 minutes

  readonly capabilities: DatabaseCapabilities = {
    // Hierarchy
    supportsSchemas: false, // Elasticsearch doesn't have schemas
    supportsDatabases: false, // Elasticsearch has indices, not databases
    supportsInstances: false,

    // Objects
    supportsTables: true, // Indices are like tables
    supportsViews: false, // No views in Elasticsearch
    supportsMaterializedViews: false,
    supportsFunctions: false,
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: true, // Elasticsearch is an index itself
    supportsTriggers: false,

    // Features
    supportsSQL: false, // Elasticsearch uses Query DSL (JSON)
    supportsExplainPlan: true, // Elasticsearch has explain API
    supportsForeignKeys: false, // No foreign keys
    supportsJSON: true, // Native JSON support
    supportsArrays: true, // Native array support
    supportsTransactions: false, // No ACID transactions

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

  constructor(config: ElasticsearchConnectionConfig) {
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
      const testClient = new Client(this.buildClientOptions());

      const info = await testClient.info();
      await testClient.close();

      return {
        success: true,
        message: `Successfully connected to Elasticsearch ${info.version.number}`,
      };
    } catch (error) {
      const parsedError = this.parseElasticsearchError(error, 'Connection test failed');
      return {
        success: false,
        message: parsedError.message,
      };
    }
  }

  async connect(): Promise<void> {
    try {
      this.connectionStatus = 'connecting';
      this.emit('statusChange', { status: 'connecting' });

      this.client = new Client(this.buildClientOptions());

      // Test the connection
      await this.client.ping();

      this.connectionStatus = 'connected';
      this.error = undefined;
      this.emit('statusChange', { status: 'connected' });
    } catch (error) {
      this.connectionStatus = 'error';
      const parsedError = this.parseElasticsearchError(error, 'Failed to connect');
      this.error = parsedError;
      this.emit('statusChange', {
        status: 'error',
        error: parsedError,
        message: parsedError.message,
      });
      throw parsedError;
    }
  }

  async disconnect(): Promise<void> {
    // Close all PITs before disconnecting
    await this.closeAllPITs();

    // Clear caches
    this.mappingCache.clear();

    if (this.client) {
      await this.client.close();
      this.client = undefined;
    }
    this.connectionStatus = 'disconnected';
    this.emit('statusChange', { status: 'disconnected' });
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Not connected to Elasticsearch');
      }
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  startHealthCheck(): void {
    // Elasticsearch client has built-in connection monitoring
  }

  stopHealthCheck(): void {
    // Elasticsearch client has built-in connection monitoring
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
      type: 'flat' as const,
      levels: ['index'],
      systemSchemas: ['.kibana', '.apm', '.security', '.fleet', '.tasks', '.async-search'],
    };
  }

  async listSchemas(): Promise<string[]> {
    // Elasticsearch doesn't have schemas, return empty array
    return [];
  }

  async listDatabases(): Promise<string[]> {
    // Elasticsearch doesn't have databases concept, return empty array
    return [];
  }

  // ==================== Index (Table) Operations ====================

  async listTables(schema?: string): Promise<TableInfo[]> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      // Get all indices
      const indicesResponse = await this.client.cat.indices({
        format: 'json',
        h: 'index,docs.count,store.size',
      });

      const indices = indicesResponse as Array<{
        index: string;
        'docs.count': string;
        'store.size': string;
      }>;

      // Filter out system indices (starting with .)
      const systemPrefixes = ['.kibana', '.apm', '.security', '.fleet', '.tasks', '.async-search', '.internal'];

      return indices
        .filter((idx) => !systemPrefixes.some((prefix) => idx.index?.startsWith(prefix)))
        .filter((idx) => !idx.index?.startsWith('.'))
        .map((idx) => ({
          name: idx.index || '',
          rowCount: parseInt(idx['docs.count'] || '0', 10),
          sizeBytes: this.parseSizeToBytes(idx['store.size'] || '0'),
        }));
    } catch (error) {
      throw this.parseElasticsearchError(error, 'Failed to list indices');
    }
  }

  async getTableMetadata(schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    // Check cache first
    const cached = this.mappingCache.get(table);
    if (cached && Date.now() - cached.timestamp < this.MAPPING_CACHE_TTL) {
      return cached.metadata;
    }

    try {
      // Get index mapping
      const mappingResponse = await this.client.indices.getMapping({
        index: table,
      });

      const indexMapping = mappingResponse[table];
      if (!indexMapping || !indexMapping.mappings) {
        return this.getDefaultMetadata();
      }

      const properties = indexMapping.mappings.properties || {};
      const columns: ColumnMetadata[] = [];

      // Always include _id as primary key
      // Note: _id is NOT sortable because fielddata is disabled by default on _id field
      columns.push({
        name: '_id',
        type: 'keyword',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: true,
        isForeignKey: false,
        foreignKeyRef: null,
        isAutoIncrement: true,
        isGenerated: true,
        editable: false,
        sortable: false,
        sortField: undefined,
      });

      // Flatten nested properties with sortable info
      this.collectMappingFields(properties, columns, '');

      // Cache the result
      this.mappingCache.set(table, {
        mapping: properties,
        metadata: columns,
        timestamp: Date.now(),
      });

      return columns;
    } catch (error) {
      // Check if it's an index not found error
      const anyError = error as any;
      if (anyError.statusCode === 404 || (error instanceof Error && error.message.includes('index_not_found'))) {
        throw this.parseElasticsearchError(error, `Index '${table}' not found`);
      }
      // For other errors, return default metadata to gracefully degrade
      return this.getDefaultMetadata();
    }
  }

  /**
   * Invalidate the mapping cache for an index.
   * Call this when the index mapping might have changed (e.g., after adding a field).
   */
  invalidateMappingCache(index?: string): void {
    if (index) {
      this.mappingCache.delete(index);
    } else {
      this.mappingCache.clear();
    }
  }

  /**
   * Get or create a Point-in-Time (PIT) for an index.
   * Used for consistent deep pagination.
   */
  private async getOrCreatePIT(index: string): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    const cached = this.pitCache.get(index);
    if (cached && Date.now() - cached.timestamp < this.PIT_CACHE_TTL) {
      return cached.pitId;
    }

    // Close old PIT if exists
    if (cached) {
      try {
        await this.client.closePointInTime({ id: cached.pitId });
      } catch {
        // Ignore errors when closing old PIT
      }
    }

    // Create new PIT
    const pitResponse = await this.client.openPointInTime({
      index,
      keep_alive: this.PIT_KEEP_ALIVE,
    });

    this.pitCache.set(index, {
      pitId: pitResponse.id,
      timestamp: Date.now(),
    });

    return pitResponse.id;
  }

  /**
   * Close all open PITs. Called on disconnect.
   */
  private async closeAllPITs(): Promise<void> {
    if (!this.client) return;

    for (const [, { pitId }] of this.pitCache) {
      try {
        await this.client.closePointInTime({ id: pitId });
      } catch {
        // Ignore errors when closing PITs
      }
    }
    this.pitCache.clear();
  }

  /**
   * Perform deep pagination using search_after with Point-in-Time.
   * This handles offsets beyond Elasticsearch's max_result_window (default 10,000).
   *
   * Strategy: Use search_after to iterate through results in batches until we reach
   * the desired offset, then fetch the requested page.
   */
  private async deepPaginationSearch(
    index: string,
    query: estypes.QueryDslQueryContainer,
    sort: estypes.Sort,
    offset: number,
    limit: number
  ): Promise<estypes.SearchResponse<unknown>> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    // Get or create a PIT for consistent results
    const pitId = await this.getOrCreatePIT(index);

    // Calculate how many documents we need to skip
    let documentsToSkip = offset;
    let searchAfter: estypes.SortResults | undefined;

    // Batch size for scrolling through results (use a reasonable size)
    const batchSize = Math.min(1000, this.MAX_RESULT_WINDOW);

    // Skip through documents until we reach the offset
    while (documentsToSkip > 0) {
      const skipBatch = Math.min(documentsToSkip, batchSize);

      const response = await this.client.search({
        pit: { id: pitId, keep_alive: this.PIT_KEEP_ALIVE },
        query,
        sort,
        size: skipBatch,
        search_after: searchAfter,
        track_total_hits: false, // Don't need total for skip batches
      });

      if (response.hits.hits.length === 0) {
        // No more results - offset is beyond available data
        break;
      }

      // Get the sort values of the last document for the next search_after
      const lastHit = response.hits.hits[response.hits.hits.length - 1];
      searchAfter = lastHit.sort;

      documentsToSkip -= response.hits.hits.length;
    }

    // Now fetch the actual page we want
    const result = await this.client.search({
      pit: { id: pitId, keep_alive: this.PIT_KEEP_ALIVE },
      query,
      sort,
      size: limit,
      search_after: searchAfter,
      track_total_hits: true, // Need total for the final result
    });

    return result;
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
      throw new Error('Not connected to Elasticsearch');
    }

    const { limit = 100, offset = 0, filters = [], filterLogic = 'AND', sortColumn, sortDirection } = options;

    try {
      // Get metadata first (uses cache) - we need this for column list, sort field, and filter field lookup
      const metadata = await this.getTableMetadata(schema, table);

      // Build Elasticsearch query with metadata for proper text field handling
      const query = this.buildElasticsearchQuery(filters, filterLogic, metadata);

      // Build sort using cached metadata to determine the correct sort field
      const sort: estypes.Sort = [];
      if (sortColumn) {
        // Look up the column in metadata to get sortable info
        const columnMeta = metadata.find((m) => m.name === sortColumn);

        if (columnMeta?.sortable && columnMeta.sortField) {
          sort.push({
            [columnMeta.sortField]: {
              order: sortDirection?.toLowerCase() as 'asc' | 'desc' || 'asc',
              missing: '_last',
            },
          });
        }
        // If not sortable, we silently skip sorting for this field
        // (text field without .keyword sub-field)
      }

      // Always add _doc as tiebreaker for consistent pagination
      // Note: _id cannot be used for sorting because fielddata is disabled by default
      sort.push({ _doc: { order: 'asc' } });

      let searchResponse: estypes.SearchResponse<unknown>;

      // Check if we need deep pagination (offset + limit > max_result_window)
      const needsDeepPagination = offset + limit > this.MAX_RESULT_WINDOW;

      if (needsDeepPagination) {
        // Use search_after with Point-in-Time for deep pagination
        searchResponse = await this.deepPaginationSearch(table, query, sort, offset, limit);
      } else {
        // Standard pagination with from/size
        searchResponse = await this.client.search({
          index: table,
          from: offset,
          size: limit,
          query,
          sort,
          track_total_hits: true, // Always track total for accurate counts
        });
      }

      // Convert hits to rows
      const rows = searchResponse.hits.hits.map((hit) => this.convertDocument(hit));

      // Get column names from metadata
      const columns = metadata.map((m) => m.name);

      // Ensure all rows have all columns (fill missing with null for display)
      const normalizedRows = rows.map((row) => {
        const normalizedRow: Record<string, unknown> = {};
        for (const col of columns) {
          normalizedRow[col] = col in row ? row[col] : null;
        }
        return normalizedRow;
      });

      return { columns, rows: normalizedRows };
    } catch (error) {
      throw this.parseElasticsearchError(error, `Failed to fetch documents from '${table}'`);
    }
  }

  async getTableRowCount(schema: string, table: string, options: FilterOptions = {}): Promise<number> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    const { filters = [], filterLogic = 'AND' } = options;

    try {
      // Get metadata for proper text field filtering (uses cache)
      const metadata = filters.length > 0 ? await this.getTableMetadata(schema, table) : [];
      const query = this.buildElasticsearchQuery(filters, filterLogic, metadata);

      const countResponse = await this.client.count({
        index: table,
        query,
      });

      return countResponse.count;
    } catch (error) {
      throw this.parseElasticsearchError(error, `Failed to get document count for '${table}'`);
    }
  }

  async getTableStatistics(schema: string, table: string): Promise<TableStatistics> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      const statsResponse = await this.client.indices.stats({
        index: table,
      });

      const indexStats = statsResponse.indices?.[table];
      const primaries = indexStats?.primaries;

      return {
        rowCount: primaries?.docs?.count || 0,
        totalSize: this.formatBytes(primaries?.store?.size_in_bytes || 0),
        tableSize: this.formatBytes(primaries?.store?.size_in_bytes || 0),
        indexesSize: '0 Bytes', // Elasticsearch index is the table itself
        lastVacuum: null,
        lastAnalyze: null,
        lastAutoVacuum: null,
        lastAutoAnalyze: null,
      };
    } catch (error) {
      return {
        rowCount: 0,
        totalSize: '0 Bytes',
        tableSize: '0 Bytes',
        indexesSize: '0 Bytes',
        lastVacuum: null,
        lastAnalyze: null,
        lastAutoVacuum: null,
        lastAutoAnalyze: null,
      };
    }
  }

  // ==================== Query Execution ====================

  async runQuery(query: string): Promise<QueryResultSet> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      // Parse the query as JSON (Elasticsearch Query DSL)
      let parsedQuery: any;
      try {
        parsedQuery = JSON.parse(query);
      } catch {
        throw new Error(
          'Invalid query format. Use JSON Query DSL. Example: {"index": "my-index", "query": {"match_all": {}}}'
        );
      }

      // Support both full search body and just query portion
      const searchBody: estypes.SearchRequest = parsedQuery.index
        ? parsedQuery
        : { query: parsedQuery };

      // If no index specified, require it
      if (!searchBody.index) {
        throw new Error('Query must include "index" field. Example: {"index": "my-index", "query": {"match_all": {}}}');
      }

      const searchResponse = await this.client.search(searchBody);

      const rows = searchResponse.hits.hits.map((hit) => this.convertDocument(hit));
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return { columns, rows };
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof Error && (error.message.includes('Invalid query format') || error.message.includes('must include "index"'))) {
        throw error;
      }
      throw this.parseElasticsearchError(error, 'Query execution failed');
    }
  }

  async explainQuery(query: string): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      let parsedQuery: any;
      try {
        parsedQuery = JSON.parse(query);
      } catch {
        throw new Error('Invalid query format. Use JSON Query DSL.');
      }

      // For explain, we need an index and document ID, or use profile
      const searchBody: estypes.SearchRequest = parsedQuery.index
        ? { ...parsedQuery, profile: true }
        : { query: parsedQuery, profile: true };

      if (!searchBody.index) {
        throw new Error('Query must include "index" field');
      }

      const searchResponse = await this.client.search(searchBody);

      return {
        Plan: {
          'Node Type': 'Elasticsearch Profile',
          profile: searchResponse.profile,
        },
        'Planning Time': 0,
        'Execution Time': searchResponse.took || 0,
      };
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof Error && (error.message.includes('Invalid query format') || error.message.includes('must include "index"'))) {
        throw error;
      }
      throw this.parseElasticsearchError(error, 'Query explain failed');
    }
  }

  // ==================== CRUD Operations ====================

  async insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot insert: Connection is in read-only mode');
    }

    try {
      // Remove _id if present and empty
      const insertData = { ...data };
      const documentId = insertData._id as string | undefined;
      delete insertData._id;

      const response = await this.client.index({
        index: table,
        id: documentId || undefined,
        document: insertData,
        refresh: true, // Make the document immediately searchable
      });

      // Invalidate mapping cache since new fields might have been added
      this.invalidateMappingCache(table);

      // Return the indexed document with _id
      return {
        _id: response._id,
        ...insertData,
      };
    } catch (error) {
      throw this.parseElasticsearchError(error, `Failed to insert document into '${table}'`);
    }
  }

  async updateCell(
    schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot update: Connection is in read-only mode');
    }

    const documentId = primaryKey._id as string;
    if (!documentId) {
      throw new Error('Document _id is required for updates');
    }

    try {
      await this.client.update({
        index: table,
        id: documentId,
        doc: { [column]: value },
        refresh: true,
      });

      // Invalidate mapping cache since new fields might have been added
      this.invalidateMappingCache(table);
    } catch (error) {
      throw this.parseElasticsearchError(error, `Failed to update document '${documentId}'`);
    }
  }

  async deleteRows(schema: string, table: string, primaryKeys: Record<string, unknown>[]): Promise<number> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot delete: Connection is in read-only mode');
    }

    if (primaryKeys.length === 0) {
      return 0;
    }

    // Use bulk API for efficiency
    const operations = primaryKeys
      .filter(pk => pk._id)
      .flatMap(pk => [{ delete: { _index: table, _id: pk._id as string } }]);

    if (operations.length === 0) {
      return 0;
    }

    try {
      const bulkResponse = await this.client.bulk({
        operations,
        refresh: true,
      });

      let totalDeleted = 0;
      if (bulkResponse.items) {
        for (const item of bulkResponse.items) {
          if (item.delete?.result === 'deleted') {
            totalDeleted++;
          }
        }
      }

      return totalDeleted;
    } catch (error) {
      throw this.parseElasticsearchError(error, 'Failed to delete documents');
    }
  }

  // ==================== Bulk Operations (for large datasets) ====================

  async bulkInsert(
    schema: string,
    table: string,
    rows: Record<string, unknown>[],
    options: BulkInsertOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot insert: Connection is in read-only mode');
    }

    if (rows.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 1000, onProgress } = options;

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];
    const insertedIds: unknown[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

      try {
        const operations = batch.flatMap(row => {
          const insertData = { ...row };
          const documentId = insertData._id as string | undefined;
          delete insertData._id;

          return [
            { index: { _index: table, ...(documentId ? { _id: documentId } : {}) } },
            insertData
          ];
        });

        const bulkResponse = await this.client.bulk({
          operations,
          refresh: true,
        });

        if (bulkResponse.items) {
          for (const item of bulkResponse.items) {
            if (item.index?.result === 'created' || item.index?.result === 'updated') {
              successCount++;
              if (item.index._id) {
                insertedIds.push(item.index._id);
              }
            } else if (item.index?.error) {
              failureCount++;
              errors.push({ index: i, error: item.index.error.reason || 'Unknown error' });
            }
          }
        }

        onProgress?.(successCount, rows.length);
      } catch (error) {
        failureCount += batch.length;
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Invalidate mapping cache since new fields might have been added
    this.invalidateMappingCache(table);

    return { successCount, failureCount, errors: errors.length > 0 ? errors : undefined, insertedIds };
  }

  async bulkUpdate(
    schema: string,
    table: string,
    updates: BulkUpdateItem[],
    options: BulkUpdateOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot update: Connection is in read-only mode');
    }

    if (updates.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 500, onProgress } = options;

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

      try {
        const operations = batch.flatMap(update => {
          const documentId = update.primaryKey._id as string;
          if (!documentId) return [];

          return [
            { update: { _index: table, _id: documentId } },
            { doc: update.values }
          ];
        });

        if (operations.length === 0) continue;

        const bulkResponse = await this.client.bulk({
          operations,
          refresh: true,
        });

        if (bulkResponse.items) {
          for (const item of bulkResponse.items) {
            if (item.update?.result === 'updated' || item.update?.result === 'noop') {
              successCount++;
            } else if (item.update?.error) {
              failureCount++;
              errors.push({ index: i, error: item.update.error.reason || 'Unknown error' });
            }
          }
        }

        onProgress?.(successCount, updates.length);
      } catch (error) {
        failureCount += batch.length;
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Invalidate mapping cache since new fields might have been added
    this.invalidateMappingCache(table);

    return { successCount, failureCount, errors: errors.length > 0 ? errors : undefined };
  }

  async bulkDelete(
    schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[],
    options: BulkDeleteOptions = {}
  ): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    if (this.connectionConfig.readOnly) {
      throw new Error('Cannot delete: Connection is in read-only mode');
    }

    if (primaryKeys.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const { batchSize = 1000, onProgress } = options;

    let successCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < primaryKeys.length; i += batchSize) {
      const batch = primaryKeys.slice(i, Math.min(i + batchSize, primaryKeys.length));

      try {
        const operations = batch
          .filter(pk => pk._id)
          .flatMap(pk => [{ delete: { _index: table, _id: pk._id as string } }]);

        if (operations.length === 0) continue;

        const bulkResponse = await this.client.bulk({
          operations,
          refresh: true,
        });

        if (bulkResponse.items) {
          for (const item of bulkResponse.items) {
            if (item.delete?.result === 'deleted') {
              successCount++;
            } else if (item.delete?.error) {
              errors.push({ index: i, error: item.delete.error.reason || 'Unknown error' });
            }
          }
        }

        onProgress?.(successCount, primaryKeys.length);
      } catch (error) {
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { successCount, failureCount: primaryKeys.length - successCount, errors: errors.length > 0 ? errors : undefined };
  }

  // ==================== Filtering ====================

  buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR'): { whereClause: string; params: unknown[] } {
    // Elasticsearch doesn't use SQL WHERE clauses
    return { whereClause: '', params: [] };
  }

  // ==================== Metadata Operations ====================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      const info = await this.client.info();
      const health = await this.client.cluster.health();
      const stats = await this.client.cluster.stats();

      return {
        version: info.version.number,
        size: this.formatBytes(stats.indices?.store?.size_in_bytes || 0),
        tableCount: stats.indices?.count || 0,
        schemaCount: 0, // No schemas in Elasticsearch
        uptime: undefined,
        maxConnections: undefined,
        activeConnections: undefined,
        databaseName: info.cluster_name,
        encoding: 'UTF-8',
      };
    } catch (error) {
      throw this.parseElasticsearchError(error, 'Failed to get cluster information');
    }
  }

  async getDatabaseSize(): Promise<number> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    const stats = await this.client.cluster.stats();
    return stats.indices?.store?.size_in_bytes || 0;
  }

  async getObjectCounts(schema?: string): Promise<ObjectCounts> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    const tables = await this.listTables();

    return {
      tables: tables.length,
      views: 0,
      materializedViews: 0,
      functions: 0,
      procedures: 0,
      types: 0,
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    // Elasticsearch doesn't have views
    return [];
  }

  async listIndexes(schema: string, table: string): Promise<TableIndex[]> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      // Get index settings for analyzers and index configuration
      const settingsResponse = await this.client.indices.getSettings({
        index: table,
      });

      const indexSettings = settingsResponse[table];
      const settings = indexSettings?.settings?.index;

      // In Elasticsearch, the index itself IS the index, but we can show analyzed fields
      return [
        {
          name: table,
          type: 'inverted',
          columns: ['*'], // All fields are indexed by default
          isUnique: false,
          isPrimary: false,
          definition: `Shards: ${settings?.number_of_shards || 1}, Replicas: ${settings?.number_of_replicas || 0}`,
        },
      ];
    } catch (error) {
      return [];
    }
  }

  async getRunningQueries(): Promise<RunningQuery[]> {
    if (!this.client) {
      throw new Error('Not connected to Elasticsearch');
    }

    try {
      const tasks = await this.client.tasks.list({
        actions: '*search*',
        detailed: true,
      });

      const queries: RunningQuery[] = [];

      if (tasks.nodes) {
        for (const nodeId in tasks.nodes) {
          const node = tasks.nodes[nodeId];
          if (node.tasks) {
            for (const taskId in node.tasks) {
              const task = node.tasks[taskId];
              queries.push({
                pid: taskId,
                user: node.name || 'unknown',
                query: task.description || task.action,
                state: task.status ? JSON.stringify(task.status) : 'running',
                duration: `${task.running_time_in_nanos ? task.running_time_in_nanos / 1000000 : 0}ms`,
                waitEvent: null,
              });
            }
          }
        }
      }

      return queries;
    } catch (error) {
      return [];
    }
  }

  async getERDiagram(schema?: string): Promise<ERDiagramData> {
    // Elasticsearch doesn't have relationships
    return {
      tables: [],
      relationships: [],
    };
  }

  // ==================== Helper Methods ====================

  quoteIdentifier(identifier: string): string {
    // Elasticsearch doesn't require quoting
    return identifier;
  }

  formatParameter(index: number): string {
    // Elasticsearch doesn't use parameter placeholders
    return `$${index}`;
  }

  private buildClientOptions(): any {
    const config = this.connectionConfig;
    const options: any = {};

    // Set node(s)
    if (config.cloudId) {
      options.cloud = { id: config.cloudId };
    } else if (config.nodes && config.nodes.length > 0) {
      options.nodes = config.nodes;
    } else if (config.node) {
      options.node = config.node;
    } else {
      // Default to localhost
      options.node = 'http://localhost:9200';
    }

    // Authentication
    if (config.apiKey) {
      options.auth = { apiKey: config.apiKey };
    } else if (config.username && config.password) {
      options.auth = {
        username: config.username,
        password: config.password,
      };
    }

    // TLS options
    if (config.ssl || config.caFingerprint) {
      options.tls = {};
      if (config.caFingerprint) {
        options.caFingerprint = config.caFingerprint;
      }
      if (config.rejectUnauthorized === false) {
        options.tls.rejectUnauthorized = false;
      }
    }

    // Timeouts
    if (config.requestTimeout) {
      options.requestTimeout = config.requestTimeout;
    }
    if (config.pingTimeout) {
      options.pingTimeout = config.pingTimeout;
    }
    if (config.maxRetries !== undefined) {
      options.maxRetries = config.maxRetries;
    }

    return options;
  }

  /**
   * Build Elasticsearch query from filter conditions.
   * Uses metadata to determine correct field names for text fields.
   */
  private buildElasticsearchQuery(
    filters: FilterCondition[],
    logic: 'AND' | 'OR',
    metadata: ColumnMetadata[] = []
  ): estypes.QueryDslQueryContainer {
    if (filters.length === 0) {
      return { match_all: {} };
    }

    const queries: estypes.QueryDslQueryContainer[] = [];

    for (const filter of filters) {
      const { columnName, operator, value, value2 } = filter;

      // Get the correct field name based on field type and operator
      const { field, useMatch } = this.getFilterFieldName(columnName, operator, metadata);

      switch (operator) {
        case 'equals':
          if (useMatch) {
            // Use match query for text fields without .keyword
            queries.push({ match: { [field]: { query: String(value), operator: 'and' } } });
          } else {
            queries.push({ term: { [field]: { value } } });
          }
          break;
        case 'not_equals':
          if (useMatch) {
            queries.push({
              bool: { must_not: [{ match: { [field]: { query: String(value), operator: 'and' } } }] },
            });
          } else {
            queries.push({
              bool: { must_not: [{ term: { [field]: { value } } }] },
            });
          }
          break;
        case 'contains':
          if (useMatch) {
            // Use match query for text fields - better for full-text search
            queries.push({ match: { [field]: { query: String(value) } } });
          } else {
            // Use wildcard for keyword fields - escape special chars to prevent injection
            const escapedContains = this.escapeWildcard(String(value));
            queries.push({
              wildcard: { [field]: { value: `*${escapedContains}*`, case_insensitive: true } },
            });
          }
          break;
        case 'not_contains':
          if (useMatch) {
            queries.push({
              bool: { must_not: [{ match: { [field]: { query: String(value) } } }] },
            });
          } else {
            const escapedNotContains = this.escapeWildcard(String(value));
            queries.push({
              bool: {
                must_not: [{ wildcard: { [field]: { value: `*${escapedNotContains}*`, case_insensitive: true } } }],
              },
            });
          }
          break;
        case 'starts_with':
          queries.push({
            prefix: { [field]: { value: String(value), case_insensitive: true } },
          });
          break;
        case 'ends_with':
          // Escape special chars to prevent wildcard injection
          const escapedEndsWith = this.escapeWildcard(String(value));
          queries.push({
            wildcard: { [field]: { value: `*${escapedEndsWith}`, case_insensitive: true } },
          });
          break;
        case 'greater_than':
          queries.push({ range: { [columnName]: { gt: value } } });
          break;
        case 'less_than':
          queries.push({ range: { [columnName]: { lt: value } } });
          break;
        case 'greater_or_equal':
          queries.push({ range: { [columnName]: { gte: value } } });
          break;
        case 'less_or_equal':
          queries.push({ range: { [columnName]: { lte: value } } });
          break;
        case 'is_null':
          queries.push({
            bool: { must_not: [{ exists: { field: columnName } }] },
          });
          break;
        case 'is_not_null':
          queries.push({ exists: { field: columnName } });
          break;
        case 'in':
          const values = Array.isArray(value)
            ? value
            : String(value)
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v !== '');
          if (values.length > 0) {
            queries.push({ terms: { [field]: values } });
          }
          break;
        case 'between':
          queries.push({ range: { [columnName]: { gte: value, lte: value2 } } });
          break;
      }
    }

    if (queries.length === 0) {
      return { match_all: {} };
    }

    if (logic === 'OR') {
      return { bool: { should: queries, minimum_should_match: 1 } };
    } else {
      return { bool: { must: queries } };
    }
  }

  private collectMappingFields(
    properties: Record<string, any>,
    columns: ColumnMetadata[],
    prefix: string
  ): void {
    // Field types that are sortable in Elasticsearch
    const sortableTypes = new Set([
      'keyword', 'long', 'integer', 'short', 'byte', 'double', 'float',
      'half_float', 'scaled_float', 'date', 'boolean', 'ip',
    ]);

    // Field types that are NOT sortable
    const unsortableTypes = new Set([
      'object', 'nested', 'binary', 'geo_point', 'geo_shape', 'completion',
      'percolator', 'join', 'rank_feature', 'rank_features', 'dense_vector',
      'sparse_vector', 'flattened', 'shape', 'histogram',
    ]);

    for (const fieldName in properties) {
      const field = properties[fieldName];
      const fullName = prefix ? `${prefix}.${fieldName}` : fieldName;

      const esType = field.type || (field.properties ? 'object' : 'unknown');
      const hasKeywordSubField = field.fields?.keyword !== undefined;

      // Determine sortability and filter field
      let sortable = false;
      let sortField: string | undefined = undefined;

      if (esType === 'text') {
        // Text fields: only sortable if they have a .keyword sub-field
        if (hasKeywordSubField) {
          sortable = true;
          sortField = `${fullName}.keyword`;
        }
        // else: not sortable (text fields without keyword can't be sorted)
      } else if (sortableTypes.has(esType)) {
        // These types are directly sortable
        sortable = true;
        sortField = fullName;
      } else if (unsortableTypes.has(esType)) {
        // Explicitly unsortable types
        sortable = false;
      } else {
        // Unknown types: default to sortable (let Elasticsearch decide)
        sortable = true;
        sortField = fullName;
      }

      // Store field info in the mapping cache for filter field lookup
      // We'll use a custom property to store the ES type and keyword availability
      const columnMeta: ColumnMetadata & { _esType?: string; _hasKeyword?: boolean } = {
        name: fullName,
        type: this.mapElasticsearchType(esType),
        nullable: true, // All fields are nullable in Elasticsearch
        defaultValue: null,
        isPrimaryKey: false,
        isForeignKey: false,
        foreignKeyRef: null,
        isAutoIncrement: false,
        isGenerated: false,
        editable: true,
        sortable,
        sortField,
      };

      // Store ES-specific info for filter field resolution
      (columnMeta as any)._esType = esType;
      (columnMeta as any)._hasKeyword = hasKeywordSubField;

      columns.push(columnMeta);

      // Recursively collect nested fields
      if (field.properties) {
        this.collectMappingFields(field.properties, columns, fullName);
      }
    }
  }

  /**
   * Get the appropriate field name for filtering based on operator and field type.
   * For text fields with exact match operators, uses .keyword sub-field.
   */
  private getFilterFieldName(
    columnName: string,
    operator: string,
    metadata: ColumnMetadata[]
  ): { field: string; useMatch: boolean } {
    const columnMeta = metadata.find((m) => m.name === columnName) as any;

    if (!columnMeta) {
      // Field not in metadata, use as-is
      return { field: columnName, useMatch: false };
    }

    const esType = columnMeta._esType;
    const hasKeyword = columnMeta._hasKeyword;

    // Operators that require exact matching (term/terms queries)
    const exactMatchOperators = ['equals', 'not_equals', 'in', 'starts_with', 'ends_with'];

    if (esType === 'text') {
      if (exactMatchOperators.includes(operator)) {
        // For exact matches on text fields, use .keyword if available
        if (hasKeyword) {
          return { field: `${columnName}.keyword`, useMatch: false };
        }
        // No keyword sub-field - for equals/in, fall back to match query
        if (operator === 'equals') {
          return { field: columnName, useMatch: true };
        }
        // For other operators without keyword, use the field as-is (may not work perfectly)
        return { field: columnName, useMatch: false };
      }
      // For contains/not_contains, use match query on text fields for better results
      if (operator === 'contains' || operator === 'not_contains') {
        return { field: columnName, useMatch: true };
      }
    }

    // Non-text fields or other operators - use field as-is
    return { field: columnName, useMatch: false };
  }

  private mapElasticsearchType(esType: string): string {
    const typeMap: Record<string, string> = {
      text: 'text',
      keyword: 'keyword',
      long: 'long',
      integer: 'integer',
      short: 'short',
      byte: 'byte',
      double: 'double',
      float: 'float',
      half_float: 'half_float',
      scaled_float: 'scaled_float',
      date: 'date',
      boolean: 'boolean',
      binary: 'binary',
      integer_range: 'integer_range',
      float_range: 'float_range',
      long_range: 'long_range',
      double_range: 'double_range',
      date_range: 'date_range',
      object: 'object',
      nested: 'nested',
      geo_point: 'geo_point',
      geo_shape: 'geo_shape',
      ip: 'ip',
      completion: 'completion',
      token_count: 'token_count',
      percolator: 'percolator',
      join: 'join',
      rank_feature: 'rank_feature',
      rank_features: 'rank_features',
      dense_vector: 'dense_vector',
      sparse_vector: 'sparse_vector',
      search_as_you_type: 'search_as_you_type',
      alias: 'alias',
      flattened: 'flattened',
      shape: 'shape',
      histogram: 'histogram',
    };

    return typeMap[esType] || esType;
  }

  private getDefaultMetadata(): ColumnMetadata[] {
    return [
      {
        name: '_id',
        type: 'keyword',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: true,
        isForeignKey: false,
        foreignKeyRef: null,
        isAutoIncrement: true,
        isGenerated: true,
        editable: false,
        sortable: false,
        sortField: undefined,
      },
    ];
  }

  private convertDocument(hit: estypes.SearchHit<unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {
      _id: hit._id,
    };

    // Flatten the source document
    const source = hit._source as Record<string, unknown> | undefined;
    if (source) {
      for (const key in source) {
        const value = source[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Convert nested objects to JSON string for display
          result[key] = JSON.stringify(value);
        } else if (Array.isArray(value)) {
          // Convert arrays to JSON string for display
          result[key] = JSON.stringify(value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  private parseSizeToBytes(size: string): number {
    if (!size) return 0;

    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^([\d.]+)\s*([a-z]+)$/);
    if (!match) return parseInt(size, 10) || 0;

    const [, value, unit] = match;
    return Math.round(parseFloat(value) * (units[unit] || 1));
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Escape special wildcard characters in Elasticsearch wildcard queries.
   * Prevents injection and ensures literal character matching.
   * Elasticsearch wildcards: * (matches any sequence) and ? (matches single char)
   */
  private escapeWildcard(str: string): string {
    // Escape backslash first, then wildcard special chars
    return str.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\?/g, '\\?');
  }

  /**
   * Parse Elasticsearch errors and return user-friendly error messages.
   * Handles common Elasticsearch-specific error scenarios.
   */
  private parseElasticsearchError(error: unknown, context?: string): Error {
    const contextPrefix = context ? `${context}: ` : '';

    if (error instanceof Error) {
      const errorMessage = error.message || '';
      const errorName = error.name || '';
      const anyError = error as any;

      // Connection errors
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect ECONNREFUSED')) {
        return new Error(`${contextPrefix}Unable to connect to Elasticsearch. Please check if the server is running and the URL is correct.`);
      }

      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo ENOTFOUND')) {
        return new Error(`${contextPrefix}Elasticsearch host not found. Please check the server address.`);
      }

      if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('connect ETIMEDOUT')) {
        return new Error(`${contextPrefix}Connection to Elasticsearch timed out. The server may be overloaded or unreachable.`);
      }

      if (errorMessage.includes('socket hang up') || errorMessage.includes('ECONNRESET')) {
        return new Error(`${contextPrefix}Connection to Elasticsearch was reset. The server may have closed the connection.`);
      }

      // Authentication errors
      if (anyError.statusCode === 401 || errorMessage.includes('security_exception') || errorMessage.includes('Unauthorized')) {
        return new Error(`${contextPrefix}Authentication failed. Please check your username, password, or API key.`);
      }

      if (anyError.statusCode === 403 || errorMessage.includes('authorization_exception')) {
        return new Error(`${contextPrefix}Access denied. You don't have permission to perform this operation.`);
      }

      // Index not found
      if (anyError.statusCode === 404 || errorMessage.includes('index_not_found_exception')) {
        const indexMatch = errorMessage.match(/\[([^\]]+)\]/);
        const indexName = indexMatch ? indexMatch[1] : 'unknown';
        return new Error(`${contextPrefix}Index '${indexName}' not found. It may have been deleted or renamed.`);
      }

      // Mapping/field errors
      if (errorMessage.includes('illegal_argument_exception') && errorMessage.includes('fielddata')) {
        return new Error(`${contextPrefix}Cannot sort or aggregate on a text field without a keyword sub-field. Consider updating the index mapping.`);
      }

      if (errorMessage.includes('mapper_parsing_exception')) {
        return new Error(`${contextPrefix}Invalid document structure. The data doesn't match the expected mapping format.`);
      }

      if (errorMessage.includes('strict_dynamic_mapping_exception')) {
        return new Error(`${contextPrefix}Cannot add new field. The index has strict mapping and doesn't allow dynamic fields.`);
      }

      // Query errors
      if (errorMessage.includes('query_shard_exception') || errorMessage.includes('parsing_exception')) {
        return new Error(`${contextPrefix}Invalid query. Please check your search syntax.`);
      }

      if (errorMessage.includes('too_many_clauses') || errorMessage.includes('maxClauseCount')) {
        return new Error(`${contextPrefix}Query is too complex. Try using more specific filters or reducing the search scope.`);
      }

      if (errorMessage.includes('script_exception')) {
        return new Error(`${contextPrefix}Script execution failed. Please check your script syntax.`);
      }

      // Resource errors
      if (errorMessage.includes('circuit_breaking_exception') || errorMessage.includes('CircuitBreakingException')) {
        return new Error(`${contextPrefix}Elasticsearch is under memory pressure. Try reducing the query size or complexity.`);
      }

      if (errorMessage.includes('rejected_execution_exception') || errorMessage.includes('EsRejectedExecutionException')) {
        return new Error(`${contextPrefix}Elasticsearch queue is full. The server is overloaded. Please try again later.`);
      }

      if (errorMessage.includes('search_phase_execution_exception')) {
        // Try to extract the root cause
        if (anyError.meta?.body?.error?.root_cause?.[0]?.reason) {
          return new Error(`${contextPrefix}Search failed: ${anyError.meta.body.error.root_cause[0].reason}`);
        }
        return new Error(`${contextPrefix}Search execution failed. Please simplify your query or try again.`);
      }

      // Version conflict (optimistic concurrency)
      if (errorMessage.includes('version_conflict_engine_exception')) {
        return new Error(`${contextPrefix}Document was modified by another process. Please refresh and try again.`);
      }

      // Timeout errors
      if (anyError.statusCode === 408 || errorMessage.includes('SearchTimeoutException') || errorMessage.includes('es_rejected_execution_exception')) {
        return new Error(`${contextPrefix}Request timed out. The query may be too complex or the server is overloaded.`);
      }

      // Cluster state errors
      if (errorMessage.includes('cluster_block_exception')) {
        if (errorMessage.includes('read-only')) {
          return new Error(`${contextPrefix}Index is in read-only mode. This usually happens when disk space is low.`);
        }
        return new Error(`${contextPrefix}Cluster is blocked. Please check cluster health.`);
      }

      if (errorMessage.includes('master_not_discovered_exception') || errorMessage.includes('NoNodeAvailableException')) {
        return new Error(`${contextPrefix}No Elasticsearch nodes available. The cluster may be down or unreachable.`);
      }

      // SSL/TLS errors
      if (errorMessage.includes('CERT_') || errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
        return new Error(`${contextPrefix}SSL/TLS certificate error. Check your SSL settings or certificate configuration.`);
      }

      // Return the original error message if we can't parse it specifically
      return new Error(`${contextPrefix}${errorMessage}`);
    }

    // Non-Error objects
    return new Error(`${contextPrefix}${String(error)}`);
  }

  /**
   * Wrap an async operation with Elasticsearch-specific error handling.
   */
  private async withErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.parseElasticsearchError(error, context);
    }
  }
}
