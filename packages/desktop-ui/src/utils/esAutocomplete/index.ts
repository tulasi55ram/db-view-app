/**
 * Elasticsearch Query DSL Autocomplete
 *
 * Context-aware autocomplete for Elasticsearch Query DSL.
 * Provides intelligent completions for:
 * - Query types (match, term, bool, range, etc.)
 * - Aggregations (terms, histogram, avg, etc.)
 * - Field references from index mappings
 * - Snippets for common patterns
 */

// Types
export type {
  ESContext,
  ESContextType,
  ESQueryType,
  ESQueryCategory,
  ESAggType,
  ESAggCategory,
  ESFieldInfo,
  ESFieldType,
  ESAutocompleteData,
  ESCompletion,
  ESCompletionType,
} from "./types";

// Context parser
export {
  getESContext,
  canAddQueryType,
  canAddAggregation,
  expectsFieldName,
  getParentQueryType,
} from "./contextParser";

// Query and aggregation definitions
export {
  FULL_TEXT_QUERIES,
  TERM_LEVEL_QUERIES,
  COMPOUND_QUERIES,
  NESTED_QUERIES,
  GEO_QUERIES,
  SPECIAL_QUERIES,
  ALL_QUERY_TYPES,
  METRIC_AGGS,
  BUCKET_AGGS,
  PIPELINE_AGGS,
  ALL_AGG_TYPES,
  getQueryType,
  searchQueryTypes,
  getAggType,
  searchAggTypes,
} from "./queries";

// Completion provider
export {
  createSmartESCompletion,
  createBasicESCompletion,
} from "./completionProvider";
