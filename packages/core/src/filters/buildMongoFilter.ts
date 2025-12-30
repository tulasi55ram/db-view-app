/**
 * MongoDB Filter Builder
 *
 * Converts filter conditions to MongoDB query DSL.
 */

import type { FilterCondition } from '@dbview/types';
import type { MongoFilterResult } from './types.js';

/**
 * Converts a single filter condition to a MongoDB query condition.
 */
function filterToMongoCondition(filter: FilterCondition): Record<string, unknown> | null {
  const { columnName, operator, value, value2 } = filter;

  if (!columnName || !operator) {
    return null;
  }

  switch (operator) {
    case 'equals':
      return { [columnName]: { $eq: value } };

    case 'not_equals':
      return { [columnName]: { $ne: value } };

    case 'contains':
      // Case-insensitive regex for contains
      return { [columnName]: { $regex: String(value), $options: 'i' } };

    case 'not_contains':
      // Negated regex
      return { [columnName]: { $not: { $regex: String(value), $options: 'i' } } };

    case 'starts_with':
      return { [columnName]: { $regex: `^${escapeRegex(String(value))}`, $options: 'i' } };

    case 'ends_with':
      return { [columnName]: { $regex: `${escapeRegex(String(value))}$`, $options: 'i' } };

    case 'greater_than':
      return { [columnName]: { $gt: value } };

    case 'less_than':
      return { [columnName]: { $lt: value } };

    case 'greater_or_equal':
      return { [columnName]: { $gte: value } };

    case 'less_or_equal':
      return { [columnName]: { $lte: value } };

    case 'is_null':
      return { [columnName]: { $eq: null } };

    case 'is_not_null':
      return { [columnName]: { $ne: null } };

    case 'between':
      if (value2 !== undefined) {
        return { [columnName]: { $gte: value, $lte: value2 } };
      }
      return null;

    case 'in': {
      const values = Array.isArray(value)
        ? value
        : String(value).split(',').map(v => v.trim()).filter(v => v !== '');
      return { [columnName]: { $in: values } };
    }

    default:
      return null;
  }
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a MongoDB query object from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns MongoDB query object
 *
 * @example
 * ```typescript
 * const result = buildMongoFilter(
 *   [
 *     { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
 *     { id: '2', columnName: 'status', operator: 'equals', value: 'active' }
 *   ],
 *   'AND'
 * );
 * // result.query = {
 * //   $and: [
 * //     { age: { $gt: 18 } },
 * //     { status: { $eq: 'active' } }
 * //   ]
 * // }
 * ```
 */
export function buildMongoFilter(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): MongoFilterResult {
  if (!filters || filters.length === 0) {
    return { query: {} };
  }

  const conditions: Record<string, unknown>[] = [];

  for (const filter of filters) {
    const condition = filterToMongoCondition(filter);
    if (condition) {
      conditions.push(condition);
    }
  }

  if (conditions.length === 0) {
    return { query: {} };
  }

  // Single condition - no need for $and/$or wrapper
  if (conditions.length === 1) {
    return { query: conditions[0] };
  }

  // Multiple conditions - wrap in $and or $or
  const queryOperator = logic === 'AND' ? '$and' : '$or';
  return { query: { [queryOperator]: conditions } };
}

/**
 * Builds a MongoDB aggregation pipeline match stage from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns MongoDB $match stage object
 *
 * @example
 * ```typescript
 * const match = buildMongoMatchStage(filters, 'AND');
 * const pipeline = [match, { $limit: 100 }];
 * ```
 */
export function buildMongoMatchStage(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): { $match: Record<string, unknown> } {
  const { query } = buildMongoFilter(filters, logic);
  return { $match: Object.keys(query).length > 0 ? query : {} };
}
