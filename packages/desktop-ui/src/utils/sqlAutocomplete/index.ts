/**
 * Sophisticated SQL Autocomplete System
 *
 * Features:
 * - Context-aware completions based on cursor position
 * - Table/CTE alias tracking and resolution
 * - FK-aware JOIN condition suggestions
 * - Database-specific functions (PostgreSQL, MySQL, MariaDB, SQL Server, SQLite)
 * - Type-aware operator suggestions
 * - Smart ranking and boosting
 */

export { createSmartSqlCompletion } from "./completionProvider";
export { getSqlContext, resolveQualifier } from "./contextParser";
export { getFunctionsForDatabase, getFunctionsByCategory, searchFunctions, SQL_FUNCTIONS } from "./functions";
export {
  SQL_KEYWORDS,
  SQL_OPERATORS,
  SQL_DATA_TYPES,
  getKeywordsForContext,
  getOperatorsForType,
  getColumnTypeCategory,
  getDataTypes,
} from "./keywords";

// Types
export type {
  SqlContext,
  SqlClause,
  ExpectedType,
  TableReference,
  CTEDefinition,
  EnhancedAutocompleteData,
  ForeignKeyRelation,
  SqlDatabaseType,
  SqlFunction,
  SqlKeyword,
  SqlOperator,
  SqlCompletion,
  FunctionCategory,
  ColumnTypeCategory,
  CompletionType,
} from "./types";
