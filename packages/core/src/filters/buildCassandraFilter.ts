/**
 * Cassandra CQL Filter Builder
 *
 * Converts filter conditions to Cassandra CQL WHERE clauses.
 * Note: Cassandra has limited filtering capabilities compared to SQL.
 */

import type { FilterCondition } from '@dbview/types';
import type { CassandraFilterResult } from './types.js';

/**
 * Quotes a Cassandra identifier (column/table name).
 */
function quoteIdentifier(name: string): string {
  // Cassandra uses double quotes for identifiers
  return `"${name.replace(/"/g, '""')}"`;
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

  // Note: Cassandra doesn't support OR in WHERE clauses natively
  // If OR is requested, we still build it but warn in the comments
  if (logic === 'OR') {
    console.warn('Cassandra does not natively support OR in WHERE clauses. Results may require ALLOW FILTERING or multiple queries.');
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }

    const columnName = quoteIdentifier(filter.columnName);

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

      case 'not_contains':
        // Cassandra doesn't have NOT CONTAINS, this will be filtered client-side
        console.warn('Cassandra does not support NOT CONTAINS. Filter will be applied client-side.');
        break;

      case 'starts_with':
        // Cassandra doesn't have LIKE, but has LIKE-like syntax in newer versions
        // For older versions, this needs to be handled differently
        conditions.push(`${columnName} LIKE ?`);
        params.push(`${filter.value}%`);
        break;

      case 'ends_with':
        conditions.push(`${columnName} LIKE ?`);
        params.push(`%${filter.value}`);
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

      case 'is_null':
        // Cassandra doesn't have IS NULL syntax in the same way
        // This typically means the column doesn't exist
        conditions.push(`${columnName} = NULL`);
        break;

      case 'is_not_null':
        conditions.push(`${columnName} != NULL`);
        break;

      case 'between':
        // Cassandra doesn't have BETWEEN, use two conditions
        if (filter.value2 !== undefined) {
          conditions.push(`${columnName} >= ? AND ${columnName} <= ?`);
          params.push(filter.value, filter.value2);
        }
        break;

      case 'in': {
        const values = Array.isArray(filter.value)
          ? filter.value
          : String(filter.value).split(',').map(v => v.trim()).filter(v => v !== '');

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

  if (conditions.length === 0) {
    return { whereClause: '', params: [] };
  }

  // Join with AND (Cassandra's native support)
  // OR logic would need to be handled differently (multiple queries)
  const whereClause = conditions.join(' AND ');
  return { whereClause, params };
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
