/**
 * Elasticsearch Filter Builder
 *
 * Converts filter conditions to Elasticsearch Query DSL.
 */

import type { FilterCondition } from '@dbview/types';
import type { ElasticsearchFilterResult } from './types.js';

/**
 * Escapes Elasticsearch wildcard special characters (* and ?).
 * Without escaping, user input could alter the wildcard pattern behavior.
 *
 * @param str - User input to escape
 * @returns Escaped string safe for wildcard patterns
 */
function escapeWildcard(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\?/g, '\\?');
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
      // Use wildcard for contains pattern (escaped to prevent wildcard injection)
      return { wildcard: { [columnName]: { value: `*${escapeWildcard(String(value))}*`, case_insensitive: true } } };

    case 'not_contains':
      // Escaped to prevent wildcard injection
      return { bool: { must_not: { wildcard: { [columnName]: { value: `*${escapeWildcard(String(value))}*`, case_insensitive: true } } } } };

    case 'starts_with':
      // Use wildcard with proper escaping for consistency with other string operators
      return { wildcard: { [columnName]: { value: `${escapeWildcard(String(value))}*`, case_insensitive: true } } };

    case 'ends_with':
      // Escaped to prevent wildcard injection
      return { wildcard: { [columnName]: { value: `*${escapeWildcard(String(value))}`, case_insensitive: true } } };

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
      if (value2 === undefined || value2 === null) {
        throw new Error(
          `BETWEEN operator on column "${columnName}" requires both value and value2. ` +
          'Provide value2 or use a different operator.'
        );
      }
      return { range: { [columnName]: { gte: value, lte: value2 } } };

    case 'in': {
      const values = parseInValues(value);
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
