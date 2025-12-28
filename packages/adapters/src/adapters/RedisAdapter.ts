/**
 * Redis Database Adapter
 *
 * Maps Redis concepts to browsable data:
 * - Redis Databases (0-15) → Databases
 * - Key types (string, hash, list, set, zset, stream) → Categories
 * - Keys grouped by prefix → Key Groups
 *
 * Display strategy per type:
 * - STRING: key, value
 * - HASH: key, field1, field2, ... (fields as columns)
 * - LIST: key, index, value
 * - SET: key, member
 * - ZSET: key, member, score
 * - STREAM: key, id, field1, field2, ...
 */

import { EventEmitter } from "events";
import Redis from "ioredis";
import type { RedisConnectionConfig } from "@dbview/types";
import type {
  DatabaseAdapter,
  ConnectionStatus,
  ConnectionStatusEvent,
  ColumnInfo,
  ColumnMetadata,
  TableStatistics,
  ObjectCounts,
  DatabaseInfo,
  QueryResultSet,
  DatabaseCapabilities,
  DatabaseHierarchy,
  TableInfo,
  FetchOptions,
  FilterCondition,
  FilterOptions,
} from "./DatabaseAdapter";

// Redis key types
type RedisKeyType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'none';

// Type display names and icons
const TYPE_INFO: Record<RedisKeyType, { name: string; icon: string }> = {
  string: { name: 'Strings', icon: '🔤' },
  hash: { name: 'Hashes', icon: '#️⃣' },
  list: { name: 'Lists', icon: '📋' },
  set: { name: 'Sets', icon: '🔘' },
  zset: { name: 'Sorted Sets', icon: '📊' },
  stream: { name: 'Streams', icon: '📜' },
  none: { name: 'None', icon: '❓' },
};

export class RedisAdapter extends EventEmitter implements DatabaseAdapter {
  readonly type = "redis" as const;
  private client: Redis | null = null;
  private _status: ConnectionStatus = "disconnected";
  private _lastError: Error | undefined;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly connectionConfig: RedisConnectionConfig;

