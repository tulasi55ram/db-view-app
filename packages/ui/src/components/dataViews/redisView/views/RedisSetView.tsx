/**
 * RedisSetView
 *
 * View component for Redis SET type
 */

import { useState, useMemo, type FC } from "react";
import { RefreshCw, Copy, Search, X } from "lucide-react";
import clsx from "clsx";
import { ValuePreview } from "../ValuePreview";
import { copyToClipboard, truncate } from "../utils";
import { toast } from "sonner";
import type { SetMember } from "../types";

interface RedisSetViewProps {
  keyName: string;
  members: SetMember[];
  totalCount: number;
  loading: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export const RedisSetView: FC<RedisSetViewProps> = ({
  keyName,
  members,
  totalCount,
  loading,
  isReadOnly,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter((m) => m.value.toLowerCase().includes(query));
  }, [members, searchQuery]);

  const selectedMemberData = useMemo(() => {
    if (!selectedMember) return null;
    return members.find((m) => m.value === selectedMember);
  }, [members, selectedMember]);

  const handleCopyValue = async (value: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
          <span className="text-sm text-vscode-text-muted">Set Members</span>
          <span className="text-xs text-vscode-text-muted">
            ({totalCount.toLocaleString()} members)
          </span>
          {members.length < totalCount && (
            <span className="text-xs text-vscode-warning">
              (showing {members.length})
            </span>
          )}
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
            placeholder="Search members..."
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
        {/* Members list */}
        <div className="w-1/2 border-r border-vscode-border overflow-auto">
          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-vscode-text-muted text-sm">
              {searchQuery ? (
                <>
                  <p>No matching members</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-vscode-accent hover:underline"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <p>Empty set</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-vscode-border">
              {filteredMembers.map((member, idx) => (
                <button
                  key={`${member.value}-${idx}`}
                  onClick={() => setSelectedMember(member.value)}
                  className={clsx(
                    "w-full px-3 py-2 text-left transition-colors group",
                    selectedMember === member.value
                      ? "bg-vscode-accent/10 border-l-2 border-vscode-accent"
                      : "hover:bg-vscode-bg-hover border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={clsx(
                        "text-sm font-mono truncate",
                        selectedMember === member.value
                          ? "text-vscode-accent"
                          : "text-vscode-text"
                      )}
                    >
                      {truncate(member.value, 50)}
                    </span>
                    <button
                      onClick={(e) => handleCopyValue(member.value, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-vscode-bg text-vscode-text-muted hover:text-vscode-text transition-all flex-shrink-0"
                      title="Copy value"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Value preview */}
        <div className="w-1/2 overflow-auto p-4">
          {selectedMemberData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-vscode-text-muted">Member Value</span>
                <button
                  onClick={() => handleCopyValue(selectedMemberData.value)}
                  className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
                  title="Copy value"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <ValuePreview value={selectedMemberData.value} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-vscode-text-muted text-sm">
              Select a member to view its value
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RedisSetView;
