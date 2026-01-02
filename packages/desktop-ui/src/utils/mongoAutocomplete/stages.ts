/**
 * MongoDB Aggregation Pipeline Stages and Expressions
 *
 * Comprehensive definitions for aggregation framework autocomplete.
 */

import type { MongoStage, MongoAccumulator, MongoExpression } from "./types";

// Filter stages
export const FILTER_STAGES: MongoStage[] = [
  {
    name: "$match",
    category: "filter",
    description: "Filters documents to pass only matching documents to the next stage",
    syntax: '{ $match: { query } }',
    example: '{ "$match": { "status": "active", "age": { "$gte": 18 } } }',
  },
  {
    name: "$limit",
    category: "filter",
    description: "Limits the number of documents passed to the next stage",
    syntax: '{ $limit: number }',
    example: '{ "$limit": 10 }',
  },
  {
    name: "$skip",
    category: "filter",
    description: "Skips a specified number of documents",
    syntax: '{ $skip: number }',
    example: '{ "$skip": 20 }',
  },
  {
    name: "$sample",
    category: "filter",
    description: "Randomly selects the specified number of documents",
    syntax: '{ $sample: { size: number } }',
    example: '{ "$sample": { "size": 5 } }',
  },
];

// Transform stages
export const TRANSFORM_STAGES: MongoStage[] = [
  {
    name: "$project",
    category: "transform",
    description: "Reshapes documents by including, excluding, or computing fields",
    syntax: '{ $project: { field: 1 | 0 | expression, ... } }',
    example: '{ "$project": { "name": 1, "fullName": { "$concat": ["$firstName", " ", "$lastName"] }, "_id": 0 } }',
  },
  {
    name: "$addFields",
    category: "transform",
    description: "Adds new fields to documents",
    syntax: '{ $addFields: { newField: expression, ... } }',
    example: '{ "$addFields": { "totalPrice": { "$multiply": ["$price", "$quantity"] } } }',
  },
  {
    name: "$set",
    category: "transform",
    description: "Alias for $addFields - adds or updates fields",
    syntax: '{ $set: { field: expression, ... } }',
    example: '{ "$set": { "status": "processed", "processedAt": "$$NOW" } }',
  },
  {
    name: "$unset",
    category: "transform",
    description: "Removes specified fields from documents",
    syntax: '{ $unset: field | [field1, field2, ...] }',
    example: '{ "$unset": ["tempField", "internalId"] }',
  },
  {
    name: "$replaceRoot",
    category: "transform",
    description: "Replaces the input document with the specified document",
    syntax: '{ $replaceRoot: { newRoot: expression } }',
    example: '{ "$replaceRoot": { "newRoot": "$embeddedDoc" } }',
  },
  {
    name: "$replaceWith",
    category: "transform",
    description: "Alias for $replaceRoot - replaces document with expression result",
    syntax: '{ $replaceWith: expression }',
    example: '{ "$replaceWith": { "$mergeObjects": ["$defaults", "$$ROOT"] } }',
  },
];

// Group stages
export const GROUP_STAGES: MongoStage[] = [
  {
    name: "$group",
    category: "group",
    description: "Groups documents by a specified expression and applies accumulators",
    syntax: '{ $group: { _id: expression, field: { accumulator: expr }, ... } }',
    example: '{ "$group": { "_id": "$category", "count": { "$sum": 1 }, "avgPrice": { "$avg": "$price" } } }',
  },
  {
    name: "$bucket",
    category: "group",
    description: "Categorizes documents into buckets based on specified boundaries",
    syntax: '{ $bucket: { groupBy: expr, boundaries: [...], default: label, output: {...} } }',
    example: '{ "$bucket": { "groupBy": "$price", "boundaries": [0, 100, 500, 1000], "default": "Other", "output": { "count": { "$sum": 1 } } } }',
  },
  {
    name: "$bucketAuto",
    category: "group",
    description: "Automatically creates buckets with evenly distributed documents",
    syntax: '{ $bucketAuto: { groupBy: expr, buckets: number, output: {...} } }',
    example: '{ "$bucketAuto": { "groupBy": "$price", "buckets": 4, "output": { "count": { "$sum": 1 }, "avgPrice": { "$avg": "$price" } } } }',
  },
  {
    name: "$count",
    category: "group",
    description: "Returns a count of documents at this stage",
    syntax: '{ $count: fieldName }',
    example: '{ "$count": "totalDocuments" }',
  },
  {
    name: "$sortByCount",
    category: "group",
    description: "Groups by expression, counts, and sorts by count descending",
    syntax: '{ $sortByCount: expression }',
    example: '{ "$sortByCount": "$category" }',
  },
];

