import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { X } from "lucide-react";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

interface PopoverContentProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  alignOffset?: number;
  showArrow?: boolean;
  showClose?: boolean;
  onClose?: () => void;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    {
      children,
      className,
      align = "center",
      side = "bottom",
      sideOffset = 8,
      alignOffset = 0,
      showArrow = false,
      showClose = false,
      onClose,
    },
    ref
  ) => {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          side={side}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          className={cn(
            "z-50 bg-bg-secondary border border-border rounded-lg shadow-panel",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            "focus:outline-none",
            className
          )}
        >
          {showClose && (
            <PopoverPrimitive.Close
              onClick={onClose}
              className={cn(
                "absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded",
                "text-text-tertiary hover:text-text-primary",
                "hover:bg-bg-hover transition-colors z-10"
              )}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </PopoverPrimitive.Close>
          )}
          {children}
          {showArrow && (
            <PopoverPrimitive.Arrow className="fill-bg-secondary stroke-border stroke-1" />
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    );
  }
);

PopoverContent.displayName = "PopoverContent";
