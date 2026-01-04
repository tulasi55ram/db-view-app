/**
 * CQL Context Parser
 *
 * Parses CQL queries to understand the context at cursor position.
 * Reuses patterns from SQL parser with Cassandra-specific additions.
 */

import type { EditorState } from "@codemirror/state";
import type {
  CqlContext,
  CqlClause,
  CqlExpectedType,
  CqlTableReference,
} from "./types";

// Keywords that start clauses
const CLAUSE_KEYWORDS: Record<string, CqlClause> = {
  SELECT: "SELECT",
  FROM: "FROM",
  WHERE: "WHERE",
  "ORDER BY": "ORDER_BY",
  "GROUP BY": "GROUP_BY",
  INSERT: "INSERT",
  INTO: "INTO",
  VALUES: "VALUES",
  UPDATE: "UPDATE",
  SET: "SET",
  DELETE: "DELETE",
  CREATE: "CREATE",
  ALTER: "ALTER",
  DROP: "DROP",
  TRUNCATE: "TRUNCATE",
  USE: "USE",
  BATCH: "BATCH",
  "BEGIN BATCH": "BATCH",
  "BEGIN UNLOGGED BATCH": "BATCH",
  "BEGIN COUNTER BATCH": "BATCH",
  USING: "USING",
  IF: "IF",
  LIMIT: "LIMIT",
  AND: "WHERE", // Stays in WHERE clause
};

/**
 * Get CQL context at cursor position
 */
