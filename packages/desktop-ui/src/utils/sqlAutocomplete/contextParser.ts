/**
 * SQL Context Parser
 *
 * Parses SQL queries to understand the context at cursor position
 * using regex-based analysis for SQL query parsing.
 */

import type { EditorState } from "@codemirror/state";
import type {
  SqlContext,
  SqlClause,
  ExpectedType,
  TableReference,
  CTEDefinition,
} from "./types";

// Keywords that start clauses
const CLAUSE_KEYWORDS: Record<string, SqlClause> = {
  SELECT: "SELECT",
  FROM: "FROM",
  WHERE: "WHERE",
  JOIN: "JOIN",
  "INNER JOIN": "JOIN",
  "LEFT JOIN": "JOIN",
  "RIGHT JOIN": "JOIN",
  "FULL JOIN": "JOIN",
  "CROSS JOIN": "JOIN",
  "LEFT OUTER JOIN": "JOIN",
  "RIGHT OUTER JOIN": "JOIN",
  "FULL OUTER JOIN": "JOIN",
  ON: "ON",
  "ORDER BY": "ORDER_BY",
  "GROUP BY": "GROUP_BY",
  HAVING: "HAVING",
  INSERT: "INSERT",
  INTO: "INTO",
  VALUES: "VALUES",
  UPDATE: "UPDATE",
  SET: "SET",
  DELETE: "DELETE",
  CREATE: "CREATE",
  ALTER: "ALTER",
  DROP: "DROP",
  WITH: "WITH",
  LIMIT: "LIMIT",
  OFFSET: "OFFSET",
  UNION: "UNION",
  AND: "WHERE", // Stays in WHERE clause
  OR: "WHERE",  // Stays in WHERE clause
};

/**
 * Get SQL context at cursor position
 */
export function getSqlContext(state: EditorState, pos: number): SqlContext {
  const doc = state.doc.toString();

  // Get the current word being typed
  const currentWord = getCurrentWord(doc, pos);

  // Check if we're in a string or comment
  const inString = isInString(doc, pos);
  const inComment = isInComment(doc, pos);

  if (inString || inComment) {
    return {
      clause: "UNKNOWN",
      expectedType: "any",
      tablesInScope: [],
      ctesInScope: [],
      currentWord,
      cursorPos: pos,
      inString,
      inComment,
    };
  }

  // Check for qualifier (alias. or table. or schema.)
  const currentQualifier = getQualifier(doc, pos);

  // Parse the query structure
  const textBeforeCursor = doc.slice(0, pos);

  // Determine current clause
  const clause = getCurrentClause(textBeforeCursor);

  // Get tables in scope
  const tablesInScope = parseTablesInScope(doc, pos);

  // Get CTEs in scope
  const ctesInScope = parseCTEs(doc);

  // Determine expected type based on context
  const expectedType = determineExpectedType(
    clause,
    textBeforeCursor,
    currentQualifier,
    tablesInScope
  );

  // Get previous token for operator suggestions
  const previousToken = getPreviousToken(doc, pos - currentWord.length);
  const previousKeyword = getPreviousKeyword(textBeforeCursor);

  return {
    clause,
    expectedType,
    tablesInScope,
    ctesInScope,
    currentQualifier,
    currentWord,
    cursorPos: pos,
    inString,
    inComment,
    previousToken,
    previousKeyword,
  };
}

/**
 * Get the word currently being typed at cursor position
 */
function getCurrentWord(doc: string, pos: number): string {
  let start = pos;
  while (start > 0 && /[\w]/.test(doc[start - 1])) {
    start--;
  }
  return doc.slice(start, pos);
}

/**
 * Get qualifier if cursor is after "alias." or "table."
 */
function getQualifier(doc: string, pos: number): string | undefined {
  // Look backwards for pattern: identifier.
  let i = pos - 1;

  // Skip current word
  while (i >= 0 && /[\w]/.test(doc[i])) {
    i--;
  }

  // Check for dot
  if (i >= 0 && doc[i] === ".") {
    i--;
    // Get the qualifier name
    let end = i + 1;
    while (i >= 0 && /[\w]/.test(doc[i])) {
      i--;
    }
    const qualifier = doc.slice(i + 1, end);
    if (qualifier) {
      return qualifier;
    }
  }

  return undefined;
}

