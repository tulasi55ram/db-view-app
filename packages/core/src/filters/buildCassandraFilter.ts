/**
 * Cassandra CQL Filter Builder
 *
 * Converts filter conditions to Cassandra CQL WHERE clauses.
 * Note: Cassandra has limited filtering capabilities compared to SQL.
 */

import type { FilterCondition, FilterOperator } from '@dbview/types';
import type { CassandraFilterResult } from './types.js';

/**
 * Operators not supported by Cassandra CQL with their reasons
 */
const UNSUPPORTED_OPERATOR_REASONS: Partial<Record<FilterOperator, string>> = {
  not_contains: 'Cassandra does not support NOT CONTAINS. Filter results client-side.',
  is_null: 'Cassandra does not support IS NULL. Filter results client-side.',
  is_not_null: 'Cassandra does not support IS NOT NULL. Filter results client-side.',
};

/**
 * Set of operators supported by Cassandra
 */
const SUPPORTED_OPERATORS: Set<FilterOperator> = new Set([
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'between',
  'in',
]);

/**
 * Check if an operator is supported by Cassandra
 */
function isOperatorSupported(operator: FilterOperator): boolean {
  return SUPPORTED_OPERATORS.has(operator);
}

/**
 * Get the reason why an operator is not supported
 */
function getUnsupportedReason(operator: FilterOperator): string {
  return UNSUPPORTED_OPERATOR_REASONS[operator] ?? `Operator '${operator}' is not supported by Cassandra.`;
}

/**
 * Quotes a Cassandra identifier (column/table name).
 */
