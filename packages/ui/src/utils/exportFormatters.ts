/**
 * Export Formatters - Convenience wrappers around @dbview/core functions
 * These provide simplified APIs with sensible defaults for the VS Code UI.
 */
import { toCsv, toJson, toSql } from '@dbview/core';
import type { DatabaseType } from '@dbview/types';

/** SQL database types supported by toSql */
type SqlExportDbType = 'postgres' | 'mysql' | 'sqlite' | 'sqlserver';

/**
 * Map a DatabaseType to a SQL export type.
 * MariaDB uses MySQL syntax, non-SQL databases default to postgres.
 */
function toSqlExportType(dbType: DatabaseType | undefined): SqlExportDbType {
  if (!dbType) return 'postgres';

  switch (dbType) {
    case 'postgres':
    case 'mysql':
    case 'sqlite':
    case 'sqlserver':
      return dbType;
    case 'mariadb':
      return 'mysql'; // MariaDB uses MySQL syntax
    default:
      // Non-SQL databases (mongodb, redis, etc.) - shouldn't export as SQL
      // but default to postgres if called
      return 'postgres';
  }
}

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

/**
 * Format rows as SQL INSERT statements.
 *
 * @param rows - Data rows to format
 * @param columns - Column names
 * @param schema - Schema name (empty string for MySQL/MariaDB/SQLite)
 * @param table - Table name
 * @param dbType - Database type for correct quoting and syntax (defaults to 'postgres')
 * @returns SQL INSERT statements string
 */
export function formatAsSQL(
  rows: Record<string, unknown>[],
  columns: string[],
  schema: string,
  table: string,
  dbType: DatabaseType = 'postgres'
): string {
  return toSql(rows, columns, { schema, table, dbType: toSqlExportType(dbType) });
}
