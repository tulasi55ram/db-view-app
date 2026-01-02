/**
 * SQL Filter Builder
 *
 * Builds parameterized SQL WHERE clauses from filter conditions.
 * Supports multiple SQL databases with their specific placeholder styles.
 */

import type { FilterCondition, DatabaseType } from '@dbview/types';
import type { SqlFilterResult, SqlFilterResultNamed, SqlFilterOptions, PlaceholderStyle } from './types.js';

/**
 * Default identifier quoting function (double quotes)
 */
function defaultQuoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * MySQL/MariaDB identifier quoting (backticks)
 */
function mysqlQuoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

/**
 * SQL Server identifier quoting (brackets)
 */
function sqlServerQuoteIdentifier(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

/**
 * Gets the appropriate quote function for a database type.
 */
function getQuoteFunction(dbType: DatabaseType): (name: string) => string {
  switch (dbType) {
    case 'mysql':
    case 'mariadb':
      return mysqlQuoteIdentifier;
    case 'sqlserver':
      return sqlServerQuoteIdentifier;
    default:
      return defaultQuoteIdentifier;
  }
}

/**
 * Gets the placeholder style for a database type.
 */
function getPlaceholderStyle(dbType: DatabaseType): PlaceholderStyle {
  switch (dbType) {
    case 'postgres':
      return 'positional';
    case 'sqlserver':
      return 'named';
    default:
      return 'question';
  }
}

/**
 * Gets the text casting syntax for LIKE operations.
 */
function getTextCastSyntax(dbType: DatabaseType, column: string): string {
  switch (dbType) {
    case 'postgres':
      return `${column}::text`;
    case 'sqlserver':
      return `CAST(${column} AS NVARCHAR(MAX))`;
    default:
      return column;
  }
}

/**
 * Gets the LIKE operator (case-insensitive where supported).
 */
function getLikeOperator(dbType: DatabaseType): string {
  switch (dbType) {
    case 'postgres':
      return 'ILIKE';
    default:
      return 'LIKE';
  }
}

/**
 * Gets the NOT LIKE operator.
 */
function getNotLikeOperator(dbType: DatabaseType): string {
  switch (dbType) {
    case 'postgres':
      return 'NOT ILIKE';
    default:
      return 'NOT LIKE';
  }
}

/**
 * Escapes LIKE pattern wildcards in user input to prevent wildcard injection.
 *
 * Without escaping, a user could input '%' or '_' to match unexpected data.
 * For example, searching for '%admin%' would match any admin-related value.
 *
 * @param value - User input to escape
 * @param dbType - Database type (SQL Server uses different escape syntax)
 * @returns Escaped string safe for LIKE patterns
 *
 * @example
 * ```typescript
 * escapeLikePattern('50%', 'postgres')  // Returns '50\\%'
 * escapeLikePattern('test_value', 'mysql')  // Returns 'test\\_value'
 * escapeLikePattern('50%', 'sqlserver')  // Returns '50[%]'
 * ```
 */
function escapeLikePattern(value: unknown, dbType: DatabaseType): string {
  const strValue = String(value ?? '');

  if (dbType === 'sqlserver') {
    // SQL Server uses [char] syntax to escape special characters
    return strValue
      .replace(/\[/g, '[[]')  // Escape opening bracket first
      .replace(/%/g, '[%]')
      .replace(/_/g, '[_]');
  }

  // Standard SQL escape with backslash (PostgreSQL, MySQL, MariaDB, SQLite)
  return strValue
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Gets the ESCAPE clause for LIKE patterns.
 * Required for standard SQL databases to specify the escape character.
 */
function getLikeEscapeClause(dbType: DatabaseType): string {
  if (dbType === 'sqlserver') {
    // SQL Server uses [char] syntax, no ESCAPE clause needed
    return '';
  }
  // Standard SQL uses backslash escape
  return " ESCAPE '\\'";
}

/**
 * Parses IN operator values, preserving original types.
 * Arrays keep their element types (only trim strings).
 * String input is split by comma and kept as strings to preserve leading zeros
 * and ensure consistent string matching behavior.
 *
 * @param value - The filter value (array or comma-separated string)
 * @returns Array of values with preserved types
 */
function parseInValues(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    // Preserve types exactly, only trim strings, filter empty/null values
    return value
      .map(v => typeof v === 'string' ? v.trim() : v)
      .filter(v => v !== '' && v !== null && v !== undefined);
  }
  // String input: split and keep as strings (preserves leading zeros, etc.)
  return String(value ?? '')
    .split(',')
    .map(v => v.trim())
    .filter(v => v !== '');
}

/**
 * Builds a SQL WHERE clause from filter conditions.
 *
 * Uses parameterized queries to prevent SQL injection.
 * Supports different SQL databases with their specific syntax.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @param options - SQL filter options including database type
 * @returns WHERE clause (without WHERE keyword) and parameters
 *
 * @example
 * ```typescript
 * // PostgreSQL
 * const result = buildSqlFilter(
 *   [{ id: '1', columnName: 'age', operator: 'greater_than', value: 18 }],
 *   'AND',
 *   { dbType: 'postgres' }
 * );
 * // result.whereClause = '"age" > $1'
 * // result.params = [18]
 *
 * // MySQL
 * const result = buildSqlFilter(
 *   [{ id: '1', columnName: 'name', operator: 'contains', value: 'john' }],
 *   'AND',
 *   { dbType: 'mysql' }
 * );
 * // result.whereClause = '`name` LIKE ?'
 * // result.params = ['%john%']
 * ```
 */
export function buildSqlFilter(
  filters: FilterCondition[],
  logic: 'AND' | 'OR',
  options: SqlFilterOptions
): SqlFilterResult {
  const { dbType } = options;
  const quoteIdentifier = options.quoteIdentifier ?? getQuoteFunction(dbType);
  const placeholderStyle = getPlaceholderStyle(dbType);

  // Default startIndex depends on placeholder style:
  // - positional ($1, $2): starts at 1 (PostgreSQL convention)
  // - named (@p0, @p1): starts at 0 (consistent with buildSqlFilterNamed)
  // - question (?): index doesn't appear in output, default to 0
  const defaultStartIndex = placeholderStyle === 'positional' ? 1 : 0;
  const startIndex = options.startIndex ?? defaultStartIndex;

  if (!filters || filters.length === 0) {
    return { whereClause: '', params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = startIndex;

  /**
   * Gets the next placeholder based on style
   */
  function getPlaceholder(): string {
    switch (placeholderStyle) {
      case 'positional':
        return `$${paramIndex++}`;
      case 'question':
        paramIndex++;
        return '?';
      case 'named':
        return `@p${paramIndex++}`;
    }
  }

  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }

    const columnName = quoteIdentifier(filter.columnName);
    const textColumn = getTextCastSyntax(dbType, columnName);
    const likeOp = getLikeOperator(dbType);
    const notLikeOp = getNotLikeOperator(dbType);

    switch (filter.operator) {
      case 'equals':
        conditions.push(`${columnName} = ${getPlaceholder()}`);
        params.push(filter.value);
        break;

      case 'not_equals':
        conditions.push(`${columnName} != ${getPlaceholder()}`);
        params.push(filter.value);
        break;

      case 'contains': {
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}${escapeClause}`);
        params.push(`%${escaped}%`);
        break;
      }

      case 'not_contains': {
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} ${notLikeOp} ${getPlaceholder()}${escapeClause}`);
        params.push(`%${escaped}%`);
        break;
      }

      case 'starts_with': {
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}${escapeClause}`);
        params.push(`${escaped}%`);
        break;
      }

      case 'ends_with': {
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}${escapeClause}`);
        params.push(`%${escaped}`);
        break;
      }

      case 'greater_than':
        conditions.push(`${columnName} > ${getPlaceholder()}`);
        params.push(filter.value);
        break;

      case 'less_than':
        conditions.push(`${columnName} < ${getPlaceholder()}`);
        params.push(filter.value);
        break;

      case 'greater_or_equal':
        conditions.push(`${columnName} >= ${getPlaceholder()}`);
        params.push(filter.value);
        break;

      case 'less_or_equal':
        conditions.push(`${columnName} <= ${getPlaceholder()}`);
        params.push(filter.value);
        break;

      case 'is_null':
        conditions.push(`${columnName} IS NULL`);
        break;

      case 'is_not_null':
        conditions.push(`${columnName} IS NOT NULL`);
        break;

      case 'between':
        if (filter.value2 === undefined || filter.value2 === null) {
          throw new Error(
            `BETWEEN operator on column "${filter.columnName}" requires both value and value2. ` +
            'Provide value2 or use a different operator.'
          );
        }
        {
          const p1 = getPlaceholder();
          const p2 = getPlaceholder();
          conditions.push(`${columnName} BETWEEN ${p1} AND ${p2}`);
          params.push(filter.value, filter.value2);
        }
        break;

      case 'in': {
        // Parse values preserving types (numbers stay numbers)
        const values = parseInValues(filter.value);

        if (values.length > 0) {
          const placeholders = values.map(() => getPlaceholder()).join(', ');
          conditions.push(`${columnName} IN (${placeholders})`);
          params.push(...values);
        }
        break;
      }

      default:
        // Unknown operator - skip
        break;
    }
  }

  if (conditions.length === 0) {
    return { whereClause: '', params: [] };
  }

  const whereClause = conditions.join(` ${logic} `);
  return { whereClause, params };
}