function quoteIdentifier(name: string): string {
  // Cassandra uses double quotes for identifiers
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Escapes LIKE pattern wildcards in user input to prevent wildcard injection.
 * Cassandra LIKE uses % (any chars) and _ (single char) as wildcards.
 *
 * @param value - User input to escape
 * @returns Escaped string safe for LIKE patterns
 */
function escapeLikePattern(value: unknown): string {
  const strValue = String(value ?? '');
  return strValue
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Parses IN operator values, preserving original types.
 * Arrays keep their element types (only trim strings).
 * String input is split by comma and kept as strings to preserve leading zeros
 * and ensure consistent string matching behavior.
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
 * Builds a Cassandra CQL WHERE clause from filter conditions.
 *
 * Note: Cassandra has limited WHERE clause support:
 * - Only = on partition key columns without ALLOW FILTERING
 * - Range queries (>, <, >=, <=) on clustering columns
 * - IN on partition key columns
 * - CONTAINS for collection columns
 *
 * The caller should add ALLOW FILTERING if needed.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic (Note: Cassandra only supports AND natively)
 * @returns CQL WHERE clause and parameters
 *
 * @example
 * ```typescript
 * const result = buildCassandraFilter(
 *   [
 *     { id: '1', columnName: 'user_id', operator: 'equals', value: 'abc123' },
 *     { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
 *   ],
 *   'AND'
 * );
 * // result.whereClause = '"user_id" = ? AND "age" > ?'
 * // result.params = ['abc123', 18]
 * ```
 */
export function buildCassandraFilter(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): CassandraFilterResult {
  if (!filters || filters.length === 0) {
    return { whereClause: '', params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  const skippedFilters: CassandraFilterResult['skippedFilters'] = [];

  // Cassandra doesn't support OR in WHERE clauses.
  // Return an error so callers know the query is invalid and won't execute with no constraints.
  if (logic === 'OR' && filters.length > 1) {
    return {
      whereClause: '',
      params: [],
      error: 'Cassandra does not support OR logic in WHERE clauses. Use multiple queries or filter results client-side.',
      skippedFilters: filters.map(f => ({
        columnName: f.columnName,
        operator: f.operator,
        reason: 'Cannot apply filter: OR logic not supported.',
      })),
    };
  }

  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }

    const columnName = quoteIdentifier(filter.columnName);

    // Check for unsupported operators first
    if (!isOperatorSupported(filter.operator)) {
      skippedFilters.push({
        columnName: filter.columnName,
        operator: filter.operator,
        reason: getUnsupportedReason(filter.operator),
      });
      continue;
    }

    switch (filter.operator) {
      case 'equals':
        conditions.push(`${columnName} = ?`);
        params.push(filter.value);
        break;

      case 'not_equals':
        // Cassandra doesn't support != directly, use comparison
        // This will require ALLOW FILTERING
        conditions.push(`${columnName} != ?`);
        params.push(filter.value);
        break;

      case 'contains':
        // CONTAINS works for collection columns (list, set, map)
        conditions.push(`${columnName} CONTAINS ?`);
        params.push(filter.value);
        break;

      case 'starts_with':
        // Cassandra doesn't have LIKE, but has LIKE-like syntax in newer versions
        // For older versions, this needs to be handled differently
        // Escaped to prevent LIKE wildcard injection
        conditions.push(`${columnName} LIKE ?`);
        params.push(`${escapeLikePattern(filter.value)}%`);
        break;

      case 'ends_with':
        // Escaped to prevent LIKE wildcard injection
        conditions.push(`${columnName} LIKE ?`);
        params.push(`%${escapeLikePattern(filter.value)}`);
        break;

      case 'greater_than':
        conditions.push(`${columnName} > ?`);
        params.push(filter.value);
        break;

      case 'less_than':
        conditions.push(`${columnName} < ?`);
        params.push(filter.value);
        break;

      case 'greater_or_equal':
        conditions.push(`${columnName} >= ?`);
        params.push(filter.value);
        break;

      case 'less_or_equal':
        conditions.push(`${columnName} <= ?`);
        params.push(filter.value);
        break;

      case 'between':
        // Cassandra doesn't have BETWEEN, use two conditions
        if (filter.value2 === undefined || filter.value2 === null) {
          skippedFilters.push({
            columnName: filter.columnName,
            operator: filter.operator,
            reason: 'BETWEEN operator requires both value and value2. Provide value2 or use a different operator.',
          });
          continue;
        }
        conditions.push(`${columnName} >= ? AND ${columnName} <= ?`);
        params.push(filter.value, filter.value2);
        break;

      case 'in': {
        const values = parseInValues(filter.value);

        if (values.length > 0) {
          const placeholders = values.map(() => '?').join(', ');
          conditions.push(`${columnName} IN (${placeholders})`);
          params.push(...values);
        }
        break;
      }

      default:
        break;
    }
  }

  // Join with AND (Cassandra's native support)
  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

  return {
    whereClause,
    params,
    ...(skippedFilters.length > 0 && { skippedFilters }),
  };
}

/**
 * Checks if a set of filters can be executed without ALLOW FILTERING.
 *
 * This is a heuristic check - actual requirements depend on table schema.
 *
 * @param filters - Array of filter conditions
 * @returns Whether ALLOW FILTERING is likely needed
 */
export function needsAllowFiltering(filters: FilterCondition[]): boolean {
  if (!filters || filters.length === 0) {
    return false;
  }

  // Operators that typically require ALLOW FILTERING
  const filteringRequiredOperators = [
    'contains', 'not_contains', 'starts_with', 'ends_with',
    'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal',
    'between', 'not_equals'
  ];

  return filters.some(f => filteringRequiredOperators.includes(f.operator));
}

/**
 * Result of validating filters for Cassandra compatibility
 */
export interface CassandraValidationResult {
  /** Whether all filters are compatible with Cassandra */
  valid: boolean;
  /** Filters that are compatible and can be executed */
  supportedFilters: FilterCondition[];
  /** Filters that are not compatible with Cassandra */
  unsupportedFilters: Array<{
    filter: FilterCondition;
    reason: string;
  }>;
  /** Error message if OR logic is used with multiple filters */
  logicError?: string;
}

/**
 * Pre-validates filters for Cassandra compatibility before building queries.
 * Use this to surface validation errors in the UI before attempting query execution.
 *
 * @param filters - Array of filter conditions to validate
 * @param logic - AND or OR logic
 * @returns Validation result with supported/unsupported filters
 *
 * @example
 * ```typescript
 * const validation = validateCassandraFilters(filters, 'AND');
 * if (!validation.valid) {
 *   // Show errors to user
 *   validation.unsupportedFilters.forEach(({ filter, reason }) => {
 *     console.warn(`Filter on ${filter.columnName}: ${reason}`);
 *   });
 * }
 * ```
 */
export function validateCassandraFilters(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): CassandraValidationResult {
  const supportedFilters: FilterCondition[] = [];
  const unsupportedFilters: CassandraValidationResult['unsupportedFilters'] = [];

  // Check OR logic constraint
  if (logic === 'OR' && filters.length > 1) {
    return {
      valid: false,
      supportedFilters: [],
      unsupportedFilters: filters.map(f => ({
        filter: f,
        reason: 'Cassandra does not support OR logic in WHERE clauses.',
      })),
      logicError: 'Cassandra does not support OR logic in WHERE clauses. Use multiple queries or filter results client-side.',
    };
  }

  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }

    // Check for unsupported operators
    if (!isOperatorSupported(filter.operator)) {
      unsupportedFilters.push({
        filter,
        reason: getUnsupportedReason(filter.operator),
      });
      continue;
    }

    // Check BETWEEN has required value2
    if (filter.operator === 'between' && (filter.value2 === undefined || filter.value2 === null)) {
      unsupportedFilters.push({
        filter,
        reason: 'BETWEEN operator requires both value and value2.',
      });
      continue;
    }

    supportedFilters.push(filter);
  }

  return {
    valid: unsupportedFilters.length === 0,
    supportedFilters,
    unsupportedFilters,
  };
}

/**
 * Get list of operators supported by Cassandra
 */
export function getCassandraSupportedOperators(): FilterOperator[] {
  return Array.from(SUPPORTED_OPERATORS);
}
