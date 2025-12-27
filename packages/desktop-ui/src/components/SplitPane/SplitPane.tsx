import { useState, useCallback, useEffect, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { SplitHandle } from "./SplitHandle";

export type SplitDirection = "horizontal" | "vertical";

const STORAGE_KEY = "dbview-split-pane-size";

interface SplitPaneProps {
  direction: SplitDirection;
  firstPane: ReactNode;
  secondPane: ReactNode;
  defaultSize?: number; // Percentage for first pane (0-100)
  minSize?: number; // Minimum size in pixels
  onClose?: () => void;
  className?: string;
  persistKey?: string; // Optional key to persist size to localStorage
}

export function SplitPane({
  direction,
  firstPane,
  secondPane,
  defaultSize = 50,
  minSize = 300,
  className,
  persistKey,
}: SplitPaneProps) {
  // Load saved size from localStorage
  const getInitialSize = () => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(`${STORAGE_KEY}-${persistKey}`);
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            return parsed;
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    return defaultSize;
  };

  const [firstPaneSize, setFirstPaneSize] = useState(getInitialSize);

  // Persist size changes to localStorage
  useEffect(() => {
    if (persistKey) {
      try {
        localStorage.setItem(`${STORAGE_KEY}-${persistKey}`, String(firstPaneSize));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }, [firstPaneSize, persistKey]);

  const handleResize = useCallback(
    (delta: number) => {
      setFirstPaneSize((prev) => {
        // Get the container dimensions
        const container = document.querySelector("[data-split-container]");
        if (!container) return prev;

        const containerSize =
          direction === "horizontal"
            ? container.clientWidth
            : container.clientHeight;

        // Calculate new percentage based on pixel delta
        const deltaPercent = (delta / containerSize) * 100;
        const newSize = prev + deltaPercent;

        // Calculate minimum percentage based on minSize
        const minPercent = (minSize / containerSize) * 100;
        const maxPercent = 100 - minPercent;

        // Clamp the size
        return Math.max(minPercent, Math.min(maxPercent, newSize));
      });
    },
    [direction, minSize]
  );

  return (
    <div
      data-split-container
      className={cn(
        "flex h-full w-full overflow-hidden",
        direction === "horizontal" ? "flex-row" : "flex-col",
        className
      )}
    >
      {/* First Pane */}
      <div
        className="overflow-hidden"
        style={{
          [direction === "horizontal" ? "width" : "height"]: `${firstPaneSize}%`,
          flexShrink: 0,
        }}
      >
        {firstPane}
      </div>

      {/* Resize Handle */}
      <SplitHandle direction={direction} onResize={handleResize} />

      {/* Second Pane */}
      <div
        className="overflow-hidden flex-1"
        style={{
          [direction === "horizontal" ? "width" : "height"]: `${100 - firstPaneSize}%`,
        }}
      >
        {secondPane}
      </div>
    </div>
  );
}

// Export index
export { SplitHandle } from "./SplitHandle";
