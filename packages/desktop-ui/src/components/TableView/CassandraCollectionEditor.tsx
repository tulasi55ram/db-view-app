import { useState, useCallback, useEffect, useMemo } from "react";
import { Plus, Trash2, X, Check, List, Hash, Braces, Database } from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";

interface CassandraCollectionEditorProps {
  open: boolean;
  onClose: () => void;
  value: unknown;
  columnName: string;
  columnType: string;
  onChange: (newValue: unknown) => void;
}

/**
 * CassandraCollectionEditor - Editor for Cassandra collections and UDTs
 *
 * Supports:
 * - list<T> - ordered collection, allows duplicates
 * - set<T> - unordered collection, no duplicates
 * - map<K,V> - key-value pairs
 * - UDTs (User-Defined Types) - structured objects
 */
export function CassandraCollectionEditor({
  open,
  onClose,
  value,
  columnName,
  columnType,
  onChange,
}: CassandraCollectionEditorProps) {
  // Memoize typeInfo to prevent infinite re-renders
  const typeInfo = useMemo(() => parseColumnType(columnType), [columnType]);
  const [editedValue, setEditedValue] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize edited value when opening
  useEffect(() => {
    if (open) {
      setEditedValue(parseValue(value, typeInfo));
      setError(null);
    }
  }, [open, value, typeInfo]);

  const handleSave = useCallback(() => {
    try {
      // Validate and convert the value
      const result = serializeValue(editedValue, typeInfo);
      onChange(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid value");
    }
  }, [editedValue, typeInfo, onChange, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-primary border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(typeInfo.baseType)}
            <div>
              <h3 className="font-medium text-text-primary">{columnName}</h3>
              <p className="text-xs text-text-secondary">{columnType}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          {typeInfo.baseType === "list" || typeInfo.baseType === "set" ? (
            <ListSetEditor
              value={editedValue as unknown[]}
              onChange={setEditedValue}
              typeInfo={typeInfo}
              isSet={typeInfo.baseType === "set"}
            />
          ) : typeInfo.baseType === "map" ? (
            <MapEditor
              value={editedValue as Record<string, unknown>}
              onChange={setEditedValue}
              typeInfo={typeInfo}
            />
          ) : typeInfo.baseType === "udt" ? (
            <UDTEditor
              value={editedValue as Record<string, unknown>}
              onChange={setEditedValue}
              typeInfo={typeInfo}
            />
          ) : (
            <div className="text-text-secondary text-sm">
              Unsupported type for collection editor. Use JSON editor instead.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded bg-accent text-white hover:bg-accent/90 transition-colors text-sm flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// List/Set Editor
// ============================================

interface ListSetEditorProps {
  value: unknown[];
  onChange: (value: unknown[]) => void;
  typeInfo: TypeInfo;
  isSet: boolean;
}

function ListSetEditor({ value, onChange, typeInfo, isSet }: ListSetEditorProps) {
  const items = Array.isArray(value) ? value : [];

  const handleAddItem = () => {
    const newItem = getDefaultValue(typeInfo.elementType || "text");
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleUpdateItem = (index: number, newValue: unknown) => {
    const newItems = [...items];

    // For sets, check for duplicates
    if (isSet) {
      const stringified = JSON.stringify(newValue);
      const hasDuplicate = items.some((item, i) => i !== index && JSON.stringify(item) === stringified);
      if (hasDuplicate) {
        toast.error("Sets cannot contain duplicate values");
        return;
      }
    }

    newItems[index] = newValue;
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          {items.length} {items.length === 1 ? "item" : "items"}
          {isSet && " (unique values only)"}
        </span>
        <button
          onClick={handleAddItem}
          className="px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 group">
            <span className="text-xs text-text-tertiary w-6 text-right">{index}</span>
            <ValueInput
              value={item}
              onChange={(v) => handleUpdateItem(index, v)}
              type={typeInfo.elementType || "text"}
            />
            <button
              onClick={() => handleRemoveItem(index)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-500 transition-all"
              title="Remove item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            No items. Click "Add Item" to add one.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Map Editor
// ============================================

interface MapEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  typeInfo: TypeInfo;
}

function MapEditor({ value, onChange, typeInfo }: MapEditorProps) {
  const entries = Object.entries(value || {});

  const handleAddEntry = () => {
    const newKey = `key_${entries.length}`;
    const newValue = getDefaultValue(typeInfo.valueType || "text");
    onChange({ ...value, [newKey]: newValue });
  };

  const handleRemoveEntry = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  const handleUpdateKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    if (newKey in value) {
      toast.error("Key already exists");
      return;
    }

    const newValue: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      newValue[k === oldKey ? newKey : k] = v;
    }
    onChange(newValue);
  };

  const handleUpdateValue = (key: string, newVal: unknown) => {
    onChange({ ...value, [key]: newVal });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
        <button
          onClick={handleAddEntry}
          className="px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Entry
        </button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 group">
            <ValueInput
              value={key}
              onChange={(v) => handleUpdateKey(key, String(v))}
              type={typeInfo.keyType || "text"}
              placeholder="Key"
              className="w-1/3"
            />
            <span className="text-text-tertiary">:</span>
            <ValueInput
              value={val}
              onChange={(v) => handleUpdateValue(key, v)}
              type={typeInfo.valueType || "text"}
              placeholder="Value"
              className="flex-1"
            />
            <button
              onClick={() => handleRemoveEntry(key)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-500 transition-all"
              title="Remove entry"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            No entries. Click "Add Entry" to add one.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// UDT Editor
// ============================================

interface UDTEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  typeInfo: TypeInfo;
}

function UDTEditor({ value, onChange, typeInfo }: UDTEditorProps) {
  const fields = Object.entries(value || {});

  const handleUpdateField = (fieldName: string, newVal: unknown) => {
    onChange({ ...value, [fieldName]: newVal });
  };

  const handleSetNull = (fieldName: string) => {
    onChange({ ...value, [fieldName]: null });
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-secondary">
        User-Defined Type: <span className="font-medium text-green-500">{typeInfo.udtName || "unknown"}</span>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {fields.map(([fieldName, fieldValue]) => (
          <div key={fieldName} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-green-400">{fieldName}</label>
              <button
                onClick={() => handleSetNull(fieldName)}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                  fieldValue === null
                    ? "bg-accent/20 text-accent"
                    : "hover:bg-bg-hover text-text-tertiary"
                )}
              >
                NULL
              </button>
            </div>
            {fieldValue === null ? (
              <div className="px-3 py-2 bg-bg-tertiary rounded text-text-tertiary italic text-sm">
                null
              </div>
            ) : (
              <ValueInput
                value={fieldValue}
                onChange={(v) => handleUpdateField(fieldName, v)}
                type={inferType(fieldValue)}
              />
            )}
          </div>
        ))}
        {fields.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            No fields in this UDT.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Value Input Component
// ============================================

interface ValueInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  type: string;
  placeholder?: string;
  className?: string;
}

function ValueInput({ value, onChange, type, placeholder, className }: ValueInputProps) {
  const lowerType = type.toLowerCase();

  // Boolean
  if (lowerType === "boolean" || lowerType === "bool") {
    return (
      <select
        value={String(Boolean(value))}
        onChange={(e) => onChange(e.target.value === "true")}
        className={cn(
          "px-3 py-2 bg-bg-tertiary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent",
          className
        )}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // Numbers
  if (lowerType.includes("int") || lowerType.includes("bigint") || lowerType.includes("counter") ||
      lowerType.includes("float") || lowerType.includes("double") || lowerType.includes("decimal")) {
    return (
      <input
        type="number"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            onChange(null);
          } else if (lowerType.includes("int") || lowerType.includes("bigint") || lowerType.includes("counter")) {
            onChange(parseInt(v, 10));
          } else {
            onChange(parseFloat(v));
          }
        }}
        placeholder={placeholder || "0"}
        className={cn(
          "px-3 py-2 bg-bg-tertiary border border-border rounded text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent",
          className
        )}
      />
    );
  }

  // Object/nested types - use JSON input
  if (typeof value === "object" && value !== null) {
    const [jsonStr, setJsonStr] = useState(JSON.stringify(value, null, 2));
    const [isValid, setIsValid] = useState(true);

    return (
      <div className={cn("space-y-1", className)}>
        <textarea
          value={jsonStr}
          onChange={(e) => {
            setJsonStr(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
              setIsValid(true);
            } catch {
              setIsValid(false);
            }
          }}
          rows={3}
          className={cn(
            "w-full px-3 py-2 bg-bg-tertiary border rounded text-text-primary text-sm font-mono focus:outline-none focus:ring-2",
            isValid ? "border-border focus:ring-accent" : "border-red-500 focus:ring-red-500"
          )}
        />
        {!isValid && <span className="text-xs text-red-500">Invalid JSON</span>}
      </div>
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder || "Enter value..."}
      className={cn(
        "px-3 py-2 bg-bg-tertiary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent",
        className
      )}
    />
  );
}

// ============================================
// Helper Functions
// ============================================

interface TypeInfo {
  baseType: string;
  elementType?: string;
  keyType?: string;
  valueType?: string;
  isFrozen: boolean;
  udtName?: string;
}

function parseColumnType(columnType: string): TypeInfo {
  const type = columnType.toLowerCase().trim();
  const isFrozen = type.includes("frozen");

  let cleanType = type.replace(/frozen\s*<\s*/g, "").replace(/\s*>\s*$/g, "").trim();
  if (cleanType.endsWith("(frozen)")) {
    cleanType = cleanType.replace(/\s*\(frozen\)\s*$/, "").trim();
  }

  const listMatch = cleanType.match(/^list\s*<\s*(.+)\s*>$/);
  if (listMatch) {
    return { baseType: "list", elementType: listMatch[1], isFrozen };
  }

  const setMatch = cleanType.match(/^set\s*<\s*(.+)\s*>$/);
  if (setMatch) {
    return { baseType: "set", elementType: setMatch[1], isFrozen };
  }

  const mapMatch = cleanType.match(/^map\s*<\s*(.+?)\s*,\s*(.+)\s*>$/);
  if (mapMatch) {
    return { baseType: "map", keyType: mapMatch[1], valueType: mapMatch[2], isFrozen };
  }

  // Check for UDT (custom type names)
  const builtinTypes = ["text", "varchar", "ascii", "int", "bigint", "smallint", "tinyint",
                        "float", "double", "boolean", "uuid", "timeuuid", "blob", "inet",
                        "duration", "counter", "timestamp", "date", "time", "decimal", "varint"];

  if (!builtinTypes.includes(cleanType)) {
    return { baseType: "udt", udtName: cleanType, isFrozen };
  }

  return { baseType: cleanType, isFrozen };
}

function parseValue(value: unknown, typeInfo: TypeInfo): unknown {
  if (value === null || value === undefined) {
    // Return appropriate empty structure
    if (typeInfo.baseType === "list" || typeInfo.baseType === "set") return [];
    if (typeInfo.baseType === "map" || typeInfo.baseType === "udt") return {};
    return null;
  }

  // Parse string JSON
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Handle Set
  if (value instanceof Set) {
    return Array.from(value);
  }

  // Handle Map
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  return value;
}

function serializeValue(value: unknown, typeInfo: TypeInfo): unknown {
  if (value === null || value === undefined) return null;

  if (typeInfo.baseType === "set") {
    // For sets, return as array (driver handles conversion)
    return Array.isArray(value) ? value : [value];
  }

  if (typeInfo.baseType === "list") {
    return Array.isArray(value) ? value : [value];
  }

  if (typeInfo.baseType === "map" || typeInfo.baseType === "udt") {
    return typeof value === "object" ? value : { value };
  }

  return value;
}

function getDefaultValue(type: string): unknown {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("int") || lowerType.includes("counter")) return 0;
  if (lowerType.includes("float") || lowerType.includes("double") || lowerType.includes("decimal")) return 0.0;
  if (lowerType === "boolean" || lowerType === "bool") return false;
  if (lowerType === "uuid" || lowerType === "timeuuid") return crypto.randomUUID();
  return "";
}

function inferType(value: unknown): string {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "int" : "double";
  }
  if (Array.isArray(value)) return "list";
  if (typeof value === "object" && value !== null) return "map";
  return "text";
}

function getTypeIcon(baseType: string) {
  switch (baseType) {
    case "list":
      return <List className="w-5 h-5 text-purple-500" />;
    case "set":
      return <Hash className="w-5 h-5 text-purple-500" />;
    case "map":
      return <Braces className="w-5 h-5 text-orange-500" />;
    case "udt":
      return <Database className="w-5 h-5 text-green-500" />;
    default:
      return null;
  }
}

export default CassandraCollectionEditor;
