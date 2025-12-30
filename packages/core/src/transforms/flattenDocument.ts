/**
 * Document flattening utilities
 *
 * Converts nested documents into flat structures with dot-notation paths,
 * useful for table view display of JSON documents.
 */

import type { FlattenedField, FlattenOptions } from './types.js';
import { detectValueType } from './inferTypes.js';

/**
 * Default options for flattening
 */
const DEFAULT_FLATTEN_OPTIONS: Required<FlattenOptions> = {
  maxDepth: Infinity,
  arrayNotation: 'dot',
  includeContainers: false,
  excludePaths: [],
  sortKeys: false,
};

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
export function flattenDocument(
  document: Record<string, unknown>,
  options?: FlattenOptions
): FlattenedField[] {
  const opts = { ...DEFAULT_FLATTEN_OPTIONS, ...options };
  const fields: FlattenedField[] = [];
  const excludeSet = new Set(opts.excludePaths);

  flattenRecursive(document, '', 0, fields, opts, excludeSet, false);

  if (opts.sortKeys) {
    fields.sort((a, b) => a.path.localeCompare(b.path));
  }

  return fields;
}

/**
 * Recursive helper for flattening documents.
 */
function flattenRecursive(
  value: unknown,
  path: string,
  depth: number,
  fields: FlattenedField[],
  options: Required<FlattenOptions>,
  excludeSet: Set<string>,
  isArrayElement: boolean,
  arrayIndex?: number
): void {
  // Check if path is excluded
  if (excludeSet.has(path)) {
    return;
  }

  // Check max depth
  if (depth > options.maxDepth) {
    return;
  }

  const type = detectValueType(value);

  // Handle arrays
  if (type === 'array') {
    const arr = value as unknown[];

    if (options.includeContainers && path) {
      fields.push({
        path,
        value: arr,
        type: 'array',
        depth,
        isArrayElement,
        arrayIndex,
      });
    }

    arr.forEach((item, index) => {
      const itemPath = path
        ? options.arrayNotation === 'bracket'
          ? `${path}[${index}]`
          : `${path}.${index}`
        : String(index);

      flattenRecursive(
        item,
        itemPath,
        depth + 1,
        fields,
        options,
        excludeSet,
        true,
        index
      );
    });

    return;
  }

  // Handle objects
  if (type === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (options.sortKeys) {
      keys.sort();
    }

    if (options.includeContainers && path) {
      fields.push({
        path,
        value: obj,
        type: 'object',
        depth,
        isArrayElement,
        arrayIndex,
      });
    }

    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      flattenRecursive(
        obj[key],
        childPath,
        depth + 1,
        fields,
        options,
        excludeSet,
        false
      );
    }

    return;
  }

  // Handle primitive values
  if (path) {
    fields.push({
      path,
      value,
      type,
      depth,
      isArrayElement,
      arrayIndex,
    });
  }
}

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
export function unflattenDocument(
  fields: FlattenedField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    setValueAtPath(result, field.path, field.value);
  }

  return result;
}

/**
 * Sets a value at a path, creating intermediate objects/arrays as needed.
 */
function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  // Handle bracket notation
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalizedPath.split('.');

  let current: Record<string, unknown> | unknown[] = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const nextIsIndex = /^\d+$/.test(nextSegment);

    if (!(segment in (current as Record<string, unknown>))) {
      (current as Record<string, unknown>)[segment] = nextIsIndex ? [] : {};
    }

    current = (current as Record<string, unknown>)[segment] as Record<string, unknown> | unknown[];
  }

  const lastSegment = segments[segments.length - 1];
  (current as Record<string, unknown>)[lastSegment] = value;
}

/**
 * Gets all unique root keys from an array of documents.
 *
 * Useful for determining columns in a table view.
 *
 * @param documents - Array of documents
 * @param maxDepth - Maximum depth to analyze (default: 1 for root keys only)
 * @returns Array of unique paths
 */
export function getDocumentKeys(
  documents: Record<string, unknown>[],
  maxDepth = 1
): string[] {
  const keys = new Set<string>();

  for (const doc of documents) {
    const flattened = flattenDocument(doc, { maxDepth, includeContainers: true });
    for (const field of flattened) {
      keys.add(field.path);
    }
  }

  return Array.from(keys).sort();
}

/**
 * Counts the number of fields in a document (including nested).
 *
 * @param document - The document to count fields for
 * @returns Total number of fields
 */
export function countDocumentFields(document: Record<string, unknown>): number {
  const flattened = flattenDocument(document);
  return flattened.length;
}

/**
 * Gets the maximum depth of a document.
 *
 * @param document - The document to analyze
 * @returns Maximum nesting depth
 */
export function getDocumentDepth(document: Record<string, unknown>): number {
  const flattened = flattenDocument(document);
  return Math.max(0, ...flattened.map((f) => f.depth));
}
