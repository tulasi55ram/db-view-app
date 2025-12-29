import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[80px] px-3 py-2 rounded bg-bg-tertiary border text-sm",
          "placeholder:text-text-tertiary font-mono",
          "transition-colors duration-fast resize-y",
          "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error
            ? "border-error focus:ring-error focus:border-error"
            : "border-border hover:border-neutral-600",
          className
        )}
        {...props}
      />
    );
  }
);

TextArea.displayName = "TextArea";
