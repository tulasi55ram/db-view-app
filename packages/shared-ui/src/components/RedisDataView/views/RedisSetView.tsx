import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Plus, Trash2, Search, Copy, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import { ValuePreview } from "../components/ValuePreview";
import { copyToClipboard, parseValue } from "../utils";

interface RedisSetViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  keyName: string;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export function RedisSetView({
  connectionKey,
  keyName,
  isReadOnly,
}: RedisSetViewProps) {
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [checkMember, setCheckMember] = useState('');
  const [checkResult, setCheckResult] = useState<boolean | null>(null);

  const api = getElectronAPI();

  const loadMembers = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      const result = await api.runQuery({
        connectionKey,
        sql: `SMEMBERS ${keyName}`,
      });

      const parsedMembers: string[] = [];
      if (result.rows) {
        result.rows.forEach((row) => {
          // Handle { index, value } format from adapter
          let memberValue: unknown;
          if ('value' in row) {
            memberValue = row.value;
          } else {
            // Fallback for other formats
            memberValue = Object.values(row)[0];
          }
          parsedMembers.push(String(memberValue ?? ''));
        });
      }

      // Sort members alphabetically
      parsedMembers.sort((a, b) => a.localeCompare(b));
      setMembers(parsedMembers);
    } catch (err) {
      console.error("Failed to load set members:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load set");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, keyName]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Filter members based on search
  const filteredMembers = members.filter((m) =>
    m.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMember = async () => {
    if (!api || isReadOnly || !newMember) return;

    try {
      // Quote the member value to handle spaces and special characters
      const quotedMember = `"${newMember.replace(/"/g, '\\"')}"`;

      const result = await api.runQuery({
        connectionKey,
        sql: `SADD ${keyName} ${quotedMember}`,
      });

      // Handle { index, value } format from adapter
      let added = 0;
      if (result.rows?.[0]) {
        const row = result.rows[0];
        if ('value' in row) {
          added = Number(row.value ?? 0);
        } else {
          added = Number(Object.values(row)[0] ?? 0);
        }
      }
      if (added > 0) {
        toast.success("Member added");
      } else {
        toast.info("Member already exists in set");
      }

      setShowAddDialog(false);
      setNewMember('');
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const handleDeleteMember = async (member: string) => {
    if (!api || isReadOnly) return;

    if (!confirm(`Remove "${member}" from set?`)) return;

    try {
      // Quote the member value to handle spaces and special characters
      const quotedMember = `"${member.replace(/"/g, '\\"')}"`;

      await api.runQuery({
        connectionKey,
        sql: `SREM ${keyName} ${quotedMember}`,
      });
      toast.success("Member removed");
      if (selectedMember === member) {
        setSelectedMember(null);
      }
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleCheckMembership = async () => {
    if (!api || !checkMember) return;

    try {
      // Quote the member value to handle spaces and special characters
      const quotedMember = `"${checkMember.replace(/"/g, '\\"')}"`;

      const result = await api.runQuery({
        connectionKey,
        sql: `SISMEMBER ${keyName} ${quotedMember}`,
      });

      // Parse the result - SISMEMBER returns 1 for exists, 0 for not exists
      let isMember = false;
      if (result.rows?.[0]) {
        // Handle { index, value } format from adapter
        const row = result.rows[0];
        let val: unknown;
        if ('value' in row) {
          val = row.value;
        } else {
          val = Object.values(row)[0];
        }
        // Handle different response formats
        if (typeof val === 'number') {
          isMember = val === 1;
        } else if (typeof val === 'string') {
          isMember = val === '1' || val.toLowerCase() === 'true';
        }
      }

      setCheckResult(isMember);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check membership");
    }
  };

  const handleCopyMember = async (member: string) => {
    const success = await copyToClipboard(member);
    if (success) {
      toast.success("Member copied");
    }
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Members List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Search & Add */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-8 pr-3 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {!isReadOnly && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="w-full px-3 py-1.5 rounded bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="px-3 py-2 text-xs text-text-secondary border-b border-border flex items-center justify-between">
          <span>{filteredMembers.length} of {members.length} members</span>
          <span className="text-text-tertiary">Unordered</span>
        </div>

        {/* Add Dialog */}
        {showAddDialog && (
          <div className="p-3 border-b border-border bg-bg-tertiary">
            <div className="text-sm font-medium mb-1">Add Member (SADD)</div>
            <p className="text-xs text-text-tertiary mb-2">
              Sets store unique values - duplicates are automatically ignored.
            </p>
            <textarea
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="e.g., user123, active, premium, or any unique value"
              rows={2}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddMember}
                disabled={!newMember.trim()}
                className="px-3 py-1 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewMember('');
                }}
                className="px-3 py-1 rounded bg-bg-hover text-text-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-auto">
          {filteredMembers.length === 0 ? (
            <div className="p-4 text-center text-text-tertiary text-sm">
              {members.length === 0 ? "Set is empty" : "No matching members"}
            </div>
          ) : (
            <div className="py-1">
              {filteredMembers.map((member, idx) => {
                const parsed = parseValue(member);
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMember(member)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedMember(member)}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors group cursor-pointer",
                      selectedMember === member
                        ? "bg-accent/10 border-l-2 border-accent"
                        : "hover:bg-bg-hover"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary truncate font-mono">
                          {member.slice(0, 60)}{member.length > 60 ? '...' : ''}
                        </div>
                        {parsed.isJson && (
                          <span className="text-xs text-blue-500">JSON</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyMember(member);
                          }}
                          className="p-1 rounded hover:bg-bg-tertiary"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5 text-text-tertiary" />
                        </button>
                        {!isReadOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMember(member);
                            }}
                            className="p-1 rounded hover:bg-bg-tertiary"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-error" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Member Value View */}
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {/* Membership Check Tool */}
        <div className="mb-4 p-3 bg-bg-tertiary rounded-lg">
          <div className="text-sm font-medium mb-2">Check Membership (SISMEMBER)</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={checkMember}
              onChange={(e) => {
                setCheckMember(e.target.value);
                setCheckResult(null);
              }}
              placeholder="Enter value to check..."
              className="flex-1 px-3 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={handleCheckMembership}
              className="px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium"
            >
              Check
            </button>
          </div>
          {checkResult !== null && (
            <div className={cn(
              "mt-2 px-3 py-2 rounded text-sm flex items-center gap-2",
              checkResult ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
            )}>
              {checkResult ? (
                <>
                  <Check className="w-4 h-4" />
                  Member exists in set
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Not a member of this set
                </>
              )}
            </div>
          )}
        </div>

        {/* Selected Member Preview */}
        {selectedMember ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text-primary">Selected Member</h3>
            <ValuePreview value={selectedMember} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <p className="text-lg mb-2">No Member Selected</p>
              <p className="text-sm text-text-tertiary">
                Select a member from the list to view its value
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