// Sort stages
export const SORT_STAGES: MongoStage[] = [
  {
    name: "$sort",
    category: "sort",
    description: "Reorders documents based on specified sort key",
    syntax: '{ $sort: { field1: 1 | -1, field2: 1 | -1, ... } }',
    example: '{ "$sort": { "score": -1, "name": 1 } }',
  },
];

// Join stages
export const JOIN_STAGES: MongoStage[] = [
  {
    name: "$lookup",
    category: "join",
    description: "Performs a left outer join with another collection",
    syntax: '{ $lookup: { from: coll, localField: field, foreignField: field, as: outputArray } }',
    example: '{ "$lookup": { "from": "orders", "localField": "_id", "foreignField": "userId", "as": "userOrders" } }',
  },
  {
    name: "$graphLookup",
    category: "join",
    description: "Performs recursive search on a collection",
    syntax: '{ $graphLookup: { from: coll, startWith: expr, connectFromField: field, connectToField: field, as: output, maxDepth: num } }',
    example: '{ "$graphLookup": { "from": "employees", "startWith": "$reportsTo", "connectFromField": "reportsTo", "connectToField": "_id", "as": "reportingHierarchy" } }',
  },
];

// Reshape stages
export const RESHAPE_STAGES: MongoStage[] = [
  {
    name: "$unwind",
    category: "reshape",
    description: "Deconstructs an array field to output one document per element",
    syntax: '{ $unwind: "$arrayField" | { path: "$arrayField", includeArrayIndex: field, preserveNullAndEmptyArrays: bool } }',
    example: '{ "$unwind": { "path": "$items", "includeArrayIndex": "itemIndex", "preserveNullAndEmptyArrays": true } }',
  },
  {
    name: "$facet",
    category: "reshape",
    description: "Creates multiple pipelines from a single input",
    syntax: '{ $facet: { outputField1: [stage1, stage2, ...], outputField2: [...] } }',
    example: '{ "$facet": { "byCategory": [{ "$sortByCount": "$category" }], "byPrice": [{ "$bucket": { "groupBy": "$price", "boundaries": [0, 100, 500] } }] } }',
  },
  {
    name: "$redact",
    category: "reshape",
    description: "Restricts content for each document based on stored access levels",
    syntax: '{ $redact: expression }',
    example: '{ "$redact": { "$cond": { "if": { "$eq": ["$level", "public"] }, "then": "$$DESCEND", "else": "$$PRUNE" } } }',
  },
];

// Output stages
export const OUTPUT_STAGES: MongoStage[] = [
  {
    name: "$out",
    category: "output",
    description: "Writes the pipeline results to a collection",
    syntax: '{ $out: collectionName | { db: dbName, coll: collName } }',
    example: '{ "$out": "processedOrders" }',
  },
  {
    name: "$merge",
    category: "output",
    description: "Merges pipeline results into an existing collection",
    syntax: '{ $merge: { into: coll, on: field, whenMatched: action, whenNotMatched: action } }',
    example: '{ "$merge": { "into": "reports", "on": "_id", "whenMatched": "replace", "whenNotMatched": "insert" } }',
  },
];

// Other stages
export const OTHER_STAGES: MongoStage[] = [
  {
    name: "$unionWith",
    category: "other",
    description: "Combines documents from two collections",
    syntax: '{ $unionWith: { coll: collName, pipeline: [...] } }',
    example: '{ "$unionWith": { "coll": "archivedOrders", "pipeline": [{ "$match": { "status": "completed" } }] } }',
  },
  {
    name: "$setWindowFields",
    category: "other",
    description: "Performs window calculations on documents",
    syntax: '{ $setWindowFields: { partitionBy: expr, sortBy: spec, output: { field: { windowOp: expr, window: {...} } } } }',
    example: '{ "$setWindowFields": { "partitionBy": "$state", "sortBy": { "date": 1 }, "output": { "cumulative": { "$sum": "$sales", "window": { "documents": ["unbounded", "current"] } } } } }',
  },
  {
    name: "$densify",
    category: "other",
    description: "Creates new documents to fill gaps in time or value sequences",
    syntax: '{ $densify: { field: fieldPath, partitionByFields: [...], range: { step: num, unit: string, bounds: ... } } }',
    example: '{ "$densify": { "field": "timestamp", "range": { "step": 1, "unit": "hour", "bounds": "full" } } }',
  },
  {
    name: "$fill",
    category: "other",
    description: "Populates null and missing field values",
    syntax: '{ $fill: { partitionBy: expr, sortBy: spec, output: { field: { method: methodName } } } }',
    example: '{ "$fill": { "sortBy": { "date": 1 }, "output": { "value": { "method": "linear" } } } }',
  },
];

