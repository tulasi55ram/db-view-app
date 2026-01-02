/**
 * SidePanel - Reusable wrapper component for side panels
 *
 * Provides:
 * - Header with title, subtitle, and close button
 * - Scrollable content area
 * - Optional footer for action buttons
 * - Keyboard shortcuts (Escape to close)
 * - Smooth animations via framer-motion
 */

import { useEffect, useRef, type FC, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import clsx from "clsx";
import type { SidePanelProps } from "./types";

export const SidePanel: FC<SidePanelProps> = ({
  title,
  subtitle,
  icon,
  children,
  footer,
  onClose,
  className,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus trap - focus the panel when it opens
  useEffect(() => {
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
  }, []);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={clsx(
        "h-full flex flex-col bg-bg-primary",
        "border-l border-border",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary/50">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="flex-shrink-0 text-accent">{icon}</span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className={clsx(
            "flex-shrink-0 p-1.5 rounded-md",
            "text-text-secondary hover:text-text-primary",
            "hover:bg-bg-hover transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-accent/50"
          )}
          title="Close panel (Esc)"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* Footer - Fixed at bottom */}
      {footer && (
        <div className="flex-shrink-0 border-t border-border bg-bg-secondary/50 px-4 py-3">
          {footer}
        </div>
      )}
    </motion.div>
  );
};

/**
 * SidePanelSection - Helper component for organizing panel content into sections
 */
interface SidePanelSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export const SidePanelSection: FC<SidePanelSectionProps> = ({
  title,
  children,
  className,
}) => (
  <div className={clsx("px-4 py-3", className)}>
    {title && (
      <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
        {title}
      </h3>
    )}
    {children}
  </div>
);

/**
 * SidePanelFooter - Pre-styled footer with common button layout
 */
interface SidePanelFooterProps {
  children: ReactNode;
  className?: string;
}

export const SidePanelFooter: FC<SidePanelFooterProps> = ({
  children,
  className,
}) => (
  <div className={clsx("flex items-center justify-end gap-2", className)}>
    {children}
  </div>
);
