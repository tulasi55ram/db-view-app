/**
 * Elasticsearch Filter Builder
 *
 * Converts filter conditions to Elasticsearch Query DSL.
 */

import type { FilterCondition } from '@dbview/types';
import type { ElasticsearchFilterResult } from './types.js';

/**
 * Converts a single filter condition to an Elasticsearch query clause.
 */
function filterToEsClause(filter: FilterCondition): Record<string, unknown> | null {
  const { columnName, operator, value, value2 } = filter;

  if (!columnName || !operator) {
    return null;
  }

  switch (operator) {
    case 'equals':
      return { term: { [columnName]: value } };

    case 'not_equals':
      return { bool: { must_not: { term: { [columnName]: value } } } };

    case 'contains':
      // Use match for text search or wildcard for exact patterns
      return { wildcard: { [columnName]: { value: `*${value}*`, case_insensitive: true } } };

    case 'not_contains':
      return { bool: { must_not: { wildcard: { [columnName]: { value: `*${value}*`, case_insensitive: true } } } } };

    case 'starts_with':
      return { prefix: { [columnName]: { value: String(value).toLowerCase(), case_insensitive: true } } };

    case 'ends_with':
      return { wildcard: { [columnName]: { value: `*${value}`, case_insensitive: true } } };

    case 'greater_than':
      return { range: { [columnName]: { gt: value } } };

    case 'less_than':
      return { range: { [columnName]: { lt: value } } };

    case 'greater_or_equal':
      return { range: { [columnName]: { gte: value } } };

    case 'less_or_equal':
      return { range: { [columnName]: { lte: value } } };

    case 'is_null':
      return { bool: { must_not: { exists: { field: columnName } } } };

    case 'is_not_null':
      return { exists: { field: columnName } };

    case 'between':
      if (value2 !== undefined) {
        return { range: { [columnName]: { gte: value, lte: value2 } } };
      }
      return null;

    case 'in': {
      const values = Array.isArray(value)
        ? value
        : String(value).split(',').map(v => v.trim()).filter(v => v !== '');
      return { terms: { [columnName]: values } };
    }

    default:
      return null;
  }
}

/**
 * Builds an Elasticsearch query DSL from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns Elasticsearch query DSL object
 *
 * @example
 * ```typescript
 * const result = buildElasticsearchFilter(
 *   [
 *     { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
 *     { id: '2', columnName: 'status', operator: 'equals', value: 'active' }
 *   ],
 *   'AND'
 * );
 * // result.query = {
 * //   bool: {
 * //     must: [
 * //       { range: { age: { gt: 18 } } },
 * //       { term: { status: 'active' } }
 * //     ]
 * //   }
 * // }
 * ```
 */
export function buildElasticsearchFilter(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): ElasticsearchFilterResult {
  if (!filters || filters.length === 0) {
    return { query: { bool: {} } };
  }

  const clauses: Record<string, unknown>[] = [];

  for (const filter of filters) {
    const clause = filterToEsClause(filter);
    if (clause) {
      clauses.push(clause);
    }
  }

  if (clauses.length === 0) {
    return { query: { bool: {} } };
  }

  // Use 'must' for AND, 'should' for OR
  if (logic === 'AND') {
    return { query: { bool: { must: clauses } } };
  } else {
    return { query: { bool: { should: clauses, minimum_should_match: 1 } } };
  }
}

/**
 * Builds an Elasticsearch search request body with filters.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic
 * @param options - Additional search options
 * @returns Elasticsearch search request body
 */
export function buildElasticsearchSearchBody(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND',
  options: {
    from?: number;
    size?: number;
    sort?: Array<Record<string, 'asc' | 'desc'>>;
  } = {}
): Record<string, unknown> {
  const { query } = buildElasticsearchFilter(filters, logic);
  const { from = 0, size = 100, sort } = options;

  const body: Record<string, unknown> = {
    query: query.bool && Object.keys(query.bool).length > 0 ? query : { match_all: {} },
    from,
    size,
  };

  if (sort && sort.length > 0) {
    body.sort = sort;
  }

  return body;
}
