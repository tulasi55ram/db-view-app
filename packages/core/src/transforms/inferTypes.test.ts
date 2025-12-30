import { describe, it, expect } from 'vitest';
import {
  detectValueType,
  getTypeLabel,
  isPrimitive,
  isContainer,
  inferColumnType,
  formatValueForDisplay,
} from './inferTypes.js';

describe('detectValueType', () => {
  it('should detect string', () => {
    expect(detectValueType('hello')).toBe('string');
  });

  it('should detect number', () => {
    expect(detectValueType(42)).toBe('number');
    expect(detectValueType(3.14)).toBe('number');
  });

  it('should detect boolean', () => {
    expect(detectValueType(true)).toBe('boolean');
    expect(detectValueType(false)).toBe('boolean');
  });

  it('should detect null', () => {
    expect(detectValueType(null)).toBe('null');
  });

  it('should detect undefined', () => {
    expect(detectValueType(undefined)).toBe('undefined');
  });

  it('should detect array', () => {
    expect(detectValueType([1, 2, 3])).toBe('array');
    expect(detectValueType([])).toBe('array');
  });

  it('should detect object', () => {
    expect(detectValueType({ a: 1 })).toBe('object');
    expect(detectValueType({})).toBe('object');
  });

  it('should detect Date', () => {
    expect(detectValueType(new Date())).toBe('date');
  });

  it('should detect ObjectId pattern', () => {
    expect(detectValueType('507f1f77bcf86cd799439011')).toBe('objectId');
  });

  it('should detect ISO date string', () => {
    expect(detectValueType('2024-01-15T10:30:00Z')).toBe('date');
    expect(detectValueType('2024-01-15')).toBe('date');
  });

  it('should detect MongoDB $oid format', () => {
    expect(detectValueType({ $oid: '507f1f77bcf86cd799439011' })).toBe('objectId');
  });

  it('should detect MongoDB $date format', () => {
    expect(detectValueType({ $date: '2024-01-15' })).toBe('date');
  });
});

describe('getTypeLabel', () => {
  it('should return human-readable labels', () => {
    expect(getTypeLabel('string')).toBe('String');
    expect(getTypeLabel('number')).toBe('Number');
    expect(getTypeLabel('boolean')).toBe('Boolean');
    expect(getTypeLabel('object')).toBe('Object');
    expect(getTypeLabel('array')).toBe('Array');
    expect(getTypeLabel('date')).toBe('Date');
    expect(getTypeLabel('objectId')).toBe('ObjectId');
  });
});

describe('isPrimitive', () => {
  it('should return true for primitive values', () => {
    expect(isPrimitive('hello')).toBe(true);
    expect(isPrimitive(42)).toBe(true);
    expect(isPrimitive(true)).toBe(true);
    expect(isPrimitive(null)).toBe(true);
    expect(isPrimitive(new Date())).toBe(true);
  });

  it('should return false for containers', () => {
    expect(isPrimitive({ a: 1 })).toBe(false);
    expect(isPrimitive([1, 2, 3])).toBe(false);
  });
});

describe('isContainer', () => {
  it('should return true for objects and arrays', () => {
    expect(isContainer({ a: 1 })).toBe(true);
    expect(isContainer([1, 2, 3])).toBe(true);
  });

  it('should return false for primitives', () => {
    expect(isContainer('hello')).toBe(false);
    expect(isContainer(42)).toBe(false);
    expect(isContainer(null)).toBe(false);
  });
});

describe('inferColumnType', () => {
  it('should infer number type', () => {
    const result = inferColumnType([1, 2, 3, 4, 5]);
    expect(result.primaryType).toBe('number');
    expect(result.hasNulls).toBe(false);
  });

  it('should handle mixed types with nulls', () => {
    const result = inferColumnType([1, 2, null, 4, 5]);
    expect(result.primaryType).toBe('number');
    expect(result.hasNulls).toBe(true);
    expect(result.seenTypes.has('null')).toBe(true);
    expect(result.seenTypes.has('number')).toBe(true);
  });

  it('should detect date-like strings', () => {
    const result = inferColumnType([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03'
    ]);
    expect(result.isLikelyDate).toBe(true);
  });

  it('should detect JSON-like strings', () => {
    const result = inferColumnType([
      '{"a": 1}',
      '{"b": 2}',
      '{"c": 3}'
    ]);
    expect(result.isLikelyJson).toBe(true);
  });

  it('should provide sample values', () => {
    const result = inferColumnType(['a', 'b', 'c']);
    expect(result.sampleValues).toEqual(['a', 'b', 'c']);
  });

  it('should limit sample values to 5', () => {
    const values = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = inferColumnType(values);
    expect(result.sampleValues.length).toBe(5);
  });
});

describe('formatValueForDisplay', () => {
  it('should format null', () => {
    expect(formatValueForDisplay(null)).toBe('null');
  });

  it('should format undefined', () => {
    expect(formatValueForDisplay(undefined)).toBe('undefined');
  });

  it('should format strings with quotes', () => {
    expect(formatValueForDisplay('hello')).toBe('"hello"');
  });

  it('should truncate long strings', () => {
    const longString = 'a'.repeat(150);
    const result = formatValueForDisplay(longString);
    expect(result.length).toBeLessThan(150);
    expect(result.endsWith('..."')).toBe(true);
  });

  it('should format numbers', () => {
    expect(formatValueForDisplay(42)).toBe('42');
    expect(formatValueForDisplay(3.14)).toBe('3.14');
  });

  it('should format booleans', () => {
    expect(formatValueForDisplay(true)).toBe('true');
    expect(formatValueForDisplay(false)).toBe('false');
  });

  it('should format arrays with count', () => {
    expect(formatValueForDisplay([1, 2, 3])).toBe('Array(3)');
  });

  it('should format objects with key count', () => {
    expect(formatValueForDisplay({ a: 1, b: 2 })).toBe('Object(2 keys)');
  });

  it('should format dates', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = formatValueForDisplay(date);
    expect(result).toContain('2024-01-15');
  });

  it('should format ObjectId-like objects', () => {
    const objectId = { $oid: '507f1f77bcf86cd799439011' };
    const result = formatValueForDisplay(objectId);
    expect(result).toContain('507f1f77bcf86cd799439011');
  });
});
