/**
 * Filter Validation Utility
 *
 * Validates filter conditions and operator compatibility with column types.
 */
import type { FilterCondition, ColumnMetadata, FilterOperator } from "@dbview/types";

// Column type categories for operator compatibility
type ColumnTypeCategory = 'numeric' | 'string' | 'date' | 'boolean' | 'json' | 'unknown';

// Operators compatible with each type category
const OPERATOR_COMPATIBILITY: Record<ColumnTypeCategory, FilterOperator[]> = {
  numeric: [
    'equals', 'not_equals', 'greater_than', 'greater_or_equal',
    'less_than', 'less_or_equal', 'between', 'in', 'is_null', 'is_not_null'
  ],
  string: [
    'equals', 'not_equals', 'contains', 'starts_with', 'ends_with',
    'in', 'is_null', 'is_not_null'
  ],
  date: [
    'equals', 'not_equals', 'greater_than', 'greater_or_equal',
    'less_than', 'less_or_equal', 'between', 'is_null', 'is_not_null'
  ],
  boolean: ['equals', 'not_equals', 'is_null', 'is_not_null'],
  json: ['is_null', 'is_not_null', 'contains'],
  unknown: [
    'equals', 'not_equals', 'greater_than', 'greater_or_equal',
    'less_than', 'less_or_equal', 'contains', 'starts_with', 'ends_with',
    'in', 'between', 'is_null', 'is_not_null'
  ],
};

/**
 * Categorize a column type into a type category
 */
function categorizeColumnType(dataType: string | undefined): ColumnTypeCategory {
  if (!dataType) return 'unknown';

  const lowerType = dataType.toLowerCase();

  // Numeric types
  if (/int|decimal|numeric|float|double|real|number|serial|bigint|smallint|tinyint|money/.test(lowerType)) {
    return 'numeric';
  }

  // Boolean types
  if (/bool|boolean|bit/.test(lowerType)) {
    return 'boolean';
  }

  // Date/time types
  if (/date|time|timestamp|datetime|interval/.test(lowerType)) {
    return 'date';
  }

  // JSON types
  if (/json|jsonb|object|document/.test(lowerType)) {
    return 'json';
  }

  // String types (default for text-like types)
  if (/char|text|varchar|string|uuid|enum|clob/.test(lowerType)) {
    return 'string';
  }

  return 'unknown';
}

/**
 * Check if an operator is compatible with a column type
 */
export function isOperatorCompatible(
  operator: FilterOperator,
  columnMetadata: ColumnMetadata | undefined
): boolean {
  if (!columnMetadata) return true; // Allow if no metadata

  const category = categorizeColumnType(columnMetadata.type);
  const compatibleOperators = OPERATOR_COMPATIBILITY[category];

  return compatibleOperators.includes(operator);
}

/**
 * Get compatible operators for a column type
 */
export function getCompatibleOperators(
  columnMetadata: ColumnMetadata | undefined
): FilterOperator[] {
  if (!columnMetadata) return OPERATOR_COMPATIBILITY.unknown;

  const category = categorizeColumnType(columnMetadata.type);
  return OPERATOR_COMPATIBILITY[category];
}

/**
 * Validate a filter condition
 */
export interface FilterValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateFilter(
  filter: FilterCondition,
  columnMetadata: ColumnMetadata | undefined
): FilterValidationResult {
  // Check if column exists
  if (!filter.columnName) {
    return { isValid: false, error: 'Column name is required' };
  }

  // Check if operator is valid
  if (!isOperatorCompatible(filter.operator, columnMetadata)) {
    const category = categorizeColumnType(columnMetadata?.type);
    return {
      isValid: false,
      error: `Operator "${filter.operator}" is not compatible with ${category} column type`,
    };
  }

  // Check if value is provided (except for null operators)
  if (filter.operator !== 'is_null' && filter.operator !== 'is_not_null') {
    if (filter.value === '' || filter.value === undefined || filter.value === null) {
      return { isValid: false, error: 'Value is required for this operator' };
    }
  }

  // Validate value format for specific operators
  if (filter.operator === 'between') {
    // BETWEEN expects value and value2 to be set separately
    // Check if value2 is provided (the correct way builders expect it)
    if (filter.value2 === undefined || filter.value2 === null || filter.value2 === '') {
      return { isValid: false, error: 'Between operator requires both start and end values' };
    }
  }

  if (filter.operator === 'in') {
    const value = String(filter.value).trim();
    if (!value) {
      return { isValid: false, error: 'In operator requires at least one value' };
    }
  }

  return { isValid: true };
}

/**
 * Validate all filters and return results
 */
export function validateFilters(
  filters: FilterCondition[],
  columnsMetadata: ColumnMetadata[]
): { validFilters: FilterCondition[]; errors: string[] } {
  const validFilters: FilterCondition[] = [];
  const errors: string[] = [];

  for (const filter of filters) {
    const columnMeta = columnsMetadata.find(c => c.name === filter.columnName);
    const result = validateFilter(filter, columnMeta);

    if (result.isValid) {
      validFilters.push(filter);
    } else if (result.error) {
      errors.push(`${filter.columnName}: ${result.error}`);
    }
  }

  return { validFilters, errors };
}
