import { describe, it, expect } from 'vitest';
import { formatSql, minifySql, splitStatements } from './formatSql.js';
import { validateSql, isReadOnlyQuery, detectDangerousOperations } from './validateSql.js';
import { parseSql, isSqlKeyword } from './parseSql.js';

describe('formatSql', () => {
  it('should format simple SELECT', () => {
    const result = formatSql('select * from users where id = 1');
    expect(result).toContain('SELECT');
    expect(result).toContain('FROM');
    expect(result).toContain('WHERE');
  });

  it('should use specified dialect', () => {
    const result = formatSql('SELECT * FROM users', { dialect: 'mysql' });
    expect(result).toBeDefined();
  });
});

describe('minifySql', () => {
  it('should minify SQL', () => {
    const sql = `
      SELECT *
      FROM users
      WHERE id = 1
    `;
    const result = minifySql(sql);
    expect(result).toBe('SELECT * FROM users WHERE id = 1');
  });
});

describe('splitStatements', () => {
  it('should split multiple statements', () => {
    const sql = 'SELECT 1; SELECT 2; SELECT 3';
    const result = splitStatements(sql);
    expect(result).toHaveLength(3);
  });

  it('should handle strings with semicolons', () => {
    const sql = "SELECT 'a;b'; SELECT 2";
    const result = splitStatements(sql);
    expect(result).toHaveLength(2);
  });
});

describe('validateSql', () => {
  it('should validate correct SQL', () => {
    const result = validateSql('SELECT * FROM users');
    expect(result.valid).toBe(true);
  });

  it('should detect unclosed quotes', () => {
    const result = validateSql("SELECT * FROM users WHERE name = 'test");
    expect(result.valid).toBe(false);
    expect(result.error).toContain('quote');
  });

  it('should warn about DELETE without WHERE', () => {
    const result = validateSql('DELETE FROM users');
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('DELETE without WHERE clause will delete all rows');
  });
});

describe('isReadOnlyQuery', () => {
  it('should return true for SELECT', () => {
    expect(isReadOnlyQuery('SELECT * FROM users')).toBe(true);
  });

  it('should return false for INSERT', () => {
    expect(isReadOnlyQuery('INSERT INTO users VALUES (1)')).toBe(false);
  });

  it('should return true for EXPLAIN', () => {
    expect(isReadOnlyQuery('EXPLAIN SELECT * FROM users')).toBe(true);
  });
});

describe('detectDangerousOperations', () => {
  it('should detect DROP', () => {
    const result = detectDangerousOperations('DROP TABLE users');
    expect(result).toContain('DROP');
  });

  it('should detect DELETE without WHERE', () => {
    const result = detectDangerousOperations('DELETE FROM users');
    expect(result).toContain('DELETE');
    expect(result).toContain('DELETE_ALL');
  });
});

describe('parseSql', () => {
  it('should parse SELECT statement', () => {
    const result = parseSql('SELECT name, age FROM users WHERE id = 1');
    expect(result.type).toBe('SELECT');
    expect(result.tables).toContain('users');
    expect(result.hasWhere).toBe(true);
    expect(result.isModifying).toBe(false);
  });

  it('should parse INSERT statement', () => {
    const result = parseSql('INSERT INTO users (name) VALUES (\'test\')');
    expect(result.type).toBe('INSERT');
    expect(result.tables).toContain('users');
    expect(result.isModifying).toBe(true);
  });
});

describe('isSqlKeyword', () => {
  it('should identify keywords', () => {
    expect(isSqlKeyword('SELECT')).toBe(true);
    expect(isSqlKeyword('FROM')).toBe(true);
    expect(isSqlKeyword('WHERE')).toBe(true);
  });

  it('should reject non-keywords', () => {
    expect(isSqlKeyword('users')).toBe(false);
    expect(isSqlKeyword('xyz')).toBe(false);
  });
});
