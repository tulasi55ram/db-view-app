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
  const { dbType, startIndex = 1 } = options;
  const quoteIdentifier = options.quoteIdentifier ?? getQuoteFunction(dbType);
  const placeholderStyle = getPlaceholderStyle(dbType);

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
        return `@p${paramIndex++ - 1}`;
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

      case 'contains':
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}`);
        params.push(`%${filter.value}%`);
        break;

      case 'not_contains':
        conditions.push(`${textColumn} ${notLikeOp} ${getPlaceholder()}`);
        params.push(`%${filter.value}%`);
        break;

      case 'starts_with':
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}`);
        params.push(`${filter.value}%`);
        break;

      case 'ends_with':
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}`);
        params.push(`%${filter.value}`);
        break;

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
        if (filter.value2 !== undefined) {
          const p1 = getPlaceholder();
          const p2 = getPlaceholder();
          conditions.push(`${columnName} BETWEEN ${p1} AND ${p2}`);
          params.push(filter.value, filter.value2);
        }
        break;

      case 'in': {
        // Parse comma-separated values and filter empty strings
        const values = (Array.isArray(filter.value)
          ? filter.value.map(v => String(v).trim())
          : String(filter.value).split(',').map(v => v.trim())
        ).filter(v => v !== '');

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
        conditions.push(`${textColumn} LIKE @${name}`);
        params[name] = `%${filter.value}%`;
        break;
      }

      case 'not_contains': {
        const name = getParamName();
        conditions.push(`${textColumn} NOT LIKE @${name}`);
        params[name] = `%${filter.value}%`;
        break;
      }

      case 'starts_with': {
        const name = getParamName();
        conditions.push(`${textColumn} LIKE @${name}`);
        params[name] = `${filter.value}%`;
        break;
      }

      case 'ends_with': {
        const name = getParamName();
        conditions.push(`${textColumn} LIKE @${name}`);
        params[name] = `%${filter.value}`;
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
        if (filter.value2 !== undefined) {
          const name1 = getParamName();
          const name2 = getParamName();
          conditions.push(`${columnName} BETWEEN @${name1} AND @${name2}`);
          params[name1] = filter.value;
          params[name2] = filter.value2;
        }
        break;
      }

      case 'in': {
        const values = (Array.isArray(filter.value)
          ? filter.value.map(v => String(v).trim())
          : String(filter.value).split(',').map(v => v.trim())
        ).filter(v => v !== '');

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
