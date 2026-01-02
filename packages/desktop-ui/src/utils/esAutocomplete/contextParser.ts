/**
 * Elasticsearch Query DSL Context Parser
 *
 * Parses JSON structure to determine cursor context for autocomplete.
 * Handles the nested nature of ES Query DSL:
 * - Query context (match, term, bool, etc.)
 * - Aggregation context (terms, histogram, etc.)
 * - Field references
 * - Nested structures
 */

import type { ESContext, ESContextType } from "./types";

// Accept generic state object with doc.toString()
interface EditorStateDoc {
  doc: { toString: () => string };
}

// Context determination based on path
const PATH_CONTEXTS: Record<string, ESContextType> = {
  query: "query",
  bool: "bool",
  must: "bool_clause",
  should: "bool_clause",
  filter: "bool_clause",
  must_not: "bool_clause",
  aggs: "aggs",
  aggregations: "aggs",
  sort: "sort",
  highlight: "highlight",
  _source: "source",
  suggest: "suggest",
};

// Keys that expect field names as values
const FIELD_VALUE_KEYS = new Set([
  "field",
  "path",
  "nested_path",
  "script_fields",
  "_source",
  "stored_fields",
  "docvalue_fields",
  "collapse",
]);

// Keys that expect specific value types
const VALUE_TYPE_KEYS: Record<string, string[]> = {
  order: ["asc", "desc"],
  type: ["best_fields", "most_fields", "cross_fields", "phrase", "phrase_prefix"],
  operator: ["and", "or", "AND", "OR"],
  zero_terms_query: ["none", "all"],
  mode: ["min", "max", "avg", "sum", "median"],
  missing: ["_first", "_last"],
  execution: ["fielddata"],
  relation: ["intersects", "contains", "within", "disjoint"],
};

interface JsonParseState {
  path: string[];
  depth: number;
  inArray: boolean;
  arrayDepths: number[];
  currentKey: string | null;
  expectingValue: boolean;
  inString: boolean;
  stringStart: number;
  braceStack: string[];
}

/**
 * Parse JSON up to cursor position to understand context
 */
function parseJsonContext(text: string, cursorPos: number): JsonParseState {
  const state: JsonParseState = {
    path: [],
    depth: 0,
    inArray: false,
    arrayDepths: [],
    currentKey: null,
    expectingValue: false,
    inString: false,
    stringStart: -1,
    braceStack: [],
  };

  let i = 0;
  let lastKey: string | null = null;

  while (i < cursorPos && i < text.length) {
    const char = text[i];

    // Handle string state
    if (state.inString) {
      if (char === '"' && text[i - 1] !== "\\") {
        state.inString = false;
        // If we were collecting a key, save it
        if (!state.expectingValue && lastKey === null) {
          lastKey = text.slice(state.stringStart + 1, i);
        }
      }
      i++;
      continue;
    }

    // Start of string
    if (char === '"') {
      state.inString = true;
      state.stringStart = i;
      i++;
      continue;
    }

    // Object start
    if (char === "{") {
      state.depth++;
      state.braceStack.push("{");
      if (lastKey) {
        state.path.push(lastKey);
        lastKey = null;
      }
      state.expectingValue = false;
      i++;
      continue;
    }

    // Object end
    if (char === "}") {
      state.depth--;
      state.braceStack.pop();
      if (state.path.length > 0 && !state.arrayDepths.includes(state.depth)) {
        state.path.pop();
      }
      state.expectingValue = false;
      lastKey = null;
      i++;
      continue;
    }

    // Array start
    if (char === "[") {
      state.inArray = true;
      state.arrayDepths.push(state.depth);
      state.braceStack.push("[");
      if (lastKey) {
        state.path.push(lastKey);
        lastKey = null;
      }
      i++;
      continue;
    }

    // Array end
    if (char === "]") {
      state.inArray = state.arrayDepths.length > 1;
      state.arrayDepths.pop();
      state.braceStack.pop();
      if (state.path.length > 0) {
        state.path.pop();
      }
      i++;
      continue;
    }

    // Colon - expecting value
    if (char === ":") {
      state.expectingValue = true;
      if (lastKey) {
        state.currentKey = lastKey;
      }
      i++;
      continue;
    }

    // Comma - reset for next key/value
    if (char === ",") {
      state.expectingValue = false;
      lastKey = null;
      state.currentKey = null;
      i++;
      continue;
    }

    i++;
  }

  // Update inArray status based on current state
  state.inArray = state.arrayDepths.length > 0;

  return state;
}

/**
 * Get the current word being typed
 */
function getCurrentWord(text: string, pos: number): string {
  let start = pos;
  while (start > 0) {
    const char = text[start - 1];
    if (/[\s{}\[\]:,"]/.test(char)) break;
    start--;
  }
  return text.slice(start, pos);
}

/**
 * Check if cursor is inside a string
 */
function isInString(text: string, pos: number): boolean {
  let inString = false;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '"' && (i === 0 || text[i - 1] !== "\\")) {
      inString = !inString;
    }
  }
  return inString;
}

