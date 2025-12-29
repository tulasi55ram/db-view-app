import { type FC, useState, useMemo } from "react";
import { Keyboard, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatShortcut, isMac } from "@/utils/platform";
import {
  SHORTCUTS,
  CATEGORY_LABELS,
  getShortcutsByCategory,
  type Shortcut,
  type ShortcutCategory,
} from "./shortcuts";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/primitives/Dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Keyboard shortcuts overlay dialog
 */
export const KeyboardShortcutsDialog: FC<KeyboardShortcutsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const shortcutsByCategory = useMemo(() => getShortcutsByCategory(), []);

  // Filter shortcuts based on search
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcutsByCategory;

    const query = searchQuery.toLowerCase();
    const result: Record<ShortcutCategory, Shortcut[]> = {
      general: [],
      navigation: [],
      editing: [],
      query: [],
    };

    for (const shortcut of SHORTCUTS) {
      if (
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.context?.toLowerCase().includes(query) ||
        shortcut.keys.some((k) => k.toLowerCase().includes(query))
      ) {
        result[shortcut.category].push(shortcut);
      }
    }

    return result;
  }, [searchQuery, shortcutsByCategory]);

  const hasResults = Object.values(filteredShortcuts).some(
    (shortcuts) => shortcuts.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full max-h-[80vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-bg-hover transition-colors"
          >
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-2 rounded-md",
                "bg-bg-primary border border-border",
                "text-sm text-text-primary placeholder:text-text-tertiary",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              )}
              autoFocus
            />
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!hasResults ? (
            <div className="text-center py-8 text-text-tertiary">
              No shortcuts found for "{searchQuery}"
            </div>
          ) : (
            Object.entries(filteredShortcuts).map(
              ([category, shortcuts]) =>
                shortcuts.length > 0 && (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                      {CATEGORY_LABELS[category as ShortcutCategory]}
                    </h3>
                    <div className="space-y-2">
                      {shortcuts.map((shortcut) => (
                        <ShortcutItem key={shortcut.id} shortcut={shortcut} />
                      ))}
                    </div>
                  </div>
                )
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-bg-tertiary text-xs text-text-tertiary">
          <span>
            Press <KeyBadge keys={["?"]} /> anywhere to show this dialog
          </span>
          <span className="mx-2">•</span>
          <span>{isMac ? "⌘" : "Ctrl"} = {isMac ? "Command" : "Control"}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Individual shortcut item
 */
interface ShortcutItemProps {
  shortcut: Shortcut;
}

const ShortcutItem: FC<ShortcutItemProps> = ({ shortcut }) => {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-bg-hover -mx-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-primary">{shortcut.description}</span>
        {shortcut.context && (
          <span className="text-xs text-text-tertiary px-1.5 py-0.5 rounded bg-bg-tertiary">
            {shortcut.context}
          </span>
        )}
      </div>
      <KeyBadge keys={shortcut.keys} />
    </div>
  );
};

/**
 * Key badge component
 */
interface KeyBadgeProps {
  keys: string[];
}

const KeyBadge: FC<KeyBadgeProps> = ({ keys }) => {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, idx) => (
        <kbd
          key={idx}
          className={cn(
            "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5",
            "text-xs font-medium rounded",
            "bg-bg-tertiary border border-border text-text-secondary",
            "shadow-sm"
          )}
        >
          {formatShortcut([key])}
        </kbd>
      ))}
    </div>
  );
};
