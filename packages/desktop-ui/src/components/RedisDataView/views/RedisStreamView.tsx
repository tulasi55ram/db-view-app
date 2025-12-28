import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Plus, Clock, Play, Pause, Activity, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import { ValuePreview } from "../components/ValuePreview";

interface RedisStreamViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  keyName: string;
  isReadOnly: boolean;
  onRefresh: () => void;
}

interface StreamEntry {
  id: string;
  timestamp: Date;
  fields: Record<string, string>;
}

interface StreamInfo {
  length: number;
  firstEntry?: string;
  lastEntry?: string;
  groups: number;
}

export function RedisStreamView({
  connectionKey,
  keyName,
  isReadOnly,
}: RedisStreamViewProps) {
  const [entries, setEntries] = useState<StreamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<StreamEntry | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFields, setNewFields] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [startId] = useState('-');
  const [endId] = useState('+');

  const pageSize = 50;
  const api = getElectronAPI();

  const loadStreamInfo = useCallback(async () => {
    if (!api) return;

    try {
      const result = await api.runQuery({
        connectionKey,
        sql: `XINFO STREAM ${keyName}`,
      });

      if (result.rows && result.rows.length > 0) {
        // XINFO STREAM returns alternating key-value pairs: ["length", 10, "groups", 0, ...]
        // Adapter formats as [{ index: 0, value: "length" }, { index: 1, value: 10 }, ...]
        const firstRow = result.rows[0];

        let info: Record<string, unknown> = {};

        if ('index' in firstRow && 'value' in firstRow) {
          // Convert { index, value } format to object
          for (let i = 0; i < result.rows.length; i += 2) {
            const keyRow = result.rows[i];
            const valueRow = result.rows[i + 1];
            if (keyRow && valueRow) {
              const key = String(keyRow.value ?? '');
              info[key] = valueRow.value;
            }
          }
        } else {
          // Already in object format
          info = firstRow as Record<string, unknown>;
        }

        setStreamInfo({
          length: Number(info.length ?? 0),
          firstEntry: info['first-entry'] ? String(info['first-entry']) : undefined,
          lastEntry: info['last-entry'] ? String(info['last-entry']) : undefined,
          groups: Number(info.groups ?? 0),
        });
      }
    } catch (err) {
      console.error("Failed to load stream info:", err);
    }
  }, [api, connectionKey, keyName]);

  const loadEntries = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);

      const result = await api.runQuery({
        connectionKey,
        sql: `XRANGE ${keyName} ${startId} ${endId} COUNT ${pageSize}`,
      });

      const parsedEntries: StreamEntry[] = [];
      if (result.rows) {
        result.rows.forEach((row) => {
          // XRANGE returns [[id, [field, value, ...]], ...]
          // Adapter preserves arrays, so each row is [id, fields_array]
          const values = Object.values(row);
          if (values.length >= 2) {
            const id = String(values[0]);
            const fieldsData = values[1];

            // Parse timestamp from ID
            const timestampMs = parseInt(id.split('-')[0], 10);
            const timestamp = new Date(timestampMs);

            // Parse fields - could be array [field, value, ...] or object
            const fields: Record<string, string> = {};
            if (Array.isArray(fieldsData)) {
              // Check if it's { index, value } format from adapter
              if (fieldsData.length > 0 && typeof fieldsData[0] === 'object' && 'value' in fieldsData[0]) {
                // Convert { index, value } pairs to field object
                for (let i = 0; i < fieldsData.length; i += 2) {
                  const keyItem = fieldsData[i];
                  const valueItem = fieldsData[i + 1];
                  if (keyItem && valueItem) {
                    const key = String(keyItem.value ?? '');
                    const value = String(valueItem.value ?? '');
                    fields[key] = value;
                  }
                }
              } else {
                // Regular alternating array [field, value, field, value]
                for (let i = 0; i < fieldsData.length; i += 2) {
                  fields[String(fieldsData[i])] = String(fieldsData[i + 1] ?? '');
                }
              }
            } else if (typeof fieldsData === 'object' && fieldsData !== null) {
              // Already an object
              Object.entries(fieldsData as Record<string, unknown>).forEach(([k, v]) => {
                fields[k] = String(v ?? '');
              });
            }

            parsedEntries.push({ id, timestamp, fields });
          }
        });
      }

      setEntries(parsedEntries);
      await loadStreamInfo();
    } catch (err) {
      console.error("Failed to load stream entries:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, keyName, startId, endId, loadStreamInfo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadEntries();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadEntries]);

  const handleAddEntry = async () => {
    if (!api || isReadOnly) return;

    // Filter out empty fields
    const validFields = newFields.filter((f) => f.key.trim() && f.value.trim());
    if (validFields.length === 0) {
      toast.error("At least one field is required");
      return;
    }

    try {
      // Quote both field keys and values to handle spaces and special characters
      const fieldsStr = validFields.map((f) => {
        const quotedKey = `"${f.key.replace(/"/g, '\\"')}"`;
        const quotedValue = `"${f.value.replace(/"/g, '\\"')}"`;
        return `${quotedKey} ${quotedValue}`;
      }).join(' ');

      await api.runQuery({
        connectionKey,
        sql: `XADD ${keyName} * ${fieldsStr}`,
      });
      toast.success("Entry added");
      setShowAddDialog(false);
      setNewFields([{ key: '', value: '' }]);
      loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!api || isReadOnly) return;

    if (!confirm(`Delete entry "${entryId}"?`)) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `XDEL ${keyName} ${entryId}`,
      });
      toast.success("Entry deleted");
      if (selectedEntry?.id === entryId) {
        setSelectedEntry(null);
      }
      loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  const addNewField = () => {
    setNewFields([...newFields, { key: '', value: '' }]);
  };

  const updateNewField = (index: number, key: string, value: string) => {
    const updated = [...newFields];
    updated[index] = { key, value };
    setNewFields(updated);
  };

  const removeNewField = (index: number) => {
    if (newFields.length > 1) {
      setNewFields(newFields.filter((_, i) => i !== index));
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stream Header */}
      <div className="p-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" />
            <span className="font-medium text-text-primary">Stream</span>
          </div>

          {streamInfo && (
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>
                Length: <strong className="text-text-primary">{streamInfo.length.toLocaleString()}</strong>
              </span>
              <span>
                Consumer Groups: <strong className="text-text-primary">{streamInfo.groups}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors",
              autoRefresh
                ? "bg-green-500/15 text-green-500"
                : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
            )}
            title={autoRefresh ? "Stop auto-refresh" : "Start auto-refresh (2s)"}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-4 h-4" />
                Live
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Auto
              </>
            )}
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-3 py-1.5 rounded bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          )}

          <button
            onClick={loadEntries}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Add Entry Dialog */}
      {showAddDialog && (
        <div className="p-4 border-b border-border bg-bg-secondary">
          <div className="text-sm font-medium mb-1">Add Entry (XADD)</div>
          <p className="text-xs text-text-tertiary mb-2">
            Streams are append-only logs. Each entry gets an auto-generated ID based on timestamp.
          </p>

          {/* Example hint */}
          <div className="p-2 bg-bg-tertiary rounded text-xs text-text-secondary mb-3">
            <div className="font-medium mb-0.5">Common use cases:</div>
            <div className="text-text-tertiary">
              • Event logging: <span className="font-mono text-blue-400">action</span>=<span className="font-mono text-green-400">"click"</span>, <span className="font-mono text-blue-400">userId</span>=<span className="font-mono text-green-400">"123"</span>
              <br />
              • Sensor data: <span className="font-mono text-blue-400">temperature</span>=<span className="font-mono text-green-400">"23.5"</span>, <span className="font-mono text-blue-400">humidity</span>=<span className="font-mono text-green-400">"65"</span>
              <br />
              • Audit trail: <span className="font-mono text-blue-400">operation</span>=<span className="font-mono text-green-400">"update"</span>, <span className="font-mono text-blue-400">resource</span>=<span className="font-mono text-green-400">"user:456"</span>
            </div>
          </div>

          <div className="text-xs text-text-secondary mb-2">
            Fields <span className="text-red-400">*</span>
            <span className="text-text-tertiary ml-2">(at least one field-value pair required)</span>
          </div>
          <div className="space-y-2 mb-3">
            {newFields.map((field, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateNewField(idx, e.target.value, field.value)}
                  placeholder="e.g., action, status, userId"
                  className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => updateNewField(idx, field.key, e.target.value)}
                  placeholder="e.g., click, active, 123"
                  className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {newFields.length > 1 && (
                  <button
                    onClick={() => removeNewField(idx)}
                    className="px-2 text-error hover:bg-bg-hover rounded"
                    title="Remove field"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={addNewField}
              className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
            >
              + Add Field
            </button>
            <div className="flex-1" />
            <button
              onClick={() => {
                setShowAddDialog(false);
                setNewFields([{ key: '', value: '' }]);
              }}
              className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddEntry}
              disabled={!newFields.some(f => f.key.trim() && f.value.trim())}
              className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium disabled:opacity-50"
            >
              Add Entry
            </button>
          </div>
        </div>
      )}

      {/* Entries Timeline */}
      <div className="flex-1 flex overflow-hidden">
        {/* Entries List */}
        <div className="w-[450px] border-r border-border overflow-auto">
          {entries.length === 0 ? (
            <div className="p-4 text-center text-text-tertiary text-sm">
              Stream is empty
            </div>
          ) : (
            <div className="py-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedEntry(entry)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedEntry(entry)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors border-l-2 group cursor-pointer",
                    selectedEntry?.id === entry.id
                      ? "bg-accent/10 border-accent"
                      : "hover:bg-bg-hover border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-accent">{entry.id}</span>
                    <div className="flex items-center gap-2">
                      {!isReadOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(entry.id);
                          }}
                          className="p-1 rounded hover:bg-bg-tertiary opacity-0 group-hover:opacity-100"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-error" />
                        </button>
                      )}
                      <span className="text-xs text-text-tertiary flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(entry.fields).slice(0, 4).map((key) => (
                      <span
                        key={key}
                        className="px-1.5 py-0.5 rounded bg-bg-tertiary text-xs text-text-secondary"
                      >
                        {key}
                      </span>
                    ))}
                    {Object.keys(entry.fields).length > 4 && (
                      <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-xs text-text-tertiary">
                        +{Object.keys(entry.fields).length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entry Details */}
        <div className="flex-1 p-4 overflow-auto">
          {selectedEntry ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-text-tertiary uppercase mb-1">Entry ID</div>
                <div className="font-mono text-lg text-accent">{selectedEntry.id}</div>
              </div>

              <div>
                <div className="text-xs text-text-tertiary uppercase mb-1">Timestamp</div>
                <div className="text-text-primary">{formatTimestamp(selectedEntry.timestamp)}</div>
              </div>

              <div>
                <div className="text-xs text-text-tertiary uppercase mb-2">
                  Fields ({Object.keys(selectedEntry.fields).length})
                </div>
                <div className="space-y-2">
                  {Object.entries(selectedEntry.fields).map(([key, value]) => (
                    <div key={key} className="p-3 bg-bg-tertiary rounded-lg">
                      <div className="text-xs text-text-secondary mb-1 font-medium">{key}</div>
                      <ValuePreview value={value} maxHeight={150} showFormatBadge={false} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-secondary h-full">
              <div className="text-center">
                <Activity className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
                <p className="text-lg mb-2">No Entry Selected</p>
                <p className="text-sm text-text-tertiary">
                  Select an entry from the timeline to view its fields
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
