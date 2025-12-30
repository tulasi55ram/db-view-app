/**
 * SQL Validation Functions
 * @dbview/core - Phase 4: SQL Utilities
 */

import type { SqlValidationResult } from './types.js';

/**
 * Dangerous keywords that modify data or structure
 */
const DANGEROUS_KEYWORDS = [
  'DROP',
  'TRUNCATE',
  'DELETE',
  'ALTER',
  'CREATE',
  'GRANT',
  'REVOKE',
];

/**
 * Basic SQL validation patterns
 */
const VALIDATION_PATTERNS = {
  // Check for unclosed strings
  unclosedSingleQuote: /^[^']*('[^']*')*[^']*'[^']*$/,
  unclosedDoubleQuote: /^[^"]*("[^"]*")*[^"]*"[^"]*$/,
  // Check for basic syntax issues
  emptyQuery: /^\s*$/,
  // Check for dangerous operations
  dangerousOps: new RegExp(`\\b(${DANGEROUS_KEYWORDS.join('|')})\\b`, 'i'),
};

/**
 * Validate SQL syntax (basic validation)
 *
 * @param sql - SQL string to validate
 * @returns Validation result
 *
 * @example
 * ```ts
 * const result = validateSql("SELECT * FROM users WHERE id = '1");
 * // { valid: false, error: "Unclosed string literal" }
 * ```
 */
export function validateSql(sql: string): SqlValidationResult {
  const warnings: string[] = [];

  // Check for empty query
  if (VALIDATION_PATTERNS.emptyQuery.test(sql)) {
    return { valid: false, error: 'Empty SQL query' };
  }

  // Check for unclosed string literals
  const quoteBalance = checkQuoteBalance(sql);
  if (!quoteBalance.valid) {
    return {
      valid: false,
      error: quoteBalance.error,
      position: quoteBalance.position,
    };
  }

  // Check for unclosed parentheses
  const parenBalance = checkParenthesesBalance(sql);
  if (!parenBalance.valid) {
    return {
      valid: false,
      error: parenBalance.error,
      position: parenBalance.position,
    };
  }

  // Check for dangerous operations (warning only)
  if (VALIDATION_PATTERNS.dangerousOps.test(sql)) {
    const match = sql.match(VALIDATION_PATTERNS.dangerousOps);
    if (match) {
      warnings.push(`Query contains potentially dangerous operation: ${match[1].toUpperCase()}`);
    }
  }

  // Check for SELECT without FROM (might be intentional for expressions)
  if (/^\s*SELECT\b/i.test(sql) && !/\bFROM\b/i.test(sql)) {
    // This is actually valid in many databases for expressions like SELECT 1+1
    // warnings.push('SELECT without FROM clause');
  }

  // Check for DELETE without WHERE
  if (/^\s*DELETE\s+FROM\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    warnings.push('DELETE without WHERE clause will delete all rows');
  }

  // Check for UPDATE without WHERE
  if (/^\s*UPDATE\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    warnings.push('UPDATE without WHERE clause will update all rows');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Check quote balance in SQL string
 */
function checkQuoteBalance(sql: string): SqlValidationResult {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let lastQuotePos = { line: 1, column: 1, offset: 0 };
  let line = 1;
  let column = 1;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }

    // Skip escaped quotes
    if (i > 0 && sql[i - 1] === '\\') {
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      // Check for doubled quote (escape in SQL)
      if (sql[i + 1] === "'" && inSingleQuote) {
        i++; // Skip the escaped quote
        column++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      if (inSingleQuote) {
        lastQuotePos = { line, column, offset: i };
      }
    } else if (char === '"' && !inSingleQuote) {
      // Check for doubled quote
      if (sql[i + 1] === '"' && inDoubleQuote) {
        i++;
        column++;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      if (inDoubleQuote) {
        lastQuotePos = { line, column, offset: i };
      }
    }
  }

  if (inSingleQuote) {
    return {
      valid: false,
      error: 'Unclosed single quote',
      position: lastQuotePos,
    };
  }

  if (inDoubleQuote) {
    return {
      valid: false,
      error: 'Unclosed double quote',
      position: lastQuotePos,
    };
  }

  return { valid: true };
}

/**
 * Check parentheses balance in SQL string
 */
function checkParenthesesBalance(sql: string): SqlValidationResult {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let lastOpenPos = { line: 1, column: 1, offset: 0 };
  let line = 1;
  let column = 1;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }

    // Track string state
    if (char === "'" && !inDoubleQuote) {
      if (sql[i + 1] !== "'") {
        inSingleQuote = !inSingleQuote;
      } else {
        i++;
        column++;
      }
    } else if (char === '"' && !inSingleQuote) {
      if (sql[i + 1] !== '"') {
        inDoubleQuote = !inDoubleQuote;
      } else {
        i++;
        column++;
      }
    }

    // Only count parens outside strings
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        if (depth === 0) {
          lastOpenPos = { line, column, offset: i };
        }
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth < 0) {
          return {
            valid: false,
            error: 'Unexpected closing parenthesis',
            position: { line, column, offset: i },
          };
        }
      }
    }
  }

  if (depth > 0) {
    return {
      valid: false,
      error: 'Unclosed parenthesis',
      position: lastOpenPos,
    };
  }

  return { valid: true };
}

/**
 * Check if SQL is a read-only query (SELECT)
 *
 * @param sql - SQL string to check
 * @returns True if the query is read-only
 */
export function isReadOnlyQuery(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();

  // Handle WITH (CTE) - need to check the main statement
  if (trimmed.startsWith('WITH')) {
    // Find the main statement after the CTE
    const withoutCte = sql.replace(/WITH\s+[\s\S]*?(?=SELECT|INSERT|UPDATE|DELETE)/i, '');
    return isReadOnlyQuery(withoutCte);
  }

  // EXPLAIN is read-only
  if (trimmed.startsWith('EXPLAIN')) {
    return true;
  }

  // SELECT is read-only (unless it's SELECT INTO)
  if (trimmed.startsWith('SELECT')) {
    return !/\bINTO\b/i.test(sql);
  }

  // SHOW commands are read-only
  if (trimmed.startsWith('SHOW')) {
    return true;
  }

  // DESCRIBE is read-only
  if (trimmed.startsWith('DESCRIBE') || trimmed.startsWith('DESC')) {
    return true;
  }

  return false;
}

/**
 * Check if SQL contains potentially dangerous operations
 *
 * @param sql - SQL string to check
 * @returns Array of detected dangerous operations
 */
export function detectDangerousOperations(sql: string): string[] {
  const detected: string[] = [];
  const upperSql = sql.toUpperCase();

  for (const keyword of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(upperSql)) {
      detected.push(keyword);
    }
  }

  // Additional dangerous patterns
  if (/DELETE\s+FROM\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    detected.push('DELETE_ALL');
  }

  if (/UPDATE\s+\w+\s+SET\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    detected.push('UPDATE_ALL');
  }

  return detected;
}
