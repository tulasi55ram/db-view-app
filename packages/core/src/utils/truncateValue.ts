/**
 * Value truncation utilities
 *
 * Provides functions for truncating values for display purposes.
 */

/**
 * Options for truncating strings
 */
export interface TruncateOptions {
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
export function truncateString(
  value: string,
  options?: TruncateOptions
): string {
  const {
    maxLength = 100,
    ellipsis = '...',
    wordBoundary = false,
    position = 'end',
  } = options || {};

  if (value.length <= maxLength) {
    return value;
  }

  const ellipsisLength = ellipsis.length;
  const availableLength = maxLength - ellipsisLength;

  if (availableLength <= 0) {
    return ellipsis.substring(0, maxLength);
  }

  switch (position) {
    case 'start':
      return ellipsis + value.substring(value.length - availableLength);

    case 'middle': {
      const halfLength = Math.floor(availableLength / 2);
      const startPart = value.substring(0, halfLength);
      const endPart = value.substring(value.length - (availableLength - halfLength));
      return startPart + ellipsis + endPart;
    }

    case 'end':
    default: {
      let truncated = value.substring(0, availableLength);

      if (wordBoundary) {
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > availableLength * 0.5) {
          truncated = truncated.substring(0, lastSpace);
        }
      }

      return truncated + ellipsis;
    }
  }
}

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
export function truncateValue(value: unknown, maxLength = 100): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return truncateString(value, { maxLength });
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const itemWord = value.length === 1 ? 'item' : 'items';
    return `[${value.length} ${itemWord}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const keyWord = keys.length === 1 ? 'key' : 'keys';
    return `{${keys.length} ${keyWord}}`;
  }

  // Fallback for other types
  const str = String(value);
  return truncateString(str, { maxLength });
}

/**
 * Truncates a JSON string with pretty formatting.
 *
 * @param json - JSON string or object
 * @param maxLength - Maximum length
 * @returns Truncated JSON string
 */
export function truncateJson(json: string | object, maxLength = 500): string {
  const str = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
  return truncateString(str, { maxLength });
}

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
export function truncateArray(
  values: unknown[],
  maxItems = 5,
  maxValueLength = 50
): string {
  if (values.length === 0) {
    return '[]';
  }

  const displayed = values.slice(0, maxItems);
  const remaining = values.length - maxItems;

  const formatted = displayed.map((v) => {
    if (typeof v === 'string') {
      const truncated = truncateString(v, { maxLength: maxValueLength });
      return `"${truncated}"`;
    }
    return truncateValue(v, maxValueLength);
  });

  const result = formatted.join(', ');

  if (remaining > 0) {
    return `${result} +${remaining} more`;
  }

  return result;
}

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
export function truncatePath(path: string, maxLength = 50): string {
  if (path.length <= maxLength) {
    return path;
  }

  const separator = path.includes('/') ? '/' : '\\';
  const parts = path.split(separator);
  const filename = parts[parts.length - 1];

  if (filename.length >= maxLength - 3) {
    return truncateString(filename, { maxLength });
  }

  let result = filename;
  let i = parts.length - 2;

  while (i >= 0) {
    const newResult = parts[i] + separator + result;
    if (newResult.length + 3 > maxLength) {
      break;
    }
    result = newResult;
    i--;
  }

  if (i >= 0) {
    return '...' + separator + result;
  }

  return result;
}
