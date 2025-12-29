/**
 * Platform detection utilities
 */

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Format a keyboard shortcut key for display
 */
export function formatShortcutKey(key: string): string {
  if (isMac) {
    switch (key) {
      case "Ctrl":
      case "Mod":
        return "\u2318"; // ⌘
      case "Alt":
        return "\u2325"; // ⌥
      case "Shift":
        return "\u21E7"; // ⇧
      case "Enter":
        return "\u21A9"; // ↩
      case "Backspace":
        return "\u232B"; // ⌫
      case "Escape":
        return "\u238B"; // ⎋
      case "Tab":
        return "\u21E5"; // ⇥
      case "ArrowUp":
        return "\u2191"; // ↑
      case "ArrowDown":
        return "\u2193"; // ↓
      case "ArrowLeft":
        return "\u2190"; // ←
      case "ArrowRight":
        return "\u2192"; // →
      default:
        return key;
    }
  }
  return key;
}

/**
 * Format an array of keys as a shortcut string
 */
export function formatShortcut(keys: string[]): string {
  return keys.map(formatShortcutKey).join(isMac ? "" : "+");
}
