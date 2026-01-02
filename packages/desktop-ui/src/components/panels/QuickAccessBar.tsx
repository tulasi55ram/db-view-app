/**
 * QuickAccessBar - Slim icon bar for quick panel access
 *
 * Shown on the right edge when no panel is open.
 * Provides quick access buttons to open panels.
 */

import { type FC, memo } from "react";
import { motion } from "framer-motion";
import { Plus, Info, Bookmark, Braces } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip";
import type { QuickAccessBarProps } from "./types";

interface QuickAccessButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

const QuickAccessButton: FC<QuickAccessButtonProps> = memo(({
  icon,
  label,
  shortcut,
  onClick,
  isActive,
  disabled,
}) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`
            p-2 rounded-md transition-all duration-150
            ${isActive
              ? "bg-accent/20 text-accent"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            focus:outline-none focus:ring-2 focus:ring-accent/50
          `}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="z-50 px-2.5 py-1.5 bg-bg-tertiary border border-border rounded-md shadow-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">{label}</span>
          {shortcut && (
            <span className="text-[10px] text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded">
              {shortcut}
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
));

QuickAccessButton.displayName = "QuickAccessButton";

export const QuickAccessBar: FC<QuickAccessBarProps> = memo(({
  onOpenPanel,
  activePanel,
  hasUnsavedChanges,
  hasSelectedCell,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.15 }}
      className="w-10 flex flex-col items-center py-3 gap-1 bg-bg-secondary/30 border-l border-border"
    >
      {/* Primary Actions */}
      <div className="flex flex-col items-center gap-1">
        <QuickAccessButton
          icon={<Plus className="w-4 h-4" />}
          label="Insert Row"
          shortcut="Ctrl+I"
          onClick={() => onOpenPanel("insert")}
          isActive={activePanel === "insert"}
        />

        {hasSelectedCell && (
          <QuickAccessButton
            icon={<Braces className="w-4 h-4" />}
            label="Edit JSON"
            onClick={() => onOpenPanel("json-editor")}
            isActive={activePanel === "json-editor"}
          />
        )}
      </div>

      {/* Divider */}
      <div className="w-5 h-px bg-border my-2" />

      {/* View Controls */}
      <div className="flex flex-col items-center gap-1">
        <QuickAccessButton
          icon={<Bookmark className="w-4 h-4" />}
          label="Saved Views"
          onClick={() => onOpenPanel("saved-views")}
          isActive={activePanel === "saved-views"}
        />

        <QuickAccessButton
          icon={<Info className="w-4 h-4" />}
          label="Table Info"
          onClick={() => onOpenPanel("metadata")}
          isActive={activePanel === "metadata"}
        />
      </div>

      {/* Unsaved Changes Indicator */}
      {hasUnsavedChanges && (
        <>
          <div className="w-5 h-px bg-border my-2" />
          <div className="relative">
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full animate-pulse" />
            <span className="text-[10px] text-warning font-medium">!</span>
          </div>
        </>
      )}
    </motion.div>
  );
});

QuickAccessBar.displayName = "QuickAccessBar";
