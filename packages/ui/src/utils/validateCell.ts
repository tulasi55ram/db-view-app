import type { ColumnMetadata } from '@dbview/core';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: unknown;
}

/**
 * Validates a cell value based on column metadata
 */
export function validateCellValue(
  rawValue: string,
  column: ColumnMetadata
): ValidationResult {
  // Handle empty values
  if (rawValue === '') {
    if (column.nullable) {
      return { valid: true, value: null };
    } else {
      return { valid: false, error: `${column.name} cannot be NULL` };
    }
  }

  const trimmedValue = rawValue.trim();

  // Validate integers
  if (column.type === 'integer' || column.type === 'bigint' || column.type === 'smallint') {
    const parsed = parseInt(trimmedValue, 10);
    if (isNaN(parsed) || trimmedValue !== String(parsed)) {
      return {
        valid: false,
        error: `Invalid integer value: "${rawValue}". Please enter a valid integer.`
      };
    }
    return { valid: true, value: parsed };
  }

  // Validate numeric types
  if (
    column.type === 'numeric' ||
    column.type === 'decimal' ||
    column.type === 'real' ||
    column.type === 'double precision'
  ) {
    const parsed = parseFloat(trimmedValue);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Invalid numeric value: "${rawValue}". Please enter a valid number.`
      };
    }
    return { valid: true, value: parsed };
  }

  // Validate JSON
  if (column.type === 'json' || column.type === 'jsonb') {
    try {
      const parsed = JSON.parse(rawValue);
      return { valid: true, value: parsed };
    } catch (err) {
      return {
        valid: false,
        error: `Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`
      };
    }
  }

  // Validate max length for text types
  if (column.maxLength && rawValue.length > column.maxLength) {
    return {
      valid: false,
      error: `Value exceeds maximum length of ${column.maxLength} characters`
    };
  }

  // Default: accept the raw value
  return { valid: true, value: rawValue };
}