/**
 * Check if position is inside a string literal (including PostgreSQL dollar-quoted strings)
 */
function isInString(doc: string, pos: number): boolean {
  let inSingle = false;
  let inDouble = false;

  // Check for PostgreSQL dollar-quoted strings
  // Pattern: $tag$...$tag$ or $$...$$
  const dollarQuotePattern = /\$(\w*)\$/g;
  const dollarQuotes: Array<{ tag: string; start: number; end: number }> = [];
  let match;

  while ((match = dollarQuotePattern.exec(doc)) !== null) {
    const tag = match[1];
    const closePattern = new RegExp(`\\$${tag}\\$`, "g");
    closePattern.lastIndex = match.index + match[0].length;
    const closeMatch = closePattern.exec(doc);

    if (closeMatch) {
      dollarQuotes.push({
        tag,
        start: match.index,
        end: closeMatch.index + closeMatch[0].length,
      });
      // Skip past this quoted section for further matching
      dollarQuotePattern.lastIndex = closeMatch.index + closeMatch[0].length;
    }
  }

  // Check if position is inside any dollar-quoted string
  for (const dq of dollarQuotes) {
    if (pos > dq.start && pos < dq.end) {
      return true;
    }
  }

  // Standard single/double quote detection
  for (let i = 0; i < pos; i++) {
    const char = doc[i];
    const prevChar = i > 0 ? doc[i - 1] : "";

    // Skip if inside dollar-quoted string
    const inDollarQuote = dollarQuotes.some((dq) => i >= dq.start && i < dq.end);
    if (inDollarQuote) continue;

    if (char === "'" && prevChar !== "\\" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === '"' && prevChar !== "\\" && !inSingle) {
      inDouble = !inDouble;
    }
  }

  return inSingle || inDouble;
}

/**
 * Check if position is inside a comment
 */
function isInComment(doc: string, pos: number): boolean {
  // Check for line comment (--)
  const lineStart = doc.lastIndexOf("\n", pos - 1) + 1;
  const lineBeforeCursor = doc.slice(lineStart, pos);
  if (lineBeforeCursor.includes("--")) {
    const commentStart = lineBeforeCursor.indexOf("--");
    // Make sure -- is not inside a string
    if (!isInString(lineBeforeCursor, commentStart)) {
      return true;
    }
  }

  // Check for block comment (/* */)
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    if (doc[i] === "/" && doc[i + 1] === "*") {
      depth++;
      i++;
    } else if (doc[i] === "*" && doc[i + 1] === "/") {
      depth--;
      i++;
    }
  }

  return depth > 0;
}

/**
 * Determine the current SQL clause based on text before cursor
 */
function getCurrentClause(textBeforeCursor: string): SqlClause {
  // Normalize whitespace and uppercase
  const normalized = textBeforeCursor
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();

  // Find the last clause keyword
  let lastClause: SqlClause = "UNKNOWN";
  let lastPosition = -1;

  for (const [keyword, clause] of Object.entries(CLAUSE_KEYWORDS)) {
    // Use word boundary matching
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      if (match.index > lastPosition) {
        lastPosition = match.index;
        lastClause = clause;
      }
    }
  }

  // Special case: After JOIN but before ON, we're still in JOIN context
  if (lastClause === "JOIN") {
    const afterJoin = normalized.slice(lastPosition);
    if (!afterJoin.includes(" ON ")) {
      return "JOIN";
    }
  }

  return lastClause;
}

/**
 * Parse tables referenced in FROM and JOIN clauses
 */
