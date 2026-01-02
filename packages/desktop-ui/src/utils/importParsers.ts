/**
 * Import Parsers - Convenience wrappers around @dbview/core functions
 * These provide simplified APIs with sensible defaults for the Desktop UI.
 */
import { parseCsv, parseJson } from '@dbview/core';

export function parseCSV(
  content: string,
  hasHeaders: boolean = true
): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const result = parseCsv(content, { hasHeaders });
  return { columns: result.columns, rows: result.rows };
}

export function parseJSON(content: string): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const result = parseJson(content);
  return { columns: result.columns, rows: result.rows };
}
