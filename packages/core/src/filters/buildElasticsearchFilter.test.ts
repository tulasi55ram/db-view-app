import { describe, it, expect } from 'vitest';
import { buildElasticsearchFilter, buildElasticsearchSearchBody } from './buildElasticsearchFilter.js';
import type { FilterCondition } from '@dbview/types';

describe('buildElasticsearchFilter', () => {
  describe('basic operators', () => {
    it('should build equals condition with term', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'equals', value: 'active' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ term: { status: 'active' } }] }
      });
    });

    it('should build not_equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'not_equals', value: 'inactive' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ bool: { must_not: { term: { status: 'inactive' } } } }]
        }
      });
    });

    it('should build contains condition with wildcard', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'contains', value: 'john' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ wildcard: { name: { value: '*john*', case_insensitive: true } } }]
        }
      });
    });

    it('should build not_contains condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'not_contains', value: 'spam' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{
            bool: {
              must_not: { wildcard: { email: { value: '*spam*', case_insensitive: true } } }
            }
          }]
        }
      });
    });

    it('should build starts_with condition with prefix', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'starts_with', value: 'John' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ prefix: { name: { value: 'john', case_insensitive: true } } }]
        }
      });
    });

    it('should build ends_with condition with wildcard', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'file', operator: 'ends_with', value: '.pdf' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ wildcard: { file: { value: '*.pdf', case_insensitive: true } } }]
        }
      });
    });
  });

  describe('comparison operators', () => {
    it('should build greater_than condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: 'greater_than', value: 18 }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ range: { age: { gt: 18 } } }] }
      });
    });

    it('should build less_than condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'count', operator: 'less_than', value: 100 }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ range: { count: { lt: 100 } } }] }
      });
    });

    it('should build greater_or_equal condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'score', operator: 'greater_or_equal', value: 90 }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ range: { score: { gte: 90 } } }] }
      });
    });

    it('should build less_or_equal condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'less_or_equal', value: 50 }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ range: { price: { lte: 50 } } }] }
      });
    });
  });

  describe('null operators', () => {
    it('should build is_null condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'deletedAt', operator: 'is_null', value: '' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ bool: { must_not: { exists: { field: 'deletedAt' } } } }]
        }
      });
    });

    it('should build is_not_null condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'is_not_null', value: '' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ exists: { field: 'email' } }] }
      });
    });
  });

  describe('between operator', () => {
    it('should build between condition with range', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'between', value: 10, value2: 100 }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ range: { price: { gte: 10, lte: 100 } } }] }
      });
    });

    it('should skip between without value2', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'between', value: 10 }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({ bool: {} });
    });
  });

  describe('in operator', () => {
    it('should build in condition with terms', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'in', value: 'active, pending, review' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ terms: { status: ['active', 'pending', 'review'] } }]
        }
      });
    });

    it('should build in condition with array values', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'in', value: ['a', 'b', 'c'] }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: {
          must: [{ terms: { status: ['a', 'b', 'c'] } }]
        }
      });
    });
  });

  describe('logic combinations', () => {
    it('should use must for AND logic', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
        { id: '2', columnName: 'status', operator: 'equals', value: 'active' }
      ];
      const result = buildElasticsearchFilter(filters, 'AND');
      expect(result.query).toEqual({
        bool: {
          must: [
            { range: { age: { gt: 18 } } },
            { term: { status: 'active' } }
          ]
        }
      });
    });

    it('should use should for OR logic with minimum_should_match', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'equals', value: 'a' },
        { id: '2', columnName: 'status', operator: 'equals', value: 'b' }
      ];
      const result = buildElasticsearchFilter(filters, 'OR');
      expect(result.query).toEqual({
        bool: {
          should: [
            { term: { status: 'a' } },
            { term: { status: 'b' } }
          ],
          minimum_should_match: 1
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should return empty bool for empty filters', () => {
      const result = buildElasticsearchFilter([]);
      expect(result.query).toEqual({ bool: {} });
    });

    it('should skip filters without columnName', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: '', operator: 'equals', value: 'test' },
        { id: '2', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({
        bool: { must: [{ term: { name: 'John' } }] }
      });
    });

    it('should skip unknown operators', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'unknown' as any, value: 'test' }
      ];
      const result = buildElasticsearchFilter(filters);
      expect(result.query).toEqual({ bool: {} });
    });
  });
});

describe('buildElasticsearchSearchBody', () => {
  it('should build complete search body', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'status', operator: 'equals', value: 'active' }
    ];
    const result = buildElasticsearchSearchBody(filters, 'AND');
    expect(result).toEqual({
      query: {
        bool: { must: [{ term: { status: 'active' } }] }
      },
      from: 0,
      size: 100
    });
  });

  it('should use match_all for empty filters', () => {
    const result = buildElasticsearchSearchBody([], 'AND');
    expect(result).toEqual({
      query: { match_all: {} },
      from: 0,
      size: 100
    });
  });

  it('should accept pagination options', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'age', operator: 'greater_than', value: 18 }
    ];
    const result = buildElasticsearchSearchBody(filters, 'AND', { from: 50, size: 25 });
    expect(result.from).toBe(50);
    expect(result.size).toBe(25);
  });

  it('should add sort option when provided', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'status', operator: 'equals', value: 'active' }
    ];
    const sort = [{ name: 'asc' as const }, { createdAt: 'desc' as const }];
    const result = buildElasticsearchSearchBody(filters, 'AND', { sort });
    expect(result.sort).toEqual(sort);
  });

  it('should not add sort when empty', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'status', operator: 'equals', value: 'active' }
    ];
    const result = buildElasticsearchSearchBody(filters, 'AND', {});
    expect(result.sort).toBeUndefined();
  });
});
