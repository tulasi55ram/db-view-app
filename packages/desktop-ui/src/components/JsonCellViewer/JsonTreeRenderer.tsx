import { useState, type FC } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface JsonTreeRendererProps {
  data: unknown;
  depth?: number;
  maxDepth?: number;
  initialExpanded?: boolean;
}

/**
 * Recursive JSON tree renderer with expand/collapse functionality
 */
export const JsonTreeRenderer: FC<JsonTreeRendererProps> = ({
  data,
  depth = 0,
  maxDepth = 10,
  initialExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded && depth < 2);

  // Prevent infinite recursion
  if (depth > maxDepth) {
    return <span className="text-text-tertiary">...</span>;
  }

  // Handle null
  if (data === null) {
    return <span className="text-text-tertiary italic">null</span>;
  }

  // Handle undefined
  if (data === undefined) {
    return <span className="text-text-tertiary italic">undefined</span>;
  }

  // Handle strings
  if (typeof data === "string") {
    return <span className="text-green-500">&quot;{data}&quot;</span>;
  }

  // Handle numbers
  if (typeof data === "number") {
    return <span className="text-blue-500">{data}</span>;
  }

  // Handle booleans
  if (typeof data === "boolean") {
    return <span className="text-purple-500">{String(data)}</span>;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-text-tertiary">[]</span>;
    }

    return (
      <div className="inline">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="inline-flex items-center gap-0.5 hover:bg-bg-hover rounded px-0.5 -ml-0.5"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-text-tertiary" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-tertiary" />
          )}
          <span className="text-text-tertiary">[</span>
          {!isExpanded && (
            <span className="text-text-tertiary text-xs ml-1">{data.length} items</span>
          )}
        </button>
        {isExpanded && (
          <div className="pl-4 border-l border-border/50 ml-1">
            {data.map((item, idx) => (
              <div key={idx} className="flex items-start">
                <span className="text-text-tertiary mr-2 select-none">{idx}:</span>
                <JsonTreeRenderer data={item} depth={depth + 1} maxDepth={maxDepth} />
                {idx < data.length - 1 && <span className="text-text-tertiary">,</span>}
              </div>
            ))}
          </div>
        )}
        {isExpanded && <span className="text-text-tertiary">]</span>}
        {!isExpanded && <span className="text-text-tertiary">]</span>}
      </div>
    );
  }

  // Handle objects
  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <span className="text-text-tertiary">{"{}"}</span>;
    }

    return (
      <div className="inline">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="inline-flex items-center gap-0.5 hover:bg-bg-hover rounded px-0.5 -ml-0.5"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-text-tertiary" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-tertiary" />
          )}
          <span className="text-text-tertiary">{"{"}</span>
          {!isExpanded && (
            <span className="text-text-tertiary text-xs ml-1">{entries.length} keys</span>
          )}
        </button>
        {isExpanded && (
          <div className="pl-4 border-l border-border/50 ml-1">
            {entries.map(([key, val], idx) => (
              <div key={key} className="flex items-start">
                <span className="text-orange-500 mr-1">&quot;{key}&quot;</span>
                <span className="text-text-tertiary mr-1">:</span>
                <JsonTreeRenderer data={val} depth={depth + 1} maxDepth={maxDepth} />
                {idx < entries.length - 1 && <span className="text-text-tertiary">,</span>}
              </div>
            ))}
          </div>
        )}
        {isExpanded && <span className="text-text-tertiary">{"}"}</span>}
        {!isExpanded && <span className="text-text-tertiary">{"}"}</span>}
      </div>
    );
  }

  // Fallback for other types
  return <span className="text-text-primary">{String(data)}</span>;
};
