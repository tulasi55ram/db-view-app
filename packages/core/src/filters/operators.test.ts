import { describe, it, expect } from 'vitest';
import {
  OPERATOR_METADATA,
  STRING_OPERATORS,
  NUMERIC_OPERATORS,
  DATE_OPERATORS,
  BOOLEAN_OPERATORS,
  ALL_OPERATORS,
  OPERATOR_LABELS,
  getOperatorsForType,
  getOperatorMetadata,
  operatorNeedsValue,
  operatorNeedsTwoValues,
  operatorNeedsCommaSeparated,
  isOperatorValidForType
} from './operators.js';

describe('OPERATOR_METADATA', () => {
  it('should have metadata for all operators', () => {
    expect(Object.keys(OPERATOR_METADATA)).toHaveLength(14);
    expect(OPERATOR_METADATA.equals).toBeDefined();
    expect(OPERATOR_METADATA.not_equals).toBeDefined();
    expect(OPERATOR_METADATA.contains).toBeDefined();
    expect(OPERATOR_METADATA.not_contains).toBeDefined();
    expect(OPERATOR_METADATA.starts_with).toBeDefined();
    expect(OPERATOR_METADATA.ends_with).toBeDefined();
    expect(OPERATOR_METADATA.greater_than).toBeDefined();
    expect(OPERATOR_METADATA.less_than).toBeDefined();
    expect(OPERATOR_METADATA.greater_or_equal).toBeDefined();
    expect(OPERATOR_METADATA.less_or_equal).toBeDefined();
    expect(OPERATOR_METADATA.is_null).toBeDefined();
    expect(OPERATOR_METADATA.is_not_null).toBeDefined();
    expect(OPERATOR_METADATA.in).toBeDefined();
    expect(OPERATOR_METADATA.between).toBeDefined();
  });

  it('should have correct needsValue for is_null and is_not_null', () => {
    expect(OPERATOR_METADATA.is_null.needsValue).toBe(false);
    expect(OPERATOR_METADATA.is_not_null.needsValue).toBe(false);
  });

  it('should have correct needsTwoValues for between', () => {
    expect(OPERATOR_METADATA.between.needsTwoValues).toBe(true);
    expect(OPERATOR_METADATA.equals.needsTwoValues).toBe(false);
  });

  it('should have correct needsCommaSeparated for in', () => {
    expect(OPERATOR_METADATA.in.needsCommaSeparated).toBe(true);
    expect(OPERATOR_METADATA.equals.needsCommaSeparated).toBe(false);
  });
});

describe('Operator type lists', () => {
  it('STRING_OPERATORS should have correct operators', () => {
    expect(STRING_OPERATORS).toContain('equals');
    expect(STRING_OPERATORS).toContain('not_equals');
    expect(STRING_OPERATORS).toContain('contains');
    expect(STRING_OPERATORS).toContain('not_contains');
    expect(STRING_OPERATORS).toContain('starts_with');
    expect(STRING_OPERATORS).toContain('ends_with');
    expect(STRING_OPERATORS).toContain('in');
    expect(STRING_OPERATORS).toContain('is_null');
    expect(STRING_OPERATORS).toContain('is_not_null');
    expect(STRING_OPERATORS).not.toContain('between');
    expect(STRING_OPERATORS).not.toContain('greater_than');
  });

  it('NUMERIC_OPERATORS should have correct operators', () => {
    expect(NUMERIC_OPERATORS).toContain('equals');
    expect(NUMERIC_OPERATORS).toContain('greater_than');
    expect(NUMERIC_OPERATORS).toContain('less_than');
    expect(NUMERIC_OPERATORS).toContain('greater_or_equal');
    expect(NUMERIC_OPERATORS).toContain('less_or_equal');
    expect(NUMERIC_OPERATORS).toContain('between');
    expect(NUMERIC_OPERATORS).toContain('in');
    expect(NUMERIC_OPERATORS).not.toContain('contains');
    expect(NUMERIC_OPERATORS).not.toContain('starts_with');
  });

  it('DATE_OPERATORS should have correct operators', () => {
    expect(DATE_OPERATORS).toContain('equals');
    expect(DATE_OPERATORS).toContain('greater_than');
    expect(DATE_OPERATORS).toContain('between');
    expect(DATE_OPERATORS).toContain('is_null');
    expect(DATE_OPERATORS).not.toContain('contains');
    expect(DATE_OPERATORS).not.toContain('in');
  });

  it('BOOLEAN_OPERATORS should have limited operators', () => {
    expect(BOOLEAN_OPERATORS).toContain('equals');
    expect(BOOLEAN_OPERATORS).toContain('is_null');
    expect(BOOLEAN_OPERATORS).toContain('is_not_null');
    expect(BOOLEAN_OPERATORS).not.toContain('contains');
    expect(BOOLEAN_OPERATORS).not.toContain('greater_than');
    expect(BOOLEAN_OPERATORS).not.toContain('in');
  });

  it('ALL_OPERATORS should have all operators', () => {
    expect(ALL_OPERATORS).toHaveLength(14);
  });
});

describe('OPERATOR_LABELS', () => {
  it('should have labels for all operators', () => {
    expect(OPERATOR_LABELS.equals).toBe('Equals');
    expect(OPERATOR_LABELS.not_equals).toBe('Not Equals');
    expect(OPERATOR_LABELS.contains).toBe('Contains');
    expect(OPERATOR_LABELS.is_null).toBe('Is NULL');
    expect(OPERATOR_LABELS.is_not_null).toBe('Is Not NULL');
    expect(OPERATOR_LABELS.in).toBe('In List');
    expect(OPERATOR_LABELS.between).toBe('Between');
  });
});

