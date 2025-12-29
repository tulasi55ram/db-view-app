import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Save, Copy, Pencil } from "lucide-react";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import { ValuePreview } from "../components/ValuePreview";
import { copyToClipboard } from "../utils";

interface RedisStringViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  keyName: string;
  isReadOnly: boolean;
  onRefresh: () => void;
}

export function RedisStringView({
  connectionKey,
  keyName,
  isReadOnly,
}: RedisStringViewProps) {
  const [value, setValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [stringLength, setStringLength] = useState(0);

  const api = getElectronAPI();

  const loadValue = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      const result = await api.runQuery({
        connectionKey,
        sql: `GET ${keyName}`,
      });

      if (result.rows?.[0]) {
        // Handle { index, value } format from adapter
        const row = result.rows[0];
        let val: string;
        if ('value' in row) {
          val = String(row.value ?? '');
        } else {
          val = String(Object.values(row)[0] ?? '');
        }
        setValue(val);
        setStringLength(val.length);
      } else {
        setValue('');
        setStringLength(0);
      }
    } catch (err) {
      console.error("Failed to load string value:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load value");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, keyName]);

  useEffect(() => {
    loadValue();
  }, [loadValue]);

  const handleSave = async () => {
    if (!api || isReadOnly) return;

    try {
      await api.runQuery({
        connectionKey,
        sql: `SET ${keyName} ${JSON.stringify(editValue)}`,
      });
      toast.success("Value updated");
      setEditing(false);
      loadValue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save value");
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(value);
    if (success) {
      toast.success("Value copied to clipboard");
    }
  };

  const handleStartEdit = () => {
    setEditValue(value);
    setEditing(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 overflow-auto">
      {/* Stats Bar */}
      <div className="flex items-center gap-4 mb-4 text-sm text-text-secondary">
        <span>String Length: <strong className="text-text-primary">{stringLength.toLocaleString()}</strong> bytes</span>
      </div>

      {/* Value Display/Editor */}
      {editing ? (
        <div className="flex-1 flex flex-col gap-3">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 min-h-[200px] px-4 py-3 bg-bg-primary border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            autoFocus
            placeholder="Enter string value..."
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-accent hover:bg-accent/90 text-white text-sm font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            {!isReadOnly && (
              <button
                onClick={handleStartEdit}
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent/90 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={loadValue}
              className="px-3 py-1.5 rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Value Preview */}
          <ValuePreview
            value={value}
            className="flex-1"
            editable={!isReadOnly}
            onEdit={(newValue) => {
              setEditValue(newValue);
              setEditing(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
