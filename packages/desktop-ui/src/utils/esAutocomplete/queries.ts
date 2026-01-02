/**
 * Elasticsearch Query DSL Definitions
 *
 * Comprehensive query type definitions for context-aware autocomplete.
 */

import type { ESQueryType, ESAggType } from "./types";

// Full-text queries
export const FULL_TEXT_QUERIES: ESQueryType[] = [
  {
    name: "match",
    category: "full_text",
    description: "Standard full-text search with analysis",
    template: `"match": { "\${1:field}": "\${2:text}" }`,
    requiredFields: ["query"],
    optionalFields: ["operator", "fuzziness", "prefix_length", "analyzer", "boost"],
  },
  {
    name: "match_phrase",
    category: "full_text",
    description: "Match exact phrase in order",
    template: `"match_phrase": { "\${1:field}": "\${2:phrase}" }`,
    optionalFields: ["slop", "analyzer", "boost"],
  },
  {
    name: "match_phrase_prefix",
    category: "full_text",
    description: "Match phrase with prefix on last term",
    template: `"match_phrase_prefix": { "\${1:field}": "\${2:prefix}" }`,
    optionalFields: ["max_expansions", "slop", "analyzer"],
  },
  {
    name: "multi_match",
    category: "full_text",
    description: "Search multiple fields",
    template: `"multi_match": {
  "query": "\${1:text}",
  "fields": ["\${2:field1}", "\${3:field2}"]
}`,
    requiredFields: ["query", "fields"],
    optionalFields: ["type", "operator", "tie_breaker", "fuzziness"],
  },
  {
    name: "query_string",
    category: "full_text",
    description: "Lucene query syntax",
    template: `"query_string": {
  "query": "\${1:field:value AND other}",
  "default_field": "\${2:content}"
}`,
    requiredFields: ["query"],
    optionalFields: ["default_field", "fields", "default_operator", "analyzer"],
  },
  {
    name: "simple_query_string",
    category: "full_text",
    description: "Simple query syntax for users",
    template: `"simple_query_string": {
  "query": "\${1:text}",
  "fields": ["\${2:field}"]
}`,
    requiredFields: ["query"],
    optionalFields: ["fields", "default_operator", "flags"],
  },
  {
    name: "combined_fields",
    category: "full_text",
    description: "Search across multiple fields as one",
    template: `"combined_fields": {
  "query": "\${1:text}",
  "fields": ["\${2:field1}", "\${3:field2}"]
}`,
    requiredFields: ["query", "fields"],
    optionalFields: ["operator", "minimum_should_match"],
  },
];

