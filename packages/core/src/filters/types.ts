/**
 * Filter module types
 *
 * Types and interfaces for building database-specific filters
 * from a common FilterCondition structure.
 */

import type { FilterCondition, FilterOperator, DatabaseType } from '@dbview/types';

/**
 * Result of building a SQL filter
 */
export interface SqlFilterResult {
  /** The WHERE clause (without the WHERE keyword) */
  whereClause: string;
  /** Parameter values for the prepared statement */
  params: unknown[];
}

/**
 * Result of building a SQL filter with named parameters (for SQL Server)
 */
export interface SqlFilterResultNamed {
  /** The WHERE clause (without the WHERE keyword) */
  whereClause: string;
  /** Named parameter values */
  params: Record<string, unknown>;
}

/**
 * Result of building a MongoDB filter
 */
export interface MongoFilterResult {
  /** MongoDB query object */
  query: Record<string, unknown>;
}

/**
 * Result of building an Elasticsearch filter
 */
export interface ElasticsearchFilterResult {
  /** Elasticsearch query DSL */
  query: {
    bool: {
      must?: Record<string, unknown>[];
      should?: Record<string, unknown>[];
      filter?: Record<string, unknown>[];
      must_not?: Record<string, unknown>[];
      minimum_should_match?: number;
    };
  };
}

/**
 * Result of building a Cassandra CQL filter
 */
export interface CassandraFilterResult {
  /** CQL WHERE clause conditions */
  whereClause: string;
  /** Parameter values */
  params: unknown[];
}

/**
 * Placeholder style for SQL databases
 */
export type PlaceholderStyle =
  | 'positional'    // $1, $2, $3 (PostgreSQL)
  | 'question'      // ?, ?, ? (MySQL, MariaDB, SQLite)
  | 'named';        // @p0, @p1 (SQL Server)

/**
 * Options for SQL filter building
 */
export interface SqlFilterOptions {
  /** Database type for syntax variations */
  dbType: DatabaseType;
  /** Quote function for identifiers */
  quoteIdentifier?: (name: string) => string;
  /** Starting parameter index (for positional placeholders) */
  startIndex?: number;
}

/**
 * Filter validation result
 */
export interface FilterValidationResult {
  /** Whether the filter is valid */
  valid: boolean;
  /** Validation error messages */
  errors: string[];
  /** Validated and normalized filter (if valid) */
  normalizedFilter?: FilterCondition;
}

/**
 * Operator metadata
 */
export interface OperatorMetadata {
  /** Display label for UI */
  label: string;
  /** Whether operator requires a value */
  needsValue: boolean;
  /** Whether operator requires two values (BETWEEN) */
  needsTwoValues: boolean;
  /** Whether operator expects comma-separated values (IN) */
  needsCommaSeparated: boolean;
  /** Data types this operator is applicable to */
  applicableTypes: ('string' | 'number' | 'date' | 'boolean' | 'any')[];
}

// Re-export types from @dbview/types for convenience
export type { FilterCondition, FilterOperator, DatabaseType };
