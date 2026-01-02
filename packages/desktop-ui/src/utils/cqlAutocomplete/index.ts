/**
 * CQL Autocomplete - Cassandra Query Language autocomplete for CodeMirror 6
 *
 * Features:
 * - Context-aware keyword suggestions
 * - CQL-specific functions (uuid, timeuuid, TTL, etc.)
 * - Partition key and clustering column awareness
 * - BATCH statement support
 * - USING clause (TTL/TIMESTAMP) completions
 * - ALLOW FILTERING awareness
 * - Lightweight transaction (LWT) support
 * - Table and column completions from metadata
 * - Smart snippets for common CQL patterns
 */

// Main completion provider
export { createSmartCqlCompletion } from "./completionProvider";

// Context parser
export { getCqlContext } from "./contextParser";

// Types
export type {
  CqlClause,
  CqlExpectedType,
  CqlContext,
  CqlTableReference,
  CqlAutocompleteData,
  CqlColumnMetadata,
  CqlFunction,
  CqlKeyword,
  CqlOperator,
  CqlDataType,
  CqlTableInfo,
} from "./types";

// Keywords, operators, and data types
export {
  CQL_KEYWORDS,
  CQL_OPERATORS,
  CQL_DATA_TYPES,
  getCqlKeywordsForContext,
  getCqlOperatorsForContext,
} from "./keywords";

// Functions
export { CQL_FUNCTIONS } from "./functions";
