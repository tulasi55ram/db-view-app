import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateFilter,
  validateFilters,
  areFiltersValid,
  getFilterErrors,
  normalizeFilter,
  createFilter,
  isFilterEmpty,
  removeEmptyFilters
} from './validateFilter.js';
import type { FilterCondition } from '@dbview/types';

describe('validateFilter', () => {
  it('should validate a complete filter', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'age',
      operator: 'greater_than',
      value: 18
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalizedFilter).toBeDefined();
  });

  it('should fail without id', () => {
    const filter = {
      id: '',
      columnName: 'age',
      operator: 'greater_than',
      value: 18
    } as FilterCondition;
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filter must have an id');
  });

  it('should fail without columnName', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: '',
      operator: 'equals',
      value: 'test'
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Column name is required');
  });

  it('should fail with whitespace-only columnName', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: '   ',
      operator: 'equals',
      value: 'test'
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Column name is required');
  });

  it('should fail without operator', () => {
    const filter = {
      id: '1',
      columnName: 'age',
      operator: '',
      value: 18
    } as FilterCondition;
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Operator is required');
  });

  it('should fail with invalid operator', () => {
    const filter = {
      id: '1',
      columnName: 'age',
      operator: 'invalid_op',
      value: 18
    } as FilterCondition;
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid operator: invalid_op');
  });

  it('should fail when value is required but missing', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'contains',
      value: undefined as any
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Operator 'contains' requires a value");
  });

  it('should fail when value is empty string for contains', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'contains',
      value: '   '
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Value cannot be empty for operator 'contains'");
  });

  it('should allow empty string for equals operator', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'equals',
      value: ''
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(true);
  });

  it('should not require value for is_null', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'deleted_at',
      operator: 'is_null',
      value: ''
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(true);
  });

  it('should fail when between is missing value2', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'price',
      operator: 'between',
      value: 10
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Operator 'between' requires a second value");
  });

  it('should pass when between has value2', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'price',
      operator: 'between',
      value: 10,
      value2: 100
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(true);
  });

  it('should fail when in has empty values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'status',
      operator: 'in',
      value: ''
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('IN operator requires at least one value');
  });

  it('should fail when in has only whitespace values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'status',
      operator: 'in',
      value: '  ,  ,  '
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('IN operator requires at least one value');
  });

  it('should pass when in has valid values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'status',
      operator: 'in',
      value: 'a, b, c'
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(true);
  });

  it('should pass when in has array values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'status',
      operator: 'in',
      value: ['a', 'b', 'c']
    };
    const result = validateFilter(filter);
    expect(result.valid).toBe(true);
  });
});

describe('validateFilters', () => {
  it('should validate array of filters', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
      { id: '2', columnName: '', operator: 'equals', value: 'test' }
    ];
    const results = validateFilters(filters);
    expect(results).toHaveLength(2);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
  });

  it('should return empty array for empty input', () => {
    const results = validateFilters([]);
    expect(results).toHaveLength(0);
  });
});

describe('areFiltersValid', () => {
  it('should return true when all filters are valid', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
      { id: '2', columnName: 'name', operator: 'equals', value: 'John' }
    ];
    expect(areFiltersValid(filters)).toBe(true);
  });

  it('should return false when any filter is invalid', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
      { id: '2', columnName: '', operator: 'equals', value: 'John' }
    ];
    expect(areFiltersValid(filters)).toBe(false);
  });

  it('should return true for empty array', () => {
    expect(areFiltersValid([])).toBe(true);
  });
});

describe('getFilterErrors', () => {
  it('should return errors with context', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'age', operator: 'between', value: 10 },
      { id: '2', columnName: '', operator: 'equals', value: 'test' }
    ];
    const errors = getFilterErrors(filters);
    expect(errors).toContain("age: Operator 'between' requires a second value");
    expect(errors).toContain('Filter 2: Column name is required');
  });

  it('should return empty array for valid filters', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
    ];
    expect(getFilterErrors(filters)).toHaveLength(0);
  });
});

