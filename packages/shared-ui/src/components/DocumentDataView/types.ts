/**
 * DocumentDataView Types
 *
 * Types specific to the document data view component
 * for MongoDB, Elasticsearch, and Cassandra.
 */

export type DocumentDbType = 'mongodb' | 'elasticsearch' | 'cassandra';

export type ViewMode = 'tree' | 'table' | 'json';

/**
 * Document field type for tree rendering
 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'array'
  | 'object'
  | 'date'
  | 'objectId'
  | 'binary'
  | 'unknown';

/**
 * Get the field type from a value
 */
export function getFieldType(value: unknown): FieldType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'string') {
    // Check for MongoDB ObjectId format
    if (/^[a-f0-9]{24}$/i.test(value as string)) {
      return 'objectId';
    }
    // Check for ISO date format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value as string)) {
      return 'date';
    }
    return 'string';
  }

  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';

  if (Array.isArray(value)) return 'array';

  if (type === 'object') {
    // Check for Date object
    if (value instanceof Date) return 'date';
    // Check for MongoDB ObjectId-like object
    if (value && typeof value === 'object' && '$oid' in value) return 'objectId';
    // Check for MongoDB date object
    if (value && typeof value === 'object' && '$date' in value) return 'date';
    // Check for binary data
    if (value && typeof value === 'object' && '$binary' in value) return 'binary';
    return 'object';
  }

  return 'unknown';
}

/**
 * Document field for tree view
 */
export interface DocumentField {
  key: string;
  value: unknown;
  type: FieldType;
  path: string;
  depth: number;
  isExpanded?: boolean;
  childCount?: number;
  parent?: string;
}

/**
 * Document representation
 */
export interface DocumentItem {
  /** Document ID */
  _id: string;
  /** Raw document source */
  _source: Record<string, unknown>;
  /** Optional metadata */
  _meta?: {
    index?: string;
    score?: number;
    collection?: string;
  };
}

/**
 * Filter for document queries
 */
export interface DocumentFilter {
  type: 'simple' | 'raw';
  field?: string;
  operator?: FilterOperator;
  value?: unknown;
  rawQuery?: string;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'not_exists'
  | 'in'
  | 'not_in';

/**
 * Props for DocumentDataView
 */
export interface DocumentDataViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  dbType: DocumentDbType;
}

/**
 * Database-specific labels
 */
export const DB_LABELS: Record<DocumentDbType, {
  containerLabel: string;
  itemLabel: string;
  itemLabelPlural: string;
}> = {
  mongodb: {
    containerLabel: 'Collection',
    itemLabel: 'Document',
    itemLabelPlural: 'Documents',
  },
  elasticsearch: {
    containerLabel: 'Index',
    itemLabel: 'Document',
    itemLabelPlural: 'Documents',
  },
  cassandra: {
    containerLabel: 'Table',
    itemLabel: 'Row',
    itemLabelPlural: 'Rows',
  },
};

/**
 * Get color for field type (for syntax highlighting)
 */
export function getFieldTypeColor(type: FieldType): string {
  switch (type) {
    case 'string':
      return 'text-green-400';
    case 'number':
      return 'text-blue-400';
    case 'boolean':
      return 'text-purple-400';
    case 'null':
    case 'undefined':
      return 'text-text-tertiary';
    case 'date':
      return 'text-orange-400';
    case 'objectId':
      return 'text-cyan-400';
    case 'array':
    case 'object':
      return 'text-text-secondary';
    default:
      return 'text-text-primary';
  }
}
