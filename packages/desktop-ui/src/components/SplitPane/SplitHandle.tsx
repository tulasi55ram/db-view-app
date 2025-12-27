import { useCallback, useRef, useEffect } from "react";
import { cn } from "@/utils/cn";

interface SplitHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

export function SplitHandle({ direction, onResize, onResizeEnd }: SplitHandleProps) {
  const isDraggingRef = useRef(false);
  const lastPositionRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      lastPositionRef.current = direction === "horizontal" ? e.clientX : e.clientY;
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const currentPosition = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPosition - lastPositionRef.current;
      lastPositionRef.current = currentPosition;

      onResize(delta);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd?.();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, onResize, onResizeEnd]);

  return (
    <div
      className={cn(
        "flex-shrink-0 bg-border hover:bg-accent/50 transition-colors",
        "relative group",
        direction === "horizontal"
          ? "w-1 cursor-col-resize hover:w-1.5"
          : "h-1 cursor-row-resize hover:h-1.5"
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Visual indicator on hover */}
      <div
        className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-opacity",
          "bg-accent/30",
          direction === "horizontal"
            ? "inset-y-0 -left-1 -right-1"
            : "inset-x-0 -top-1 -bottom-1"
        )}
      />
    </div>
  );
}