// All stages
export const ALL_STAGES: MongoStage[] = [
  ...FILTER_STAGES,
  ...TRANSFORM_STAGES,
  ...GROUP_STAGES,
  ...SORT_STAGES,
  ...JOIN_STAGES,
  ...RESHAPE_STAGES,
  ...OUTPUT_STAGES,
  ...OTHER_STAGES,
];

// Stage lookup
export const STAGE_MAP = new Map<string, MongoStage>(
  ALL_STAGES.map((s) => [s.name, s])
);

// Get stage by name
export function getStage(name: string): MongoStage | undefined {
  return STAGE_MAP.get(name);
}

// Search stages by prefix
export function searchStages(prefix: string): MongoStage[] {
  const lower = prefix.toLowerCase();
  return ALL_STAGES.filter((s) => s.name.toLowerCase().startsWith(lower));
}

// Accumulators (used in $group, $bucket, $setWindowFields)
export const BASIC_ACCUMULATORS: MongoAccumulator[] = [
  {
    name: "$sum",
    category: "basic",
    description: "Returns the sum of numeric values",
    syntax: '{ $sum: expression }',
    example: '{ "$sum": "$quantity" }',
  },
  {
    name: "$avg",
    category: "basic",
    description: "Returns the average of numeric values",
    syntax: '{ $avg: expression }',
    example: '{ "$avg": "$price" }',
  },
  {
    name: "$min",
    category: "basic",
    description: "Returns the minimum value",
    syntax: '{ $min: expression }',
    example: '{ "$min": "$age" }',
  },
  {
    name: "$max",
    category: "basic",
    description: "Returns the maximum value",
    syntax: '{ $max: expression }',
    example: '{ "$max": "$score" }',
  },
  {
    name: "$first",
    category: "basic",
    description: "Returns the first value in a group",
    syntax: '{ $first: expression }',
    example: '{ "$first": "$date" }',
  },
  {
    name: "$last",
    category: "basic",
    description: "Returns the last value in a group",
    syntax: '{ $last: expression }',
    example: '{ "$last": "$status" }',
  },
  {
    name: "$count",
    category: "count",
    description: "Returns the count of documents",
    syntax: '{ $count: {} }',
    example: '{ "$count": {} }',
  },
];

export const ARRAY_ACCUMULATORS: MongoAccumulator[] = [
  {
    name: "$push",
    category: "array",
    description: "Returns an array of all values in the group",
    syntax: '{ $push: expression }',
    example: '{ "$push": "$item" }',
  },
  {
    name: "$addToSet",
    category: "array",
    description: "Returns an array of unique values",
    syntax: '{ $addToSet: expression }',
    example: '{ "$addToSet": "$category" }',
  },
];

export const STATISTICAL_ACCUMULATORS: MongoAccumulator[] = [
  {
    name: "$stdDevPop",
    category: "statistical",
    description: "Returns the population standard deviation",
    syntax: '{ $stdDevPop: expression }',
    example: '{ "$stdDevPop": "$score" }',
  },
  {
    name: "$stdDevSamp",
    category: "statistical",
    description: "Returns the sample standard deviation",
    syntax: '{ $stdDevSamp: expression }',
    example: '{ "$stdDevSamp": "$score" }',
  },
];

export const ALL_ACCUMULATORS: MongoAccumulator[] = [
  ...BASIC_ACCUMULATORS,
  ...ARRAY_ACCUMULATORS,
  ...STATISTICAL_ACCUMULATORS,
];

// Accumulator lookup
export const ACCUMULATOR_MAP = new Map<string, MongoAccumulator>(
  ALL_ACCUMULATORS.map((a) => [a.name, a])
);

// Get accumulator by name
export function getAccumulator(name: string): MongoAccumulator | undefined {
  return ACCUMULATOR_MAP.get(name);
}

// Search accumulators by prefix
export function searchAccumulators(prefix: string): MongoAccumulator[] {
  const lower = prefix.toLowerCase();
  return ALL_ACCUMULATORS.filter((a) => a.name.toLowerCase().startsWith(lower));
}

