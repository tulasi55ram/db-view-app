/**
 * Filter operator definitions and utilities
 *
 * Provides operator metadata, type-based operator lists,
 * and utility functions for working with filter operators.
 */

import type { FilterOperator } from '@dbview/types';
import type { OperatorMetadata } from './types.js';

/**
 * Complete operator metadata registry
 */
export const OPERATOR_METADATA: Record<FilterOperator, OperatorMetadata> = {
  equals: {
    label: 'Equals',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['string', 'number', 'date', 'boolean', 'any'],
  },
  not_equals: {
    label: 'Not Equals',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['string', 'number', 'date', 'boolean', 'any'],
  },
  contains: {
    label: 'Contains',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['string'],
  },
  not_contains: {
    label: 'Does Not Contain',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['string'],
  },
  starts_with: {
    label: 'Starts With',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['string'],
  },
  ends_with: {
    label: 'Ends With',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['string'],
  },
  greater_than: {
    label: 'Greater Than',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['number', 'date'],
  },
  less_than: {
    label: 'Less Than',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['number', 'date'],
  },
  greater_or_equal: {
    label: 'Greater or Equal',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['number', 'date'],
  },
  less_or_equal: {
    label: 'Less or Equal',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['number', 'date'],
  },
  is_null: {
    label: 'Is NULL',
    needsValue: false,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['any'],
  },
  is_not_null: {
    label: 'Is Not NULL',
    needsValue: false,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ['any'],
  },
  in: {
    label: 'In List',
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: true,
    applicableTypes: ['string', 'number'],
  },
  between: {
    label: 'Between',
    needsValue: true,
    needsTwoValues: true,
    needsCommaSeparated: false,
    applicableTypes: ['number', 'date'],
  },
};

/**
 * Operators applicable to string columns
 */
export const STRING_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'in', 'is_null', 'is_not_null'
];

/**
 * Operators applicable to numeric columns
 */
export const NUMERIC_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'greater_or_equal', 'less_or_equal', 'between', 'in', 'is_null', 'is_not_null'
];

/**
 * Operators applicable to date/time columns
 */
export const DATE_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'greater_or_equal', 'less_or_equal', 'between', 'is_null', 'is_not_null'
];

/**
 * Operators applicable to boolean columns
 */
export const BOOLEAN_OPERATORS: FilterOperator[] = [
  'equals', 'is_null', 'is_not_null'
];

/**
 * All available operators
 */
export const ALL_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'greater_than', 'less_than',
  'greater_or_equal', 'less_or_equal', 'is_null', 'is_not_null',
  'in', 'between'
];

/**
 * Display labels for operators (convenience export)
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = Object.fromEntries(
  Object.entries(OPERATOR_METADATA).map(([op, meta]) => [op, meta.label])
) as Record<FilterOperator, string>;

/**
 * Gets the appropriate operators for a column data type.
 *
 * @param dataType - The column data type string
 * @returns Array of applicable operators
 *
 * @example
 * ```typescript
 * getOperatorsForType('integer'); // NUMERIC_OPERATORS
 * getOperatorsForType('varchar'); // STRING_OPERATORS
 * getOperatorsForType('timestamp'); // DATE_OPERATORS
 * ```
 */
export function getOperatorsForType(dataType: string): FilterOperator[] {
  const normalizedType = dataType.toLowerCase();

  // Numeric types
  if (
    normalizedType.includes('int') ||
    normalizedType.includes('numeric') ||
    normalizedType.includes('decimal') ||
    normalizedType.includes('real') ||
    normalizedType.includes('double') ||
    normalizedType.includes('float') ||
    normalizedType.includes('money') ||
    normalizedType === 'number' ||
    normalizedType === 'bigint' ||
    normalizedType === 'smallint' ||
    normalizedType === 'tinyint'
  ) {
    return NUMERIC_OPERATORS;
  }

  // Date/time types
  if (
    normalizedType.includes('date') ||
    normalizedType.includes('time') ||
    normalizedType.includes('timestamp') ||
    normalizedType === 'datetime' ||
    normalizedType === 'datetime2' ||
    normalizedType === 'smalldatetime'
  ) {
    return DATE_OPERATORS;
  }

  // Boolean type
  if (
    normalizedType === 'boolean' ||
    normalizedType === 'bool' ||
    normalizedType === 'bit'
  ) {
    return BOOLEAN_OPERATORS;
  }

  // Default to string operators
  return STRING_OPERATORS;
}

/**
 * Gets metadata for an operator.
 *
 * @param operator - The filter operator
 * @returns Operator metadata
 */
export function getOperatorMetadata(operator: FilterOperator): OperatorMetadata {
  return OPERATOR_METADATA[operator];
}

/**
 * Checks if an operator requires a value input.
 *
 * @param operator - The filter operator
 * @returns True if operator needs a value
 */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  return OPERATOR_METADATA[operator].needsValue;
}

/**
 * Checks if an operator requires two values (BETWEEN).
 *
 * @param operator - The filter operator
 * @returns True if operator needs two values
 */
export function operatorNeedsTwoValues(operator: FilterOperator): boolean {
  return OPERATOR_METADATA[operator].needsTwoValues;
}

/**
 * Checks if an operator expects comma-separated values (IN).
 *
 * @param operator - The filter operator
 * @returns True if operator needs comma-separated values
 */
export function operatorNeedsCommaSeparated(operator: FilterOperator): boolean {
  return OPERATOR_METADATA[operator].needsCommaSeparated;
}

/**
 * Checks if an operator is valid for a given data type.
 *
 * @param operator - The filter operator
 * @param dataType - The column data type
 * @returns True if operator is valid for the type
 */
export function isOperatorValidForType(operator: FilterOperator, dataType: string): boolean {
  const validOperators = getOperatorsForType(dataType);
  return validOperators.includes(operator);
}
