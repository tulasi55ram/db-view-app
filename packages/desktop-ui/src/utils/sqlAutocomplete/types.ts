/**
 * Types for sophisticated SQL autocomplete system
 */

import type { ColumnMetadata, TableInfo } from "@dbview/types";

// SQL clause types
export type SqlClause =
  | "SELECT"
  | "FROM"
  | "WHERE"
  | "JOIN"
  | "ON"
  | "ORDER_BY"
  | "GROUP_BY"
  | "HAVING"
  | "INSERT"
  | "INTO"
  | "VALUES"
  | "UPDATE"
  | "SET"
  | "DELETE"
  | "CREATE"
  | "ALTER"
  | "DROP"
  | "WITH"
  | "LIMIT"
  | "OFFSET"
  | "UNION"
  | "UNKNOWN";

// What type of completion is expected at cursor position
export type ExpectedType =
  | "column" // Column names
  | "table" // Table names
  | "schema" // Schema names
  | "alias" // Table alias definition
  | "column_or_expression" // Column, function, or expression
  | "table_or_schema" // Table or schema.table
  | "join_condition" // ON clause conditions
  | "operator" // Comparison operators
  | "value" // Literal values
  | "keyword" // SQL keywords
  | "function" // SQL functions
  | "data_type" // Data types for CREATE/ALTER
  | "any"; // Any completion

// Table reference in the query (FROM, JOIN)
export interface TableReference {
  schema?: string;
  table: string;
  alias?: string;
  // Position in the query for scope resolution
  startPos: number;
  endPos: number;
}

// CTE (Common Table Expression) definition
export interface CTEDefinition {
  name: string;
  alias?: string;
  // Columns selected in the CTE (if we can determine them)
  columns?: string[];
  startPos: number;
  endPos: number;
}

// Subquery scope
export interface SubqueryScope {
  tables: TableReference[];
  ctes: CTEDefinition[];
  startPos: number;
  endPos: number;
  parentScope?: SubqueryScope;
}

// Context at cursor position
export interface SqlContext {
  // Current clause type
  clause: SqlClause;
  // What type of completion is expected
  expectedType: ExpectedType;
  // Tables in scope (from FROM, JOIN)
  tablesInScope: TableReference[];
  // CTEs defined in WITH clause
  ctesInScope: CTEDefinition[];
  // If cursor is after "alias." - which alias
  currentQualifier?: string;
  // If inside a specific subquery
  subqueryScope?: SubqueryScope;
  // The word being typed (for filtering)
  currentWord: string;
  // Position info
  cursorPos: number;
  // Is cursor inside a string literal
  inString: boolean;
  // Is cursor inside a comment
  inComment: boolean;
  // Previous token (for operator suggestions)
  previousToken?: string;
  // Previous keyword (for context)
  previousKeyword?: string;
}

// Enhanced autocomplete data with FK relationships
export interface EnhancedAutocompleteData {
  schemas: string[];
  tables: TableInfo[];
  columns: Record<string, ColumnMetadata[]>; // Key: "schema.table"
  // FK relationships for JOIN suggestions
  foreignKeys: ForeignKeyRelation[];
  // Database type for dialect-specific completions
  dbType: SqlDatabaseType;
}

// Foreign key relationship
export interface ForeignKeyRelation {
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  constraintName?: string;
}

// SQL database types (SQL only, not NoSQL)
export type SqlDatabaseType = "postgres" | "mysql" | "mariadb" | "sqlserver" | "sqlite";

// Completion item with rich metadata
export interface SqlCompletion {
  label: string;
  type: CompletionType;
  detail?: string;
  info?: string;
  boost?: number;
  apply?: string; // Text to insert (if different from label)
  // For snippet completions
  snippet?: string;
}

export type CompletionType =
  | "keyword"
  | "function"
  | "schema"
  | "table"
  | "view"
  | "column"
  | "alias"
  | "operator"
  | "snippet"
  | "value"
  | "type";

// SQL function definition
export interface SqlFunction {
  name: string;
  signature: string; // e.g., "COUNT(expression)"
  description: string;
  returnType: string;
  category: FunctionCategory;
  // Which databases support this function
  supportedDatabases: SqlDatabaseType[];
}

export type FunctionCategory =
  | "aggregate"
  | "string"
  | "numeric"
  | "date"
  | "conversion"
  | "conditional"
  | "window"
  | "json"
  | "array"
  | "system"
  | "crypto"
  | "geo";

// SQL keyword with context info
export interface SqlKeyword {
  keyword: string;
  // When to suggest this keyword (accepts both clause types and keyword strings)
  validAfter: string[];
  // What clause this keyword starts
  startsClause?: SqlClause;
  description?: string;
}

// Operator definition
export interface SqlOperator {
  operator: string;
  description: string;
  // Valid for which column types
  validForTypes: ColumnTypeCategory[];
}

export type ColumnTypeCategory =
  | "numeric"
  | "string"
  | "date"
  | "boolean"
  | "json"
  | "array"
  | "binary"
  | "uuid"
  | "any";
