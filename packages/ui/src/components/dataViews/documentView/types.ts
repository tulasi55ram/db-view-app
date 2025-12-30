/**
 * DocumentView Types
 *
 * Types for the document data view components
 * (MongoDB, Elasticsearch, Cassandra)
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
    // Check for MongoDB ObjectId format (24-char hex string)
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
      return 'text-vscode-text-muted';
    case 'date':
      return 'text-orange-400';
    case 'objectId':
      return 'text-cyan-400';
    case 'array':
    case 'object':
      return 'text-vscode-text';
    default:
      return 'text-vscode-text';
  }
}

/**
 * Document representation for the list
 */
export interface DocumentItem {
  /** Document ID */
  _id: string;
  /** Raw document source */
  _source: Record<string, unknown>;
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
 * View mode icons configuration
 */
export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  tree: 'Tree View',
  table: 'Table View',
  json: 'JSON View',
};
