/**
 * MongoDB Query and Update Operators
 *
 * Comprehensive operator definitions for context-aware autocomplete.
 */

import type { MongoOperator } from "./types";

// Comparison operators
export const COMPARISON_OPERATORS: MongoOperator[] = [
  {
    name: "$eq",
    category: "comparison",
    description: "Matches values equal to a specified value",
    syntax: '{ field: { $eq: value } }',
    example: '{ "status": { "$eq": "active" } }',
  },
  {
    name: "$ne",
    category: "comparison",
    description: "Matches values not equal to a specified value",
    syntax: '{ field: { $ne: value } }',
    example: '{ "status": { "$ne": "deleted" } }',
  },
  {
    name: "$gt",
    category: "comparison",
    description: "Matches values greater than a specified value",
    syntax: '{ field: { $gt: value } }',
    example: '{ "age": { "$gt": 18 } }',
  },
  {
    name: "$gte",
    category: "comparison",
    description: "Matches values greater than or equal to a specified value",
    syntax: '{ field: { $gte: value } }',
    example: '{ "age": { "$gte": 21 } }',
  },
  {
    name: "$lt",
    category: "comparison",
    description: "Matches values less than a specified value",
    syntax: '{ field: { $lt: value } }',
    example: '{ "price": { "$lt": 100 } }',
  },
  {
    name: "$lte",
    category: "comparison",
    description: "Matches values less than or equal to a specified value",
    syntax: '{ field: { $lte: value } }',
    example: '{ "price": { "$lte": 50 } }',
  },
  {
    name: "$in",
    category: "comparison",
    description: "Matches any value in an array",
    syntax: '{ field: { $in: [val1, val2, ...] } }',
    example: '{ "status": { "$in": ["active", "pending"] } }',
  },
  {
    name: "$nin",
    category: "comparison",
    description: "Matches none of the values in an array",
    syntax: '{ field: { $nin: [val1, val2, ...] } }',
    example: '{ "status": { "$nin": ["deleted", "archived"] } }',
  },
];

// Logical operators
export const LOGICAL_OPERATORS: MongoOperator[] = [
  {
    name: "$and",
    category: "logical",
    description: "Joins query clauses with a logical AND",
    syntax: '{ $and: [ { expr1 }, { expr2 }, ... ] }',
    example: '{ "$and": [{ "status": "active" }, { "age": { "$gte": 18 } }] }',
  },
  {
    name: "$or",
    category: "logical",
    description: "Joins query clauses with a logical OR",
    syntax: '{ $or: [ { expr1 }, { expr2 }, ... ] }',
    example: '{ "$or": [{ "status": "active" }, { "role": "admin" }] }',
  },
  {
    name: "$not",
    category: "logical",
    description: "Inverts the effect of a query expression",
    syntax: '{ field: { $not: { operator-expression } } }',
    example: '{ "price": { "$not": { "$gt": 100 } } }',
  },
  {
    name: "$nor",
    category: "logical",
    description: "Joins query clauses with a logical NOR",
    syntax: '{ $nor: [ { expr1 }, { expr2 }, ... ] }',
    example: '{ "$nor": [{ "status": "deleted" }, { "archived": true }] }',
  },
];

// Element operators
export const ELEMENT_OPERATORS: MongoOperator[] = [
  {
    name: "$exists",
    category: "element",
    description: "Matches documents that have the specified field",
    syntax: '{ field: { $exists: boolean } }',
    example: '{ "email": { "$exists": true } }',
  },
  {
    name: "$type",
    category: "element",
    description: "Selects documents if a field is of the specified type",
    syntax: '{ field: { $type: BSONType } }',
    example: '{ "age": { "$type": "number" } }',
  },
];

// Evaluation operators
export const EVALUATION_OPERATORS: MongoOperator[] = [
  {
    name: "$regex",
    category: "evaluation",
    description: "Selects documents where values match a regex pattern",
    syntax: '{ field: { $regex: pattern, $options: opts } }',
    example: '{ "name": { "$regex": "^John", "$options": "i" } }',
  },
  {
    name: "$expr",
    category: "evaluation",
    description: "Allows use of aggregation expressions within the query",
    syntax: '{ $expr: { expression } }',
    example: '{ "$expr": { "$gt": ["$spent", "$budget"] } }',
  },
  {
    name: "$mod",
    category: "evaluation",
    description: "Performs a modulo operation on the value of a field",
    syntax: '{ field: { $mod: [divisor, remainder] } }',
    example: '{ "qty": { "$mod": [4, 0] } }',
  },
  {
    name: "$text",
    category: "evaluation",
    description: "Performs text search",
    syntax: '{ $text: { $search: string, $language: lang, $caseSensitive: bool } }',
    example: '{ "$text": { "$search": "coffee shop" } }',
  },
  {
    name: "$where",
    category: "evaluation",
    description: "Matches documents that satisfy a JavaScript expression",
    syntax: '{ $where: jsExpr }',
    example: '{ "$where": "this.credits > this.debits" }',
  },
  {
    name: "$jsonSchema",
    category: "evaluation",
    description: "Validate documents against the given JSON Schema",
    syntax: '{ $jsonSchema: schemaObject }',
    example: '{ "$jsonSchema": { "required": ["name", "email"] } }',
  },
];

