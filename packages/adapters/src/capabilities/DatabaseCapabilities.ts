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
    case 'mariadb':
      return getMariaDBCapabilities();
    case 'sqlserver':
      return getSQLServerCapabilities();
    case 'sqlite':
      return getSQLiteCapabilities();
    case 'mongodb':
      return getMongoDBCapabilities();
    case 'redis':
      return getRedisCapabilities();
    case 'elasticsearch':
      return getElasticsearchCapabilities();
    case 'cassandra':
      return getCassandraCapabilities();
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
 * MariaDB capabilities
 * MariaDB is a MySQL-compatible fork with some additional features
 */
function getMariaDBCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false, // MariaDB uses databases instead of schemas (like MySQL)
    supportsDatabases: true, // Can list and switch databases
    supportsInstances: false,

    // Objects
    supportsTables: true,
    supportsViews: true,
    supportsMaterializedViews: false, // MariaDB doesn't have materialized views
    supportsFunctions: true,
    supportsProcedures: true,
    supportsTypes: false, // MariaDB doesn't have user-defined types like PostgreSQL
    supportsIndexes: true,
    supportsTriggers: true,

    // Features
    supportsSQL: true,
    supportsExplainPlan: true,
    supportsForeignKeys: true,
    supportsJSON: true, // MariaDB 10.2+ supports JSON type
    supportsArrays: false, // MariaDB doesn't have native array types
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
 * Elasticsearch capabilities
 */
function getElasticsearchCapabilities(): DatabaseCapabilities {
  return {
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
    supportsExplainPlan: true, // Elasticsearch has explain/profile API
    supportsForeignKeys: false, // No foreign keys
    supportsJSON: true, // Native JSON/document support
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
}

/**
 * Apache Cassandra capabilities
 *
 * Cassandra is a distributed NoSQL database designed for high availability
 * and scalability. It uses CQL (Cassandra Query Language) which is similar
 * to SQL but with some key differences.
 *
 * Key concepts:
 * - Keyspaces: Similar to databases, contain tables
 * - Tables: Store data in rows and columns
 * - Partition keys: Determine data distribution across nodes
 * - Clustering keys: Sort data within partitions
 * - No JOINs: Data is denormalized
 * - No foreign keys: Relationships are application-managed
 * - Tunable consistency: From eventual to strong consistency
 */
function getCassandraCapabilities(): DatabaseCapabilities {
  return {
    // Hierarchy
    supportsSchemas: false, // Cassandra uses keyspaces, not schemas
    supportsDatabases: true, // Keyspaces are like databases
    supportsInstances: false,

    // Objects
    supportsTables: true, // Tables with partition and clustering keys
    supportsViews: true, // Cassandra 3.0+ supports materialized views
    supportsMaterializedViews: true, // Native materialized view support
    supportsFunctions: true, // User-defined functions (UDFs)
    supportsProcedures: false, // No stored procedures
    supportsTypes: true, // User-defined types (UDTs)
    supportsIndexes: true, // Secondary indexes (with limitations)
    supportsTriggers: true, // Triggers available

    // Features
    supportsSQL: false, // Uses CQL (similar to SQL but not standard SQL)
    supportsExplainPlan: true, // TRACING available for query analysis
    supportsForeignKeys: false, // No foreign key constraints
    supportsJSON: true, // Native JSON support in CQL
    supportsArrays: true, // Lists, Sets, Maps (collection types)
    supportsTransactions: false, // Limited: lightweight transactions (LWT) only

    // Authentication
    supportsWindowsAuth: false,
    supportsSSL: true,

    // Connection
    supportsConnectionPooling: true, // Built into driver
    supportsHealthChecks: true,

    // Special characteristics
    isNoSQL: true, // Wide-column store
    isFileBased: false,
    requiresServer: true, // Requires Cassandra cluster
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
    mariadb: 'MariaDB',
    sqlserver: 'SQL Server',
    sqlite: 'SQLite',
    mongodb: 'MongoDB',
    redis: 'Redis',
    elasticsearch: 'Elasticsearch',
    cassandra: 'Apache Cassandra',
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
    mariadb: '$(database)',
    sqlserver: '$(server)',
    sqlite: '$(file)',
    mongodb: '$(json)',
    redis: '$(key)',
    elasticsearch: '$(search)',
    cassandra: '$(server-environment)',
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
    mariadb: 3306, // MariaDB uses same default port as MySQL
    sqlserver: 1433,
    sqlite: 0, // File-based, no port
    mongodb: 27017,
    redis: 6379,
    elasticsearch: 9200,
    cassandra: 9042, // CQL native transport port
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
    mariadb: ['mysql', 'information_schema', 'performance_schema', 'sys'], // Same as MySQL
    sqlserver: ['sys', 'INFORMATION_SCHEMA', 'guest', 'master', 'tempdb', 'model', 'msdb'],
    sqlite: ['sqlite_master', 'sqlite_schema'],
    mongodb: ['admin', 'local', 'config'],
    redis: [], // Redis has no system schemas
    elasticsearch: ['.kibana', '.apm', '.security', '.fleet', '.tasks', '.async-search', '.internal'], // System indices
    cassandra: ['system', 'system_auth', 'system_distributed', 'system_schema', 'system_traces', 'system_views'], // System keyspaces
  };
  return systemSchemas[dbType] || [];
}