/**
 * Builds a SQL WHERE clause with named parameters (for SQL Server).
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @param options - SQL filter options
 * @returns WHERE clause and named parameters
 */
export function buildSqlFilterNamed(
  filters: FilterCondition[],
  logic: 'AND' | 'OR',
  options: Omit<SqlFilterOptions, 'dbType'> & { dbType?: DatabaseType }
): SqlFilterResultNamed {
  const dbType = options.dbType ?? 'sqlserver';
  const quoteIdentifier = options.quoteIdentifier ?? getQuoteFunction(dbType);
  const startIndex = options.startIndex ?? 0;

  if (!filters || filters.length === 0) {
    return { whereClause: '', params: {} };
  }

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  let paramIndex = startIndex;

  function getParamName(): string {
    return `p${paramIndex++}`;
  }

  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }

    const columnName = quoteIdentifier(filter.columnName);
    const textColumn = `CAST(${columnName} AS NVARCHAR(MAX))`;

    switch (filter.operator) {
      case 'equals': {
        const name = getParamName();
        conditions.push(`${columnName} = @${name}`);
        params[name] = filter.value;
        break;
      }

      case 'not_equals': {
        const name = getParamName();
        conditions.push(`${columnName} != @${name}`);
        params[name] = filter.value;
        break;
      }

      case 'contains': {
        const name = getParamName();
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} LIKE @${name}${escapeClause}`);
        params[name] = `%${escaped}%`;
        break;
      }

      case 'not_contains': {
        const name = getParamName();
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} NOT LIKE @${name}${escapeClause}`);
        params[name] = `%${escaped}%`;
        break;
      }

      case 'starts_with': {
        const name = getParamName();
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} LIKE @${name}${escapeClause}`);
        params[name] = `${escaped}%`;
        break;
      }

      case 'ends_with': {
        const name = getParamName();
        const escaped = escapeLikePattern(filter.value, dbType);
        const escapeClause = getLikeEscapeClause(dbType);
        conditions.push(`${textColumn} LIKE @${name}${escapeClause}`);
        params[name] = `%${escaped}`;
        break;
      }

      case 'greater_than': {
        const name = getParamName();
        conditions.push(`${columnName} > @${name}`);
        params[name] = filter.value;
        break;
      }

      case 'less_than': {
        const name = getParamName();
        conditions.push(`${columnName} < @${name}`);
        params[name] = filter.value;
        break;
      }

      case 'greater_or_equal': {
        const name = getParamName();
        conditions.push(`${columnName} >= @${name}`);
        params[name] = filter.value;
        break;
      }

      case 'less_or_equal': {
        const name = getParamName();
        conditions.push(`${columnName} <= @${name}`);
        params[name] = filter.value;
        break;
      }

      case 'is_null':
        conditions.push(`${columnName} IS NULL`);
        break;

      case 'is_not_null':
        conditions.push(`${columnName} IS NOT NULL`);
        break;

      case 'between': {
        if (filter.value2 === undefined || filter.value2 === null) {
          throw new Error(
            `BETWEEN operator on column "${filter.columnName}" requires both value and value2. ` +
            'Provide value2 or use a different operator.'
          );
        }
        const name1 = getParamName();
        const name2 = getParamName();
        conditions.push(`${columnName} BETWEEN @${name1} AND @${name2}`);
        params[name1] = filter.value;
        params[name2] = filter.value2;
        break;
      }

      case 'in': {
        // Parse values preserving types (numbers stay numbers)
        const values = parseInValues(filter.value);

        if (values.length > 0) {
          const paramNames: string[] = [];
          for (const val of values) {
            const name = getParamName();
            paramNames.push(`@${name}`);
            params[name] = val;
          }
          conditions.push(`${columnName} IN (${paramNames.join(', ')})`);
        }
        break;
      }

      default:
        break;
    }
  }

  if (conditions.length === 0) {
    return { whereClause: '', params: {} };
  }

  const whereClause = conditions.join(` ${logic} `);
  return { whereClause, params };
}

/**
 * Helper function to build WHERE clause for a specific database type.
 * This is a convenience wrapper around buildSqlFilter.
 */
export function buildWhereClause(
  filters: FilterCondition[],
  logic: 'AND' | 'OR',
  dbType: DatabaseType,
  quoteIdentifier?: (name: string) => string
): SqlFilterResult {
  return buildSqlFilter(filters, logic, { dbType, quoteIdentifier });
}
