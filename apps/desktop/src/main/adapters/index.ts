/**
 * Database Adapters Module
 *
 * This module exports all database adapters and related types/utilities.
 * It provides a unified interface for working with different database systems.
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
} from './DatabaseAdapter';

// Adapter implementations
export { PostgresAdapter } from './PostgresAdapter';
export { MySQLAdapter } from './MySQLAdapter';

// Factory
export { DatabaseAdapterFactory } from './DatabaseAdapterFactory';

// Re-export testConnection for backward compatibility
export { testConnection } from './PostgresAdapter';
