/**
 * Types for MongoDB Query autocomplete
 *
 * MongoDB uses JSON-based queries with:
 * - Query operators ($eq, $gt, $in, $and, $or, etc.)
 * - Aggregation pipeline stages ($match, $group, $project, etc.)
 * - Aggregation expressions ($sum, $avg, $first, etc.)
 * - Field references and projections
 * - Update operators ($set, $inc, $push, etc.)
 */

// Context types for MongoDB queries
export type MongoContextType =
  | "root"              // Top level of the query document
  | "command"           // Inside command object (find, aggregate, etc.)
  | "query"             // Inside query filter
  | "projection"        // Inside projection
  | "sort"              // Inside sort specification
  | "pipeline"          // Inside aggregation pipeline array
  | "stage"             // Inside a pipeline stage
  | "stage_body"        // Inside stage body (e.g., inside $match)
  | "group"             // Inside $group stage
  | "group_accumulator" // Inside a $group accumulator
  | "project_expr"      // Inside $project expression
  | "update"            // Inside update document
  | "field_path"        // Expecting a field path (e.g., "$fieldName")
  | "operator"          // Expecting an operator
  | "value"             // Expecting a value
  | "unknown";

// Operator categories
export type MongoOperatorCategory =
  | "comparison"        // $eq, $gt, $gte, $lt, $lte, $ne, $in, $nin
  | "logical"           // $and, $or, $not, $nor
  | "element"           // $exists, $type
  | "evaluation"        // $regex, $expr, $mod, $text, $where
  | "array"             // $all, $elemMatch, $size
  | "bitwise"           // $bitsAllClear, $bitsAllSet, etc.
  | "geospatial"        // $geoWithin, $geoIntersects, $near
  | "update_field"      // $set, $unset, $rename, $inc, $mul
  | "update_array";     // $push, $pop, $pull, $addToSet

// Aggregation stage categories
export type MongoStageCategory =
  | "filter"            // $match, $limit, $skip
  | "transform"         // $project, $addFields, $set, $unset
  | "group"             // $group, $bucket, $bucketAuto
  | "sort"              // $sort, $sortByCount
  | "join"              // $lookup, $graphLookup
  | "reshape"           // $unwind, $replaceRoot, $replaceWith
  | "output"            // $out, $merge
  | "other";            // $count, $sample, $facet, $unionWith

// Accumulator categories (for $group and window functions)
export type MongoAccumulatorCategory =
  | "basic"             // $sum, $avg, $min, $max, $first, $last
  | "array"             // $push, $addToSet
  | "statistical"       // $stdDevPop, $stdDevSamp
  | "count";            // $count

// Expression categories
export type MongoExpressionCategory =
  | "arithmetic"        // $add, $subtract, $multiply, $divide, $mod
  | "string"            // $concat, $substr, $toUpper, $toLower, $trim
  | "date"              // $year, $month, $dayOfMonth, $hour, $minute
  | "array_expr"        // $arrayElemAt, $concatArrays, $filter, $map, $reduce
  | "conditional"       // $cond, $ifNull, $switch
  | "comparison_expr"   // $cmp, $eq, $gt, $gte, $lt, $lte, $ne
  | "type_expr"         // $type, $convert, $toInt, $toString
  | "object"            // $objectToArray, $arrayToObject, $mergeObjects
  | "set"               // $setEquals, $setIntersection, $setUnion
  | "text_search"       // $meta
  | "variable";         // $let, $$ROOT, $$CURRENT

// Operator definition
export interface MongoOperator {
  name: string;
  category: MongoOperatorCategory;
  description: string;
  syntax: string;
  example: string;
}

// Aggregation stage definition
export interface MongoStage {
  name: string;
  category: MongoStageCategory;
  description: string;
  syntax: string;
  example: string;
}

// Accumulator definition
export interface MongoAccumulator {
  name: string;
  category: MongoAccumulatorCategory;
  description: string;
  syntax: string;
  example: string;
}

// Expression definition
export interface MongoExpression {
  name: string;
  category: MongoExpressionCategory;
  description: string;
  syntax: string;
  example: string;
}

// Context at cursor position
export interface MongoContext {
  type: MongoContextType;
  path: string[];           // JSON path to current position
  currentKey?: string;      // Current key being typed
  parentKey?: string;       // Parent key
  inArray: boolean;         // Inside an array
  arrayIndex?: number;      // Index in array if applicable
  depth: number;            // Nesting depth
  cursorPos: number;
  currentWord: string;
  inString: boolean;
  afterColon: boolean;      // After "key": (expecting value)
  inPipeline: boolean;      // Inside aggregation pipeline
  currentStage?: string;    // Current pipeline stage (e.g., "$match")
  expectsFieldPath: boolean; // Expecting field path like "$field"
}

// Field information from collection
export interface MongoFieldInfo {
  name: string;
  type: MongoFieldType;
  isArray?: boolean;
  nestedFields?: MongoFieldInfo[];
}

export type MongoFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "objectId"
  | "array"
  | "object"
  | "null"
  | "binary"
  | "regex"
  | "mixed";

// Autocomplete data from the application
export interface MongoAutocompleteData {
  collections?: string[];
  fields?: Record<string, MongoFieldInfo[]>;  // collection -> fields
  databases?: string[];
}

// Completion item
export interface MongoCompletion {
  label: string;
  type: MongoCompletionType;
  detail?: string;
  info?: string;
  boost?: number;
  apply?: string;
}

export type MongoCompletionType =
  | "operator"        // Query/update operator
  | "stage"           // Pipeline stage
  | "accumulator"     // Group accumulator
  | "expression"      // Expression operator
  | "field"           // Field name
  | "field_path"      // Field path with $
  | "collection"      // Collection name
  | "keyword"         // MongoDB keyword
  | "value"           // Value suggestion
  | "snippet";        // Full snippet
