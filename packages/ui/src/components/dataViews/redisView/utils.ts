/**
 * Redis View Utils
 *
 * Utility functions for the Redis data view
 */

import type { ParsedValue } from "./types";

/**
 * Parse and detect format of a Redis value
 */
export function parseValue(value: unknown): ParsedValue {
  if (value === null || value === undefined) {
    return {
      raw: '',
      formatted: '(nil)',
      format: 'text',
      isJson: false,
    };
  }

  // If value is already an object/array, treat it as JSON directly
  if (typeof value === 'object') {
    const formatted = JSON.stringify(value, null, 2);
    return {
      raw: formatted,
      formatted,
      format: 'json',
      isJson: true,
      jsonParsed: value,
    };
  }

  const raw = String(value);

  // Try to detect JSON string
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return {
        raw,
        formatted: JSON.stringify(parsed, null, 2),
        format: 'json',
        isJson: true,
        jsonParsed: parsed,
      };
    } catch {
      // Not valid JSON
    }
  }

  // Check for binary/hex content
  if (containsBinaryData(raw)) {
    return {
      raw,
      formatted: toHexString(raw),
      format: 'hex',
      isJson: false,
    };
  }

  // Plain text
  return {
    raw,
    formatted: raw,
    format: 'text',
    isJson: false,
  };
}

/**
 * Check if string contains binary data
 */
function containsBinaryData(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Non-printable characters (except common whitespace)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      return true;
    }
  }
  return false;
}

/**
 * Convert string to hex representation
 */
function toHexString(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hex += code.toString(16).padStart(2, '0') + ' ';
    if ((i + 1) % 16 === 0) hex += '\n';
  }
  return hex.trim();
}

/**
 * Format TTL for display
 */
export function formatTTL(ttl: number): { text: string; color: string; urgent: boolean } {
  if (ttl === -1) {
    return { text: 'No expiry', color: 'text-vscode-text-muted', urgent: false };
  }
  if (ttl === -2) {
    return { text: 'Key not found', color: 'text-vscode-error', urgent: true };
  }
  if (ttl <= 0) {
    return { text: 'Expired', color: 'text-vscode-error', urgent: true };
  }

  // Convert to readable format
  const days = Math.floor(ttl / 86400);
  const hours = Math.floor((ttl % 86400) / 3600);
  const minutes = Math.floor((ttl % 3600) / 60);
  const seconds = ttl % 60;

  let text = '';
  if (days > 0) text += `${days}d `;
  if (hours > 0) text += `${hours}h `;
  if (minutes > 0 && days === 0) text += `${minutes}m `;
  if (seconds > 0 && days === 0 && hours === 0) text += `${seconds}s`;

  // Determine urgency color
  let color = 'text-green-500';
  let urgent = false;

  if (ttl < 60) {
    color = 'text-red-500';
    urgent = true;
  } else if (ttl < 3600) {
    color = 'text-orange-500';
    urgent = true;
  } else if (ttl < 86400) {
    color = 'text-yellow-500';
    urgent = false;
  }

  return { text: text.trim() || '< 1s', color, urgent };
}

/**
 * Format memory size for display
 */
export function formatMemory(bytes: number | undefined): string {
  if (bytes === undefined || bytes < 0) return '—';

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse Redis key to extract prefix/namespace
 */
export function parseKeyNamespace(key: string): { namespace: string | null; name: string } {
  const lastColon = key.lastIndexOf(':');
  if (lastColon === -1) {
    return { namespace: null, name: key };
  }
  return {
    namespace: key.slice(0, lastColon),
    name: key.slice(lastColon + 1),
  };
}
