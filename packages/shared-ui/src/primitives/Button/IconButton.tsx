import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

type IconButtonSize = "sm" | "md" | "lg";
type IconButtonVariant = "ghost" | "secondary";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  "aria-label": string;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: "w-6 h-6",
  md: "w-7 h-7",
  lg: "w-8 h-8",
};

const variantStyles: Record<IconButtonVariant, string> = {
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active",
  secondary:
    "text-text-secondary hover:text-text-primary bg-neutral-750 hover:bg-neutral-700 border border-border",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, size = "md", variant = "ghost", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded",
          "transition-colors duration-fast",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
