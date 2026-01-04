/**
 * Redis Autocomplete - Context-aware autocomplete for Redis commands
 *
 * Features:
 * - 200+ Redis commands with full syntax
 * - Argument type awareness
 * - Option suggestions
 * - Key pattern completions
 * - Common operation snippets
 * - Complexity hints
 */

// Main completion provider
export { createSmartRedisCompletion, createBasicRedisCompletion } from "./completionProvider";

// Context parser
export { getRedisContext, tokenize, isInQuote, isOptionPosition, getAvailableOptions } from "./contextParser";

// Commands
export { REDIS_COMMANDS, getCommand, getCommandsByCategory, searchCommands, COMMAND_MAP } from "./commands";

// Types
export type {
  RedisDataType,
  RedisArgType,
  RedisArgDef,
  RedisOption,
  RedisCommand,
  RedisCommandCategory,
  RedisContext,
  RedisAutocompleteData,
  RedisCompletion,
  RedisCompletionType,
} from "./types";
