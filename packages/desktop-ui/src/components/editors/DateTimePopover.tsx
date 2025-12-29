import { useState, useCallback, useRef, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { Clock, X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/primitives/Popover";
import { cn } from "@/utils/cn";

interface DateTimePopoverProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  columnName: string;
  columnType: string;
  anchorRect?: DOMRect | null;
}

// Common date formats to try when parsing
const PARSE_FORMATS = [
  "yyyy-MM-dd'T'HH:mm:ss.SSSX",
  "yyyy-MM-dd'T'HH:mm:ss.SSS",
  "yyyy-MM-dd'T'HH:mm:ssX",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd",
  "HH:mm:ss",
  "HH:mm",
];

export function DateTimePopover({
  open,
  onClose,
  value,
  onChange,
  columnName,
  columnType,
  anchorRect,
}: DateTimePopoverProps) {
  const lowerType = columnType.toLowerCase();
  const isDateOnly = lowerType === "date";
  const isTimeOnly = lowerType.includes("time") && !lowerType.includes("timestamp");
  const hasTimezone = lowerType.includes("tz") || lowerType.includes("timezone");

  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState(value || "");
  const [isNull, setIsNull] = useState(value?.toUpperCase() === "NULL");
  const [error, setError] = useState<string | null>(null);

  // Reset state when opened and auto-focus
  useEffect(() => {
    if (open) {
      setInputValue(value || "");
      setIsNull(value?.toUpperCase() === "NULL");
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, value]);

  // Parse and validate input
  const parseInput = useCallback((input: string): Date | null => {
    if (!input || input.toUpperCase() === "NULL") return null;

    for (const fmt of PARSE_FORMATS) {
      try {
        const parsed = parse(input, fmt, new Date());
        if (isValid(parsed)) return parsed;
      } catch {
        continue;
      }
    }

    const nativeParsed = new Date(input);
    if (isValid(nativeParsed)) return nativeParsed;

    return null;
  }, []);

  // Get format string for output
  const getOutputFormat = useCallback(() => {
    if (isDateOnly) return "yyyy-MM-dd";
    if (isTimeOnly) return "HH:mm:ss";
    if (hasTimezone) return "yyyy-MM-dd'T'HH:mm:ssxxx";
    return "yyyy-MM-dd'T'HH:mm:ss";
  }, [isDateOnly, isTimeOnly, hasTimezone]);

  // Validate input as user types
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsNull(false);

    if (newValue && newValue.toUpperCase() !== "NULL") {
      const parsed = parseInput(newValue);
      setError(parsed ? null : "Invalid format");
    } else {
      setError(null);
    }
  }, [parseInput]);

  // Set to current time
  const handleSetNow = useCallback(() => {
    const now = new Date();
    const formatted = format(now, getOutputFormat());
    setInputValue(formatted);
    setIsNull(false);
    setError(null);
    inputRef.current?.focus();
  }, [getOutputFormat]);

  // Save handler
  const handleSave = useCallback(() => {
    if (isNull) {
      onChange("NULL");
      onClose();
      return;
    }

    if (error) return;

    if (!inputValue.trim()) {
      onChange("NULL");
      onClose();
      return;
    }

    const parsed = parseInput(inputValue);
    if (parsed) {
      const formatted = format(parsed, getOutputFormat());
      onChange(formatted);
    } else {
      onChange(inputValue);
    }
    onClose();
  }, [isNull, error, inputValue, parseInput, getOutputFormat, onChange, onClose]);

  // Get placeholder text
  const getPlaceholder = () => {
    if (isDateOnly) return "yyyy-MM-dd";
    if (isTimeOnly) return "HH:mm:ss";
    return "yyyy-MM-dd HH:mm:ss";
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          style={{
            position: "fixed",
            left: anchorRect ? anchorRect.left + anchorRect.width / 2 : "50%",
            top: anchorRect ? anchorRect.bottom : "50%",
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </PopoverAnchor>

      <PopoverContent
        className="w-[280px] p-0 shadow-lg border-border"
        side="bottom"
        align="center"
        sideOffset={4}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary rounded-t-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <span className="text-xs font-medium text-text-primary truncate">{columnName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover transition-colors text-text-tertiary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            tabIndex={-1}
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Main Input Row */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={isNull ? "" : inputValue}
              onChange={handleInputChange}
              disabled={isNull}
              placeholder={isNull ? "NULL" : getPlaceholder()}
              className={cn(
                "flex-1 px-2.5 py-2 bg-bg-primary border rounded text-sm font-mono text-text-primary",
                "placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50",
                "disabled:bg-bg-tertiary disabled:text-text-tertiary disabled:cursor-not-allowed",
                error ? "border-error focus:ring-error/50" : "border-border"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !error) {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
            <button
              onClick={handleSetNow}
              disabled={isNull}
              className={cn(
                "px-2.5 py-2 rounded text-xs font-medium transition-colors whitespace-nowrap",
                "bg-accent/10 hover:bg-accent/20 text-accent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus:outline-none focus:ring-2 focus:ring-accent/50"
              )}
              title="Insert current timestamp"
            >
              Now
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-[10px] text-error px-0.5">{error}</p>
          )}

          {/* Footer Row */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={isNull}
                onChange={(e) => {
                  setIsNull(e.target.checked);
                  if (e.target.checked) {
                    setInputValue("");
                    setError(null);
                  } else {
                    setTimeout(() => {
                      inputRef.current?.focus();
                      inputRef.current?.select();
                    }, 10);
                  }
                }}
                className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/50"
              />
              <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                NULL
              </span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary hidden sm:block">
                Enter / Esc
              </span>
              <button
                onClick={handleSave}
                disabled={!!error}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  "bg-accent hover:bg-accent/90 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-1",
                  "flex items-center gap-1"
                )}
              >
                <Check className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
