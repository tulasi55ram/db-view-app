/**
 * Types for Elasticsearch Query DSL autocomplete
 *
 * Elasticsearch uses JSON-based Query DSL with:
 * - Query types (match, term, bool, range, etc.)
 * - Aggregations (terms, histogram, avg, etc.)
 * - Nested structures (bool with must/should/filter)
 * - Field references from index mappings
 */

// JSON path context types
export type ESContextType =
  | "root"           // Top level of the query
  | "query"          // Inside "query" object
  | "bool"           // Inside bool query
  | "bool_clause"    // Inside must/should/filter/must_not array
  | "aggs"           // Inside "aggs" object
  | "agg_def"        // Inside an aggregation definition
  | "sort"           // Inside "sort" array
  | "highlight"      // Inside "highlight" object
  | "source"         // Inside "_source" configuration
  | "suggest"        // Inside "suggest" object
  | "field_value"    // Expecting a field name as value
  | "value"          // Expecting a value
  | "unknown";

// Query type categories
export type ESQueryCategory =
  | "full_text"      // match, match_phrase, multi_match
  | "term_level"     // term, terms, range, exists
  | "compound"       // bool, boosting, constant_score, dis_max
  | "nested"         // nested, has_child, has_parent
  | "geo"            // geo_distance, geo_bounding_box
  | "specialized";   // percolate, rank_feature

// Aggregation type categories
export type ESAggCategory =
  | "metric"         // avg, sum, min, max, stats, cardinality
  | "bucket"         // terms, histogram, date_histogram, range
  | "pipeline";      // derivative, cumulative_sum, moving_avg

// Query type definition
export interface ESQueryType {
  name: string;
  category: ESQueryCategory;
  description: string;
  template: string;         // JSON template for this query type
  requiredFields?: string[]; // Required fields for this query
  optionalFields?: string[]; // Optional fields
}

// Aggregation type definition
export interface ESAggType {
  name: string;
  category: ESAggCategory;
  description: string;
  template: string;
  requiredFields?: string[];
  optionalFields?: string[];
}

// Context at cursor position
export interface ESContext {
  type: ESContextType;
  path: string[];           // JSON path to current position (e.g., ["query", "bool", "must"])
  currentKey?: string;      // Current key being typed
  parentKey?: string;       // Parent key
  inArray: boolean;         // Inside an array
  arrayIndex?: number;      // Index in array if applicable
  depth: number;            // Nesting depth
  expectedTypes?: string[]; // Expected value types at this position
  cursorPos: number;
  currentWord: string;
  inString: boolean;
  afterColon: boolean;      // After "key": (expecting value)
}

// Field information from index mapping
export interface ESFieldInfo {
  name: string;
  type: ESFieldType;
  nested?: boolean;
  properties?: ESFieldInfo[];  // For object/nested types
  analyzer?: string;
}

export type ESFieldType =
  | "text"
  | "keyword"
  | "long"
  | "integer"
  | "short"
  | "byte"
  | "double"
  | "float"
  | "date"
  | "boolean"
  | "binary"
  | "geo_point"
  | "geo_shape"
  | "ip"
  | "completion"
  | "nested"
  | "object"
  | "flattened";

// Autocomplete data from the application
export interface ESAutocompleteData {
  indices?: string[];
  fields?: Record<string, ESFieldInfo[]>;  // index -> fields
  aliases?: string[];
}

// Completion item
export interface ESCompletion {
  label: string;
  type: ESCompletionType;
  detail?: string;
  info?: string;
  boost?: number;
  apply?: string;           // Text to insert
  template?: string;        // JSON template to insert
}

export type ESCompletionType =
  | "property"      // JSON property key
  | "query_type"    // Query type (match, term, etc.)
  | "agg_type"      // Aggregation type
  | "field"         // Field name
  | "keyword"       // ES keyword (must, should, etc.)
  | "value"         // Value suggestion
  | "snippet"       // Full snippet
  | "operator";     // Operator like "and", "or"
