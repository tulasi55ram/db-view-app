/**
 * RedisStringView
 *
 * View component for Redis STRING type
 */

import { type FC } from "react";
import { RefreshCw, Copy } from "lucide-react";
import clsx from "clsx";
import { ValuePreview } from "../ValuePreview";
import { copyToClipboard } from "../utils";
import { toast } from "sonner";

interface RedisStringViewProps {
  keyName: string;
  value: string | null;
  loading: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export const RedisStringView: FC<RedisStringViewProps> = ({
  keyName,
  value,
  loading,
  isReadOnly,
  onRefresh,
}) => {
  const handleCopy = async () => {
    if (value) {
      const success = await copyToClipboard(value);
      if (success) {
        toast.success("Value copied to clipboard");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-vscode-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-vscode-border bg-vscode-bg-light flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-vscode-text-muted">String Value</span>
          {value && (
            <span className="text-xs text-vscode-text-muted">
              ({value.length.toLocaleString()} characters)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Copy value"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Value display */}
      <div className="flex-1 overflow-auto p-4">
        {value === null ? (
          <div className="text-vscode-text-muted italic">Key does not exist or has no value</div>
        ) : (
          <ValuePreview value={value} className="h-full" />
        )}
      </div>
    </div>
  );
};

export default RedisStringView;
