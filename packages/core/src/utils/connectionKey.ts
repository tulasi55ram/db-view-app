/**
 * Connection key utilities
 *
 * Provides functions for generating and parsing connection keys
 * that uniquely identify database connections.
 */

import type { DatabaseConnectionConfig, DatabaseType } from '@dbview/types';

/**
 * Parsed connection key information
 */
export interface ParsedConnectionKey {
  /** Database type */
  dbType: DatabaseType;
  /** Identifier part after the type */
  identifier: string;
  /** Original connection key */
  original: string;
}

/**
 * Generates a unique connection key from a database configuration.
 *
 * Connection keys follow the format: `{dbType}:{identifier}`
 *
 * The identifier varies by database type:
 * - Named connections: uses the name
 * - SQLite: uses the file path
 * - MongoDB with connection string: uses the connection string
 * - Others: uses `{user}@{host}:{port}/{database}`
 *
 * @param config - Database connection configuration
 * @returns Unique connection key
 *
 * @example
 * ```typescript
 * // Named connection
 * getConnectionKey({ name: 'Production', dbType: 'postgres', ... });
 * // 'postgres:Production'
 *
 * // SQLite
 * getConnectionKey({ dbType: 'sqlite', filePath: '/path/to/db.sqlite' });
 * // 'sqlite:/path/to/db.sqlite'
 *
 * // PostgreSQL without name
 * getConnectionKey({ dbType: 'postgres', host: 'localhost', port: 5432, database: 'mydb', user: 'admin' });
 * // 'postgres:admin@localhost:5432/mydb'
 * ```
 */
export function getConnectionKey(config: DatabaseConnectionConfig): string {
  const dbType = config.dbType || 'postgres';

  // Use name if available
  if ('name' in config && config.name) {
    return `${dbType}:${config.name}`;
  }

  switch (dbType) {
    case 'sqlite':
      return `${dbType}:${(config as { filePath: string }).filePath}`;

    case 'mongodb':
      if ('connectionString' in config && (config as { connectionString?: string }).connectionString) {
        return `${dbType}:${(config as { connectionString: string }).connectionString}`;
      }
      return buildStandardKey(dbType, config as unknown as Record<string, unknown>);

    case 'redis':
      const redisConfig = config as unknown as Record<string, unknown>;
      const redisHost = redisConfig.host || 'localhost';
      const redisPort = redisConfig.port || 6379;
      const redisDb = redisConfig.database || 0;
      return `${dbType}:${redisHost}:${redisPort}/${redisDb}`;

    case 'elasticsearch':
      const esConfig = config as unknown as Record<string, unknown>;
      const esHosts = esConfig.hosts || esConfig.host || 'localhost';
      return `${dbType}:${Array.isArray(esHosts) ? esHosts.join(',') : esHosts}`;

    default:
      return buildStandardKey(dbType, config as unknown as Record<string, unknown>);
  }
}

/**
 * Builds a standard connection key for typical SQL databases.
 */
function buildStandardKey(dbType: string, config: Record<string, unknown>): string {
  const user = config.user || config.username || 'anonymous';
  const host = config.host || 'localhost';
  const port = config.port || getDefaultPort(dbType as DatabaseType);
  const database = config.database || '';

  return `${dbType}:${user}@${host}:${port}/${database}`;
}

/**
 * Gets the default port for a database type.
 */
function getDefaultPort(dbType: DatabaseType): number {
  const ports: Record<DatabaseType, number> = {
    postgres: 5432,
    mysql: 3306,
    mariadb: 3306,
    sqlserver: 1433,
    sqlite: 0,
    mongodb: 27017,
    redis: 6379,
    elasticsearch: 9200,
    cassandra: 9042,
  };

  return ports[dbType] || 0;
}

/**
 * Parses a connection key into its components.
 *
 * @param connectionKey - The connection key to parse
 * @returns Parsed components or null if invalid
 *
 * @example
 * ```typescript
 * parseConnectionKey('postgres:Production');
 * // { dbType: 'postgres', identifier: 'Production', original: 'postgres:Production' }
 *
 * parseConnectionKey('invalid');
 * // null
 * ```
 */
export function parseConnectionKey(connectionKey: string): ParsedConnectionKey | null {
  const colonIndex = connectionKey.indexOf(':');

  if (colonIndex === -1) {
    return null;
  }

  const dbType = connectionKey.substring(0, colonIndex) as DatabaseType;
  const identifier = connectionKey.substring(colonIndex + 1);

  // Validate database type
  const validTypes: DatabaseType[] = [
    'postgres', 'mysql', 'mariadb', 'sqlserver',
    'sqlite', 'mongodb', 'redis', 'elasticsearch', 'cassandra'
  ];

  if (!validTypes.includes(dbType)) {
    return null;
  }

  return {
    dbType,
    identifier,
    original: connectionKey,
  };
}

/**
 * Extracts a display name from a connection key.
 *
 * Returns a human-readable name for UI display.
 *
 * @param connectionKey - The connection key
 * @returns Display name
 *
 * @example
 * ```typescript
 * getConnectionDisplayName('postgres:Production');
 * // 'Production'
 *
 * getConnectionDisplayName('postgres:admin@localhost:5432/mydb');
 * // 'mydb'
 * ```
 */
export function getConnectionDisplayName(connectionKey: string): string {
  const parsed = parseConnectionKey(connectionKey);

  if (!parsed) {
    return connectionKey;
  }

  const { identifier } = parsed;

  // If it looks like a name (no special characters), use it directly
  if (/^[\w\s-]+$/.test(identifier)) {
    return identifier;
  }

  // Try to extract database name from standard format
  const dbMatch = identifier.match(/\/([^/]+)$/);
  if (dbMatch) {
    return dbMatch[1];
  }

  // For file paths, use the filename
  const pathMatch = identifier.match(/[/\\]([^/\\]+)$/);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Fallback to the identifier
  return identifier;
}

/**
 * Checks if two connection keys refer to the same connection.
 *
 * @param key1 - First connection key
 * @param key2 - Second connection key
 * @returns True if they refer to the same connection
 */
export function isSameConnection(key1: string, key2: string): boolean {
  return key1 === key2;
}

/**
 * Gets the database type from a connection key.
 *
 * @param connectionKey - The connection key
 * @returns Database type or null if invalid
 */
export function getDbTypeFromKey(connectionKey: string): DatabaseType | null {
  const parsed = parseConnectionKey(connectionKey);
  return parsed?.dbType || null;
}
