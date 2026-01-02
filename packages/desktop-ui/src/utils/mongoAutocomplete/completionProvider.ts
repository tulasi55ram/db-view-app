/**
 * MongoDB Completion Provider
 *
 * Provides context-aware autocomplete suggestions for MongoDB queries.
 * Features:
 * - Query operator completion
 * - Aggregation pipeline stages
 * - Accumulator and expression suggestions
 * - Field path completion
 * - Snippets for common patterns
 */

import type { CompletionContext, Completion } from "@codemirror/autocomplete";
import type { MongoAutocompleteData, MongoFieldInfo } from "./types";
import {
  ALL_QUERY_OPERATORS,
  ALL_UPDATE_OPERATORS,
  searchQueryOperators,
  searchUpdateOperators,
} from "./operators";
import {
  ALL_STAGES,
  ALL_ACCUMULATORS,
  ALL_EXPRESSIONS,
  SYSTEM_VARIABLES,
  searchStages,
  searchAccumulators,
  searchExpressions,
} from "./stages";
import {
  getMongoContext,
  canAddOperator,
  canAddStage,
  canAddAccumulator,
  canAddExpression,
} from "./contextParser";

// Boost values for different completion types
const BOOST = {
  OPERATOR: 100,
  STAGE: 95,
  ACCUMULATOR: 90,
  EXPRESSION: 85,
  FIELD: 80,
  FIELD_PATH: 78,
  COLLECTION: 75,
  SNIPPET: 70,
  VARIABLE: 65,
  VALUE: 60,
};

// Root level properties for MongoDB command format
const ROOT_PROPERTIES = [
  { name: "collection", detail: "string", info: "Collection to query" },
  { name: "find", detail: "object", info: "Query filter for find operation" },
  { name: "aggregate", detail: "array", info: "Aggregation pipeline stages" },
  { name: "pipeline", detail: "array", info: "Aggregation pipeline (alternative)" },
  { name: "projection", detail: "object", info: "Fields to include/exclude" },
  { name: "sort", detail: "object", info: "Sort specification" },
  { name: "limit", detail: "number", info: "Maximum documents to return" },
  { name: "skip", detail: "number", info: "Documents to skip" },
  { name: "hint", detail: "object/string", info: "Index hint" },
  { name: "update", detail: "object", info: "Update operations" },
  { name: "upsert", detail: "boolean", info: "Insert if not found" },
  { name: "multi", detail: "boolean", info: "Update multiple documents" },
];

