import type { DatabaseType, DatabaseCapabilities } from "../adapters/DatabaseAdapter";

/**
 * Get database capabilities for a specific database type
 *
 * This function returns a capabilities object that describes what features
 * a specific database supports. This is used throughout the application to
 * enable/disable features based on the database type.
 *
 * @param dbType Database type
 * @returns Database capabilities
 */
export function getDatabaseCapabilities(dbType: DatabaseType): DatabaseCapabilities {
  switch (dbType) {
    case 'postgres':
      return getPostgreSQLCapabilities();
    case 'mysql':
      return getMySQLCapabilities();
    case 'sqlserver':
      return getSQLServerCapabilities();
    case 'sqlite':
      return getSQLiteCapabilities();
    case 'mongodb':
      return getMongoDBCapabilities();
    case 'redis':
      return getRedisCapabilities();
    default:
      // Fallback for unknown database types
      return getDefaultCapabilities();
  }
}

/**
 * PostgreSQL capabilities
 */
function getPostgreSQLCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: true,
    supportsDatabases: false, // PostgreSQL connects to a single database
    supportsInstances: false,

    // Objects
    supportsTables: true,
    supportsViews: true,
    supportsMaterializedViews: true, // PostgreSQL-specific feature
    supportsFunctions: true,
    supportsProcedures: true,
    supportsTypes: true, // User-defined types
    supportsIndexes: true,
    supportsTriggers: true,

    // Features
    supportsSQL: true,
    supportsExplainPlan: true,
    supportsForeignKeys: true,
    supportsJSON: true, // JSON and JSONB types
    supportsArrays: true, // Array types
    supportsTransactions: true,

    // Authentication
    supportsWindowsAuth: false,
    supportsSSL: true,

    // Connection
    supportsConnectionPooling: true,
    supportsHealthChecks: true,

    // Special characteristics
    isNoSQL: false,
    isFileBased: false,
    requiresServer: true,
  };
}

/**
 * MySQL capabilities
 */
function getMySQLCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false, // MySQL uses databases instead of schemas
    supportsDatabases: true, // Can list and switch databases
    supportsInstances: false,

    // Objects
    supportsTables: true,
    supportsViews: true,
    supportsMaterializedViews: false, // MySQL doesn't have materialized views
    supportsFunctions: true,
    supportsProcedures: true,
    supportsTypes: false, // MySQL doesn't have user-defined types like PostgreSQL
    supportsIndexes: true,
    supportsTriggers: true,

    // Features
    supportsSQL: true,
    supportsExplainPlan: true,
    supportsForeignKeys: true,
    supportsJSON: true, // MySQL 5.7+ supports JSON type
    supportsArrays: false, // MySQL doesn't have native array types
    supportsTransactions: true,

    // Authentication
    supportsWindowsAuth: false,
    supportsSSL: true,

    // Connection
    supportsConnectionPooling: true,
    supportsHealthChecks: true,

    // Special characteristics
    isNoSQL: false,
    isFileBased: false,
    requiresServer: true,
  };
}

/**
 * SQL Server capabilities
 */
function getSQLServerCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: true,
    supportsDatabases: true, // Can list and switch databases
    supportsInstances: true, // SQL Server supports named instances

    // Objects
    supportsTables: true,
    supportsViews: true,
    supportsMaterializedViews: false, // SQL Server doesn't have materialized views (has indexed views instead)
    supportsFunctions: true,
    supportsProcedures: true,
    supportsTypes: true, // User-defined types
    supportsIndexes: true,
    supportsTriggers: true,

    // Features
    supportsSQL: true,
    supportsExplainPlan: true, // via SET SHOWPLAN_XML
    supportsForeignKeys: true,
    supportsJSON: true, // SQL Server 2016+ supports JSON functions
    supportsArrays: false, // SQL Server doesn't have native array types
    supportsTransactions: true,

    // Authentication
    supportsWindowsAuth: true, // Windows Authentication (NTLM)
    supportsSSL: true, // Encrypt option

    // Connection
    supportsConnectionPooling: true,
    supportsHealthChecks: true,

    // Special characteristics
    isNoSQL: false,
    isFileBased: false,
    requiresServer: true,
  };
}

/**
 * SQLite capabilities
 */
function getSQLiteCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false, // SQLite has a single main database (can attach others)
    supportsDatabases: false,
    supportsInstances: false,

    // Objects
    supportsTables: true,
    supportsViews: true,
    supportsMaterializedViews: false,
    supportsFunctions: false, // SQLite has built-in functions but no user-defined functions
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: true,
    supportsTriggers: true,

    // Features
    supportsSQL: true,
    supportsExplainPlan: true, // EXPLAIN QUERY PLAN
    supportsForeignKeys: true, // Must be enabled with PRAGMA foreign_keys=ON
    supportsJSON: true, // SQLite 3.38+ has JSON functions
    supportsArrays: false,
    supportsTransactions: true,

    // Authentication
    supportsWindowsAuth: false,
    supportsSSL: false, // File-based, no network connection

    // Connection
    supportsConnectionPooling: false, // File-based, single connection
    supportsHealthChecks: false, // File-based, no server to check

    // Special characteristics
    isNoSQL: false,
    isFileBased: true,
    requiresServer: false,
  };
}

