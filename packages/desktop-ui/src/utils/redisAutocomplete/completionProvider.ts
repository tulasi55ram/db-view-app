/**
 * Redis Completion Provider
 *
 * Provides context-aware autocomplete suggestions for Redis commands.
 * Features:
 * - Command completion with syntax hints
 * - Argument type awareness
 * - Option suggestions
 * - Common key patterns
 * - Snippets for common operations
 */

import type { CompletionContext, Completion } from "@codemirror/autocomplete";
import type { RedisAutocompleteData } from "./types";
import { REDIS_COMMANDS, getCommand, searchCommands } from "./commands";
import { getRedisContext, isOptionPosition } from "./contextParser";

// Boost values for different completion types
const BOOST = {
  COMMAND: 100,
  SUBCOMMAND: 95,
  OPTION: 80,
  KEY: 70,
  SNIPPET: 90,
  PATTERN: 60,
  EXAMPLE: 50,
};

// Common key patterns for suggestions
const KEY_PATTERNS = [
  { pattern: "user:*", description: "User data" },
  { pattern: "session:*", description: "Session data" },
  { pattern: "cache:*", description: "Cached data" },
  { pattern: "queue:*", description: "Queue/job data" },
  { pattern: "lock:*", description: "Distributed locks" },
  { pattern: "rate:*", description: "Rate limiting" },
  { pattern: "config:*", description: "Configuration" },
  { pattern: "temp:*", description: "Temporary data" },
];

// Redis snippets for common operations
const REDIS_SNIPPETS: Array<{
  label: string;
  detail: string;
  template: string;
  info: string;
}> = [
  {
    label: "get-set",
    detail: "Get and Set",
    template: 'SET ${1:key} "${2:value}"',
    info: "Set a string value",
  },
  {
    label: "get-set-ex",
    detail: "Set with Expiry",
    template: 'SET ${1:key} "${2:value}" EX ${3:3600}',
    info: "Set with expiration in seconds",
  },
  {
    label: "setnx",
    detail: "Set if Not Exists",
    template: 'SET ${1:key} "${2:value}" NX',
    info: "Set only if key doesn't exist (distributed lock pattern)",
  },
  {
    label: "hash-set",
    detail: "Set Hash Fields",
    template: 'HSET ${1:key} ${2:field} "${3:value}"',
    info: "Set hash field value",
  },
  {
    label: "hash-getall",
    detail: "Get All Hash Fields",
    template: "HGETALL ${1:key}",
    info: "Get all fields and values from hash",
  },
  {
    label: "list-push-pop",
    detail: "Queue Pattern",
    template: 'LPUSH ${1:queue:tasks} "${2:task_data}"',
    info: "Push to list head (queue pattern)",
  },
  {
    label: "list-range",
    detail: "Get List Range",
    template: "LRANGE ${1:key} 0 ${2:-1}",
    info: "Get all list elements (0 to -1)",
  },
  {
    label: "set-add",
    detail: "Add to Set",
    template: 'SADD ${1:key} "${2:member}"',
    info: "Add member to set",
  },
  {
    label: "zset-add",
    detail: "Add to Sorted Set",
    template: 'ZADD ${1:leaderboard} ${2:100} "${3:member}"',
    info: "Add member with score to sorted set",
  },
  {
    label: "zset-top",
    detail: "Get Top N from Sorted Set",
    template: "ZREVRANGE ${1:leaderboard} 0 ${2:9} WITHSCORES",
    info: "Get top 10 with scores (descending)",
  },
  {
    label: "scan-pattern",
    detail: "Safe Key Iteration",
    template: "SCAN ${1:0} MATCH ${2:user:*} COUNT ${3:100}",
    info: "Safely iterate keys matching pattern",
  },
  {
    label: "expire",
    detail: "Set Key Expiry",
    template: "EXPIRE ${1:key} ${2:3600}",
    info: "Set key expiration in seconds",
  },
  {
    label: "transaction",
    detail: "Transaction Block",
    template: "MULTI\n${1:SET key1 value1}\n${2:SET key2 value2}\nEXEC",
    info: "Atomic transaction",
  },
  {
    label: "pipeline-incr",
    detail: "Increment Counter",
    template: "INCR ${1:counter:page_views}",
    info: "Atomic increment by 1",
  },
  {
    label: "stream-add",
    detail: "Add to Stream",
    template: 'XADD ${1:events:user} * ${2:action} "${3:login}"',
    info: "Add entry to stream with auto ID",
  },
  {
    label: "stream-read",
    detail: "Read from Stream",
    template: "XREAD COUNT ${1:10} STREAMS ${2:events:user} ${3:0}",
    info: "Read entries from stream",
  },
  {
    label: "publish",
    detail: "Publish Message",
    template: 'PUBLISH ${1:channel} "${2:message}"',
    info: "Publish to pub/sub channel",
  },
  {
    label: "geo-add",
    detail: "Add Geo Location",
    template: 'GEOADD ${1:locations} ${2:-122.4194} ${3:37.7749} "${4:San Francisco}"',
    info: "Add geospatial item",
  },
  {
    label: "geo-search",
    detail: "Search Nearby",
    template: "GEORADIUS ${1:locations} ${2:-122.4194} ${3:37.7749} ${4:100} km WITHDIST COUNT 10",
    info: "Find items within radius",
  },
];