function parseTablesInScope(doc: string, _cursorPos: number): TableReference[] {
  const tables: TableReference[] = [];

  // Pattern for FROM clause: FROM [schema.]table [alias]
  // Pattern for JOIN clause: JOIN [schema.]table [alias]
  const tablePatterns = [
    // FROM table
    /\bFROM\s+(["`\[]?\w+["`\]]?)(?:\.(["`\[]?\w+["`\]]?))?\s*(?:(?:AS\s+)?(["`\[]?\w+["`\]]?))?/gi,
    // JOIN table
    /\bJOIN\s+(["`\[]?\w+["`\]]?)(?:\.(["`\[]?\w+["`\]]?))?\s*(?:(?:AS\s+)?(["`\[]?\w+["`\]]?))?/gi,
    // UPDATE table
    /\bUPDATE\s+(["`\[]?\w+["`\]]?)(?:\.(["`\[]?\w+["`\]]?))?\s*(?:(?:AS\s+)?(["`\[]?\w+["`\]]?))?/gi,
    // INSERT INTO table
    /\bINTO\s+(["`\[]?\w+["`\]]?)(?:\.(["`\[]?\w+["`\]]?))?/gi,
    // DELETE FROM table
    /\bDELETE\s+FROM\s+(["`\[]?\w+["`\]]?)(?:\.(["`\[]?\w+["`\]]?))?\s*(?:(?:AS\s+)?(["`\[]?\w+["`\]]?))?/gi,
  ];

  for (const pattern of tablePatterns) {
    let match;
    while ((match = pattern.exec(doc)) !== null) {
      const [fullMatch, part1, part2, alias] = match;

      // Determine if part1 is schema or table
      let schema: string | undefined;
      let table: string;

      if (part2) {
        // schema.table format
        schema = cleanIdentifier(part1);
        table = cleanIdentifier(part2);
      } else {
        // just table
        table = cleanIdentifier(part1);
      }

      // Clean up alias
      const cleanAlias = alias ? cleanIdentifier(alias) : undefined;

      // Skip if alias is a keyword
      const aliasUpper = cleanAlias?.toUpperCase();
      if (aliasUpper && isKeyword(aliasUpper)) {
        tables.push({
          schema,
          table,
          startPos: match.index,
          endPos: match.index + fullMatch.length,
        });
      } else {
        tables.push({
          schema,
          table,
          alias: cleanAlias,
          startPos: match.index,
          endPos: match.index + fullMatch.length,
        });
      }
    }
  }

  return tables;
}

/**
 * Parse CTEs (WITH clause) from the query
 */
function parseCTEs(doc: string): CTEDefinition[] {
  const ctes: CTEDefinition[] = [];

  // Match WITH clause
  const withMatch = /\bWITH\s+(RECURSIVE\s+)?/gi.exec(doc);
  if (!withMatch) {
    return ctes;
  }

  // Extract CTE definitions
  // Pattern: cte_name [(columns)] AS (subquery)
  const afterWith = doc.slice(withMatch.index + withMatch[0].length);

  // Simple regex to find CTE names (before AS keyword)
  const ctePattern = /(\w+)\s*(?:\([^)]*\))?\s*AS\s*\(/gi;
  let match;

  while ((match = ctePattern.exec(afterWith)) !== null) {
    const cteName = match[1];
    ctes.push({
      name: cteName,
      startPos: withMatch.index + withMatch[0].length + match.index,
      endPos: withMatch.index + withMatch[0].length + match.index + match[0].length,
    });
  }

  return ctes;
}

/**
 * Determine what type of completion is expected
 */
