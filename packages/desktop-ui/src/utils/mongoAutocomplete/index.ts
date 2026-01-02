/**
 * MongoDB Query Autocomplete
 *
 * Context-aware autocomplete for MongoDB queries and aggregations.
 * Provides intelligent completions for:
 * - Query operators ($eq, $gt, $in, $and, $or, etc.)
 * - Update operators ($set, $inc, $push, etc.)
 * - Aggregation pipeline stages ($match, $group, $project, etc.)
 * - Accumulators ($sum, $avg, $first, $last, etc.)
 * - Expressions ($concat, $add, $cond, etc.)
 * - Field paths and references
 * - Snippets for common patterns
 */

// Types
export type {
  MongoContext,
  MongoContextType,
  MongoOperator,
  MongoOperatorCategory,
  MongoStage,
  MongoStageCategory,
  MongoAccumulator,
  MongoAccumulatorCategory,
  MongoExpression,
  MongoExpressionCategory,
  MongoFieldInfo,
  MongoFieldType,
  MongoAutocompleteData,
  MongoCompletion,
  MongoCompletionType,
} from "./types";

// Context parser
export {
  getMongoContext,
  canAddOperator,
  canAddStage,
  canAddAccumulator,
  canAddExpression,
} from "./contextParser";

// Operators
export {
  COMPARISON_OPERATORS,
  LOGICAL_OPERATORS,
  ELEMENT_OPERATORS,
  EVALUATION_OPERATORS,
  ARRAY_OPERATORS,
  BITWISE_OPERATORS,
  GEOSPATIAL_OPERATORS,
  UPDATE_FIELD_OPERATORS,
  UPDATE_ARRAY_OPERATORS,
  ALL_QUERY_OPERATORS,
  ALL_UPDATE_OPERATORS,
  ALL_OPERATORS,
  getOperator,
  searchOperators,
  searchQueryOperators,
  searchUpdateOperators,
} from "./operators";

// Stages and expressions
export {
  FILTER_STAGES,
  TRANSFORM_STAGES,
  GROUP_STAGES,
  SORT_STAGES,
  JOIN_STAGES,
  RESHAPE_STAGES,
  OUTPUT_STAGES,
  OTHER_STAGES,
  ALL_STAGES,
  ALL_ACCUMULATORS,
  ALL_EXPRESSIONS,
  SYSTEM_VARIABLES,
  getStage,
  searchStages,
  getAccumulator,
  searchAccumulators,
  getExpression,
  searchExpressions,
} from "./stages";

// Completion provider
export {
  createSmartMongoCompletion,
  createBasicMongoCompletion,
} from "./completionProvider";
