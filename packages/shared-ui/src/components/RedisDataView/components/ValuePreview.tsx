import { useState, useMemo } from "react";
import { Copy, Check, ChevronDown, ChevronRight, Code } from "lucide-react";
import { cn } from "@/utils/cn";
import { parseValue, copyToClipboard } from "../utils";
import { toast } from "sonner";

interface ValuePreviewProps {
  value: unknown;
  maxHeight?: number;
  className?: string;
  showFormatBadge?: boolean;
  onEdit?: (newValue: string) => void;
  editable?: boolean;
}

export function ValuePreview({
  value,
  maxHeight = 300,
  className,
  showFormatBadge = true,
  onEdit,
  editable = false,
}: ValuePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const parsed = useMemo(() => parseValue(value), [value]);

  const handleCopy = async () => {
    const success = await copyToClipboard(parsed.raw);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    }
  };

  const handleStartEdit = () => {
    setEditValue(parsed.raw);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit(editValue);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  // Render JSON tree for expanded view
  const renderJsonTree = (data: unknown, depth = 0): JSX.Element => {
    if (data === null) return <span className="text-text-tertiary">null</span>;
    if (data === undefined) return <span className="text-text-tertiary">undefined</span>;

    if (typeof data === 'string') {
      return <span className="text-green-500">"{data}"</span>;
    }
    if (typeof data === 'number') {
      return <span className="text-blue-500">{data}</span>;
    }
    if (typeof data === 'boolean') {
      return <span className="text-purple-500">{String(data)}</span>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return <span className="text-text-tertiary">[]</span>;
      return (
        <div className="pl-4">
          <span className="text-text-tertiary">[</span>
          {data.map((item, idx) => (
            <div key={idx} className="flex">
              <span className="text-text-tertiary mr-2">{idx}:</span>
              {renderJsonTree(item, depth + 1)}
              {idx < data.length - 1 && <span className="text-text-tertiary">,</span>}
            </div>
          ))}
          <span className="text-text-tertiary">]</span>
        </div>
      );
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length === 0) return <span className="text-text-tertiary">{'{}'}</span>;
      return (
        <div className="pl-4">
          <span className="text-text-tertiary">{'{'}</span>
          {entries.map(([key, val], idx) => (
            <div key={key} className="flex">
              <span className="text-orange-500">"{key}"</span>
              <span className="text-text-tertiary mx-1">:</span>
              {renderJsonTree(val, depth + 1)}
              {idx < entries.length - 1 && <span className="text-text-tertiary">,</span>}
            </div>
          ))}
          <span className="text-text-tertiary">{'}'}</span>
        </div>
      );
    }

    return <span>{String(data)}</span>;
  };

  if (isEditing) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full h-32 px-3 py-2 bg-bg-primary border border-border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            className="px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative group", className)}>
      {/* Format Badge & Actions */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {showFormatBadge && (
          <span className={cn(
            "px-1.5 py-0.5 rounded text-xs font-medium",
            parsed.isJson ? "bg-blue-500/15 text-blue-500" : "bg-bg-tertiary text-text-tertiary"
          )}>
            {parsed.isJson ? "JSON" : parsed.format.toUpperCase()}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded bg-bg-tertiary hover:bg-bg-hover transition-colors"
          title="Copy value"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-text-secondary" />
          )}
        </button>
        {editable && onEdit && (
          <button
            onClick={handleStartEdit}
            className="p-1 rounded bg-bg-tertiary hover:bg-bg-hover transition-colors"
            title="Edit value"
          >
            <Code className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        )}
      </div>

      {/* Value Display */}
      <div
        className={cn(
          "bg-bg-primary border border-border rounded-md overflow-hidden",
          parsed.isJson && "cursor-pointer"
        )}
        style={{ maxHeight: isExpanded ? 'none' : maxHeight }}
        onClick={() => parsed.isJson && setIsExpanded(!isExpanded)}
      >
        {parsed.isJson && parsed.jsonParsed ? (
          <div className="p-3">
            {/* Collapse/Expand Toggle */}
            <div className="flex items-center gap-1 mb-2 text-text-secondary text-xs">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>{isExpanded ? 'Click to collapse' : 'Click to expand'}</span>
            </div>

            {/* JSON Content */}
            <pre className="font-mono text-sm overflow-x-auto">
              {isExpanded ? (
                renderJsonTree(parsed.jsonParsed)
              ) : (
                <code className="text-text-primary">{parsed.formatted}</code>
              )}
            </pre>
          </div>
        ) : (
          <pre className="p-3 font-mono text-sm text-text-primary whitespace-pre-wrap break-all">
            {parsed.formatted || <span className="text-text-tertiary italic">(empty)</span>}
          </pre>
        )}
      </div>

      {/* Truncation Indicator */}
      {!isExpanded && parsed.raw.length > 500 && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
      )}
    </div>
  );
}
