import { describe, it, expect } from 'vitest';
import { buildSqlFilter, buildSqlFilterNamed, buildWhereClause } from './buildSqlFilter.js';
import type { FilterCondition } from '@dbview/types';

describe('buildSqlFilter', () => {
  describe('PostgreSQL (positional placeholders)', () => {
    it('should build equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"name" = $1');
      expect(result.params).toEqual(['John']);
    });

    it('should build not equals condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'not_equals', value: 'inactive' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"status" != $1');
      expect(result.params).toEqual(['inactive']);
    });

    it('should use ILIKE for contains', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'contains', value: 'john' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"name"::text ILIKE $1');
      expect(result.params).toEqual(['%john%']);
    });

    it('should use NOT ILIKE for not_contains', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'not_contains', value: 'spam' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"email"::text NOT ILIKE $1');
      expect(result.params).toEqual(['%spam%']);
    });

    it('should build starts_with condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'starts_with', value: 'A' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"name"::text ILIKE $1');
      expect(result.params).toEqual(['A%']);
    });

    it('should build ends_with condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'file', operator: 'ends_with', value: '.pdf' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"file"::text ILIKE $1');
      expect(result.params).toEqual(['%.pdf']);
    });

    it('should build comparison operators', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'age', operator: 'greater_than', value: 18 },
        { id: '2', columnName: 'salary', operator: 'less_than', value: 100000 },
        { id: '3', columnName: 'score', operator: 'greater_or_equal', value: 90 },
        { id: '4', columnName: 'count', operator: 'less_or_equal', value: 10 }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"age" > $1 AND "salary" < $2 AND "score" >= $3 AND "count" <= $4');
      expect(result.params).toEqual([18, 100000, 90, 10]);
    });

    it('should build IS NULL condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'deleted_at', operator: 'is_null', value: '' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"deleted_at" IS NULL');
      expect(result.params).toEqual([]);
    });

    it('should build IS NOT NULL condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'email', operator: 'is_not_null', value: '' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"email" IS NOT NULL');
      expect(result.params).toEqual([]);
    });

    it('should build BETWEEN condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'price', operator: 'between', value: 10, value2: 100 }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"price" BETWEEN $1 AND $2');
      expect(result.params).toEqual([10, 100]);
    });

    it('should build IN condition', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'status', operator: 'in', value: 'active, pending, review' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"status" IN ($1, $2, $3)');
      expect(result.params).toEqual(['active', 'pending', 'review']);
    });

    it('should join with OR logic', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'role', operator: 'equals', value: 'admin' },
        { id: '2', columnName: 'role', operator: 'equals', value: 'moderator' }
      ];
      const result = buildSqlFilter(filters, 'OR', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"role" = $1 OR "role" = $2');
    });

    it('should return empty for no filters', () => {
      const result = buildSqlFilter([], 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should skip filters without columnName', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: '', operator: 'equals', value: 'test' },
        { id: '2', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"name" = $1');
      expect(result.params).toEqual(['John']);
    });

    it('should use custom startIndex', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres', startIndex: 5 });
      expect(result.whereClause).toBe('"name" = $5');
    });

    it('should escape quotes in identifiers', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'user"name', operator: 'equals', value: 'John' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'postgres' });
      expect(result.whereClause).toBe('"user""name" = $1');
    });
  });

  describe('MySQL (question mark placeholders)', () => {
    it('should use question mark placeholders', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' },
        { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'mysql' });
      expect(result.whereClause).toBe('`name` = ? AND `age` > ?');
      expect(result.params).toEqual(['John', 18]);
    });

    it('should use backticks for identifiers', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'table', operator: 'equals', value: 'test' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'mysql' });
      expect(result.whereClause).toBe('`table` = ?');
    });

    it('should use LIKE (not ILIKE) for contains', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'contains', value: 'john' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'mysql' });
      expect(result.whereClause).toBe('`name` LIKE ?');
      expect(result.params).toEqual(['%john%']);
    });

    it('should escape backticks in identifiers', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'column`name', operator: 'equals', value: 'test' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'mysql' });
      expect(result.whereClause).toBe('`column``name` = ?');
    });
  });

  describe('SQL Server (named placeholders)', () => {
    it('should use named placeholders', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'sqlserver' });
      expect(result.whereClause).toBe('[name] = @p0');
      expect(result.params).toEqual(['John']);
    });

    it('should use brackets for identifiers', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'user', operator: 'equals', value: 'admin' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'sqlserver' });
      expect(result.whereClause).toBe('[user] = @p0');
    });

    it('should use CAST for text operations', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'contains', value: 'john' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'sqlserver' });
      expect(result.whereClause).toBe('CAST([name] AS NVARCHAR(MAX)) LIKE @p0');
    });

    it('should escape brackets in identifiers', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'column]name', operator: 'equals', value: 'test' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'sqlserver' });
      expect(result.whereClause).toBe('[column]]name] = @p0');
    });
  });

  describe('SQLite', () => {
    it('should use question mark placeholders and double quotes', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'sqlite' });
      expect(result.whereClause).toBe('"name" = ?');
      expect(result.params).toEqual(['John']);
    });
  });

  describe('MariaDB', () => {
    it('should use same syntax as MySQL', () => {
      const filters: FilterCondition[] = [
        { id: '1', columnName: 'name', operator: 'contains', value: 'john' }
      ];
      const result = buildSqlFilter(filters, 'AND', { dbType: 'mariadb' });
      expect(result.whereClause).toBe('`name` LIKE ?');
    });
  });
});