// MongoDB snippets for common patterns
const MONGO_SNIPPETS = [
  {
    label: "find-basic",
    detail: "Basic Find",
    template: `{
  "collection": "\${1:collectionName}",
  "find": { "\${2:field}": "\${3:value}" },
  "limit": 10
}`,
    info: "Simple find query",
  },
  {
    label: "find-operators",
    detail: "Find with Operators",
    template: `{
  "collection": "\${1:collectionName}",
  "find": {
    "\${2:field}": { "$gte": \${3:0} },
    "\${4:status}": { "$in": ["\${5:active}", "\${6:pending}"] }
  },
  "projection": { "\${7:field1}": 1, "\${8:field2}": 1 },
  "sort": { "\${9:createdAt}": -1 },
  "limit": 20
}`,
    info: "Find with comparison and projection",
  },
  {
    label: "find-text-search",
    detail: "Text Search",
    template: `{
  "collection": "\${1:collectionName}",
  "find": {
    "$text": { "$search": "\${2:search terms}" }
  },
  "projection": { "score": { "$meta": "textScore" } },
  "sort": { "score": { "$meta": "textScore" } }
}`,
    info: "Full-text search query",
  },
  {
    label: "aggregate-basic",
    detail: "Basic Aggregation",
    template: `{
  "collection": "\${1:collectionName}",
  "pipeline": [
    { "$match": { "\${2:status}": "\${3:active}" } },
    { "$group": {
        "_id": "$\${4:category}",
        "count": { "$sum": 1 }
      }
    },
    { "$sort": { "count": -1 } }
  ]
}`,
    info: "Group and count aggregation",
  },
  {
    label: "aggregate-lookup",
    detail: "Aggregation with Lookup",
    template: `{
  "collection": "\${1:orders}",
  "pipeline": [
    { "$lookup": {
        "from": "\${2:users}",
        "localField": "\${3:userId}",
        "foreignField": "\${4:_id}",
        "as": "\${5:user}"
      }
    },
    { "$unwind": "$\${5:user}" },
    { "$project": {
        "orderId": 1,
        "userName": "$\${5:user}.name",
        "total": 1
      }
    }
  ]
}`,
    info: "Join with another collection",
  },
  {
    label: "aggregate-group-stats",
    detail: "Group with Statistics",
    template: `{
  "collection": "\${1:collectionName}",
  "pipeline": [
    { "$match": { "\${2:field}": { "$exists": true } } },
    { "$group": {
        "_id": "$\${3:category}",
        "count": { "$sum": 1 },
        "total": { "$sum": "$\${4:amount}" },
        "avg": { "$avg": "$\${4:amount}" },
        "min": { "$min": "$\${4:amount}" },
        "max": { "$max": "$\${4:amount}" }
      }
    },
    { "$sort": { "total": -1 } }
  ]
}`,
    info: "Statistical aggregation by group",
  },
  {
    label: "aggregate-date",
    detail: "Date Aggregation",
    template: `{
  "collection": "\${1:collectionName}",
  "pipeline": [
    { "$match": {
        "\${2:createdAt}": {
          "$gte": { "$date": "\${3:2023-01-01T00:00:00Z}" },
          "$lt": { "$date": "\${4:2024-01-01T00:00:00Z}" }
        }
      }
    },
    { "$group": {
        "_id": {
          "year": { "$year": "$\${2:createdAt}" },
          "month": { "$month": "$\${2:createdAt}" }
        },
        "count": { "$sum": 1 }
      }
    },
    { "$sort": { "_id.year": 1, "_id.month": 1 } }
  ]
}`,
    info: "Group by date parts",
  },
  {
    label: "aggregate-bucket",
    detail: "Bucket Aggregation",
    template: `{
  "collection": "\${1:collectionName}",
  "pipeline": [
    { "$bucket": {
        "groupBy": "$\${2:price}",
        "boundaries": [0, 50, 100, 200, 500],
        "default": "Other",
        "output": {
          "count": { "$sum": 1 },
          "items": { "$push": "$\${3:name}" }
        }
      }
    }
  ]
}`,
    info: "Bucket documents by value ranges",
  },
  {
    label: "aggregate-facet",
    detail: "Faceted Search",
    template: `{
  "collection": "\${1:collectionName}",
  "pipeline": [
    { "$match": { "\${2:status}": "\${3:active}" } },
    { "$facet": {
        "byCategory": [
          { "$sortByCount": "$\${4:category}" }
        ],
        "byPrice": [
          { "$bucket": {
              "groupBy": "$\${5:price}",
              "boundaries": [0, 100, 500, 1000]
            }
          }
        ],
        "total": [
          { "$count": "count" }
        ]
      }
    }
  ]
}`,
    info: "Multiple aggregations in one query",
  },
  {
    label: "aggregate-unwind",
    detail: "Unwind Array",
    template: `{
  "collection": "\${1:collectionName}",
  "pipeline": [
    { "$match": { "\${2:tags}": { "$exists": true } } },
    { "$unwind": {
        "path": "$\${2:tags}",
        "preserveNullAndEmptyArrays": false
      }
    },
    { "$group": {
        "_id": "$\${2:tags}",
        "count": { "$sum": 1 }
      }
    },
    { "$sort": { "count": -1 } }
  ]
}`,
    info: "Deconstruct and analyze arrays",
  },
  {
    label: "update-set",
    detail: "Update with $set",
    template: `{
  "collection": "\${1:collectionName}",
  "find": { "\${2:_id}": "\${3:id}" },
  "update": {
    "$set": {
      "\${4:field}": "\${5:value}",
      "updatedAt": { "$date": "now" }
    }
  }
}`,
    info: "Update document fields",
  },
  {
    label: "update-array",
    detail: "Update Array",
    template: `{
  "collection": "\${1:collectionName}",
  "find": { "\${2:_id}": "\${3:id}" },
  "update": {
    "$push": {
      "\${4:items}": {
        "$each": [\${5:newItem}],
        "$position": 0
      }
    }
  }
}`,
    info: "Push to array with options",
  },
];

/**
 * Create completions for query operators
 */