export function getCqlContext(state: EditorState, pos: number): CqlContext {
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
      currentWord,
      cursorPos: pos,
      inString,
      inComment,
    };
  }

  // Check for qualifier (keyspace. or table.)
  const currentQualifier = getQualifier(doc, pos);

  // Parse the query structure
  const textBeforeCursor = doc.slice(0, pos);

  // Determine current clause
  const clause = getCurrentClause(textBeforeCursor);

  // Get tables in scope
  const tablesInScope = parseTablesInScope(doc);

  // Check for batch context
  const inBatch = isInBatch(textBeforeCursor);

  // Check for ALLOW FILTERING
  const hasAllowFiltering = /\bALLOW\s+FILTERING\b/i.test(doc);

  // Check for USING clause
  const usingClause = /\bUSING\s+$/i.test(textBeforeCursor.trim());

  // Determine expected type based on context
  const expectedType = determineExpectedType(
    clause,
    textBeforeCursor,
    currentQualifier,
    usingClause
  );

  // Get previous token for operator suggestions
  const previousToken = getPreviousToken(doc, pos - currentWord.length);
  const previousKeyword = getPreviousKeyword(textBeforeCursor);

  return {
    clause,
    expectedType,
    tablesInScope,
    currentQualifier,
    currentWord,
    cursorPos: pos,
    inString,
    inComment,
    previousToken,
    previousKeyword,
    inBatch,
    hasAllowFiltering,
    usingClause,
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
 * Get qualifier if cursor is after "keyspace." or "table."
 */
function getQualifier(doc: string, pos: number): string | undefined {
  let i = pos - 1;

  // Skip current word
  while (i >= 0 && /[\w]/.test(doc[i])) {
    i--;
  }

  // Check for dot
  if (i >= 0 && doc[i] === ".") {
    i--;
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
 * Check if position is inside a string literal
 */
function isInString(doc: string, pos: number): boolean {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < pos; i++) {
    const char = doc[i];
    const prevChar = i > 0 ? doc[i - 1] : "";

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
 * Determine the current CQL clause based on text before cursor
 */
function getCurrentClause(textBeforeCursor: string): CqlClause {
  const normalized = textBeforeCursor
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();

  let lastClause: CqlClause = "UNKNOWN";
  let lastPosition = -1;

  for (const [keyword, clause] of Object.entries(CLAUSE_KEYWORDS)) {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      if (match.index > lastPosition) {
        lastPosition = match.index;
        lastClause = clause;
      }
    }
  }

  return lastClause;
}

/**
 * Parse tables referenced in FROM clause
 */
function parseTablesInScope(doc: string): CqlTableReference[] {
  const tables: CqlTableReference[] = [];

  // Pattern for FROM clause: FROM [keyspace.]table
  const tablePatterns = [
    /\bFROM\s+(["`]?\w+["`]?)(?:\.(["`]?\w+["`]?))?\s*/gi,
    /\bUPDATE\s+(["`]?\w+["`]?)(?:\.(["`]?\w+["`]?))?\s*/gi,
    /\bINTO\s+(["`]?\w+["`]?)(?:\.(["`]?\w+["`]?))?\s*/gi,
    /\bTRUNCATE\s+(?:TABLE\s+)?(["`]?\w+["`]?)(?:\.(["`]?\w+["`]?))?\s*/gi,
  ];

  for (const pattern of tablePatterns) {
    let match;
    while ((match = pattern.exec(doc)) !== null) {
      const [fullMatch, part1, part2] = match;

      let keyspace: string | undefined;
      let table: string;

      if (part2) {
        keyspace = cleanIdentifier(part1);
        table = cleanIdentifier(part2);
      } else {
        table = cleanIdentifier(part1);
      }

      // Skip if table is a keyword
      if (isKeyword(table.toUpperCase())) continue;

      tables.push({
        keyspace,
        table,
        startPos: match.index,
        endPos: match.index + fullMatch.length,
      });
    }
  }

  return tables;
}

/**
 * Check if we're inside a batch statement
 */
function isInBatch(text: string): boolean {
  const upper = text.toUpperCase();
  const hasBegin = /\bBEGIN\s+(UNLOGGED\s+|COUNTER\s+)?BATCH\b/.test(upper);
  const hasApply = /\bAPPLY\s+BATCH\b/.test(upper);
  return hasBegin && !hasApply;
}

/**
 * Determine what type of completion is expected
 */
function determineExpectedType(
  clause: CqlClause,
  textBeforeCursor: string,
  qualifier: string | undefined,
  usingClause: boolean
): CqlExpectedType {
  const lastChars = textBeforeCursor.slice(-30).trim().toUpperCase();

  // If we have a qualifier, we're expecting columns (or tables if keyspace.)
  if (qualifier) {
    // Could be keyspace.table or table.column - context-dependent
    return "column"; // Default to column, provider will check
  }

  // USING clause context - expect TTL or TIMESTAMP
  if (usingClause || lastChars.endsWith("USING")) {
    return "keyword";
  }

  // After TTL keyword - expect number
  if (lastChars.endsWith("TTL")) {
    return "value";
  }

  // After TIMESTAMP keyword - expect number
  if (lastChars.endsWith("TIMESTAMP")) {
    return "value";
  }

  // After comma
  if (lastChars.endsWith(",")) {
    switch (clause) {
      case "SELECT":
        return "column_or_expression";
      case "FROM":
        return "table_or_keyspace";
      case "ORDER_BY":
      case "GROUP_BY":
        return "column";
      case "INSERT":
      case "INTO":
        return "column";
      default:
        return "any";
    }
  }

  // After opening paren
  if (lastChars.endsWith("(")) {
    if (clause === "INSERT" || clause === "INTO") {
      return "column";
    }
    if (clause === "VALUES") {
      return "value";
    }
    return "column_or_expression";
  }

  // After comparison operators
  if (/[=<>!]+\s*$/.test(lastChars) || lastChars.endsWith(" IN")) {
    return "value";
  }

  // After AND
  if (lastChars.endsWith(" AND")) {
    if (clause === "WHERE" || clause === "IF") {
      return "column_or_expression";
    }
    if (clause === "USING") {
      return "keyword"; // TTL or TIMESTAMP
    }
    return "any";
  }

  // Clause-specific defaults
  switch (clause) {
    case "SELECT":
      return "column_or_expression";
    case "FROM":
      return "table_or_keyspace";
    case "WHERE":
    case "IF":
      return "column_or_expression";
    case "ORDER_BY":
    case "GROUP_BY":
      return "column";
    case "SET":
      return "column";
    case "INSERT":
    case "INTO":
      if (lastChars.endsWith("INTO")) {
        return "table_or_keyspace";
      }
      return "column";
    case "VALUES":
      return "value";
    case "UPDATE":
      if (lastChars.endsWith("UPDATE")) {
        return "table_or_keyspace";
      }
      return "column";
    case "DELETE":
      if (lastChars.endsWith("DELETE")) {
        return "column";
      }
      return "table_or_keyspace";
    case "USE":
      return "keyspace";
    case "CREATE":
    case "ALTER":
    case "DROP":
    case "TRUNCATE":
      return "keyword";
    case "USING":
      return "keyword";
    case "BATCH":
      return "keyword";
    default:
      return "any";
  }
}

/**
 * Get the previous token before current position
 */
function getPreviousToken(doc: string, pos: number): string | undefined {
  let end = pos;

  while (end > 0 && /\s/.test(doc[end - 1])) {
    end--;
  }

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
  return id.replace(/["`]/g, "").trim();
}

/**
 * Check if a word is a CQL keyword
 */
function isKeyword(word: string): boolean {
  const keywords = new Set([
    "SELECT", "FROM", "WHERE", "AND", "OR", "IN", "ORDER", "BY",
    "GROUP", "LIMIT", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
    "DELETE", "CREATE", "ALTER", "DROP", "TABLE", "KEYSPACE",
    "INDEX", "USING", "TTL", "TIMESTAMP", "IF", "EXISTS",
    "PRIMARY", "KEY", "CLUSTERING", "ALLOW", "FILTERING",
    "BEGIN", "BATCH", "APPLY", "UNLOGGED", "COUNTER",
    "TOKEN", "CONTAINS", "ASC", "DESC", "WITH", "TRUNCATE",
  ]);
  return keywords.has(word.toUpperCase());
}

/**
 * Resolve a qualifier to determine if it's a keyspace or table
 */
export function resolveQualifier(
  qualifier: string,
  tablesInScope: CqlTableReference[],
  keyspaces: string[]
): { type: "keyspace" | "table"; name: string; keyspace?: string } | undefined {
  const qualifierLower = qualifier.toLowerCase();

  // Check if it's a table in scope (for column access)
  for (const table of tablesInScope) {
    if (table.table.toLowerCase() === qualifierLower) {
      return { type: "table", name: table.table, keyspace: table.keyspace };
    }
  }

  // Check if it's a keyspace (for table access)
  for (const ks of keyspaces) {
    if (ks.toLowerCase() === qualifierLower) {
      return { type: "keyspace", name: ks };
    }
  }

  // Assume it's a keyspace if not found
  return { type: "keyspace", name: qualifier };
}
