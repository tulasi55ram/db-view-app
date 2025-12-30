import { describe, it, expect } from 'vitest';
import { toCsv } from './toCsv.js';
import { toJson, toJsonLines } from './toJson.js';
import { toSql } from './toSql.js';
import { toMarkdown } from './toMarkdown.js';
import { parseCsv, parseJson, detectFormat } from './parseImport.js';

const testRows = [
  { name: 'John', age: 30 },
  { name: 'Jane', age: 25 },
];
const testColumns = ['name', 'age'];

describe('Export functions', () => {
  it('toCsv should convert rows to CSV', () => {
    const result = toCsv(testRows, testColumns);
    expect(result).toBe('name,age\nJohn,30\nJane,25');
  });

  it('toJson should convert rows to JSON', () => {
    const result = toJson(testRows, { pretty: false });
    expect(result).toBe('[{"name":"John","age":30},{"name":"Jane","age":25}]');
  });

  it('toJsonLines should convert rows to NDJSON', () => {
    const result = toJsonLines(testRows);
    expect(result).toBe('{"name":"John","age":30}\n{"name":"Jane","age":25}');
  });

  it('toSql should convert rows to INSERT statements', () => {
    const result = toSql(testRows, testColumns, { table: 'users' });
    expect(result).toContain('INSERT INTO "users"');
    expect(result).toContain("'John'");
  });

  it('toMarkdown should convert rows to markdown table', () => {
    const result = toMarkdown(testRows, testColumns);
    expect(result).toContain('| name');
    expect(result).toContain('| John');
    expect(result).toContain(':--');
  });
});

describe('Import functions', () => {
  it('parseCsv should parse CSV content', () => {
    const result = parseCsv('name,age\nJohn,30\nJane,25');
    expect(result.columns).toEqual(['name', 'age']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('John');
  });

  it('parseJson should parse JSON content', () => {
    const result = parseJson('[{"name":"John"},{"name":"Jane"}]');
    expect(result.columns).toContain('name');
    expect(result.rows).toHaveLength(2);
  });

  it('detectFormat should detect CSV', () => {
    expect(detectFormat('a,b,c\n1,2,3')).toBe('csv');
  });

  it('detectFormat should detect JSON', () => {
    expect(detectFormat('[{"a":1}]')).toBe('json');
  });
});
