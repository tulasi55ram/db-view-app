/**
 * Centralized keyboard shortcuts registry
 */

export type ShortcutCategory = "general" | "navigation" | "editing" | "query";

export interface Shortcut {
  id: string;
  keys: string[];
  description: string;
  category: ShortcutCategory;
  context?: string; // e.g., "Table View", "Query Editor"
}

export const SHORTCUTS: Shortcut[] = [
  // General
  {
    id: "show-shortcuts",
    keys: ["?"],
    description: "Show keyboard shortcuts",
    category: "general",
  },
  {
    id: "split-view",
    keys: ["Mod", "\\"],
    description: "Toggle split view",
    category: "general",
  },
  {
    id: "close-split",
    keys: ["Mod", "Shift", "\\"],
    description: "Close split view",
    category: "general",
  },

  // Navigation - Table View
  {
    id: "search",
    keys: ["/"],
    description: "Focus quick search",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "jump-to-row",
    keys: ["Mod", "G"],
    description: "Jump to row",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "prev-page",
    keys: ["Mod", "ArrowLeft"],
    description: "Previous page",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "next-page",
    keys: ["Mod", "ArrowRight"],
    description: "Next page",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "first-page",
    keys: ["Mod", "Home"],
    description: "First page",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "last-page",
    keys: ["Mod", "End"],
    description: "Last page",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "scroll-top",
    keys: ["Home"],
    description: "Scroll to top",
    category: "navigation",
    context: "Table View",
  },
  {
    id: "scroll-bottom",
    keys: ["End"],
    description: "Scroll to bottom",
    category: "navigation",
    context: "Table View",
  },

  // Editing - Table View
  {
    id: "copy-selection",
    keys: ["Mod", "C"],
    description: "Copy selected rows/cell",
    category: "editing",
    context: "Table View",
  },
  {
    id: "undo",
    keys: ["Mod", "Z"],
    description: "Undo last edit",
    category: "editing",
    context: "Table View",
  },

  // Query Editor
  {
    id: "run-query",
    keys: ["Mod", "Enter"],
    description: "Run query",
    category: "query",
    context: "Query Editor",
  },
  {
    id: "next-snippet",
    keys: ["Tab"],
    description: "Next snippet field",
    category: "query",
    context: "Query Editor",
  },
  {
    id: "prev-snippet",
    keys: ["Shift", "Tab"],
    description: "Previous snippet field",
    category: "query",
    context: "Query Editor",
  },
];

export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  general: "General",
  navigation: "Navigation",
  editing: "Editing",
  query: "Query Editor",
};

/**
 * Group shortcuts by category
 */
export function getShortcutsByCategory(): Record<ShortcutCategory, Shortcut[]> {
  const grouped: Record<ShortcutCategory, Shortcut[]> = {
    general: [],
    navigation: [],
    editing: [],
    query: [],
  };

  for (const shortcut of SHORTCUTS) {
    grouped[shortcut.category].push(shortcut);
  }

  return grouped;
}
