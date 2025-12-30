/**
 * SQL Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

import type { SqlExportOptions, RowData } from './types.js';

/**
 * Default SQL export options
 */
const DEFAULT_OPTIONS: Omit<Required<SqlExportOptions>, 'table'> = {
  dbType: 'postgres',
  schema: '',
  includeColumns: true,
  batchSize: 1,
};

/**
 * Convert rows to SQL INSERT statements
 *
 * @param rows - Array of row objects
 * @param columns - Column names to include
 * @param options - Export options (table is required)
 * @returns SQL INSERT statements string
 *
 * @example
 * ```ts
 * const sql = toSql(
 *   [{ name: 'John', age: 30 }],
 *   ['name', 'age'],
 *   { table: 'users' }
 * );
 * // 'INSERT INTO "users" ("name", "age") VALUES (\'John\', 30);'
 * ```
 */
export function toSql(
  rows: RowData[],
  columns: string[],
  options: SqlExportOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const statements: string[] = [];

  // Get quoting functions for the database type
  const quoteId = getIdentifierQuoter(opts.dbType);
  const quoteVal = getValueQuoter(opts.dbType);

  // Build table reference
  const tableRef = opts.schema
    ? `${quoteId(opts.schema)}.${quoteId(opts.table)}`
    : quoteId(opts.table);

  // Build column list
  const columnList = opts.includeColumns
    ? ` (${columns.map(quoteId).join(', ')})`
    : '';

  // Generate INSERT statements
  if (opts.batchSize > 1) {
    // Batch multiple rows per INSERT
    for (let i = 0; i < rows.length; i += opts.batchSize) {
      const batch = rows.slice(i, i + opts.batchSize);
      const valuesList = batch
        .map((row) => {
          const values = columns.map((col) => quoteVal(row[col]));
          return `(${values.join(', ')})`;
        })
        .join(',\n  ');

      statements.push(`INSERT INTO ${tableRef}${columnList} VALUES\n  ${valuesList};`);
    }
  } else {
    // One row per INSERT
    for (const row of rows) {
      const values = columns.map((col) => quoteVal(row[col]));
      statements.push(
        `INSERT INTO ${tableRef}${columnList} VALUES (${values.join(', ')});`
      );
    }
  }

  return statements.join('\n');
}

/**
 * Get identifier quoting function for database type
 */
function getIdentifierQuoter(dbType: SqlExportOptions['dbType']): (id: string) => string {
  switch (dbType) {
    case 'mysql':
      return (id: string) => `\`${id.replace(/`/g, '``')}\``;
    case 'sqlserver':
      return (id: string) => `[${id.replace(/\]/g, ']]')}]`;
    case 'postgres':
    case 'sqlite':
    default:
      return (id: string) => `"${id.replace(/"/g, '""')}"`;
  }
}

/**
 * Get value quoting function for database type
 */
function getValueQuoter(dbType: SqlExportOptions['dbType']): (val: unknown) => string {
  return (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'number') {
      if (Number.isNaN(value)) return 'NULL';
      if (!Number.isFinite(value)) return 'NULL';
      return String(value);
    }

    if (typeof value === 'boolean') {
      // MySQL and SQL Server use 1/0, PostgreSQL and SQLite support TRUE/FALSE
      if (dbType === 'mysql' || dbType === 'sqlserver') {
        return value ? '1' : '0';
      }
      return value ? 'TRUE' : 'FALSE';
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    if (typeof value === 'object') {
      // JSON objects
      const json = JSON.stringify(value);
      return `'${escapeString(json)}'`;
    }

    // String value
    return `'${escapeString(String(value))}'`;
  };
}

/**
 * Escape single quotes in string values
 */
function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}
