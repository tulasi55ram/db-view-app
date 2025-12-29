/**
 * ValueEditor
 *
 * Inline editor for document field values.
 * Supports different input types based on the field type.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { FieldType } from '../types';

interface ValueEditorProps {
  value: unknown;
  type: FieldType;
  onSave: (newValue: unknown) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Parse string input back to the appropriate type
 */
function parseValue(input: string, type: FieldType): unknown {
  switch (type) {
    case 'number':
      const num = parseFloat(input);
      return isNaN(num) ? input : num;
    case 'boolean':
      return input.toLowerCase() === 'true';
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'array':
    case 'object':
      try {
        return JSON.parse(input);
      } catch {
        return input;
      }
    default:
      return input;
  }
}

/**
 * Format value for editing
 */
function formatForEdit(value: unknown, type: FieldType): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (type === 'array' || type === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function ValueEditor({
  value,
  type,
  onSave,
  onCancel,
  className,
}: ValueEditorProps) {
  const [editValue, setEditValue] = useState(() => formatForEdit(value, type));
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (type === 'boolean') {
      selectRef.current?.focus();
    } else if (type === 'array' || type === 'object') {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [type]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSave(parseValue(editValue, type));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [editValue, type, onSave, onCancel]
  );

  // Use textarea for complex types
  const isMultiline = type === 'array' || type === 'object';

  const inputClasses = cn(
    'w-full px-2 py-1 bg-bg-primary border border-accent rounded text-sm font-mono',
    'focus:outline-none focus:ring-2 focus:ring-accent/50',
    className
  );

  return (
    <div className="flex items-start gap-1">
      {isMultiline ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(inputClasses, 'min-h-[80px] resize-y')}
          rows={4}
        />
      ) : type === 'boolean' ? (
        <select
          ref={selectRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClasses}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          ref={inputRef}
          type={type === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClasses}
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onSave(parseValue(editValue, type))}
          className="p-1 rounded hover:bg-green-500/20 text-green-400 transition-colors"
          title="Save (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
          title="Cancel (Escape)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default ValueEditor;