describe('getOperatorsForType', () => {
  it('should return NUMERIC_OPERATORS for integer types', () => {
    expect(getOperatorsForType('integer')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('int')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('bigint')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('smallint')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('tinyint')).toEqual(NUMERIC_OPERATORS);
  });

  it('should return NUMERIC_OPERATORS for decimal types', () => {
    expect(getOperatorsForType('numeric')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('decimal')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('real')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('double')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('float')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('double precision')).toEqual(NUMERIC_OPERATORS);
  });

  it('should return NUMERIC_OPERATORS for money type', () => {
    expect(getOperatorsForType('money')).toEqual(NUMERIC_OPERATORS);
  });

  it('should return DATE_OPERATORS for date/time types', () => {
    expect(getOperatorsForType('date')).toEqual(DATE_OPERATORS);
    expect(getOperatorsForType('time')).toEqual(DATE_OPERATORS);
    expect(getOperatorsForType('timestamp')).toEqual(DATE_OPERATORS);
    expect(getOperatorsForType('datetime')).toEqual(DATE_OPERATORS);
    expect(getOperatorsForType('datetime2')).toEqual(DATE_OPERATORS);
    expect(getOperatorsForType('smalldatetime')).toEqual(DATE_OPERATORS);
    expect(getOperatorsForType('timestamp with time zone')).toEqual(DATE_OPERATORS);
  });

  it('should return BOOLEAN_OPERATORS for boolean types', () => {
    expect(getOperatorsForType('boolean')).toEqual(BOOLEAN_OPERATORS);
    expect(getOperatorsForType('bool')).toEqual(BOOLEAN_OPERATORS);
    expect(getOperatorsForType('bit')).toEqual(BOOLEAN_OPERATORS);
  });

  it('should return STRING_OPERATORS for string types', () => {
    expect(getOperatorsForType('varchar')).toEqual(STRING_OPERATORS);
    expect(getOperatorsForType('text')).toEqual(STRING_OPERATORS);
    expect(getOperatorsForType('char')).toEqual(STRING_OPERATORS);
    expect(getOperatorsForType('nvarchar')).toEqual(STRING_OPERATORS);
    expect(getOperatorsForType('string')).toEqual(STRING_OPERATORS);
  });

  it('should return STRING_OPERATORS for unknown types', () => {
    expect(getOperatorsForType('unknown')).toEqual(STRING_OPERATORS);
    expect(getOperatorsForType('custom_type')).toEqual(STRING_OPERATORS);
  });

  it('should be case insensitive', () => {
    expect(getOperatorsForType('INTEGER')).toEqual(NUMERIC_OPERATORS);
    expect(getOperatorsForType('VARCHAR')).toEqual(STRING_OPERATORS);
    expect(getOperatorsForType('BOOLEAN')).toEqual(BOOLEAN_OPERATORS);
  });
});

describe('getOperatorMetadata', () => {
  it('should return metadata for operator', () => {
    const meta = getOperatorMetadata('equals');
    expect(meta.label).toBe('Equals');
    expect(meta.needsValue).toBe(true);
    expect(meta.needsTwoValues).toBe(false);
  });

  it('should return correct metadata for between', () => {
    const meta = getOperatorMetadata('between');
    expect(meta.needsTwoValues).toBe(true);
    expect(meta.applicableTypes).toContain('number');
    expect(meta.applicableTypes).toContain('date');
  });
});

describe('operatorNeedsValue', () => {
  it('should return true for operators that need values', () => {
    expect(operatorNeedsValue('equals')).toBe(true);
    expect(operatorNeedsValue('contains')).toBe(true);
    expect(operatorNeedsValue('greater_than')).toBe(true);
    expect(operatorNeedsValue('in')).toBe(true);
  });

  it('should return false for null operators', () => {
    expect(operatorNeedsValue('is_null')).toBe(false);
    expect(operatorNeedsValue('is_not_null')).toBe(false);
  });
});

describe('operatorNeedsTwoValues', () => {
  it('should return true only for between', () => {
    expect(operatorNeedsTwoValues('between')).toBe(true);
    expect(operatorNeedsTwoValues('equals')).toBe(false);
    expect(operatorNeedsTwoValues('in')).toBe(false);
  });
});

describe('operatorNeedsCommaSeparated', () => {
  it('should return true only for in', () => {
    expect(operatorNeedsCommaSeparated('in')).toBe(true);
    expect(operatorNeedsCommaSeparated('equals')).toBe(false);
    expect(operatorNeedsCommaSeparated('between')).toBe(false);
  });
});

describe('isOperatorValidForType', () => {
  it('should validate string operators', () => {
    expect(isOperatorValidForType('contains', 'varchar')).toBe(true);
    expect(isOperatorValidForType('starts_with', 'text')).toBe(true);
    expect(isOperatorValidForType('greater_than', 'varchar')).toBe(false);
  });

  it('should validate numeric operators', () => {
    expect(isOperatorValidForType('greater_than', 'integer')).toBe(true);
    expect(isOperatorValidForType('between', 'decimal')).toBe(true);
    expect(isOperatorValidForType('contains', 'integer')).toBe(false);
  });

  it('should validate date operators', () => {
    expect(isOperatorValidForType('greater_than', 'timestamp')).toBe(true);
    expect(isOperatorValidForType('between', 'date')).toBe(true);
    expect(isOperatorValidForType('contains', 'datetime')).toBe(false);
  });

  it('should validate boolean operators', () => {
    expect(isOperatorValidForType('equals', 'boolean')).toBe(true);
    expect(isOperatorValidForType('is_null', 'bool')).toBe(true);
    expect(isOperatorValidForType('greater_than', 'boolean')).toBe(false);
    expect(isOperatorValidForType('contains', 'bool')).toBe(false);
  });
});
