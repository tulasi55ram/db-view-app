/**
 * AddFieldModal
 *
 * Modal dialog for adding a new field to a document.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AddFieldModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Parent path where field will be added */
  parentPath: string;
  /** Callback when field is added */
  onAdd: (key: string, value: unknown) => void;
  /** Whether adding is in progress */
  isAdding?: boolean;
}

type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

const VALUE_TYPE_OPTIONS: Array<{ value: ValueType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'null', label: 'Null' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

/**
 * Parse a string value to the specified type
 */
function parseValue(value: string, type: ValueType): unknown {
  switch (type) {
    case 'string':
      return value;
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) throw new Error('Invalid number');
      return num;
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'null':
      return null;
    case 'object':
      try {
        const parsed = JSON.parse(value || '{}');
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Must be an object');
        }
        return parsed;
      } catch {
        throw new Error('Invalid JSON object');
      }
    case 'array':
      try {
        const parsed = JSON.parse(value || '[]');
        if (!Array.isArray(parsed)) {
          throw new Error('Must be an array');
        }
        return parsed;
      } catch {
        throw new Error('Invalid JSON array');
      }
    default:
      return value;
  }
}

export function AddFieldModal({
  open,
  onClose,
  parentPath,
  onAdd,
  isAdding = false,
}: AddFieldModalProps) {
  const [fieldName, setFieldName] = useState('');
  const [valueType, setValueType] = useState<ValueType>('string');
  const [stringValue, setStringValue] = useState('');
  const [numberValue, setNumberValue] = useState('');
  const [booleanValue, setBooleanValue] = useState(false);
  const [jsonValue, setJsonValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFieldName('');
      setValueType('string');
      setStringValue('');
      setNumberValue('');
      setBooleanValue(false);
      setJsonValue('');
      setError(null);
    }
  }, [open]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate field name
      if (!fieldName.trim()) {
        setError('Field name is required');
        return;
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName)) {
        setError('Field name must start with a letter or underscore and contain only alphanumeric characters');
        return;
      }

      try {
        let value: unknown;

        switch (valueType) {
          case 'string':
            value = stringValue;
            break;
          case 'number':
            value = parseValue(numberValue, 'number');
            break;
          case 'boolean':
            value = booleanValue;
            break;
          case 'null':
            value = null;
            break;
          case 'object':
          case 'array':
            value = parseValue(jsonValue, valueType);
            break;
        }

        onAdd(fieldName.trim(), value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid value');
      }
    },
    [fieldName, valueType, stringValue, numberValue, booleanValue, jsonValue, onAdd]
  );

  // Render value input based on type
  const renderValueInput = () => {
    switch (valueType) {
      case 'string':
        return (
          <input
            type="text"
            value={stringValue}
            onChange={(e) => setStringValue(e.target.value)}
            placeholder="Enter string value..."
            className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={numberValue}
            onChange={(e) => setNumberValue(e.target.value)}
            placeholder="Enter number..."
            step="any"
            className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={booleanValue === true}
                onChange={() => setBooleanValue(true)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">true</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={booleanValue === false}
                onChange={() => setBooleanValue(false)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">false</span>
            </label>
          </div>
        );

      case 'null':
        return (
          <div className="px-3 py-2 bg-bg-tertiary border border-border rounded text-sm text-text-tertiary italic">
            Value will be set to null
          </div>
        );

      case 'object':
        return (
          <textarea
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            placeholder='{"key": "value"}'
            rows={4}
            className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        );

      case 'array':
        return (
          <textarea
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            placeholder='["item1", "item2"]'
            rows={4}
            className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        );
    }
  };

  if (!open) return null;

  // Format parent path for display
  const displayPath = parentPath === 'root' ? '(root)' : parentPath.replace(/^root\./, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-bg-primary border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Add Field</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Parent path info */}
          <div className="text-xs text-text-tertiary">
            Adding to: <span className="font-mono text-text-secondary">{displayPath}</span>
          </div>

          {/* Field name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Field Name
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Enter field name..."
              autoFocus
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Value type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Value Type
            </label>
            <div className="flex flex-wrap gap-2">
              {VALUE_TYPE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValueType(value)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded border transition-colors',
                    valueType === value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-tertiary text-text-secondary border-border hover:border-text-tertiary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Value input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Value
            </label>
            {renderValueInput()}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-error/10 border border-error/30 text-error text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isAdding}
              className="px-4 py-2 text-sm font-medium rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="px-4 py-2 text-sm font-medium rounded bg-accent hover:bg-accent/90 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isAdding ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Field
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddFieldModal;
