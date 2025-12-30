/**
 * CSV Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

import type { CsvExportOptions, RowData } from './types.js';

/**
 * Default CSV export options
 */
const DEFAULT_OPTIONS: Required<CsvExportOptions> = {
  includeHeaders: true,
  delimiter: ',',
  lineEnding: '\n',
  nullValue: '',
};

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
export function toCsv(
  rows: RowData[],
  columns: string[],
  options: CsvExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // Add header row
  if (opts.includeHeaders) {
    lines.push(
      columns
        .map((col) => escapeField(col, opts.delimiter))
        .join(opts.delimiter)
    );
  }

  // Add data rows
  for (const row of rows) {
    const values = columns.map((col) => {
      const value = row[col];
      const formatted = formatValue(value, opts.nullValue);
      return escapeField(formatted, opts.delimiter);
    });
    lines.push(values.join(opts.delimiter));
  }

  return lines.join(opts.lineEnding);
}

/**
 * Escape a CSV field value
 * Wraps in quotes and escapes internal quotes if necessary
 */
function escapeField(value: string, delimiter: string): string {
  // Check if escaping is needed
  const needsEscaping =
    value.includes(delimiter) ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes('"');

  if (needsEscaping) {
    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Format a value for CSV output
 */
function formatValue(value: unknown, nullValue: string): string {
  if (value === null || value === undefined) {
    return nullValue;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
