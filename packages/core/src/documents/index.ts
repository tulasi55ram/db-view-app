/**
 * Documents module
 *
 * Provides utilities for working with document databases:
 * - Document ID extraction and handling
 * - Path-based operations for nested documents
 */

// Types
export type { DocumentIdInfo, PathOptions, DocumentDbType } from './types.js';
export { isDocumentDbType } from './types.js';

// Document ID utilities
export {
  getDocumentIdField,
  getDocumentIdFields,
  getDocumentId,
  getCompositeDocumentId,
  getPrimaryKeyObject,
} from './getDocumentId.js';

// Path utilities
export {
  parsePath,
  buildPath,
  getAtPath,
  hasPath,
  setAtPath,
  deleteAtPath,
  getParentPath,
  getPathKey,
  joinPath,
} from './pathUtils.js';