// Aggregation expressions
export const ARITHMETIC_EXPRESSIONS: MongoExpression[] = [
  { name: "$add", category: "arithmetic", description: "Adds numbers or dates", syntax: '{ $add: [expr1, expr2, ...] }', example: '{ "$add": ["$price", "$tax"] }' },
  { name: "$subtract", category: "arithmetic", description: "Subtracts two numbers or dates", syntax: '{ $subtract: [expr1, expr2] }', example: '{ "$subtract": ["$total", "$discount"] }' },
  { name: "$multiply", category: "arithmetic", description: "Multiplies numbers", syntax: '{ $multiply: [expr1, expr2, ...] }', example: '{ "$multiply": ["$price", "$quantity"] }' },
  { name: "$divide", category: "arithmetic", description: "Divides two numbers", syntax: '{ $divide: [expr1, expr2] }', example: '{ "$divide": ["$total", "$count"] }' },
  { name: "$mod", category: "arithmetic", description: "Returns remainder of division", syntax: '{ $mod: [expr1, expr2] }', example: '{ "$mod": ["$value", 3] }' },
  { name: "$abs", category: "arithmetic", description: "Returns absolute value", syntax: '{ $abs: expression }', example: '{ "$abs": "$change" }' },
  { name: "$ceil", category: "arithmetic", description: "Returns smallest integer >= value", syntax: '{ $ceil: expression }', example: '{ "$ceil": "$rating" }' },
  { name: "$floor", category: "arithmetic", description: "Returns largest integer <= value", syntax: '{ $floor: expression }', example: '{ "$floor": "$rating" }' },
  { name: "$round", category: "arithmetic", description: "Rounds to specified decimal place", syntax: '{ $round: [number, place] }', example: '{ "$round": ["$price", 2] }' },
  { name: "$trunc", category: "arithmetic", description: "Truncates to integer", syntax: '{ $trunc: expression }', example: '{ "$trunc": "$rating" }' },
  { name: "$pow", category: "arithmetic", description: "Raises to an exponent", syntax: '{ $pow: [number, exponent] }', example: '{ "$pow": [2, "$exponent"] }' },
  { name: "$sqrt", category: "arithmetic", description: "Returns square root", syntax: '{ $sqrt: expression }', example: '{ "$sqrt": "$variance" }' },
  { name: "$log", category: "arithmetic", description: "Returns logarithm", syntax: '{ $log: [number, base] }', example: '{ "$log": ["$value", 10] }' },
  { name: "$log10", category: "arithmetic", description: "Returns log base 10", syntax: '{ $log10: expression }', example: '{ "$log10": "$value" }' },
  { name: "$ln", category: "arithmetic", description: "Returns natural logarithm", syntax: '{ $ln: expression }', example: '{ "$ln": "$value" }' },
  { name: "$exp", category: "arithmetic", description: "Returns e^x", syntax: '{ $exp: expression }', example: '{ "$exp": "$growth" }' },
];

export const STRING_EXPRESSIONS: MongoExpression[] = [
  { name: "$concat", category: "string", description: "Concatenates strings", syntax: '{ $concat: [str1, str2, ...] }', example: '{ "$concat": ["$firstName", " ", "$lastName"] }' },
  { name: "$substr", category: "string", description: "Returns substring (deprecated)", syntax: '{ $substr: [string, start, length] }', example: '{ "$substr": ["$name", 0, 5] }' },
  { name: "$substrBytes", category: "string", description: "Returns substring by byte index", syntax: '{ $substrBytes: [string, start, length] }', example: '{ "$substrBytes": ["$name", 0, 5] }' },
  { name: "$substrCP", category: "string", description: "Returns substring by code point", syntax: '{ $substrCP: [string, start, length] }', example: '{ "$substrCP": ["$name", 0, 5] }' },
  { name: "$toUpper", category: "string", description: "Converts to uppercase", syntax: '{ $toUpper: expression }', example: '{ "$toUpper": "$name" }' },
  { name: "$toLower", category: "string", description: "Converts to lowercase", syntax: '{ $toLower: expression }', example: '{ "$toLower": "$email" }' },
  { name: "$trim", category: "string", description: "Removes whitespace", syntax: '{ $trim: { input: string, chars: charStr } }', example: '{ "$trim": { "input": "$name" } }' },
  { name: "$ltrim", category: "string", description: "Removes leading whitespace", syntax: '{ $ltrim: { input: string } }', example: '{ "$ltrim": { "input": "$name" } }' },
  { name: "$rtrim", category: "string", description: "Removes trailing whitespace", syntax: '{ $rtrim: { input: string } }', example: '{ "$rtrim": { "input": "$name" } }' },
  { name: "$split", category: "string", description: "Splits string by delimiter", syntax: '{ $split: [string, delimiter] }', example: '{ "$split": ["$tags", ","] }' },
  { name: "$strLenBytes", category: "string", description: "Returns byte length", syntax: '{ $strLenBytes: expression }', example: '{ "$strLenBytes": "$name" }' },
  { name: "$strLenCP", category: "string", description: "Returns code point length", syntax: '{ $strLenCP: expression }', example: '{ "$strLenCP": "$name" }' },
  { name: "$strcasecmp", category: "string", description: "Case-insensitive string comparison", syntax: '{ $strcasecmp: [str1, str2] }', example: '{ "$strcasecmp": ["$name", "John"] }' },
  { name: "$indexOfBytes", category: "string", description: "Returns byte index of substring", syntax: '{ $indexOfBytes: [string, substring] }', example: '{ "$indexOfBytes": ["$email", "@"] }' },
  { name: "$indexOfCP", category: "string", description: "Returns code point index", syntax: '{ $indexOfCP: [string, substring] }', example: '{ "$indexOfCP": ["$email", "@"] }' },
  { name: "$regexFind", category: "string", description: "Finds first regex match", syntax: '{ $regexFind: { input: string, regex: pattern } }', example: '{ "$regexFind": { "input": "$desc", "regex": "\\\\d+" } }' },
  { name: "$regexFindAll", category: "string", description: "Finds all regex matches", syntax: '{ $regexFindAll: { input: string, regex: pattern } }', example: '{ "$regexFindAll": { "input": "$desc", "regex": "\\\\d+" } }' },
  { name: "$regexMatch", category: "string", description: "Returns true if regex matches", syntax: '{ $regexMatch: { input: string, regex: pattern } }', example: '{ "$regexMatch": { "input": "$email", "regex": "^[a-z]+@" } }' },
  { name: "$replaceOne", category: "string", description: "Replaces first occurrence", syntax: '{ $replaceOne: { input: string, find: str, replacement: str } }', example: '{ "$replaceOne": { "input": "$text", "find": "old", "replacement": "new" } }' },
  { name: "$replaceAll", category: "string", description: "Replaces all occurrences", syntax: '{ $replaceAll: { input: string, find: str, replacement: str } }', example: '{ "$replaceAll": { "input": "$text", "find": "old", "replacement": "new" } }' },
];

