/**
 * Filters Module
 *
 * Provides filter building utilities for all supported databases.
 * Centralizes filter logic to eliminate duplication between adapters and UIs.
 */

// Types
export type {
  SqlFilterResult,
  SqlFilterResultNamed,
  MongoFilterResult,
  ElasticsearchFilterResult,
  CassandraFilterResult,
  PlaceholderStyle,
  SqlFilterOptions,
  FilterValidationResult,
  OperatorMetadata,
  FilterCondition,
  FilterOperator,
  DatabaseType,
} from './types.js';

// SQL Filter Builder
export {
  buildSqlFilter,
  buildSqlFilterNamed,
  buildWhereClause,
} from './buildSqlFilter.js';

// MongoDB Filter Builder
export {
  buildMongoFilter,
  buildMongoMatchStage,
} from './buildMongoFilter.js';

// Elasticsearch Filter Builder
export {
  buildElasticsearchFilter,
  buildElasticsearchSearchBody,
} from './buildElasticsearchFilter.js';

// Cassandra Filter Builder
export {
  buildCassandraFilter,
  needsAllowFiltering,
} from './buildCassandraFilter.js';

// Operators
export {
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
} from './operators.js';

// Validation
export {
  validateFilter,
  validateFilters,
  areFiltersValid,
  getFilterErrors,
  normalizeFilter,
  createFilter,
  isFilterEmpty,
  removeEmptyFilters,
} from './validateFilter.js';
