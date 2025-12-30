/**
 * Import Parsing Functions
 * @dbview/core - Phase 3: Export/Import
 */

import type {
  CsvImportOptions,
  JsonImportOptions,
  ImportResult,
  RowData,
} from './types.js';

/**
 * Default CSV import options
 */
const DEFAULT_CSV_OPTIONS: Required<CsvImportOptions> = {
  hasHeaders: true,
  delimiter: ',',
  skipEmptyLines: true,
  trimValues: true,
};

/**
 * Default JSON import options
 */
const DEFAULT_JSON_OPTIONS: Required<JsonImportOptions> = {
  dataPath: '',
};

/**
 * Parse CSV content into rows
 *
 * @param content - CSV string content
 * @param options - Import options
 * @returns Parsed columns and rows
 * @throws Error if CSV is empty or malformed
 *
 * @example
 * ```ts
 * const result = parseCsv('name,age\nJohn,30\nJane,25');
 * // { columns: ['name', 'age'], rows: [{name: 'John', age: '30'}, ...], rowCount: 2 }
 * ```
 */
export function parseCsv(
  content: string,
  options: CsvImportOptions = {}
): ImportResult {
  const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
  const warnings: string[] = [];

  // Split into lines
  let lines = content.split(/\r?\n/);

  // Filter empty lines if requested
  if (opts.skipEmptyLines) {
    lines = lines.filter((line) => line.trim().length > 0);
  }

  if (lines.length === 0) {
    throw new Error('Empty CSV content');
  }

  // Parse first line to determine columns
  const firstLine = parseCSVLine(lines[0], opts.delimiter);

  // Determine columns
  let columns: string[];
  let dataStartIndex: number;

  if (opts.hasHeaders) {
    columns = firstLine.map((col, i) => {
      const trimmed = opts.trimValues ? col.trim() : col;
      if (!trimmed) {
        warnings.push(`Empty column header at position ${i + 1}, using "column_${i + 1}"`);
        return `column_${i + 1}`;
      }
      return trimmed;
    });
    dataStartIndex = 1;
  } else {
    columns = firstLine.map((_, i) => `column_${i + 1}`);
    dataStartIndex = 0;
  }

  // Check for duplicate columns
  const seen = new Set<string>();
  columns = columns.map((col, i) => {
    if (seen.has(col)) {
      const newName = `${col}_${i + 1}`;
      warnings.push(`Duplicate column name "${col}" renamed to "${newName}"`);
      seen.add(newName);
      return newName;
    }
    seen.add(col);
    return col;
  });

  // Parse data rows
  const rows: RowData[] = [];
  const expectedColumns = columns.length;

  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], opts.delimiter);

    // Warn about column count mismatch
    if (values.length !== expectedColumns) {
      warnings.push(
        `Row ${i + 1} has ${values.length} columns, expected ${expectedColumns}`
      );
    }

    const row: RowData = {};
    columns.forEach((col, idx) => {
      let value: unknown = values[idx];

      if (opts.trimValues && typeof value === 'string') {
        value = value.trim();
      }

      // Convert empty strings to null
      if (value === '' || value === undefined) {
        value = null;
      }

      row[col] = value;
    });

    rows.push(row);
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget last field
  result.push(current);

  return result;
}

/**
 * Parse JSON content into rows
 *
 * @param content - JSON string content
 * @param options - Import options
 * @returns Parsed columns and rows
 * @throws Error if JSON is invalid or not an array
 *
 * @example
 * ```ts
 * const result = parseJson('[{"name": "John", "age": 30}]');
 * // { columns: ['name', 'age'], rows: [{name: 'John', age: 30}], rowCount: 1 }
 * ```
 */
export function parseJson(
  content: string,
  options: JsonImportOptions = {}
): ImportResult {
  const opts = { ...DEFAULT_JSON_OPTIONS, ...options };
  const warnings: string[] = [];

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }

  // Navigate to data path if specified
  if (opts.dataPath) {
    const pathParts = opts.dataPath.split('.');
    for (const part of pathParts) {
      if (parsed && typeof parsed === 'object' && part in (parsed as object)) {
        parsed = (parsed as Record<string, unknown>)[part];
      } else {
        throw new Error(`Data path "${opts.dataPath}" not found in JSON`);
      }
    }
  }

  // Validate array
  if (!Array.isArray(parsed)) {
    throw new Error('JSON data must be an array of objects');
  }

  if (parsed.length === 0) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      warnings: ['Empty JSON array'],
    };
  }

  // Extract columns from all objects (not just first)
  const columnSet = new Set<string>();
  for (const item of parsed) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item as object).forEach((key) => columnSet.add(key));
    }
  }

  const columns = Array.from(columnSet);

  if (columns.length === 0) {
    throw new Error('No valid objects found in JSON array');
  }

  // Validate and normalize rows
  const rows: RowData[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];

    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`Item at index ${i} is not an object, skipping`);
      continue;
    }

    rows.push(item as RowData);
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Parse JSON Lines (NDJSON) content into rows
 *
 * @param content - JSON Lines string content
 * @returns Parsed columns and rows
 *
 * @example
 * ```ts
 * const result = parseJsonLines('{"name":"John"}\n{"name":"Jane"}');
 * // { columns: ['name'], rows: [{name: 'John'}, {name: 'Jane'}], rowCount: 2 }
 * ```
 */
export function parseJsonLines(content: string): ImportResult {
  const warnings: string[] = [];
  const rows: RowData[] = [];
  const columnSet = new Set<string>();

  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error('Empty JSON Lines content');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const parsed = JSON.parse(line);

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        warnings.push(`Line ${i + 1} is not an object, skipping`);
        continue;
      }

      Object.keys(parsed).forEach((key) => columnSet.add(key));
      rows.push(parsed);
    } catch (e) {
      warnings.push(`Line ${i + 1} has invalid JSON: ${(e as Error).message}`);
    }
  }

  return {
    columns: Array.from(columnSet),
    rows,
    rowCount: rows.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Detect format from content
 *
 * @param content - File content
 * @returns Detected format or null if unknown
 */
export function detectFormat(content: string): 'csv' | 'json' | 'jsonlines' | null {
  const trimmed = content.trim();

  // Check for JSON array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return 'json';
  }

  // Check for JSON object (might be NDJSON)
  if (trimmed.startsWith('{')) {
    // Check if multiple lines with JSON objects
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1 && lines.every((l) => l.trim().startsWith('{'))) {
      return 'jsonlines';
    }
    return 'json'; // Single object, treat as JSON
  }

  // Assume CSV for anything else with multiple lines or commas
  if (trimmed.includes('\n') || trimmed.includes(',')) {
    return 'csv';
  }

  return null;
}
