import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Trash2, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import { ValuePreview } from "../components/ValuePreview";
import { parseValue } from "../utils";

interface RedisListViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  keyName: string;
  isReadOnly: boolean;
  onRefresh: () => void;
}

interface ListItem {
  index: number;
  value: string;
}

export function RedisListView({
  connectionKey,
  keyName,
  isReadOnly,
}: RedisListViewProps) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLength, setTotalLength] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<'lpush' | 'rpush' | null>(null);
  const [newValue, setNewValue] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const pageSize = 100;
  const api = getElectronAPI();

  const loadItems = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);

      // Get list length
      const lenResult = await api.runQuery({
        connectionKey,
        sql: `LLEN ${keyName}`,
      });
      // Handle { index, value } format from adapter
      let length = 0;
      if (lenResult.rows?.[0]) {
        const row = lenResult.rows[0];
        if ('value' in row) {
          length = Number(row.value ?? 0);
        } else {
          length = Number(Object.values(row)[0] ?? 0);
        }
      }
      setTotalLength(length);

      // Get items for current page
      const start = offset;
      const end = Math.min(offset + pageSize - 1, length - 1);

      const result = await api.runQuery({
        connectionKey,
        sql: `LRANGE ${keyName} ${start} ${end}`,
      });

      const parsedItems: ListItem[] = [];
      if (result.rows) {
        result.rows.forEach((row, idx) => {
          // Handle { index, value } format from adapter
          let itemValue: unknown;
          if ('value' in row) {
            itemValue = row.value;
          } else {
            // Fallback for other formats
            itemValue = Object.values(row)[0];
          }
          parsedItems.push({
            index: offset + idx,
            value: String(itemValue ?? ''),
          });
        });
      }

      setItems(parsedItems);
    } catch (err) {
      console.error("Failed to load list items:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, keyName, offset]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleLPush = async () => {
    if (!api || isReadOnly || !newValue) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `LPUSH ${keyName} ${JSON.stringify(newValue)}`,
      });
      toast.success("Item added to head");
      setShowAddDialog(null);
      setNewValue('');
      setOffset(0); // Go to first page to see new item
      loadItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const handleRPush = async () => {
    if (!api || isReadOnly || !newValue) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `RPUSH ${keyName} ${JSON.stringify(newValue)}`,
      });
      toast.success("Item added to tail");
      setShowAddDialog(null);
      setNewValue('');
      // Go to last page to see new item
      const newLength = totalLength + 1;
      const lastPageOffset = Math.floor((newLength - 1) / pageSize) * pageSize;
      setOffset(lastPageOffset);
      loadItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const handleUpdateItem = async () => {
    if (!api || isReadOnly || editingIndex === null) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `LSET ${keyName} ${editingIndex} ${JSON.stringify(editValue)}`,
      });
      toast.success("Item updated");
      setEditingIndex(null);
      setEditValue('');
      loadItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    }
  };

  const handleDeleteItem = async (index: number) => {
    if (!api || isReadOnly) return;

    // Redis doesn't have direct index delete, need workaround
    // Using LSET to placeholder then LREM
    const placeholder = `__DELETE_${Date.now()}__`;

    try {
      await api.runQuery({
        connectionKey,
        sql: `LSET ${keyName} ${index} ${JSON.stringify(placeholder)}`,
      });
      await api.runQuery({
        connectionKey,
        sql: `LREM ${keyName} 1 ${JSON.stringify(placeholder)}`,
      });
      toast.success("Item deleted");
      if (selectedIndex === index) {
        setSelectedIndex(null);
      }
      loadItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const selectedItem = items.find((i) => i.index === selectedIndex);
  const totalPages = Math.ceil(totalLength / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  if (loading && items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Items List */}
      <div className="w-96 border-r border-border flex flex-col">
        {/* Header with Actions */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">
              {totalLength.toLocaleString()} items
            </span>
            {!isReadOnly && (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowAddDialog('lpush')}
                  className="px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-hover text-xs font-medium flex items-center gap-1"
                  title="Add to head (LPUSH)"
                >
                  <ArrowUp className="w-3 h-3" />
                  Head
                </button>
                <button
                  onClick={() => setShowAddDialog('rpush')}
                  className="px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-hover text-xs font-medium flex items-center gap-1"
                  title="Add to tail (RPUSH)"
                >
                  <ArrowDown className="w-3 h-3" />
                  Tail
                </button>
              </div>
            )}
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
                disabled={offset + pageSize >= totalLength}
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
            <div className="text-sm font-medium mb-1">
              {showAddDialog === 'lpush' ? 'Add to Head (LPUSH)' : 'Add to Tail (RPUSH)'}
            </div>
            <p className="text-xs text-text-tertiary mb-2">
              {showAddDialog === 'lpush'
                ? 'Inserts at the beginning of the list (index 0). Use for stack-like behavior (LIFO).'
                : 'Appends to the end of the list. Use for queue-like behavior (FIFO).'}
            </p>

            {/* Example hint */}
            <div className="p-2 bg-bg-secondary rounded text-xs text-text-secondary mb-2">
              <div className="font-medium mb-0.5">Common use cases:</div>
              <div className="text-text-tertiary">
                • Message queues: <span className="font-mono text-blue-400">{`{"type":"order","id":123}`}</span>
                <br />
                • Activity logs: <span className="font-mono text-blue-400">"user:login:2024-01-15"</span>
                <br />
                • Recent items: <span className="font-mono text-blue-400">"product:456"</span>
              </div>
            </div>

            <textarea
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={showAddDialog === 'lpush'
                ? "e.g., task:urgent, {\"event\":\"click\"}, or any value"
                : "e.g., job:process, {\"action\":\"send\"}, or any value"}
              rows={3}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none mb-2"
              autoFocus
            />
            <p className="text-xs text-text-tertiary mb-2">
              Values can be strings, numbers, or JSON. Each value becomes an element in the list.
            </p>
            <div className="flex gap-2">
              <button
                onClick={showAddDialog === 'lpush' ? handleLPush : handleRPush}
                disabled={!newValue.trim()}
                className="px-3 py-1 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium disabled:opacity-50"
              >
                Add to {showAddDialog === 'lpush' ? 'Head' : 'Tail'}
              </button>
              <button
                onClick={() => {
                  setShowAddDialog(null);
                  setNewValue('');
                }}
                className="px-3 py-1 rounded bg-bg-hover text-text-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="p-4 text-center text-text-tertiary text-sm">
              List is empty
            </div>
          ) : (
            <div className="py-1">
              {items.map((item) => {
                const parsed = parseValue(item.value);
                return (
                  <div
                    key={item.index}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIndex(item.index)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(item.index)}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors group flex items-start gap-2 cursor-pointer",
                      selectedIndex === item.index
                        ? "bg-accent/10 border-l-2 border-accent"
                        : "hover:bg-bg-hover"
                    )}
                  >
                    <span className="text-xs text-text-tertiary font-mono w-8 flex-shrink-0 pt-0.5">
                      [{item.index}]
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate font-mono">
                        {item.value.slice(0, 100)}{item.value.length > 100 ? '...' : ''}
                      </div>
                      {parsed.isJson && (
                        <span className="text-xs text-blue-500">JSON</span>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.index);
                        }}
                        className="p-1 rounded hover:bg-bg-tertiary opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-error" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Item Value View */}
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {editingIndex !== null ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text-primary">
              Edit Item at Index <span className="font-mono text-accent">{editingIndex}</span>
            </h3>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleUpdateItem}
                className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingIndex(null);
                  setEditValue('');
                }}
                className="px-4 py-2 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : selectedItem ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-text-primary">
                Index: <span className="font-mono text-accent">{selectedItem.index}</span>
              </h3>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setEditingIndex(selectedItem.index);
                    setEditValue(selectedItem.value);
                  }}
                  className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm"
                >
                  Edit
                </button>
              )}
            </div>
            <ValuePreview value={selectedItem.value} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <p className="text-lg mb-2">No Item Selected</p>
              <p className="text-sm text-text-tertiary">
                Select an item from the list to view its value
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
