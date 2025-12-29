/**
 * DataView Types
 *
 * Shared types for all data view components (SQL, Document, Redis).
 */

/**
 * Common props for all data view components
 */
export interface DataViewProps {
  /** Connection key identifying the database connection */
  connectionKey: string;
  /** Schema/database name (empty string for schemaless DBs) */
  schema: string;
  /** Table/collection/key name */
  table: string;
}

/**
 * Props for SQL data view
 */
export interface SqlDataViewProps extends DataViewProps {
  // SQL-specific props can be added here
}

/**
 * Document database types
 */
export type DocumentDbType = 'mongodb' | 'elasticsearch' | 'cassandra';

/**
 * Props for document data view
 */
export interface DocumentDataViewProps extends DataViewProps {
  /** The specific document database type */
  dbType: DocumentDbType;
}

/**
 * View modes for document data view
 */
export type DocumentViewMode = 'tree' | 'table' | 'json';

/**
 * Document field information for tree rendering
 */
export interface DocumentField {
  /** Field key/name */
  key: string;
  /** Field value */
  value: unknown;
  /** JavaScript type of the value */
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'array' | 'object' | 'date' | 'objectId';
  /** JSON path to this field (e.g., "address.city" or "orders[0].product") */
  path: string;
  /** Nesting depth (0 = root level) */
  depth: number;
  /** Whether this node is expanded (for objects/arrays) */
  isExpanded?: boolean;
  /** Number of children (for objects: key count, for arrays: length) */
  childCount?: number;
}

/**
 * Document representation
 */
export interface Document {
  /** Primary identifier (_id for MongoDB, _id for ES) */
  _id: string;
  /** Raw document data */
  _source: Record<string, unknown>;
  /** Optional metadata */
  _metadata?: {
    /** Elasticsearch index name */
    index?: string;
    /** Elasticsearch relevance score */
    score?: number;
    /** MongoDB collection name */
    collection?: string;
  };
}

/**
 * Filter types for document queries
 */
export interface DocumentFilter {
  /** Filter type */
  type: 'simple' | 'query';
  /** Field name for simple filters */
  field?: string;
  /** Operator for simple filters */
  operator?: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'not_exists';
  /** Value for simple filters */
  value?: unknown;
  /** Raw query string (MongoDB query JSON or ES Query DSL) */
  rawQuery?: string;
}

/**
 * State for tree view navigation
 */
export interface TreeViewState {
  /** Set of expanded node paths */
  expandedPaths: Set<string>;
  /** Currently selected field path */
  selectedPath: string | null;
  /** Currently editing field path */
  editingPath: string | null;
}