// Array operators
export const ARRAY_OPERATORS: MongoOperator[] = [
  {
    name: "$all",
    category: "array",
    description: "Matches arrays that contain all specified elements",
    syntax: '{ field: { $all: [val1, val2, ...] } }',
    example: '{ "tags": { "$all": ["mongodb", "database"] } }',
  },
  {
    name: "$elemMatch",
    category: "array",
    description: "Matches documents with array field containing element matching all conditions",
    syntax: '{ field: { $elemMatch: { condition1, condition2, ... } } }',
    example: '{ "results": { "$elemMatch": { "score": { "$gt": 80 }, "item": "abc" } } }',
  },
  {
    name: "$size",
    category: "array",
    description: "Matches arrays with specific number of elements",
    syntax: '{ field: { $size: number } }',
    example: '{ "tags": { "$size": 3 } }',
  },
];

// Bitwise operators
export const BITWISE_OPERATORS: MongoOperator[] = [
  {
    name: "$bitsAllClear",
    category: "bitwise",
    description: "Matches where all bit positions are clear",
    syntax: '{ field: { $bitsAllClear: bitmask } }',
    example: '{ "flags": { "$bitsAllClear": [1, 5] } }',
  },
  {
    name: "$bitsAllSet",
    category: "bitwise",
    description: "Matches where all bit positions are set",
    syntax: '{ field: { $bitsAllSet: bitmask } }',
    example: '{ "flags": { "$bitsAllSet": [1, 5] } }',
  },
  {
    name: "$bitsAnyClear",
    category: "bitwise",
    description: "Matches where any bit position is clear",
    syntax: '{ field: { $bitsAnyClear: bitmask } }',
    example: '{ "flags": { "$bitsAnyClear": [1, 5] } }',
  },
  {
    name: "$bitsAnySet",
    category: "bitwise",
    description: "Matches where any bit position is set",
    syntax: '{ field: { $bitsAnySet: bitmask } }',
    example: '{ "flags": { "$bitsAnySet": [1, 5] } }',
  },
];

// Geospatial operators
export const GEOSPATIAL_OPERATORS: MongoOperator[] = [
  {
    name: "$geoWithin",
    category: "geospatial",
    description: "Selects geometries within a bounding GeoJSON geometry",
    syntax: '{ field: { $geoWithin: { $geometry: geoJSON } } }',
    example: '{ "location": { "$geoWithin": { "$centerSphere": [[-73.93, 40.82], 5/3963.2] } } }',
  },
  {
    name: "$geoIntersects",
    category: "geospatial",
    description: "Selects geometries that intersect with a GeoJSON geometry",
    syntax: '{ field: { $geoIntersects: { $geometry: geoJSON } } }',
    example: '{ "location": { "$geoIntersects": { "$geometry": { "type": "Point", "coordinates": [-73.93, 40.82] } } } }',
  },
  {
    name: "$near",
    category: "geospatial",
    description: "Returns geospatial objects in proximity to a point",
    syntax: '{ field: { $near: { $geometry: point, $maxDistance: meters } } }',
    example: '{ "location": { "$near": { "$geometry": { "type": "Point", "coordinates": [-73.93, 40.82] }, "$maxDistance": 5000 } } }',
  },
  {
    name: "$nearSphere",
    category: "geospatial",
    description: "Returns geospatial objects in proximity using spherical geometry",
    syntax: '{ field: { $nearSphere: { $geometry: point, $maxDistance: meters } } }',
    example: '{ "location": { "$nearSphere": { "$geometry": { "type": "Point", "coordinates": [-73.93, 40.82] }, "$maxDistance": 5000 } } }',
  },
];

// Update field operators
export const UPDATE_FIELD_OPERATORS: MongoOperator[] = [
  {
    name: "$set",
    category: "update_field",
    description: "Sets the value of a field",
    syntax: '{ $set: { field: value, ... } }',
    example: '{ "$set": { "status": "active", "updatedAt": new Date() } }',
  },
  {
    name: "$unset",
    category: "update_field",
    description: "Removes a field from a document",
    syntax: '{ $unset: { field: "", ... } }',
    example: '{ "$unset": { "tempField": "" } }',
  },
  {
    name: "$inc",
    category: "update_field",
    description: "Increments a field by a specified value",
    syntax: '{ $inc: { field: amount, ... } }',
    example: '{ "$inc": { "views": 1, "score": 5 } }',
  },
  {
    name: "$mul",
    category: "update_field",
    description: "Multiplies a field by a specified value",
    syntax: '{ $mul: { field: number, ... } }',
    example: '{ "$mul": { "price": 1.1 } }',
  },
  {
    name: "$rename",
    category: "update_field",
    description: "Renames a field",
    syntax: '{ $rename: { oldName: newName, ... } }',
    example: '{ "$rename": { "nickname": "alias" } }',
  },
  {
    name: "$min",
    category: "update_field",
    description: "Only updates if the value is less than the existing value",
    syntax: '{ $min: { field: value, ... } }',
    example: '{ "$min": { "lowestScore": 50 } }',
  },
  {
    name: "$max",
    category: "update_field",
    description: "Only updates if the value is greater than the existing value",
    syntax: '{ $max: { field: value, ... } }',
    example: '{ "$max": { "highestScore": 100 } }',
  },
  {
    name: "$currentDate",
    category: "update_field",
    description: "Sets the value of a field to the current date",
    syntax: '{ $currentDate: { field: true | { $type: "date" | "timestamp" } } }',
    example: '{ "$currentDate": { "lastModified": true } }',
  },
  {
    name: "$setOnInsert",
    category: "update_field",
    description: "Sets fields only when inserting during an upsert",
    syntax: '{ $setOnInsert: { field: value, ... } }',
    example: '{ "$setOnInsert": { "createdAt": new Date() } }',
  },
];