function determineExpectedType(
  clause: SqlClause,
  textBeforeCursor: string,
  qualifier: string | undefined,
  _tablesInScope: TableReference[]
): ExpectedType {
  const lastChars = textBeforeCursor.slice(-30).trim().toUpperCase();
  const last50 = textBeforeCursor.slice(-50).trim().toUpperCase();

  // If we have a qualifier, we're expecting columns
  if (qualifier) {
    return "column";
  }

  // ==================== Window function context (OVER clause) ====================
  // Check if we're inside OVER (...) clause
  if (isInsideOver(textBeforeCursor)) {
    // After PARTITION BY or ORDER BY inside OVER
    if (lastChars.endsWith("BY") || lastChars.endsWith(",")) {
      return "column";
    }
    // After OVER (
    if (lastChars.endsWith("(")) {
      return "keyword"; // Expect PARTITION, ORDER, ROWS, RANGE, etc.
    }
    return "column";
  }

  // ==================== CASE expression context ====================
  if (isInsideCase(textBeforeCursor)) {
    // After WHEN - expect condition/expression
    if (lastChars.endsWith("WHEN")) {
      return "column_or_expression";
    }
    // After THEN or ELSE - expect value/expression
    if (lastChars.endsWith("THEN") || lastChars.endsWith("ELSE")) {
      return "column_or_expression";
    }
    // After CASE column - expect WHEN
    return "keyword";
  }

  // ==================== Subquery context ====================
  // Detect if we just opened a subquery with (SELECT
  if (last50.includes("(") && !last50.includes(")")) {
    const afterParen = last50.slice(last50.lastIndexOf("(") + 1).trim();
    if (afterParen === "" || afterParen === "SELECT") {
      return "column_or_expression";
    }
  }

  // ==================== Standard context detection ====================

  // Check last few characters for context
  if (lastChars.endsWith(",")) {
    // After comma, depends on clause
    switch (clause) {
      case "SELECT":
        return "column_or_expression";
      case "FROM":
      case "JOIN":
        return "table_or_schema";
      case "GROUP_BY":
      case "ORDER_BY":
        return "column";
      case "INSERT":
      case "INTO":
        return "column";
      default:
        return "any";
    }
  }

  if (lastChars.endsWith("(")) {
    // After opening paren
    if (clause === "INSERT" || clause === "INTO") {
      return "column";
    }
    if (clause === "VALUES") {
      return "value";
    }
    // Check if it's after a function name (for window functions)
    if (/\b(ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE|NTH_VALUE|SUM|AVG|COUNT|MIN|MAX)\s*\($/.test(last50)) {
      return "column_or_expression";
    }
    return "column_or_expression";
  }

  // After OVER keyword - expect (
  if (lastChars.endsWith("OVER")) {
    return "keyword";
  }

  // After FILTER keyword - expect WHERE
  if (lastChars.endsWith("FILTER")) {
    return "keyword";
  }

  // Check for comparison operators
  if (/[=<>!]+\s*$/.test(lastChars) || lastChars.endsWith(" LIKE") || lastChars.endsWith(" IN")) {
    return "value";
  }

  // Check for logical operators
  if (lastChars.endsWith(" AND") || lastChars.endsWith(" OR")) {
    return "column_or_expression";
  }

  // Clause-specific defaults
  switch (clause) {
    case "SELECT":
      return "column_or_expression";
    case "FROM":
      return "table_or_schema";
    case "JOIN":
      // If we just typed JOIN, expect table
      if (lastChars.endsWith("JOIN")) {
        return "table_or_schema";
      }
      return "table_or_schema";
    case "ON":
      return "join_condition";
    case "WHERE":
    case "HAVING":
      return "column_or_expression";
    case "ORDER_BY":
    case "GROUP_BY":
      return "column";
    case "SET":
      return "column";
    case "INSERT":
    case "INTO":
      if (lastChars.endsWith("INTO")) {
        return "table_or_schema";
      }
      return "column";
    case "VALUES":
      return "value";
    case "UPDATE":
      if (lastChars.endsWith("UPDATE")) {
        return "table_or_schema";
      }
      return "column";
    case "DELETE":
      return "table_or_schema";
    case "CREATE":
    case "ALTER":
      if (lastChars.includes("TABLE")) {
        return "table_or_schema";
      }
      return "keyword";
    case "DROP":
      return "table_or_schema";
    default:
      return "any";
  }
}

/**
 * Check if cursor is inside an OVER clause
 */
function isInsideOver(text: string): boolean {
  const upper = text.toUpperCase();
  const lastOver = upper.lastIndexOf(" OVER");
  if (lastOver === -1) return false;

  const afterOver = text.slice(lastOver);
  const openParens = (afterOver.match(/\(/g) || []).length;
  const closeParens = (afterOver.match(/\)/g) || []).length;

  // If we have more open parens than close, we're inside OVER()
  return openParens > closeParens;
}

/**
 * Check if cursor is inside a CASE expression
 */
function isInsideCase(text: string): boolean {
  const upper = text.toUpperCase();

  // Count CASE and END keywords
  const caseCount = (upper.match(/\bCASE\b/g) || []).length;
  const endCount = (upper.match(/\bEND\b/g) || []).length;

  // If more CASE than END, we're inside a CASE
  return caseCount > endCount;
}

/**
 * Get the previous token before current position
 */
function getPreviousToken(doc: string, pos: number): string | undefined {
  let end = pos;

  // Skip whitespace
  while (end > 0 && /\s/.test(doc[end - 1])) {
    end--;
  }

  // Get the token
  let start = end;
  while (start > 0 && /[^\s,();]/.test(doc[start - 1])) {
    start--;
  }

  if (start < end) {
    return doc.slice(start, end);
  }

  return undefined;
}

/**
 * Get the previous keyword before cursor
 */
function getPreviousKeyword(text: string): string | undefined {
  const keywords = Object.keys(CLAUSE_KEYWORDS);
  const normalized = text.toUpperCase();

  let lastKeyword: string | undefined;
  let lastPos = -1;

  for (const keyword of keywords) {
    const pos = normalized.lastIndexOf(keyword);
    if (pos > lastPos) {
      // Verify it's a word boundary
      const before = pos > 0 ? normalized[pos - 1] : " ";
      const after = normalized[pos + keyword.length] || " ";
      if (/\s/.test(before) && /[\s,;(]/.test(after)) {
        lastPos = pos;
        lastKeyword = keyword;
      }
    }
  }

  return lastKeyword;
}

/**
 * Clean identifier (remove quotes)
 */
function cleanIdentifier(id: string): string {
  return id.replace(/["`\[\]]/g, "").trim();
}

/**
 * Check if a word is a SQL keyword
 */
function isKeyword(word: string): boolean {
  const keywords = new Set([
    "SELECT", "FROM", "WHERE", "JOIN", "ON", "AND", "OR", "NOT",
    "IN", "LIKE", "BETWEEN", "IS", "NULL", "AS", "ORDER", "BY",
    "GROUP", "HAVING", "LIMIT", "OFFSET", "INSERT", "INTO", "VALUES",
    "UPDATE", "SET", "DELETE", "CREATE", "ALTER", "DROP", "TABLE",
    "INDEX", "VIEW", "LEFT", "RIGHT", "INNER", "OUTER", "FULL",
    "CROSS", "NATURAL", "UNION", "ALL", "DISTINCT", "ASC", "DESC",
    "CASE", "WHEN", "THEN", "ELSE", "END", "WITH", "RECURSIVE",
  ]);
  return keywords.has(word.toUpperCase());
}

/**
 * Resolve a qualifier to a table
 */
export function resolveQualifier(
  qualifier: string,
  tablesInScope: TableReference[],
  ctesInScope: CTEDefinition[]
): { type: "table" | "cte" | "schema"; name: string; schema?: string } | undefined {
  const qualifierLower = qualifier.toLowerCase();

  // Check CTEs first
  for (const cte of ctesInScope) {
    if (cte.name.toLowerCase() === qualifierLower || cte.alias?.toLowerCase() === qualifierLower) {
      return { type: "cte", name: cte.name };
    }
  }

  // Check table aliases
  for (const table of tablesInScope) {
    if (table.alias?.toLowerCase() === qualifierLower) {
      return { type: "table", name: table.table, schema: table.schema };
    }
  }

  // Check table names
  for (const table of tablesInScope) {
    if (table.table.toLowerCase() === qualifierLower) {
      return { type: "table", name: table.table, schema: table.schema };
    }
  }

  // Could be a schema name
  return { type: "schema", name: qualifier };
}
