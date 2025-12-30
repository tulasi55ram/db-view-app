/**
 * SQL Utility Type Definitions
 * @dbview/core - Phase 4: SQL Utilities
 */

/**
 * Database type for SQL dialect selection
 */
export type SqlDialect =
  | 'postgres'
  | 'mysql'
  | 'mariadb'
  | 'sqlite'
  | 'sqlserver'
  | 'bigquery'
  | 'redshift'
  | 'spark'
  | 'trino';

/**
 * SQL formatting options
 */
export interface FormatSqlOptions {
  /** Target database dialect */
  dialect?: SqlDialect;
  /** Indentation width in spaces (default: 2) */
  tabWidth?: number;
  /** Keyword case: 'upper', 'lower', 'preserve' (default: 'upper') */
  keywordCase?: 'upper' | 'lower' | 'preserve';
  /** Data type case (default: 'preserve') */
  dataTypeCase?: 'upper' | 'lower' | 'preserve';
  /** Function name case (default: 'preserve') */
  functionCase?: 'upper' | 'lower' | 'preserve';
  /** Identifier case (default: 'preserve') */
  identifierCase?: 'upper' | 'lower' | 'preserve';
  /** Use single line for simple queries (default: false) */
  useTabs?: boolean;
  /** Comma position: 'before' or 'after' (default: 'after') */
  commaPosition?: 'before' | 'after';
  /** Logical operator position (default: 'before') */
  logicalOperatorNewline?: 'before' | 'after';
  /** Max line length before wrapping (default: 80) */
  lineWidth?: number;
}

/**
 * SQL validation result
 */
export interface SqlValidationResult {
  /** Whether the SQL is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Error position in the SQL string */
  position?: {
    line: number;
    column: number;
    offset: number;
  };
  /** Warnings (valid but potentially problematic) */
  warnings?: string[];
}

/**
 * Parsed SQL statement information
 */
export interface ParsedSql {
  /** Statement type: SELECT, INSERT, UPDATE, DELETE, etc. */
  type: SqlStatementType;
  /** Tables referenced in the query */
  tables: string[];
  /** Columns referenced (if detectable) */
  columns: string[];
  /** Whether the query has a WHERE clause */
  hasWhere: boolean;
  /** Whether the query has a LIMIT clause */
  hasLimit: boolean;
  /** Whether the query has an ORDER BY clause */
  hasOrderBy: boolean;
  /** Whether the query modifies data */
  isModifying: boolean;
  /** Raw SQL string */
  sql: string;
}

/**
 * SQL statement types
 */
export type SqlStatementType =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE'
  | 'ALTER'
  | 'DROP'
  | 'TRUNCATE'
  | 'GRANT'
  | 'REVOKE'
  | 'BEGIN'
  | 'COMMIT'
  | 'ROLLBACK'
  | 'WITH'
  | 'EXPLAIN'
  | 'UNKNOWN';

/**
 * SQL keyword categories for highlighting
 */
export interface SqlKeywords {
  statements: string[];
  clauses: string[];
  operators: string[];
  functions: string[];
  dataTypes: string[];
  literals: string[];
}