describe('buildSqlFilterNamed', () => {
  it('should build named parameters', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: 'John' },
      { id: '2', columnName: 'age', operator: 'greater_than', value: 18 }
    ];
    const result = buildSqlFilterNamed(filters, 'AND', {});
    expect(result.whereClause).toBe('[name] = @p0 AND [age] > @p1');
    expect(result.params).toEqual({ p0: 'John', p1: 18 });
  });

  it('should handle BETWEEN with named params', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'price', operator: 'between', value: 10, value2: 100 }
    ];
    const result = buildSqlFilterNamed(filters, 'AND', {});
    expect(result.whereClause).toBe('[price] BETWEEN @p0 AND @p1');
    expect(result.params).toEqual({ p0: 10, p1: 100 });
  });

  it('should handle IN with named params', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'status', operator: 'in', value: 'a, b, c' }
    ];
    const result = buildSqlFilterNamed(filters, 'AND', {});
    expect(result.whereClause).toBe('[status] IN (@p0, @p1, @p2)');
    expect(result.params).toEqual({ p0: 'a', p1: 'b', p2: 'c' });
  });

  it('should return empty for no filters', () => {
    const result = buildSqlFilterNamed([], 'AND', {});
    expect(result.whereClause).toBe('');
    expect(result.params).toEqual({});
  });

  it('should respect custom startIndex', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
    ];
    const result = buildSqlFilterNamed(filters, 'AND', { startIndex: 5 });
    expect(result.whereClause).toBe('[name] = @p5');
    expect(result.params).toEqual({ p5: 'John' });
  });
});

describe('buildWhereClause', () => {
  it('should be a convenience wrapper for buildSqlFilter', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
    ];
    const result = buildWhereClause(filters, 'AND', 'postgres');
    expect(result.whereClause).toBe('"name" = $1');
    expect(result.params).toEqual(['John']);
  });

  it('should accept custom quote function', () => {
    const filters: FilterCondition[] = [
      { id: '1', columnName: 'name', operator: 'equals', value: 'John' }
    ];
    const customQuote = (name: string) => `<<${name}>>`;
    const result = buildWhereClause(filters, 'AND', 'postgres', customQuote);
    expect(result.whereClause).toBe('<<name>> = $1');
  });
});