  readonly capabilities: DatabaseCapabilities = {
    // Hierarchy
    supportsSchemas: false,
    supportsDatabases: true, // Redis DB 0-15
    supportsInstances: false,

    // Objects
    supportsTables: false, // Redis uses keys, not tables
    supportsViews: false,
    supportsMaterializedViews: false,
    supportsFunctions: false,
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: false,
    supportsTriggers: false,

    // Features
    supportsSQL: false,
    supportsExplainPlan: false,
    supportsForeignKeys: false,
    supportsJSON: true, // Redis supports JSON module
    supportsArrays: true, // Redis lists
    supportsTransactions: true, // MULTI/EXEC

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

  constructor(config: RedisConnectionConfig) {
    super();
    this.connectionConfig = config;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  set status(value: ConnectionStatus) {
    if (this._status !== value) {
      this._status = value;
      this.emit("statusChange", {
        status: value,
        error: this._lastError,
      } as ConnectionStatusEvent);
    }
  }

  get lastError(): Error | undefined {
    return this._lastError;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testClient = this.createClient();
      await testClient.ping();
      await testClient.quit();
      return { success: true, message: "Connection successful" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    }
  }

  async connect(): Promise<void> {
    if (this.client && this._status === "connected") {
      return;
    }

    this.status = "connecting";

    try {
      this.client = this.createClient();

      // Test the connection
      await this.client.ping();

      // Select the specified database (default: 0)
      const dbIndex = this.connectionConfig.database ?? 0;
      if (dbIndex > 0) {
        await this.client.select(dbIndex);
      }

      this.status = "connected";
      this._lastError = undefined;
    } catch (error) {
      this._lastError = error instanceof Error ? error : new Error(String(error));
      this.status = "error";
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.client = null;
    }

    this.status = "disconnected";
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  async reconnect(): Promise<boolean> {
    try {
      await this.disconnect();
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  startHealthCheck(intervalMs: number = 30000): void {
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(async () => {
      if (this._status === "connected") {
        try {
          const isAlive = await this.ping();
          if (!isAlive) {
            this._lastError = new Error("Health check failed");
            this.status = "error";
          }
        } catch (error) {
          console.error('[RedisAdapter] Health check error:', error);
          this._lastError = error instanceof Error ? error : new Error(String(error));
          this.status = "error";
        }
      }
    }, intervalMs);
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  dispose(): void {
    this.stopHealthCheck();
    this.removeAllListeners();
    if (this.client) {
      this.client.quit().catch(() => {});
      this.client = null;
    }
  }

  // ============================================
  // Hierarchy Methods
  // ============================================

  async getHierarchy(): Promise<DatabaseHierarchy> {
    return {
      type: "database-based",
      levels: ["database", "table"],
      systemSchemas: [],
    };
  }

  async listDatabases(): Promise<string[]> {
    // Redis has 16 databases by default (0-15)
    return Array.from({ length: 16 }, (_, i) => `db${i}`);
  }

  async listSchemas(_database?: string): Promise<string[]> {
    // Redis doesn't have schemas
    return [];
  }

  /**
   * List all keys grouped by type and prefix
   * Returns format: "[type] prefix" (e.g., "[hash] user", "[string] cache")
   */
  async listTables(_schema: string): Promise<TableInfo[]> {
    if (!this.client) throw new Error("Not connected");

    // Scan all keys and group by type and prefix
    const keyGroups = new Map<string, { type: RedisKeyType; count: number }>();
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, "COUNT", 1000);
      cursor = nextCursor;

      for (const key of keys) {
        const keyType = await this.client.type(key) as RedisKeyType;
        if (keyType === 'none') continue;

        // Extract prefix (everything before the last colon, or the whole key for singles)
        const colonIndex = key.lastIndexOf(":");
        let prefix: string;
        let groupKey: string;

        if (colonIndex > 0) {
          prefix = key.substring(0, colonIndex);
          groupKey = `[${keyType}] ${prefix}`;
        } else {
          // Single key without prefix - show as individual
          prefix = key;
          groupKey = `[${keyType}] ${key}`;
        }

        const existing = keyGroups.get(groupKey);
        if (existing) {
          existing.count++;
        } else {
          keyGroups.set(groupKey, { type: keyType, count: 1 });
        }
      }
    } while (cursor !== "0");

    // Sort by type first, then by name
    const typeOrder: RedisKeyType[] = ['hash', 'string', 'list', 'set', 'zset', 'stream'];

    return Array.from(keyGroups.entries())
      .sort(([a, aInfo], [b, bInfo]) => {
        const aTypeIdx = typeOrder.indexOf(aInfo.type);
        const bTypeIdx = typeOrder.indexOf(bInfo.type);
        if (aTypeIdx !== bTypeIdx) return aTypeIdx - bTypeIdx;
        return a.localeCompare(b);
      })
      .map(([name, info]) => ({
        name,
        rowCount: info.count,
      }));
  }

  async listViews(_schema: string): Promise<string[]> {
    return [];
  }

  async listMaterializedViews(_schema: string): Promise<string[]> {
    return [];
  }

  async listFunctions(_schema: string): Promise<string[]> {
    return [];
  }

  async listProcedures(_schema: string): Promise<string[]> {
    return [];
  }

  async listTypes(_schema: string): Promise<string[]> {
    return [];
  }

  // ============================================
  // Key/Data Methods
  // ============================================

  /**
   * Parse table name to extract type and prefix
   * Format: "[type] prefix"
   */
  private parseTableName(table: string): { type: RedisKeyType; prefix: string } {
    const match = table.match(/^\[(\w+)\]\s+(.+)$/);
    if (match) {
      return { type: match[1] as RedisKeyType, prefix: match[2] };
    }
    // Fallback for old format
    return { type: 'hash', prefix: table };
  }

  async getTableMetadata(_schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.client) throw new Error("Not connected");

    const { type, prefix } = this.parseTableName(table);
    return this.getColumnsForType(type, prefix);
  }

  async listColumns(_schema: string, table: string): Promise<ColumnInfo[]> {
    const metadata = await this.getTableMetadata(_schema, table);
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
    _schema: string,
    table: string,
    options?: FetchOptions
  ): Promise<QueryResultSet> {
    if (!this.client) throw new Error("Not connected");

    const { type, prefix } = this.parseTableName(table);
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    switch (type) {
      case 'string':
        return this.fetchStringKeys(prefix, limit, offset);
      case 'hash':
        return this.fetchHashKeys(prefix, limit, offset);
      case 'list':
        return this.fetchListKeys(prefix, limit, offset);
      case 'set':
        return this.fetchSetKeys(prefix, limit, offset);
      case 'zset':
        return this.fetchZSetKeys(prefix, limit, offset);
      case 'stream':
        return this.fetchStreamKeys(prefix, limit, offset);
      default:
        return { columns: ['key', 'value'], rows: [] };
    }
  }

  // ============================================
  // Fetch methods for each Redis type
  // ============================================

  private async fetchStringKeys(prefix: string, limit: number, offset: number): Promise<QueryResultSet> {
    const keys = await this.scanKeysOfType(prefix, 'string');
    const paginatedKeys = keys.slice(offset, offset + limit);

    const rows: Record<string, unknown>[] = [];
    for (const key of paginatedKeys) {
      const value = await this.client!.get(key);
      rows.push({ _key: key, value: value ?? '(nil)' });
    }

    return {
      columns: ['_key', 'value'],
      rows,
    };
  }

  private async fetchHashKeys(prefix: string, limit: number, offset: number): Promise<QueryResultSet> {
    const keys = await this.scanKeysOfType(prefix, 'hash');
    const paginatedKeys = keys.slice(offset, offset + limit);

    // Collect all field names from sampled hashes
    const fieldSet = new Set<string>();
    const sampleKeys = keys.slice(0, 100);
    for (const key of sampleKeys) {
      const fields = await this.client!.hkeys(key);
      fields.forEach(f => fieldSet.add(f));
    }

    const sortedFields = Array.from(fieldSet).sort();
    const columns = ['_key', ...sortedFields];

    const rows: Record<string, unknown>[] = [];
    for (const key of paginatedKeys) {
      const hashData = await this.client!.hgetall(key);
      rows.push({ _key: key, ...hashData });
    }

    return { columns, rows };
  }

  private async fetchListKeys(prefix: string, limit: number, offset: number): Promise<QueryResultSet> {
    const keys = await this.scanKeysOfType(prefix, 'list');

    const rows: Record<string, unknown>[] = [];
    let totalItems = 0;

    for (const key of keys) {
      const listLen = await this.client!.llen(key);

      // Get items from this list
      const items = await this.client!.lrange(key, 0, -1);
      for (let i = 0; i < items.length; i++) {
        if (totalItems >= offset && rows.length < limit) {
          rows.push({ _key: key, _index: i, value: items[i] });
        }
        totalItems++;
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }

    return {
      columns: ['_key', '_index', 'value'],
      rows,
    };
  }

  private async fetchSetKeys(prefix: string, limit: number, offset: number): Promise<QueryResultSet> {
    const keys = await this.scanKeysOfType(prefix, 'set');

    const rows: Record<string, unknown>[] = [];
    let totalItems = 0;

    for (const key of keys) {
      const members = await this.client!.smembers(key);
      for (const member of members) {
        if (totalItems >= offset && rows.length < limit) {
          rows.push({ _key: key, member });
        }
        totalItems++;
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }

    return {
      columns: ['_key', 'member'],
      rows,
    };
  }

  private async fetchZSetKeys(prefix: string, limit: number, offset: number): Promise<QueryResultSet> {
    const keys = await this.scanKeysOfType(prefix, 'zset');

    const rows: Record<string, unknown>[] = [];
    let totalItems = 0;

    for (const key of keys) {
      const membersWithScores = await this.client!.zrange(key, 0, -1, 'WITHSCORES');

      // Parse pairs: [member1, score1, member2, score2, ...]
      for (let i = 0; i < membersWithScores.length; i += 2) {
        if (totalItems >= offset && rows.length < limit) {
          rows.push({
            _key: key,
            member: membersWithScores[i],
            score: parseFloat(membersWithScores[i + 1]),
          });
        }
        totalItems++;
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }

    return {
      columns: ['_key', 'member', 'score'],
      rows,
    };
  }

  private async fetchStreamKeys(prefix: string, limit: number, offset: number): Promise<QueryResultSet> {
    const keys = await this.scanKeysOfType(prefix, 'stream');

    const rows: Record<string, unknown>[] = [];
    const fieldSet = new Set<string>();
    let totalItems = 0;

    // First pass: collect all field names
    for (const key of keys.slice(0, 10)) {
      const entries = await this.client!.xrange(key, '-', '+', 'COUNT', 100);
      for (const [_id, fields] of entries) {
        for (let i = 0; i < fields.length; i += 2) {
          fieldSet.add(fields[i]);
        }
      }
    }

    const sortedFields = Array.from(fieldSet).sort();

    // Second pass: fetch data
    for (const key of keys) {
      const entries = await this.client!.xrange(key, '-', '+');

      for (const [id, fields] of entries) {
        if (totalItems >= offset && rows.length < limit) {
          const row: Record<string, unknown> = { _key: key, _id: id };
          for (let i = 0; i < fields.length; i += 2) {
            row[fields[i]] = fields[i + 1];
          }
          rows.push(row);
        }
        totalItems++;
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }

    return {
      columns: ['_key', '_id', ...sortedFields],
      rows,
    };
  }

  /**
   * Scan keys matching a prefix and type
   */
  private async scanKeysOfType(prefix: string, targetType: RedisKeyType): Promise<string[]> {
    if (!this.client) return [];

    const keys: string[] = [];
    let cursor = "0";

    // Check if prefix contains a colon - if so, it's a group pattern
    const pattern = prefix.includes(':') || prefix.endsWith('*')
      ? `${prefix}:*`
      : `${prefix}*`;

    do {
      const [nextCursor, scanKeys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        1000
      );
      cursor = nextCursor;

      for (const key of scanKeys) {
        const keyType = await this.client.type(key);
        if (keyType === targetType) {
          keys.push(key);
        }
      }
    } while (cursor !== "0");

    // Also check for exact match (single key without suffix)
    try {
      const exactType = await this.client.type(prefix);
      if (exactType === targetType && !keys.includes(prefix)) {
        keys.unshift(prefix);
      }
    } catch {
      // Ignore errors for exact match check
    }

    return keys.sort();
  }

  /**
   * Get column metadata for a specific Redis type
   */
  private async getColumnsForType(type: RedisKeyType, prefix: string): Promise<ColumnMetadata[]> {
    const baseColumn: ColumnMetadata = {
      name: "_key",
      type: "string",
      nullable: false,
      defaultValue: null,
      isPrimaryKey: true,
      isForeignKey: false,
      foreignKeyRef: null,
      isAutoIncrement: false,
      isGenerated: false,
      editable: false,
    };

    switch (type) {
      case 'string':
        return [
          baseColumn,
          { ...baseColumn, name: 'value', isPrimaryKey: false, editable: true },
        ];

      case 'hash':
        const hashFields = await this.inferHashFields(prefix);
        return [
          baseColumn,
          ...hashFields.map(name => ({
            ...baseColumn,
            name,
            isPrimaryKey: false,
            nullable: true,
            editable: true,
          })),
        ];

      case 'list':
        return [
          baseColumn,
          { ...baseColumn, name: '_index', type: 'integer', isPrimaryKey: false, editable: false },
          { ...baseColumn, name: 'value', isPrimaryKey: false, editable: true },
        ];

      case 'set':
        return [
          baseColumn,
          { ...baseColumn, name: 'member', isPrimaryKey: false, editable: false },
        ];

      case 'zset':
        return [
          baseColumn,
          { ...baseColumn, name: 'member', isPrimaryKey: false, editable: false },
          { ...baseColumn, name: 'score', type: 'number', isPrimaryKey: false, editable: true },
        ];

      case 'stream':
        return [
          baseColumn,
          { ...baseColumn, name: '_id', isPrimaryKey: false, editable: false },
          // Stream fields are dynamic, we'd need to sample
        ];

      default:
        return [baseColumn];
    }
  }

  private async inferHashFields(prefix: string): Promise<string[]> {
    if (!this.client) return [];

    const fieldSet = new Set<string>();
    const keys = await this.scanKeysOfType(prefix, 'hash');

    // Sample up to 100 hashes to collect all fields
    for (const key of keys.slice(0, 100)) {
      const fields = await this.client.hkeys(key);
      fields.forEach(f => fieldSet.add(f));
    }

    return Array.from(fieldSet).sort();
  }

  async getTableRowCount(_schema: string, table: string, _options?: FilterOptions): Promise<number> {
    if (!this.client) return 0;

    const { type, prefix } = this.parseTableName(table);
    const keys = await this.scanKeysOfType(prefix, type);

    // For list/set/zset, count individual items
    if (type === 'list') {
      let total = 0;
      for (const key of keys) {
        total += await this.client.llen(key);
      }
      return total;
    } else if (type === 'set') {
      let total = 0;
      for (const key of keys) {
        total += await this.client.scard(key);
      }
      return total;
    } else if (type === 'zset') {
      let total = 0;
      for (const key of keys) {
        total += await this.client.zcard(key);
      }
      return total;
    } else if (type === 'stream') {
      let total = 0;
      for (const key of keys) {
        total += await this.client.xlen(key);
      }
      return total;
    }

    return keys.length;
  }

  async getTableStatistics(_schema: string, table: string): Promise<TableStatistics> {
    const rowCount = await this.getTableRowCount(_schema, table);

    return {
      rowCount,
      totalSize: "N/A",
      tableSize: "N/A",
      indexesSize: "N/A",
    };
  }

  async getObjectCounts(_schema: string): Promise<ObjectCounts> {
    if (!this.client) {
      return { tables: 0, views: 0, materializedViews: 0, functions: 0, procedures: 0, types: 0 };
    }

    const tables = await this.listTables(_schema);
    return {
      tables: tables.length,
      views: 0,
      materializedViews: 0,
      functions: 0,
      procedures: 0,
      types: 0,
    };
  }

  // ============================================
  // Database Info Methods
  // ============================================

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    if (!this.client) throw new Error("Not connected");

    const info = await this.client.info();
    const infoLines = info.split("\n");
    const infoMap: Record<string, string> = {};

    for (const line of infoLines) {
      const [key, value] = line.split(":");
      if (key && value) {
        infoMap[key.trim()] = value.trim();
      }
    }

    const dbKeys = await this.client.dbsize();

    return {
      version: infoMap["redis_version"] || "Unknown",
      size: this.formatBytes(parseInt(infoMap["used_memory"] || "0", 10)),
      tableCount: dbKeys,
      schemaCount: 0,
      uptime: this.formatDuration(parseInt(infoMap["uptime_in_seconds"] || "0", 10)),
      maxConnections: parseInt(infoMap["maxclients"] || "0", 10),
      activeConnections: parseInt(infoMap["connected_clients"] || "0", 10),
      databaseName: `db${this.connectionConfig.database ?? 0}`,
    };
  }

  async getDatabaseSize(): Promise<number> {
    if (!this.client) throw new Error("Not connected");

    const info = await this.client.info("memory");
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ============================================
  // Query Methods
  // ============================================

  async runQuery(command: string): Promise<QueryResultSet> {
    if (!this.client) throw new Error("Not connected");

    try {
      // Parse the Redis command - handle quoted strings properly
      const parts = this.parseRedisCommand(command);
      const cmd = parts[0].toUpperCase();
      const args = parts.slice(1);

      // Execute the command
      const result = await (this.client as any).call(cmd, ...args);

      // Format result based on type
      let rows: Record<string, unknown>[] = [];
      let columns: string[] = [];

      if (result === null) {
        rows = [{ result: "(nil)" }];
        columns = ["result"];
      } else if (typeof result === "string" || typeof result === "number") {
        rows = [{ result }];
        columns = ["result"];
      } else if (Array.isArray(result)) {
        if (result.length === 0) {
          rows = [{ result: "(empty array)" }];
          columns = ["result"];
        } else if (typeof result[0] === "object") {
          rows = result as Record<string, unknown>[];
          columns = Object.keys(result[0]);
        } else {
          rows = result.map((item, index) => ({ index, value: item }));
          columns = ["index", "value"];
        }
      } else if (typeof result === "object") {
        rows = [result as Record<string, unknown>];
        columns = Object.keys(result);
      }

      return { columns, rows };
    } catch (error) {
      throw new Error(`Redis command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================
  // CRUD Methods
  // ============================================

  async updateCell(
    _schema: string,
    table: string,
    primaryKey: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> {
    if (!this.client) throw new Error("Not connected");
    if (this.connectionConfig.readOnly) {
      throw new Error("Cannot update: connection is read-only");
    }

    const { type } = this.parseTableName(table);
    const key = primaryKey._key as string;
    if (!key) {
      throw new Error("Primary key (_key) is required for update");
    }

    switch (type) {
      case 'string':
        if (column === 'value') {
          await this.client.set(key, String(value));
        }
        break;
      case 'hash':
        await this.client.hset(key, column, String(value));
        break;
      case 'list':
        const index = primaryKey._index as number;
        if (column === 'value' && typeof index === 'number') {
          await this.client.lset(key, index, String(value));
        }
        break;
      case 'zset':
        const member = primaryKey.member as string;
        if (column === 'score' && member) {
          await this.client.zadd(key, Number(value), member);
        }
        break;
      default:
        throw new Error(`Update not supported for type: ${type}`);
    }
  }

  async insertRow(
    _schema: string,
    table: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.client) throw new Error("Not connected");
    if (this.connectionConfig.readOnly) {
      throw new Error("Cannot insert: connection is read-only");
    }

    const { type, prefix } = this.parseTableName(table);

    switch (type) {
      case 'string': {
        const key = values._key as string || `${prefix}:${Date.now()}`;
        await this.client.set(key, String(values.value ?? ''));
        return { _key: key, value: values.value };
      }
      case 'hash': {
        const key = values._key as string || `${prefix}:${Date.now()}`;
        const { _key, ...hashValues } = values;
        const stringValues: Record<string, string> = {};
        for (const [k, v] of Object.entries(hashValues)) {
          stringValues[k] = String(v);
        }
        await this.client.hset(key, stringValues);
        return { _key: key, ...hashValues };
      }
      case 'list': {
        const key = values._key as string || prefix;
        await this.client.rpush(key, String(values.value ?? ''));
        const len = await this.client.llen(key);
        return { _key: key, _index: len - 1, value: values.value };
      }
      case 'set': {
        const key = values._key as string || prefix;
        await this.client.sadd(key, String(values.member ?? ''));
        return { _key: key, member: values.member };
      }
      case 'zset': {
        const key = values._key as string || prefix;
        const score = Number(values.score ?? 0);
        const member = String(values.member ?? '');
        await this.client.zadd(key, score, member);
        return { _key: key, member, score };
      }
      default:
        throw new Error(`Insert not supported for type: ${type}`);
    }
  }

  async deleteRows(
    _schema: string,
    table: string,
    primaryKeys: Record<string, unknown>[]
  ): Promise<number> {
    if (!this.client) throw new Error("Not connected");
    if (this.connectionConfig.readOnly) {
      throw new Error("Cannot delete: connection is read-only");
    }

    const { type } = this.parseTableName(table);
    let deleted = 0;

    for (const pk of primaryKeys) {
      const key = pk._key as string;
      if (!key) continue;

      switch (type) {
        case 'string':
        case 'hash':
          deleted += await this.client.del(key);
          break;
        case 'set':
          if (pk.member) {
            deleted += await this.client.srem(key, String(pk.member));
          }
          break;
        case 'zset':
          if (pk.member) {
            deleted += await this.client.zrem(key, String(pk.member));
          }
          break;
        case 'list':
          // Lists don't support direct deletion by index easily
          // Would need LREM with value
          break;
      }
    }

    return deleted;
  }

  // ============================================
  // SQL Helper Methods
  // ============================================

  quoteIdentifier(identifier: string): string {
    return identifier;
  }

  formatParameter(index: number): string {
    return `$${index}`;
  }

  buildWhereClause(
    _filters: FilterCondition[],
    _logic: "AND" | "OR"
  ): { whereClause: string; params: unknown[] } {
    return { whereClause: "", params: [] };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private createClient(): Redis {
    const { host, port, username, password, database, ssl } = this.connectionConfig;

    const options: any = {
      host: host || "localhost",
      port: port || 6379,
      db: database || 0,
      lazyConnect: false,
      retryStrategy: () => null,
    };

    // Redis 6+ ACL authentication with username
    if (username) {
      options.username = username;
    }

    if (password) {
      options.password = password;
    }

    if (ssl) {
      options.tls = {};
    }

    return new Redis(options);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(" ") : "< 1m";
  }

  /**
   * Parse a Redis command string, properly handling quoted arguments
   * Supports both single and double quotes, and JSON-style escaped strings
   */
  private parseRedisCommand(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }

      if (char === ' ' && !inQuotes) {
        if (current.length > 0) {
          parts.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current.length > 0) {
      parts.push(current);
    }

    return parts;
  }
}
