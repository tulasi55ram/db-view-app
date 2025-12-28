/**
 * Document Query View
 *
 * A specialized query editor for document databases:
 * - MongoDB: Aggregation pipelines and find queries (JSON)
 * - Elasticsearch: Query DSL (JSON)
 * - Cassandra: CQL (SQL-like)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, History, Trash2, BookOpen, Wand2, Save, Bookmark } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { QueryResultsGrid } from "./QueryResultsGrid";
import { SavedQueriesPanel } from "./SavedQueriesPanel";
import { SaveQueryModal } from "./SaveQueryModal";
import { getElectronAPI, type QueryHistoryEntry, type SavedQuery } from "@/electron";
import { toast } from "sonner";

// Comprehensive MongoDB commands organized by category
const MONGO_COMMANDS = {
  examples: [
    { name: "Find All", desc: "Get all documents", example: `{\n  "collection": "users",\n  "find": {},\n  "limit": 10\n}` },
    { name: "Find with Filter", desc: "Filter by field", example: `{\n  "collection": "users",\n  "find": { "status": "active" },\n  "limit": 10\n}` },
    { name: "Find with Projection", desc: "Select specific fields", example: `{\n  "collection": "users",\n  "find": {},\n  "projection": { "name": 1, "email": 1, "_id": 0 },\n  "limit": 10\n}` },
    { name: "Find with Sort", desc: "Sort results", example: `{\n  "collection": "users",\n  "find": {},\n  "sort": { "createdAt": -1 },\n  "limit": 10\n}` },
    { name: "Find One", desc: "Get single document", example: `{\n  "collection": "users",\n  "findOne": { "_id": "user123" }\n}` },
    { name: "Count Documents", desc: "Count matching documents", example: `{\n  "collection": "users",\n  "count": { "status": "active" }\n}` },
    { name: "Distinct Values", desc: "Get unique field values", example: `{\n  "collection": "users",\n  "distinct": "status"\n}` },
    { name: "Aggregation Pipeline", desc: "Run aggregation", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$match": { "status": "completed" } },\n    { "$group": { "_id": "$customerId", "total": { "$sum": "$amount" } } },\n    { "$sort": { "total": -1 } },\n    { "$limit": 10 }\n  ]\n}` },
  ],
  stages: [
    { name: "$match", desc: "Filter documents", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$match": { "status": "active", "age": { "$gte": 18 } } }\n  ]\n}` },
    { name: "$group", desc: "Group and aggregate", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": {\n      "_id": "$category",\n      "count": { "$sum": 1 },\n      "totalAmount": { "$sum": "$amount" },\n      "avgAmount": { "$avg": "$amount" }\n    } }\n  ]\n}` },
    { name: "$sort", desc: "Sort documents", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$sort": { "price": -1, "name": 1 } }\n  ]\n}` },
    { name: "$project", desc: "Shape output fields", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": {\n      "fullName": { "$concat": ["$firstName", " ", "$lastName"] },\n      "email": 1,\n      "yearJoined": { "$year": "$createdAt" },\n      "_id": 0\n    } }\n  ]\n}` },
    { name: "$lookup", desc: "Join collections (LEFT JOIN)", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$lookup": {\n      "from": "users",\n      "localField": "userId",\n      "foreignField": "_id",\n      "as": "customer"\n    } },\n    { "$unwind": "$customer" },\n    { "$limit": 10 }\n  ]\n}` },
    { name: "$unwind", desc: "Deconstruct array", example: `{\n  "collection": "posts",\n  "pipeline": [\n    { "$unwind": "$tags" },\n    { "$group": { "_id": "$tags", "count": { "$sum": 1 } } },\n    { "$sort": { "count": -1 } }\n  ]\n}` },
    { name: "$addFields", desc: "Add computed fields", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$addFields": {\n      "totalWithTax": { "$multiply": ["$amount", 1.1] },\n      "year": { "$year": "$orderDate" },\n      "isLargeOrder": { "$gte": ["$amount", 1000] }\n    } },\n    { "$limit": 10 }\n  ]\n}` },
    { name: "$limit", desc: "Limit results", example: `{\n  "collection": "logs",\n  "pipeline": [\n    { "$sort": { "timestamp": -1 } },\n    { "$limit": 100 }\n  ]\n}` },
    { name: "$skip", desc: "Skip documents (pagination)", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$sort": { "name": 1 } },\n    { "$skip": 20 },\n    { "$limit": 10 }\n  ]\n}` },
    { name: "$count", desc: "Count documents", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$match": { "status": "active" } },\n    { "$count": "activeUsers" }\n  ]\n}` },
    { name: "$facet", desc: "Multiple aggregations", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$facet": {\n      "byCategory": [{ "$group": { "_id": "$category", "count": { "$sum": 1 } } }],\n      "priceStats": [{ "$group": { "_id": null, "avg": { "$avg": "$price" }, "max": { "$max": "$price" } } }],\n      "total": [{ "$count": "count" }]\n    } }\n  ]\n}` },
    { name: "$bucket", desc: "Group into ranges", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$bucket": {\n      "groupBy": "$price",\n      "boundaries": [0, 50, 100, 200, 500],\n      "default": "500+",\n      "output": { "count": { "$sum": 1 }, "products": { "$push": "$name" } }\n    } }\n  ]\n}` },
    { name: "$bucketAuto", desc: "Auto-bucket into groups", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$bucketAuto": {\n      "groupBy": "$price",\n      "buckets": 5,\n      "output": { "count": { "$sum": 1 }, "avgPrice": { "$avg": "$price" } }\n    } }\n  ]\n}` },
    { name: "$replaceRoot", desc: "Replace document root", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$replaceRoot": { "newRoot": "$profile" } }\n  ]\n}` },
    { name: "$out", desc: "Write to collection", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$customerId", "totalSpent": { "$sum": "$amount" } } },\n    { "$out": "customer_totals" }\n  ]\n}` },
    { name: "$merge", desc: "Merge into collection", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$customerId", "totalSpent": { "$sum": "$amount" } } },\n    { "$merge": { "into": "customer_stats", "whenMatched": "replace" } }\n  ]\n}` },
    { name: "$graphLookup", desc: "Recursive lookup", example: `{\n  "collection": "employees",\n  "pipeline": [\n    { "$graphLookup": {\n      "from": "employees",\n      "startWith": "$managerId",\n      "connectFromField": "managerId",\n      "connectToField": "_id",\n      "as": "reportingChain",\n      "maxDepth": 5\n    } }\n  ]\n}` },
    { name: "$sample", desc: "Random sample", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$sample": { "size": 5 } }\n  ]\n}` },
  ],
  comparison: [
    { name: "$eq", desc: "Equal to", example: `{\n  "collection": "users",\n  "find": { "status": { "$eq": "active" } },\n  "limit": 10\n}` },
    { name: "$ne", desc: "Not equal", example: `{\n  "collection": "users",\n  "find": { "status": { "$ne": "deleted" } },\n  "limit": 10\n}` },
    { name: "$gt", desc: "Greater than", example: `{\n  "collection": "products",\n  "find": { "price": { "$gt": 100 } },\n  "limit": 10\n}` },
    { name: "$gte", desc: "Greater than or equal", example: `{\n  "collection": "users",\n  "find": { "age": { "$gte": 18 } },\n  "limit": 10\n}` },
    { name: "$lt", desc: "Less than", example: `{\n  "collection": "products",\n  "find": { "stock": { "$lt": 10 } },\n  "limit": 10\n}` },
    { name: "$lte", desc: "Less than or equal", example: `{\n  "collection": "orders",\n  "find": { "amount": { "$lte": 500 } },\n  "limit": 10\n}` },
    { name: "$in", desc: "In array of values", example: `{\n  "collection": "products",\n  "find": { "category": { "$in": ["electronics", "computers", "phones"] } },\n  "limit": 10\n}` },
    { name: "$nin", desc: "Not in array", example: `{\n  "collection": "users",\n  "find": { "role": { "$nin": ["banned", "suspended"] } },\n  "limit": 10\n}` },
  ],
  logical: [
    { name: "$and", desc: "Logical AND", example: `{\n  "collection": "products",\n  "find": {\n    "$and": [\n      { "price": { "$gte": 50 } },\n      { "price": { "$lte": 200 } },\n      { "inStock": true }\n    ]\n  },\n  "limit": 10\n}` },
    { name: "$or", desc: "Logical OR", example: `{\n  "collection": "users",\n  "find": {\n    "$or": [\n      { "status": "active" },\n      { "role": "admin" }\n    ]\n  },\n  "limit": 10\n}` },
    { name: "$not", desc: "Logical NOT", example: `{\n  "collection": "products",\n  "find": { "price": { "$not": { "$gt": 100 } } },\n  "limit": 10\n}` },
    { name: "$nor", desc: "Logical NOR", example: `{\n  "collection": "users",\n  "find": {\n    "$nor": [\n      { "status": "banned" },\n      { "status": "deleted" }\n    ]\n  },\n  "limit": 10\n}` },
  ],
  element: [
    { name: "$exists", desc: "Field exists", example: `{\n  "collection": "users",\n  "find": { "email": { "$exists": true } },\n  "limit": 10\n}` },
    { name: "$type", desc: "Field is type", example: `{\n  "collection": "data",\n  "find": { "value": { "$type": "string" } },\n  "limit": 10\n}` },
  ],
  evaluation: [
    { name: "$regex", desc: "Regular expression", example: `{\n  "collection": "users",\n  "find": { "email": { "$regex": "@gmail\\\\.com$", "$options": "i" } },\n  "limit": 10\n}` },
    { name: "$text", desc: "Text search", example: `{\n  "collection": "articles",\n  "find": { "$text": { "$search": "mongodb tutorial" } },\n  "projection": { "score": { "$meta": "textScore" } },\n  "sort": { "score": { "$meta": "textScore" } },\n  "limit": 10\n}` },
    { name: "$expr", desc: "Expression evaluation", example: `{\n  "collection": "orders",\n  "find": { "$expr": { "$gt": ["$total", "$budget"] } },\n  "limit": 10\n}` },
    { name: "$mod", desc: "Modulo operation", example: `{\n  "collection": "items",\n  "find": { "quantity": { "$mod": [5, 0] } },\n  "limit": 10\n}` },
    { name: "$where", desc: "JavaScript expression", example: `{\n  "collection": "users",\n  "find": { "$where": "this.firstName.length > 5" },\n  "limit": 10\n}` },
  ],
  array: [
    { name: "$all", desc: "Match all elements", example: `{\n  "collection": "products",\n  "find": { "tags": { "$all": ["sale", "featured"] } },\n  "limit": 10\n}` },
    { name: "$elemMatch", desc: "Match array element", example: `{\n  "collection": "orders",\n  "find": {\n    "items": { "$elemMatch": { "product": "laptop", "quantity": { "$gte": 2 } } }\n  },\n  "limit": 10\n}` },
    { name: "$size", desc: "Array size equals", example: `{\n  "collection": "users",\n  "find": { "tags": { "$size": 3 } },\n  "limit": 10\n}` },
    { name: "$slice (projection)", desc: "Limit array elements", example: `{\n  "collection": "posts",\n  "find": {},\n  "projection": { "comments": { "$slice": 5 }, "title": 1 },\n  "limit": 10\n}` },
  ],
  accumulators: [
    { name: "$sum", desc: "Sum values", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$customerId", "totalSpent": { "$sum": "$amount" } } }\n  ]\n}` },
    { name: "$avg", desc: "Average value", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$group": { "_id": "$category", "avgPrice": { "$avg": "$price" } } }\n  ]\n}` },
    { name: "$min", desc: "Minimum value", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$status", "minAmount": { "$min": "$amount" } } }\n  ]\n}` },
    { name: "$max", desc: "Maximum value", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$status", "maxAmount": { "$max": "$amount" } } }\n  ]\n}` },
    { name: "$first", desc: "First value in group", example: `{\n  "collection": "logs",\n  "pipeline": [\n    { "$sort": { "timestamp": -1 } },\n    { "$group": { "_id": "$userId", "lastAction": { "$first": "$action" } } }\n  ]\n}` },
    { name: "$last", desc: "Last value in group", example: `{\n  "collection": "logs",\n  "pipeline": [\n    { "$sort": { "timestamp": 1 } },\n    { "$group": { "_id": "$userId", "lastAction": { "$last": "$action" } } }\n  ]\n}` },
    { name: "$push", desc: "Push to array", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$customerId", "orders": { "$push": "$orderId" } } }\n  ]\n}` },
    { name: "$addToSet", desc: "Add unique to array", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": "$customerId", "uniqueProducts": { "$addToSet": "$product" } } }\n  ]\n}` },
    { name: "$stdDevPop", desc: "Population std dev", example: `{\n  "collection": "scores",\n  "pipeline": [\n    { "$group": { "_id": "$class", "stdDev": { "$stdDevPop": "$score" } } }\n  ]\n}` },
  ],
  dateOps: [
    { name: "$year", desc: "Extract year", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$project": { "year": { "$year": "$orderDate" }, "amount": 1 } },\n    { "$limit": 10 }\n  ]\n}` },
    { name: "$month", desc: "Extract month", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": { "$month": "$orderDate" }, "count": { "$sum": 1 } } },\n    { "$sort": { "_id": 1 } }\n  ]\n}` },
    { name: "$dayOfMonth", desc: "Day of month", example: `{\n  "collection": "events",\n  "pipeline": [\n    { "$project": { "day": { "$dayOfMonth": "$eventDate" }, "name": 1 } }\n  ]\n}` },
    { name: "$dayOfWeek", desc: "Day of week (1-7)", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$group": { "_id": { "$dayOfWeek": "$orderDate" }, "count": { "$sum": 1 } } }\n  ]\n}` },
    { name: "$hour", desc: "Extract hour", example: `{\n  "collection": "logs",\n  "pipeline": [\n    { "$group": { "_id": { "$hour": "$timestamp" }, "events": { "$sum": 1 } } },\n    { "$sort": { "_id": 1 } }\n  ]\n}` },
    { name: "$dateToString", desc: "Format date", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$project": {\n      "formattedDate": { "$dateToString": { "format": "%Y-%m-%d", "date": "$orderDate" } },\n      "amount": 1\n    } }\n  ]\n}` },
    { name: "$dateDiff", desc: "Date difference", example: `{\n  "collection": "subscriptions",\n  "pipeline": [\n    { "$project": {\n      "daysActive": { "$dateDiff": { "startDate": "$startDate", "endDate": "$$NOW", "unit": "day" } }\n    } }\n  ]\n}` },
  ],
  stringOps: [
    { name: "$concat", desc: "Concatenate strings", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": { "fullName": { "$concat": ["$firstName", " ", "$lastName"] } } }\n  ]\n}` },
    { name: "$substr", desc: "Substring", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": { "shortName": { "$substr": ["$name", 0, 20] } } }\n  ]\n}` },
    { name: "$toUpper", desc: "Uppercase", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": { "upperName": { "$toUpper": "$name" } } }\n  ]\n}` },
    { name: "$toLower", desc: "Lowercase", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": { "lowerEmail": { "$toLower": "$email" } } }\n  ]\n}` },
    { name: "$split", desc: "Split string", example: `{\n  "collection": "emails",\n  "pipeline": [\n    { "$project": { "parts": { "$split": ["$email", "@"] } } }\n  ]\n}` },
    { name: "$trim", desc: "Trim whitespace", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": { "cleanName": { "$trim": { "input": "$name" } } } }\n  ]\n}` },
    { name: "$regexMatch", desc: "Regex test", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": {\n      "isGmail": { "$regexMatch": { "input": "$email", "regex": "@gmail\\\\.com$" } }\n    } }\n  ]\n}` },
  ],
  mathOps: [
    { name: "$add", desc: "Add numbers", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$project": { "totalWithShipping": { "$add": ["$subtotal", "$shipping"] } } }\n  ]\n}` },
    { name: "$subtract", desc: "Subtract numbers", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": { "discount": { "$subtract": ["$originalPrice", "$salePrice"] } } }\n  ]\n}` },
    { name: "$multiply", desc: "Multiply numbers", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$project": { "totalWithTax": { "$multiply": ["$amount", 1.1] } } }\n  ]\n}` },
    { name: "$divide", desc: "Divide numbers", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": { "pricePerUnit": { "$divide": ["$price", "$quantity"] } } }\n  ]\n}` },
    { name: "$mod", desc: "Modulo", example: `{\n  "collection": "items",\n  "pipeline": [\n    { "$project": { "remainder": { "$mod": ["$quantity", 12] } } }\n  ]\n}` },
    { name: "$abs", desc: "Absolute value", example: `{\n  "collection": "transactions",\n  "pipeline": [\n    { "$project": { "absAmount": { "$abs": "$amount" } } }\n  ]\n}` },
    { name: "$ceil", desc: "Ceiling", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": { "roundedPrice": { "$ceil": "$price" } } }\n  ]\n}` },
    { name: "$floor", desc: "Floor", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": { "roundedPrice": { "$floor": "$price" } } }\n  ]\n}` },
    { name: "$round", desc: "Round to decimal", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": { "roundedPrice": { "$round": ["$price", 2] } } }\n  ]\n}` },
  ],
  conditional: [
    { name: "$cond", desc: "If-then-else", example: `{\n  "collection": "products",\n  "pipeline": [\n    { "$project": {\n      "status": { "$cond": { "if": { "$gte": ["$stock", 10] }, "then": "In Stock", "else": "Low Stock" } }\n    } }\n  ]\n}` },
    { name: "$ifNull", desc: "Null coalescing", example: `{\n  "collection": "users",\n  "pipeline": [\n    { "$project": { "displayName": { "$ifNull": ["$nickname", "$name"] } } }\n  ]\n}` },
    { name: "$switch", desc: "Switch case", example: `{\n  "collection": "orders",\n  "pipeline": [\n    { "$project": {\n      "discount": {\n        "$switch": {\n          "branches": [\n            { "case": { "$gte": ["$amount", 1000] }, "then": 0.2 },\n            { "case": { "$gte": ["$amount", 500] }, "then": 0.1 },\n            { "case": { "$gte": ["$amount", 100] }, "then": 0.05 }\n          ],\n          "default": 0\n        }\n      }\n    } }\n  ]\n}` },
  ],
  update: [
    { name: "$set", desc: "Set field value", example: `{\n  "collection": "users",\n  "update": { "_id": "user123" },\n  "set": { "status": "active", "updatedAt": "$$NOW" }\n}` },
    { name: "$unset", desc: "Remove field", example: `{\n  "collection": "users",\n  "update": { "_id": "user123" },\n  "unset": { "temporaryField": "", "oldField": "" }\n}` },
    { name: "$inc", desc: "Increment value", example: `{\n  "collection": "products",\n  "update": { "_id": "prod123" },\n  "inc": { "views": 1, "stock": -1 }\n}` },
    { name: "$push (update)", desc: "Push to array", example: `{\n  "collection": "users",\n  "update": { "_id": "user123" },\n  "push": { "tags": "premium" }\n}` },
    { name: "$pull", desc: "Remove from array", example: `{\n  "collection": "users",\n  "update": { "_id": "user123" },\n  "pull": { "tags": "expired" }\n}` },
    { name: "$addToSet (update)", desc: "Add unique to array", example: `{\n  "collection": "users",\n  "update": { "_id": "user123" },\n  "addToSet": { "roles": "editor" }\n}` },
    { name: "$rename", desc: "Rename field", example: `{\n  "collection": "users",\n  "update": {},\n  "rename": { "old_field": "new_field" }\n}` },
    { name: "$min (update)", desc: "Update if less", example: `{\n  "collection": "products",\n  "update": { "_id": "prod123" },\n  "min": { "lowestPrice": 99.99 }\n}` },
    { name: "$max (update)", desc: "Update if greater", example: `{\n  "collection": "products",\n  "update": { "_id": "prod123" },\n  "max": { "highestPrice": 199.99 }\n}` },
    { name: "$currentDate", desc: "Set to current date", example: `{\n  "collection": "users",\n  "update": { "_id": "user123" },\n  "currentDate": { "lastModified": true, "lastLogin": { "$type": "timestamp" } }\n}` },
  ],
};

// MongoDB operators for autocomplete
const MONGO_OPERATORS = [
  { op: "$eq", desc: "Equal" },
  { op: "$ne", desc: "Not equal" },
  { op: "$gt", desc: "Greater than" },
  { op: "$gte", desc: "Greater or equal" },
  { op: "$lt", desc: "Less than" },
  { op: "$lte", desc: "Less or equal" },
  { op: "$in", desc: "In array" },
  { op: "$nin", desc: "Not in array" },
  { op: "$regex", desc: "Regex match" },
  { op: "$exists", desc: "Field exists" },
  { op: "$type", desc: "Type check" },
  { op: "$and", desc: "Logical AND" },
  { op: "$or", desc: "Logical OR" },
  { op: "$not", desc: "Logical NOT" },
  { op: "$sum", desc: "Sum values" },
  { op: "$avg", desc: "Average" },
  { op: "$min", desc: "Minimum" },
  { op: "$max", desc: "Maximum" },
  { op: "$first", desc: "First value" },
  { op: "$last", desc: "Last value" },
  { op: "$push", desc: "Push to array" },
];

// MongoDB stages for autocomplete
const MONGO_STAGES = Object.values(MONGO_COMMANDS.stages).map(s => ({ stage: s.name, desc: s.desc }));

// Comprehensive Elasticsearch commands organized by category
const ES_COMMANDS = {
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

// Elasticsearch types for autocomplete (derived from ES_COMMANDS)
const ES_QUERY_AUTOCOMPLETE = [
  ...ES_COMMANDS.fullText.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.termLevel.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.compound.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.nested.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.geo.map(c => ({ type: c.name, desc: c.desc })),
];

// Elasticsearch aggregations for autocomplete
const ES_AGG_AUTOCOMPLETE = [
  ...ES_COMMANDS.metricAggs.map(c => ({ type: c.name, desc: c.desc })),
  ...ES_COMMANDS.bucketAggs.map(c => ({ type: c.name, desc: c.desc })),
];

// CQL keywords for Cassandra
const CQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "IN", "CONTAINS", "CONTAINS KEY",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "TABLE", "KEYSPACE", "INDEX", "TYPE", "FUNCTION",
  "DROP", "ALTER", "TRUNCATE",
  "IF", "EXISTS", "NOT EXISTS",
  "PRIMARY KEY", "CLUSTERING ORDER", "WITH",
  "TTL", "TIMESTAMP", "WRITETIME",
  "LIMIT", "ORDER BY", "ASC", "DESC",
  "ALLOW FILTERING", "TOKEN", "USING",
  "BATCH", "APPLY", "BEGIN", "UNLOGGED",
  "GRANT", "REVOKE", "LIST", "PERMISSIONS",
  "UUID", "TIMEUUID", "NOW", "TODATE", "TOUNIXTIMESTAMP",
];

// Comprehensive Cassandra CQL commands organized by category
const CASSANDRA_COMMANDS = {
  examples: [
    { name: "Select All", desc: "Get all rows (limited)", example: `SELECT * FROM my_keyspace.my_table LIMIT 100;` },
    { name: "Select with Filter", desc: "Filter by partition key", example: `SELECT * FROM users WHERE user_id = 'abc123';` },
    { name: "Select Columns", desc: "Select specific columns", example: `SELECT name, email, created_at FROM users WHERE user_id = 'abc123';` },
    { name: "Insert Row", desc: "Insert a new row", example: `INSERT INTO users (user_id, name, email, created_at)
VALUES (uuid(), 'John Doe', 'john@example.com', toTimestamp(now()));` },
    { name: "Update Row", desc: "Update existing row", example: `UPDATE users SET name = 'Jane Doe', email = 'jane@example.com'
WHERE user_id = 'abc123';` },
    { name: "Delete Row", desc: "Delete a row", example: `DELETE FROM users WHERE user_id = 'abc123';` },
    { name: "Count Rows", desc: "Count matching rows", example: `SELECT COUNT(*) FROM users;` },
    { name: "Describe Table", desc: "Show table schema", example: `DESCRIBE TABLE my_keyspace.my_table;` },
  ],
  select: [
    { name: "SELECT *", desc: "Select all columns", example: `SELECT * FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT columns", desc: "Select specific columns", example: `SELECT user_id, name, email FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT DISTINCT", desc: "Distinct partition keys", example: `SELECT DISTINCT user_id FROM users;` },
    { name: "SELECT COUNT", desc: "Count rows", example: `SELECT COUNT(*) FROM users WHERE status = 'active' ALLOW FILTERING;` },
    { name: "SELECT with IN", desc: "Multiple partition keys", example: `SELECT * FROM users WHERE user_id IN ('id1', 'id2', 'id3');` },
    { name: "SELECT with LIMIT", desc: "Limit results", example: `SELECT * FROM events WHERE partition_key = 'key1' LIMIT 100;` },
    { name: "SELECT with ORDER BY", desc: "Order by clustering column", example: `SELECT * FROM events
WHERE partition_key = 'key1'
ORDER BY event_time DESC
LIMIT 50;` },
    { name: "SELECT with TOKEN", desc: "Token-based pagination", example: `SELECT * FROM users
WHERE TOKEN(user_id) > TOKEN('last_id')
LIMIT 100;` },
    { name: "SELECT with ALLOW FILTERING", desc: "Filter on non-key columns", example: `SELECT * FROM users
WHERE status = 'active'
ALLOW FILTERING;` },
    { name: "SELECT TTL", desc: "Get TTL of column", example: `SELECT user_id, TTL(name) FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT WRITETIME", desc: "Get write timestamp", example: `SELECT user_id, WRITETIME(name) FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT JSON", desc: "Return as JSON", example: `SELECT JSON * FROM users WHERE user_id = 'abc123';` },
  ],
  insert: [
    { name: "INSERT basic", desc: "Basic insert", example: `INSERT INTO users (user_id, name, email)
VALUES ('abc123', 'John Doe', 'john@example.com');` },
    { name: "INSERT with UUID", desc: "Auto-generate UUID", example: `INSERT INTO users (user_id, name, email)
VALUES (uuid(), 'John Doe', 'john@example.com');` },
    { name: "INSERT with TIMEUUID", desc: "Time-based UUID", example: `INSERT INTO events (event_id, event_type, created_at)
VALUES (now(), 'login', toTimestamp(now()));` },
    { name: "INSERT with TTL", desc: "Set time-to-live", example: `INSERT INTO sessions (session_id, user_id, data)
VALUES ('sess123', 'user456', 'session_data')
USING TTL 3600;` },
    { name: "INSERT with TIMESTAMP", desc: "Set write timestamp", example: `INSERT INTO users (user_id, name)
VALUES ('abc123', 'John Doe')
USING TIMESTAMP 1609459200000000;` },
    { name: "INSERT IF NOT EXISTS", desc: "Conditional insert (LWT)", example: `INSERT INTO users (user_id, name, email)
VALUES ('abc123', 'John Doe', 'john@example.com')
IF NOT EXISTS;` },
    { name: "INSERT JSON", desc: "Insert from JSON", example: `INSERT INTO users JSON '{"user_id": "abc123", "name": "John Doe", "email": "john@example.com"}';` },
    { name: "INSERT with DEFAULT", desc: "Use default values", example: `INSERT INTO users (user_id, name, created_at)
VALUES ('abc123', 'John Doe', toTimestamp(now()))
USING TTL 86400;` },
  ],
  update: [
    { name: "UPDATE basic", desc: "Basic update", example: `UPDATE users SET name = 'Jane Doe' WHERE user_id = 'abc123';` },
    { name: "UPDATE multiple", desc: "Update multiple columns", example: `UPDATE users
SET name = 'Jane Doe', email = 'jane@example.com', updated_at = toTimestamp(now())
WHERE user_id = 'abc123';` },
    { name: "UPDATE with TTL", desc: "Set TTL on update", example: `UPDATE users USING TTL 3600
SET session_token = 'token123'
WHERE user_id = 'abc123';` },
    { name: "UPDATE with TIMESTAMP", desc: "Set timestamp on update", example: `UPDATE users USING TIMESTAMP 1609459200000000
SET name = 'Jane Doe'
WHERE user_id = 'abc123';` },
    { name: "UPDATE IF EXISTS", desc: "Conditional update (LWT)", example: `UPDATE users SET name = 'Jane Doe'
WHERE user_id = 'abc123'
IF EXISTS;` },
    { name: "UPDATE IF condition", desc: "Update with condition (LWT)", example: `UPDATE users SET status = 'inactive'
WHERE user_id = 'abc123'
IF status = 'active';` },
    { name: "UPDATE counter", desc: "Increment counter column", example: `UPDATE user_stats SET login_count = login_count + 1
WHERE user_id = 'abc123';` },
    { name: "UPDATE list append", desc: "Append to list", example: `UPDATE users SET tags = tags + ['new_tag']
WHERE user_id = 'abc123';` },
    { name: "UPDATE list prepend", desc: "Prepend to list", example: `UPDATE users SET tags = ['first_tag'] + tags
WHERE user_id = 'abc123';` },
    { name: "UPDATE set add", desc: "Add to set", example: `UPDATE users SET roles = roles + {'admin'}
WHERE user_id = 'abc123';` },
    { name: "UPDATE set remove", desc: "Remove from set", example: `UPDATE users SET roles = roles - {'guest'}
WHERE user_id = 'abc123';` },
    { name: "UPDATE map put", desc: "Add/update map entry", example: `UPDATE users SET preferences['theme'] = 'dark'
WHERE user_id = 'abc123';` },
    { name: "UPDATE map remove", desc: "Remove map entry", example: `UPDATE users SET preferences = preferences - {'old_key'}
WHERE user_id = 'abc123';` },
  ],
  delete: [
    { name: "DELETE row", desc: "Delete entire row", example: `DELETE FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE column", desc: "Delete specific column", example: `DELETE email FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE multiple columns", desc: "Delete multiple columns", example: `DELETE email, phone FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE with IN", desc: "Delete multiple rows", example: `DELETE FROM users WHERE user_id IN ('id1', 'id2', 'id3');` },
    { name: "DELETE IF EXISTS", desc: "Conditional delete (LWT)", example: `DELETE FROM users WHERE user_id = 'abc123' IF EXISTS;` },
    { name: "DELETE IF condition", desc: "Delete with condition (LWT)", example: `DELETE FROM users
WHERE user_id = 'abc123'
IF status = 'inactive';` },
    { name: "DELETE list element", desc: "Remove from list by value", example: `DELETE tags['old_tag'] FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE with range", desc: "Delete range (clustering)", example: `DELETE FROM events
WHERE partition_key = 'pk1'
AND event_time >= '2024-01-01'
AND event_time < '2024-02-01';` },
  ],
  ddl: [
    { name: "CREATE KEYSPACE", desc: "Create new keyspace", example: `CREATE KEYSPACE IF NOT EXISTS my_keyspace
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
};` },
    { name: "CREATE KEYSPACE (NetworkTopology)", desc: "Multi-datacenter keyspace", example: `CREATE KEYSPACE IF NOT EXISTS my_keyspace
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 2
};` },
    { name: "CREATE TABLE", desc: "Create new table", example: `CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP
);` },
    { name: "CREATE TABLE (compound key)", desc: "Compound primary key", example: `CREATE TABLE IF NOT EXISTS events (
  partition_key TEXT,
  event_time TIMESTAMP,
  event_type TEXT,
  data TEXT,
  PRIMARY KEY (partition_key, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);` },
    { name: "CREATE TABLE (composite partition)", desc: "Composite partition key", example: `CREATE TABLE IF NOT EXISTS user_events (
  user_id UUID,
  year INT,
  event_time TIMESTAMP,
  event_type TEXT,
  PRIMARY KEY ((user_id, year), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);` },
    { name: "CREATE INDEX", desc: "Create secondary index", example: `CREATE INDEX IF NOT EXISTS users_email_idx
ON users (email);` },
    { name: "CREATE INDEX (collection)", desc: "Index on collection", example: `CREATE INDEX IF NOT EXISTS users_tags_idx
ON users (VALUES(tags));` },
    { name: "CREATE MATERIALIZED VIEW", desc: "Create materialized view", example: `CREATE MATERIALIZED VIEW users_by_email AS
SELECT * FROM users
WHERE email IS NOT NULL AND user_id IS NOT NULL
PRIMARY KEY (email, user_id);` },
    { name: "ALTER TABLE add", desc: "Add column", example: `ALTER TABLE users ADD phone TEXT;` },
    { name: "ALTER TABLE drop", desc: "Drop column", example: `ALTER TABLE users DROP phone;` },
    { name: "ALTER TABLE rename", desc: "Rename column", example: `ALTER TABLE users RENAME old_column TO new_column;` },
    { name: "DROP TABLE", desc: "Drop table", example: `DROP TABLE IF EXISTS users;` },
    { name: "DROP KEYSPACE", desc: "Drop keyspace", example: `DROP KEYSPACE IF EXISTS my_keyspace;` },
    { name: "DROP INDEX", desc: "Drop index", example: `DROP INDEX IF EXISTS users_email_idx;` },
    { name: "TRUNCATE", desc: "Remove all data", example: `TRUNCATE users;` },
  ],
  collections: [
    { name: "List column", desc: "Define list column", example: `-- In CREATE TABLE:
tags LIST<TEXT>

-- Insert:
INSERT INTO users (user_id, tags) VALUES ('abc', ['tag1', 'tag2']);

-- Append:
UPDATE users SET tags = tags + ['tag3'] WHERE user_id = 'abc';` },
    { name: "Set column", desc: "Define set column", example: `-- In CREATE TABLE:
roles SET<TEXT>

-- Insert:
INSERT INTO users (user_id, roles) VALUES ('abc', {'admin', 'user'});

-- Add:
UPDATE users SET roles = roles + {'editor'} WHERE user_id = 'abc';` },
    { name: "Map column", desc: "Define map column", example: `-- In CREATE TABLE:
preferences MAP<TEXT, TEXT>

-- Insert:
INSERT INTO users (user_id, preferences) VALUES ('abc', {'theme': 'dark', 'lang': 'en'});

-- Update entry:
UPDATE users SET preferences['theme'] = 'light' WHERE user_id = 'abc';` },
    { name: "Frozen collection", desc: "Immutable collection", example: `-- In CREATE TABLE (for nested or as clustering key):
address FROZEN<MAP<TEXT, TEXT>>

-- Must replace entire value:
UPDATE users SET address = {'street': '123 Main', 'city': 'NYC'} WHERE user_id = 'abc';` },
    { name: "Query CONTAINS", desc: "Filter by collection value", example: `SELECT * FROM users
WHERE tags CONTAINS 'premium'
ALLOW FILTERING;` },
    { name: "Query CONTAINS KEY", desc: "Filter by map key", example: `SELECT * FROM users
WHERE preferences CONTAINS KEY 'theme'
ALLOW FILTERING;` },
  ],
  functions: [
    { name: "now()", desc: "Current time UUID", example: `INSERT INTO events (event_id, event_type)
VALUES (now(), 'login');` },
    { name: "uuid()", desc: "Random UUID", example: `INSERT INTO users (user_id, name)
VALUES (uuid(), 'John Doe');` },
    { name: "toTimestamp()", desc: "Convert to timestamp", example: `SELECT toTimestamp(now()) AS current_time FROM system.local;` },
    { name: "toDate()", desc: "Convert to date", example: `SELECT toDate(now()) AS current_date FROM system.local;` },
    { name: "toUnixTimestamp()", desc: "Convert to Unix timestamp", example: `SELECT toUnixTimestamp(now()) AS unix_ts FROM system.local;` },
    { name: "dateOf()", desc: "Extract date from timeuuid", example: `SELECT dateOf(event_id) FROM events WHERE partition_key = 'pk1';` },
    { name: "minTimeuuid()", desc: "Min timeuuid for date", example: `SELECT * FROM events
WHERE partition_key = 'pk1'
AND event_id >= minTimeuuid('2024-01-01 00:00:00+0000')
AND event_id < maxTimeuuid('2024-02-01 00:00:00+0000');` },
    { name: "maxTimeuuid()", desc: "Max timeuuid for date", example: `SELECT * FROM events
WHERE partition_key = 'pk1'
AND event_id <= maxTimeuuid('2024-01-31 23:59:59+0000');` },
    { name: "token()", desc: "Get partition token", example: `SELECT token(user_id), * FROM users;` },
    { name: "TTL()", desc: "Get column TTL", example: `SELECT TTL(session_token) FROM users WHERE user_id = 'abc123';` },
    { name: "WRITETIME()", desc: "Get write timestamp", example: `SELECT WRITETIME(name) FROM users WHERE user_id = 'abc123';` },
    { name: "CAST()", desc: "Type casting", example: `SELECT CAST(created_at AS DATE) FROM users WHERE user_id = 'abc123';` },
    { name: "blobAsText()", desc: "Convert blob to text", example: `SELECT blobAsText(data) FROM binary_data WHERE id = 'abc';` },
    { name: "textAsBlob()", desc: "Convert text to blob", example: `INSERT INTO binary_data (id, data) VALUES ('abc', textAsBlob('hello'));` },
  ],
  aggregates: [
    { name: "COUNT(*)", desc: "Count all rows", example: `SELECT COUNT(*) FROM users;` },
    { name: "COUNT(column)", desc: "Count non-null values", example: `SELECT COUNT(email) FROM users;` },
    { name: "SUM()", desc: "Sum numeric column", example: `SELECT SUM(amount) FROM orders WHERE user_id = 'abc123';` },
    { name: "AVG()", desc: "Average of column", example: `SELECT AVG(price) FROM products WHERE category = 'electronics' ALLOW FILTERING;` },
    { name: "MIN()", desc: "Minimum value", example: `SELECT MIN(created_at) FROM users;` },
    { name: "MAX()", desc: "Maximum value", example: `SELECT MAX(price) FROM products;` },
    { name: "GROUP BY", desc: "Group aggregates", example: `SELECT status, COUNT(*)
FROM users
GROUP BY status;` },
    { name: "GROUP BY (partition)", desc: "Group by partition key", example: `SELECT user_id, COUNT(*), SUM(amount)
FROM orders
GROUP BY user_id;` },
  ],
  batch: [
    { name: "BATCH (logged)", desc: "Atomic batch (default)", example: `BEGIN BATCH
  INSERT INTO users (user_id, name) VALUES ('id1', 'User 1');
  INSERT INTO users (user_id, name) VALUES ('id2', 'User 2');
  UPDATE user_stats SET count = count + 2 WHERE stat_id = 'total';
APPLY BATCH;` },
    { name: "BATCH (unlogged)", desc: "Non-atomic batch", example: `BEGIN UNLOGGED BATCH
  INSERT INTO logs (log_id, message) VALUES (now(), 'Log 1');
  INSERT INTO logs (log_id, message) VALUES (now(), 'Log 2');
  INSERT INTO logs (log_id, message) VALUES (now(), 'Log 3');
APPLY BATCH;` },
    { name: "BATCH (counter)", desc: "Counter batch", example: `BEGIN COUNTER BATCH
  UPDATE page_views SET views = views + 1 WHERE page_id = 'home';
  UPDATE page_views SET views = views + 1 WHERE page_id = 'about';
APPLY BATCH;` },
    { name: "BATCH with TTL", desc: "Batch with TTL", example: `BEGIN BATCH USING TTL 3600
  INSERT INTO sessions (session_id, user_id) VALUES ('s1', 'u1');
  INSERT INTO sessions (session_id, user_id) VALUES ('s2', 'u2');
APPLY BATCH;` },
    { name: "BATCH with TIMESTAMP", desc: "Batch with timestamp", example: `BEGIN BATCH USING TIMESTAMP 1609459200000000
  INSERT INTO audit (id, action) VALUES (uuid(), 'create');
  INSERT INTO audit (id, action) VALUES (uuid(), 'update');
APPLY BATCH;` },
  ],
  admin: [
    { name: "DESCRIBE KEYSPACES", desc: "List all keyspaces", example: `DESCRIBE KEYSPACES;` },
    { name: "DESCRIBE KEYSPACE", desc: "Describe keyspace", example: `DESCRIBE KEYSPACE my_keyspace;` },
    { name: "DESCRIBE TABLES", desc: "List tables in keyspace", example: `DESCRIBE TABLES;` },
    { name: "DESCRIBE TABLE", desc: "Describe table schema", example: `DESCRIBE TABLE users;` },
    { name: "USE keyspace", desc: "Switch keyspace", example: `USE my_keyspace;` },
    { name: "CONSISTENCY", desc: "Set consistency level", example: `CONSISTENCY QUORUM;
-- Options: ANY, ONE, TWO, THREE, QUORUM, ALL, LOCAL_QUORUM, EACH_QUORUM, LOCAL_ONE` },
    { name: "TRACING ON", desc: "Enable query tracing", example: `TRACING ON;
SELECT * FROM users WHERE user_id = 'abc123';
TRACING OFF;` },
    { name: "EXPAND ON", desc: "Vertical output format", example: `EXPAND ON;
SELECT * FROM users LIMIT 1;
EXPAND OFF;` },
    { name: "SOURCE", desc: "Execute CQL file", example: `SOURCE '/path/to/script.cql';` },
    { name: "COPY TO", desc: "Export to CSV", example: `COPY users (user_id, name, email) TO '/tmp/users.csv' WITH HEADER = TRUE;` },
    { name: "COPY FROM", desc: "Import from CSV", example: `COPY users (user_id, name, email) FROM '/tmp/users.csv' WITH HEADER = TRUE;` },
  ],
};

export interface DocumentQueryViewProps {
  tab: {
    id: string;
    connectionKey?: string;
    connectionName?: string;
    sql?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    loading?: boolean;
    error?: string;
  };
  onTabUpdate: (
    tabId: string,
    updates: {
      sql?: string;
      columns?: string[];
      rows?: Record<string, unknown>[];
      loading?: boolean;
      error?: string;
      isDirty?: boolean;
    }
  ) => void;
  dbType: "mongodb" | "elasticsearch" | "cassandra";
}

export function DocumentQueryView({ tab, onTabUpdate, dbType }: DocumentQueryViewProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [persistedHistory, setPersistedHistory] = useState<QueryHistoryEntry[]>([]);
  const [showReference, setShowReference] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());

  const api = getElectronAPI();

  // Database-specific configuration
  const config = {
    mongodb: {
      name: "MongoDB",
      icon: "🍃",
      color: "text-green-500",
      bgColor: "bg-green-500",
      borderColor: "border-green-500",
      placeholder: 'Enter MongoDB query with collection name...\n\nFind: { "collection": "users", "find": { "status": "active" }, "limit": 10 }\n\nAggregate: { "collection": "orders", "pipeline": [{ "$match": {} }] }',
      language: json(),
    },
    elasticsearch: {
      name: "Elasticsearch",
      icon: "🔍",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      borderColor: "border-yellow-500",
      placeholder: 'Enter Query DSL with index...\nExample: { "index": "my-index", "query": { "match_all": {} }, "size": 10 }',
      language: json(),
    },
    cassandra: {
      name: "Cassandra",
      icon: "👁️",
      color: "text-blue-400",
      bgColor: "bg-blue-400",
      borderColor: "border-blue-400",
      placeholder: 'Enter CQL query...\nExample: SELECT * FROM users WHERE status = \'active\' LIMIT 10;',
      language: sql(),
    },
  }[dbType];

  // Load persisted history and saved queries on mount
  useEffect(() => {
    if (tab.connectionKey && api) {
      api
        .getQueryHistory(tab.connectionKey)
        .then((history) => {
          setPersistedHistory(history);
        })
        .catch((err) => {
          console.error("Failed to load query history:", err);
        });

      api
        .getSavedQueries(tab.connectionKey)
        .then((queries) => {
          setSavedQueries(queries);
        })
        .catch((err) => {
          console.error("Failed to load saved queries:", err);
        });
    }
  }, [tab.connectionKey, api]);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current) return;

    // Autocomplete based on database type
    const autocomplete = (context: CompletionContext) => {
      const word = context.matchBefore(/[\w$]*/);
      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      const input = word.text.toLowerCase();
      const suggestions: any[] = [];

      if (dbType === "mongodb") {
        // MongoDB stages
        MONGO_STAGES.forEach(({ stage, desc }) => {
          if (stage.toLowerCase().includes(input)) {
            suggestions.push({
              label: stage,
              detail: desc,
              type: "keyword",
              boost: 2,
            });
          }
        });
        // MongoDB operators
        MONGO_OPERATORS.forEach(({ op, desc }) => {
          if (op.toLowerCase().includes(input)) {
            suggestions.push({
              label: op,
              detail: desc,
              type: "function",
              boost: 1,
            });
          }
        });
      } else if (dbType === "elasticsearch") {
        // ES query types
        ES_QUERY_AUTOCOMPLETE.forEach(({ type, desc }) => {
          if (type.toLowerCase().includes(input)) {
            suggestions.push({
              label: type,
              detail: desc,
              type: "keyword",
              boost: 2,
            });
          }
        });
        // ES aggregations
        ES_AGG_AUTOCOMPLETE.forEach(({ type, desc }) => {
          if (type.toLowerCase().includes(input)) {
            suggestions.push({
              label: type,
              detail: `Agg: ${desc}`,
              type: "function",
              boost: 1,
            });
          }
        });
      } else if (dbType === "cassandra") {
        // CQL keywords
        CQL_KEYWORDS.forEach((kw) => {
          if (kw.toLowerCase().includes(input)) {
            suggestions.push({
              label: kw,
              type: "keyword",
            });
          }
        });
      }

      return {
        from: word.from,
        options: suggestions,
        validFor: /^[\w$]*$/,
      };
    };

    // Dark theme
    const darkTheme = EditorView.theme(
      {
        "&": {
          backgroundColor: "#171717",
          color: "#fafafa",
          height: "220px",
          fontSize: "13px",
          lineHeight: "1.5",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        },
        ".cm-content": {
          caretColor: dbType === "mongodb" ? "#22c55e" : dbType === "elasticsearch" ? "#eab308" : "#60a5fa",
          padding: "12px 0",
        },
        ".cm-line": {
          lineHeight: "1.5",
        },
        ".cm-cursor": {
          borderLeftColor: dbType === "mongodb" ? "#22c55e" : dbType === "elasticsearch" ? "#eab308" : "#60a5fa",
          borderLeftWidth: "2px",
          height: "1.2em !important",
        },
        ".cm-activeLine": {
          backgroundColor: "#262626",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#262626",
        },
        ".cm-gutters": {
          backgroundColor: "#171717",
          color: "#737373",
          border: "none",
          minWidth: "40px",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          padding: "0 12px 0 8px",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: dbType === "mongodb" ? "#22c55e" : dbType === "elasticsearch" ? "#eab308" : "#60a5fa",
          color: "#ffffff",
        },
        ".cm-selectionBackground": {
          backgroundColor: "#262626",
        },
        ".cm-tooltip": {
          backgroundColor: "#262626",
          border: "1px solid #404040",
          color: "#fafafa",
        },
        ".cm-tooltip-autocomplete": {
          backgroundColor: "#262626",
          border: "1px solid #404040",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: "#404040",
          color: "#fafafa",
        },
        ".cm-placeholder": {
          color: "#737373",
          lineHeight: "1.5",
        },
      },
      { dark: true }
    );

    const startState = EditorState.create({
      doc: tab.sql || getDefaultQuery(dbType),
      extensions: [
        EditorView.lineWrapping,
        history(),
        config.language,
        syntaxHighlighting(defaultHighlightStyle),
        autocompletion({
          override: [autocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 15,
        }),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              handleRunQuery();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        darkTheme,
        readOnlyCompartment.current.of(EditorState.readOnly.of(tab.loading || false)),
        placeholderExt(config.placeholder),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onTabUpdate(tab.id, { sql: newValue, isDirty: true });
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
    };
  }, [dbType]);

  // Update readonly state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(
          EditorState.readOnly.of(tab.loading || false)
        ),
      });
    }
  }, [tab.loading]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== tab.sql && tab.sql !== undefined) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: tab.sql },
        });
      }
    }
  }, [tab.sql]);

  // Handle format JSON
  const handleFormat = useCallback(() => {
    if (!tab.sql || dbType === "cassandra") return;

    try {
      const parsed = JSON.parse(tab.sql);
      const formatted = JSON.stringify(parsed, null, 2);
      onTabUpdate(tab.id, { sql: formatted, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: formatted },
        });
      }
      toast.success("Query formatted");
    } catch {
      toast.error("Invalid JSON - cannot format");
    }
  }, [tab.sql, tab.id, dbType, onTabUpdate]);

  // Handle run query
  const handleRunQuery = useCallback(async () => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      if (!tab.connectionKey) {
        toast.error("No connection selected");
      }
      return;
    }

    const startTime = Date.now();
    onTabUpdate(tab.id, { loading: true, error: undefined });

    try {
      const result = await api.runQuery({
        connectionKey: tab.connectionKey,
        sql: tab.sql,
      });

      const duration = Date.now() - startTime;

      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        rowCount: result.rows.length,
        success: true,
      };

      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-50));

      onTabUpdate(tab.id, {
        columns: result.columns,
        rows: result.rows,
        loading: false,
      });

      toast.success(`Query executed (${result.rows.length} docs, ${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        success: false,
        error: error.message || "Unknown error",
      };

      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-50));

      onTabUpdate(tab.id, {
        loading: false,
        error: error.message || "Failed to execute query",
      });

      toast.error(`Query failed: ${error.message}`);
    }
  }, [tab, onTabUpdate, api]);

  // Handle history selection (replaces entire content)
  const handleSelectFromHistory = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: sql },
        });
      }
    },
    [tab.id, onTabUpdate]
  );

  // Handle inserting example from reference panel (replaces if empty, otherwise inserts at cursor)
  const handleInsertExample = useCallback(
    (example: string) => {
      if (!viewRef.current) return;

      const currentValue = viewRef.current.state.doc.toString().trim();
      const defaultQuery = getDefaultQuery(dbType).trim();

      // If editor is empty or has default content, replace entirely
      if (!currentValue || currentValue === defaultQuery) {
        onTabUpdate(tab.id, { sql: example, isDirty: true });
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: example },
        });
      } else {
        // Append at the end
        const insertText = "\n\n" + example;
        const newContent = currentValue + insertText;

        onTabUpdate(tab.id, { sql: newContent, isDirty: true });
        viewRef.current.dispatch({
          changes: { from: viewRef.current.state.doc.length, insert: insertText },
          selection: { anchor: viewRef.current.state.doc.length + insertText.length },
        });
      }

      // Focus editor after insert
      viewRef.current.focus();
    },
    [tab.id, onTabUpdate, dbType]
  );

  // Handle clear history
  const handleClearHistory = useCallback(async () => {
    if (!tab.connectionKey || !api) return;

    try {
      await api.clearQueryHistory(tab.connectionKey);
      setPersistedHistory([]);
      toast.success("Query history cleared");
    } catch (error: any) {
      toast.error(`Failed to clear history: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  // Handle save current query - opens modal
  const handleSaveQuery = useCallback(() => {
    if (!tab.sql?.trim()) {
      toast.error("No query to save");
      return;
    }
    setShowSaveModal(true);
  }, [tab.sql]);

  // Handle actual save from modal
  const handleSaveQueryConfirm = useCallback(async (name: string, description: string) => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      return;
    }

    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      name,
      sql: tab.sql.trim(),
      description: description || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await api.addSavedQuery(tab.connectionKey, newQuery);
      setSavedQueries((prev) => [...prev, newQuery]);
      toast.success(`Query "${name}" saved successfully`);
    } catch (error: any) {
      toast.error(`Failed to save query: ${error.message}`);
    }
  }, [tab.sql, tab.connectionKey, api]);

  // Handle select saved query
  const handleSelectSavedQuery = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: sql },
        });
      }
    },
    [tab.id, onTabUpdate]
  );

  // Handle update saved query
  const handleUpdateSavedQuery = useCallback(async (queryId: string, updates: Partial<SavedQuery>) => {
    if (!tab.connectionKey || !api) return;

    try {
      await api.updateSavedQuery(tab.connectionKey, queryId, updates);
      setSavedQueries((prev) =>
        prev.map((q) => (q.id === queryId ? { ...q, ...updates, updatedAt: Date.now() } : q))
      );
      toast.success("Query updated");
    } catch (error: any) {
      toast.error(`Failed to update query: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  // Handle delete saved query
  const handleDeleteSavedQuery = useCallback(async (queryId: string) => {
    if (!tab.connectionKey || !api) return;

    if (!confirm("Are you sure you want to delete this saved query?")) return;

    try {
      await api.deleteSavedQuery(tab.connectionKey, queryId);
      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId));
      toast.success("Query deleted");
    } catch (error: any) {
      toast.error(`Failed to delete query: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${config.color}`}>
            <span>{config.icon}</span>
            <span className="text-xs font-medium">{config.name}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={handleRunQuery}
            disabled={tab.loading || !tab.sql?.trim()}
            className={`h-7 px-3 rounded flex items-center gap-1.5 ${config.bgColor} hover:opacity-90 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Play className="w-3 h-3" />
            Run
            <span className="opacity-70">(Cmd+Enter)</span>
          </button>
          {dbType !== "cassandra" && (
            <button
              onClick={handleFormat}
              disabled={tab.loading || !tab.sql?.trim()}
              className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Wand2 className="w-3 h-3" />
              Format
            </button>
          )}
          <button
            onClick={handleSaveQuery}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newValue = !showSavedQueries;
              setShowSavedQueries(newValue);
              if (newValue) {
                setShowReference(false);
                setShowHistory(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showSavedQueries
                ? `${config.bgColor}/20 ${config.color}`
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <Bookmark className="w-3 h-3" />
            Saved
          </button>
          <button
            onClick={() => {
              const newValue = !showReference;
              setShowReference(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowHistory(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showReference
                ? `${config.bgColor}/20 ${config.color}`
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Reference
          </button>
          <button
            onClick={() => {
              const newValue = !showHistory;
              setShowHistory(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowReference(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showHistory
                ? `${config.bgColor}/20 ${config.color}`
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <History className="w-3 h-3" />
            History
          </button>
        </div>
      </div>

      {/* Main content area with vertical resizing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Editor Panel - Resizable */}
          <Panel defaultSize={30} minSize={15} maxSize={60}>
            <div className="relative h-full">
              <div ref={editorRef} className="h-full" />
              {tab.error && (
                <div className={`absolute inset-0 pointer-events-none border-2 ${config.borderColor}/50 rounded`} />
              )}
              {tab.loading && (
                <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <div className={`h-4 w-4 animate-spin rounded-full border-2 ${config.borderColor} border-t-transparent`} />
                    <span>Executing query...</span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Vertical Resize Handle */}
          <PanelResizeHandle className={`h-1 bg-border hover:${config.bgColor} transition-colors cursor-row-resize`} />

          {/* Results Panel */}
          <Panel defaultSize={70} minSize={30}>
            <div className="h-full flex overflow-hidden">
              <PanelGroup direction="horizontal">
                <Panel defaultSize={showHistory || showReference || showSavedQueries ? 60 : 100} minSize={40}>
                  <QueryResultsGrid
                    columns={tab.columns || []}
                    rows={tab.rows || []}
                    loading={tab.loading || false}
                  />
                </Panel>

                {(showHistory || showReference || showSavedQueries) && (
                  <>
                    <PanelResizeHandle className={`w-1 bg-border hover:${config.bgColor} transition-colors cursor-col-resize`} />
                    <Panel defaultSize={40} minSize={25} maxSize={60}>
                      {showSavedQueries ? (
                        <SavedQueriesPanel
                          queries={savedQueries}
                          onSelectQuery={handleSelectSavedQuery}
                          onDeleteQuery={handleDeleteSavedQuery}
                          onUpdateQuery={handleUpdateSavedQuery}
                        />
                      ) : showReference ? (
                        <ReferencePanel dbType={dbType} onSelectExample={handleInsertExample} />
                      ) : (
                        <HistoryPanel
                          history={persistedHistory}
                          onSelectQuery={handleSelectFromHistory}
                          onClearHistory={handleClearHistory}
                        />
                      )}
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Save Query Modal */}
      <SaveQueryModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveQueryConfirm}
      />
    </div>
  );
}

// Get default query based on database type
function getDefaultQuery(dbType: "mongodb" | "elasticsearch" | "cassandra"): string {
  switch (dbType) {
    case "mongodb":
      return `{
  "collection": "your_collection",
  "find": {},
  "limit": 10
}`;
    case "elasticsearch":
      return `{
  "index": "your_index",
  "query": {
    "match_all": {}
  },
  "size": 10
}`;
    case "cassandra":
      return `-- Replace my_keyspace.my_table with your keyspace and table
SELECT * FROM my_keyspace.my_table LIMIT 10;`;
    default:
      return "";
  }
}

// Reference Panel
function ReferencePanel({
  dbType,
  onSelectExample,
}: {
  dbType: "mongodb" | "elasticsearch" | "cassandra";
  onSelectExample: (example: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("examples");

  if (dbType === "mongodb") {
    const categories = [
      { id: "examples", label: "Examples", icon: "⚡" },
      { id: "stages", label: "Stages", icon: "🔄" },
      { id: "comparison", label: "Compare", icon: "⚖️" },
      { id: "logical", label: "Logic", icon: "🔀" },
      { id: "element", label: "Element", icon: "📦" },
      { id: "evaluation", label: "Eval", icon: "🔍" },
      { id: "array", label: "Array", icon: "📋" },
      { id: "accumulators", label: "Accum", icon: "📊" },
      { id: "dateOps", label: "Date", icon: "📅" },
      { id: "stringOps", label: "String", icon: "📝" },
      { id: "mathOps", label: "Math", icon: "🔢" },
      { id: "conditional", label: "Cond", icon: "❓" },
      { id: "update", label: "Update", icon: "✏️" },
    ];

    const commands = MONGO_COMMANDS[selectedCategory as keyof typeof MONGO_COMMANDS] || [];

    return (
      <div className="h-full flex flex-col bg-bg-secondary">
        <div className="p-2 border-b border-border">
          <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
            <BookOpen className="w-3 h-3" />
            MongoDB Reference
          </h3>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 p-2 border-b border-border">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === cat.id
                  ? "bg-green-500/20 text-green-500"
                  : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-y-auto">
          {commands.map(({ name, desc, example }) => (
            <button
              key={name}
              onClick={() => onSelectExample(example)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono text-green-400 font-medium">{name}</code>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
              <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded truncate overflow-hidden">
                {example.split('\n')[0]}...
              </code>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (dbType === "elasticsearch") {
    const esCategories = [
      { id: "examples", label: "Examples", icon: "⚡" },
      { id: "fullText", label: "Full-Text", icon: "📝" },
      { id: "termLevel", label: "Term", icon: "🎯" },
      { id: "compound", label: "Compound", icon: "🔀" },
      { id: "nested", label: "Nested", icon: "📂" },
      { id: "metricAggs", label: "Metrics", icon: "📊" },
      { id: "bucketAggs", label: "Buckets", icon: "🪣" },
      { id: "sorting", label: "Sort", icon: "↕️" },
      { id: "highlight", label: "Highlight", icon: "✨" },
      { id: "suggest", label: "Suggest", icon: "💡" },
      { id: "geo", label: "Geo", icon: "🌍" },
      { id: "source", label: "Source", icon: "📄" },
    ];

    const esCommands = ES_COMMANDS[selectedCategory as keyof typeof ES_COMMANDS] || [];

    return (
      <div className="h-full flex flex-col bg-bg-secondary">
        <div className="p-2 border-b border-border">
          <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
            <BookOpen className="w-3 h-3" />
            Elasticsearch Reference
          </h3>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 p-2 border-b border-border">
          {esCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === cat.id
                  ? "bg-yellow-500/20 text-yellow-500"
                  : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-y-auto">
          {esCommands.map(({ name, desc, example }) => (
            <button
              key={name}
              onClick={() => onSelectExample(example)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono text-yellow-400 font-medium">{name}</code>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
              <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded truncate overflow-hidden">
                {example.split('\n')[0]}...
              </code>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Cassandra CQL
  const cqlCategories = [
    { id: "examples", label: "Examples", icon: "⚡" },
    { id: "select", label: "SELECT", icon: "🔍" },
    { id: "insert", label: "INSERT", icon: "➕" },
    { id: "update", label: "UPDATE", icon: "✏️" },
    { id: "delete", label: "DELETE", icon: "🗑️" },
    { id: "ddl", label: "DDL", icon: "🏗️" },
    { id: "collections", label: "Collections", icon: "📦" },
    { id: "functions", label: "Functions", icon: "⚙️" },
    { id: "aggregates", label: "Aggregates", icon: "📊" },
    { id: "batch", label: "Batch", icon: "📋" },
    { id: "admin", label: "Admin", icon: "🔧" },
  ];

  const cqlCommands = CASSANDRA_COMMANDS[selectedCategory as keyof typeof CASSANDRA_COMMANDS] || [];

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <BookOpen className="w-3 h-3" />
          CQL Reference
        </h3>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {cqlCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedCategory === cat.id
                ? "bg-blue-500/20 text-blue-400"
                : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Commands list */}
      <div className="flex-1 overflow-y-auto">
        {cqlCommands.map(({ name, desc, example }) => (
          <button
            key={name}
            onClick={() => onSelectExample(example)}
            className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
          >
            <div className="flex items-start gap-2">
              <code className="text-xs font-mono text-blue-400 font-medium">{name}</code>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
            <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded overflow-hidden whitespace-pre-wrap max-h-16">
              {example.split('\n').slice(0, 2).join('\n')}{example.split('\n').length > 2 ? '...' : ''}
            </code>
          </button>
        ))}
      </div>
    </div>
  );
}

// History Panel
function HistoryPanel({
  history,
  onSelectQuery,
  onClearHistory,
}: {
  history: QueryHistoryEntry[];
  onSelectQuery: (sql: string) => void;
  onClearHistory: () => void;
}) {
  const sortedHistory = [...history].reverse();

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <History className="w-3 h-3" />
          Query History
        </h3>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-red-500 transition-colors"
            title="Clear history"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedHistory.length === 0 ? (
          <div className="p-4 text-center text-text-tertiary text-xs">
            No query history yet
          </div>
        ) : (
          sortedHistory.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectQuery(entry.sql)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <code className="text-xs font-mono text-text-primary line-clamp-3">
                {entry.sql}
              </code>
              <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                <span className={entry.success ? "text-green-500" : "text-red-500"}>
                  {entry.success ? "✓" : "✗"}
                </span>
                {entry.rowCount !== undefined && <span>{entry.rowCount} docs</span>}
                <span>{entry.duration}ms</span>
                <span>•</span>
                <span>{new Date(entry.executedAt).toLocaleTimeString()}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default DocumentQueryView;
