/**
 * SQL Utilities Module
 * @dbview/core - Phase 4: SQL Utilities
 */

// Types
export type {
  SqlDialect,
  FormatSqlOptions,
  SqlValidationResult,
  ParsedSql,
  SqlStatementType,
  SqlKeywords,
} from './types.js';

// Formatting
export {
  formatSql,
  minifySql,
  hasMultipleStatements,
  splitStatements,
} from './formatSql.js';

// Validation
export {
  validateSql,
  isReadOnlyQuery,
  detectDangerousOperations,
} from './validateSql.js';

// Parsing
export {
  parseSql,
  getSqlKeywords,
  isSqlKeyword,
  SQL_KEYWORDS,
} from './parseSql.js';
