import { describe, it, expect } from 'vitest';
import { buildMongoFilter, buildMongoMatchStage } from './buildMongoFilter.js';
import type { FilterCondition } from '@dbview/types';

describe('buildMongoFilter', () => {
  describe('basic operators', () => {
    it('should build equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ name: { $eq: 'John' } });
    });

    it('should build not_equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'not_equals', value: 'inactive' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ status: { $ne: 'inactive' } });
    });

    it('should build contains condition with regex', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'contains', value: 'gmail' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ email: { $regex: 'gmail', $options: 'i' } });
    });

    it('should build not_contains condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'not_contains', value: 'spam' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ email: { $not: { $regex: 'spam', $options: 'i' } } });
    });

    it('should build starts_with condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'starts_with', value: 'John' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ name: { $regex: '^John', $options: 'i' } });
    });

    it('should build ends_with condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'file', operator: 'ends_with', value: '.pdf' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ file: { $regex: '\\.pdf$', $options: 'i' } });
    });

    it('should escape regex special characters in starts_with/ends_with', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'text', operator: 'starts_with', value: 'test.*' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ text: { $regex: '^test\\.\\*', $options: 'i' } });
    });
  });

  describe('comparison operators', () => {
    it('should build greater_than condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: 'greater_than', value: 18 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ age: { $gt: 18 } });
    });

    it('should build less_than condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'count', operator: 'less_than', value: 100 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ count: { $lt: 100 } });
    });

    it('should build greater_or_equal condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'score', operator: 'greater_or_equal', value: 90 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ score: { $gte: 90 } });
    });

    it('should build less_or_equal condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'less_or_equal', value: 50 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ price: { $lte: 50 } });
    });
  });

  describe('null operators', () => {
    it('should build is_null condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'deletedAt', operator: 'is_null', value: '' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ deletedAt: { $eq: null } });
    });

    it('should build is_not_null condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'is_not_null', value: '' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ email: { $ne: null } });
    });
  });

  describe('between operator', () => {
    it('should build between condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'between', value: 10, value2: 100 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ price: { $gte: 10, $lte: 100 } });
    });

    it('should skip between without value2', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'between', value: 10 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({});
    });
  });

  describe('in operator', () => {
    it('should build in condition with comma-separated values', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'in', value: 'active, pending, review' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ status: { $in: ['active', 'pending', 'review'] } });
    });

    it('should build in condition with array values', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'in', value: ['active', 'pending'] }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ status: { $in: ['active', 'pending'] } });
    });
  });

  describe('logic combinations', () => {
    it('should combine filters with AND by default', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
        { id: '2', columnName: 'status', operator: 'equals', value: 'active' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({
        $and: [
          { age: { $gt: 18 } },
          { status: { $eq: 'active' } }
        ]
      });
    });

    it('should combine filters with OR', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'role', operator: 'equals', value: 'admin' },
        { id: '2', columnName: 'role', operator: 'equals', value: 'moderator' }
      ];
      const result = buildMongoFilter(filters, 'OR');
      expect(result.query).toEqual({
        $or: [
          { role: { $eq: 'admin' } },
          { role: { $eq: 'moderator' } }
        ]
      });
    });

    it('should not wrap single condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildMongoFilter(filters, 'AND');
      expect(result.query).toEqual({ name: { $eq: 'John' } });
    });
  });

  describe('edge cases', () => {
    it('should return empty query for empty filters', () => {
      const result = buildMongoFilter([]);
      expect(result.query).toEqual({});
    });

    it('should skip filters without columnName', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: '', operator: 'equals', value: 'test' },
        { id: '2', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ name: { $eq: 'John' } });
    });

    it('should skip filters without operator', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: '' as any, value: 'test' },
        { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ age: { $gt: 18 } });
    });

    it('should handle nested field names', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'address.city', operator: 'equals', value: 'NYC' }
      ];
      const result = buildMongoFilter(filters);
      expect(result.query).toEqual({ 'address.city': { $eq: 'NYC' } });
    });
  });
});

describe('buildMongoMatchStage', () => {
  it('should build match stage with filters', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'age', operator: 'greater_than', value: 18 }
    ];
    const result = buildMongoMatchStage(filters);
    expect(result).toEqual({ $match: { age: { $gt: 18 } } });
  });

  it('should build empty match stage for no filters', () => {
    const result = buildMongoMatchStage([]);
    expect(result).toEqual({ $match: {} });
  });

  it('should respect logic parameter', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'status', operator: 'equals', value: 'a' },
      { id: '2', columnName: 'status', operator: 'equals', value: 'b' }
    ];
    const result = buildMongoMatchStage(filters, 'OR');
    expect(result).toEqual({
      $match: {
        $or: [
          { status: { $eq: 'a' } },
          { status: { $eq: 'b' } }
        ]
      }
    });
  });
});
