/**
 * Filter Operators - Re-exports from @dbview/core with UI-specific additions
 */

import type { FilterOperator, PostgreSQLType } from '@dbview/types';

// Re-export from @dbview/core
export {
  STRING_OPERATORS,
  NUMERIC_OPERATORS,
  DATE_OPERATORS,
  BOOLEAN_OPERATORS,
  OPERATOR_LABELS,
  getOperatorsForType,
  operatorNeedsValue,
  operatorNeedsTwoValues,
  operatorNeedsCommaSeparated,
} from '@dbview/core';

// UI-specific: Filter function factory for TanStack Table
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

// UI-specific: Global filter function for quick search across all columns
export function globalFilterFn(row: any, columnId: string, filterValue: string): boolean {
  const searchValue = String(filterValue).toLowerCase();
  const cellValue = row.getValue(columnId);
  if (cellValue != null) {
    return String(cellValue).toLowerCase().includes(searchValue);
  }
  return false;
}
