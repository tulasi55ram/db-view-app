/**
 * CQL Keywords, Operators, and Data Types
 *
 * Cassandra Query Language specific definitions
 */

import type { CqlKeyword, CqlOperator, CqlClause } from "./types";

/**
 * CQL Keywords with context information
 */
export const CQL_KEYWORDS: CqlKeyword[] = [
  // ==================== SELECT ====================
  { keyword: "SELECT", validAfter: ["UNKNOWN", "BATCH"], startsClause: "SELECT", description: "Select columns" },
  { keyword: "DISTINCT", validAfter: ["SELECT"], description: "Distinct partition keys" },
  { keyword: "JSON", validAfter: ["SELECT"], description: "Return results as JSON" },
  { keyword: "FROM", validAfter: ["SELECT"], startsClause: "FROM", description: "Source table" },
  { keyword: "AS", validAfter: ["SELECT", "FROM"], description: "Column/table alias" },

  // ==================== WHERE ====================
  { keyword: "WHERE", validAfter: ["FROM", "UPDATE", "DELETE"], startsClause: "WHERE", description: "Filter conditions" },
  { keyword: "AND", validAfter: ["WHERE", "IF"], description: "Logical AND" },
  { keyword: "OR", validAfter: ["WHERE"], description: "Logical OR (limited support)" },
  { keyword: "IN", validAfter: ["WHERE"], description: "Match values in list" },
  { keyword: "CONTAINS", validAfter: ["WHERE"], description: "Collection contains value" },
  { keyword: "CONTAINS KEY", validAfter: ["WHERE"], description: "Map contains key" },
  { keyword: "TOKEN", validAfter: ["WHERE", "SELECT"], description: "Token-based filtering" },

  // ==================== ORDER BY / LIMIT ====================
  { keyword: "ORDER BY", validAfter: ["WHERE", "FROM"], startsClause: "ORDER_BY", description: "Sort by clustering columns" },
  { keyword: "ASC", validAfter: ["ORDER_BY"], description: "Ascending order" },
  { keyword: "DESC", validAfter: ["ORDER_BY"], description: "Descending order" },
  { keyword: "LIMIT", validAfter: ["WHERE", "FROM", "ORDER_BY"], startsClause: "LIMIT", description: "Limit rows" },
  { keyword: "PER PARTITION LIMIT", validAfter: ["WHERE", "FROM", "ORDER_BY"], description: "Limit per partition" },

  // ==================== GROUP BY (Cassandra 4.0+) ====================
  { keyword: "GROUP BY", validAfter: ["WHERE", "FROM"], startsClause: "GROUP_BY", description: "Group results" },

  // ==================== ALLOW FILTERING ====================
  { keyword: "ALLOW FILTERING", validAfter: ["WHERE", "LIMIT", "ORDER_BY"], description: "Allow inefficient queries" },

  // ==================== INSERT ====================
  { keyword: "INSERT", validAfter: ["UNKNOWN", "BATCH"], startsClause: "INSERT", description: "Insert row" },
  { keyword: "INTO", validAfter: ["INSERT"], startsClause: "INTO", description: "Target table" },
  { keyword: "VALUES", validAfter: ["INTO"], startsClause: "VALUES", description: "Values to insert" },
  { keyword: "IF NOT EXISTS", validAfter: ["VALUES", "USING"], description: "Lightweight transaction" },
  { keyword: "DEFAULT", validAfter: ["VALUES"], description: "Use default value" },

  // ==================== UPDATE ====================
  { keyword: "UPDATE", validAfter: ["UNKNOWN", "BATCH"], startsClause: "UPDATE", description: "Update rows" },
  { keyword: "SET", validAfter: ["UPDATE", "USING"], startsClause: "SET", description: "Set column values" },
  { keyword: "IF", validAfter: ["WHERE", "SET"], startsClause: "IF", description: "Conditional update (LWT)" },
  { keyword: "IF EXISTS", validAfter: ["WHERE", "SET"], description: "Update if row exists" },

  // ==================== DELETE ====================
  { keyword: "DELETE", validAfter: ["UNKNOWN", "BATCH"], startsClause: "DELETE", description: "Delete rows" },

  // ==================== USING (TTL/TIMESTAMP) ====================
  { keyword: "USING", validAfter: ["INSERT", "UPDATE", "DELETE", "VALUES"], startsClause: "USING", description: "TTL or TIMESTAMP" },
  { keyword: "TTL", validAfter: ["USING"], description: "Time To Live in seconds" },
  { keyword: "TIMESTAMP", validAfter: ["USING", "TTL"], description: "Write timestamp (microseconds)" },
  { keyword: "AND", validAfter: ["USING"], description: "Combine USING options" },

  // ==================== BATCH ====================
  { keyword: "BEGIN", validAfter: ["UNKNOWN"], description: "Start batch" },
  { keyword: "BEGIN BATCH", validAfter: ["UNKNOWN"], startsClause: "BATCH", description: "Start batch statement" },
  { keyword: "BEGIN UNLOGGED BATCH", validAfter: ["UNKNOWN"], startsClause: "BATCH", description: "Unlogged batch" },
  { keyword: "BEGIN COUNTER BATCH", validAfter: ["UNKNOWN"], startsClause: "BATCH", description: "Counter batch" },
  { keyword: "APPLY BATCH", validAfter: ["BATCH", "INSERT", "UPDATE", "DELETE"], description: "Execute batch" },

  // ==================== DDL - Keyspace ====================
  { keyword: "CREATE", validAfter: ["UNKNOWN"], startsClause: "CREATE", description: "Create object" },
  { keyword: "CREATE KEYSPACE", validAfter: ["UNKNOWN"], description: "Create keyspace" },
  { keyword: "CREATE KEYSPACE IF NOT EXISTS", validAfter: ["UNKNOWN"], description: "Create keyspace if not exists" },
  { keyword: "ALTER KEYSPACE", validAfter: ["UNKNOWN"], description: "Alter keyspace" },
  { keyword: "DROP KEYSPACE", validAfter: ["UNKNOWN"], description: "Drop keyspace" },
  { keyword: "DROP KEYSPACE IF EXISTS", validAfter: ["UNKNOWN"], description: "Drop keyspace if exists" },
  { keyword: "WITH REPLICATION", validAfter: ["CREATE", "ALTER"], description: "Replication settings" },
  { keyword: "AND DURABLE_WRITES", validAfter: ["CREATE", "ALTER"], description: "Durable writes setting" },

  // ==================== DDL - Table ====================
  { keyword: "CREATE TABLE", validAfter: ["UNKNOWN"], description: "Create table" },
  { keyword: "CREATE TABLE IF NOT EXISTS", validAfter: ["UNKNOWN"], description: "Create table if not exists" },
  { keyword: "ALTER TABLE", validAfter: ["UNKNOWN"], description: "Alter table" },
  { keyword: "DROP TABLE", validAfter: ["UNKNOWN"], description: "Drop table" },
  { keyword: "DROP TABLE IF EXISTS", validAfter: ["UNKNOWN"], description: "Drop table if exists" },
  { keyword: "TRUNCATE", validAfter: ["UNKNOWN"], startsClause: "TRUNCATE", description: "Remove all rows" },
  { keyword: "TRUNCATE TABLE", validAfter: ["UNKNOWN"], description: "Truncate table" },

  // Table options
  { keyword: "PRIMARY KEY", validAfter: ["CREATE"], description: "Primary key definition" },
  { keyword: "PARTITION KEY", validAfter: ["CREATE"], description: "Partition key" },
  { keyword: "CLUSTERING ORDER BY", validAfter: ["CREATE"], description: "Clustering order" },
  { keyword: "WITH", validAfter: ["CREATE", "ALTER"], description: "Table options" },
  { keyword: "COMPACT STORAGE", validAfter: ["WITH"], description: "Compact storage (deprecated)" },
  { keyword: "CLUSTERING ORDER", validAfter: ["WITH"], description: "Clustering column order" },

  // Table storage options
  { keyword: "bloom_filter_fp_chance", validAfter: ["WITH", "AND"], description: "Bloom filter false positive chance" },
  { keyword: "caching", validAfter: ["WITH", "AND"], description: "Caching options" },
  { keyword: "comment", validAfter: ["WITH", "AND"], description: "Table comment" },
  { keyword: "compaction", validAfter: ["WITH", "AND"], description: "Compaction strategy" },
  { keyword: "compression", validAfter: ["WITH", "AND"], description: "Compression options" },
  { keyword: "default_time_to_live", validAfter: ["WITH", "AND"], description: "Default TTL" },
  { keyword: "gc_grace_seconds", validAfter: ["WITH", "AND"], description: "Tombstone grace period" },
  { keyword: "memtable_flush_period_in_ms", validAfter: ["WITH", "AND"], description: "Memtable flush period" },
  { keyword: "speculative_retry", validAfter: ["WITH", "AND"], description: "Speculative retry policy" },

  // ==================== DDL - Index ====================
  { keyword: "CREATE INDEX", validAfter: ["UNKNOWN"], description: "Create secondary index" },
  { keyword: "CREATE INDEX IF NOT EXISTS", validAfter: ["UNKNOWN"], description: "Create index if not exists" },
  { keyword: "CREATE CUSTOM INDEX", validAfter: ["UNKNOWN"], description: "Create custom index (SASI, etc.)" },
  { keyword: "DROP INDEX", validAfter: ["UNKNOWN"], description: "Drop index" },
  { keyword: "DROP INDEX IF EXISTS", validAfter: ["UNKNOWN"], description: "Drop index if exists" },
  { keyword: "ON", validAfter: ["CREATE"], description: "Index target" },
  { keyword: "USING", validAfter: ["CREATE"], description: "Index class" },

  // ==================== DDL - Materialized View ====================
  { keyword: "CREATE MATERIALIZED VIEW", validAfter: ["UNKNOWN"], description: "Create materialized view" },
  { keyword: "ALTER MATERIALIZED VIEW", validAfter: ["UNKNOWN"], description: "Alter materialized view" },
  { keyword: "DROP MATERIALIZED VIEW", validAfter: ["UNKNOWN"], description: "Drop materialized view" },

  // ==================== DDL - User Defined Types ====================
  { keyword: "CREATE TYPE", validAfter: ["UNKNOWN"], description: "Create user-defined type" },
  { keyword: "CREATE TYPE IF NOT EXISTS", validAfter: ["UNKNOWN"], description: "Create UDT if not exists" },
  { keyword: "ALTER TYPE", validAfter: ["UNKNOWN"], description: "Alter user-defined type" },
  { keyword: "DROP TYPE", validAfter: ["UNKNOWN"], description: "Drop user-defined type" },
  { keyword: "DROP TYPE IF EXISTS", validAfter: ["UNKNOWN"], description: "Drop UDT if exists" },

  // ==================== DDL - Functions ====================
  { keyword: "CREATE FUNCTION", validAfter: ["UNKNOWN"], description: "Create UDF" },
  { keyword: "CREATE OR REPLACE FUNCTION", validAfter: ["UNKNOWN"], description: "Create or replace UDF" },
  { keyword: "DROP FUNCTION", validAfter: ["UNKNOWN"], description: "Drop function" },
  { keyword: "CREATE AGGREGATE", validAfter: ["UNKNOWN"], description: "Create UDA" },
  { keyword: "DROP AGGREGATE", validAfter: ["UNKNOWN"], description: "Drop aggregate" },
  { keyword: "RETURNS", validAfter: ["CREATE"], description: "Return type" },
  { keyword: "LANGUAGE", validAfter: ["CREATE"], description: "Function language" },
  { keyword: "CALLED ON NULL INPUT", validAfter: ["CREATE"], description: "Call on null" },
  { keyword: "RETURNS NULL ON NULL INPUT", validAfter: ["CREATE"], description: "Return null on null" },

  // ==================== USE ====================
  { keyword: "USE", validAfter: ["UNKNOWN"], startsClause: "USE", description: "Switch keyspace" },

  // ==================== Other ====================
  { keyword: "NULL", validAfter: ["WHERE", "SET", "VALUES", "IF"], description: "NULL value" },
  { keyword: "TRUE", validAfter: ["WHERE", "SET", "VALUES", "IF"], description: "Boolean true" },
  { keyword: "FALSE", validAfter: ["WHERE", "SET", "VALUES", "IF"], description: "Boolean false" },

  // Column operations
  { keyword: "ADD", validAfter: ["ALTER"], description: "Add column" },
  { keyword: "DROP", validAfter: ["ALTER"], startsClause: "DROP", description: "Drop column" },
  { keyword: "RENAME", validAfter: ["ALTER"], description: "Rename column" },
  { keyword: "TO", validAfter: ["RENAME"], description: "Rename target" },

  // WRITETIME and TTL functions (in SELECT)
  { keyword: "WRITETIME", validAfter: ["SELECT"], description: "Get write timestamp" },
];

