/**
 * Data Views Module
 *
 * Provides specialized data view components for different database types:
 * - SqlDataView: For SQL databases (PostgreSQL, MySQL, MariaDB, SQL Server, SQLite)
 * - DocumentDataView: For document databases (MongoDB, Elasticsearch, Cassandra)
 * - RedisDataView: For Redis with type-aware display
 * - DataViewContainer: Unified router that selects the appropriate view
 */

// Main container
export { DataViewContainer } from './DataViewContainer';
export type { DataViewContainerProps } from './DataViewContainer';

// Individual views
export { SqlDataView } from './SqlDataView';
export { DocumentDataView } from './DocumentDataView';
export { RedisDataView } from './RedisDataView';

// Deprecated aliases for backward compatibility
export { DocumentDataView as MongoDataView } from './DocumentDataView';

// Types
export type {
  BaseDataViewProps,
  SqlDataViewProps,
  DocumentDataViewProps,
  MongoDataViewProps, // deprecated alias
  RedisDataViewProps,
  DataViewProps,
  RedisKeyType,
} from './types';

export {
  isSqlDataView,
  isDocumentDataView,
  isMongoDataView, // deprecated alias
  isRedisDataView,
  getDocumentIdField,
  getDocumentIdFields,
  getCompositeDocumentId,
  REDIS_COLUMNS_BY_TYPE,
  DB_TYPE_LABELS,
  getSchemaLabel,
  getTableLabel,
  getRowLabel,
} from './types';

// Shared components
export * from './shared';
