import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import { ValuePreview } from "../components/ValuePreview";
import { parseValue, formatNumber } from "../utils";

interface RedisSortedSetViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  keyName: string;
  isReadOnly: boolean;
  onRefresh: () => void;
}

interface SortedSetMember {
  member: string;
  score: number;
  rank: number;
}

type SortOrder = 'score_asc' | 'score_desc' | 'alpha_asc' | 'alpha_desc';

export function RedisSortedSetView({
  connectionKey,
  keyName,
  isReadOnly,
}: RedisSortedSetViewProps) {
  const [members, setMembers] = useState<SortedSetMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sortOrder, setSortOrder] = useState<SortOrder>('score_asc');
  const [selectedMember, setSelectedMember] = useState<SortedSetMember | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMember, setNewMember] = useState({ member: '', score: '0' });
  const [editingMember, setEditingMember] = useState<SortedSetMember | null>(null);
  const [editScore, setEditScore] = useState('');

  const pageSize = 100;
  const api = getElectronAPI();

  const loadMembers = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);

      // Get cardinality
      const cardResult = await api.runQuery({
        connectionKey,
        sql: `ZCARD ${keyName}`,
      });
      // Handle { index, value } format from adapter
      let count = 0;
      if (cardResult.rows?.[0]) {
        const row = cardResult.rows[0];
        if ('value' in row) {
          count = Number(row.value ?? 0);
        } else {
          count = Number(Object.values(row)[0] ?? 0);
        }
      }
      setTotalCount(count);

      // Get members with scores
      const isReversed = sortOrder === 'score_desc';
      const command = isReversed ? 'ZREVRANGE' : 'ZRANGE';

      const result = await api.runQuery({
        connectionKey,
        sql: `${command} ${keyName} ${offset} ${offset + pageSize - 1} WITHSCORES`,
      });

      const parsedMembers: SortedSetMember[] = [];
      if (result.rows) {
        // ZRANGE WITHSCORES returns alternating member/score pairs
        // Adapter formats as [{ index: 0, value: "member1" }, { index: 1, value: 100 }, ...]
        // We need to pair up consecutive rows

        // First, check if rows are in { index, value } format
        const firstRow = result.rows[0];
        const isIndexValueFormat = firstRow && 'index' in firstRow && 'value' in firstRow;

        if (isIndexValueFormat) {
          // Alternating member/score in { index, value } format
          for (let i = 0; i < result.rows.length; i += 2) {
            const memberRow = result.rows[i];
            const scoreRow = result.rows[i + 1];
            if (memberRow && scoreRow) {
              const member = String(memberRow.value ?? '');
              const score = Number(scoreRow.value ?? 0);
              const rank = isReversed ? count - 1 - (offset + Math.floor(i / 2)) : offset + Math.floor(i / 2);
              parsedMembers.push({ member, score, rank });
            }
          }
        } else {
          // Other formats - try to parse as [member, score] pairs per row or alternating
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i];
            const values = Object.values(row);
            if (values.length >= 2) {
              // Two-column format: { member, score }
              const member = String(values[0] ?? '');
              const score = Number(values[1] ?? 0);
              const rank = isReversed ? count - 1 - (offset + i) : offset + i;
              parsedMembers.push({ member, score, rank });
            } else {
              // Single column alternating format
              const value = values[0];
              if (i % 2 === 0) {
                parsedMembers.push({
                  member: String(value ?? ''),
                  score: 0,
                  rank: isReversed ? count - 1 - (offset + Math.floor(i / 2)) : offset + Math.floor(i / 2),
                });
              } else if (parsedMembers.length > 0) {
                parsedMembers[parsedMembers.length - 1].score = Number(value ?? 0);
              }
            }
          }
        }
      }

      // Sort alphabetically if needed
      if (sortOrder === 'alpha_asc') {
        parsedMembers.sort((a, b) => a.member.localeCompare(b.member));
      } else if (sortOrder === 'alpha_desc') {
        parsedMembers.sort((a, b) => b.member.localeCompare(a.member));
      }

      setMembers(parsedMembers);
    } catch (err) {
      console.error("Failed to load sorted set:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load sorted set");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, keyName, offset, sortOrder]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleAddMember = async () => {
    if (!api || isReadOnly || !newMember.member) return;

    const score = parseFloat(newMember.score);
    if (isNaN(score)) {
      toast.error("Score must be a valid number");
      return;
    }

    try {
      await api.runQuery({
        connectionKey,
        sql: `ZADD ${keyName} ${score} ${JSON.stringify(newMember.member)}`,
      });
      toast.success("Member added");
      setShowAddDialog(false);
      setNewMember({ member: '', score: '0' });
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const handleUpdateScore = async () => {
    if (!api || isReadOnly || !editingMember) return;

    const score = parseFloat(editScore);
    if (isNaN(score)) {
      toast.error("Score must be a valid number");
      return;
    }

    try {
      await api.runQuery({
        connectionKey,
        sql: `ZADD ${keyName} ${score} ${JSON.stringify(editingMember.member)}`,
      });
      toast.success("Score updated");
      setEditingMember(null);
      setEditScore('');
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update score");
    }
  };

  const handleIncrementScore = async (member: SortedSetMember, increment: number) => {
    if (!api || isReadOnly) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `ZINCRBY ${keyName} ${increment} ${JSON.stringify(member.member)}`,
      });
      toast.success(`Score ${increment > 0 ? 'increased' : 'decreased'} by ${Math.abs(increment)}`);
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update score");
    }
  };

  const handleDeleteMember = async (member: string) => {
    if (!api || isReadOnly) return;

    if (!confirm(`Remove "${member}" from sorted set?`)) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `ZREM ${keyName} ${JSON.stringify(member)}`,
      });
      toast.success("Member removed");
      if (selectedMember?.member === member) {
        setSelectedMember(null);
      }
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  // Calculate score range for visualization
  const scores = members.map((m) => m.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore || 1;

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
      <div className="w-[400px] border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              {formatNumber(totalCount)} members
            </span>
            {!isReadOnly && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            )}
          </div>

          {/* Sort Options */}
          <div className="flex gap-1">
            {(['score_asc', 'score_desc', 'alpha_asc', 'alpha_desc'] as SortOrder[]).map((order) => (
              <button
                key={order}
                onClick={() => {
                  setSortOrder(order);
                  setOffset(0);
                }}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-colors",
                  sortOrder === order
                    ? "bg-accent text-white"
                    : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
                )}
              >
                {order === 'score_asc' && 'Score ↑'}
                {order === 'score_desc' && 'Score ↓'}
                {order === 'alpha_asc' && 'A-Z'}
                {order === 'alpha_desc' && 'Z-A'}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
                disabled={offset === 0}
                className="p-1 rounded hover:bg-bg-hover disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-text-secondary">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + pageSize)}
                disabled={offset + pageSize >= totalCount}
                className="p-1 rounded hover:bg-bg-hover disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Add Dialog */}
        {showAddDialog && (
          <div className="p-3 border-b border-border bg-bg-tertiary">
            <div className="text-sm font-medium mb-1">Add Member (ZADD)</div>
            <p className="text-xs text-text-tertiary mb-2">
              Sorted sets rank members by score. Higher scores = higher rank. Duplicate members update the score.
            </p>

            {/* Example hint */}
            <div className="p-2 bg-bg-secondary rounded text-xs text-text-secondary mb-2">
              <div className="font-medium mb-0.5">Common use cases:</div>
              <div className="text-text-tertiary">
                • Leaderboard: member=<span className="font-mono text-blue-400">"player:123"</span> score=<span className="font-mono text-green-400">1500</span>
                <br />
                • Priority queue: member=<span className="font-mono text-blue-400">"task:urgent"</span> score=<span className="font-mono text-green-400">100</span>
                <br />
                • Time-based: member=<span className="font-mono text-blue-400">"event:456"</span> score=<span className="font-mono text-green-400">1704067200</span> (timestamp)
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Member <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newMember.member}
                  onChange={(e) => setNewMember({ ...newMember, member: e.target.value })}
                  placeholder="e.g., user:123, product:abc, or any unique identifier"
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
                <p className="text-xs text-text-tertiary mt-0.5">
                  The value to store (must be unique within this sorted set)
                </p>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Score <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={newMember.score}
                  onChange={(e) => setNewMember({ ...newMember, score: e.target.value })}
                  placeholder="e.g., 0, 100, 1704067200"
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-xs text-text-tertiary mt-0.5">
                  Numeric value used for ranking (can be integer or decimal)
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAddMember}
                disabled={!newMember.member.trim()}
                className="px-3 py-1 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium disabled:opacity-50"
              >
                Add Member
              </button>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewMember({ member: '', score: '0' });
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
          {members.length === 0 ? (
            <div className="p-4 text-center text-text-tertiary text-sm">
              Sorted set is empty
            </div>
          ) : (
            <div className="py-1">
              {members.map((m) => {
                const parsed = parseValue(m.member);
                const scorePercent = ((m.score - minScore) / scoreRange) * 100;

                return (
                  <div
                    key={m.member}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMember(m)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedMember(m)}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors group relative cursor-pointer",
                      selectedMember?.member === m.member
                        ? "bg-accent/10 border-l-2 border-accent"
                        : "hover:bg-bg-hover"
                    )}
                  >
                    {/* Score bar visualization */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-accent/10"
                      style={{ width: `${scorePercent}%` }}
                    />

                    <div className="relative flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-sm text-text-primary truncate font-mono">
                          {m.member.slice(0, 40)}{m.member.length > 40 ? '...' : ''}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-text-tertiary">Rank: {m.rank}</span>
                          {parsed.isJson && <span className="text-blue-500">JSON</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-accent">
                          {m.score.toLocaleString()}
                        </span>
                        {!isReadOnly && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIncrementScore(m, 1);
                              }}
                              className="p-1 rounded hover:bg-bg-tertiary text-green-500"
                              title="Increment +1"
                            >
                              <TrendingUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMember(m.member);
                              }}
                              className="p-1 rounded hover:bg-bg-tertiary"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3 text-error" />
                            </button>
                          </div>
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

      {/* Member Detail View */}
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {editingMember ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text-primary">
              Edit Score for: <span className="font-mono text-accent">{editingMember.member.slice(0, 30)}</span>
            </h3>
            <div>
              <label className="block text-sm text-text-secondary mb-1">New Score</label>
              <input
                type="number"
                value={editScore}
                onChange={(e) => setEditScore(e.target.value)}
                className="w-48 px-3 py-2 bg-bg-primary border border-border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpdateScore}
                className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium"
              >
                Update Score
              </button>
              <button
                onClick={() => {
                  setEditingMember(null);
                  setEditScore('');
                }}
                className="px-4 py-2 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : selectedMember ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-text-primary">Member Details</h3>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setEditingMember(selectedMember);
                    setEditScore(String(selectedMember.score));
                  }}
                  className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm"
                >
                  Edit Score
                </button>
              )}
            </div>

            {/* Score Card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-bg-tertiary rounded-lg">
                <div className="text-xs text-text-tertiary uppercase mb-1">Score</div>
                <div className="text-2xl font-mono font-bold text-accent">
                  {selectedMember.score.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-bg-tertiary rounded-lg">
                <div className="text-xs text-text-tertiary uppercase mb-1">Rank</div>
                <div className="text-2xl font-mono font-bold text-text-primary">
                  #{selectedMember.rank + 1}
                </div>
              </div>
            </div>

            {/* Quick Score Actions */}
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Quick adjust:</span>
                {[-10, -1, 1, 10].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => handleIncrementScore(selectedMember, inc)}
                    className={cn(
                      "px-2 py-1 rounded text-sm font-mono",
                      inc > 0 ? "bg-green-500/15 text-green-500 hover:bg-green-500/25" : "bg-red-500/15 text-red-500 hover:bg-red-500/25"
                    )}
                  >
                    {inc > 0 ? `+${inc}` : inc}
                  </button>
                ))}
              </div>
            )}

            {/* Member Value */}
            <div>
              <div className="text-sm text-text-secondary mb-2">Member Value</div>
              <ValuePreview value={selectedMember.member} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <p className="text-lg mb-2">No Member Selected</p>
              <p className="text-sm text-text-tertiary">
                Select a member from the list to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