/**
 * Create command completions
 */
function createCommandCompletions(prefix: string): Completion[] {
  const commands = prefix ? searchCommands(prefix) : REDIS_COMMANDS.slice(0, 30);

  return commands.map((cmd) => ({
    label: cmd.fullName || cmd.name,
    type: "keyword",
    detail: cmd.args.map((a) => (a.optional ? `[${a.name}]` : a.name)).join(" "),
    info: () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div style="max-width: 300px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${cmd.fullName || cmd.name}</div>
          <div style="color: #888; font-size: 12px; margin-bottom: 4px;">${cmd.summary}</div>
          ${cmd.complexity ? `<div style="font-size: 11px; color: #666;">Complexity: ${cmd.complexity}</div>` : ""}
          <div style="font-family: monospace; font-size: 11px; background: #f5f5f5; padding: 4px; margin-top: 4px; border-radius: 3px; color: #333;">${cmd.example}</div>
        </div>
      `;
      return div;
    },
    boost: BOOST.COMMAND,
    apply: cmd.fullName || cmd.name,
  }));
}

/**
 * Create option completions for current command
 */
function createOptionCompletions(commandName: string, usedOptions: string[]): Completion[] {
  const command = getCommand(commandName);
  if (!command || !command.options) return [];

  const usedSet = new Set(usedOptions.map((o) => o.toUpperCase()));

  return command.options
    .filter((opt) => !usedSet.has(opt.name.toUpperCase()))
    .map((opt) => ({
      label: opt.name,
      type: "property",
      detail: opt.args?.map((a) => a.name).join(" ") || "",
      info: opt.description,
      boost: BOOST.OPTION,
    }));
}

/**
 * Create key pattern completions
 */
function createKeyPatternCompletions(prefix: string): Completion[] {
  return KEY_PATTERNS.filter(
    (p) => !prefix || p.pattern.toLowerCase().includes(prefix.toLowerCase())
  ).map((p) => ({
    label: p.pattern,
    type: "variable",
    detail: p.description,
    boost: BOOST.PATTERN,
  }));
}

/**
 * Create snippet completions
 */
function createSnippetCompletions(prefix: string): Completion[] {
  return REDIS_SNIPPETS.filter(
    (s) => !prefix || s.label.toLowerCase().includes(prefix.toLowerCase())
  ).map((s) => ({
    label: s.label,
    type: "snippet",
    detail: s.detail,
    info: s.info,
    boost: BOOST.SNIPPET,
    apply: s.template.replace(/\$\{\d+:([^}]+)\}/g, "$1"), // Convert to plain text
  }));
}

/**
 * Create completions from known keys
 */
function createKeyCompletions(keys: string[], prefix: string): Completion[] {
  return keys
    .filter((k) => !prefix || k.toLowerCase().includes(prefix.toLowerCase()))
    .slice(0, 20)
    .map((key) => ({
      label: key,
      type: "variable",
      detail: "Known key",
      boost: BOOST.KEY,
    }));
}

/**
 * Create argument hint completions
 */
function createArgHintCompletions(commandName: string, argIndex: number): Completion[] {
  const command = getCommand(commandName);
  if (!command || argIndex >= command.args.length) return [];

  const arg = command.args[argIndex];
  const completions: Completion[] = [];

  // If arg has enum values, show those
  if (arg.enum) {
    arg.enum.forEach((val) => {
      completions.push({
        label: val,
        type: "enum",
        detail: `${arg.name} value`,
        boost: BOOST.OPTION,
      });
    });
  }

  // Add type hint
  completions.push({
    label: `<${arg.name}>`,
    type: "text",
    detail: arg.type,
    info: arg.description,
    boost: 0, // Low boost - just a hint
  });

  return completions;
}

/**
 * Main completion provider factory
 */
export function createSmartRedisCompletion(
  getData: () => RedisAutocompleteData
) {
  return (context: CompletionContext) => {
    // Get current context
    const redisContext = getRedisContext(context.state, context.pos);
    const data = getData();

    // Don't complete inside quotes (unless explicit)
    if (redisContext.inQuote && !context.explicit) {
      return null;
    }

    const word = redisContext.currentWord;
    const completions: Completion[] = [];

    // Case 1: Typing command name (no command yet or at start)
    if (redisContext.argIndex === -1 || !redisContext.command) {
      // Show commands
      completions.push(...createCommandCompletions(word));

      // Show snippets
      if (context.explicit || word.length >= 2) {
        completions.push(...createSnippetCompletions(word));
      }
    }
    // Case 2: Have command, suggest arguments/options
    else if (redisContext.command) {
      const command = getCommand(redisContext.command);

      if (command) {
        // Show options if we're past required args
        if (isOptionPosition(redisContext)) {
          const usedOptions = redisContext.previousWords.filter((w) =>
            command.options?.some((o) => o.name.toUpperCase() === w.toUpperCase())
          );
          completions.push(...createOptionCompletions(redisContext.command, usedOptions));
        }

        // Show argument hints based on expected type
        const expectedType = redisContext.expectedType;

        if (expectedType === "key" || expectedType === "keys") {
          // Show known keys
          if (data.keys && data.keys.length > 0) {
            completions.push(...createKeyCompletions(data.keys, word));
          }
          // Show key patterns
          completions.push(...createKeyPatternCompletions(word));
        }

        if (expectedType === "pattern") {
          completions.push(...createKeyPatternCompletions(word));
        }

        if (expectedType === "channel" && data.channels) {
          data.channels
            .filter((c) => !word || c.toLowerCase().includes(word.toLowerCase()))
            .slice(0, 10)
            .forEach((channel) => {
              completions.push({
                label: channel,
                type: "variable",
                detail: "Channel",
                boost: BOOST.KEY,
              });
            });
        }

        // Show argument hints
        completions.push(...createArgHintCompletions(redisContext.command, redisContext.argIndex));
      }
    }

    // No completions found
    if (completions.length === 0 && !context.explicit) {
      return null;
    }

    // Determine 'from' position
    let from = context.pos;
    if (word) {
      from = context.pos - word.length;
    }

    return {
      from,
      options: completions,
      validFor: /^[\w:*\-_.]*$/,
    };
  };
}

/**
 * Export for simpler usage when data isn't needed
 */
export function createBasicRedisCompletion() {
  return createSmartRedisCompletion(() => ({}));
}
