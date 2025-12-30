/**
 * ValuePreview
 *
 * Component for displaying Redis values with format detection
 * (JSON, text, hex) and syntax highlighting.
 */

import { useState, useMemo, type FC, type ReactNode } from "react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { parseValue, copyToClipboard } from "./utils";
import { toast } from "sonner";

interface ValuePreviewProps {
  value: unknown;
  maxHeight?: number;
  className?: string;
  showFormatBadge?: boolean;
}

export const ValuePreview: FC<ValuePreviewProps> = ({
  value,
  maxHeight = 300,
  className,
  showFormatBadge = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => parseValue(value), [value]);

  const handleCopy = async () => {
    const success = await copyToClipboard(parsed.raw);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    }
  };

  // Render JSON tree for expanded view
  const renderJsonTree = (data: unknown, depth = 0): ReactNode => {
    if (data === null) return <span className="text-vscode-text-muted">null</span>;
    if (data === undefined) return <span className="text-vscode-text-muted">undefined</span>;

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
      if (data.length === 0) return <span className="text-vscode-text-muted">[]</span>;
      return (
        <div className="pl-4">
          <span className="text-vscode-text-muted">[</span>
          {data.map((item, idx) => (
            <div key={idx} className="flex">
              <span className="text-vscode-text-muted mr-2">{idx}:</span>
              {renderJsonTree(item, depth + 1)}
              {idx < data.length - 1 && <span className="text-vscode-text-muted">,</span>}
            </div>
          ))}
          <span className="text-vscode-text-muted">]</span>
        </div>
      );
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length === 0) return <span className="text-vscode-text-muted">{'{}'}</span>;
      return (
        <div className="pl-4">
          <span className="text-vscode-text-muted">{'{'}</span>
          {entries.map(([key, val], idx) => (
            <div key={key} className="flex">
              <span className="text-orange-500">"{key}"</span>
              <span className="text-vscode-text-muted mx-1">:</span>
              {renderJsonTree(val, depth + 1)}
              {idx < entries.length - 1 && <span className="text-vscode-text-muted">,</span>}
            </div>
          ))}
          <span className="text-vscode-text-muted">{'}'}</span>
        </div>
      );
    }

    return <span>{String(data)}</span>;
  };

  return (
    <div className={clsx("relative group", className)}>
      {/* Format Badge & Actions */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {showFormatBadge && (
          <span className={clsx(
            "px-1.5 py-0.5 rounded text-xs font-medium",
            parsed.isJson ? "bg-blue-500/15 text-blue-500" : "bg-vscode-bg text-vscode-text-muted"
          )}>
            {parsed.isJson ? "JSON" : parsed.format.toUpperCase()}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded bg-vscode-bg hover:bg-vscode-bg-hover transition-colors"
          title="Copy value"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-vscode-text-muted" />
          )}
        </button>
      </div>

      {/* Value Display */}
      <div
        className={clsx(
          "bg-vscode-bg border border-vscode-border rounded-md overflow-hidden",
          parsed.isJson && "cursor-pointer"
        )}
        style={{ maxHeight: isExpanded ? 'none' : maxHeight }}
        onClick={() => parsed.isJson && setIsExpanded(!isExpanded)}
      >
        {parsed.isJson && parsed.jsonParsed ? (
          <div className="p-3">
            {/* Collapse/Expand Toggle */}
            <div className="flex items-center gap-1 mb-2 text-vscode-text-muted text-xs">
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
                <code className="text-vscode-text">{parsed.formatted}</code>
              )}
            </pre>
          </div>
        ) : (
          <pre className="p-3 font-mono text-sm text-vscode-text whitespace-pre-wrap break-all">
            {parsed.formatted || <span className="text-vscode-text-muted italic">(empty)</span>}
          </pre>
        )}
      </div>

      {/* Truncation Indicator */}
      {!isExpanded && parsed.raw.length > 500 && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-vscode-bg to-transparent pointer-events-none" />
      )}
    </div>
  );
};

export default ValuePreview;
