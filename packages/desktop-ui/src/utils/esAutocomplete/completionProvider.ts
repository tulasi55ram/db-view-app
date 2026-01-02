/**
 * Elasticsearch Completion Provider
 *
 * Provides context-aware autocomplete suggestions for ES Query DSL.
 * Features:
 * - Query type completion with templates
 * - Aggregation completion
 * - Field suggestions from index mapping
 * - Snippets for common patterns
 */

import type { CompletionContext, Completion } from "@codemirror/autocomplete";
import type { ESAutocompleteData, ESFieldInfo } from "./types";
import {
  ALL_QUERY_TYPES,
  ALL_AGG_TYPES,
  searchQueryTypes,
  searchAggTypes,
} from "./queries";
import {
  getESContext,
  canAddQueryType,
  canAddAggregation,
  expectsFieldName,
  getParentQueryType,
} from "./contextParser";

// Boost values for different completion types
const BOOST = {
  QUERY_TYPE: 100,
  AGG_TYPE: 95,
  PROPERTY: 90,
  FIELD: 85,
  KEYWORD: 80,
  SNIPPET: 75,
  VALUE: 70,
};

// Root level properties
const ROOT_PROPERTIES = [
  { name: "query", detail: "Query DSL", info: "Define the search query" },
  { name: "aggs", detail: "Aggregations", info: "Define aggregations" },
  { name: "aggregations", detail: "Aggregations", info: "Alias for aggs" },
  { name: "size", detail: "number", info: "Number of hits to return" },
  { name: "from", detail: "number", info: "Starting offset for results" },
  { name: "sort", detail: "array", info: "Sort order for results" },
  { name: "_source", detail: "array/object", info: "Control source fields returned" },
  { name: "highlight", detail: "object", info: "Highlight matching text" },
  { name: "suggest", detail: "object", info: "Suggester configuration" },
  { name: "track_total_hits", detail: "boolean/number", info: "Track accurate hit count" },
  { name: "timeout", detail: "string", info: "Search timeout (e.g., '10s')" },
  { name: "terminate_after", detail: "number", info: "Max docs to collect per shard" },
  { name: "min_score", detail: "number", info: "Minimum score threshold" },
  { name: "explain", detail: "boolean", info: "Include score explanation" },
  { name: "version", detail: "boolean", info: "Include document version" },
  { name: "seq_no_primary_term", detail: "boolean", info: "Include sequence number" },
  { name: "stored_fields", detail: "array", info: "Return stored fields" },
  { name: "docvalue_fields", detail: "array", info: "Return doc values" },
  { name: "script_fields", detail: "object", info: "Compute fields via scripts" },
  { name: "indices_boost", detail: "array", info: "Boost specific indices" },
  { name: "collapse", detail: "object", info: "Collapse results by field" },
  { name: "search_after", detail: "array", info: "Pagination cursor" },
  { name: "pit", detail: "object", info: "Point in time for deep pagination" },
  { name: "runtime_mappings", detail: "object", info: "Runtime field definitions" },
];

// Bool query clauses
const BOOL_CLAUSES = [
  { name: "must", detail: "array", info: "All clauses must match (AND)" },
  { name: "filter", detail: "array", info: "Must match, no scoring" },
  { name: "should", detail: "array", info: "At least one should match (OR)" },
  { name: "must_not", detail: "array", info: "Must not match (NOT)" },
  { name: "minimum_should_match", detail: "number/string", info: "Minimum matching should clauses" },
  { name: "boost", detail: "number", info: "Boost this query's score" },
];

