/**
 * Cassandra CQL Built-in Functions
 *
 * Comprehensive function definitions for CQL autocomplete
 */

import type { CqlFunction, CqlFunctionCategory } from "./types";

// Helper to create function definitions
function fn(
  name: string,
  signature: string,
  description: string,
  returnType: string,
  category: CqlFunctionCategory
): CqlFunction {
  return { name, signature, description, returnType, category };
}

/**
 * All CQL built-in functions
 */
export const CQL_FUNCTIONS: CqlFunction[] = [
  // ==================== UUID Functions ====================
  fn("uuid", "uuid()", "Generate a random UUID", "uuid", "uuid"),
  fn("now", "now()", "Generate a new unique timeuuid", "timeuuid", "uuid"),
  fn("timeuuid", "timeuuid()", "Alias for now()", "timeuuid", "uuid"),
  fn("minTimeuuid", "minTimeuuid(timestamp)", "Minimum timeuuid for timestamp", "timeuuid", "uuid"),
  fn("maxTimeuuid", "maxTimeuuid(timestamp)", "Maximum timeuuid for timestamp", "timeuuid", "uuid"),

  // ==================== Datetime Functions ====================
  fn("currentDate", "currentDate()", "Current date", "date", "datetime"),
  fn("currentTime", "currentTime()", "Current time", "time", "datetime"),
  fn("currentTimestamp", "currentTimestamp()", "Current timestamp", "timestamp", "datetime"),
  fn("currentTimeUUID", "currentTimeUUID()", "Current time as timeuuid", "timeuuid", "datetime"),
  fn("toDate", "toDate(timeuuid)", "Extract date from timeuuid", "date", "datetime"),
  fn("toTimestamp", "toTimestamp(timeuuid)", "Extract timestamp from timeuuid", "timestamp", "datetime"),
  fn("toUnixTimestamp", "toUnixTimestamp(timeuuid|timestamp|date)", "Convert to Unix timestamp (ms)", "bigint", "datetime"),
  fn("dateOf", "dateOf(timeuuid)", "Extract timestamp from timeuuid (deprecated, use toTimestamp)", "timestamp", "datetime"),
  fn("unixTimestampOf", "unixTimestampOf(timeuuid)", "Extract Unix timestamp from timeuuid (deprecated)", "bigint", "datetime"),

  // ==================== Type Conversion Functions ====================
  fn("typeAsBlob", "typeAsBlob(value)", "Cast type to blob", "blob", "type_conversion"),
  fn("blobAsType", "blobAsType(blob)", "Cast blob to type", "varies", "type_conversion"),
  fn("blobAsInt", "blobAsInt(blob)", "Cast blob to int", "int", "type_conversion"),
  fn("blobAsBigint", "blobAsBigint(blob)", "Cast blob to bigint", "bigint", "type_conversion"),
  fn("blobAsAscii", "blobAsAscii(blob)", "Cast blob to ascii", "ascii", "type_conversion"),
  fn("blobAsText", "blobAsText(blob)", "Cast blob to text", "text", "type_conversion"),
  fn("blobAsVarchar", "blobAsVarchar(blob)", "Cast blob to varchar", "varchar", "type_conversion"),
  fn("blobAsFloat", "blobAsFloat(blob)", "Cast blob to float", "float", "type_conversion"),
  fn("blobAsDouble", "blobAsDouble(blob)", "Cast blob to double", "double", "type_conversion"),
  fn("blobAsBoolean", "blobAsBoolean(blob)", "Cast blob to boolean", "boolean", "type_conversion"),
  fn("blobAsTimestamp", "blobAsTimestamp(blob)", "Cast blob to timestamp", "timestamp", "type_conversion"),
  fn("blobAsUUID", "blobAsUUID(blob)", "Cast blob to uuid", "uuid", "type_conversion"),
  fn("blobAsTimeUUID", "blobAsTimeUUID(blob)", "Cast blob to timeuuid", "timeuuid", "type_conversion"),
  fn("blobAsInet", "blobAsInet(blob)", "Cast blob to inet", "inet", "type_conversion"),
  fn("blobAsVarint", "blobAsVarint(blob)", "Cast blob to varint", "varint", "type_conversion"),
  fn("blobAsDecimal", "blobAsDecimal(blob)", "Cast blob to decimal", "decimal", "type_conversion"),

  fn("intAsBlob", "intAsBlob(int)", "Cast int to blob", "blob", "type_conversion"),
  fn("bigintAsBlob", "bigintAsBlob(bigint)", "Cast bigint to blob", "blob", "type_conversion"),
  fn("asciiAsBlob", "asciiAsBlob(ascii)", "Cast ascii to blob", "blob", "type_conversion"),
  fn("textAsBlob", "textAsBlob(text)", "Cast text to blob", "blob", "type_conversion"),
  fn("varcharAsBlob", "varcharAsBlob(varchar)", "Cast varchar to blob", "blob", "type_conversion"),
  fn("floatAsBlob", "floatAsBlob(float)", "Cast float to blob", "blob", "type_conversion"),
  fn("doubleAsBlob", "doubleAsBlob(double)", "Cast double to blob", "blob", "type_conversion"),
  fn("booleanAsBlob", "booleanAsBlob(boolean)", "Cast boolean to blob", "blob", "type_conversion"),
  fn("timestampAsBlob", "timestampAsBlob(timestamp)", "Cast timestamp to blob", "blob", "type_conversion"),
  fn("uuidAsBlob", "uuidAsBlob(uuid)", "Cast uuid to blob", "blob", "type_conversion"),
  fn("timeuuidAsBlob", "timeuuidAsBlob(timeuuid)", "Cast timeuuid to blob", "blob", "type_conversion"),
  fn("inetAsBlob", "inetAsBlob(inet)", "Cast inet to blob", "blob", "type_conversion"),
  fn("varintAsBlob", "varintAsBlob(varint)", "Cast varint to blob", "blob", "type_conversion"),
  fn("decimalAsBlob", "decimalAsBlob(decimal)", "Cast decimal to blob", "blob", "type_conversion"),

  // ==================== Aggregate Functions ====================
  fn("count", "count(*)", "Count rows", "bigint", "aggregate"),
  fn("count", "count(column)", "Count non-null values", "bigint", "aggregate"),
  fn("sum", "sum(column)", "Sum of values", "varies", "aggregate"),
  fn("avg", "avg(column)", "Average of values", "varies", "aggregate"),
  fn("min", "min(column)", "Minimum value", "varies", "aggregate"),
  fn("max", "max(column)", "Maximum value", "varies", "aggregate"),

  // ==================== Collection Functions ====================
  fn("map", "map(key1, value1, ...)", "Create a map", "map", "collection"),
  fn("set", "set(value1, value2, ...)", "Create a set", "set", "collection"),
  fn("list", "list(value1, value2, ...)", "Create a list", "list", "collection"),
  fn("tuple", "tuple(value1, value2, ...)", "Create a tuple", "tuple", "collection"),

  // ==================== Token Functions ====================
  fn("token", "token(partition_key)", "Token value for partition key", "bigint", "scalar"),

  // ==================== Blob Functions ====================
  fn("blobasint", "blobasint(blob)", "Convert blob to int", "int", "blob"),
  fn("intasblob", "intasblob(int)", "Convert int to blob", "blob", "blob"),

  // ==================== Scalar Functions ====================
  fn("ttl", "ttl(column)", "Get TTL of column (in SELECT)", "int", "scalar"),
  fn("writetime", "writetime(column)", "Get write timestamp (in SELECT)", "bigint", "scalar"),
  fn("cast", "cast(value AS type)", "Cast value to type", "varies", "scalar"),

  // ==================== Math Functions (Cassandra 4.0+) ====================
  fn("abs", "abs(number)", "Absolute value", "varies", "scalar"),
  fn("exp", "exp(number)", "Exponential", "double", "scalar"),
  fn("log", "log(number)", "Natural logarithm", "double", "scalar"),
  fn("log10", "log10(number)", "Base-10 logarithm", "double", "scalar"),
  fn("round", "round(number)", "Round to nearest integer", "varies", "scalar"),
  fn("floor", "floor(number)", "Round down", "varies", "scalar"),
  fn("ceil", "ceil(number)", "Round up", "varies", "scalar"),

  // ==================== String Functions (Cassandra 4.0+) ====================
  fn("length", "length(string)", "String length", "int", "scalar"),
];

// Cache for functions
let functionsCache: CqlFunction[] | null = null;

/**
 * Get all CQL functions (cached)
 */
export function getCqlFunctions(): CqlFunction[] {
  if (!functionsCache) {
    functionsCache = CQL_FUNCTIONS;
  }
  return functionsCache;
}

/**
 * Get functions by category
 */
export function getCqlFunctionsByCategory(category: CqlFunctionCategory): CqlFunction[] {
  return CQL_FUNCTIONS.filter((f) => f.category === category);
}

/**
 * Search functions by name prefix
 */
export function searchCqlFunctions(prefix: string): CqlFunction[] {
  const prefixLower = prefix.toLowerCase();
  return CQL_FUNCTIONS.filter((f) => f.name.toLowerCase().startsWith(prefixLower));
}