export const DATE_EXPRESSIONS: MongoExpression[] = [
  { name: "$year", category: "date", description: "Returns the year", syntax: '{ $year: date }', example: '{ "$year": "$createdAt" }' },
  { name: "$month", category: "date", description: "Returns the month (1-12)", syntax: '{ $month: date }', example: '{ "$month": "$createdAt" }' },
  { name: "$dayOfMonth", category: "date", description: "Returns day of month (1-31)", syntax: '{ $dayOfMonth: date }', example: '{ "$dayOfMonth": "$createdAt" }' },
  { name: "$dayOfWeek", category: "date", description: "Returns day of week (1-7)", syntax: '{ $dayOfWeek: date }', example: '{ "$dayOfWeek": "$createdAt" }' },
  { name: "$dayOfYear", category: "date", description: "Returns day of year (1-366)", syntax: '{ $dayOfYear: date }', example: '{ "$dayOfYear": "$createdAt" }' },
  { name: "$hour", category: "date", description: "Returns the hour (0-23)", syntax: '{ $hour: date }', example: '{ "$hour": "$timestamp" }' },
  { name: "$minute", category: "date", description: "Returns the minute (0-59)", syntax: '{ $minute: date }', example: '{ "$minute": "$timestamp" }' },
  { name: "$second", category: "date", description: "Returns the second (0-59)", syntax: '{ $second: date }', example: '{ "$second": "$timestamp" }' },
  { name: "$millisecond", category: "date", description: "Returns the millisecond", syntax: '{ $millisecond: date }', example: '{ "$millisecond": "$timestamp" }' },
  { name: "$week", category: "date", description: "Returns the week (0-53)", syntax: '{ $week: date }', example: '{ "$week": "$createdAt" }' },
  { name: "$isoWeek", category: "date", description: "Returns ISO week (1-53)", syntax: '{ $isoWeek: date }', example: '{ "$isoWeek": "$createdAt" }' },
  { name: "$isoWeekYear", category: "date", description: "Returns ISO week year", syntax: '{ $isoWeekYear: date }', example: '{ "$isoWeekYear": "$createdAt" }' },
  { name: "$isoDayOfWeek", category: "date", description: "Returns ISO day of week (1-7)", syntax: '{ $isoDayOfWeek: date }', example: '{ "$isoDayOfWeek": "$createdAt" }' },
  { name: "$dateFromParts", category: "date", description: "Constructs date from parts", syntax: '{ $dateFromParts: { year: y, month: m, day: d, ... } }', example: '{ "$dateFromParts": { "year": 2023, "month": 1, "day": 15 } }' },
  { name: "$dateToParts", category: "date", description: "Returns date components", syntax: '{ $dateToParts: { date: expr } }', example: '{ "$dateToParts": { "date": "$createdAt" } }' },
  { name: "$dateFromString", category: "date", description: "Converts string to date", syntax: '{ $dateFromString: { dateString: string, format: fmt } }', example: '{ "$dateFromString": { "dateString": "2023-01-15" } }' },
  { name: "$dateToString", category: "date", description: "Converts date to string", syntax: '{ $dateToString: { date: expr, format: fmt } }', example: '{ "$dateToString": { "date": "$createdAt", "format": "%Y-%m-%d" } }' },
  { name: "$dateAdd", category: "date", description: "Adds time to date", syntax: '{ $dateAdd: { startDate: date, unit: unit, amount: num } }', example: '{ "$dateAdd": { "startDate": "$date", "unit": "day", "amount": 7 } }' },
  { name: "$dateSubtract", category: "date", description: "Subtracts time from date", syntax: '{ $dateSubtract: { startDate: date, unit: unit, amount: num } }', example: '{ "$dateSubtract": { "startDate": "$date", "unit": "month", "amount": 1 } }' },
  { name: "$dateDiff", category: "date", description: "Returns difference between dates", syntax: '{ $dateDiff: { startDate: d1, endDate: d2, unit: unit } }', example: '{ "$dateDiff": { "startDate": "$start", "endDate": "$end", "unit": "day" } }' },
  { name: "$dateTrunc", category: "date", description: "Truncates date to unit", syntax: '{ $dateTrunc: { date: expr, unit: unit } }', example: '{ "$dateTrunc": { "date": "$timestamp", "unit": "hour" } }' },
];