// Common query options
const QUERY_OPTIONS: Record<string, Array<{ name: string; detail: string; info: string }>> = {
  match: [
    { name: "query", detail: "string", info: "Text to search for" },
    { name: "operator", detail: "string", info: "and/or for multiple terms" },
    { name: "fuzziness", detail: "string", info: "Edit distance for fuzzy matching" },
    { name: "prefix_length", detail: "number", info: "Characters that must match exactly" },
    { name: "max_expansions", detail: "number", info: "Maximum fuzzy expansions" },
    { name: "analyzer", detail: "string", info: "Analyzer to use" },
    { name: "boost", detail: "number", info: "Query boost factor" },
    { name: "lenient", detail: "boolean", info: "Ignore type mismatches" },
    { name: "zero_terms_query", detail: "string", info: "none/all for empty query" },
    { name: "auto_generate_synonyms_phrase_query", detail: "boolean", info: "Use synonyms" },
  ],
  range: [
    { name: "gte", detail: "value", info: "Greater than or equal" },
    { name: "gt", detail: "value", info: "Greater than" },
    { name: "lte", detail: "value", info: "Less than or equal" },
    { name: "lt", detail: "value", info: "Less than" },
    { name: "format", detail: "string", info: "Date format" },
    { name: "time_zone", detail: "string", info: "Time zone for date parsing" },
    { name: "boost", detail: "number", info: "Query boost factor" },
    { name: "relation", detail: "string", info: "Range relation for ranges" },
  ],
  terms: [
    { name: "boost", detail: "number", info: "Query boost factor" },
  ],
  multi_match: [
    { name: "query", detail: "string", info: "Text to search for" },
    { name: "fields", detail: "array", info: "Fields to search" },
    { name: "type", detail: "string", info: "Match type (best_fields, most_fields, etc.)" },
    { name: "operator", detail: "string", info: "and/or for multiple terms" },
    { name: "tie_breaker", detail: "number", info: "Tie breaker for scoring" },
    { name: "fuzziness", detail: "string", info: "Edit distance for fuzzy matching" },
    { name: "analyzer", detail: "string", info: "Analyzer to use" },
  ],
};

// ES Snippets for common patterns
const ES_SNIPPETS = [
  {
    label: "search-basic",
    detail: "Basic Search",
    template: `{
  "query": {
    "match": { "\${1:field}": "\${2:text}" }
  }
}`,
    info: "Simple match query",
  },
  {
    label: "search-bool",
    detail: "Bool Query",
    template: `{
  "query": {
    "bool": {
      "must": [
        { "match": { "\${1:field}": "\${2:text}" } }
      ],
      "filter": [
        { "term": { "\${3:status}": "\${4:active}" } }
      ]
    }
  }
}`,
    info: "Bool query with must and filter",
  },
  {
    label: "search-range",
    detail: "Range Query",
    template: `{
  "query": {
    "range": {
      "\${1:date}": {
        "gte": "\${2:now-1d}",
        "lte": "\${3:now}"
      }
    }
  }
}`,
    info: "Date/numeric range query",
  },
  {
    label: "search-pagination",
    detail: "Paginated Search",
    template: `{
  "query": { "match_all": {} },
  "from": \${1:0},
  "size": \${2:10},
  "sort": [{ "\${3:date}": "desc" }]
}`,
    info: "Search with pagination and sorting",
  },
  {
    label: "aggs-terms",
    detail: "Terms Aggregation",
    template: `{
  "size": 0,
  "aggs": {
    "\${1:by_field}": {
      "terms": {
        "field": "\${2:field}.keyword",
        "size": \${3:10}
      }
    }
  }
}`,
    info: "Group by field values",
  },
  {
    label: "aggs-date-histogram",
    detail: "Date Histogram",
    template: `{
  "size": 0,
  "aggs": {
    "\${1:over_time}": {
      "date_histogram": {
        "field": "\${2:timestamp}",
        "calendar_interval": "\${3:day}"
      }
    }
  }
}`,
    info: "Time-based bucketing",
  },
  {
    label: "aggs-nested",
    detail: "Nested Aggregation",
    template: `{
  "size": 0,
  "aggs": {
    "\${1:by_category}": {
      "terms": { "field": "\${2:category}.keyword" },
      "aggs": {
        "\${3:avg_price}": {
          "avg": { "field": "\${4:price}" }
        }
      }
    }
  }
}`,
    info: "Bucket with sub-aggregation",
  },
  {
    label: "aggs-stats",
    detail: "Statistics",
    template: `{
  "size": 0,
  "aggs": {
    "\${1:stats}": {
      "stats": { "field": "\${2:price}" }
    }
  }
}`,
    info: "Get min, max, avg, sum, count",
  },
  {
    label: "highlight",
    detail: "Highlight Matches",
    template: `{
  "query": { "match": { "\${1:content}": "\${2:search text}" } },
  "highlight": {
    "fields": {
      "\${1:content}": {}
    }
  }
}`,
    info: "Highlight matching text",
  },
  {
    label: "suggest",
    detail: "Suggester",
    template: `{
  "suggest": {
    "\${1:my-suggest}": {
      "text": "\${2:text}",
      "term": { "field": "\${3:title}" }
    }
  }
}`,
    info: "Term/phrase suggester",
  },
  {
    label: "filter-exists",
    detail: "Exists Filter",
    template: `{
  "query": {
    "bool": {
      "filter": [
        { "exists": { "field": "\${1:field}" } }
      ]
    }
  }
}`,
    info: "Filter docs with field",
  },
  {
    label: "search-geo",
    detail: "Geo Distance",
    template: `{
  "query": {
    "geo_distance": {
      "distance": "\${1:10km}",
      "\${2:location}": {
        "lat": \${3:40.73},
        "lon": \${4:-73.99}
      }
    }
  }
}`,
    info: "Filter by distance from point",
  },
  {
    label: "collapse",
    detail: "Collapse Results",
    template: `{
  "query": { "match_all": {} },
  "collapse": {
    "field": "\${1:user_id}",
    "inner_hits": {
      "name": "latest",
      "size": 3,
      "sort": [{ "\${2:date}": "desc" }]
    }
  }
}`,
    info: "Collapse by field with inner hits",
  },
  {
    label: "script-field",
    detail: "Script Field",
    template: `{
  "query": { "match_all": {} },
  "script_fields": {
    "\${1:calculated_field}": {
      "script": {
        "source": "doc['\${2:field}'].value * \${3:2}"
      }
    }
  }
}`,
    info: "Computed field via script",
  },
];

