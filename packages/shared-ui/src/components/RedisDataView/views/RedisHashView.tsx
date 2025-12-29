import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Plus, Trash2, Save, Search, Copy } from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import { ValuePreview } from "../components/ValuePreview";
import { copyToClipboard } from "../utils";

interface RedisHashViewProps {
  connectionKey: string;
  schema: string;
  table: string;
  keyName: string;
  isReadOnly: boolean;
  onRefresh: () => void;
}

interface HashField {
  field: string;
  value: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export function RedisHashView({
  connectionKey,
  keyName,
  isReadOnly,
}: RedisHashViewProps) {
  const [fields, setFields] = useState<HashField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [newField, setNewField] = useState<{ field: string; value: string } | null>(null);
  const [editingField, setEditingField] = useState<{ field: string; value: string } | null>(null);

  const api = getElectronAPI();

  const loadFields = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      const result = await api.runQuery({
        connectionKey,
        sql: `HGETALL ${keyName}`,
      });

      // Parse HGETALL result (alternating field/value pairs)
      const parsedFields: HashField[] = [];
      if (result.rows && result.rows.length > 0) {
        // Check the format - could be:
        // 1. Object format: { field1: value1, field2: value2 } (single row)
        // 2. Array format: [{ index: 0, value: "field1" }, { index: 1, value: "value1" }, ...] (alternating)
        const firstRow = result.rows[0];

        if ('index' in firstRow && 'value' in firstRow) {
          // Array format - alternating field/value pairs
          for (let i = 0; i < result.rows.length; i += 2) {
            const fieldRow = result.rows[i];
            const valueRow = result.rows[i + 1];
            if (fieldRow && valueRow) {
              const field = String(fieldRow.value ?? '');
              const value = String(valueRow.value ?? '');
              parsedFields.push({ field, value });
            }
          }
        } else {
          // Object format - keys are field names
          Object.entries(firstRow).forEach(([field, value]) => {
            parsedFields.push({ field, value: String(value ?? '') });
          });
        }
      }

      setFields(parsedFields);
    } catch (err) {
      console.error("Failed to load hash fields:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load fields");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, keyName]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // Filter fields based on search
  const filteredFields = fields.filter((f) =>
    f.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddField = async () => {
    if (!api || !newField || isReadOnly) return;

    if (!newField.field.trim()) {
      toast.error("Field name is required");
      return;
    }

    try {
      // Quote field name and value to handle spaces and special characters
      const quotedField = `"${newField.field.replace(/"/g, '\\"')}"`;
      const quotedValue = `"${newField.value.replace(/"/g, '\\"')}"`;

      await api.runQuery({
        connectionKey,
        sql: `HSET ${keyName} ${quotedField} ${quotedValue}`,
      });
      toast.success("Field added");
      setNewField(null);
      loadFields();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add field");
    }
  };

  const handleUpdateField = async () => {
    if (!api || !editingField || isReadOnly) return;

    try {
      // Quote field name and value to handle spaces and special characters
      const quotedField = `"${editingField.field.replace(/"/g, '\\"')}"`;
      const quotedValue = `"${editingField.value.replace(/"/g, '\\"')}"`;

      await api.runQuery({
        connectionKey,
        sql: `HSET ${keyName} ${quotedField} ${quotedValue}`,
      });
      toast.success("Field updated");
      setEditingField(null);
      loadFields();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update field");
    }
  };

  const handleDeleteField = async (field: string) => {
    if (!api || isReadOnly) return;

    if (!confirm(`Delete field "${field}"?`)) return;

    try {
      // Quote field name to handle spaces and special characters
      const quotedField = `"${field.replace(/"/g, '\\"')}"`;

      await api.runQuery({
        connectionKey,
        sql: `HDEL ${keyName} ${quotedField}`,
      });
      toast.success("Field deleted");
      if (selectedField === field) {
        setSelectedField(null);
      }
      loadFields();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete field");
    }
  };

  const handleCopyField = async (field: string, value: string) => {
    const success = await copyToClipboard(`${field}: ${value}`);
    if (success) {
      toast.success("Field copied to clipboard");
    }
  };

  const selectedFieldData = fields.find((f) => f.field === selectedField);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Fields List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Search & Add */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fields..."
              className="w-full pl-8 pr-3 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {!isReadOnly && (
            <button
              onClick={() => setNewField({ field: '', value: '' })}
              className="w-full px-3 py-1.5 rounded bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="px-3 py-2 text-xs text-text-secondary border-b border-border">
          {filteredFields.length} of {fields.length} fields
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-auto">
          {filteredFields.length === 0 ? (
            <div className="p-4 text-center text-text-tertiary text-sm">
              {fields.length === 0 ? "No fields in this hash" : "No matching fields"}
            </div>
          ) : (
            <div className="py-1">
              {filteredFields.map((f) => (
                <div
                  key={f.field}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedField(f.field)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedField(f.field)}
                  className={cn(
                    "w-full px-3 py-2 text-left transition-colors group cursor-pointer",
                    selectedField === f.field
                      ? "bg-accent/10 border-l-2 border-accent"
                      : "hover:bg-bg-hover"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-text-primary truncate">
                      {f.field}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyField(f.field, f.value);
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
                            handleDeleteField(f.field);
                          }}
                          className="p-1 rounded hover:bg-bg-tertiary"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-error" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-text-tertiary truncate mt-0.5">
                    {f.value.slice(0, 50)}{f.value.length > 50 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Field Value View */}
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {newField ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary">Add New Field (HSET)</h3>
              <p className="text-sm text-text-tertiary mt-1">
                A Redis hash stores field-value pairs, like a dictionary or object.
              </p>
            </div>

            {/* Example hint */}
            <div className="p-3 bg-bg-tertiary rounded-lg text-xs text-text-secondary">
              <div className="font-medium mb-1">Example:</div>
              <div className="font-mono">
                <span className="text-blue-400">user:1001</span> = {'{'}
                <span className="text-green-400">"name"</span>: "John",
                <span className="text-green-400">"email"</span>: "john@example.com"
                {'}'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Field Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newField.field}
                onChange={(e) => setNewField({ ...newField, field: e.target.value })}
                placeholder="e.g., name, email, age, status"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <p className="text-xs text-text-tertiary mt-1">
                The key for this field within the hash (like a property name)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Value</label>
              <textarea
                value={newField.value}
                onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                placeholder="e.g., John Doe, john@example.com, or any string/JSON value"
                rows={4}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              />
              <p className="text-xs text-text-tertiary mt-1">
                The value to store for this field (can be any string, number, or JSON)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddField}
                disabled={!newField.field.trim()}
                className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Add Field
              </button>
              <button
                onClick={() => setNewField(null)}
                className="px-4 py-2 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : editingField ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text-primary">
              Edit Field: <span className="font-mono text-accent">{editingField.field}</span>
            </h3>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Value</label>
              <textarea
                value={editingField.value}
                onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpdateField}
                className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={() => setEditingField(null)}
                className="px-4 py-2 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : selectedFieldData ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-text-primary font-mono">
                {selectedFieldData.field}
              </h3>
              {!isReadOnly && (
                <button
                  onClick={() => setEditingField({ field: selectedFieldData.field, value: selectedFieldData.value })}
                  className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm"
                >
                  Edit
                </button>
              )}
            </div>
            <ValuePreview value={selectedFieldData.value} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <p className="text-lg mb-2">No Field Selected</p>
              <p className="text-sm text-text-tertiary">
                Select a field from the list to view its value
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