describe('normalizeFilter', () => {
  it('should trim string values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: '  name  ',
      operator: 'equals',
      value: '  John  '
    };
    const normalized = normalizeFilter(filter);
    expect(normalized.columnName).toBe('name');
    expect(normalized.value).toBe('John');
  });

  it('should trim value2 if present', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'price',
      operator: 'between',
      value: 10,
      value2: '  100  '
    };
    const normalized = normalizeFilter(filter);
    expect(normalized.value2).toBe('100');
  });

  it('should convert in value string to array', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'status',
      operator: 'in',
      value: ' a , b , c '
    };
    const normalized = normalizeFilter(filter);
    expect(normalized.value).toEqual(['a', 'b', 'c']);
  });

  it('should preserve non-string values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'count',
      operator: 'equals',
      value: 42
    };
    const normalized = normalizeFilter(filter);
    expect(normalized.value).toBe(42);
  });
});

describe('createFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create filter with columnName and default operator', () => {
    const filter = createFilter('name');
    expect(filter.columnName).toBe('name');
    expect(filter.operator).toBe('equals');
    expect(filter.value).toBe('');
    expect(filter.id).toMatch(/^filter_\d+_[a-z0-9]+$/);
  });

  it('should create filter with custom operator', () => {
    const filter = createFilter('age', 'greater_than');
    expect(filter.operator).toBe('greater_than');
  });

  it('should generate unique IDs', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const filter1 = createFilter('name1');
    const filter2 = createFilter('name2');
    expect(filter1.id).not.toBe(filter2.id);
  });
});

describe('isFilterEmpty', () => {
  it('should return false for operators that do not need values', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'deleted_at',
      operator: 'is_null',
      value: ''
    };
    expect(isFilterEmpty(filter)).toBe(false);
  });

  it('should return true for undefined value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'equals',
      value: undefined as any
    };
    expect(isFilterEmpty(filter)).toBe(true);
  });

  it('should return true for null value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'equals',
      value: null as any
    };
    expect(isFilterEmpty(filter)).toBe(true);
  });

  it('should return true for empty string value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'contains',
      value: ''
    };
    expect(isFilterEmpty(filter)).toBe(true);
  });

  it('should return true for whitespace-only value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'equals',
      value: '   '
    };
    expect(isFilterEmpty(filter)).toBe(true);
  });

  it('should return true for empty array value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'status',
      operator: 'in',
      value: []
    };
    expect(isFilterEmpty(filter)).toBe(true);
  });

  it('should return false for non-empty value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'name',
      operator: 'equals',
      value: 'John'
    };
    expect(isFilterEmpty(filter)).toBe(false);
  });

  it('should return false for numeric value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'count',
      operator: 'equals',
      value: 0
    };
    expect(isFilterEmpty(filter)).toBe(false);
  });

  it('should return false for false boolean value', () => {
    const filter: FilterCondition = {
      id: '1',
      columnName: 'active',
      operator: 'equals',
      value: false
    };
    expect(isFilterEmpty(filter)).toBe(false);
  });
});

describe('removeEmptyFilters', () => {
  it('should remove empty filters', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: '' },
      { id: '2', columnName: 'age', operator: 'greater_than', value: 18 },
      { id: '3', columnName: 'status', operator: 'in', value: [] },
      { id: '4', columnName: 'deleted', operator: 'is_null', value: '' }
    ];
    const result = removeEmptyFilters(filters);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('4');
  });

  it('should return empty array for all empty filters', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: '' },
      { id: '2', columnName: 'email', operator: 'contains', value: '   ' }
    ];
    expect(removeEmptyFilters(filters)).toHaveLength(0);
  });

  it('should return same filters if none are empty', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: 'John' },
      { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
    ];
    const result = removeEmptyFilters(filters);
    expect(result).toHaveLength(2);
  });
});
