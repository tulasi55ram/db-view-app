/**
 * Utils module
 *
 * Provides general utility functions:
 * - Byte formatting
 * - Value truncation
 * - ID generation
 * - Connection key utilities
 * - Debounce/throttle
 */

// Byte formatting
export {
  formatBytes,
  parseBytes,
  formatBytesPerSecond,
  type FormatBytesOptions,
} from './formatBytes.js';

// Value truncation
export {
  truncateString,
  truncateValue,
  truncateJson,
  truncateArray,
  truncatePath,
  type TruncateOptions,
} from './truncateValue.js';

// ID generation
export {
  generateId,
  generateUUID,
  generateSequentialId,
  generateTimestampId,
  generateHash,
  generateSlug,
  resetSequentialCounter,
} from './generateId.js';

// Connection key utilities
export {
  getConnectionKey,
  parseConnectionKey,
  getConnectionDisplayName,
  isSameConnection,
  getDbTypeFromKey,
  type ParsedConnectionKey,
} from './connectionKey.js';

// Debounce/throttle
export {
  debounce,
  throttle,
  once,
  type DebouncedFunction,
} from './debounce.js';
