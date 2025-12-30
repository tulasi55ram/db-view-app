/**
 * Document module types
 */

import type { DatabaseType } from '@dbview/types';

/**
 * Document database types that use document-style storage
 */
export type DocumentDbType = 'mongodb' | 'elasticsearch' | 'cassandra';

/**
 * Check if a database type is a document database
 */
export function isDocumentDbType(dbType: DatabaseType): dbType is DocumentDbType {
  return ['mongodb', 'elasticsearch', 'cassandra'].includes(dbType);
}

/**
 * Result of extracting document ID fields
 */
export interface DocumentIdInfo {
  /** Primary ID field name */
  primaryField: string;
  /** All ID fields (for composite keys) */
  allFields: string[];
  /** Whether this is a composite key */
  isComposite: boolean;
}

/**
 * Options for path operations
 */
export interface PathOptions {
  /** How to handle array indices: 'bracket' for [0], 'dot' for .0 */
  arrayNotation?: 'bracket' | 'dot';
  /** Whether to create intermediate objects when setting values */
  createIntermediates?: boolean;
}
