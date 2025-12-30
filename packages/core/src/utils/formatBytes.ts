/**
 * Byte formatting utilities
 *
 * Provides functions for formatting byte sizes into human-readable strings.
 */

/**
 * Options for byte formatting
 */
export interface FormatBytesOptions {
  /** Number of decimal places (default: 2) */
  decimals?: number;
  /** Use binary units (KiB, MiB) instead of SI (KB, MB) */
  binary?: boolean;
  /** Include space between number and unit */
  space?: boolean;
}

/**
 * SI units (base 1000)
 */
const SI_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

/**
 * Binary units (base 1024)
 */
const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];

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
export function formatBytes(
  bytes: number,
  options?: FormatBytesOptions
): string {
  const {
    decimals = 2,
    binary = false,
    space = true,
  } = options || {};

  if (bytes === 0) {
    return `0${space ? ' ' : ''}B`;
  }

  if (!Number.isFinite(bytes) || bytes < 0) {
    return `0${space ? ' ' : ''}B`;
  }

  const base = binary ? 1024 : 1000;
  const units = binary ? BINARY_UNITS : SI_UNITS;

  // Calculate the appropriate unit index
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );

  const value = bytes / Math.pow(base, unitIndex);
  const unit = units[unitIndex];

  // Format with appropriate decimal places
  const formatted = unitIndex === 0
    ? Math.round(value).toString()
    : value.toFixed(decimals);

  return `${formatted}${space ? ' ' : ''}${unit}`;
}

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
export function parseBytes(formatted: string): number | null {
  const match = formatted.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/);

  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (isNaN(value)) {
    return null;
  }

  // Determine base and multiplier
  let base: number;
  let unitIndex: number;

  if (unit.endsWith('IB') || unit === 'B') {
    // Binary units
    base = 1024;
    unitIndex = BINARY_UNITS.findIndex(
      (u) => u.toUpperCase() === unit || u.toUpperCase() === unit.replace('I', '')
    );
  } else {
    // SI units
    base = 1000;
    unitIndex = SI_UNITS.findIndex((u) => u.toUpperCase() === unit);
  }

  if (unitIndex === -1) {
    return null;
  }

  return Math.round(value * Math.pow(base, unitIndex));
}

/**
 * Formats bytes per second as a transfer rate.
 *
 * @param bytesPerSecond - Bytes per second
 * @param options - Formatting options
 * @returns Formatted string (e.g., "1.5 MB/s")
 */
export function formatBytesPerSecond(
  bytesPerSecond: number,
  options?: FormatBytesOptions
): string {
  return `${formatBytes(bytesPerSecond, options)}/s`;
}