/**
 * Create completions for query types
 */
function createQueryTypeCompletions(prefix: string): Completion[] {
  const queryTypes = prefix ? searchQueryTypes(prefix) : ALL_QUERY_TYPES;

  return queryTypes.map((qt) => ({
    label: qt.name,
    type: "keyword",
    detail: `${qt.category} query`,
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 350px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${qt.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 6px;">${qt.description}</div>
          <pre style="font-size: 11px; background: #f5f5f5; padding: 6px; border-radius: 3px; overflow-x: auto; color: #333; white-space: pre-wrap;">${qt.template.replace(/\$\{\d+:([^}]+)\}/g, "$1")}</pre>
        </div>
      `;
      return div;
    },
    boost: BOOST.QUERY_TYPE,
    apply: `"${qt.name}": `,
  }));
}

/**
 * Create completions for aggregation types
 */
function createAggTypeCompletions(prefix: string): Completion[] {
  const aggTypes = prefix ? searchAggTypes(prefix) : ALL_AGG_TYPES;

  return aggTypes.map((at) => ({
    label: at.name,
    type: "function",
    detail: `${at.category} aggregation`,
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 350px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${at.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 6px;">${at.description}</div>
          <pre style="font-size: 11px; background: #f5f5f5; padding: 6px; border-radius: 3px; overflow-x: auto; color: #333; white-space: pre-wrap;">${at.template.replace(/\$\{\d+:([^}]+)\}/g, "$1")}</pre>
        </div>
      `;
      return div;
    },
    boost: BOOST.AGG_TYPE,
    apply: `"${at.name}": `,
  }));
}

/**
 * Create property completions
 */
