/**
 * RedisRawView
 *
 * View component for unknown Redis types, RedisJSON, and fallback display
 * Shows raw data, debug info, and JSON when available
 */

import { type FC } from "react";
import { RefreshCw, Copy, AlertCircle, Code, FileJson } from "lucide-react";
import clsx from "clsx";
import { ValuePreview } from "../ValuePreview";
import { copyToClipboard } from "../utils";
import { toast } from "sonner";

interface RedisRawViewProps {
  keyName: string;
  keyType: string;
  rawValue?: string | null;
  jsonValue?: unknown;
  debugInfo?: string;
  encoding?: string;
  dumpHex?: string;
  loading: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export const RedisRawView: FC<RedisRawViewProps> = ({
  keyName,
  keyType,
  rawValue,
  jsonValue,
  debugInfo,
  encoding,
  dumpHex,
  loading,
  isReadOnly,
  onRefresh,
}) => {
  const handleCopy = async (value: string) => {
    const success = await copyToClipboard(value);
    if (success) {
      toast.success("Copied to clipboard");
    }
  };

  const isJsonType = keyType.toLowerCase().includes('json') || keyType === 'ReJSON-RL';
  const hasData = rawValue || jsonValue || dumpHex;

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
          {isJsonType ? (
            <FileJson className="w-4 h-4 text-orange-500" />
          ) : (
            <Code className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm text-vscode-text-muted">
            {isJsonType ? "JSON Value" : `Raw Value (${keyType})`}
          </span>
          {encoding && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-vscode-bg text-vscode-text-muted">
              encoding: {encoding}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasData && (
            <button
              onClick={() => handleCopy(jsonValue ? JSON.stringify(jsonValue, null, 2) : (rawValue || dumpHex || ''))}
              className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
              title="Copy value"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted">
            <AlertCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Unable to retrieve value</p>
            <p className="text-xs mt-1">
              Type "{keyType}" may require special handling or a Redis module
            </p>
            {debugInfo && (
              <div className="mt-4 p-3 bg-vscode-bg rounded-lg text-xs font-mono max-w-lg">
                <p className="text-vscode-text-muted mb-1">Debug Info:</p>
                <p className="text-vscode-text break-all">{debugInfo}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* JSON Value (for RedisJSON) */}
            {jsonValue && (
              <div>
                <h4 className="text-xs font-medium text-vscode-text-muted mb-2 uppercase tracking-wide">
                  JSON Value
                </h4>
                <ValuePreview value={JSON.stringify(jsonValue, null, 2)} className="h-full" />
              </div>
            )}

            {/* Raw Value */}
            {rawValue && !jsonValue && (
              <div>
                <h4 className="text-xs font-medium text-vscode-text-muted mb-2 uppercase tracking-wide">
                  Value
                </h4>
                <ValuePreview value={rawValue} className="h-full" />
              </div>
            )}

            {/* Dump Hex (fallback for binary data) */}
            {dumpHex && !rawValue && !jsonValue && (
              <div>
                <h4 className="text-xs font-medium text-vscode-text-muted mb-2 uppercase tracking-wide">
                  Serialized Data (Hex)
                </h4>
                <div className="p-3 bg-vscode-bg rounded-lg overflow-auto">
                  <pre className="text-xs font-mono text-vscode-text break-all whitespace-pre-wrap">
                    {dumpHex}
                  </pre>
                </div>
              </div>
            )}

            {/* Debug Info */}
            {debugInfo && (
              <div>
                <h4 className="text-xs font-medium text-vscode-text-muted mb-2 uppercase tracking-wide">
                  Debug Info
                </h4>
                <div className="p-3 bg-vscode-bg rounded-lg">
                  <pre className="text-xs font-mono text-vscode-text-muted break-all whitespace-pre-wrap">
                    {debugInfo}
                  </pre>
                </div>
              </div>
            )}

            {/* Type Info Banner */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-yellow-600">
                    {isJsonType ? "RedisJSON Module" : "Unknown/Special Type"}
                  </p>
                  <p className="text-vscode-text-muted mt-1">
                    {isJsonType
                      ? "This key uses the RedisJSON module for native JSON support."
                      : `Type "${keyType}" may be a module type or use special encoding. Some operations may not be available.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedisRawView;