export const ARRAY_EXPRESSIONS: MongoExpression[] = [
  { name: "$arrayElemAt", category: "array_expr", description: "Returns element at index", syntax: '{ $arrayElemAt: [array, index] }', example: '{ "$arrayElemAt": ["$items", 0] }' },
  { name: "$first", category: "array_expr", description: "Returns first element", syntax: '{ $first: array }', example: '{ "$first": "$items" }' },
  { name: "$last", category: "array_expr", description: "Returns last element", syntax: '{ $last: array }', example: '{ "$last": "$items" }' },
  { name: "$concatArrays", category: "array_expr", description: "Concatenates arrays", syntax: '{ $concatArrays: [arr1, arr2, ...] }', example: '{ "$concatArrays": ["$arr1", "$arr2"] }' },
  { name: "$filter", category: "array_expr", description: "Filters array elements", syntax: '{ $filter: { input: array, as: var, cond: expr } }', example: '{ "$filter": { "input": "$items", "as": "item", "cond": { "$gte": ["$$item.price", 100] } } }' },
  { name: "$map", category: "array_expr", description: "Applies expression to each element", syntax: '{ $map: { input: array, as: var, in: expr } }', example: '{ "$map": { "input": "$items", "as": "item", "in": "$$item.name" } }' },
  { name: "$reduce", category: "array_expr", description: "Reduces array to single value", syntax: '{ $reduce: { input: array, initialValue: val, in: expr } }', example: '{ "$reduce": { "input": "$items", "initialValue": 0, "in": { "$add": ["$$value", "$$this.qty"] } } }' },
  { name: "$size", category: "array_expr", description: "Returns array length", syntax: '{ $size: array }', example: '{ "$size": "$items" }' },
  { name: "$slice", category: "array_expr", description: "Returns subset of array", syntax: '{ $slice: [array, n] | [array, pos, n] }', example: '{ "$slice": ["$items", 3] }' },
  { name: "$reverseArray", category: "array_expr", description: "Reverses array order", syntax: '{ $reverseArray: array }', example: '{ "$reverseArray": "$items" }' },
  { name: "$sortArray", category: "array_expr", description: "Sorts array elements", syntax: '{ $sortArray: { input: array, sortBy: spec } }', example: '{ "$sortArray": { "input": "$items", "sortBy": { "price": 1 } } }' },
  { name: "$in", category: "array_expr", description: "Checks if value is in array", syntax: '{ $in: [expr, array] }', example: '{ "$in": ["$category", ["A", "B", "C"]] }' },
  { name: "$indexOfArray", category: "array_expr", description: "Returns index of element", syntax: '{ $indexOfArray: [array, search] }', example: '{ "$indexOfArray": ["$items", "target"] }' },
  { name: "$isArray", category: "array_expr", description: "Checks if value is array", syntax: '{ $isArray: expression }', example: '{ "$isArray": "$items" }' },
  { name: "$range", category: "array_expr", description: "Generates array of integers", syntax: '{ $range: [start, end, step] }', example: '{ "$range": [0, 10, 2] }' },
  { name: "$zip", category: "array_expr", description: "Transposes arrays", syntax: '{ $zip: { inputs: [arr1, arr2], useLongestLength: bool } }', example: '{ "$zip": { "inputs": ["$names", "$ages"] } }' },
];