/**
 * CQL Operators
 */
export const CQL_OPERATORS: CqlOperator[] = [
  // Comparison operators
  { operator: "=", description: "Equal to", validIn: ["where", "if", "set"] },
  { operator: "!=", description: "Not equal to", validIn: ["if"] },
  { operator: "<", description: "Less than", validIn: ["where", "if"] },
  { operator: ">", description: "Greater than", validIn: ["where", "if"] },
  { operator: "<=", description: "Less than or equal", validIn: ["where", "if"] },
  { operator: ">=", description: "Greater than or equal", validIn: ["where", "if"] },

  // Collection operators
  { operator: "IN", description: "Match value in list", validIn: ["where"] },
  { operator: "CONTAINS", description: "Collection contains value", validIn: ["where"] },
  { operator: "CONTAINS KEY", description: "Map contains key", validIn: ["where"] },

  // Update operators for collections
  { operator: "+", description: "Add to collection", validIn: ["set"] },
  { operator: "-", description: "Remove from collection", validIn: ["set"] },
  { operator: "[", description: "Collection element access", validIn: ["set", "where"] },
];

/**
 * CQL Data Types
 */
export const CQL_DATA_TYPES: string[] = [
  // Native types
  "ASCII",
  "BIGINT",
  "BLOB",
  "BOOLEAN",
  "COUNTER",
  "DATE",
  "DECIMAL",
  "DOUBLE",
  "DURATION",
  "FLOAT",
  "INET",
  "INT",
  "SMALLINT",
  "TEXT",
  "TIME",
  "TIMESTAMP",
  "TIMEUUID",
  "TINYINT",
  "UUID",
  "VARCHAR",
  "VARINT",

  // Collection types
  "LIST",
  "SET",
  "MAP",
  "TUPLE",

  // Frozen (for nested collections/UDTs)
  "FROZEN",
];

/**
 * Get keywords valid for current context
 */
export function getCqlKeywordsForContext(clause: CqlClause): CqlKeyword[] {
  return CQL_KEYWORDS.filter((k) => k.validAfter.includes(clause));
}

/**
 * Get operators valid for context
 */
export function getCqlOperatorsForContext(
  context: "where" | "if" | "set"
): CqlOperator[] {
  return CQL_OPERATORS.filter((op) => op.validIn.includes(context));
}
