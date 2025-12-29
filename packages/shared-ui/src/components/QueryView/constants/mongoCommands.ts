/**
 * MongoDB Commands and Operators
 * Comprehensive MongoDB commands organized by category for query builder and autocomplete
 */

export interface MongoCommand {
  name: string;
  desc: string;
  example: string;
}

export interface MongoOperator {
  op: string;
  desc: string;
}

export interface MongoStage {
  stage: string;
  desc: string;
}

export const MONGO_COMMANDS: Record<string, MongoCommand[]> = {
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

export const MONGO_OPERATORS: MongoOperator[] = [
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

export const MONGO_STAGES: MongoStage[] = MONGO_COMMANDS.stages.map(s => ({
  stage: s.name,
  desc: s.desc,
}));