export const CONDITIONAL_EXPRESSIONS: MongoExpression[] = [
  { name: "$cond", category: "conditional", description: "If-then-else conditional", syntax: '{ $cond: { if: bool, then: expr, else: expr } }', example: '{ "$cond": { "if": { "$gte": ["$qty", 100] }, "then": "bulk", "else": "retail" } }' },
  { name: "$ifNull", category: "conditional", description: "Returns fallback if null", syntax: '{ $ifNull: [expr, fallback] }', example: '{ "$ifNull": ["$description", "No description"] }' },
  { name: "$switch", category: "conditional", description: "Evaluates case expressions", syntax: '{ $switch: { branches: [{case: cond, then: expr}, ...], default: expr } }', example: '{ "$switch": { "branches": [{ "case": { "$eq": ["$status", "A"] }, "then": "Active" }], "default": "Unknown" } }' },
];

export const TYPE_EXPRESSIONS: MongoExpression[] = [
  { name: "$type", category: "type_expr", description: "Returns BSON type of field", syntax: '{ $type: expression }', example: '{ "$type": "$field" }' },
  { name: "$convert", category: "type_expr", description: "Converts value to type", syntax: '{ $convert: { input: expr, to: type, onError: expr, onNull: expr } }', example: '{ "$convert": { "input": "$qty", "to": "int" } }' },
  { name: "$toBool", category: "type_expr", description: "Converts to boolean", syntax: '{ $toBool: expression }', example: '{ "$toBool": "$active" }' },
  { name: "$toDate", category: "type_expr", description: "Converts to date", syntax: '{ $toDate: expression }', example: '{ "$toDate": "$dateString" }' },
  { name: "$toDecimal", category: "type_expr", description: "Converts to decimal", syntax: '{ $toDecimal: expression }', example: '{ "$toDecimal": "$price" }' },
  { name: "$toDouble", category: "type_expr", description: "Converts to double", syntax: '{ $toDouble: expression }', example: '{ "$toDouble": "$value" }' },
  { name: "$toInt", category: "type_expr", description: "Converts to integer", syntax: '{ $toInt: expression }', example: '{ "$toInt": "$qty" }' },
  { name: "$toLong", category: "type_expr", description: "Converts to long", syntax: '{ $toLong: expression }', example: '{ "$toLong": "$bigNumber" }' },
  { name: "$toObjectId", category: "type_expr", description: "Converts to ObjectId", syntax: '{ $toObjectId: expression }', example: '{ "$toObjectId": "$idString" }' },
  { name: "$toString", category: "type_expr", description: "Converts to string", syntax: '{ $toString: expression }', example: '{ "$toString": "$value" }' },
];

export const OBJECT_EXPRESSIONS: MongoExpression[] = [
  { name: "$objectToArray", category: "object", description: "Converts object to array", syntax: '{ $objectToArray: object }', example: '{ "$objectToArray": "$specs" }' },
  { name: "$arrayToObject", category: "object", description: "Converts array to object", syntax: '{ $arrayToObject: array }', example: '{ "$arrayToObject": "$kvPairs" }' },
  { name: "$mergeObjects", category: "object", description: "Merges objects into one", syntax: '{ $mergeObjects: [obj1, obj2, ...] }', example: '{ "$mergeObjects": ["$defaults", "$overrides"] }' },
  { name: "$getField", category: "object", description: "Gets field value by name", syntax: '{ $getField: { field: name, input: obj } }', example: '{ "$getField": { "field": "a.b", "input": "$doc" } }' },
  { name: "$setField", category: "object", description: "Sets field value", syntax: '{ $setField: { field: name, input: obj, value: expr } }', example: '{ "$setField": { "field": "status", "input": "$$ROOT", "value": "updated" } }' },
];

