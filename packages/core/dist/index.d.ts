import { DatabaseType, ColumnMetadata, DatabaseConnectionConfig, FilterCondition, FilterOperator } from '@dbview/types';

/**
 * Document module types
 */

/**
 * Document database types that use document-style storage
 */
type DocumentDbType = 'mongodb' | 'elasticsearch' | 'cassandra';
/**
 * Check if a database type is a document database
 */
declare function isDocumentDbType(dbType: DatabaseType): dbType is DocumentDbType;
/**
 * Result of extracting document ID fields
 */
interface DocumentIdInfo {
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
interface PathOptions {
    /** How to handle array indices: 'bracket' for [0], 'dot' for .0 */
    arrayNotation?: 'bracket' | 'dot';
    /** Whether to create intermediate objects when setting values */
    createIntermediates?: boolean;
}

/**
 * Document ID utilities
 *
 * Provides functions for identifying and extracting document IDs
 * from various document databases (MongoDB, Elasticsearch, Cassandra).
 */

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
declare function getDocumentIdField(columns: ColumnMetadata[] | undefined, dbType: DatabaseType): string;
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
declare function getDocumentIdFields(columns: ColumnMetadata[] | undefined, dbType: DatabaseType): DocumentIdInfo;
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
declare function getDocumentId(document: Record<string, unknown>, columns: ColumnMetadata[] | undefined, dbType: DatabaseType): string;
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
declare function getCompositeDocumentId(document: Record<string, unknown>, columns: ColumnMetadata[] | undefined, dbType: DatabaseType, separator?: string): string;
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
declare function getPrimaryKeyObject(document: Record<string, unknown>, columns: ColumnMetadata[] | undefined, dbType: DatabaseType): Record<string, unknown>;

/**
 * Path utilities for document manipulation
 *
 * Provides functions for getting, setting, and deleting values
 * at dot-notation paths in nested objects. All mutating operations
 * are immutable (return new objects).
 */

/**
 * Parses a dot-notation path into an array of keys.
 *
 * Handles both dot notation and bracket notation for arrays.
 *
 * @param path - The path string (e.g., "user.addresses[0].city")
 * @returns Array of path segments
 *
 * @example
 * ```typescript
 * parsePath('user.name'); // ['user', 'name']
 * parsePath('items[0].value'); // ['items', '0', 'value']
 * parsePath('a.b.c'); // ['a', 'b', 'c']
 * ```
 */
declare function parsePath(path: string): string[];
/**
 * Builds a path string from an array of segments.
 *
 * @param segments - Array of path segments
 * @param options - Options for path building
 * @returns Path string
 *
 * @example
 * ```typescript
 * buildPath(['user', 'name']); // 'user.name'
 * buildPath(['items', '0', 'value'], { arrayNotation: 'bracket' }); // 'items[0].value'
 * ```
 */
declare function buildPath(segments: string[], options?: PathOptions): string;
/**
 * Gets a value at a dot-notation path.
 *
 * @param obj - The object to get value from
 * @param path - The dot-notation path
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', addresses: [{ city: 'NYC' }] } };
 * getAtPath(obj, 'user.name'); // 'John'
 * getAtPath(obj, 'user.addresses.0.city'); // 'NYC'
 * getAtPath(obj, 'user.addresses[0].city'); // 'NYC'
 * getAtPath(obj, 'user.missing'); // undefined
 * ```
 */
declare function getAtPath(obj: Record<string, unknown>, path: string): unknown;
/**
 * Checks if a path exists in an object.
 *
 * @param obj - The object to check
 * @param path - The dot-notation path
 * @returns True if the path exists (even if value is undefined)
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John' } };
 * hasPath(obj, 'user.name'); // true
 * hasPath(obj, 'user.age'); // false
 * ```
 */
declare function hasPath(obj: Record<string, unknown>, path: string): boolean;
/**
 * Sets a value at a dot-notation path (immutable).
 *
 * Returns a new object with the value set. The original object
 * is not modified. Creates intermediate objects/arrays as needed.
 *
 * @param obj - The original object
 * @param path - The dot-notation path
 * @param value - The value to set
 * @returns A new object with the value set
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John' } };
 * const newObj = setAtPath(obj, 'user.name', 'Jane');
 * // newObj = { user: { name: 'Jane' } }
 * // obj is unchanged
 *
 * const newObj2 = setAtPath(obj, 'user.address.city', 'NYC');
 * // newObj2 = { user: { name: 'John', address: { city: 'NYC' } } }
 * ```
 */
declare function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown>;
/**
 * Deletes a value at a dot-notation path (immutable).
 *
 * Returns a new object with the value removed. The original object
 * is not modified.
 *
 * @param obj - The original object
 * @param path - The dot-notation path
 * @returns A new object with the value removed
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', age: 30 } };
 * const newObj = deleteAtPath(obj, 'user.age');
 * // newObj = { user: { name: 'John' } }
 * // obj is unchanged
 * ```
 */
declare function deleteAtPath(obj: Record<string, unknown>, path: string): Record<string, unknown>;
/**
 * Gets the parent path of a given path.
 *
 * @param path - The dot-notation path
 * @returns The parent path, or empty string for root-level paths
 *
 * @example
 * ```typescript
 * getParentPath('user.address.city'); // 'user.address'
 * getParentPath('user'); // ''
 * ```
 */
declare function getParentPath(path: string): string;
/**
 * Gets the last segment (key) of a path.
 *
 * @param path - The dot-notation path
 * @returns The last segment
 *
 * @example
 * ```typescript
 * getPathKey('user.address.city'); // 'city'
 * getPathKey('user'); // 'user'
 * ```
 */
declare function getPathKey(path: string): string;
/**
 * Joins path segments together.
 *
 * @param parts - Path parts to join
 * @returns Joined path
 *
 * @example
 * ```typescript
 * joinPath('user', 'address', 'city'); // 'user.address.city'
 * joinPath('items', '0'); // 'items.0'
 * ```
 */
declare function joinPath(...parts: (string | number)[]): string;

/**
 * Transform module types
 */
/**
 * Primitive value types that can be detected
 */
type PrimitiveType = 'string' | 'number' | 'boolean' | 'null' | 'undefined';
/**
 * All detectable value types
 */
type ValueType = PrimitiveType | 'object' | 'array' | 'date' | 'objectId' | 'binary' | 'unknown';
/**
 * A flattened field from a nested document
 */
interface FlattenedField {
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
interface FlattenOptions {
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
interface TreeNode {
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
interface TreeOptions {
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
interface InferredColumnType {
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

/**
 * Type inference utilities
 *
 * Provides functions for detecting and inferring data types
 * from values and columns.
 */

/**
 * Detects the type of a value.
 *
 * @param value - The value to detect type for
 * @returns The detected value type
 *
 * @example
 * ```typescript
 * detectValueType('hello'); // 'string'
 * detectValueType(42); // 'number'
 * detectValueType(null); // 'null'
 * detectValueType({ a: 1 }); // 'object'
 * detectValueType([1, 2, 3]); // 'array'
 * detectValueType(new Date()); // 'date'
 * ```
 */
declare function detectValueType(value: unknown): ValueType;
/**
 * Gets a human-readable label for a value type.
 *
 * @param type - The value type
 * @returns Human-readable label
 */
declare function getTypeLabel(type: ValueType): string;
/**
 * Gets a color for a value type (for UI display).
 *
 * @param type - The value type
 * @returns CSS color value
 */
declare function getTypeColor(type: ValueType): string;
/**
 * Checks if a value is a primitive type.
 *
 * @param value - The value to check
 * @returns True if the value is a primitive
 */
declare function isPrimitive(value: unknown): boolean;
/**
 * Checks if a value is a container type (object or array).
 *
 * @param value - The value to check
 * @returns True if the value is a container
 */
declare function isContainer(value: unknown): boolean;
/**
 * Infers the column type from an array of values.
 *
 * Analyzes multiple values to determine the most likely type
 * for a column, handling mixed types gracefully.
 *
 * @param values - Array of values from the column
 * @param maxSamples - Maximum number of values to analyze
 * @returns Inferred column type information
 *
 * @example
 * ```typescript
 * const result = inferColumnType([1, 2, 3, null]);
 * // {
 * //   primaryType: 'number',
 * //   seenTypes: Set(['number', 'null']),
 * //   hasNulls: true,
 * //   sampleValues: [1, 2, 3],
 * //   isLikelyDate: false,
 * //   isLikelyJson: false
 * // }
 * ```
 */
declare function inferColumnType(values: unknown[], maxSamples?: number): InferredColumnType;
/**
 * Formats a value for display based on its type.
 *
 * @param value - The value to format
 * @param maxLength - Maximum string length before truncation
 * @returns Formatted string representation
 */
declare function formatValueForDisplay(value: unknown, maxLength?: number): string;

/**
 * Document flattening utilities
 *
 * Converts nested documents into flat structures with dot-notation paths,
 * useful for table view display of JSON documents.
 */

/**
 * Flattens a nested document into an array of dot-notation paths.
 *
 * Converts nested objects and arrays into a flat list where each item
 * has a path (e.g., "user.address.city") and its value.
 *
 * @param document - The document to flatten
 * @param options - Flattening options
 * @returns Array of flattened fields
 *
 * @example
 * ```typescript
 * const doc = {
 *   user: {
 *     name: 'John',
 *     addresses: [
 *       { city: 'NYC', zip: '10001' }
 *     ]
 *   }
 * };
 *
 * flattenDocument(doc);
 * // [
 * //   { path: 'user.name', value: 'John', type: 'string', depth: 2, ... },
 * //   { path: 'user.addresses.0.city', value: 'NYC', type: 'string', depth: 4, ... },
 * //   { path: 'user.addresses.0.zip', value: '10001', type: 'string', depth: 4, ... }
 * // ]
 * ```
 */
declare function flattenDocument(document: Record<string, unknown>, options?: FlattenOptions): FlattenedField[];
/**
 * Unflattens an array of fields back into a nested document.
 *
 * @param fields - Array of flattened fields
 * @returns Reconstructed nested document
 *
 * @example
 * ```typescript
 * const fields = [
 *   { path: 'user.name', value: 'John', ... },
 *   { path: 'user.age', value: 30, ... }
 * ];
 *
 * unflattenDocument(fields);
 * // { user: { name: 'John', age: 30 } }
 * ```
 */
declare function unflattenDocument(fields: FlattenedField[]): Record<string, unknown>;
/**
 * Gets all unique root keys from an array of documents.
 *
 * Useful for determining columns in a table view.
 *
 * @param documents - Array of documents
 * @param maxDepth - Maximum depth to analyze (default: 1 for root keys only)
 * @returns Array of unique paths
 */
declare function getDocumentKeys(documents: Record<string, unknown>[], maxDepth?: number): string[];
/**
 * Counts the number of fields in a document (including nested).
 *
 * @param document - The document to count fields for
 * @returns Total number of fields
 */
declare function countDocumentFields(document: Record<string, unknown>): number;
/**
 * Gets the maximum depth of a document.
 *
 * @param document - The document to analyze
 * @returns Maximum nesting depth
 */
declare function getDocumentDepth(document: Record<string, unknown>): number;

/**
 * Tree representation utilities
 *
 * Converts documents into tree structures suitable for hierarchical display.
 */

/**
 * Converts a document into a tree structure.
 *
 * Creates a hierarchical representation suitable for tree view UIs,
 * with expand/collapse state based on provided paths.
 *
 * @param document - The document to convert
 * @param options - Tree options including expanded paths
 * @returns Root tree node
 *
 * @example
 * ```typescript
 * const doc = {
 *   user: { name: 'John', age: 30 },
 *   items: ['a', 'b']
 * };
 *
 * const tree = nestToTree(doc, {
 *   expandedPaths: new Set(['root', 'root.user'])
 * });
 * // {
 * //   key: 'root',
 * //   path: 'root',
 * //   type: 'object',
 * //   isExpanded: true,
 * //   children: [
 * //     { key: 'user', path: 'root.user', type: 'object', isExpanded: true, children: [...] },
 * //     { key: 'items', path: 'root.items', type: 'array', isExpanded: false, childCount: 2 }
 * //   ]
 * // }
 * ```
 */
declare function nestToTree(document: Record<string, unknown>, options?: TreeOptions): TreeNode;
/**
 * Gets all paths that should be expanded for a given depth.
 *
 * @param document - The document
 * @param depth - Depth to expand (0 = root only, 1 = first level, etc.)
 * @returns Set of paths to expand
 *
 * @example
 * ```typescript
 * const expandedPaths = getExpandedPathsToDepth(doc, 2);
 * // Set(['root', 'root.user', 'root.items'])
 * ```
 */
declare function getExpandedPathsToDepth(document: Record<string, unknown>, depth: number): Set<string>;
/**
 * Expands a path and all its parents.
 *
 * @param currentPaths - Current set of expanded paths
 * @param path - Path to expand
 * @returns New set with the path and all parents expanded
 */
declare function expandPath(currentPaths: Set<string>, path: string): Set<string>;
/**
 * Collapses a path (removes it from expanded set).
 *
 * @param currentPaths - Current set of expanded paths
 * @param path - Path to collapse
 * @returns New set with the path removed
 */
declare function collapsePath(currentPaths: Set<string>, path: string): Set<string>;
/**
 * Toggles a path's expanded state.
 *
 * @param currentPaths - Current set of expanded paths
 * @param path - Path to toggle
 * @returns New set with the path toggled
 */
declare function togglePath(currentPaths: Set<string>, path: string): Set<string>;
/**
 * Expands all paths in a document.
 *
 * @param document - The document
 * @returns Set of all container paths
 */
declare function expandAll(document: Record<string, unknown>): Set<string>;
/**
 * Collapses all paths (returns set with just root).
 *
 * @returns Set with only root expanded
 */
declare function collapseAll(): Set<string>;
/**
 * Finds tree nodes matching a search term.
 *
 * @param node - Root node to search from
 * @param searchTerm - Term to search for (case-insensitive)
 * @returns Array of matching paths
 */
declare function searchTree(node: TreeNode, searchTerm: string): string[];
/**
 * Gets paths that should be expanded to show search results.
 *
 * @param matchingPaths - Array of paths that match the search
 * @returns Set of paths to expand
 */
declare function getPathsToShowSearchResults(matchingPaths: string[]): Set<string>;

/**
 * Byte formatting utilities
 *
 * Provides functions for formatting byte sizes into human-readable strings.
 */
/**
 * Options for byte formatting
 */
interface FormatBytesOptions {
    /** Number of decimal places (default: 2) */
    decimals?: number;
    /** Use binary units (KiB, MiB) instead of SI (KB, MB) */
    binary?: boolean;
    /** Include space between number and unit */
    space?: boolean;
}
/**
 * Formats a byte size into a human-readable string.
 *
 * @param bytes - Number of bytes
 * @param options - Formatting options
 * @returns Formatted string (e.g., "1.5 MB")
 *
 * @example
 * ```typescript
 * formatBytes(0); // '0 B'
 * formatBytes(1024); // '1 KB'
 * formatBytes(1536); // '1.5 KB'
 * formatBytes(1048576); // '1 MB'
 * formatBytes(1048576, { binary: true }); // '1 MiB'
 * formatBytes(1536, { decimals: 0 }); // '2 KB'
 * ```
 */
declare function formatBytes(bytes: number, options?: FormatBytesOptions): string;
/**
 * Parses a formatted byte string back to number of bytes.
 *
 * @param formatted - Formatted string (e.g., "1.5 MB")
 * @returns Number of bytes, or null if parsing fails
 *
 * @example
 * ```typescript
 * parseBytes('1 KB'); // 1000
 * parseBytes('1 KiB'); // 1024
 * parseBytes('1.5 MB'); // 1500000
 * parseBytes('invalid'); // null
 * ```
 */
declare function parseBytes(formatted: string): number | null;
/**
 * Formats bytes per second as a transfer rate.
 *
 * @param bytesPerSecond - Bytes per second
 * @param options - Formatting options
 * @returns Formatted string (e.g., "1.5 MB/s")
 */
declare function formatBytesPerSecond(bytesPerSecond: number, options?: FormatBytesOptions): string;

/**
 * Value truncation utilities
 *
 * Provides functions for truncating values for display purposes.
 */
/**
 * Options for truncating strings
 */
interface TruncateOptions {
    /** Maximum length before truncation */
    maxLength?: number;
    /** String to append when truncated (default: '...') */
    ellipsis?: string;
    /** Truncate at word boundary if possible */
    wordBoundary?: boolean;
    /** Position: 'end' (default), 'middle', or 'start' */
    position?: 'end' | 'middle' | 'start';
}
/**
 * Truncates a string to a maximum length.
 *
 * @param value - String to truncate
 * @param options - Truncation options
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncateString('Hello World', { maxLength: 8 }); // 'Hello...'
 * truncateString('Hello World', { maxLength: 8, ellipsis: '…' }); // 'Hello W…'
 * truncateString('Hello World', { maxLength: 8, position: 'middle' }); // 'Hel...ld'
 * ```
 */
declare function truncateString(value: string, options?: TruncateOptions): string;
/**
 * Truncates any value for display.
 *
 * Handles different types appropriately:
 * - Strings: Truncated with ellipsis
 * - Arrays: Shows count
 * - Objects: Shows key count
 * - Other: Converted to string and truncated
 *
 * @param value - Value to truncate
 * @param maxLength - Maximum length for strings
 * @returns Truncated representation
 *
 * @example
 * ```typescript
 * truncateValue('Long string...', 10); // 'Long st...'
 * truncateValue([1, 2, 3, 4, 5], 10); // '[5 items]'
 * truncateValue({ a: 1, b: 2 }, 10); // '{2 keys}'
 * truncateValue(12345, 10); // '12345'
 * ```
 */
declare function truncateValue(value: unknown, maxLength?: number): string;
/**
 * Truncates a JSON string with pretty formatting.
 *
 * @param json - JSON string or object
 * @param maxLength - Maximum length
 * @returns Truncated JSON string
 */
declare function truncateJson(json: string | object, maxLength?: number): string;
/**
 * Truncates an array of values for display.
 *
 * @param values - Array of values
 * @param maxItems - Maximum items to show
 * @param maxValueLength - Maximum length per value
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * truncateArray(['a', 'b', 'c', 'd', 'e'], 3);
 * // '"a", "b", "c" +2 more'
 * ```
 */
declare function truncateArray(values: unknown[], maxItems?: number, maxValueLength?: number): string;
/**
 * Truncates a file path, keeping the filename visible.
 *
 * @param path - File path
 * @param maxLength - Maximum length
 * @returns Truncated path
 *
 * @example
 * ```typescript
 * truncatePath('/very/long/path/to/file.txt', 20);
 * // '.../to/file.txt'
 * ```
 */
declare function truncatePath(path: string, maxLength?: number): string;

/**
 * ID generation utilities
 *
 * Provides functions for generating unique identifiers.
 */
/**
 * Generates a random alphanumeric ID.
 *
 * @param length - Length of the ID (default: 8)
 * @returns Random ID string
 *
 * @example
 * ```typescript
 * generateId(); // 'aB3xY9mK'
 * generateId(16); // 'aB3xY9mKpL2nQ8wR'
 * ```
 */
declare function generateId(length?: number): string;
/**
 * Generates a UUID v4.
 *
 * @returns UUID string (e.g., '550e8400-e29b-41d4-a716-446655440000')
 *
 * @example
 * ```typescript
 * generateUUID(); // '550e8400-e29b-41d4-a716-446655440000'
 * ```
 */
declare function generateUUID(): string;
/**
 * Generates a sequential ID with a prefix.
 *
 * IDs are guaranteed to be unique within the same runtime session.
 *
 * @param prefix - Prefix for the ID (default: 'id')
 * @returns Sequential ID string
 *
 * @example
 * ```typescript
 * generateSequentialId(); // 'id_1'
 * generateSequentialId(); // 'id_2'
 * generateSequentialId('tab'); // 'tab_3'
 * ```
 */
declare function generateSequentialId(prefix?: string): string;
/**
 * Resets the sequential counter (for testing).
 */
declare function resetSequentialCounter(): void;
/**
 * Generates a timestamp-based ID.
 *
 * Combines timestamp with random suffix for uniqueness.
 *
 * @param prefix - Optional prefix
 * @returns Timestamp-based ID
 *
 * @example
 * ```typescript
 * generateTimestampId(); // '1704067200000_aB3x'
 * generateTimestampId('doc'); // 'doc_1704067200000_aB3x'
 * ```
 */
declare function generateTimestampId(prefix?: string): string;
/**
 * Generates a short hash from a string.
 *
 * Not cryptographically secure, but useful for creating
 * deterministic short identifiers.
 *
 * @param input - String to hash
 * @param length - Length of output (default: 8)
 * @returns Short hash string
 *
 * @example
 * ```typescript
 * generateHash('hello'); // 'aB3xY9mK'
 * generateHash('hello'); // 'aB3xY9mK' (same input = same output)
 * ```
 */
declare function generateHash(input: string, length?: number): string;
/**
 * Generates a slug from a string.
 *
 * Converts to lowercase, replaces spaces with dashes,
 * and removes special characters.
 *
 * @param input - String to convert
 * @param maxLength - Maximum length (default: 50)
 * @returns Slug string
 *
 * @example
 * ```typescript
 * generateSlug('Hello World!'); // 'hello-world'
 * generateSlug('My Query #1'); // 'my-query-1'
 * ```
 */
declare function generateSlug(input: string, maxLength?: number): string;

/**
 * Connection key utilities
 *
 * Provides functions for generating and parsing connection keys
 * that uniquely identify database connections.
 */

/**
 * Parsed connection key information
 */
interface ParsedConnectionKey {
    /** Database type */
    dbType: DatabaseType;
    /** Identifier part after the type */
    identifier: string;
    /** Original connection key */
    original: string;
}
/**
 * Generates a unique connection key from a database configuration.
 *
 * Connection keys follow the format: `{dbType}:{identifier}`
 *
 * The identifier varies by database type:
 * - Named connections: uses the name
 * - SQLite: uses the file path
 * - MongoDB with connection string: uses the connection string
 * - Others: uses `{user}@{host}:{port}/{database}`
 *
 * @param config - Database connection configuration
 * @returns Unique connection key
 *
 * @example
 * ```typescript
 * // Named connection
 * getConnectionKey({ name: 'Production', dbType: 'postgres', ... });
 * // 'postgres:Production'
 *
 * // SQLite
 * getConnectionKey({ dbType: 'sqlite', filePath: '/path/to/db.sqlite' });
 * // 'sqlite:/path/to/db.sqlite'
 *
 * // PostgreSQL without name
 * getConnectionKey({ dbType: 'postgres', host: 'localhost', port: 5432, database: 'mydb', user: 'admin' });
 * // 'postgres:admin@localhost:5432/mydb'
 * ```
 */
declare function getConnectionKey(config: DatabaseConnectionConfig): string;
/**
 * Parses a connection key into its components.
 *
 * @param connectionKey - The connection key to parse
 * @returns Parsed components or null if invalid
 *
 * @example
 * ```typescript
 * parseConnectionKey('postgres:Production');
 * // { dbType: 'postgres', identifier: 'Production', original: 'postgres:Production' }
 *
 * parseConnectionKey('invalid');
 * // null
 * ```
 */
declare function parseConnectionKey(connectionKey: string): ParsedConnectionKey | null;
/**
 * Extracts a display name from a connection key.
 *
 * Returns a human-readable name for UI display.
 *
 * @param connectionKey - The connection key
 * @returns Display name
 *
 * @example
 * ```typescript
 * getConnectionDisplayName('postgres:Production');
 * // 'Production'
 *
 * getConnectionDisplayName('postgres:admin@localhost:5432/mydb');
 * // 'mydb'
 * ```
 */
declare function getConnectionDisplayName(connectionKey: string): string;
/**
 * Checks if two connection keys refer to the same connection.
 *
 * @param key1 - First connection key
 * @param key2 - Second connection key
 * @returns True if they refer to the same connection
 */
declare function isSameConnection(key1: string, key2: string): boolean;
/**
 * Gets the database type from a connection key.
 *
 * @param connectionKey - The connection key
 * @returns Database type or null if invalid
 */
declare function getDbTypeFromKey(connectionKey: string): DatabaseType | null;

/**
 * Debounce utilities
 *
 * Provides debounce and throttle functions for rate-limiting.
 */
/**
 * Debounced function type
 */
interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
    (...args: Parameters<T>): void;
    /** Cancels any pending invocation */
    cancel: () => void;
    /** Immediately invokes the pending function */
    flush: () => void;
    /** Returns true if there's a pending invocation */
    pending: () => boolean;
}
/**
 * Creates a debounced version of a function.
 *
 * The debounced function delays invoking the provided function
 * until after the specified wait time has elapsed since the last
 * time it was invoked.
 *
 * @param fn - Function to debounce
 * @param wait - Wait time in milliseconds
 * @param options - Options for debouncing
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((term: string) => {
 *   console.log('Searching for:', term);
 * }, 300);
 *
 * // Rapid calls
 * debouncedSearch('h');
 * debouncedSearch('he');
 * debouncedSearch('hel');
 * debouncedSearch('hello');
 * // Only logs: 'Searching for: hello' (after 300ms)
 *
 * // Cancel pending call
 * debouncedSearch.cancel();
 * ```
 */
declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait: number, options?: {
    /** Call on the leading edge instead of trailing */
    leading?: boolean;
    /** Call on the trailing edge (default: true) */
    trailing?: boolean;
    /** Maximum time to wait before invoking */
    maxWait?: number;
}): DebouncedFunction<T>;
/**
 * Creates a throttled version of a function.
 *
 * The throttled function only invokes the provided function
 * at most once per wait period.
 *
 * @param fn - Function to throttle
 * @param wait - Minimum wait time between invocations
 * @param options - Options for throttling
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll position:', window.scrollY);
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 * // Logs at most once per 100ms while scrolling
 * ```
 */
declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, wait: number, options?: {
    /** Call on the leading edge (default: true) */
    leading?: boolean;
    /** Call on the trailing edge (default: true) */
    trailing?: boolean;
}): DebouncedFunction<T>;
/**
 * Creates a function that only runs once.
 *
 * @param fn - Function to run once
 * @returns Function that only executes on first call
 *
 * @example
 * ```typescript
 * const initialize = once(() => {
 *   console.log('Initializing...');
 *   return { ready: true };
 * });
 *
 * initialize(); // Logs 'Initializing...' and returns { ready: true }
 * initialize(); // Returns { ready: true } without logging
 * ```
 */
declare function once<T extends (...args: unknown[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T>;

/**
 * Filter module types
 *
 * Types and interfaces for building database-specific filters
 * from a common FilterCondition structure.
 */

/**
 * Result of building a SQL filter
 */
interface SqlFilterResult {
    /** The WHERE clause (without the WHERE keyword) */
    whereClause: string;
    /** Parameter values for the prepared statement */
    params: unknown[];
}
/**
 * Result of building a SQL filter with named parameters (for SQL Server)
 */
interface SqlFilterResultNamed {
    /** The WHERE clause (without the WHERE keyword) */
    whereClause: string;
    /** Named parameter values */
    params: Record<string, unknown>;
}
/**
 * Result of building a MongoDB filter
 */
interface MongoFilterResult {
    /** MongoDB query object */
    query: Record<string, unknown>;
}
/**
 * Result of building an Elasticsearch filter
 */
interface ElasticsearchFilterResult {
    /** Elasticsearch query DSL */
    query: {
        bool: {
            must?: Record<string, unknown>[];
            should?: Record<string, unknown>[];
            filter?: Record<string, unknown>[];
            must_not?: Record<string, unknown>[];
            minimum_should_match?: number;
        };
    };
}
/**
 * Result of building a Cassandra CQL filter
 */
interface CassandraFilterResult {
    /** CQL WHERE clause conditions */
    whereClause: string;
    /** Parameter values */
    params: unknown[];
}
/**
 * Placeholder style for SQL databases
 */
type PlaceholderStyle = 'positional' | 'question' | 'named';
/**
 * Options for SQL filter building
 */
interface SqlFilterOptions {
    /** Database type for syntax variations */
    dbType: DatabaseType;
    /** Quote function for identifiers */
    quoteIdentifier?: (name: string) => string;
    /** Starting parameter index (for positional placeholders) */
    startIndex?: number;
}
/**
 * Filter validation result
 */
interface FilterValidationResult {
    /** Whether the filter is valid */
    valid: boolean;
    /** Validation error messages */
    errors: string[];
    /** Validated and normalized filter (if valid) */
    normalizedFilter?: FilterCondition;
}
/**
 * Operator metadata
 */
interface OperatorMetadata {
    /** Display label for UI */
    label: string;
    /** Whether operator requires a value */
    needsValue: boolean;
    /** Whether operator requires two values (BETWEEN) */
    needsTwoValues: boolean;
    /** Whether operator expects comma-separated values (IN) */
    needsCommaSeparated: boolean;
    /** Data types this operator is applicable to */
    applicableTypes: ('string' | 'number' | 'date' | 'boolean' | 'any')[];
}

/**
 * SQL Filter Builder
 *
 * Builds parameterized SQL WHERE clauses from filter conditions.
 * Supports multiple SQL databases with their specific placeholder styles.
 */

/**
 * Builds a SQL WHERE clause from filter conditions.
 *
 * Uses parameterized queries to prevent SQL injection.
 * Supports different SQL databases with their specific syntax.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @param options - SQL filter options including database type
 * @returns WHERE clause (without WHERE keyword) and parameters
 *
 * @example
 * ```typescript
 * // PostgreSQL
 * const result = buildSqlFilter(
 *   [{ id: '1', columnName: 'age', operator: 'greater_than', value: 18 }],
 *   'AND',
 *   { dbType: 'postgres' }
 * );
 * // result.whereClause = '"age" > $1'
 * // result.params = [18]
 *
 * // MySQL
 * const result = buildSqlFilter(
 *   [{ id: '1', columnName: 'name', operator: 'contains', value: 'john' }],
 *   'AND',
 *   { dbType: 'mysql' }
 * );
 * // result.whereClause = '`name` LIKE ?'
 * // result.params = ['%john%']
 * ```
 */
declare function buildSqlFilter(filters: FilterCondition[], logic: 'AND' | 'OR', options: SqlFilterOptions): SqlFilterResult;
/**
 * Builds a SQL WHERE clause with named parameters (for SQL Server).
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @param options - SQL filter options
 * @returns WHERE clause and named parameters
 */
declare function buildSqlFilterNamed(filters: FilterCondition[], logic: 'AND' | 'OR', options: Omit<SqlFilterOptions, 'dbType'> & {
    dbType?: DatabaseType;
}): SqlFilterResultNamed;
/**
 * Helper function to build WHERE clause for a specific database type.
 * This is a convenience wrapper around buildSqlFilter.
 */
declare function buildWhereClause(filters: FilterCondition[], logic: 'AND' | 'OR', dbType: DatabaseType, quoteIdentifier?: (name: string) => string): SqlFilterResult;

/**
 * MongoDB Filter Builder
 *
 * Converts filter conditions to MongoDB query DSL.
 */

/**
 * Builds a MongoDB query object from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns MongoDB query object
 *
 * @example
 * ```typescript
 * const result = buildMongoFilter(
 *   [
 *     { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
 *     { id: '2', columnName: 'status', operator: 'equals', value: 'active' }
 *   ],
 *   'AND'
 * );
 * // result.query = {
 * //   $and: [
 * //     { age: { $gt: 18 } },
 * //     { status: { $eq: 'active' } }
 * //   ]
 * // }
 * ```
 */
declare function buildMongoFilter(filters: FilterCondition[], logic?: 'AND' | 'OR'): MongoFilterResult;
/**
 * Builds a MongoDB aggregation pipeline match stage from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns MongoDB $match stage object
 *
 * @example
 * ```typescript
 * const match = buildMongoMatchStage(filters, 'AND');
 * const pipeline = [match, { $limit: 100 }];
 * ```
 */
declare function buildMongoMatchStage(filters: FilterCondition[], logic?: 'AND' | 'OR'): {
    $match: Record<string, unknown>;
};

/**
 * Elasticsearch Filter Builder
 *
 * Converts filter conditions to Elasticsearch Query DSL.
 */

/**
 * Builds an Elasticsearch query DSL from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns Elasticsearch query DSL object
 *
 * @example
 * ```typescript
 * const result = buildElasticsearchFilter(
 *   [
 *     { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
 *     { id: '2', columnName: 'status', operator: 'equals', value: 'active' }
 *   ],
 *   'AND'
 * );
 * // result.query = {
 * //   bool: {
 * //     must: [
 * //       { range: { age: { gt: 18 } } },
 * //       { term: { status: 'active' } }
 * //     ]
 * //   }
 * // }
 * ```
 */
declare function buildElasticsearchFilter(filters: FilterCondition[], logic?: 'AND' | 'OR'): ElasticsearchFilterResult;
/**
 * Builds an Elasticsearch search request body with filters.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic
 * @param options - Additional search options
 * @returns Elasticsearch search request body
 */
declare function buildElasticsearchSearchBody(filters: FilterCondition[], logic?: 'AND' | 'OR', options?: {
    from?: number;
    size?: number;
    sort?: Array<Record<string, 'asc' | 'desc'>>;
}): Record<string, unknown>;

/**
 * Cassandra CQL Filter Builder
 *
 * Converts filter conditions to Cassandra CQL WHERE clauses.
 * Note: Cassandra has limited filtering capabilities compared to SQL.
 */

/**
 * Builds a Cassandra CQL WHERE clause from filter conditions.
 *
 * Note: Cassandra has limited WHERE clause support:
 * - Only = on partition key columns without ALLOW FILTERING
 * - Range queries (>, <, >=, <=) on clustering columns
 * - IN on partition key columns
 * - CONTAINS for collection columns
 *
 * The caller should add ALLOW FILTERING if needed.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic (Note: Cassandra only supports AND natively)
 * @returns CQL WHERE clause and parameters
 *
 * @example
 * ```typescript
 * const result = buildCassandraFilter(
 *   [
 *     { id: '1', columnName: 'user_id', operator: 'equals', value: 'abc123' },
 *     { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
 *   ],
 *   'AND'
 * );
 * // result.whereClause = '"user_id" = ? AND "age" > ?'
 * // result.params = ['abc123', 18]
 * ```
 */
declare function buildCassandraFilter(filters: FilterCondition[], logic?: 'AND' | 'OR'): CassandraFilterResult;
/**
 * Checks if a set of filters can be executed without ALLOW FILTERING.
 *
 * This is a heuristic check - actual requirements depend on table schema.
 *
 * @param filters - Array of filter conditions
 * @returns Whether ALLOW FILTERING is likely needed
 */
declare function needsAllowFiltering(filters: FilterCondition[]): boolean;

/**
 * Filter operator definitions and utilities
 *
 * Provides operator metadata, type-based operator lists,
 * and utility functions for working with filter operators.
 */

/**
 * Complete operator metadata registry
 */
declare const OPERATOR_METADATA: Record<FilterOperator, OperatorMetadata>;
/**
 * Operators applicable to string columns
 */
declare const STRING_OPERATORS: FilterOperator[];
/**
 * Operators applicable to numeric columns
 */
declare const NUMERIC_OPERATORS: FilterOperator[];
/**
 * Operators applicable to date/time columns
 */
declare const DATE_OPERATORS: FilterOperator[];
/**
 * Operators applicable to boolean columns
 */
declare const BOOLEAN_OPERATORS: FilterOperator[];
/**
 * All available operators
 */
declare const ALL_OPERATORS: FilterOperator[];
/**
 * Display labels for operators (convenience export)
 */
declare const OPERATOR_LABELS: Record<FilterOperator, string>;
/**
 * Gets the appropriate operators for a column data type.
 *
 * @param dataType - The column data type string
 * @returns Array of applicable operators
 *
 * @example
 * ```typescript
 * getOperatorsForType('integer'); // NUMERIC_OPERATORS
 * getOperatorsForType('varchar'); // STRING_OPERATORS
 * getOperatorsForType('timestamp'); // DATE_OPERATORS
 * ```
 */
declare function getOperatorsForType(dataType: string): FilterOperator[];
/**
 * Gets metadata for an operator.
 *
 * @param operator - The filter operator
 * @returns Operator metadata
 */
declare function getOperatorMetadata(operator: FilterOperator): OperatorMetadata;
/**
 * Checks if an operator requires a value input.
 *
 * @param operator - The filter operator
 * @returns True if operator needs a value
 */
declare function operatorNeedsValue(operator: FilterOperator): boolean;
/**
 * Checks if an operator requires two values (BETWEEN).
 *
 * @param operator - The filter operator
 * @returns True if operator needs two values
 */
declare function operatorNeedsTwoValues(operator: FilterOperator): boolean;
/**
 * Checks if an operator expects comma-separated values (IN).
 *
 * @param operator - The filter operator
 * @returns True if operator needs comma-separated values
 */
declare function operatorNeedsCommaSeparated(operator: FilterOperator): boolean;
/**
 * Checks if an operator is valid for a given data type.
 *
 * @param operator - The filter operator
 * @param dataType - The column data type
 * @returns True if operator is valid for the type
 */
declare function isOperatorValidForType(operator: FilterOperator, dataType: string): boolean;

/**
 * Filter Validation
 *
 * Validates filter conditions and provides helpful error messages.
 */

/**
 * Validates a single filter condition.
 *
 * @param filter - The filter condition to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validateFilter({
 *   id: '1',
 *   columnName: 'age',
 *   operator: 'greater_than',
 *   value: 18
 * });
 * // result.valid = true
 * ```
 */
declare function validateFilter(filter: FilterCondition): FilterValidationResult;
/**
 * Validates an array of filter conditions.
 *
 * @param filters - Array of filter conditions
 * @returns Array of validation results
 */
declare function validateFilters(filters: FilterCondition[]): FilterValidationResult[];
/**
 * Checks if all filters in an array are valid.
 *
 * @param filters - Array of filter conditions
 * @returns True if all filters are valid
 */
declare function areFiltersValid(filters: FilterCondition[]): boolean;
/**
 * Gets all validation errors from an array of filters.
 *
 * @param filters - Array of filter conditions
 * @returns Array of error messages with filter context
 */
declare function getFilterErrors(filters: FilterCondition[]): string[];
/**
 * Normalizes a filter condition.
 * - Trims string values
 * - Converts types where appropriate
 * - Ensures consistent structure
 *
 * @param filter - The filter to normalize
 * @returns Normalized filter
 */
declare function normalizeFilter(filter: FilterCondition): FilterCondition;
/**
 * Creates a new filter condition with default values.
 *
 * @param columnName - The column name
 * @param operator - The operator (default: 'equals')
 * @returns New filter condition
 */
declare function createFilter(columnName: string, operator?: FilterOperator): FilterCondition;
/**
 * Checks if a filter condition is empty (no meaningful value).
 *
 * @param filter - The filter to check
 * @returns True if filter is effectively empty
 */
declare function isFilterEmpty(filter: FilterCondition): boolean;
/**
 * Removes empty filters from an array.
 *
 * @param filters - Array of filter conditions
 * @returns Filters with empty ones removed
 */
declare function removeEmptyFilters(filters: FilterCondition[]): FilterCondition[];

/**
 * Export/Import Type Definitions
 * @dbview/core - Phase 3: Export/Import
 */
/**
 * Options for CSV export
 */
interface CsvExportOptions {
    /** Include column headers as first row (default: true) */
    includeHeaders?: boolean;
    /** Delimiter character (default: ',') */
    delimiter?: string;
    /** Line ending (default: '\n') */
    lineEnding?: string;
    /** Null value representation (default: '') */
    nullValue?: string;
}
/**
 * Options for JSON export
 */
interface JsonExportOptions {
    /** Pretty print with indentation (default: true) */
    pretty?: boolean;
    /** Indentation spaces when pretty printing (default: 2) */
    indent?: number;
    /** Only include specified columns */
    columns?: string[];
}
/**
 * Options for SQL export
 */
interface SqlExportOptions {
    /** Database type for syntax variations */
    dbType?: 'postgres' | 'mysql' | 'sqlite' | 'sqlserver';
    /** Schema name (optional, some DBs don't use schemas) */
    schema?: string;
    /** Table name (required) */
    table: string;
    /** Include column names in INSERT statements (default: true) */
    includeColumns?: boolean;
    /** Batch size for multi-row INSERT (default: 1, no batching) */
    batchSize?: number;
}
/**
 * Options for Markdown export
 */
interface MarkdownExportOptions {
    /** Column alignment: 'left' | 'center' | 'right' (default: 'left') */
    alignment?: 'left' | 'center' | 'right' | Record<string, 'left' | 'center' | 'right'>;
    /** Maximum column width before truncation (default: no limit) */
    maxColumnWidth?: number;
    /** Null value representation (default: '') */
    nullValue?: string;
}
/**
 * Options for CSV import
 */
interface CsvImportOptions {
    /** First row contains headers (default: true) */
    hasHeaders?: boolean;
    /** Delimiter character (default: ',') */
    delimiter?: string;
    /** Skip empty lines (default: true) */
    skipEmptyLines?: boolean;
    /** Trim whitespace from values (default: true) */
    trimValues?: boolean;
}
/**
 * Options for JSON import
 */
interface JsonImportOptions {
    /** Property path if data is nested (e.g., 'data.results') */
    dataPath?: string;
}
/**
 * Result of import parsing
 */
interface ImportResult {
    /** Detected column names */
    columns: string[];
    /** Parsed data rows */
    rows: Record<string, unknown>[];
    /** Number of rows parsed */
    rowCount: number;
    /** Any warnings during parsing */
    warnings?: string[];
}
/**
 * Export format types
 */
type ExportFormat = 'csv' | 'json' | 'sql' | 'markdown';
/**
 * Generic row data type
 */
type RowData = Record<string, unknown>;

/**
 * CSV Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

/**
 * Convert rows to CSV format
 *
 * @param rows - Array of row objects
 * @param columns - Column names to include (in order)
 * @param options - Export options
 * @returns CSV formatted string
 *
 * @example
 * ```ts
 * const csv = toCsv(
 *   [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }],
 *   ['name', 'age']
 * );
 * // "name,age\nJohn,30\nJane,25"
 * ```
 */
declare function toCsv(rows: RowData[], columns: string[], options?: CsvExportOptions): string;

/**
 * JSON Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

/**
 * Convert rows to JSON format
 *
 * @param rows - Array of row objects
 * @param options - Export options
 * @returns JSON formatted string
 *
 * @example
 * ```ts
 * const json = toJson([{ name: 'John', age: 30 }]);
 * // '[{\n  "name": "John",\n  "age": 30\n}]'
 * ```
 */
declare function toJson(rows: RowData[], options?: JsonExportOptions): string;
/**
 * Convert rows to JSON Lines (NDJSON) format
 * Each row is a separate JSON object on its own line
 *
 * @param rows - Array of row objects
 * @param options - Export options (columns filter only)
 * @returns JSON Lines formatted string
 *
 * @example
 * ```ts
 * const jsonl = toJsonLines([{ name: 'John' }, { name: 'Jane' }]);
 * // '{"name":"John"}\n{"name":"Jane"}'
 * ```
 */
declare function toJsonLines(rows: RowData[], options?: Pick<JsonExportOptions, 'columns'>): string;

/**
 * SQL Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

/**
 * Convert rows to SQL INSERT statements
 *
 * @param rows - Array of row objects
 * @param columns - Column names to include
 * @param options - Export options (table is required)
 * @returns SQL INSERT statements string
 *
 * @example
 * ```ts
 * const sql = toSql(
 *   [{ name: 'John', age: 30 }],
 *   ['name', 'age'],
 *   { table: 'users' }
 * );
 * // 'INSERT INTO "users" ("name", "age") VALUES (\'John\', 30);'
 * ```
 */
declare function toSql(rows: RowData[], columns: string[], options: SqlExportOptions): string;

/**
 * Markdown Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

/**
 * Convert rows to Markdown table format
 *
 * @param rows - Array of row objects
 * @param columns - Column names to include
 * @param options - Export options
 * @returns Markdown table string
 *
 * @example
 * ```ts
 * const md = toMarkdown(
 *   [{ name: 'John', age: 30 }],
 *   ['name', 'age']
 * );
 * // | name | age |
 * // |:-----|:----|
 * // | John | 30  |
 * ```
 */
declare function toMarkdown(rows: RowData[], columns: string[], options?: MarkdownExportOptions): string;

/**
 * Import Parsing Functions
 * @dbview/core - Phase 3: Export/Import
 */

/**
 * Parse CSV content into rows
 *
 * @param content - CSV string content
 * @param options - Import options
 * @returns Parsed columns and rows
 * @throws Error if CSV is empty or malformed
 *
 * @example
 * ```ts
 * const result = parseCsv('name,age\nJohn,30\nJane,25');
 * // { columns: ['name', 'age'], rows: [{name: 'John', age: '30'}, ...], rowCount: 2 }
 * ```
 */
declare function parseCsv(content: string, options?: CsvImportOptions): ImportResult;
/**
 * Parse JSON content into rows
 *
 * @param content - JSON string content
 * @param options - Import options
 * @returns Parsed columns and rows
 * @throws Error if JSON is invalid or not an array
 *
 * @example
 * ```ts
 * const result = parseJson('[{"name": "John", "age": 30}]');
 * // { columns: ['name', 'age'], rows: [{name: 'John', age: 30}], rowCount: 1 }
 * ```
 */
declare function parseJson(content: string, options?: JsonImportOptions): ImportResult;
/**
 * Parse JSON Lines (NDJSON) content into rows
 *
 * @param content - JSON Lines string content
 * @returns Parsed columns and rows
 *
 * @example
 * ```ts
 * const result = parseJsonLines('{"name":"John"}\n{"name":"Jane"}');
 * // { columns: ['name'], rows: [{name: 'John'}, {name: 'Jane'}], rowCount: 2 }
 * ```
 */
declare function parseJsonLines(content: string): ImportResult;
/**
 * Detect format from content
 *
 * @param content - File content
 * @returns Detected format or null if unknown
 */
declare function detectFormat(content: string): 'csv' | 'json' | 'jsonlines' | null;

/**
 * SQL Utility Type Definitions
 * @dbview/core - Phase 4: SQL Utilities
 */
/**
 * Database type for SQL dialect selection
 */
type SqlDialect = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'sqlserver' | 'bigquery' | 'redshift' | 'spark' | 'trino';
/**
 * SQL formatting options
 */
interface FormatSqlOptions {
    /** Target database dialect */
    dialect?: SqlDialect;
    /** Indentation width in spaces (default: 2) */
    tabWidth?: number;
    /** Keyword case: 'upper', 'lower', 'preserve' (default: 'upper') */
    keywordCase?: 'upper' | 'lower' | 'preserve';
    /** Data type case (default: 'preserve') */
    dataTypeCase?: 'upper' | 'lower' | 'preserve';
    /** Function name case (default: 'preserve') */
    functionCase?: 'upper' | 'lower' | 'preserve';
    /** Identifier case (default: 'preserve') */
    identifierCase?: 'upper' | 'lower' | 'preserve';
    /** Use single line for simple queries (default: false) */
    useTabs?: boolean;
    /** Comma position: 'before' or 'after' (default: 'after') */
    commaPosition?: 'before' | 'after';
    /** Logical operator position (default: 'before') */
    logicalOperatorNewline?: 'before' | 'after';
    /** Max line length before wrapping (default: 80) */
    lineWidth?: number;
}
/**
 * SQL validation result
 */
interface SqlValidationResult {
    /** Whether the SQL is valid */
    valid: boolean;
    /** Error message if invalid */
    error?: string;
    /** Error position in the SQL string */
    position?: {
        line: number;
        column: number;
        offset: number;
    };
    /** Warnings (valid but potentially problematic) */
    warnings?: string[];
}
/**
 * Parsed SQL statement information
 */
interface ParsedSql {
    /** Statement type: SELECT, INSERT, UPDATE, DELETE, etc. */
    type: SqlStatementType;
    /** Tables referenced in the query */
    tables: string[];
    /** Columns referenced (if detectable) */
    columns: string[];
    /** Whether the query has a WHERE clause */
    hasWhere: boolean;
    /** Whether the query has a LIMIT clause */
    hasLimit: boolean;
    /** Whether the query has an ORDER BY clause */
    hasOrderBy: boolean;
    /** Whether the query modifies data */
    isModifying: boolean;
    /** Raw SQL string */
    sql: string;
}
/**
 * SQL statement types
 */
type SqlStatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'DROP' | 'TRUNCATE' | 'GRANT' | 'REVOKE' | 'BEGIN' | 'COMMIT' | 'ROLLBACK' | 'WITH' | 'EXPLAIN' | 'UNKNOWN';
/**
 * SQL keyword categories for highlighting
 */
interface SqlKeywords {
    statements: string[];
    clauses: string[];
    operators: string[];
    functions: string[];
    dataTypes: string[];
    literals: string[];
}

/**
 * SQL Formatting Functions
 * @dbview/core - Phase 4: SQL Utilities
 */

/**
 * Format SQL for readability
 *
 * @param sql - Raw SQL string to format
 * @param options - Formatting options
 * @returns Formatted SQL string
 *
 * @example
 * ```ts
 * const formatted = formatSql('SELECT * FROM users WHERE id = 1');
 * // SELECT
 * //   *
 * // FROM
 * //   users
 * // WHERE
 * //   id = 1
 * ```
 */
declare function formatSql(sql: string, options?: FormatSqlOptions): string;
/**
 * Minify SQL by removing extra whitespace
 *
 * @param sql - SQL string to minify
 * @returns Minified SQL string
 *
 * @example
 * ```ts
 * const minified = minifySql(`
 *   SELECT *
 *   FROM users
 *   WHERE id = 1
 * `);
 * // "SELECT * FROM users WHERE id = 1"
 * ```
 */
declare function minifySql(sql: string): string;
/**
 * Check if a string contains multiple SQL statements
 *
 * @param sql - SQL string to check
 * @returns True if multiple statements detected
 */
declare function hasMultipleStatements(sql: string): boolean;
/**
 * Split SQL into individual statements
 *
 * @param sql - SQL string containing multiple statements
 * @returns Array of individual SQL statements
 */
declare function splitStatements(sql: string): string[];

/**
 * SQL Validation Functions
 * @dbview/core - Phase 4: SQL Utilities
 */

/**
 * Validate SQL syntax (basic validation)
 *
 * @param sql - SQL string to validate
 * @returns Validation result
 *
 * @example
 * ```ts
 * const result = validateSql("SELECT * FROM users WHERE id = '1");
 * // { valid: false, error: "Unclosed string literal" }
 * ```
 */
declare function validateSql(sql: string): SqlValidationResult;
/**
 * Check if SQL is a read-only query (SELECT)
 *
 * @param sql - SQL string to check
 * @returns True if the query is read-only
 */
declare function isReadOnlyQuery(sql: string): boolean;
/**
 * Check if SQL contains potentially dangerous operations
 *
 * @param sql - SQL string to check
 * @returns Array of detected dangerous operations
 */
declare function detectDangerousOperations(sql: string): string[];

/**
 * SQL Parsing Functions
 * @dbview/core - Phase 4: SQL Utilities
 */

/**
 * SQL keywords by category
 */
declare const SQL_KEYWORDS: SqlKeywords;
/**
 * Parse SQL to extract metadata
 *
 * @param sql - SQL string to parse
 * @returns Parsed SQL information
 *
 * @example
 * ```ts
 * const parsed = parseSql('SELECT name, age FROM users WHERE id = 1');
 * // {
 * //   type: 'SELECT',
 * //   tables: ['users'],
 * //   columns: ['name', 'age'],
 * //   hasWhere: true,
 * //   ...
 * // }
 * ```
 */
declare function parseSql(sql: string): ParsedSql;
/**
 * Get SQL keywords for syntax highlighting
 */
declare function getSqlKeywords(): SqlKeywords;
/**
 * Check if a word is a SQL keyword
 */
declare function isSqlKeyword(word: string): boolean;

export { ALL_OPERATORS, BOOLEAN_OPERATORS, type CassandraFilterResult, type CsvExportOptions, type CsvImportOptions, DATE_OPERATORS, type DebouncedFunction, type DocumentDbType, type DocumentIdInfo, type ElasticsearchFilterResult, type ExportFormat, type FilterValidationResult, type FlattenOptions, type FlattenedField, type FormatBytesOptions, type FormatSqlOptions, type ImportResult, type InferredColumnType, type JsonExportOptions, type JsonImportOptions, type MarkdownExportOptions, type MongoFilterResult, NUMERIC_OPERATORS, OPERATOR_LABELS, OPERATOR_METADATA, type OperatorMetadata, type ParsedConnectionKey, type ParsedSql, type PathOptions, type PlaceholderStyle, type PrimitiveType, type RowData, SQL_KEYWORDS, STRING_OPERATORS, type SqlDialect, type SqlExportOptions, type SqlFilterOptions, type SqlFilterResult, type SqlFilterResultNamed, type SqlKeywords, type SqlStatementType, type SqlValidationResult, type TreeNode, type TreeOptions, type TruncateOptions, type ValueType, areFiltersValid, buildCassandraFilter, buildElasticsearchFilter, buildElasticsearchSearchBody, buildMongoFilter, buildMongoMatchStage, buildPath, buildSqlFilter, buildSqlFilterNamed, buildWhereClause, collapseAll, collapsePath, countDocumentFields, createFilter, debounce, deleteAtPath, detectDangerousOperations, detectFormat, detectValueType, expandAll, expandPath, flattenDocument, formatBytes, formatBytesPerSecond, formatSql, formatValueForDisplay, generateHash, generateId, generateSequentialId, generateSlug, generateTimestampId, generateUUID, getAtPath, getCompositeDocumentId, getConnectionDisplayName, getConnectionKey, getDbTypeFromKey, getDocumentDepth, getDocumentId, getDocumentIdField, getDocumentIdFields, getDocumentKeys, getExpandedPathsToDepth, getFilterErrors, getOperatorMetadata, getOperatorsForType, getParentPath, getPathKey, getPathsToShowSearchResults, getPrimaryKeyObject, getSqlKeywords, getTypeColor, getTypeLabel, hasMultipleStatements, hasPath, inferColumnType, isContainer, isDocumentDbType, isFilterEmpty, isOperatorValidForType, isPrimitive, isReadOnlyQuery, isSameConnection, isSqlKeyword, joinPath, minifySql, needsAllowFiltering, nestToTree, normalizeFilter, once, operatorNeedsCommaSeparated, operatorNeedsTwoValues, operatorNeedsValue, parseBytes, parseConnectionKey, parseCsv, parseJson, parseJsonLines, parsePath, parseSql, removeEmptyFilters, resetSequentialCounter, searchTree, setAtPath, splitStatements, throttle, toCsv, toJson, toJsonLines, toMarkdown, toSql, togglePath, truncateArray, truncateJson, truncatePath, truncateString, truncateValue, unflattenDocument, validateFilter, validateFilters, validateSql };
