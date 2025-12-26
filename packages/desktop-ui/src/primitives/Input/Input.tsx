import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftElement, rightElement, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {leftElement && (
          <div className="absolute left-2 flex items-center text-text-tertiary">
            {leftElement}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full h-8 px-3 rounded bg-bg-tertiary border text-sm",
            "placeholder:text-text-tertiary",
            "transition-colors duration-fast",
            "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-error focus:ring-error focus:border-error"
              : "border-border hover:border-neutral-600",
            leftElement && "pl-8",
            rightElement && "pr-8",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-2 flex items-center text-text-tertiary">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
