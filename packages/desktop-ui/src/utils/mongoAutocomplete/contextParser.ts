/**
 * MongoDB Query Context Parser
 *
 * Parses JSON structure to determine cursor context for autocomplete.
 * Handles MongoDB-specific contexts:
 * - Find queries with operators
 * - Aggregation pipelines with stages
 * - Update operations
 * - Field paths
 */

import type { MongoContext, MongoContextType } from "./types";

// Accept generic state object with doc.toString()
interface EditorStateDoc {
  doc: { toString: () => string };
}

// Stage names that indicate we're in a pipeline
const PIPELINE_STAGES = new Set([
  "$match", "$project", "$addFields", "$set", "$unset", "$group",
  "$sort", "$limit", "$skip", "$unwind", "$lookup", "$graphLookup",
  "$facet", "$bucket", "$bucketAuto", "$count", "$sortByCount",
  "$sample", "$replaceRoot", "$replaceWith", "$merge", "$out",
  "$unionWith", "$redact", "$setWindowFields", "$densify", "$fill",
]);

// Keys that indicate we're in a query context
const QUERY_KEYS = new Set([
  "find", "filter", "$match", "query",
]);

// Keys that indicate we're in an update context
const UPDATE_KEYS = new Set([
  "update", "$set", "$unset", "$inc", "$push", "$pull", "$addToSet",
]);

// Keys that indicate we're in a projection context
const PROJECTION_KEYS = new Set([
  "projection", "$project", "fields",
]);

// Keys that indicate we're in a sort context
const SORT_KEYS = new Set([
  "sort", "$sort",
]);

// Keys that indicate a group accumulator context
const GROUP_ACCUM_CONTEXT = new Set([
  "$sum", "$avg", "$min", "$max", "$first", "$last",
  "$push", "$addToSet", "$stdDevPop", "$stdDevSamp", "$count",
]);

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
  inPipeline: boolean;
  currentStage: string | null;
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
    inPipeline: false,
    currentStage: null,
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
        // Check if this is a pipeline stage
        if (PIPELINE_STAGES.has(lastKey)) {
          state.inPipeline = true;
          state.currentStage = lastKey;
        }
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
        const popped = state.path.pop();
        // Check if we're leaving a pipeline stage
        if (popped && PIPELINE_STAGES.has(popped)) {
          state.currentStage = null;
        }
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
        // Check for pipeline array
        if (lastKey === "pipeline" || lastKey === "aggregate") {
          state.inPipeline = true;
        }
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
        const popped = state.path.pop();
        if (popped === "pipeline" || popped === "aggregate") {
          state.inPipeline = false;
        }
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
function getContextType(
  path: string[],
  currentKey: string | null,
  expectingValue: boolean,
  inPipeline: boolean,
  currentStage: string | null,
  inArray: boolean
): MongoContextType {
  if (path.length === 0) {
    return "root";
  }

  // Check for pipeline context
  if (inPipeline) {
    if (path.includes("pipeline") || path.includes("aggregate")) {
      if (inArray && !currentStage) {
        return "pipeline";
      }
    }

    if (currentStage) {
      // Inside a specific stage
      if (currentStage === "$group") {
        if (expectingValue && currentKey && !currentKey.startsWith("$") && currentKey !== "_id") {
          return "group_accumulator";
        }
        return "group";
      }
      if (currentStage === "$project" || currentStage === "$addFields" || currentStage === "$set") {
        return "project_expr";
      }
      if (currentStage === "$match") {
        return "query";
      }
      if (currentStage === "$sort") {
        return "sort";
      }
      return "stage_body";
    }

    return "stage";
  }

  // Check for command-level context
  const lastPath = path[path.length - 1];

  if (QUERY_KEYS.has(lastPath)) {
    return "query";
  }

  if (UPDATE_KEYS.has(lastPath)) {
    return "update";
  }

  if (PROJECTION_KEYS.has(lastPath)) {
    return "projection";
  }

  if (SORT_KEYS.has(lastPath)) {
    return "sort";
  }

  // Check if we're in a group accumulator
  if (GROUP_ACCUM_CONTEXT.has(lastPath)) {
    return "group_accumulator";
  }

  // Check for field path context
  if (expectingValue) {
    // If we're expecting a value after a key that's a $ operator, we might expect a field path
    if (currentKey && !currentKey.startsWith("$")) {
      return "value";
    }
    return "value";
  }

  // Check if we're in a nested query context
  if (path.some(p => QUERY_KEYS.has(p))) {
    return "query";
  }

  return "unknown";
}

/**
 * Check if we expect a field path ($fieldName)
 */
function expectsFieldPath(context: MongoContext): boolean {
  // In aggregation expressions, we often expect field paths
  if (context.type === "project_expr" || context.type === "group_accumulator" || context.type === "stage_body") {
    return context.afterColon;
  }
  // After $expr, we expect aggregation expressions with field paths
  if (context.path.includes("$expr")) {
    return true;
  }
  return false;
}

/**
 * Main context parser function
 */
export function getMongoContext(state: EditorStateDoc, pos: number): MongoContext {
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
  const contextType = getContextType(
    jsonState.path,
    jsonState.currentKey,
    afterColon,
    jsonState.inPipeline,
    jsonState.currentStage,
    jsonState.inArray
  );

  const context: MongoContext = {
    type: contextType,
    path: jsonState.path,
    currentKey: jsonState.currentKey || undefined,
    parentKey: jsonState.path.length > 0 ? jsonState.path[jsonState.path.length - 1] : undefined,
    inArray: jsonState.inArray,
    arrayIndex: undefined,
    depth: jsonState.depth,
    cursorPos: pos,
    currentWord,
    inString,
    afterColon,
    inPipeline: jsonState.inPipeline,
    currentStage: jsonState.currentStage || undefined,
    expectsFieldPath: false,
  };

  // Set expectsFieldPath
  context.expectsFieldPath = expectsFieldPath(context);

  return context;
}

/**
 * Check if we're at a position where an operator can be added
 */
export function canAddOperator(context: MongoContext): boolean {
  return (
    context.type === "query" ||
    context.type === "update" ||
    (context.type === "value" && !context.afterColon)
  );
}

/**
 * Check if we're at a position where a pipeline stage can be added
 */
export function canAddStage(context: MongoContext): boolean {
  return context.type === "pipeline" || (context.inPipeline && context.inArray && !context.currentStage);
}

/**
 * Check if we're at a position where an accumulator can be added
 */
export function canAddAccumulator(context: MongoContext): boolean {
  return context.type === "group" || context.type === "group_accumulator";
}

/**
 * Check if we're at a position where an expression can be added
 */
export function canAddExpression(context: MongoContext): boolean {
  return (
    context.type === "project_expr" ||
    context.type === "group_accumulator" ||
    context.type === "stage_body" ||
    context.path.includes("$expr")
  );
}