function createPropertyCompletions(
  properties: Array<{ name: string; detail: string; info: string }>,
  prefix: string
): Completion[] {
  return properties
    .filter((p) => !prefix || p.name.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((p) => ({
      label: p.name,
      type: "property",
      detail: p.detail,
      info: p.info,
      boost: BOOST.PROPERTY,
      apply: `"${p.name}": `,
    }));
}

/**
 * Create field completions from index mapping
 */
function createFieldCompletions(fields: ESFieldInfo[], prefix: string): Completion[] {
  const completions: Completion[] = [];

  function addField(field: ESFieldInfo, path: string = "") {
    const fullPath = path ? `${path}.${field.name}` : field.name;

    completions.push({
      label: fullPath,
      type: "variable",
      detail: field.type,
      info: field.analyzer ? `Analyzer: ${field.analyzer}` : undefined,
      boost: BOOST.FIELD,
      apply: `"${fullPath}"`,
    });

    // For text fields, also suggest .keyword
    if (field.type === "text") {
      completions.push({
        label: `${fullPath}.keyword`,
        type: "variable",
        detail: "keyword",
        info: "Exact match (not analyzed)",
        boost: BOOST.FIELD - 1,
        apply: `"${fullPath}.keyword"`,
      });
    }

    // Recurse into nested/object fields
    if (field.properties) {
      field.properties.forEach((subField) => addField(subField, fullPath));
    }
  }

  fields.forEach((field) => addField(field));

  // Filter by prefix
  if (prefix) {
    return completions.filter((c) =>
      c.label.toLowerCase().includes(prefix.toLowerCase())
    );
  }

  return completions.slice(0, 30);
}

/**
 * Create snippet completions
 */
function createSnippetCompletions(prefix: string): Completion[] {
  return ES_SNIPPETS.filter(
    (s) => !prefix || s.label.toLowerCase().includes(prefix.toLowerCase())
  ).map((s) => ({
    label: s.label,
    type: "snippet",
    detail: s.detail,
    info: s.info,
    boost: BOOST.SNIPPET,
    apply: s.template.replace(/\$\{\d+:([^}]+)\}/g, "$1"),
  }));
}

/**
 * Create value completions for specific keys
 */
function createValueCompletions(key: string): Completion[] {
  const values: Record<string, string[]> = {
    order: ["asc", "desc"],
    type: ["best_fields", "most_fields", "cross_fields", "phrase", "phrase_prefix"],
    operator: ["and", "or", "AND", "OR"],
    zero_terms_query: ["none", "all"],
    mode: ["min", "max", "avg", "sum", "median"],
    missing: ["_first", "_last"],
    score_mode: ["multiply", "sum", "avg", "first", "max", "min"],
    boost_mode: ["multiply", "replace", "sum", "avg", "max", "min"],
    distance_type: ["arc", "plane"],
    gap_policy: ["skip", "insert_zeros"],
  };

  const vals = values[key];
  if (!vals) return [];

  return vals.map((v) => ({
    label: v,
    type: "enum",
    boost: BOOST.VALUE,
    apply: `"${v}"`,
  }));
}

/**
 * Main completion provider factory
 */
