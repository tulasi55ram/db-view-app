/**
 * @dbview/core
 *
 * Core business logic for DB-View - shared between desktop and VS Code.
 *
 * This package provides UI-agnostic utilities for:
 * - Document ID extraction and manipulation
 * - Data transformation (flatten, tree, type inference)
 * - General utilities (formatting, truncation, IDs)
 *
 * @example
 * ```typescript
 * import {
 *   getDocumentId,
 *   flattenDocument,
 *   formatBytes,
 * } from '@dbview/core';
 *
 * // Or import from specific modules
 * import { getDocumentId } from '@dbview/core/documents';
 * import { flattenDocument } from '@dbview/core/transforms';
 * import { formatBytes } from '@dbview/core/utils';
 * ```
 */

// ============================================================================
// Documents Module
// ============================================================================

export {
  // Types
  type DocumentIdInfo,
  type PathOptions,
  type DocumentDbType,
  isDocumentDbType,
  // Document ID utilities
  getDocumentIdField,
  getDocumentIdFields,
  getDocumentId,
  getCompositeDocumentId,
  getPrimaryKeyObject,
  // Path utilities
  parsePath,
  buildPath,
  getAtPath,
  hasPath,
  setAtPath,
  deleteAtPath,
  getParentPath,
  getPathKey,
  joinPath,
} from './documents/index.js';

// ============================================================================
// Transforms Module
// ============================================================================

export {
  // Types
  type PrimitiveType,
  type ValueType,
  type FlattenedField,
  type FlattenOptions,
  type TreeNode,
  type TreeOptions,
  type InferredColumnType,
  // Type inference
  detectValueType,
  getTypeLabel,
  getTypeColor,
  isPrimitive,
  isContainer,
  inferColumnType,
  formatValueForDisplay,
  // Flatten utilities
  flattenDocument,
  unflattenDocument,
  getDocumentKeys,
  countDocumentFields,
  getDocumentDepth,
  // Tree utilities
  nestToTree,
  getExpandedPathsToDepth,
  expandPath,
  collapsePath,
  togglePath,
  expandAll,
  collapseAll,
  searchTree,
  getPathsToShowSearchResults,
} from './transforms/index.js';

// ============================================================================
// Utils Module
// ============================================================================

export {
  // Byte formatting
  formatBytes,
  parseBytes,
  formatBytesPerSecond,
  type FormatBytesOptions,
  // Value truncation
  truncateString,
  truncateValue,
  truncateJson,
  truncateArray,
  truncatePath,
  type TruncateOptions,
  // ID generation
  generateId,
  generateUUID,
  generateSequentialId,
  generateTimestampId,
  generateHash,
  generateSlug,
  resetSequentialCounter,
  // Connection key utilities
  getConnectionKey,
  parseConnectionKey,
  getConnectionDisplayName,
  isSameConnection,
  getDbTypeFromKey,
  type ParsedConnectionKey,
  // Debounce/throttle
  debounce,
  throttle,
  once,
  type DebouncedFunction,
} from './utils/index.js';

// ============================================================================
// Filters Module
// ============================================================================

export {
  // Types
  type SqlFilterResult,
  type SqlFilterResultNamed,
  type MongoFilterResult,
  type ElasticsearchFilterResult,
  type CassandraFilterResult,
  type PlaceholderStyle,
  type SqlFilterOptions,
  type FilterValidationResult,
  type OperatorMetadata,
  // SQL Filter Builder
  buildSqlFilter,
  buildSqlFilterNamed,
  buildWhereClause,
  // MongoDB Filter Builder
  buildMongoFilter,
  buildMongoMatchStage,
  // Elasticsearch Filter Builder
  buildElasticsearchFilter,
  buildElasticsearchSearchBody,
  // Cassandra Filter Builder
  buildCassandraFilter,
  needsAllowFiltering,
  // Operators
  OPERATOR_METADATA,
  STRING_OPERATORS,
  NUMERIC_OPERATORS,
  DATE_OPERATORS,
  BOOLEAN_OPERATORS,
  ALL_OPERATORS,
  OPERATOR_LABELS,
  getOperatorsForType,
  getOperatorMetadata,
  operatorNeedsValue,
  operatorNeedsTwoValues,
  operatorNeedsCommaSeparated,
  isOperatorValidForType,
  // Validation
  validateFilter,
  validateFilters,
  areFiltersValid,
  getFilterErrors,
  normalizeFilter,
  createFilter,
  isFilterEmpty,
  removeEmptyFilters,
} from './filters/index.js';

// ============================================================================
// Export Module
// ============================================================================

export {
  // Types
  type CsvExportOptions,
  type JsonExportOptions,
  type SqlExportOptions,
  type MarkdownExportOptions,
  type CsvImportOptions,
  type JsonImportOptions,
  type ImportResult,
  type ExportFormat,
  type RowData,
  // Export functions
  toCsv,
  toJson,
  toJsonLines,
  toSql,
  toMarkdown,
  // Import functions
  parseCsv,
  parseJson,
  parseJsonLines,
  detectFormat,
} from './export/index.js';

// ============================================================================
// SQL Module
// ============================================================================

export {
  // Types
  type SqlDialect,
  type FormatSqlOptions,
  type SqlValidationResult,
  type ParsedSql,
  type SqlStatementType,
  type SqlKeywords,
  // Formatting
  formatSql,
  minifySql,
  hasMultipleStatements,
  splitStatements,
  // Validation
  validateSql,
  isReadOnlyQuery,
  detectDangerousOperations,
  // Parsing
  parseSql,
  getSqlKeywords,
  isSqlKeyword,
  SQL_KEYWORDS,
} from './sql/index.js';
