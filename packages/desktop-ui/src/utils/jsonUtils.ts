/**
 * Utilities for JSON detection and parsing
 */

/**
 * Check if a value is or contains JSON data
 */
export function isJsonValue(value: unknown): boolean {
  if (typeof value === "object" && value !== null) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

/**
 * Try to parse a value as JSON
 */
export function tryParseJson(value: unknown): { data: unknown; isJson: boolean } {
  // Already an object/array
  if (typeof value === "object" && value !== null) {
    return { data: value, isJson: true };
  }

  // Try to parse string as JSON
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null) {
          return { data: parsed, isJson: true };
        }
      } catch {
        // Not valid JSON
      }
    }
  }

  return { data: value, isJson: false };
}

/**
 * Truncate JSON for preview display
 */
export function truncateJson(value: unknown, maxLength = 50): string {
  if (value === null) return "null";
  if (value === undefined) return "";

  if (typeof value === "object") {
    const str = JSON.stringify(value);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
  }

  if (typeof value === "string") {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + "...";
  }

  return String(value);
}
