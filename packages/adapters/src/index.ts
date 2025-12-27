/**
 * Database Adapters Package
 *
 * Shared database adapters for DBView applications.
 * Provides unified interface for PostgreSQL, MySQL, SQL Server, SQLite, MongoDB, and Redis.
 */

// Core types and interfaces
export type {
  DatabaseType,
  DatabaseAdapter,
  DatabaseCapabilities,
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
  ERDiagramTable,
  ERDiagramRelationship,
  ERDiagramColumn,
  FilterCondition,
  FilterOperator,
  FetchOptions,
  FilterOptions,
  DatabaseHierarchy,
  HierarchyType,
  ExplainPlan,
  ExplainNode,
} from './adapters/DatabaseAdapter';

// Adapter implementations
export { PostgresAdapter } from './adapters/PostgresAdapter';
export { MySQLAdapter } from './adapters/MySQLAdapter';
export { SQLServerAdapter } from './adapters/SQLServerAdapter';
export { SQLiteAdapter } from './adapters/SQLiteAdapter';
export { MongoDBAdapter } from './adapters/MongoDBAdapter';
export { RedisAdapter } from './adapters/RedisAdapter';

// Factory
export { DatabaseAdapterFactory } from './adapters/DatabaseAdapterFactory';

// Capabilities
export {
  getDatabaseCapabilities,
  supportsFeature,
  getDatabaseDisplayName,
  getDatabaseIcon,
  getDatabaseDefaultPort,
  getSystemSchemas
} from './capabilities/DatabaseCapabilities';

// Re-export testConnection for backward compatibility
export { testConnection } from './adapters/PostgresAdapter';
