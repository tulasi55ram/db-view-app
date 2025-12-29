import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { forwardRef, type ReactNode } from "react";
import { motion } from "framer-motion";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  showClose?: boolean;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ children, className, title, description, showClose = true }, ref) => {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content ref={ref} asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
            }}
            className={cn(
              "z-50 w-full max-w-lg max-h-[85vh] overflow-hidden",
              "bg-bg-secondary border border-border rounded-lg shadow-panel",
              "focus:outline-none",
              className
            )}
          >
            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div>
                  {title && (
                    <DialogPrimitive.Title className="text-sm font-medium text-text-primary">
                      {title}
                    </DialogPrimitive.Title>
                  )}
                  {description && (
                    <DialogPrimitive.Description className="text-xs text-text-secondary mt-0.5">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>
                {showClose && (
                  <DialogPrimitive.Close asChild>
                    <button
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded",
                        "text-text-tertiary hover:text-text-primary",
                        "hover:bg-bg-hover transition-colors"
                      )}
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </DialogPrimitive.Close>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-4 flex-1 min-h-0 overflow-auto flex flex-col">{children}</div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);

DialogContent.displayName = "DialogContent";

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border flex-shrink-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export const DialogClose = DialogPrimitive.Close;
