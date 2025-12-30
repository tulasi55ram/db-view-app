/**
 * SQL Formatting Functions
 * @dbview/core - Phase 4: SQL Utilities
 */

import { format, type SqlLanguage } from 'sql-formatter';
import type { FormatSqlOptions, SqlDialect } from './types.js';

/**
 * Map database types to sql-formatter dialects
 */
const DIALECT_MAP: Record<SqlDialect, SqlLanguage> = {
  postgres: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mariadb',
  sqlite: 'sqlite',
  sqlserver: 'tsql',
  bigquery: 'bigquery',
  redshift: 'redshift',
  spark: 'spark',
  trino: 'trino',
};

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: Required<FormatSqlOptions> = {
  dialect: 'postgres',
  tabWidth: 2,
  keywordCase: 'upper',
  dataTypeCase: 'preserve',
  functionCase: 'preserve',
  identifierCase: 'preserve',
  useTabs: false,
  commaPosition: 'after',
  logicalOperatorNewline: 'before',
  lineWidth: 80,
};

/**
 * Format SQL for readability
 *
 * @param sql - Raw SQL string to format
 * @param options - Formatting options
 * @returns Formatted SQL string
 *
 * @example
 * ```ts
 * const formatted = formatSql('SELECT * FROM users WHERE id = 1');
 * // SELECT
 * //   *
 * // FROM
 * //   users
 * // WHERE
 * //   id = 1
 * ```
 */
export function formatSql(sql: string, options: FormatSqlOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const language: SqlLanguage = DIALECT_MAP[opts.dialect] || 'postgresql';
    return format(sql, {
      language,
      tabWidth: opts.tabWidth,
      useTabs: opts.useTabs,
      keywordCase: opts.keywordCase,
      dataTypeCase: opts.dataTypeCase,
      functionCase: opts.functionCase,
      identifierCase: opts.identifierCase,
      linesBetweenQueries: 2,
    });
  } catch {
    // If formatting fails, return original SQL
    return sql;
  }
}

/**
 * Minify SQL by removing extra whitespace
 *
 * @param sql - SQL string to minify
 * @returns Minified SQL string
 *
 * @example
 * ```ts
 * const minified = minifySql(`
 *   SELECT *
 *   FROM users
 *   WHERE id = 1
 * `);
 * // "SELECT * FROM users WHERE id = 1"
 * ```
 */
export function minifySql(sql: string): string {
  return sql
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([(),])\s*/g, '$1') // Remove space around parentheses and commas
    .replace(/\(\s+/g, '(') // Remove space after opening paren
    .replace(/\s+\)/g, ')') // Remove space before closing paren
    .trim();
}

/**
 * Check if a string contains multiple SQL statements
 *
 * @param sql - SQL string to check
 * @returns True if multiple statements detected
 */
export function hasMultipleStatements(sql: string): boolean {
  // Remove strings and comments first to avoid false positives
  const cleaned = sql
    .replace(/'[^']*'/g, '""') // Remove single-quoted strings
    .replace(/"[^"]*"/g, '""') // Remove double-quoted strings
    .replace(/--.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments

  // Count semicolons not at the end
  const statements = cleaned.split(';').filter((s) => s.trim().length > 0);
  return statements.length > 1;
}

/**
 * Split SQL into individual statements
 *
 * @param sql - SQL string containing multiple statements
 * @returns Array of individual SQL statements
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle line comments
    if (!inString && !inBlockComment && char === '-' && nextChar === '-') {
      inLineComment = true;
    }
    if (inLineComment && char === '\n') {
      inLineComment = false;
    }

    // Handle block comments
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
    }
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      current += '*/';
      i++;
      continue;
    }

    // Handle strings
    if (!inLineComment && !inBlockComment) {
      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        // Check for escaped quote
        if (nextChar !== stringChar) {
          inString = false;
        } else {
          current += char;
          i++;
        }
      }
    }

    // Handle statement separator
    if (!inString && !inLineComment && !inBlockComment && char === ';') {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
      continue;
    }

    current += char;
  }

  // Add final statement if any
  const final = current.trim();
  if (final.length > 0) {
    statements.push(final);
  }

  return statements;
}
