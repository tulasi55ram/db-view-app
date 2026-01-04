/**
 * Redis Context Parser
 *
 * Parses the current command to determine:
 * - Which command is being typed
 * - Which argument position we're at
 * - What type of completion to suggest
 */

import type { EditorState } from "@codemirror/state";
import type { RedisContext, RedisArgType } from "./types";
import { getCommand } from "./commands";

/**
 * Parse tokens from a Redis command string
 * Handles quoted strings and escapes
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar: string | null = null;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      current += char;
      continue;
    }

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
      current += char;
      continue;
    }

    if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = null;
      current += char;
      continue;
    }

    if (!inQuote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  // Add remaining token (might be partial)
  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check if cursor is inside a quoted string
 */
export function isInQuote(text: string, cursorPos: number): { inQuote: boolean; quoteChar?: '"' | "'" } {
  let inQuote = false;
  let quoteChar: '"' | "'" | undefined;
  let escape = false;

  for (let i = 0; i < cursorPos && i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char as '"' | "'";
      continue;
    }

    if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = undefined;
      continue;
    }
  }

  return { inQuote, quoteChar };
}

/**
 * Get current word being typed at cursor position
 */
export function getCurrentWord(text: string, cursorPos: number): { word: string; start: number } {
  let start = cursorPos;

  // Walk backward to find word start
  while (start > 0) {
    const char = text[start - 1];
    if (/\s/.test(char)) break;
    start--;
  }

  return {
    word: text.slice(start, cursorPos),
    start,
  };
}

/**
 * Determine expected argument type based on command and position
 */
export function getExpectedType(
  commandName: string,
  argIndex: number
): RedisArgType | undefined {
  const command = getCommand(commandName);
  if (!command) return undefined;

  // Handle subcommands (e.g., "CLIENT LIST", "CONFIG GET")
  const parts = commandName.toUpperCase().split(" ");
  if (parts.length > 1) {
    // For subcommands, argIndex 0 would be the subcommand itself
    // Adjust index for the actual command arguments
    const subCmd = getCommand(commandName);
    if (subCmd && subCmd.args.length > argIndex) {
      return subCmd.args[argIndex].type;
    }
  }

  // Regular command
  if (command.args.length > argIndex) {
    return command.args[argIndex].type;
  }

  // Check if the last arg is multiple (can repeat)
  const lastArg = command.args[command.args.length - 1];
  if (lastArg?.multiple) {
    return lastArg.type;
  }

  // May be in options section
  return "option";
}

/**
 * Parse Redis command context from editor state
 */
export function getRedisContext(state: EditorState, pos: number): RedisContext {
  // Get text up to cursor position
  const text = state.doc.sliceString(0, pos);

  // Check if we're in a quote
  const quoteInfo = isInQuote(text, pos);

  // Get current word at cursor
  const { word, start } = getCurrentWord(text, pos);

  // Tokenize everything before the current word
  const textBeforeCursor = text.slice(0, start).trim();
  const tokens = tokenize(textBeforeCursor);

  // Determine command and argument index
  let command: string | undefined;
  let subcommand: string | undefined;
  let argIndex = 0;

  if (tokens.length > 0) {
    // First token is the command
    const firstToken = tokens[0].toUpperCase();

    // Check if this is a command with subcommands
    if (tokens.length > 1) {
      const potentialFullCommand = `${firstToken} ${tokens[1].toUpperCase()}`;
      if (getCommand(potentialFullCommand)) {
        command = potentialFullCommand;
        subcommand = tokens[1].toUpperCase();
        argIndex = tokens.length - 2; // Subtract command and subcommand
      } else {
        command = firstToken;
        argIndex = tokens.length - 1; // Subtract just command
      }
    } else {
      command = firstToken;
      argIndex = 0;
    }
  }

  // If we have text in current word and no previous tokens, we're typing the command
  if (tokens.length === 0) {
    return {
      argIndex: -1, // -1 means typing command itself
      currentWord: word,
      previousWords: [],
      inQuote: quoteInfo.inQuote,
      quoteChar: quoteInfo.quoteChar,
      cursorPos: pos,
    };
  }

  // Determine expected type
  const expectedType = command ? getExpectedType(command, argIndex) : undefined;

  return {
    command,
    subcommand,
    argIndex,
    currentWord: word,
    previousWords: tokens,
    inQuote: quoteInfo.inQuote,
    quoteChar: quoteInfo.quoteChar,
    expectedType,
    cursorPos: pos,
  };
}

/**
 * Check if the current position might be expecting an option
 */
export function isOptionPosition(context: RedisContext): boolean {
  if (!context.command) return false;

  const command = getCommand(context.command);
  if (!command || !command.options) return false;

  // Check if we're past the required arguments
  const requiredArgsCount = command.args.filter((a) => !a.optional).length;
  return context.argIndex >= requiredArgsCount;
}

/**
 * Get available options for current command context
 */
export function getAvailableOptions(context: RedisContext): string[] {
  if (!context.command) return [];

  const command = getCommand(context.command);
  if (!command || !command.options) return [];

  // Filter out options that are already used
  const usedOptions = new Set(
    context.previousWords
      .map((w) => w.toUpperCase())
      .filter((w) => command.options!.some((o) => o.name.toUpperCase() === w))
  );

  return command.options
    .filter((opt) => !usedOptions.has(opt.name.toUpperCase()))
    .map((opt) => opt.name);
}
