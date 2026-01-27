/**
 * FloatingSelectionBar - A floating bar that appears at the bottom when rows are selected
 *
 * Shows selection count and provides quick actions for selected rows.
 */

import { type FC, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";

export interface FloatingSelectionBarProps {
  selectedCount: number;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClearSelection: () => void;
  isReadOnly?: boolean;
}

export const FloatingSelectionBar: FC<FloatingSelectionBarProps> = memo(({
  selectedCount,
  onCopy,
  onDuplicate,
  onDelete,
  onClearSelection,
  isReadOnly = false,
}) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-vscode-bg-lighter border border-vscode-border rounded-lg shadow-xl backdrop-blur-sm"
        >
          {/* Selection Count */}
          <div className="flex items-center gap-2 text-sm text-vscode-text">
            <Check className="w-4 h-4 text-vscode-accent" />
            <span className="font-medium">{selectedCount} selected</span>
          </div>

          <div className="w-px h-5 bg-vscode-border" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Copy Button */}
            {onCopy && (
              <ActionButton
                icon={<Copy className="w-4 h-4" />}
                title={`Copy ${selectedCount} row${selectedCount === 1 ? '' : 's'} to clipboard`}
                onClick={onCopy}
              />
            )}

            {/* Duplicate Button - only show for single row selection */}
            {selectedCount === 1 && !isReadOnly && onDuplicate && (
              <ActionButton
                icon={<Plus className="w-4 h-4" />}
                title="Duplicate row"
                onClick={onDuplicate}
              />
            )}

            {/* Delete Button */}
            {!isReadOnly && onDelete && (
              <ActionButton
                icon={<Trash2 className="w-4 h-4" />}
                title={`Delete ${selectedCount} row${selectedCount === 1 ? '' : 's'}`}
                onClick={onDelete}
                danger
              />
            )}
          </div>

          <div className="w-px h-5 bg-vscode-border" />

          {/* Clear Selection Button */}
          <ActionButton
            icon={<X className="w-3.5 h-3.5" />}
            title="Clear selection"
            onClick={onClearSelection}
            small
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

FloatingSelectionBar.displayName = "FloatingSelectionBar";

// Internal ActionButton component
interface ActionButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  small?: boolean;
}

const ActionButton: FC<ActionButtonProps> = ({ icon, title, onClick, danger, small }) => (
  <button
    onClick={onClick}
    title={title}
    className={clsx(
      "rounded transition-colors",
      small ? "p-1" : "p-1.5",
      danger
        ? "text-vscode-error hover:bg-vscode-error/10"
        : "text-vscode-text hover:bg-vscode-bg-hover"
    )}
  >
    {icon}
  </button>
);