export function createSmartESCompletion(getData: () => ESAutocompleteData) {
  return (context: CompletionContext) => {
    const esContext = getESContext(context.state, context.pos);
    const data = getData();

    // Don't complete inside strings unless explicit
    if (esContext.inString && !context.explicit) {
      return null;
    }

    const word = esContext.currentWord.replace(/["]/g, "");
    const completions: Completion[] = [];

    // Determine what completions to show based on context
    switch (esContext.type) {
      case "root":
        if (!esContext.afterColon) {
          // At root level, show root properties
          completions.push(...createPropertyCompletions(ROOT_PROPERTIES, word));
          // Also show snippets at root
          if (context.explicit || word.length >= 2) {
            completions.push(...createSnippetCompletions(word));
          }
        }
        break;

      case "query":
        if (!esContext.afterColon) {
          // Inside query object, show query types
          completions.push(...createQueryTypeCompletions(word));
        } else if (expectsFieldName(esContext) && data.fields) {
          // Expecting field name as value
          const indexFields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(indexFields, word));
        }
        break;

      case "bool":
        if (!esContext.afterColon) {
          // Inside bool, show bool clauses
          completions.push(...createPropertyCompletions(BOOL_CLAUSES, word));
        }
        break;

      case "bool_clause":
        // Inside must/should/filter/must_not, show query types
        completions.push(...createQueryTypeCompletions(word));
        break;

      case "aggs":
      case "agg_def":
        if (!esContext.afterColon) {
          // Inside aggs, could be agg name or agg type
          completions.push(...createAggTypeCompletions(word));

          // If in agg_def, also show nested aggs option
          if (esContext.type === "agg_def") {
            completions.push({
              label: "aggs",
              type: "property",
              detail: "Nested aggregations",
              boost: BOOST.PROPERTY,
              apply: '"aggs": ',
            });
          }
        } else if (expectsFieldName(esContext) && data.fields) {
          const indexFields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(indexFields, word));
        }
        break;

      case "field_value":
        if (data.fields) {
          const indexFields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(indexFields, word));
        }
        break;

      case "value":
        if (esContext.currentKey) {
          completions.push(...createValueCompletions(esContext.currentKey));
        }
        break;

      case "sort":
        if (!esContext.afterColon && data.fields) {
          // Show fields for sorting
          const indexFields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(indexFields, word));
        } else if (esContext.afterColon) {
          // Show sort order
          completions.push(
            { label: "asc", type: "enum", boost: BOOST.VALUE, apply: '"asc"' },
            { label: "desc", type: "enum", boost: BOOST.VALUE, apply: '"desc"' }
          );
        }
        break;

      case "highlight":
        if (!esContext.afterColon) {
          completions.push(
            { label: "fields", type: "property", detail: "object", boost: BOOST.PROPERTY, apply: '"fields": ' },
            { label: "pre_tags", type: "property", detail: "array", boost: BOOST.PROPERTY, apply: '"pre_tags": ' },
            { label: "post_tags", type: "property", detail: "array", boost: BOOST.PROPERTY, apply: '"post_tags": ' },
            { label: "require_field_match", type: "property", detail: "boolean", boost: BOOST.PROPERTY, apply: '"require_field_match": ' },
            { label: "type", type: "property", detail: "string", boost: BOOST.PROPERTY, apply: '"type": ' }
          );
        }
        break;

      case "source":
        if (!esContext.afterColon) {
          completions.push(
            { label: "includes", type: "property", detail: "array", boost: BOOST.PROPERTY, apply: '"includes": ' },
            { label: "excludes", type: "property", detail: "array", boost: BOOST.PROPERTY, apply: '"excludes": ' }
          );
        } else if (data.fields) {
          const indexFields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(indexFields, word));
        }
        break;

      default:
        // In unknown context, try to be helpful
        if (canAddQueryType(esContext)) {
          completions.push(...createQueryTypeCompletions(word));
        }
        if (canAddAggregation(esContext)) {
          completions.push(...createAggTypeCompletions(word));
        }

        // Show query options if inside a query type
        const parentQuery = getParentQueryType(esContext);
        if (parentQuery && QUERY_OPTIONS[parentQuery] && !esContext.afterColon) {
          completions.push(...createPropertyCompletions(QUERY_OPTIONS[parentQuery], word));
        }

        // Show field suggestions if we might need them
        if (esContext.afterColon && data.fields) {
          const indexFields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(indexFields, word));
        }
        break;
    }

    // No completions found
    if (completions.length === 0 && !context.explicit) {
      return null;
    }

    // Determine 'from' position
    let from = context.pos;
    if (word) {
      from = context.pos - word.length;
    }

    return {
      from,
      options: completions,
      validFor: /^[\w".-]*$/,
    };
  };
}

/**
 * Export for simpler usage when data isn't needed
 */
export function createBasicESCompletion() {
  return createSmartESCompletion(() => ({}));
}
