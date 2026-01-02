/**
 * Types for Cassandra CQL autocomplete system
 *
 * CQL (Cassandra Query Language) is SQL-like but has unique features:
 * - Partition keys and clustering columns
 * - Collection types (MAP, SET, LIST)
 * - TTL (Time To Live) for data expiration
 * - ALLOW FILTERING for non-indexed queries
 * - Materialized views and secondary indexes
 */

import type { ColumnMetadata } from "@dbview/types";

// CQL clause types (subset of SQL with Cassandra-specific additions)
export type CqlClause =
  | "SELECT"
  | "FROM"
  | "WHERE"
  | "ORDER_BY"
  | "GROUP_BY"
  | "LIMIT"
  | "INSERT"
  | "INTO"
  | "VALUES"
  | "UPDATE"
  | "SET"
  | "DELETE"
  | "CREATE"
  | "ALTER"
  | "DROP"
  | "TRUNCATE"
  | "USE"
  | "BATCH"
  | "USING"  // For TTL and TIMESTAMP
  | "IF"     // For lightweight transactions
  | "UNKNOWN";

// What type of completion is expected at cursor position
export type CqlExpectedType =
  | "column"
  | "table"
  | "keyspace"
  | "column_or_expression"
  | "table_or_keyspace"
  | "operator"
  | "value"
  | "keyword"
  | "function"
  | "data_type"
  | "collection_type"
  | "any";

// Table reference in the query
export interface CqlTableReference {
  keyspace?: string;
  table: string;
  alias?: string;
  startPos: number;
  endPos: number;
}

// Context at cursor position
export interface CqlContext {
  clause: CqlClause;
  expectedType: CqlExpectedType;
  tablesInScope: CqlTableReference[];
  currentQualifier?: string;
  currentWord: string;
  cursorPos: number;
  inString: boolean;
  inComment: boolean;
  previousToken?: string;
  previousKeyword?: string;
  // CQL-specific context
  inBatch?: boolean;
  hasAllowFiltering?: boolean;
  usingClause?: boolean; // After USING keyword
}

// Enhanced autocomplete data for Cassandra
export interface CqlAutocompleteData {
  keyspaces: string[];
  tables: CqlTableInfo[];
  columns: Record<string, CqlColumnMetadata[]>; // Key: "keyspace.table"
  // Cassandra-specific metadata
  materializedViews?: string[];
  userDefinedTypes?: CqlUserDefinedType[];
}

// Cassandra table info
export interface CqlTableInfo {
  keyspace: string;
  name: string;
  // Cassandra-specific
  partitionKeys?: string[];
  clusteringColumns?: string[];
  isCompact?: boolean;
}

// Extended column metadata for Cassandra
export interface CqlColumnMetadata extends ColumnMetadata {
  // Cassandra-specific properties (keyKind inherits from base: partition | clustering | regular)
  clusteringOrder?: "ASC" | "DESC";
  isStatic?: boolean;
  isFrozen?: boolean;
  collectionType?: "map" | "set" | "list" | "tuple";
}

// User-defined type in Cassandra
export interface CqlUserDefinedType {
  keyspace: string;
  name: string;
  fields: Array<{ name: string; type: string }>;
}

// CQL function definition
export interface CqlFunction {
  name: string;
  signature: string;
  description: string;
  returnType: string;
  category: CqlFunctionCategory;
}

export type CqlFunctionCategory =
  | "aggregate"
  | "scalar"
  | "datetime"
  | "uuid"
  | "collection"
  | "blob"
  | "type_conversion";

// CQL keyword with context info
export interface CqlKeyword {
  keyword: string;
  validAfter: string[];
  startsClause?: CqlClause;
  description?: string;
}

// CQL operator definition
export interface CqlOperator {
  operator: string;
  description: string;
  // Which contexts this operator is valid in
  validIn: ("where" | "if" | "set")[];
}

// Completion item
export interface CqlCompletion {
  label: string;
  type: CqlCompletionType;
  detail?: string;
  info?: string;
  boost?: number;
  apply?: string;
}

export type CqlCompletionType =
  | "keyword"
  | "function"
  | "keyspace"
  | "table"
  | "view"
  | "column"
  | "type"
  | "operator"
  | "snippet"
  | "value";

// CQL data type definition
export interface CqlDataType {
  type: string;
  description: string;
  category: "primitive" | "collection" | "complex";
}
