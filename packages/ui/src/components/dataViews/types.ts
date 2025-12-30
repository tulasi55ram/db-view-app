/**
 * Shared types for database-specific data views
 */

import type { ColumnMetadata, FilterCondition, DatabaseType } from "@dbview/types";

// Re-export document utilities from @dbview/core for convenience
export {
  getDocumentIdField,
  getDocumentIdFields,
  getCompositeDocumentId,
  getDocumentId,
  getPrimaryKeyObject,
} from "@dbview/core";
import type { SortingState } from "@tanstack/react-table";

/**
 * Common props shared by all data view components
 */
export interface BaseDataViewProps {
  // Data
  schema: string;
  table: string;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  loading: boolean;
  totalRows: number | null;

  // Pagination
  limit: number;
  offset: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Refresh
  onRefresh: () => void;

  // Database type for context
  dbType: DatabaseType;

  // Read-only mode
  readOnly?: boolean;
}

/**
 * SQL-specific data view props (PostgreSQL, MySQL, SQL Server, SQLite)
 */
export interface SqlDataViewProps extends BaseDataViewProps {
  dbType: 'postgres' | 'mysql' | 'mariadb' | 'sqlserver' | 'sqlite';

  // Editing capabilities
  onUpdateCell?: (primaryKey: Record<string, unknown>, column: string, value: unknown) => void;
  onInsertRow?: (values: Record<string, unknown>) => void;
  onDeleteRows?: (primaryKeys: Record<string, unknown>[]) => void;

  // Filtering
  filters?: FilterCondition[];
  filterLogic?: 'AND' | 'OR';
  onFiltersChange?: (filters: FilterCondition[], logic: 'AND' | 'OR') => void;

  // Sorting
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
}

/**
 * Document/NoSQL-specific data view props
 * Supports: MongoDB, Elasticsearch, Cassandra
 */
export interface DocumentDataViewProps extends BaseDataViewProps {
  dbType: 'mongodb' | 'elasticsearch' | 'cassandra';

  // Document operations
  onUpdateDocument?: (documentId: string, updates: Record<string, unknown>) => void;
  onInsertDocument?: (document: Record<string, unknown>) => void;
  onDeleteDocuments?: (documentIds: string[]) => void;

  // Document viewer mode
  viewMode?: 'tree' | 'table' | 'json';
  onViewModeChange?: (mode: 'tree' | 'table' | 'json') => void;

  // Document expansion state
  expandedDocuments?: Set<string>;
  onToggleExpand?: (documentId: string) => void;
}

/**
 * @deprecated Use DocumentDataViewProps instead
 */
export type MongoDataViewProps = DocumentDataViewProps;

/**
 * Redis key types
 */
export type RedisKeyType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream';

/**
 * Redis-specific data view props
 */
export interface RedisDataViewProps extends BaseDataViewProps {
  dbType: 'redis';

  // Key type filter (Redis groups keys by type)
  keyType: RedisKeyType;
  onKeyTypeChange?: (type: RedisKeyType) => void;

  // Key pattern for filtering
  keyPattern?: string;
  onKeyPatternChange?: (pattern: string) => void;

  // Redis is typically read-only in this context
  readOnly: true;
}

/**
 * Combined props for DataViewContainer router
 */
export type DataViewProps = SqlDataViewProps | DocumentDataViewProps | RedisDataViewProps;

/**
 * Type guard functions
 */
export function isSqlDataView(props: DataViewProps): props is SqlDataViewProps {
  return ['postgres', 'mysql', 'mariadb', 'sqlserver', 'sqlite'].includes(props.dbType);
}

export function isDocumentDataView(props: DataViewProps): props is DocumentDataViewProps {
  return ['mongodb', 'elasticsearch', 'cassandra'].includes(props.dbType);
}

/** @deprecated Use isDocumentDataView instead */
export const isMongoDataView = isDocumentDataView;

export function isRedisDataView(props: DataViewProps): props is RedisDataViewProps {
  return props.dbType === 'redis';
}

// Note: Document ID utilities (getDocumentIdField, getDocumentIdFields, getCompositeDocumentId,
// getDocumentId, getPrimaryKeyObject) are now imported from @dbview/core
// and re-exported at the top of this file for backwards compatibility.

/**
 * Redis column configurations by key type
 */
export const REDIS_COLUMNS_BY_TYPE: Record<RedisKeyType, ColumnMetadata[]> = {
  string: [
    { name: '_key', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'value', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'ttl', type: 'integer', nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
  ],
  hash: [
    { name: '_key', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'field', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'value', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
  ],
  list: [
    { name: '_key', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: '_index', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'value', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
  ],
  set: [
    { name: '_key', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'member', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
  ],
  zset: [
    { name: '_key', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'member', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'score', type: 'numeric', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
  ],
  stream: [
    { name: '_key', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: '_id', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
    { name: 'data', type: 'jsonb', nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false, foreignKeyRef: null, isAutoIncrement: false, isGenerated: false, editable: false },
  ],
};

/**
 * Database type display names
 */
export const DB_TYPE_LABELS: Record<DatabaseType, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  sqlserver: 'SQL Server',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  cassandra: 'Cassandra',
};

/**
 * Get appropriate label for schema/table based on database type
 */
export function getSchemaLabel(dbType: DatabaseType): string {
  switch (dbType) {
    case 'mongodb':
      return 'Database';
    case 'redis':
      return 'Database';
    case 'elasticsearch':
      return 'Index';
    case 'cassandra':
      return 'Keyspace';
    default:
      return 'Schema';
  }
}

export function getTableLabel(dbType: DatabaseType): string {
  switch (dbType) {
    case 'mongodb':
      return 'Collection';
    case 'redis':
      return 'Key Group';
    case 'elasticsearch':
      return 'Type';
    case 'cassandra':
      return 'Table';
    default:
      return 'Table';
  }
}

export function getRowLabel(dbType: DatabaseType, plural = false): string {
  switch (dbType) {
    case 'mongodb':
      return plural ? 'documents' : 'document';
    case 'redis':
      return plural ? 'keys' : 'key';
    case 'elasticsearch':
      return plural ? 'documents' : 'document';
    default:
      return plural ? 'rows' : 'row';
  }
}
