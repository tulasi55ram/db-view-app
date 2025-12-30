/**
 * ID generation utilities
 *
 * Provides functions for generating unique identifiers.
 */

/**
 * Characters used for generating IDs
 */
const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Counter for sequential IDs
 */
let sequentialCounter = 0;

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
export function generateId(length = 8): string {
  let result = '';

  // Use crypto.getRandomValues if available (browser/Node.js)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      result += ALPHANUMERIC[array[i] % ALPHANUMERIC.length];
    }
  } else {
    // Fallback to Math.random
    for (let i = 0; i < length; i++) {
      result += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
    }
  }

  return result;
}

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
export function generateUUID(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
export function generateSequentialId(prefix = 'id'): string {
  sequentialCounter++;
  return `${prefix}_${sequentialCounter}`;
}

/**
 * Resets the sequential counter (for testing).
 */
export function resetSequentialCounter(): void {
  sequentialCounter = 0;
}

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
export function generateTimestampId(prefix?: string): string {
  const timestamp = Date.now();
  const suffix = generateId(4);
  const id = `${timestamp}_${suffix}`;

  return prefix ? `${prefix}_${id}` : id;
}

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
export function generateHash(input: string, length = 8): string {
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive number and then to base-62
  const positive = Math.abs(hash);
  let result = '';
  let num = positive;

  while (result.length < length) {
    result = ALPHANUMERIC[num % ALPHANUMERIC.length] + result;
    num = Math.floor(num / ALPHANUMERIC.length);

    // If we've exhausted the number, use the position
    if (num === 0 && result.length < length) {
      num = positive + result.length;
    }
  }

  return result.substring(0, length);
}

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
export function generateSlug(input: string, maxLength = 50): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single
    .replace(/^-|-$/g, '') // Remove leading/trailing dashes
    .substring(0, maxLength);
}