// Update array operators
export const UPDATE_ARRAY_OPERATORS: MongoOperator[] = [
  {
    name: "$push",
    category: "update_array",
    description: "Adds an element to an array",
    syntax: '{ $push: { field: value } }',
    example: '{ "$push": { "tags": "new-tag" } }',
  },
  {
    name: "$pop",
    category: "update_array",
    description: "Removes the first or last element of an array",
    syntax: '{ $pop: { field: 1 | -1 } }',
    example: '{ "$pop": { "items": -1 } }',
  },
  {
    name: "$pull",
    category: "update_array",
    description: "Removes all instances of a value from an array",
    syntax: '{ $pull: { field: value | condition } }',
    example: '{ "$pull": { "tags": "deprecated" } }',
  },
  {
    name: "$pullAll",
    category: "update_array",
    description: "Removes all matching values from an array",
    syntax: '{ $pullAll: { field: [val1, val2, ...] } }',
    example: '{ "$pullAll": { "tags": ["old", "deprecated"] } }',
  },
  {
    name: "$addToSet",
    category: "update_array",
    description: "Adds elements to an array only if they don't exist",
    syntax: '{ $addToSet: { field: value } }',
    example: '{ "$addToSet": { "tags": "unique-tag" } }',
  },
  {
    name: "$each",
    category: "update_array",
    description: "Modifier for $push and $addToSet to add multiple elements",
    syntax: '{ $push: { field: { $each: [val1, val2] } } }',
    example: '{ "$push": { "tags": { "$each": ["tag1", "tag2"] } } }',
  },
  {
    name: "$slice",
    category: "update_array",
    description: "Modifier for $push to limit array size",
    syntax: '{ $push: { field: { $each: [...], $slice: num } } }',
    example: '{ "$push": { "scores": { "$each": [90], "$slice": -5 } } }',
  },
  {
    name: "$sort",
    category: "update_array",
    description: "Modifier for $push to sort array elements",
    syntax: '{ $push: { field: { $each: [...], $sort: spec } } }',
    example: '{ "$push": { "scores": { "$each": [90], "$sort": -1 } } }',
  },
  {
    name: "$position",
    category: "update_array",
    description: "Modifier for $push to specify position",
    syntax: '{ $push: { field: { $each: [...], $position: num } } }',
    example: '{ "$push": { "items": { "$each": ["new"], "$position": 0 } } }',
  },
];

// All query operators
export const ALL_QUERY_OPERATORS: MongoOperator[] = [
  ...COMPARISON_OPERATORS,
  ...LOGICAL_OPERATORS,
  ...ELEMENT_OPERATORS,
  ...EVALUATION_OPERATORS,
  ...ARRAY_OPERATORS,
  ...BITWISE_OPERATORS,
  ...GEOSPATIAL_OPERATORS,
];

// All update operators
export const ALL_UPDATE_OPERATORS: MongoOperator[] = [
  ...UPDATE_FIELD_OPERATORS,
  ...UPDATE_ARRAY_OPERATORS,
];

// All operators combined
export const ALL_OPERATORS: MongoOperator[] = [
  ...ALL_QUERY_OPERATORS,
  ...ALL_UPDATE_OPERATORS,
];

// Operator lookup by name
export const OPERATOR_MAP = new Map<string, MongoOperator>(
  ALL_OPERATORS.map((op) => [op.name, op])
);

// Get operator by name
export function getOperator(name: string): MongoOperator | undefined {
  return OPERATOR_MAP.get(name);
}

// Search operators by prefix
export function searchOperators(prefix: string): MongoOperator[] {
  const lower = prefix.toLowerCase();
  return ALL_OPERATORS.filter((op) =>
    op.name.toLowerCase().startsWith(lower)
  );
}

// Search query operators only
export function searchQueryOperators(prefix: string): MongoOperator[] {
  const lower = prefix.toLowerCase();
  return ALL_QUERY_OPERATORS.filter((op) =>
    op.name.toLowerCase().startsWith(lower)
  );
}

// Search update operators only
export function searchUpdateOperators(prefix: string): MongoOperator[] {
  const lower = prefix.toLowerCase();
  return ALL_UPDATE_OPERATORS.filter((op) =>
    op.name.toLowerCase().startsWith(lower)
  );
}
