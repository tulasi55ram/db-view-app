/**
 * Transform module types
 */

/**
 * Primitive value types that can be detected
 */
export type PrimitiveType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined';

/**
 * All detectable value types
 */
export type ValueType =
  | PrimitiveType
  | 'object'
  | 'array'
  | 'date'
  | 'objectId'
  | 'binary'
  | 'unknown';

/**
 * A flattened field from a nested document
 */
export interface FlattenedField {
  /** Dot-notation path (e.g., "user.address.city") */
  path: string;
  /** The field value */
  value: unknown;
  /** Detected value type */
  type: ValueType;
  /** Nesting depth (0 for root level) */
  depth: number;
  /** Whether this is an array element */
  isArrayElement: boolean;
  /** Array index if this is an array element */
  arrayIndex?: number;
}

/**
 * Options for flattening documents
 */
export interface FlattenOptions {
  /** Maximum depth to flatten (default: unlimited) */
  maxDepth?: number;
  /** How to represent array indices: 'bracket' for [0], 'dot' for .0 */
  arrayNotation?: 'bracket' | 'dot';
  /** Whether to include array/object containers themselves */
  includeContainers?: boolean;
  /** Paths to exclude from flattening */
  excludePaths?: string[];
  /** Whether to sort keys alphabetically */
  sortKeys?: boolean;
}

/**
 * A node in a tree representation of a document
 */
export interface TreeNode {
  /** The key/field name */
  key: string;
  /** Full path from root */
  path: string;
  /** The value (for leaf nodes) or undefined (for containers) */
  value: unknown;
  /** Detected value type */
  type: ValueType;
  /** Child nodes (for objects and arrays) */
  children?: TreeNode[];
  /** Whether this node is expanded in UI */
  isExpanded?: boolean;
  /** Number of children (for collapsed display) */
  childCount?: number;
  /** Whether this is an array element */
  isArrayElement?: boolean;
  /** Array index if this is an array element */
  arrayIndex?: number;
}

/**
 * Options for creating tree representations
 */
export interface TreeOptions {
  /** Paths that should be expanded */
  expandedPaths?: Set<string>;
  /** Maximum depth to process */
  maxDepth?: number;
  /** Whether to sort object keys alphabetically */
  sortKeys?: boolean;
}

/**
 * Result of type inference for a column
 */
export interface InferredColumnType {
  /** Most likely type based on values */
  primaryType: ValueType;
  /** All types seen in values */
  seenTypes: Set<ValueType>;
  /** Whether the column has null values */
  hasNulls: boolean;
  /** Sample values for display */
  sampleValues: unknown[];
  /** Whether values appear to be dates */
  isLikelyDate: boolean;
  /** Whether values appear to be JSON strings */
  isLikelyJson: boolean;
}
