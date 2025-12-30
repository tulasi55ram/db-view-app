/**
 * JSON Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

import type { JsonExportOptions, RowData } from './types.js';

/**
 * Default JSON export options
 */
const DEFAULT_OPTIONS: Required<JsonExportOptions> = {
  pretty: true,
  indent: 2,
  columns: [],
};

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
export function toJson(
  rows: RowData[],
  options: JsonExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter columns if specified
  let data = rows;
  if (opts.columns && opts.columns.length > 0) {
    data = rows.map((row) => {
      const filtered: RowData = {};
      for (const col of opts.columns!) {
        if (col in row) {
          filtered[col] = row[col];
        }
      }
      return filtered;
    });
  }

  // Convert to JSON string
  if (opts.pretty) {
    return JSON.stringify(data, null, opts.indent);
  }

  return JSON.stringify(data);
}

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
export function toJsonLines(
  rows: RowData[],
  options: Pick<JsonExportOptions, 'columns'> = {}
): string {
  const lines: string[] = [];

  for (const row of rows) {
    let data = row;

    // Filter columns if specified
    if (options.columns && options.columns.length > 0) {
      data = {};
      for (const col of options.columns) {
        if (col in row) {
          data[col] = row[col];
        }
      }
    }

    lines.push(JSON.stringify(data));
  }

  return lines.join('\n');
}
