/**
 * Export Formatters - Re-exports from @dbview/core
 * @deprecated Import directly from '@dbview/core' instead
 */

import { toCsv, toJson, toSql } from '@dbview/core';

export function formatAsCSV(
  rows: Record<string, unknown>[],
  columns: string[],
  includeHeaders: boolean = true
): string {
  return toCsv(rows, columns, { includeHeaders });
}

export function formatAsJSON(
  rows: Record<string, unknown>[],
  columns: string[]
): string {
  return toJson(rows);
}

export function formatAsSQL(
  rows: Record<string, unknown>[],
  columns: string[],
  schema: string,
  table: string
): string {
  return toSql(rows, columns, { schema, table, dbType: 'postgres' });
}
