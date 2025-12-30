/**
 * RedisHashView
 *
 * View component for Redis HASH type
 */

import { useState, useMemo, type FC } from "react";
import { RefreshCw, Copy, Search, X } from "lucide-react";
import clsx from "clsx";
import { ValuePreview } from "../ValuePreview";
import { copyToClipboard, truncate } from "../utils";
import { toast } from "sonner";
import type { HashField } from "../types";

interface RedisHashViewProps {
  keyName: string;
  fields: HashField[];
  loading: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export const RedisHashView: FC<RedisHashViewProps> = ({
  keyName,
  fields,
  loading,
  isReadOnly,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedField, setSelectedField] = useState<string | null>(null);

  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return fields;
    const query = searchQuery.toLowerCase();
    return fields.filter(
      (f) =>
        f.field.toLowerCase().includes(query) ||
        f.value.toLowerCase().includes(query)
    );
  }, [fields, searchQuery]);

  const selectedFieldData = useMemo(() => {
    if (!selectedField) return null;
    return fields.find((f) => f.field === selectedField);
  }, [fields, selectedField]);

  const handleCopyField = async (field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(field);
    if (success) {
      toast.success("Field name copied");
    }
  };

  const handleCopyValue = async (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(value);
    if (success) {
      toast.success("Value copied");
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
          <span className="text-sm text-vscode-text-muted">Hash Fields</span>
          <span className="text-xs text-vscode-text-muted">
            ({fields.length.toLocaleString()} fields)
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-vscode-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields..."
            className="w-full pl-8 pr-8 py-1.5 bg-vscode-bg border border-vscode-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-vscode-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Fields list */}
        <div className="w-1/2 border-r border-vscode-border overflow-auto">
          {filteredFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-vscode-text-muted text-sm">
              {searchQuery ? (
                <>
                  <p>No matching fields</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-vscode-accent hover:underline"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <p>No fields in hash</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-vscode-border">
              {filteredFields.map((field) => (
                <button
                  key={field.field}
                  onClick={() => setSelectedField(field.field)}
                  className={clsx(
                    "w-full px-3 py-2 text-left transition-colors group",
                    selectedField === field.field
                      ? "bg-vscode-accent/10 border-l-2 border-vscode-accent"
                      : "hover:bg-vscode-bg-hover border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={clsx(
                        "text-sm font-mono truncate",
                        selectedField === field.field
                          ? "text-vscode-accent"
                          : "text-vscode-text"
                      )}
                    >
                      {field.field}
                    </span>
                    <button
                      onClick={(e) => handleCopyField(field.field, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-vscode-bg text-vscode-text-muted hover:text-vscode-text transition-all"
                      title="Copy field name"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-vscode-text-muted truncate mt-0.5">
                    {truncate(field.value, 50)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Value preview */}
        <div className="w-1/2 overflow-auto p-4">
          {selectedFieldData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-vscode-accent">
                  {selectedFieldData.field}
                </span>
                <button
                  onClick={(e) => handleCopyValue(selectedFieldData.value, e)}
                  className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
                  title="Copy value"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <ValuePreview value={selectedFieldData.value} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-vscode-text-muted text-sm">
              Select a field to view its value
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RedisHashView;
