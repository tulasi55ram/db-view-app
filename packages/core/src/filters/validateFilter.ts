/**
 * Filter Validation
 *
 * Validates filter conditions and provides helpful error messages.
 */

import type { FilterCondition, FilterOperator } from '@dbview/types';
import type { FilterValidationResult } from './types.js';
import { ALL_OPERATORS, operatorNeedsValue, operatorNeedsTwoValues } from './operators.js';

/**
 * Validates a single filter condition.
 *
 * @param filter - The filter condition to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validateFilter({
 *   id: '1',
 *   columnName: 'age',
 *   operator: 'greater_than',
 *   value: 18
 * });
 * // result.valid = true
 * ```
 */
export function validateFilter(filter: FilterCondition): FilterValidationResult {
  const errors: string[] = [];

  // Check for required fields
  if (!filter.id) {
    errors.push('Filter must have an id');
  }

  if (!filter.columnName || filter.columnName.trim() === '') {
    errors.push('Column name is required');
  }

  if (!filter.operator) {
    errors.push('Operator is required');
  } else if (!ALL_OPERATORS.includes(filter.operator)) {
    errors.push(`Invalid operator: ${filter.operator}`);
  }

  // If basic validation failed, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check value requirements
  if (operatorNeedsValue(filter.operator)) {
    if (filter.value === undefined || filter.value === null) {
      errors.push(`Operator '${filter.operator}' requires a value`);
    } else if (typeof filter.value === 'string' && filter.value.trim() === '') {
      // Allow empty string for some operators
      if (!['equals', 'not_equals'].includes(filter.operator)) {
        errors.push(`Value cannot be empty for operator '${filter.operator}'`);
      }
    }
  }

  // Check for second value (BETWEEN)
  if (operatorNeedsTwoValues(filter.operator)) {
    if (filter.value2 === undefined || filter.value2 === null) {
      errors.push(`Operator '${filter.operator}' requires a second value`);
    }
  }

  // Validate IN operator values
  if (filter.operator === 'in') {
    const values = Array.isArray(filter.value)
      ? filter.value
      : String(filter.value ?? '').split(',').map(v => v.trim()).filter(v => v !== '');

    if (values.length === 0) {
      errors.push('IN operator requires at least one value');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Return normalized filter
  return {
    valid: true,
    errors: [],
    normalizedFilter: normalizeFilter(filter),
  };
}

/**
 * Validates an array of filter conditions.
 *
 * @param filters - Array of filter conditions
 * @returns Array of validation results
 */
export function validateFilters(filters: FilterCondition[]): FilterValidationResult[] {
  return filters.map(validateFilter);
}

/**
 * Checks if all filters in an array are valid.
 *
 * @param filters - Array of filter conditions
 * @returns True if all filters are valid
 */
export function areFiltersValid(filters: FilterCondition[]): boolean {
  return filters.every(f => validateFilter(f).valid);
}

/**
 * Gets all validation errors from an array of filters.
 *
 * @param filters - Array of filter conditions
 * @returns Array of error messages with filter context
 */
export function getFilterErrors(filters: FilterCondition[]): string[] {
  const errors: string[] = [];

  filters.forEach((filter, index) => {
    const result = validateFilter(filter);
    if (!result.valid) {
      const context = filter.columnName || `Filter ${index + 1}`;
      result.errors.forEach(err => {
        errors.push(`${context}: ${err}`);
      });
    }
  });

  return errors;
}

/**
 * Normalizes a filter condition.
 * - Trims string values
 * - Converts types where appropriate
 * - Ensures consistent structure
 *
 * @param filter - The filter to normalize
 * @returns Normalized filter
 */
export function normalizeFilter(filter: FilterCondition): FilterCondition {
  const normalized: FilterCondition = {
    id: filter.id,
    columnName: typeof filter.columnName === 'string'
      ? filter.columnName.trim()
      : String(filter.columnName ?? ''),
    operator: filter.operator,
    value: filter.value,
  };

  // Normalize value
  if (typeof normalized.value === 'string') {
    normalized.value = normalized.value.trim();
  }

  // Normalize value2 if present
  if (filter.value2 !== undefined) {
    normalized.value2 = typeof filter.value2 === 'string'
      ? filter.value2.trim()
      : filter.value2;
  }

  // Normalize IN values to array
  if (filter.operator === 'in' && typeof normalized.value === 'string') {
    normalized.value = normalized.value
      .split(',')
      .map(v => v.trim())
      .filter(v => v !== '');
  }

  return normalized;
}

/**
 * Creates a new filter condition with default values.
 *
 * @param columnName - The column name
 * @param operator - The operator (default: 'equals')
 * @returns New filter condition
 */
export function createFilter(
  columnName: string,
  operator: FilterOperator = 'equals'
): FilterCondition {
  return {
    id: generateFilterId(),
    columnName,
    operator,
    value: '',
  };
}

/**
 * Generates a unique filter ID.
 */
function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Checks if a filter condition is empty (no meaningful value).
 *
 * @param filter - The filter to check
 * @returns True if filter is effectively empty
 */
export function isFilterEmpty(filter: FilterCondition): boolean {
  // Operators that don't need values are never empty
  if (!operatorNeedsValue(filter.operator)) {
    return false;
  }

  if (filter.value === undefined || filter.value === null) {
    return true;
  }

  if (typeof filter.value === 'string' && filter.value.trim() === '') {
    return true;
  }

  if (Array.isArray(filter.value) && filter.value.length === 0) {
    return true;
  }

  return false;
}

/**
 * Removes empty filters from an array.
 *
 * @param filters - Array of filter conditions
 * @returns Filters with empty ones removed
 */
export function removeEmptyFilters(filters: FilterCondition[]): FilterCondition[] {
  return filters.filter(f => !isFilterEmpty(f));
}
