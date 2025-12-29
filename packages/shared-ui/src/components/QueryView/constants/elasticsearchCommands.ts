/**
 * Elasticsearch Commands and Query Types
 * Comprehensive Elasticsearch commands organized by category for query builder and autocomplete
 */

export interface ESCommand {
  name: string;
  desc: string;
  example: string;
}

export interface ESQueryType {
  type: string;
  desc: string;
}

export const ES_COMMANDS: Record<string, ESCommand[]> = {
  examples: [
    { name: "Match All", desc: "Get all documents", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "size": 10\n}` },
    { name: "Full-Text Search", desc: "Search in text field", example: `{\n  "index": "your_index",\n  "query": {\n    "match": { "content": "search keywords" }\n  },\n  "size": 10\n}` },
    { name: "Exact Match", desc: "Filter by exact value", example: `{\n  "index": "your_index",\n  "query": {\n    "term": { "status": "published" }\n  },\n  "size": 10\n}` },
    { name: "Range Query", desc: "Filter by range", example: `{\n  "index": "your_index",\n  "query": {\n    "range": {\n      "price": { "gte": 10, "lte": 100 }\n    }\n  },\n  "size": 10\n}` },
    { name: "Boolean Query", desc: "Combine conditions", example: `{\n  "index": "your_index",\n  "query": {\n    "bool": {\n      "must": [{ "match": { "title": "elasticsearch" } }],\n      "filter": [{ "term": { "status": "published" } }],\n      "must_not": [{ "term": { "deleted": true } }]\n    }\n  },\n  "size": 10\n}` },
    { name: "Aggregation", desc: "Group and aggregate", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "size": 0,\n  "aggs": {\n    "by_category": {\n      "terms": { "field": "category.keyword", "size": 10 }\n    }\n  }\n}` },
    { name: "Sort Results", desc: "Order by field", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "sort": [\n    { "created_at": "desc" },\n    "_score"\n  ],\n  "size": 10\n}` },
    { name: "Pagination", desc: "Skip and limit", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "from": 20,\n  "size": 10,\n  "sort": [{ "created_at": "desc" }]\n}` },
  ],
  fullText: [
    { name: "match", desc: "Standard full-text search", example: `{\n  "index": "your_index",\n  "query": {\n    "match": {\n      "message": {\n        "query": "quick brown fox",\n        "operator": "and"\n      }\n    }\n  }\n}` },
    { name: "match_phrase", desc: "Exact phrase match", example: `{\n  "index": "your_index",\n  "query": {\n    "match_phrase": {\n      "title": "quick brown fox"\n    }\n  }\n}` },
    { name: "match_phrase_prefix", desc: "Phrase with prefix", example: `{\n  "index": "your_index",\n  "query": {\n    "match_phrase_prefix": {\n      "message": "quick brown f"\n    }\n  }\n}` },
    { name: "multi_match", desc: "Search multiple fields", example: `{\n  "index": "your_index",\n  "query": {\n    "multi_match": {\n      "query": "quick fox",\n      "fields": ["title^3", "content", "tags"],\n      "type": "best_fields"\n    }\n  }\n}` },
    { name: "query_string", desc: "Lucene query syntax", example: `{\n  "index": "your_index",\n  "query": {\n    "query_string": {\n      "query": "(title:quick OR content:fox) AND status:published",\n      "default_field": "content"\n    }\n  }\n}` },
    { name: "simple_query_string", desc: "Simple query syntax", example: `{\n  "index": "your_index",\n  "query": {\n    "simple_query_string": {\n      "query": "quick + fox | lazy dog",\n      "fields": ["title", "content"],\n      "default_operator": "and"\n    }\n  }\n}` },
    { name: "combined_fields", desc: "Search across fields", example: `{\n  "index": "your_index",\n  "query": {\n    "combined_fields": {\n      "query": "database systems",\n      "fields": ["title", "abstract", "body"],\n      "operator": "and"\n    }\n  }\n}` },
  ],
  termLevel: [
    { name: "term", desc: "Exact value match", example: `{\n  "index": "your_index",\n  "query": {\n    "term": {\n      "status.keyword": { "value": "published" }\n    }\n  }\n}` },
    { name: "terms", desc: "Match any of values", example: `{\n  "index": "your_index",\n  "query": {\n    "terms": {\n      "status": ["published", "draft", "pending"]\n    }\n  }\n}` },
    { name: "terms_set", desc: "Match minimum terms", example: `{\n  "index": "your_index",\n  "query": {\n    "terms_set": {\n      "tags": {\n        "terms": ["elasticsearch", "search", "database"],\n        "minimum_should_match_script": { "source": "2" }\n      }\n    }\n  }\n}` },
    { name: "range", desc: "Numeric/date range", example: `{\n  "index": "your_index",\n  "query": {\n    "range": {\n      "age": {\n        "gte": 18,\n        "lte": 65,\n        "boost": 2.0\n      }\n    }\n  }\n}` },
    { name: "range (date)", desc: "Date range query", example: `{\n  "index": "your_index",\n  "query": {\n    "range": {\n      "created_at": {\n        "gte": "now-1M/d",\n        "lte": "now/d",\n        "format": "yyyy-MM-dd"\n      }\n    }\n  }\n}` },
    { name: "exists", desc: "Field exists", example: `{\n  "index": "your_index",\n  "query": {\n    "exists": { "field": "email" }\n  }\n}` },
    { name: "prefix", desc: "Prefix match", example: `{\n  "index": "your_index",\n  "query": {\n    "prefix": {\n      "user.keyword": { "value": "john" }\n    }\n  }\n}` },
    { name: "wildcard", desc: "Wildcard pattern", example: `{\n  "index": "your_index",\n  "query": {\n    "wildcard": {\n      "email.keyword": { "value": "*@gmail.com" }\n    }\n  }\n}` },
    { name: "regexp", desc: "Regular expression", example: `{\n  "index": "your_index",\n  "query": {\n    "regexp": {\n      "name.keyword": {\n        "value": "john.*",\n        "flags": "ALL"\n      }\n    }\n  }\n}` },
    { name: "fuzzy", desc: "Fuzzy matching", example: `{\n  "index": "your_index",\n  "query": {\n    "fuzzy": {\n      "name": {\n        "value": "elasticsaerch",\n        "fuzziness": "AUTO"\n      }\n    }\n  }\n}` },
    { name: "ids", desc: "Match by IDs", example: `{\n  "index": "your_index",\n  "query": {\n    "ids": {\n      "values": ["1", "2", "3"]\n    }\n  }\n}` },
  ],
  compound: [
    { name: "bool", desc: "Boolean combinations", example: `{\n  "index": "your_index",\n  "query": {\n    "bool": {\n      "must": [\n        { "match": { "title": "search" } }\n      ],\n      "filter": [\n        { "term": { "status": "published" } },\n        { "range": { "date": { "gte": "2024-01-01" } } }\n      ],\n      "should": [\n        { "term": { "featured": true } }\n      ],\n      "must_not": [\n        { "term": { "deleted": true } }\n      ],\n      "minimum_should_match": 1\n    }\n  }\n}` },
    { name: "boosting", desc: "Boost/demote results", example: `{\n  "index": "your_index",\n  "query": {\n    "boosting": {\n      "positive": { "match": { "content": "elasticsearch" } },\n      "negative": { "term": { "status": "archived" } },\n      "negative_boost": 0.5\n    }\n  }\n}` },
    { name: "constant_score", desc: "Fixed score query", example: `{\n  "index": "your_index",\n  "query": {\n    "constant_score": {\n      "filter": { "term": { "status": "published" } },\n      "boost": 1.2\n    }\n  }\n}` },
    { name: "dis_max", desc: "Best matching subquery", example: `{\n  "index": "your_index",\n  "query": {\n    "dis_max": {\n      "queries": [\n        { "match": { "title": "quick fox" } },\n        { "match": { "body": "quick fox" } }\n      ],\n      "tie_breaker": 0.7\n    }\n  }\n}` },
    { name: "function_score", desc: "Custom scoring", example: `{\n  "index": "your_index",\n  "query": {\n    "function_score": {\n      "query": { "match": { "content": "elasticsearch" } },\n      "functions": [\n        { "filter": { "term": { "featured": true } }, "weight": 2 },\n        { "gauss": { "date": { "origin": "now", "scale": "10d" } } }\n      ],\n      "score_mode": "sum",\n      "boost_mode": "multiply"\n    }\n  }\n}` },
  ],
  nested: [
    { name: "nested", desc: "Query nested objects", example: `{\n  "index": "your_index",\n  "query": {\n    "nested": {\n      "path": "comments",\n      "query": {\n        "bool": {\n          "must": [\n            { "match": { "comments.author": "john" } },\n            { "range": { "comments.date": { "gte": "2024-01-01" } } }\n          ]\n        }\n      },\n      "inner_hits": { "size": 3 }\n    }\n  }\n}` },
    { name: "has_child", desc: "Parent by child", example: `{\n  "index": "your_index",\n  "query": {\n    "has_child": {\n      "type": "comment",\n      "query": { "match": { "text": "elasticsearch" } },\n      "min_children": 1,\n      "max_children": 10\n    }\n  }\n}` },
    { name: "has_parent", desc: "Child by parent", example: `{\n  "index": "your_index",\n  "query": {\n    "has_parent": {\n      "parent_type": "post",\n      "query": { "match": { "title": "elasticsearch" } }\n    }\n  }\n}` },
  ],
  metricAggs: [
    { name: "avg", desc: "Average value", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "avg_price": { "avg": { "field": "price" } }\n  }\n}` },
    { name: "sum", desc: "Sum of values", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "total_sales": { "sum": { "field": "amount" } }\n  }\n}` },
    { name: "min", desc: "Minimum value", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "min_price": { "min": { "field": "price" } }\n  }\n}` },
    { name: "max", desc: "Maximum value", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "max_price": { "max": { "field": "price" } }\n  }\n}` },
    { name: "stats", desc: "Basic statistics", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "price_stats": { "stats": { "field": "price" } }\n  }\n}` },
    { name: "extended_stats", desc: "Extended statistics", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "price_extended": { "extended_stats": { "field": "price" } }\n  }\n}` },
    { name: "cardinality", desc: "Unique count", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "unique_users": { "cardinality": { "field": "user_id" } }\n  }\n}` },
    { name: "value_count", desc: "Count values", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "transaction_count": { "value_count": { "field": "transaction_id" } }\n  }\n}` },
    { name: "percentiles", desc: "Percentile values", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "load_time_pct": {\n      "percentiles": {\n        "field": "load_time",\n        "percents": [50, 90, 95, 99]\n      }\n    }\n  }\n}` },
    { name: "top_hits", desc: "Top matching docs", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "by_category": {\n      "terms": { "field": "category.keyword" },\n      "aggs": {\n        "top_products": {\n          "top_hits": { "size": 3, "sort": [{ "price": "desc" }] }\n        }\n      }\n    }\n  }\n}` },
  ],
  bucketAggs: [
    { name: "terms", desc: "Group by term", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "by_status": {\n      "terms": {\n        "field": "status.keyword",\n        "size": 10,\n        "order": { "_count": "desc" }\n      }\n    }\n  }\n}` },
    { name: "histogram", desc: "Numeric buckets", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "price_ranges": {\n      "histogram": {\n        "field": "price",\n        "interval": 50,\n        "min_doc_count": 1\n      }\n    }\n  }\n}` },
    { name: "date_histogram", desc: "Date buckets", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "sales_per_month": {\n      "date_histogram": {\n        "field": "date",\n        "calendar_interval": "month",\n        "format": "yyyy-MM"\n      }\n    }\n  }\n}` },
    { name: "range", desc: "Custom ranges", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "price_ranges": {\n      "range": {\n        "field": "price",\n        "ranges": [\n          { "to": 50 },\n          { "from": 50, "to": 100 },\n          { "from": 100 }\n        ]\n      }\n    }\n  }\n}` },
    { name: "date_range", desc: "Date ranges", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "time_ranges": {\n      "date_range": {\n        "field": "date",\n        "ranges": [\n          { "to": "now-1M/M" },\n          { "from": "now-1M/M", "to": "now" },\n          { "from": "now" }\n        ]\n      }\n    }\n  }\n}` },
    { name: "filter", desc: "Single filter bucket", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "active_users": {\n      "filter": { "term": { "status": "active" } },\n      "aggs": {\n        "avg_age": { "avg": { "field": "age" } }\n      }\n    }\n  }\n}` },
    { name: "filters", desc: "Multiple filter buckets", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "messages": {\n      "filters": {\n        "filters": {\n          "errors": { "match": { "body": "error" } },\n          "warnings": { "match": { "body": "warning" } }\n        }\n      }\n    }\n  }\n}` },
    { name: "nested", desc: "Nested object agg", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "comments": {\n      "nested": { "path": "comments" },\n      "aggs": {\n        "avg_rating": { "avg": { "field": "comments.rating" } }\n      }\n    }\n  }\n}` },
    { name: "composite", desc: "Paginated aggregation", example: `{\n  "index": "your_index",\n  "size": 0,\n  "aggs": {\n    "my_buckets": {\n      "composite": {\n        "size": 100,\n        "sources": [\n          { "category": { "terms": { "field": "category.keyword" } } },\n          { "date": { "date_histogram": { "field": "date", "calendar_interval": "day" } } }\n        ]\n      }\n    }\n  }\n}` },
  ],
  sorting: [
    { name: "sort", desc: "Simple sort", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "sort": [\n    { "date": "desc" },\n    { "title.keyword": "asc" }\n  ]\n}` },
    { name: "sort (nested)", desc: "Sort by nested field", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "sort": [\n    {\n      "comments.date": {\n        "order": "desc",\n        "nested": { "path": "comments" }\n      }\n    }\n  ]\n}` },
    { name: "sort (script)", desc: "Custom sort script", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "sort": [\n    {\n      "_script": {\n        "type": "number",\n        "script": { "source": "doc['price'].value * doc['quantity'].value" },\n        "order": "desc"\n      }\n    }\n  ]\n}` },
    { name: "from/size", desc: "Pagination", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "from": 20,\n  "size": 10,\n  "sort": [{ "date": "desc" }]\n}` },
    { name: "search_after", desc: "Deep pagination", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "size": 10,\n  "sort": [\n    { "date": "desc" },\n    { "_id": "asc" }\n  ],\n  "search_after": ["2024-01-15", "abc123"]\n}` },
  ],
  highlight: [
    { name: "highlight", desc: "Highlight matches", example: `{\n  "index": "your_index",\n  "query": { "match": { "content": "elasticsearch" } },\n  "highlight": {\n    "fields": {\n      "content": {\n        "pre_tags": ["<em>"],\n        "post_tags": ["</em>"],\n        "fragment_size": 150,\n        "number_of_fragments": 3\n      }\n    }\n  }\n}` },
    { name: "highlight (multi)", desc: "Multiple fields", example: `{\n  "index": "your_index",\n  "query": { "multi_match": { "query": "search", "fields": ["title", "content"] } },\n  "highlight": {\n    "pre_tags": ["<mark>"],\n    "post_tags": ["</mark>"],\n    "fields": {\n      "title": {},\n      "content": { "fragment_size": 200 }\n    }\n  }\n}` },
  ],
  suggest: [
    { name: "suggest (term)", desc: "Spelling suggestions", example: `{\n  "index": "your_index",\n  "suggest": {\n    "my-suggest": {\n      "text": "elasticsaerch",\n      "term": { "field": "title" }\n    }\n  }\n}` },
    { name: "suggest (phrase)", desc: "Phrase suggestions", example: `{\n  "index": "your_index",\n  "suggest": {\n    "my-suggest": {\n      "text": "elastc serch",\n      "phrase": {\n        "field": "title.suggest",\n        "size": 3\n      }\n    }\n  }\n}` },
    { name: "suggest (completion)", desc: "Autocomplete", example: `{\n  "index": "your_index",\n  "suggest": {\n    "song-suggest": {\n      "prefix": "ela",\n      "completion": {\n        "field": "suggest",\n        "size": 5,\n        "fuzzy": { "fuzziness": 1 }\n      }\n    }\n  }\n}` },
  ],
  geo: [
    { name: "geo_distance", desc: "Distance filter", example: `{\n  "index": "your_index",\n  "query": {\n    "geo_distance": {\n      "distance": "10km",\n      "location": { "lat": 40.73, "lon": -73.99 }\n    }\n  }\n}` },
    { name: "geo_bounding_box", desc: "Bounding box", example: `{\n  "index": "your_index",\n  "query": {\n    "geo_bounding_box": {\n      "location": {\n        "top_left": { "lat": 41.0, "lon": -74.0 },\n        "bottom_right": { "lat": 40.0, "lon": -73.0 }\n      }\n    }\n  }\n}` },
    { name: "geo_shape", desc: "Shape intersection", example: `{\n  "index": "your_index",\n  "query": {\n    "geo_shape": {\n      "location": {\n        "shape": {\n          "type": "circle",\n          "coordinates": [-73.99, 40.73],\n          "radius": "5km"\n        }\n      }\n    }\n  }\n}` },
    { name: "geo_distance (sort)", desc: "Sort by distance", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "sort": [\n    {\n      "_geo_distance": {\n        "location": { "lat": 40.73, "lon": -73.99 },\n        "order": "asc",\n        "unit": "km"\n      }\n    }\n  ]\n}` },
  ],
  source: [
    { name: "_source (include)", desc: "Include fields", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "_source": ["title", "author", "date"],\n  "size": 10\n}` },
    { name: "_source (exclude)", desc: "Exclude fields", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "_source": {\n    "includes": ["*"],\n    "excludes": ["content", "metadata.*"]\n  },\n  "size": 10\n}` },
    { name: "fields", desc: "Stored fields", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "_source": false,\n  "fields": ["title", "date"],\n  "size": 10\n}` },
    { name: "script_fields", desc: "Computed fields", example: `{\n  "index": "your_index",\n  "query": { "match_all": {} },\n  "script_fields": {\n    "total_value": {\n      "script": "doc['price'].value * doc['quantity'].value"\n    }\n  },\n  "size": 10\n}` },
  ],
};

export const ES_QUERY_AUTOCOMPLETE: ESQueryType[] = [
  ...ES_COMMANDS.fullText.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.termLevel.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.compound.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.nested.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.geo.map(c => ({ type: c.name, desc: c.desc })),
];

export const ES_AGG_AUTOCOMPLETE: ESQueryType[] = [
  ...ES_COMMANDS.metricAggs.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.bucketAggs.map(c => ({ type: c.name, desc: c.desc })),
];
