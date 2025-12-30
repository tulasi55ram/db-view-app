/**
 * Type inference utilities
 *
 * Provides functions for detecting and inferring data types
 * from values and columns.
 */

import type { ValueType, InferredColumnType } from './types.js';

/**
 * Date string patterns for detection
 */
const DATE_PATTERNS = [
  // ISO 8601
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})?)?$/,
  // Common date formats
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/,
  /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/,
];

/**
 * MongoDB ObjectId pattern
 */
const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

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
export function detectValueType(value: unknown): ValueType {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  const type = typeof value;

  switch (type) {
    case 'string':
      return detectStringType(value as string);
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return detectObjectType(value as object);
    default:
      return 'unknown';
  }
}

/**
 * Detects the specific type of a string value.
 */
function detectStringType(value: string): ValueType {
  // Check for ObjectId pattern
  if (OBJECT_ID_PATTERN.test(value)) {
    return 'objectId';
  }

  // Check for date patterns
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(value)) {
      // Verify it's a valid date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return 'date';
      }
    }
  }

  return 'string';
}

/**
 * Detects the specific type of an object value.
 */
function detectObjectType(value: object): ValueType {
  // Check for null (typeof null === 'object')
  if (value === null) {
    return 'null';
  }

  // Check for arrays
  if (Array.isArray(value)) {
    return 'array';
  }

  // Check for Date
  if (value instanceof Date) {
    return 'date';
  }

  // Check for Buffer/Binary
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return 'binary';
  }

  // Check for MongoDB ObjectId-like objects
  if ('$oid' in value || ('_bsontype' in value && (value as Record<string, unknown>)._bsontype === 'ObjectId')) {
    return 'objectId';
  }

  // Check for MongoDB date objects
  if ('$date' in value) {
    return 'date';
  }

  return 'object';
}

/**
 * Gets a human-readable label for a value type.
 *
 * @param type - The value type
 * @returns Human-readable label
 */
export function getTypeLabel(type: ValueType): string {
  const labels: Record<ValueType, string> = {
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    null: 'Null',
    undefined: 'Undefined',
    object: 'Object',
    array: 'Array',
    date: 'Date',
    objectId: 'ObjectId',
    binary: 'Binary',
    unknown: 'Unknown',
  };

  return labels[type] || 'Unknown';
}

/**
 * Gets a color for a value type (for UI display).
 *
 * @param type - The value type
 * @returns CSS color value
 */
export function getTypeColor(type: ValueType): string {
  const colors: Record<ValueType, string> = {
    string: '#ce9178', // Orange/brown
    number: '#b5cea8', // Light green
    boolean: '#569cd6', // Blue
    null: '#808080', // Gray
    undefined: '#808080', // Gray
    object: '#dcdcaa', // Yellow
    array: '#c586c0', // Purple
    date: '#4ec9b0', // Teal
    objectId: '#9cdcfe', // Light blue
    binary: '#d7ba7d', // Gold
    unknown: '#808080', // Gray
  };

  return colors[type] || '#808080';
}

/**
 * Checks if a value is a primitive type.
 *
 * @param value - The value to check
 * @returns True if the value is a primitive
 */
export function isPrimitive(value: unknown): boolean {
  const type = detectValueType(value);
  return ['string', 'number', 'boolean', 'null', 'undefined', 'date', 'objectId'].includes(type);
}

/**
 * Checks if a value is a container type (object or array).
 *
 * @param value - The value to check
 * @returns True if the value is a container
 */
export function isContainer(value: unknown): boolean {
  const type = detectValueType(value);
  return type === 'object' || type === 'array';
}

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
export function inferColumnType(
  values: unknown[],
  maxSamples = 100
): InferredColumnType {
  const seenTypes = new Set<ValueType>();
  const typeCounts = new Map<ValueType, number>();
  const sampleValues: unknown[] = [];
  let hasNulls = false;
  let dateCount = 0;
  let jsonCount = 0;

  const samplesToCheck = values.slice(0, maxSamples);

  for (const value of samplesToCheck) {
    const type = detectValueType(value);
    seenTypes.add(type);
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);

    if (type === 'null' || type === 'undefined') {
      hasNulls = true;
    } else if (sampleValues.length < 5) {
      sampleValues.push(value);
    }

    // Check for date-like strings or date values
    if (type === 'date') {
      dateCount++;
    } else if (type === 'string') {
      const strValue = value as string;
      if (isDateLikeString(strValue)) {
        dateCount++;
      }
      if (isJsonLikeString(strValue)) {
        jsonCount++;
      }
    }
  }

  // Determine primary type (most common non-null type)
  let primaryType: ValueType = 'unknown';
  let maxCount = 0;

  for (const [type, count] of typeCounts) {
    if (type !== 'null' && type !== 'undefined' && count > maxCount) {
      maxCount = count;
      primaryType = type;
    }
  }

  // If all values are null, primary type is null
  if (primaryType === 'unknown' && hasNulls) {
    primaryType = 'null';
  }

  const nonNullCount = samplesToCheck.length - (typeCounts.get('null') || 0) - (typeCounts.get('undefined') || 0);
  const isLikelyDate = dateCount > nonNullCount * 0.8;
  const isLikelyJson = jsonCount > nonNullCount * 0.8;

  return {
    primaryType,
    seenTypes,
    hasNulls,
    sampleValues,
    isLikelyDate,
    isLikelyJson,
  };
}

/**
 * Checks if a string looks like a date.
 */
function isDateLikeString(value: string): boolean {
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a string looks like JSON.
 */
function isJsonLikeString(value: string): boolean {
  const trimmed = value.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Formats a value for display based on its type.
 *
 * @param value - The value to format
 * @param maxLength - Maximum string length before truncation
 * @returns Formatted string representation
 */
export function formatValueForDisplay(
  value: unknown,
  maxLength = 100
): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = detectValueType(value);

  switch (type) {
    case 'string':
      const str = value as string;
      if (str.length > maxLength) {
        return `"${str.substring(0, maxLength)}..."`;
      }
      return `"${str}"`;

    case 'number':
    case 'boolean':
      return String(value);

    case 'date':
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case 'objectId':
      if (typeof value === 'object' && value !== null && '$oid' in value) {
        return `ObjectId("${(value as { $oid: string }).$oid}")`;
      }
      return String(value);

    case 'array':
      const arr = value as unknown[];
      return `Array(${arr.length})`;

    case 'object':
      const keys = Object.keys(value as object);
      return `Object(${keys.length} keys)`;

    case 'binary':
      return '[Binary Data]';

    default:
      return String(value);
  }
}
