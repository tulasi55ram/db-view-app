import { useState, useMemo, type FC } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { tryParseJson, truncateJson } from "@/utils/jsonUtils";
import { Popover, PopoverTrigger, PopoverContent } from "@/primitives/Popover";
import { JsonTreeRenderer } from "./JsonTreeRenderer";
import { toast } from "sonner";

interface JsonCellViewerProps {
  value: unknown;
  maxHeight?: number;
  className?: string;
}

/**
 * Cell viewer with JSON tree expansion popover
 */
export const JsonCellViewer: FC<JsonCellViewerProps> = ({
  value,
  maxHeight = 300,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isJson } = useMemo(() => tryParseJson(value), [value]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = isJson ? JSON.stringify(data, null, 2) : String(value);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // If not JSON, just render the value normally
  if (!isJson) {
    return <span className={className}>{formatCellValue(value)}</span>;
  }

  const preview = truncateJson(data, 40);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 text-left hover:text-accent transition-colors",
            "max-w-full",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          <span className="truncate font-mono text-xs">{preview}</span>
          <ChevronRight
            className={cn(
              "w-3 h-3 flex-shrink-0 transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-96 p-0"
        sideOffset={4}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary">
          <span className="text-xs font-medium text-text-secondary">JSON Preview</span>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-bg-hover transition-colors"
            title="Copy JSON"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-text-tertiary hover:text-text-primary" />
            )}
          </button>
        </div>

        {/* Tree Content */}
        <div
          className="p-3 overflow-auto font-mono text-xs"
          style={{ maxHeight }}
        >
          <JsonTreeRenderer data={data} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Format cell value for display
 */
function formatCellValue(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  return String(value);
}

/**
 * Cell value component that auto-detects JSON and wraps with viewer
 */
interface CellValueProps {
  value: unknown;
  className?: string;
}

export const CellValue: FC<CellValueProps> = ({ value, className }) => {
  const { isJson } = useMemo(() => tryParseJson(value), [value]);

  if (isJson) {
    return <JsonCellViewer value={value} className={className} />;
  }

  return (
    <span className={cn(getValueClassName(value), className)}>
      {formatCellValue(value)}
    </span>
  );
};

/**
 * Get CSS class for value type
 */
function getValueClassName(value: unknown): string {
  if (value === null) return "text-text-tertiary italic";
  if (typeof value === "number") return "text-info font-mono";
  if (typeof value === "boolean") return "text-warning";
  if (typeof value === "string") return "text-text-primary";
  return "text-text-secondary";
}