// Term-level queries
export const TERM_LEVEL_QUERIES: ESQueryType[] = [
  {
    name: "term",
    category: "term_level",
    description: "Exact value match (no analysis)",
    template: `"term": { "\${1:field}": "\${2:value}" }`,
    optionalFields: ["boost", "case_insensitive"],
  },
  {
    name: "terms",
    category: "term_level",
    description: "Match any of multiple values",
    template: `"terms": { "\${1:field}": ["\${2:value1}", "\${3:value2}"] }`,
    optionalFields: ["boost"],
  },
  {
    name: "terms_set",
    category: "term_level",
    description: "Match minimum number of terms",
    template: `"terms_set": {
  "\${1:field}": {
    "terms": ["\${2:val1}", "\${3:val2}"],
    "minimum_should_match_script": { "source": "\${4:2}" }
  }
}`,
  },
  {
    name: "range",
    category: "term_level",
    description: "Match values in a range",
    template: `"range": {
  "\${1:field}": {
    "gte": \${2:0},
    "lte": \${3:100}
  }
}`,
    optionalFields: ["gte", "gt", "lte", "lt", "format", "time_zone", "boost"],
  },
  {
    name: "exists",
    category: "term_level",
    description: "Match documents with field",
    template: `"exists": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "prefix",
    category: "term_level",
    description: "Match terms with prefix",
    template: `"prefix": { "\${1:field}": "\${2:prefix}" }`,
    optionalFields: ["boost", "rewrite", "case_insensitive"],
  },
  {
    name: "wildcard",
    category: "term_level",
    description: "Wildcard pattern match",
    template: `"wildcard": { "\${1:field}": "\${2:pattern*}" }`,
    optionalFields: ["boost", "rewrite", "case_insensitive"],
  },
  {
    name: "regexp",
    category: "term_level",
    description: "Regular expression match",
    template: `"regexp": {
  "\${1:field}": {
    "value": "\${2:pattern}",
    "flags": "ALL"
  }
}`,
    optionalFields: ["flags", "max_determinized_states", "rewrite"],
  },
  {
    name: "fuzzy",
    category: "term_level",
    description: "Fuzzy (typo-tolerant) match",
    template: `"fuzzy": {
  "\${1:field}": {
    "value": "\${2:text}",
    "fuzziness": "AUTO"
  }
}`,
    optionalFields: ["fuzziness", "max_expansions", "prefix_length", "transpositions"],
  },
  {
    name: "ids",
    category: "term_level",
    description: "Match documents by ID",
    template: `"ids": { "values": ["\${1:id1}", "\${2:id2}"] }`,
    requiredFields: ["values"],
  },
];

// Compound queries
export const COMPOUND_QUERIES: ESQueryType[] = [
  {
    name: "bool",
    category: "compound",
    description: "Combine multiple queries",
    template: `"bool": {
  "must": [\${1}],
  "filter": [\${2}],
  "should": [\${3}],
  "must_not": [\${4}]
}`,
    optionalFields: ["must", "filter", "should", "must_not", "minimum_should_match", "boost"],
  },
  {
    name: "boosting",
    category: "compound",
    description: "Boost or demote results",
    template: `"boosting": {
  "positive": { \${1} },
  "negative": { \${2} },
  "negative_boost": \${3:0.5}
}`,
    requiredFields: ["positive", "negative", "negative_boost"],
  },
  {
    name: "constant_score",
    category: "compound",
    description: "Return constant score",
    template: `"constant_score": {
  "filter": { \${1} },
  "boost": \${2:1.0}
}`,
    requiredFields: ["filter"],
    optionalFields: ["boost"],
  },
  {
    name: "dis_max",
    category: "compound",
    description: "Best matching subquery",
    template: `"dis_max": {
  "queries": [\${1}],
  "tie_breaker": \${2:0.7}
}`,
    requiredFields: ["queries"],
    optionalFields: ["tie_breaker", "boost"],
  },
  {
    name: "function_score",
    category: "compound",
    description: "Custom scoring functions",
    template: `"function_score": {
  "query": { \${1} },
  "functions": [
    { "filter": { \${2} }, "weight": \${3:2} }
  ],
  "score_mode": "sum",
  "boost_mode": "multiply"
}`,
    requiredFields: ["query"],
    optionalFields: ["functions", "score_mode", "boost_mode", "max_boost", "min_score"],
  },
];

// Nested/joining queries
export const NESTED_QUERIES: ESQueryType[] = [
  {
    name: "nested",
    category: "nested",
    description: "Query nested objects",
    template: `"nested": {
  "path": "\${1:nested_field}",
  "query": { \${2} }
}`,
    requiredFields: ["path", "query"],
    optionalFields: ["score_mode", "inner_hits", "ignore_unmapped"],
  },
  {
    name: "has_child",
    category: "nested",
    description: "Match parent by child",
    template: `"has_child": {
  "type": "\${1:child_type}",
  "query": { \${2} }
}`,
    requiredFields: ["type", "query"],
    optionalFields: ["min_children", "max_children", "score_mode", "inner_hits"],
  },
  {
    name: "has_parent",
    category: "nested",
    description: "Match child by parent",
    template: `"has_parent": {
  "parent_type": "\${1:parent_type}",
  "query": { \${2} }
}`,
    requiredFields: ["parent_type", "query"],
    optionalFields: ["score", "inner_hits", "ignore_unmapped"],
  },
];

// Geo queries
export const GEO_QUERIES: ESQueryType[] = [
  {
    name: "geo_distance",
    category: "geo",
    description: "Filter by distance from point",
    template: `"geo_distance": {
  "distance": "\${1:10km}",
  "\${2:location}": {
    "lat": \${3:40.73},
    "lon": \${4:-73.99}
  }
}`,
    requiredFields: ["distance"],
  },
  {
    name: "geo_bounding_box",
    category: "geo",
    description: "Filter by bounding box",
    template: `"geo_bounding_box": {
  "\${1:location}": {
    "top_left": { "lat": \${2:41.0}, "lon": \${3:-74.0} },
    "bottom_right": { "lat": \${4:40.0}, "lon": \${5:-73.0} }
  }
}`,
  },
  {
    name: "geo_shape",
    category: "geo",
    description: "Filter by shape intersection",
    template: `"geo_shape": {
  "\${1:location}": {
    "shape": {
      "type": "\${2:circle}",
      "coordinates": [\${3:-73.99}, \${4:40.73}],
      "radius": "\${5:5km}"
    }
  }
}`,
  },
  {
    name: "geo_polygon",
    category: "geo",
    description: "Filter by polygon",
    template: `"geo_polygon": {
  "\${1:location}": {
    "points": [
      { "lat": \${2:40}, "lon": \${3:-74} },
      { "lat": \${4:41}, "lon": \${5:-73} },
      { "lat": \${6:40}, "lon": \${7:-72} }
    ]
  }
}`,
  },
];

// Special queries
export const SPECIAL_QUERIES: ESQueryType[] = [
  {
    name: "match_all",
    category: "specialized",
    description: "Match all documents",
    template: `"match_all": {}`,
    optionalFields: ["boost"],
  },
  {
    name: "match_none",
    category: "specialized",
    description: "Match no documents",
    template: `"match_none": {}`,
  },
  {
    name: "script",
    category: "specialized",
    description: "Script-based query",
    template: `"script": {
  "script": {
    "source": "\${1:doc['field'].value > params.value}",
    "params": { "value": \${2:5} }
  }
}`,
  },
  {
    name: "percolate",
    category: "specialized",
    description: "Percolator query",
    template: `"percolate": {
  "field": "\${1:query}",
  "document": { \${2} }
}`,
    requiredFields: ["field"],
    optionalFields: ["document", "documents", "index", "id"],
  },
  {
    name: "wrapper",
    category: "specialized",
    description: "Base64 encoded query",
    template: `"wrapper": { "query": "\${1:base64_encoded_query}" }`,
    requiredFields: ["query"],
  },
];

// All query types
export const ALL_QUERY_TYPES: ESQueryType[] = [
  ...FULL_TEXT_QUERIES,
  ...TERM_LEVEL_QUERIES,
  ...COMPOUND_QUERIES,
  ...NESTED_QUERIES,
  ...GEO_QUERIES,
  ...SPECIAL_QUERIES,
];

// Query type lookup by name
export const QUERY_TYPE_MAP = new Map<string, ESQueryType>(
  ALL_QUERY_TYPES.map((q) => [q.name, q])
);

// Get query type by name
export function getQueryType(name: string): ESQueryType | undefined {
  return QUERY_TYPE_MAP.get(name);
}

// Search query types by prefix
export function searchQueryTypes(prefix: string): ESQueryType[] {
  const lower = prefix.toLowerCase();
  return ALL_QUERY_TYPES.filter((q) => q.name.toLowerCase().startsWith(lower));
}

// Metric aggregations
export const METRIC_AGGS: ESAggType[] = [
  {
    name: "avg",
    category: "metric",
    description: "Average value",
    template: `"avg": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
    optionalFields: ["missing", "script"],
  },
  {
    name: "sum",
    category: "metric",
    description: "Sum of values",
    template: `"sum": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "min",
    category: "metric",
    description: "Minimum value",
    template: `"min": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "max",
    category: "metric",
    description: "Maximum value",
    template: `"max": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "stats",
    category: "metric",
    description: "Basic statistics (min, max, sum, count, avg)",
    template: `"stats": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "extended_stats",
    category: "metric",
    description: "Extended statistics with variance, std deviation",
    template: `"extended_stats": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
    optionalFields: ["sigma"],
  },
  {
    name: "cardinality",
    category: "metric",
    description: "Approximate unique count",
    template: `"cardinality": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
    optionalFields: ["precision_threshold"],
  },
  {
    name: "value_count",
    category: "metric",
    description: "Count of values",
    template: `"value_count": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "percentiles",
    category: "metric",
    description: "Percentile values",
    template: `"percentiles": {
  "field": "\${1:field}",
  "percents": [50, 90, 95, 99]
}`,
    requiredFields: ["field"],
    optionalFields: ["percents", "keyed", "tdigest", "hdr"],
  },
  {
    name: "percentile_ranks",
    category: "metric",
    description: "Percentile rank of values",
    template: `"percentile_ranks": {
  "field": "\${1:field}",
  "values": [\${2:100}, \${3:200}]
}`,
    requiredFields: ["field", "values"],
  },
  {
    name: "top_hits",
    category: "metric",
    description: "Top matching documents per bucket",
    template: `"top_hits": {
  "size": \${1:3},
  "sort": [{ "\${2:date}": "desc" }],
  "_source": { "includes": ["\${3:title}"] }
}`,
    optionalFields: ["size", "sort", "_source", "from"],
  },
  {
    name: "geo_bounds",
    category: "metric",
    description: "Bounding box of geo points",
    template: `"geo_bounds": { "field": "\${1:location}" }`,
    requiredFields: ["field"],
    optionalFields: ["wrap_longitude"],
  },
  {
    name: "geo_centroid",
    category: "metric",
    description: "Centroid of geo points",
    template: `"geo_centroid": { "field": "\${1:location}" }`,
    requiredFields: ["field"],
  },
];

// Bucket aggregations
export const BUCKET_AGGS: ESAggType[] = [
  {
    name: "terms",
    category: "bucket",
    description: "Group by field values",
    template: `"terms": {
  "field": "\${1:field}.keyword",
  "size": \${2:10}
}`,
    requiredFields: ["field"],
    optionalFields: ["size", "order", "min_doc_count", "missing", "include", "exclude"],
  },
  {
    name: "histogram",
    category: "bucket",
    description: "Fixed-width numeric buckets",
    template: `"histogram": {
  "field": "\${1:field}",
  "interval": \${2:50}
}`,
    requiredFields: ["field", "interval"],
    optionalFields: ["min_doc_count", "extended_bounds", "offset", "order"],
  },
  {
    name: "date_histogram",
    category: "bucket",
    description: "Date/time buckets",
    template: `"date_histogram": {
  "field": "\${1:date}",
  "calendar_interval": "\${2:month}"
}`,
    requiredFields: ["field"],
    optionalFields: ["calendar_interval", "fixed_interval", "format", "time_zone", "offset", "min_doc_count"],
  },
  {
    name: "range",
    category: "bucket",
    description: "Custom numeric ranges",
    template: `"range": {
  "field": "\${1:field}",
  "ranges": [
    { "to": \${2:50} },
    { "from": \${3:50}, "to": \${4:100} },
    { "from": \${5:100} }
  ]
}`,
    requiredFields: ["field", "ranges"],
    optionalFields: ["keyed"],
  },
  {
    name: "date_range",
    category: "bucket",
    description: "Custom date ranges",
    template: `"date_range": {
  "field": "\${1:date}",
  "format": "yyyy-MM-dd",
  "ranges": [
    { "to": "now-1M/M" },
    { "from": "now-1M/M", "to": "now" }
  ]
}`,
    requiredFields: ["field", "ranges"],
    optionalFields: ["format", "time_zone", "keyed"],
  },
  {
    name: "filter",
    category: "bucket",
    description: "Single filter bucket",
    template: `"filter": { \${1} }`,
  },
  {
    name: "filters",
    category: "bucket",
    description: "Multiple named filter buckets",
    template: `"filters": {
  "filters": {
    "\${1:bucket1}": { \${2} },
    "\${3:bucket2}": { \${4} }
  }
}`,
    optionalFields: ["other_bucket", "other_bucket_key"],
  },
  {
    name: "nested",
    category: "bucket",
    description: "Aggregate nested objects",
    template: `"nested": { "path": "\${1:nested_field}" }`,
    requiredFields: ["path"],
  },
  {
    name: "reverse_nested",
    category: "bucket",
    description: "Back to parent from nested",
    template: `"reverse_nested": {}`,
    optionalFields: ["path"],
  },
  {
    name: "composite",
    category: "bucket",
    description: "Paginated multi-source aggregation",
    template: `"composite": {
  "size": \${1:100},
  "sources": [
    { "\${2:field1}": { "terms": { "field": "\${3:field1}.keyword" } } }
  ]
}`,
    requiredFields: ["sources"],
    optionalFields: ["size", "after"],
  },
  {
    name: "auto_date_histogram",
    category: "bucket",
    description: "Automatic date interval",
    template: `"auto_date_histogram": {
  "field": "\${1:date}",
  "buckets": \${2:10}
}`,
    requiredFields: ["field"],
    optionalFields: ["buckets", "format", "time_zone", "minimum_interval"],
  },
  {
    name: "significant_terms",
    category: "bucket",
    description: "Statistically significant terms",
    template: `"significant_terms": {
  "field": "\${1:field}.keyword"
}`,
    requiredFields: ["field"],
    optionalFields: ["size", "min_doc_count", "background_filter"],
  },
  {
    name: "adjacency_matrix",
    category: "bucket",
    description: "Relationship between filters",
    template: `"adjacency_matrix": {
  "filters": {
    "\${1:filter1}": { \${2} },
    "\${3:filter2}": { \${4} }
  }
}`,
    requiredFields: ["filters"],
  },
  {
    name: "sampler",
    category: "bucket",
    description: "Sample documents",
    template: `"sampler": { "shard_size": \${1:100} }`,
    optionalFields: ["shard_size"],
  },
  {
    name: "diversified_sampler",
    category: "bucket",
    description: "Diverse sample by field",
    template: `"diversified_sampler": {
  "shard_size": \${1:100},
  "field": "\${2:field}"
}`,
    optionalFields: ["shard_size", "field", "max_docs_per_value"],
  },
  {
    name: "global",
    category: "bucket",
    description: "All documents (ignore query)",
    template: `"global": {}`,
  },
  {
    name: "missing",
    category: "bucket",
    description: "Documents missing field",
    template: `"missing": { "field": "\${1:field}" }`,
    requiredFields: ["field"],
  },
  {
    name: "geo_distance",
    category: "bucket",
    description: "Distance rings from point",
    template: `"geo_distance": {
  "field": "\${1:location}",
  "origin": { "lat": \${2:40.73}, "lon": \${3:-73.99} },
  "ranges": [
    { "to": 10 },
    { "from": 10, "to": 50 },
    { "from": 50 }
  ],
  "unit": "km"
}`,
    requiredFields: ["field", "origin", "ranges"],
    optionalFields: ["unit", "distance_type"],
  },
  {
    name: "geohash_grid",
    category: "bucket",
    description: "Geohash grid buckets",
    template: `"geohash_grid": {
  "field": "\${1:location}",
  "precision": \${2:5}
}`,
    requiredFields: ["field"],
    optionalFields: ["precision", "size", "shard_size", "bounds"],
  },
];

// Pipeline aggregations
export const PIPELINE_AGGS: ESAggType[] = [
  {
    name: "derivative",
    category: "pipeline",
    description: "Derivative of metric",
    template: `"derivative": { "buckets_path": "\${1:metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["gap_policy", "format", "unit"],
  },
  {
    name: "cumulative_sum",
    category: "pipeline",
    description: "Cumulative sum",
    template: `"cumulative_sum": { "buckets_path": "\${1:metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["format"],
  },
  {
    name: "moving_avg",
    category: "pipeline",
    description: "Moving average",
    template: `"moving_avg": {
  "buckets_path": "\${1:metric_name}",
  "window": \${2:5}
}`,
    requiredFields: ["buckets_path"],
    optionalFields: ["model", "window", "settings", "minimize", "predict"],
  },
  {
    name: "moving_fn",
    category: "pipeline",
    description: "Moving function",
    template: `"moving_fn": {
  "buckets_path": "\${1:metric_name}",
  "window": \${2:5},
  "script": "MovingFunctions.unweightedAvg(values)"
}`,
    requiredFields: ["buckets_path", "script"],
    optionalFields: ["window", "gap_policy", "shift"],
  },
  {
    name: "bucket_script",
    category: "pipeline",
    description: "Custom bucket calculation",
    template: `"bucket_script": {
  "buckets_path": {
    "var1": "\${1:metric1}",
    "var2": "\${2:metric2}"
  },
  "script": "params.var1 / params.var2"
}`,
    requiredFields: ["buckets_path", "script"],
    optionalFields: ["format", "gap_policy"],
  },
  {
    name: "bucket_selector",
    category: "pipeline",
    description: "Filter buckets",
    template: `"bucket_selector": {
  "buckets_path": { "count": "_count" },
  "script": "params.count > 10"
}`,
    requiredFields: ["buckets_path", "script"],
    optionalFields: ["gap_policy"],
  },
  {
    name: "bucket_sort",
    category: "pipeline",
    description: "Sort and truncate buckets",
    template: `"bucket_sort": {
  "sort": [{ "\${1:metric}": { "order": "desc" } }],
  "size": \${2:10}
}`,
    optionalFields: ["sort", "from", "size", "gap_policy"],
  },
  {
    name: "serial_diff",
    category: "pipeline",
    description: "Serial differencing",
    template: `"serial_diff": {
  "buckets_path": "\${1:metric_name}",
  "lag": \${2:1}
}`,
    requiredFields: ["buckets_path"],
    optionalFields: ["lag", "gap_policy", "format"],
  },
  {
    name: "avg_bucket",
    category: "pipeline",
    description: "Average of bucket values",
    template: `"avg_bucket": { "buckets_path": "\${1:agg_name>metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["gap_policy", "format"],
  },
  {
    name: "sum_bucket",
    category: "pipeline",
    description: "Sum of bucket values",
    template: `"sum_bucket": { "buckets_path": "\${1:agg_name>metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["gap_policy", "format"],
  },
  {
    name: "min_bucket",
    category: "pipeline",
    description: "Minimum bucket value",
    template: `"min_bucket": { "buckets_path": "\${1:agg_name>metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["gap_policy", "format"],
  },
  {
    name: "max_bucket",
    category: "pipeline",
    description: "Maximum bucket value",
    template: `"max_bucket": { "buckets_path": "\${1:agg_name>metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["gap_policy", "format"],
  },
  {
    name: "stats_bucket",
    category: "pipeline",
    description: "Stats of bucket values",
    template: `"stats_bucket": { "buckets_path": "\${1:agg_name>metric_name}" }`,
    requiredFields: ["buckets_path"],
    optionalFields: ["gap_policy", "format"],
  },
  {
    name: "percentiles_bucket",
    category: "pipeline",
    description: "Percentiles of bucket values",
    template: `"percentiles_bucket": {
  "buckets_path": "\${1:agg_name>metric_name}",
  "percents": [50, 90, 99]
}`,
    requiredFields: ["buckets_path"],
    optionalFields: ["percents", "gap_policy", "format"],
  },
];

// All aggregation types
export const ALL_AGG_TYPES: ESAggType[] = [
  ...METRIC_AGGS,
  ...BUCKET_AGGS,
  ...PIPELINE_AGGS,
];

// Aggregation type lookup
export const AGG_TYPE_MAP = new Map<string, ESAggType>(
  ALL_AGG_TYPES.map((a) => [a.name, a])
);

// Get aggregation type by name
export function getAggType(name: string): ESAggType | undefined {
  return AGG_TYPE_MAP.get(name);
}

// Search aggregation types by prefix
export function searchAggTypes(prefix: string): ESAggType[] {
  const lower = prefix.toLowerCase();
  return ALL_AGG_TYPES.filter((a) => a.name.toLowerCase().startsWith(lower));
}
