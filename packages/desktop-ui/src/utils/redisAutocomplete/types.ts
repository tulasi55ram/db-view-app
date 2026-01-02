/**
 * Types for Redis autocomplete system
 *
 * Redis is command-based with unique features:
 * - Commands with subcommands (CLIENT GET, CONFIG SET, etc.)
 * - Various data structures (String, Hash, List, Set, Sorted Set, Stream)
 * - Key patterns for organization
 * - Options and flags for commands
 */

// Redis data types
export type RedisDataType =
  | "string"
  | "hash"
  | "list"
  | "set"
  | "zset"      // Sorted set
  | "stream"
  | "bitmap"
  | "hyperloglog"
  | "geo";

// Argument types for commands
export type RedisArgType =
  | "key"           // Key name
  | "keys"          // Multiple keys
  | "pattern"       // Key pattern (KEYS, SCAN)
  | "value"         // String value
  | "values"        // Multiple values
  | "field"         // Hash field
  | "fields"        // Multiple fields
  | "member"        // Set/sorted set member
  | "members"       // Multiple members
  | "score"         // Sorted set score
  | "index"         // List index
  | "count"         // Count/limit
  | "timeout"       // Timeout in seconds
  | "milliseconds"  // Timeout in milliseconds
  | "timestamp"     // Unix timestamp
  | "cursor"        // Scan cursor
  | "channel"       // Pub/sub channel
  | "message"       // Pub/sub message
  | "script"        // Lua script
  | "sha1"          // Script SHA1
  | "stream-id"     // Stream entry ID
  | "group"         // Consumer group
  | "consumer"      // Consumer name
  | "longitude"     // Geo longitude
  | "latitude"      // Geo latitude
  | "radius"        // Geo radius
  | "unit"          // Unit (m, km, ft, mi)
  | "option"        // Command option/flag
  | "subcommand"    // Subcommand
  | "any";          // Any value

// Command argument definition
export interface RedisArgDef {
  name: string;
  type: RedisArgType;
  optional?: boolean;
  multiple?: boolean;  // Can repeat (e.g., key [key ...])
  enum?: string[];     // Possible values for options
  description?: string;
}

// Command option/flag
export interface RedisOption {
  name: string;
  args?: RedisArgDef[];  // Arguments for this option
  description?: string;
}

// Full command definition
export interface RedisCommand {
  name: string;                    // Command name (e.g., "SET", "HGETALL")
  fullName?: string;              // Full name with subcommand (e.g., "CLIENT LIST")
  category: RedisCommandCategory;
  summary: string;                 // Brief description
  complexity?: string;             // Time complexity (O(1), O(N), etc.)
  args: RedisArgDef[];            // Required and optional arguments
  options?: RedisOption[];        // Command options (EX, NX, XX, etc.)
  since?: string;                 // Redis version introduced
  deprecated?: boolean;
  subcommands?: RedisCommand[];   // For commands with subcommands
  returns?: string;               // Return type description
  example: string;                // Example usage
}

// Command categories
export type RedisCommandCategory =
  | "string"
  | "hash"
  | "list"
  | "set"
  | "sortedset"
  | "key"
  | "stream"
  | "pubsub"
  | "transaction"
  | "scripting"
  | "connection"
  | "server"
  | "cluster"
  | "geo"
  | "hyperloglog"
  | "bitmap"
  | "generic";

// Context at cursor position
export interface RedisContext {
  command?: string;           // Current command being typed
  subcommand?: string;        // Subcommand if applicable
  argIndex: number;           // Which argument we're on (0-based)
  currentWord: string;        // Word being typed
  previousWords: string[];    // All previous words in command
  inQuote: boolean;          // Inside quoted string
  quoteChar?: '"' | "'";     // Quote character used
  expectedType?: RedisArgType;
  cursorPos: number;
}

// Autocomplete data (keys from the database)
export interface RedisAutocompleteData {
  keys?: string[];           // Known keys
  keyPatterns?: string[];    // Common key patterns
  channels?: string[];       // Known pub/sub channels
  groups?: Record<string, string[]>;  // Stream consumer groups
}

// Completion item
export interface RedisCompletion {
  label: string;
  type: RedisCompletionType;
  detail?: string;
  info?: string;
  boost?: number;
  apply?: string;           // Text to insert
  template?: string;        // Snippet template
}

export type RedisCompletionType =
  | "command"
  | "subcommand"
  | "key"
  | "option"
  | "value"
  | "keyword"
  | "snippet"
  | "pattern"
  | "example";
