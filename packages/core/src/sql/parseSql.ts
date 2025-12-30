/**
 * SQL Parsing Functions
 * @dbview/core - Phase 4: SQL Utilities
 */

import type { ParsedSql, SqlStatementType, SqlKeywords } from './types.js';

/**
 * SQL keywords by category
 */
export const SQL_KEYWORDS: SqlKeywords = {
  statements: [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
    'TRUNCATE', 'GRANT', 'REVOKE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'WITH',
    'EXPLAIN', 'ANALYZE', 'VACUUM', 'MERGE', 'UPSERT',
  ],
  clauses: [
    'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
    'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON', 'USING',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'NATURAL',
    'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
    'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'PERCENT',
    'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
    'INTO', 'VALUES', 'SET', 'DEFAULT', 'RETURNING',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'OVER', 'PARTITION', 'WINDOW', 'RANGE', 'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'ROW',
  ],
  operators: [
    '=', '<>', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/', '%',
    '||', '&&', '!', '~', '^', '&', '|', '::', '->', '->>', '#>', '#>>',
  ],
  functions: [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'GREATEST', 'LEAST',
    'CAST', 'CONVERT', 'EXTRACT', 'DATE_PART', 'DATE_TRUNC',
    'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'LENGTH', 'SUBSTRING', 'REPLACE',
    'CONCAT', 'CONCAT_WS', 'STRING_AGG', 'ARRAY_AGG', 'JSON_AGG', 'JSONB_AGG',
    'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
    'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
    'ABS', 'CEIL', 'FLOOR', 'ROUND', 'TRUNC', 'POWER', 'SQRT', 'MOD',
    'RANDOM', 'GENERATE_SERIES', 'UNNEST',
  ],
  dataTypes: [
    'INT', 'INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT',
    'DECIMAL', 'NUMERIC', 'REAL', 'FLOAT', 'DOUBLE', 'PRECISION',
    'CHAR', 'VARCHAR', 'TEXT', 'NCHAR', 'NVARCHAR', 'NTEXT',
    'DATE', 'TIME', 'TIMESTAMP', 'DATETIME', 'INTERVAL',
    'BOOLEAN', 'BOOL', 'BIT',
    'BINARY', 'VARBINARY', 'BLOB', 'BYTEA',
    'JSON', 'JSONB', 'XML',
    'UUID', 'SERIAL', 'BIGSERIAL',
    'ARRAY', 'ENUM', 'POINT', 'LINE', 'POLYGON', 'CIRCLE',
  ],
  literals: ['NULL', 'TRUE', 'FALSE'],
};

/**
 * Parse SQL to extract metadata
 *
 * @param sql - SQL string to parse
 * @returns Parsed SQL information
 *
 * @example
 * ```ts
 * const parsed = parseSql('SELECT name, age FROM users WHERE id = 1');
 * // {
 * //   type: 'SELECT',
 * //   tables: ['users'],
 * //   columns: ['name', 'age'],
 * //   hasWhere: true,
 * //   ...
 * // }
 * ```
 */
export function parseSql(sql: string): ParsedSql {
  const normalized = normalizeWhitespace(sql);
  const type = detectStatementType(normalized);

  return {
    type,
    tables: extractTables(normalized, type),
    columns: extractColumns(normalized, type),
    hasWhere: /\bWHERE\b/i.test(normalized),
    hasLimit: /\bLIMIT\b/i.test(normalized) || /\bFETCH\s+(?:FIRST|NEXT)\b/i.test(normalized),
    hasOrderBy: /\bORDER\s+BY\b/i.test(normalized),
    isModifying: isModifyingStatement(type),
    sql,
  };
}

/**
 * Normalize whitespace in SQL
 */
