/**
 * Transforms module
 *
 * Provides utilities for transforming document data:
 * - Flattening nested documents to dot-notation paths
 * - Converting documents to tree structures
 * - Type inference and detection
 */

// Types
export type {
  PrimitiveType,
  ValueType,
  FlattenedField,
  FlattenOptions,
  TreeNode,
  TreeOptions,
  InferredColumnType,
} from './types.js';

// Type inference utilities
export {
  detectValueType,
  getTypeLabel,
  getTypeColor,
  isPrimitive,
  isContainer,
  inferColumnType,
  formatValueForDisplay,
} from './inferTypes.js';

// Flatten utilities
export {
  flattenDocument,
  unflattenDocument,
  getDocumentKeys,
  countDocumentFields,
  getDocumentDepth,
} from './flattenDocument.js';

// Tree utilities
export {
  nestToTree,
  getExpandedPathsToDepth,
  expandPath,
  collapsePath,
  togglePath,
  expandAll,
  collapseAll,
  searchTree,
  getPathsToShowSearchResults,
} from './nestToTree.js';
