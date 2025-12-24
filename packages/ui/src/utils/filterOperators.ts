import type { FilterOperator, PostgreSQLType } from '@dbview/core';

// Type-aware operator lists
export const STRING_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'in', 'is_null', 'is_not_null'
];

export const NUMERIC_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'greater_or_equal', 'less_or_equal', 'between', 'in', 'is_null', 'is_not_null'
];

export const DATE_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'between', 'is_null', 'is_not_null'
];

export const BOOLEAN_OPERATORS: FilterOperator[] = [
  'equals', 'is_null', 'is_not_null'
];

// Get operators for a given column type
export function getOperatorsForType(type: PostgreSQLType): FilterOperator[] {
  const normalizedType = type.toLowerCase();

  // Numeric types
  if (normalizedType.includes('int') ||
      normalizedType.includes('numeric') ||
      normalizedType.includes('decimal') ||
      normalizedType.includes('real') ||
      normalizedType.includes('double')) {
    return NUMERIC_OPERATORS;
  }

  // Date/time types
  if (normalizedType.includes('date') ||
      normalizedType.includes('time') ||
      normalizedType.includes('timestamp')) {
    return DATE_OPERATORS;
  }

  // Boolean type
  if (normalizedType === 'boolean') {
    return BOOLEAN_OPERATORS;
  }

  // Default to string operators
  return STRING_OPERATORS;
}

// Operator display labels
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  'equals': 'Equals',
  'not_equals': 'Not Equals',
  'contains': 'Contains',
  'not_contains': 'Does Not Contain',
  'starts_with': 'Starts With',
  'ends_with': 'Ends With',
  'greater_than': 'Greater Than',
  'less_than': 'Less Than',
  'greater_or_equal': 'Greater or Equal',
  'less_or_equal': 'Less or Equal',
  'is_null': 'Is NULL',
  'is_not_null': 'Is Not NULL',
  'in': 'In List',
  'between': 'Between'
};

// Check if operator requires a value input
export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== 'is_null' && operator !== 'is_not_null';
}

// Check if operator requires two values (BETWEEN)
export function operatorNeedsTwoValues(operator: FilterOperator): boolean {
  return operator === 'between';
}

// Check if operator requires comma-separated values (IN)
export function operatorNeedsCommaSeparated(operator: FilterOperator): boolean {
  return operator === 'in';
}

// Filter function factory for TanStack Table
export function createFilterFn(operator: FilterOperator) {
  return (row: any, columnId: string, filterValue: any) => {
    const cellValue = row.getValue(columnId);

    switch (operator) {
      case 'equals':
        if (cellValue == null) return filterValue.value == null;
        return String(cellValue).toLowerCase() === String(filterValue.value).toLowerCase();

      case 'not_equals':
        if (cellValue == null) return filterValue.value != null;
        return String(cellValue).toLowerCase() !== String(filterValue.value).toLowerCase();

      case 'contains':
        if (cellValue == null) return false;
        return String(cellValue).toLowerCase().includes(String(filterValue.value).toLowerCase());

      case 'not_contains':
        if (cellValue == null) return true;
        return !String(cellValue).toLowerCase().includes(String(filterValue.value).toLowerCase());

      case 'starts_with':
        if (cellValue == null) return false;
        return String(cellValue).toLowerCase().startsWith(String(filterValue.value).toLowerCase());

      case 'ends_with':
        if (cellValue == null) return false;
        return String(cellValue).toLowerCase().endsWith(String(filterValue.value).toLowerCase());

      case 'greater_than':
        if (cellValue == null) return false;
        return Number(cellValue) > Number(filterValue.value);

      case 'less_than':
        if (cellValue == null) return false;
        return Number(cellValue) < Number(filterValue.value);

      case 'greater_or_equal':
        if (cellValue == null) return false;
        return Number(cellValue) >= Number(filterValue.value);

      case 'less_or_equal':
        if (cellValue == null) return false;
        return Number(cellValue) <= Number(filterValue.value);

      case 'is_null':
        return cellValue == null;

      case 'is_not_null':
        return cellValue != null;

      case 'between':
        if (cellValue == null) return false;
        const val = Number(cellValue);
        return val >= Number(filterValue.value) && val <= Number(filterValue.value2);

      case 'in':
        if (cellValue == null) return false;
        const values = String(filterValue.value).split(',').map(v => v.trim().toLowerCase());
        return values.includes(String(cellValue).toLowerCase());

      default:
        return true;
    }
  };
}

// Global filter function for quick search across all columns
export function globalFilterFn(row: any, columnId: string, filterValue: string): boolean {
  const searchValue = String(filterValue).toLowerCase();

  // Search in the specific column
  const cellValue = row.getValue(columnId);
  if (cellValue != null) {
    return String(cellValue).toLowerCase().includes(searchValue);
  }

  return false;
}
