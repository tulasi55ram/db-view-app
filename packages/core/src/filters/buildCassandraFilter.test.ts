import { describe, it, expect, vi } from 'vitest';
import { buildCassandraFilter, needsAllowFiltering } from './buildCassandraFilter.js';
import type { FilterCondition } from '@dbview/types';

describe('buildCassandraFilter', () => {
  describe('basic operators', () => {
    it('should build equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'user_id', operator: 'equals', value: 'abc123' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"user_id" = ?');
      expect(result.params).toEqual(['abc123']);
    });

    it('should build not_equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'not_equals', value: 'deleted' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"status" != ?');
      expect(result.params).toEqual(['deleted']);
    });

    it('should build contains condition for collections', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'tags', operator: 'contains', value: 'important' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"tags" CONTAINS ?');
      expect(result.params).toEqual(['important']);
    });

    it('should build starts_with condition with LIKE', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'starts_with', value: 'John' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"name" LIKE ?');
      expect(result.params).toEqual(['John%']);
    });

    it('should build ends_with condition with LIKE', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'ends_with', value: '@gmail.com' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"email" LIKE ?');
      expect(result.params).toEqual(['%@gmail.com']);
    });
  });

  describe('comparison operators', () => {
    it('should build greater_than condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: 'greater_than', value: 18 }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"age" > ?');
      expect(result.params).toEqual([18]);
    });

    it('should build less_than condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'count', operator: 'less_than', value: 100 }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"count" < ?');
      expect(result.params).toEqual([100]);
    });

    it('should build greater_or_equal condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'score', operator: 'greater_or_equal', value: 90 }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"score" >= ?');
      expect(result.params).toEqual([90]);
    });

    it('should build less_or_equal condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'less_or_equal', value: 50 }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"price" <= ?');
      expect(result.params).toEqual([50]);
    });
  });

  describe('null operators', () => {
    it('should build is_null condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'deleted_at', operator: 'is_null', value: '' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"deleted_at" = NULL');
      expect(result.params).toEqual([]);
    });

    it('should build is_not_null condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'is_not_null', value: '' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"email" != NULL');
      expect(result.params).toEqual([]);
    });
  });

  describe('between operator', () => {
    it('should build between as two conditions', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'timestamp', operator: 'between', value: '2024-01-01', value2: '2024-12-31' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"timestamp" >= ? AND "timestamp" <= ?');
      expect(result.params).toEqual(['2024-01-01', '2024-12-31']);
    });

    it('should skip between without value2', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'between', value: 10 }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
    });
  });

  describe('in operator', () => {
    it('should build in condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'in', value: 'active, pending' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"status" IN (?, ?)');
      expect(result.params).toEqual(['active', 'pending']);
    });

    it('should build in condition with array values', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'id', operator: 'in', value: ['a', 'b', 'c'] }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"id" IN (?, ?, ?)');
      expect(result.params).toEqual(['a', 'b', 'c']);
    });
  });

  describe('multiple conditions', () => {
    it('should join with AND by default', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'user_id', operator: 'equals', value: 'abc' },
        { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"user_id" = ? AND "age" > ?');
      expect(result.params).toEqual(['abc', 18]);
    });

    it('should warn for OR logic', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'equals', value: 'a' },
        { id: '2', columnName: 'status', operator: 'equals', value: 'b' }
      ];
      buildCassandraFilter(filters, 'OR');
      expect(warnSpy).toHaveBeenCalledWith(
        'Cassandra does not natively support OR in WHERE clauses. Results may require ALLOW FILTERING or multiple queries.'
      );
      warnSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should return empty for empty filters', () => {
      const result = buildCassandraFilter([]);
      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should skip filters without columnName', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: '', operator: 'equals', value: 'test' },
        { id: '2', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"name" = ?');
    });

    it('should warn and skip not_contains operator', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'tags', operator: 'not_contains', value: 'spam' }
      ];
      const result = buildCassandraFilter(filters);
      expect(warnSpy).toHaveBeenCalledWith(
        'Cassandra does not support NOT CONTAINS. Filter will be applied client-side.'
      );
      expect(result.whereClause).toBe('');
      warnSpy.mockRestore();
    });

    it('should escape quotes in identifiers', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'user"name', operator: 'equals', value: 'John' }
      ];
      const result = buildCassandraFilter(filters);
      expect(result.whereClause).toBe('"user""name" = ?');
    });
  });
});

describe('needsAllowFiltering', () => {
  it('should return false for empty filters', () => {
    expect(needsAllowFiltering([])).toBe(false);
  });

  it('should return false for equals operator', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'id', operator: 'equals', value: '123' }
    ];
    expect(needsAllowFiltering(filters)).toBe(false);
  });

  it('should return true for comparison operators', () => {
    const operators = ['greater_than', 'less_than', 'greater_or_equal', 'less_or_equal'];
    for (const op of operators) {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: op as any, value: 18 }
      ];
      expect(needsAllowFiltering(filters)).toBe(true);
    }
  });

  it('should return true for text search operators', () => {
    const operators = ['contains', 'not_contains', 'starts_with', 'ends_with'];
    for (const op of operators) {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: op as any, value: 'test' }
      ];
      expect(needsAllowFiltering(filters)).toBe(true);
    }
  });

  it('should return true for between operator', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'price', operator: 'between', value: 10, value2: 100 }
    ];
    expect(needsAllowFiltering(filters)).toBe(true);
  });

  it('should return true for not_equals operator', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'status', operator: 'not_equals', value: 'deleted' }
    ];
    expect(needsAllowFiltering(filters)).toBe(true);
  });

  it('should return false for is_null/is_not_null operators', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'email', operator: 'is_null', value: '' }
    ];
    expect(needsAllowFiltering(filters)).toBe(false);
  });

  it('should return false for in operator', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'id', operator: 'in', value: 'a, b, c' }
    ];
    expect(needsAllowFiltering(filters)).toBe(false);
  });

  it('should return true if any filter requires filtering', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'id', operator: 'equals', value: '123' },
      { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
    ];
    expect(needsAllowFiltering(filters)).toBe(true);
  });
});