/**
 * Check if cursor is after colon (expecting value)
 */
function isAfterColon(text: string, pos: number): boolean {
  // Look backwards for colon, ignoring whitespace
  for (let i = pos - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ":") return true;
    if (char === "," || char === "{" || char === "[") return false;
    if (!/\s/.test(char) && char !== '"') return false;
  }
  return false;
}

/**
 * Determine the context type from the path
 */
function getContextType(path: string[], currentKey: string | null, expectingValue: boolean): ESContextType {
  if (path.length === 0) {
    return "root";
  }

  // Check current key for field value context
  if (expectingValue && currentKey && FIELD_VALUE_KEYS.has(currentKey)) {
    return "field_value";
  }

  // Check for value context
  if (expectingValue && currentKey && VALUE_TYPE_KEYS[currentKey]) {
    return "value";
  }

  // Walk path from end to find context
  for (let i = path.length - 1; i >= 0; i--) {
    const segment = path[i];
    if (PATH_CONTEXTS[segment]) {
      // Special case for aggregation definitions
      if (PATH_CONTEXTS[segment] === "aggs" && i < path.length - 1) {
        return "agg_def";
      }
      return PATH_CONTEXTS[segment];
    }
  }

  // Check if we're in a query type definition
  if (path.includes("query") || path.some(p => ["must", "should", "filter", "must_not"].includes(p))) {
    return "query";
  }

  return "unknown";
}

/**
 * Get expected types for current context
 */
function getExpectedTypes(contextType: ESContextType, currentKey: string | null): string[] | undefined {
  if (currentKey && VALUE_TYPE_KEYS[currentKey]) {
    return VALUE_TYPE_KEYS[currentKey];
  }

  switch (contextType) {
    case "bool":
      return ["must", "should", "filter", "must_not", "minimum_should_match", "boost"];
    case "query":
      return ["match", "term", "bool", "range", "exists", "prefix", "wildcard"];
    case "aggs":
      return ["terms", "histogram", "date_histogram", "avg", "sum", "min", "max"];
    case "sort":
      return ["asc", "desc", "order", "mode", "missing"];
    default:
      return undefined;
  }
}

/**
 * Main context parser function
 */
export function getESContext(state: EditorStateDoc, pos: number): ESContext {
  const doc = state.doc;
  const text = doc.toString();

  // Parse JSON structure
  const jsonState = parseJsonContext(text, pos);

  // Get current word
  const currentWord = getCurrentWord(text, pos);

  // Check if in string
  const inString = isInString(text, pos);

  // Check if after colon
  const afterColon = isAfterColon(text, pos) || jsonState.expectingValue;

  // Determine context type
  const contextType = getContextType(jsonState.path, jsonState.currentKey, afterColon);

  // Get expected types
  const expectedTypes = getExpectedTypes(contextType, jsonState.currentKey);

  return {
    type: contextType,
    path: jsonState.path,
    currentKey: jsonState.currentKey || undefined,
    parentKey: jsonState.path.length > 0 ? jsonState.path[jsonState.path.length - 1] : undefined,
    inArray: jsonState.inArray,
    arrayIndex: undefined, // Could be computed if needed
    depth: jsonState.depth,
    expectedTypes,
    cursorPos: pos,
    currentWord,
    inString,
    afterColon,
  };
}

/**
 * Check if we're at a position where a new query type can be added
 */
export function canAddQueryType(context: ESContext): boolean {
  return (
    context.type === "query" ||
    context.type === "bool_clause" ||
    (context.type === "root" && !context.afterColon)
  );
}

/**
 * Check if we're at a position where an aggregation can be added
 */
export function canAddAggregation(context: ESContext): boolean {
  return context.type === "aggs" || context.type === "agg_def";
}

/**
 * Check if we're expecting a field name
 */
export function expectsFieldName(context: ESContext): boolean {
  return (
    context.type === "field_value" ||
    (context.afterColon === true && !!context.currentKey && FIELD_VALUE_KEYS.has(context.currentKey))
  );
}

/**
 * Get the parent query type if inside a query
 */
export function getParentQueryType(context: ESContext): string | undefined {
  const queryTypes = [
    "match", "match_phrase", "multi_match", "term", "terms", "range",
    "bool", "exists", "prefix", "wildcard", "regexp", "fuzzy",
    "nested", "has_child", "has_parent", "geo_distance", "geo_bounding_box",
  ];

  for (const segment of context.path) {
    if (queryTypes.includes(segment)) {
      return segment;
    }
  }
  return undefined;
}

/**
 * Get the parent aggregation type if inside an aggregation
 */
export function getParentAggType(context: ESContext): string | undefined {
  const aggTypes = [
    "terms", "histogram", "date_histogram", "range", "filter", "filters",
    "avg", "sum", "min", "max", "stats", "cardinality", "percentiles",
    "composite", "nested", "top_hits",
  ];

  for (const segment of context.path) {
    if (aggTypes.includes(segment)) {
      return segment;
    }
  }
  return undefined;
}
