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
      // Case-insensitive regex for contains (escaped to prevent regex injection)
      return { [columnName]: { $regex: escapeRegex(String(value)), $options: 'i' } };

    case 'not_contains':
      // Negated regex (escaped to prevent regex injection)
      return { [columnName]: { $not: { $regex: escapeRegex(String(value)), $options: 'i' } } };

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
      if (value2 === undefined || value2 === null) {
        throw new Error(
          `BETWEEN operator on column "${columnName}" requires both value and value2. ` +
          'Provide value2 or use a different operator.'
        );
      }
      return { [columnName]: { $gte: value, $lte: value2 } };

    case 'in': {
      const values = parseInValues(value);
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