function normalizeWhitespace(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/**
 * Detect the type of SQL statement
 */
function detectStatementType(sql: string): SqlStatementType {
  const upperSql = sql.toUpperCase().trim();

  if (upperSql.startsWith('SELECT')) return 'SELECT';
  if (upperSql.startsWith('INSERT')) return 'INSERT';
  if (upperSql.startsWith('UPDATE')) return 'UPDATE';
  if (upperSql.startsWith('DELETE')) return 'DELETE';
  if (upperSql.startsWith('CREATE')) return 'CREATE';
  if (upperSql.startsWith('ALTER')) return 'ALTER';
  if (upperSql.startsWith('DROP')) return 'DROP';
  if (upperSql.startsWith('TRUNCATE')) return 'TRUNCATE';
  if (upperSql.startsWith('GRANT')) return 'GRANT';
  if (upperSql.startsWith('REVOKE')) return 'REVOKE';
  if (upperSql.startsWith('BEGIN')) return 'BEGIN';
  if (upperSql.startsWith('COMMIT')) return 'COMMIT';
  if (upperSql.startsWith('ROLLBACK')) return 'ROLLBACK';
  if (upperSql.startsWith('WITH')) return 'WITH';
  if (upperSql.startsWith('EXPLAIN')) return 'EXPLAIN';

  return 'UNKNOWN';
}

/**
 * Check if statement type modifies data
 */
function isModifyingStatement(type: SqlStatementType): boolean {
  return ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'].includes(type);
}

/**
 * Extract table names from SQL
 */
function extractTables(sql: string, type: SqlStatementType): string[] {
  const tables: string[] = [];

  // Remove string literals to avoid false matches
  const cleaned = sql
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');

  // FROM clause tables
  const fromMatch = cleaned.match(/\bFROM\s+([^,\s]+(?:\s*,\s*[^,\s]+)*)/i);
  if (fromMatch) {
    const tableList = fromMatch[1].split(/\s*,\s*/);
    for (const t of tableList) {
      const tableName = extractTableName(t);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }

  // JOIN tables
  const joinMatches = cleaned.matchAll(/\bJOIN\s+(\S+)/gi);
  for (const match of joinMatches) {
    const tableName = extractTableName(match[1]);
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }

  // INSERT INTO table
  if (type === 'INSERT') {
    const insertMatch = cleaned.match(/\bINSERT\s+INTO\s+(\S+)/i);
    if (insertMatch) {
      const tableName = extractTableName(insertMatch[1]);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }

  // UPDATE table
  if (type === 'UPDATE') {
    const updateMatch = cleaned.match(/\bUPDATE\s+(\S+)/i);
    if (updateMatch) {
      const tableName = extractTableName(updateMatch[1]);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }

  // DELETE FROM table
  if (type === 'DELETE') {
    const deleteMatch = cleaned.match(/\bDELETE\s+FROM\s+(\S+)/i);
    if (deleteMatch) {
      const tableName = extractTableName(deleteMatch[1]);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }

  return tables;
}

/**
 * Extract clean table name (remove schema, alias, etc.)
 */
function extractTableName(raw: string): string | null {
  // Remove alias (AS or just space followed by identifier)
  let name = raw.replace(/\s+(?:AS\s+)?\w+$/i, '').trim();

  // Remove parentheses (subquery)
  if (name.startsWith('(')) return null;

  // Remove quotes
  name = name.replace(/["`\[\]]/g, '');

  // Handle schema.table
  const parts = name.split('.');
  return parts[parts.length - 1] || null;
}

/**
 * Extract column names from SELECT statement
 */
function extractColumns(sql: string, type: SqlStatementType): string[] {
  if (type !== 'SELECT') return [];

  const columns: string[] = [];

  // Match between SELECT and FROM
  const selectMatch = sql.match(/\bSELECT\s+(.*?)\s+FROM\b/is);
  if (!selectMatch) return columns;

  const selectList = selectMatch[1];

  // Handle SELECT *
  if (selectList.trim() === '*') {
    return ['*'];
  }

  // Split by comma, handling nested parentheses
  const parts = splitSelectList(selectList);

  for (const part of parts) {
    const column = extractColumnName(part.trim());
    if (column && !columns.includes(column)) {
      columns.push(column);
    }
  }

  return columns;
}

/**
 * Split SELECT column list, respecting parentheses
 */
function splitSelectList(selectList: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of selectList) {
    if (char === '(') depth++;
    if (char === ')') depth--;

    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

/**
 * Extract column name from select expression
 */
function extractColumnName(expr: string): string | null {
  // Remove DISTINCT keyword
  const cleaned = expr.replace(/^\s*DISTINCT\s+/i, '').trim();

  // Handle alias: column AS alias or column alias
  const aliasMatch = cleaned.match(/\s+(?:AS\s+)?["'`\[]?(\w+)["'`\]]?\s*$/i);
  if (aliasMatch) {
    return aliasMatch[1];
  }

  // Handle table.column
  const dotMatch = cleaned.match(/\.["'`\[]?(\w+)["'`\]]?\s*$/);
  if (dotMatch) {
    return dotMatch[1];
  }

  // Simple column name
  const simpleMatch = cleaned.match(/^["'`\[]?(\w+)["'`\]]?$/);
  if (simpleMatch) {
    return simpleMatch[1];
  }

  // Function or expression - return null or the whole expression?
  return null;
}

/**
 * Get SQL keywords for syntax highlighting
 */
export function getSqlKeywords(): SqlKeywords {
  return SQL_KEYWORDS;
}

/**
 * Check if a word is a SQL keyword
 */
export function isSqlKeyword(word: string): boolean {
  const upper = word.toUpperCase();
  return (
    SQL_KEYWORDS.statements.includes(upper) ||
    SQL_KEYWORDS.clauses.includes(upper) ||
    SQL_KEYWORDS.functions.includes(upper) ||
    SQL_KEYWORDS.dataTypes.includes(upper) ||
    SQL_KEYWORDS.literals.includes(upper)
  );
}
