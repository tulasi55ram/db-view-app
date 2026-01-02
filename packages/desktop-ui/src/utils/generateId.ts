/**
 * Generate unique IDs for components and filters
 * Uses a combination of timestamp, counter, and random string to ensure uniqueness
 * even when called multiple times in the same millisecond
 */

let lastTimestamp = 0;
let counter = 0;

/**
 * Generate a unique ID suitable for use as filter IDs, element keys, etc.
 * Format: "id-{timestamp}-{counter}-{random}"
 *
 * The counter resets when timestamp changes, ensuring uniqueness within
 * the same millisecond while avoiding unbounded counter growth.
 *
 * @param prefix Optional prefix for the ID (default: 'id')
 * @returns A unique string ID
 */
export function generateUniqueId(prefix = 'id'): string {
  const now = Date.now();
  if (now === lastTimestamp) {
    counter++;
  } else {
    lastTimestamp = now;
    counter = 0;
  }
  const timestamp = now.toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${counter}-${random}`;
}

/**
 * Generate a shorter unique ID for when space is a concern
 * Format: "{random}{random}"
 *
 * @returns A shorter unique string ID (12 characters)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

/**
 * Escape special characters in a string for use in localStorage keys
 * This prevents key collisions when schema/table names contain special characters
 *
 * @param str The string to escape
 * @returns Escaped string safe for use in localStorage keys
 */
export function escapeStorageKey(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, (char) => `_${char.charCodeAt(0).toString(16)}_`);
}