export const SET_EXPRESSIONS: MongoExpression[] = [
  { name: "$setEquals", category: "set", description: "Returns true if sets are equal", syntax: '{ $setEquals: [arr1, arr2] }', example: '{ "$setEquals": ["$arr1", "$arr2"] }' },
  { name: "$setIntersection", category: "set", description: "Returns set intersection", syntax: '{ $setIntersection: [arr1, arr2, ...] }', example: '{ "$setIntersection": ["$tags1", "$tags2"] }' },
  { name: "$setUnion", category: "set", description: "Returns set union", syntax: '{ $setUnion: [arr1, arr2, ...] }', example: '{ "$setUnion": ["$tags1", "$tags2"] }' },
  { name: "$setDifference", category: "set", description: "Returns set difference", syntax: '{ $setDifference: [arr1, arr2] }', example: '{ "$setDifference": ["$all", "$excluded"] }' },
  { name: "$setIsSubset", category: "set", description: "Returns true if first is subset", syntax: '{ $setIsSubset: [arr1, arr2] }', example: '{ "$setIsSubset": ["$required", "$available"] }' },
  { name: "$allElementsTrue", category: "set", description: "Returns true if all elements true", syntax: '{ $allElementsTrue: array }', example: '{ "$allElementsTrue": ["$flags"] }' },
  { name: "$anyElementTrue", category: "set", description: "Returns true if any element true", syntax: '{ $anyElementTrue: array }', example: '{ "$anyElementTrue": ["$flags"] }' },
];

export const COMPARISON_EXPRESSIONS: MongoExpression[] = [
  { name: "$cmp", category: "comparison_expr", description: "Compares two values", syntax: '{ $cmp: [expr1, expr2] }', example: '{ "$cmp": ["$a", "$b"] }' },
  { name: "$eq", category: "comparison_expr", description: "Returns true if equal", syntax: '{ $eq: [expr1, expr2] }', example: '{ "$eq": ["$status", "active"] }' },
  { name: "$gt", category: "comparison_expr", description: "Returns true if greater", syntax: '{ $gt: [expr1, expr2] }', example: '{ "$gt": ["$age", 18] }' },
  { name: "$gte", category: "comparison_expr", description: "Returns true if greater or equal", syntax: '{ $gte: [expr1, expr2] }', example: '{ "$gte": ["$score", 80] }' },
  { name: "$lt", category: "comparison_expr", description: "Returns true if less", syntax: '{ $lt: [expr1, expr2] }', example: '{ "$lt": ["$price", 100] }' },
  { name: "$lte", category: "comparison_expr", description: "Returns true if less or equal", syntax: '{ $lte: [expr1, expr2] }', example: '{ "$lte": ["$qty", 10] }' },
  { name: "$ne", category: "comparison_expr", description: "Returns true if not equal", syntax: '{ $ne: [expr1, expr2] }', example: '{ "$ne": ["$status", "deleted"] }' },
];

export const VARIABLE_EXPRESSIONS: MongoExpression[] = [
  { name: "$let", category: "variable", description: "Binds variables for use in expression", syntax: '{ $let: { vars: { var: expr, ... }, in: expr } }', example: '{ "$let": { "vars": { "total": { "$add": ["$price", "$tax"] } }, "in": { "$multiply": ["$$total", 1.1] } } }' },
];

// All expressions
export const ALL_EXPRESSIONS: MongoExpression[] = [
  ...ARITHMETIC_EXPRESSIONS,
  ...STRING_EXPRESSIONS,
  ...DATE_EXPRESSIONS,
  ...ARRAY_EXPRESSIONS,
  ...CONDITIONAL_EXPRESSIONS,
  ...TYPE_EXPRESSIONS,
  ...OBJECT_EXPRESSIONS,
  ...SET_EXPRESSIONS,
  ...COMPARISON_EXPRESSIONS,
  ...VARIABLE_EXPRESSIONS,
];

// Expression lookup
export const EXPRESSION_MAP = new Map<string, MongoExpression>(
  ALL_EXPRESSIONS.map((e) => [e.name, e])
);

// Get expression by name
export function getExpression(name: string): MongoExpression | undefined {
  return EXPRESSION_MAP.get(name);
}

// Search expressions by prefix
export function searchExpressions(prefix: string): MongoExpression[] {
  const lower = prefix.toLowerCase();
  return ALL_EXPRESSIONS.filter((e) => e.name.toLowerCase().startsWith(lower));
}

// System variables
export const SYSTEM_VARIABLES = [
  { name: "$$ROOT", description: "The root document being processed" },
  { name: "$$CURRENT", description: "The current document being processed" },
  { name: "$$NOW", description: "Current datetime" },
  { name: "$$CLUSTER_TIME", description: "Current cluster timestamp" },
  { name: "$$REMOVE", description: "Indicates field should be removed" },
  { name: "$$DESCEND", description: "Return subdocuments in $redact" },
  { name: "$$PRUNE", description: "Exclude all fields at current level in $redact" },
  { name: "$$KEEP", description: "Keep all fields at current level in $redact" },
];
