/**
 * Document ID utilities
 *
 * Provides functions for identifying and extracting document IDs
 * from various document databases (MongoDB, Elasticsearch, Cassandra).
 */

import type { DatabaseType, ColumnMetadata } from '@dbview/types';
import type { DocumentIdInfo } from './types.js';

/**
 * Database-specific ID field conventions
 */
const DB_ID_CONVENTIONS: Record<string, string[]> = {
  mongodb: ['_id'],
  elasticsearch: ['_id'],
  cassandra: ['id'],
  // Fallback patterns for unknown databases
  default: ['_id', 'id', 'ID', 'Id', 'uuid', 'UUID'],
};

/**
 * Gets the primary ID field name for a document database.
 *
 * Priority:
 * 1. Column with isPrimaryKey: true from metadata
 * 2. Database-specific convention (_id for MongoDB/ES, id for Cassandra)
 * 3. Common ID patterns (_id, id, ID, uuid)
 *
 * @param columns - Column metadata (optional)
 * @param dbType - Database type
 * @returns The ID field name
 *
 * @example
 * ```typescript
 * // With metadata
 * const idField = getDocumentIdField(columns, 'mongodb');
 *
 * // Without metadata (uses convention)
 * const idField = getDocumentIdField(undefined, 'mongodb'); // '_id'
 * ```
 */
export function getDocumentIdField(
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): string {
  // Priority 1: Check metadata for primary key
  if (columns?.length) {
    const pkColumn = columns.find((col) => col.isPrimaryKey);
    if (pkColumn) {
      return pkColumn.name;
    }
  }

  // Priority 2: Database-specific conventions
  const conventions = DB_ID_CONVENTIONS[dbType] || DB_ID_CONVENTIONS.default;

  // If we have columns, try to find a matching convention
  if (columns?.length) {
    const columnNames = new Set(columns.map((col) => col.name));
    for (const convention of conventions) {
      if (columnNames.has(convention)) {
        return convention;
      }
    }
  }

  // Priority 3: Return first convention as default
  return conventions[0];
}

/**
 * Gets all ID fields for a document, supporting composite keys.
 *
 * Cassandra often uses composite partition keys, so this function
 * returns all primary key fields.
 *
 * @param columns - Column metadata
 * @param dbType - Database type
 * @returns Information about the document ID fields
 *
 * @example
 * ```typescript
 * const idInfo = getDocumentIdFields(columns, 'cassandra');
 * // { primaryField: 'user_id', allFields: ['user_id', 'timestamp'], isComposite: true }
 * ```
 */
export function getDocumentIdFields(
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): DocumentIdInfo {
  const primaryField = getDocumentIdField(columns, dbType);

  // Find all primary key columns
  const pkColumns = columns?.filter((col) => col.isPrimaryKey) || [];

  if (pkColumns.length > 1) {
    return {
      primaryField,
      allFields: pkColumns.map((col) => col.name),
      isComposite: true,
    };
  }

  return {
    primaryField,
    allFields: [primaryField],
    isComposite: false,
  };
}

/**
 * Extracts the ID value from a document.
 *
 * @param document - The document to extract ID from
 * @param columns - Column metadata (optional)
 * @param dbType - Database type
 * @returns The document ID as a string, or empty string if not found
 *
 * @example
 * ```typescript
 * const doc = { _id: '507f1f77bcf86cd799439011', name: 'John' };
 * const id = getDocumentId(doc, undefined, 'mongodb');
 * // '507f1f77bcf86cd799439011'
 * ```
 */
export function getDocumentId(
  document: Record<string, unknown>,
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): string {
  const idField = getDocumentIdField(columns, dbType);
  const id = document[idField];

  if (id === null || id === undefined) {
    return '';
  }

  // Handle ObjectId-like objects (MongoDB)
  if (typeof id === 'object' && id !== null) {
    // Check for $oid format (common in MongoDB JSON)
    if ('$oid' in id && typeof (id as Record<string, unknown>).$oid === 'string') {
      return (id as Record<string, unknown>).$oid as string;
    }
    // Check for toString method
    if ('toString' in id && typeof id.toString === 'function') {
      return id.toString();
    }
    // Fallback to JSON
    return JSON.stringify(id);
  }

  return String(id);
}

/**
 * Creates a composite document ID from multiple fields.
 *
 * Used for Cassandra and other databases with composite primary keys.
 *
 * @param document - The document
 * @param columns - Column metadata
 * @param dbType - Database type
 * @param separator - Separator for composite keys (default: ':')
 * @returns Composite ID string
 *
 * @example
 * ```typescript
 * const doc = { user_id: '123', timestamp: '2024-01-01' };
 * const id = getCompositeDocumentId(doc, columns, 'cassandra');
 * // '123:2024-01-01'
 * ```
 */
export function getCompositeDocumentId(
  document: Record<string, unknown>,
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType,
  separator = ':'
): string {
  const idInfo = getDocumentIdFields(columns, dbType);

  if (!idInfo.isComposite) {
    return getDocumentId(document, columns, dbType);
  }

  const parts = idInfo.allFields.map((field) => {
    const value = document[field];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });

  return parts.join(separator);
}

/**
 * Creates a primary key object from a document.
 *
 * Useful for update/delete operations that need the primary key.
 *
 * @param document - The document
 * @param columns - Column metadata
 * @param dbType - Database type
 * @returns Object with primary key field(s) and value(s)
 *
 * @example
 * ```typescript
 * const pk = getPrimaryKeyObject(doc, columns, 'mongodb');
 * // { _id: '507f1f77bcf86cd799439011' }
 * ```
 */
export function getPrimaryKeyObject(
  document: Record<string, unknown>,
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): Record<string, unknown> {
  const idInfo = getDocumentIdFields(columns, dbType);
  const pk: Record<string, unknown> = {};

  for (const field of idInfo.allFields) {
    pk[field] = document[field];
  }

  return pk;
}
