/**
 * Path utilities for document manipulation
 *
 * Provides functions for getting, setting, and deleting values
 * at dot-notation paths in nested objects. All mutating operations
 * are immutable (return new objects).
 */

import type { PathOptions } from './types.js';

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
export function parsePath(path: string): string[] {
  if (!path) return [];

  // Handle bracket notation: convert items[0] to items.0
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');

  // Split by dots, filtering empty segments
  return normalized.split('.').filter((segment) => segment !== '');
}

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
export function buildPath(segments: string[], options: PathOptions = {}): string {
  const { arrayNotation = 'dot' } = options;

  if (segments.length === 0) return '';

  if (arrayNotation === 'bracket') {
    return segments.reduce((path, segment, index) => {
      if (index === 0) return segment;
      // Check if segment is a number (array index)
      if (/^\d+$/.test(segment)) {
        return `${path}[${segment}]`;
      }
      return `${path}.${segment}`;
    }, '');
  }

  return segments.join('.');
}

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
export function getAtPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const segments = parsePath(path);

  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

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
export function hasPath(
  obj: Record<string, unknown>,
  path: string
): boolean {
  const segments = parsePath(path);

  let current: unknown = obj;

  for (let i = 0; i < segments.length; i++) {
    if (current === null || current === undefined) {
      return false;
    }

    if (typeof current !== 'object') {
      return false;
    }

    const segment = segments[i];

    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

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
export function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const segments = parsePath(path);

  if (segments.length === 0) {
    return obj;
  }

  return setAtPathRecursive(obj, segments, 0, value);
}

/**
 * Recursive helper for setAtPath
 */
function setAtPathRecursive(
  obj: Record<string, unknown> | unknown[],
  segments: string[],
  index: number,
  value: unknown
): Record<string, unknown> {
  const segment = segments[index];
  const isArray = Array.isArray(obj);
  const isNumericSegment = /^\d+$/.test(segment);

  // Create a shallow copy
  const copy: Record<string, unknown> | unknown[] = isArray
    ? [...obj]
    : { ...obj };

  if (index === segments.length - 1) {
    // Last segment - set the value
    if (isArray && isNumericSegment) {
      (copy as unknown[])[parseInt(segment, 10)] = value;
    } else {
      (copy as Record<string, unknown>)[segment] = value;
    }
    return copy as Record<string, unknown>;
  }

  // Get or create the next level
  const currentValue = isArray && isNumericSegment
    ? (copy as unknown[])[parseInt(segment, 10)]
    : (copy as Record<string, unknown>)[segment];

  const nextSegment = segments[index + 1];
  const nextIsNumeric = /^\d+$/.test(nextSegment);

  let nextObj: Record<string, unknown> | unknown[];

  if (currentValue === null || currentValue === undefined) {
    // Create intermediate object or array
    nextObj = nextIsNumeric ? [] : {};
  } else if (typeof currentValue === 'object') {
    nextObj = currentValue as Record<string, unknown> | unknown[];
  } else {
    // Overwrite non-object value
    nextObj = nextIsNumeric ? [] : {};
  }

  const newValue = setAtPathRecursive(nextObj, segments, index + 1, value);

  if (isArray && isNumericSegment) {
    (copy as unknown[])[parseInt(segment, 10)] = newValue;
  } else {
    (copy as Record<string, unknown>)[segment] = newValue;
  }

  return copy as Record<string, unknown>;
}

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
export function deleteAtPath(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  const segments = parsePath(path);

  if (segments.length === 0) {
    return obj;
  }

  return deleteAtPathRecursive(obj, segments, 0);
}

/**
 * Recursive helper for deleteAtPath
 */
function deleteAtPathRecursive(
  obj: Record<string, unknown> | unknown[],
  segments: string[],
  index: number
): Record<string, unknown> {
  const segment = segments[index];
  const isArray = Array.isArray(obj);
  const isNumericSegment = /^\d+$/.test(segment);

  // Create a shallow copy
  const copy: Record<string, unknown> | unknown[] = isArray
    ? [...obj]
    : { ...obj };

  if (index === segments.length - 1) {
    // Last segment - delete the key
    if (isArray && isNumericSegment) {
      (copy as unknown[]).splice(parseInt(segment, 10), 1);
    } else {
      delete (copy as Record<string, unknown>)[segment];
    }
    return copy as Record<string, unknown>;
  }

  // Get the next level
  const currentValue = isArray && isNumericSegment
    ? (copy as unknown[])[parseInt(segment, 10)]
    : (copy as Record<string, unknown>)[segment];

  if (currentValue === null || currentValue === undefined || typeof currentValue !== 'object') {
    // Path doesn't exist, return unchanged
    return copy as Record<string, unknown>;
  }

  const newValue = deleteAtPathRecursive(
    currentValue as Record<string, unknown>,
    segments,
    index + 1
  );

  if (isArray && isNumericSegment) {
    (copy as unknown[])[parseInt(segment, 10)] = newValue;
  } else {
    (copy as Record<string, unknown>)[segment] = newValue;
  }

  return copy as Record<string, unknown>;
}

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
export function getParentPath(path: string): string {
  const segments = parsePath(path);
  if (segments.length <= 1) return '';
  return buildPath(segments.slice(0, -1));
}

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
export function getPathKey(path: string): string {
  const segments = parsePath(path);
  return segments[segments.length - 1] || '';
}

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
export function joinPath(...parts: (string | number)[]): string {
  return parts
    .map(String)
    .filter((p) => p !== '')
    .join('.');
}