function createOperatorCompletions(prefix: string, isUpdate: boolean): Completion[] {
  const operators = isUpdate
    ? (prefix ? searchUpdateOperators(prefix) : ALL_UPDATE_OPERATORS)
    : (prefix ? searchQueryOperators(prefix) : ALL_QUERY_OPERATORS);

  return operators.map((op) => ({
    label: op.name,
    type: "keyword",
    detail: `${op.category} operator`,
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 350px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${op.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 6px;">${op.description}</div>
          <pre style="font-size: 11px; background: #f5f5f5; padding: 6px; border-radius: 3px; overflow-x: auto; color: #333; white-space: pre-wrap;">${op.example}</pre>
        </div>
      `;
      return div;
    },
    boost: BOOST.OPERATOR,
    apply: `"${op.name}": `,
  }));
}

/**
 * Create completions for pipeline stages
 */
function createStageCompletions(prefix: string): Completion[] {
  const stages = prefix ? searchStages(prefix) : ALL_STAGES;

  return stages.map((stage) => ({
    label: stage.name,
    type: "function",
    detail: `${stage.category} stage`,
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 350px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${stage.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 6px;">${stage.description}</div>
          <pre style="font-size: 11px; background: #f5f5f5; padding: 6px; border-radius: 3px; overflow-x: auto; color: #333; white-space: pre-wrap;">${stage.example}</pre>
        </div>
      `;
      return div;
    },
    boost: BOOST.STAGE,
    apply: `{ "${stage.name}": {} }`,
  }));
}

/**
 * Create completions for accumulators
 */
function createAccumulatorCompletions(prefix: string): Completion[] {
  const accumulators = prefix ? searchAccumulators(prefix) : ALL_ACCUMULATORS;

  return accumulators.map((acc) => ({
    label: acc.name,
    type: "function",
    detail: `${acc.category} accumulator`,
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 300px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${acc.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 4px;">${acc.description}</div>
          <code style="font-size: 11px; color: #333;">${acc.example}</code>
        </div>
      `;
      return div;
    },
    boost: BOOST.ACCUMULATOR,
    apply: `{ "${acc.name}": "$" }`,
  }));
}

/**
 * Create completions for expressions
 */
function createExpressionCompletions(prefix: string): Completion[] {
  const expressions = prefix ? searchExpressions(prefix) : ALL_EXPRESSIONS.slice(0, 30);

  return expressions.map((expr) => ({
    label: expr.name,
    type: "function",
    detail: `${expr.category} expression`,
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 300px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${expr.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 4px;">${expr.description}</div>
          <code style="font-size: 11px; color: #333;">${expr.example}</code>
        </div>
      `;
      return div;
    },
    boost: BOOST.EXPRESSION,
    apply: `{ "${expr.name}": `,
  }));
}

/**
 * Create field completions from collection schema
 */
function createFieldCompletions(fields: MongoFieldInfo[], prefix: string, asFieldPath: boolean): Completion[] {
  const completions: Completion[] = [];

  function addField(field: MongoFieldInfo, path: string = "") {
    const fullPath = path ? `${path}.${field.name}` : field.name;

    completions.push({
      label: asFieldPath ? `$${fullPath}` : fullPath,
      type: "variable",
      detail: field.type,
      boost: asFieldPath ? BOOST.FIELD_PATH : BOOST.FIELD,
      apply: asFieldPath ? `"$${fullPath}"` : `"${fullPath}"`,
    });

    // Recurse into nested fields
    if (field.nestedFields) {
      field.nestedFields.forEach((subField) => addField(subField, fullPath));
    }
  }

  fields.forEach((field) => addField(field));

  // Filter by prefix
  if (prefix) {
    const prefixLower = prefix.toLowerCase().replace(/^\$/, "");
    return completions.filter((c) =>
      c.label.toLowerCase().replace(/^\$/, "").includes(prefixLower)
    ).slice(0, 20);
  }

  return completions.slice(0, 20);
}

/**
 * Create collection completions
 */
function createCollectionCompletions(collections: string[], prefix: string): Completion[] {
  return collections
    .filter((c) => !prefix || c.toLowerCase().includes(prefix.toLowerCase()))
    .slice(0, 15)
    .map((coll) => ({
      label: coll,
      type: "class",
      detail: "Collection",
      boost: BOOST.COLLECTION,
      apply: `"${coll}"`,
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
      boost: BOOST.OPERATOR,
      apply: `"${p.name}": `,
    }));
}

/**
 * Create snippet completions
 */