/**
 * MongoDB capabilities
 */
function getMongoDBCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false, // MongoDB uses collections, not schemas
    supportsDatabases: true, // Can list and switch databases
    supportsInstances: false,

    // Objects
    supportsTables: true, // Collections are treated as tables
    supportsViews: true, // MongoDB has views (aggregation-based)
    supportsMaterializedViews: false,
    supportsFunctions: false,
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: true,
    supportsTriggers: true, // MongoDB Atlas has triggers

    // Features
    supportsSQL: false, // MongoDB uses MQL (MongoDB Query Language), not SQL
    supportsExplainPlan: true, // explain() method
    supportsForeignKeys: false, // No built-in foreign keys (references are manual)
    supportsJSON: true, // BSON (Binary JSON)
    supportsArrays: true, // Native array support
    supportsTransactions: true, // Multi-document ACID transactions (4.0+)

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
}

/**
 * Redis capabilities
 */
function getRedisCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false, // Redis uses key-based namespacing
    supportsDatabases: true, // Redis DB 0-15
    supportsInstances: false,

    // Objects
    supportsTables: false, // Redis uses keys, not tables (Hash keys shown as "tables")
    supportsViews: false,
    supportsMaterializedViews: false,
    supportsFunctions: false,
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: false, // No traditional indexes (sorted sets serve similar purpose)
    supportsTriggers: false,

    // Features
    supportsSQL: false, // Redis uses its own command language
    supportsExplainPlan: false,
    supportsForeignKeys: false,
    supportsJSON: true, // Redis JSON module
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
}

/**
 * Default capabilities (minimal feature set)
 */
function getDefaultCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false,
    supportsDatabases: false,
    supportsInstances: false,

    // Objects
    supportsTables: true,
    supportsViews: false,
    supportsMaterializedViews: false,
    supportsFunctions: false,
    supportsProcedures: false,
    supportsTypes: false,
    supportsIndexes: false,
    supportsTriggers: false,

    // Features
    supportsSQL: true,
    supportsExplainPlan: false,
    supportsForeignKeys: false,
    supportsJSON: false,
    supportsArrays: false,
    supportsTransactions: false,

    // Authentication
    supportsWindowsAuth: false,
    supportsSSL: false,

    // Connection
    supportsConnectionPooling: true,
    supportsHealthChecks: true,

    // Special characteristics
    isNoSQL: false,
    isFileBased: false,
    requiresServer: true,
  };
}

/**
 * Check if a database supports a specific feature
 *
 * @param dbType Database type
 * @param feature Feature name
 * @returns true if feature is supported, false otherwise
 */
export function supportsFeature(
  dbType: DatabaseType,
  feature: keyof DatabaseCapabilities
): boolean {
  const capabilities = getDatabaseCapabilities(dbType);
  return capabilities[feature] as boolean;
}

/**
 * Get user-friendly database name
 *
 * @param dbType Database type
 * @returns Display name
 */
export function getDatabaseDisplayName(dbType: DatabaseType): string {
  const names: Record<DatabaseType, string> = {
    postgres: 'PostgreSQL',
    mysql: 'MySQL',
    sqlserver: 'SQL Server',
    sqlite: 'SQLite',
    mongodb: 'MongoDB',
    redis: 'Redis',
  };
  return names[dbType] || dbType;
}

/**
 * Get database icon (VSCode Codicon)
 *
 * @param dbType Database type
 * @returns Icon name
 */
export function getDatabaseIcon(dbType: DatabaseType): string {
  const icons: Record<DatabaseType, string> = {
    postgres: '$(database)',
    mysql: '$(database)',
    sqlserver: '$(server)',
    sqlite: '$(file)',
    mongodb: '$(json)',
    redis: '$(key)',
  };
  return icons[dbType] || '$(database)';
}

/**
 * Get database default port
 *
 * @param dbType Database type
 * @returns Default port number (0 if not applicable)
 */
export function getDatabaseDefaultPort(dbType: DatabaseType): number {
  const ports: Record<DatabaseType, number> = {
    postgres: 5432,
    mysql: 3306,
    sqlserver: 1433,
    sqlite: 0, // File-based, no port
    mongodb: 27017,
    redis: 6379,
  };
  return ports[dbType] || 0;
}

/**
 * Get system schemas/databases to filter out
 *
 * @param dbType Database type
 * @returns Array of system schema/database names
 */
export function getSystemSchemas(dbType: DatabaseType): string[] {
  const systemSchemas: Record<DatabaseType, string[]> = {
    postgres: ['pg_catalog', 'information_schema'],
    mysql: ['mysql', 'information_schema', 'performance_schema', 'sys'],
    sqlserver: ['sys', 'INFORMATION_SCHEMA', 'guest', 'master', 'tempdb', 'model', 'msdb'],
    sqlite: ['sqlite_master', 'sqlite_schema'],
    mongodb: ['admin', 'local', 'config'],
    redis: [], // Redis has no system schemas
  };
  return systemSchemas[dbType] || [];
}