function createSnippetCompletions(prefix: string): Completion[] {
  return MONGO_SNIPPETS.filter(
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
 * Create system variable completions
 */
function createVariableCompletions(prefix: string): Completion[] {
  return SYSTEM_VARIABLES
    .filter((v) => !prefix || v.name.toLowerCase().includes(prefix.toLowerCase()))
    .map((v) => ({
      label: v.name,
      type: "constant",
      detail: "System variable",
      info: v.description,
      boost: BOOST.VARIABLE,
      apply: `"${v.name}"`,
    }));
}

/**
 * Main completion provider factory
 */
export function createSmartMongoCompletion(getData: () => MongoAutocompleteData) {
  return (context: CompletionContext) => {
    const mongoContext = getMongoContext(context.state, context.pos);
    const data = getData();

    // Don't complete inside strings unless explicit
    if (mongoContext.inString && !context.explicit) {
      return null;
    }

    const word = mongoContext.currentWord.replace(/["]/g, "");
    const completions: Completion[] = [];

    // Determine what completions to show based on context
    switch (mongoContext.type) {
      case "root":
        if (!mongoContext.afterColon) {
          // At root level, show root properties
          completions.push(...createPropertyCompletions(ROOT_PROPERTIES, word));
          // Also show snippets at root
          if (context.explicit || word.length >= 2) {
            completions.push(...createSnippetCompletions(word));
          }
        } else if (mongoContext.currentKey === "collection" && data.collections) {
          // After "collection":, show collection names
          completions.push(...createCollectionCompletions(data.collections, word));
        }
        break;

      case "pipeline":
        // Inside pipeline array, show stages
        completions.push(...createStageCompletions(word));
        break;

      case "stage":
        // Inside a stage object, show stage names
        if (!mongoContext.afterColon) {
          completions.push(...createStageCompletions(word));
        }
        break;

      case "query":
        // Inside query context, show operators
        if (!mongoContext.afterColon || word.startsWith("$")) {
          completions.push(...createOperatorCompletions(word, false));
        }
        // Show field names
        if (data.fields) {
          const fields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(fields, word, false));
        }
        break;

      case "update":
        // Inside update context, show update operators
        if (!mongoContext.afterColon || word.startsWith("$")) {
          completions.push(...createOperatorCompletions(word, true));
        }
        break;

      case "group":
        // Inside $group, show accumulators for value positions
        if (!mongoContext.afterColon) {
          // For keys, show _id or field names
          if (data.fields) {
            const fields = Object.values(data.fields).flat();
            completions.push(...createFieldCompletions(fields, word, false));
          }
          completions.push({
            label: "_id",
            type: "property",
            detail: "Group key",
            boost: BOOST.OPERATOR,
            apply: '"_id": ',
          });
        }
        break;

      case "group_accumulator":
        // Inside accumulator position, show accumulators
        completions.push(...createAccumulatorCompletions(word));
        break;

      case "project_expr":
      case "stage_body":
        // Inside project or stage body, show expressions
        if (mongoContext.afterColon || word.startsWith("$")) {
          completions.push(...createExpressionCompletions(word));
          // Show field paths
          if (data.fields) {
            const fields = Object.values(data.fields).flat();
            completions.push(...createFieldCompletions(fields, word, true));
          }
          // Show system variables
          completions.push(...createVariableCompletions(word));
        } else {
          // For keys, show field names
          if (data.fields) {
            const fields = Object.values(data.fields).flat();
            completions.push(...createFieldCompletions(fields, word, false));
          }
        }
        break;

      case "sort":
      case "projection":
        // Show field names
        if (data.fields) {
          const fields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(fields, word, false));
        }
        if (mongoContext.type === "sort" && mongoContext.afterColon) {
          // Show sort order values
          completions.push(
            { label: "1", type: "enum", detail: "Ascending", boost: BOOST.VALUE, apply: "1" },
            { label: "-1", type: "enum", detail: "Descending", boost: BOOST.VALUE, apply: "-1" }
          );
        }
        if (mongoContext.type === "projection" && mongoContext.afterColon) {
          completions.push(
            { label: "1", type: "enum", detail: "Include", boost: BOOST.VALUE, apply: "1" },
            { label: "0", type: "enum", detail: "Exclude", boost: BOOST.VALUE, apply: "0" }
          );
        }
        break;

      default:
        // Try to be helpful in unknown contexts
        if (canAddOperator(mongoContext)) {
          completions.push(...createOperatorCompletions(word, false));
        }
        if (canAddStage(mongoContext)) {
          completions.push(...createStageCompletions(word));
        }
        if (canAddAccumulator(mongoContext)) {
          completions.push(...createAccumulatorCompletions(word));
        }
        if (canAddExpression(mongoContext)) {
          completions.push(...createExpressionCompletions(word));
        }
        // Show field suggestions
        if (data.fields) {
          const fields = Object.values(data.fields).flat();
          completions.push(...createFieldCompletions(fields, word, mongoContext.expectsFieldPath));
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
      validFor: /^[\w"$.-]*$/,
    };
  };
}

/**
 * Export for simpler usage when data isn't needed
 */
export function createBasicMongoCompletion() {
  return createSmartMongoCompletion(() => ({}));
}
