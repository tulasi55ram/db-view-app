/**
 * ValueEditor
 *
 * Inline editor for document field values.
 * Supports different input types based on the field type.
 * Features: Auto-resize textarea, real-time validation, toggle switch for booleans,
 * keyboard shortcut hints, and modern UI design.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Check, X, AlertCircle, Wand2 } from 'lucide-react';
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

/**
 * Validate JSON string
 */
function validateJson(input: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Get type badge color
 */
function getTypeBadgeColor(type: FieldType): string {
  switch (type) {
    case 'string':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'number':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'boolean':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'null':
    case 'undefined':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'array':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'object':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'date':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Boolean Toggle Switch Component
 */
function BooleanToggle({
  value,
  onChange,
  onKeyDown,
}: {
  value: boolean;
  onChange: (val: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-3">
      <button
        ref={buttonRef}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (e.key === ' ') {
              onChange(!value);
            } else {
              onKeyDown(e);
            }
          } else {
            onKeyDown(e);
          }
        }}
        className={cn(
          'relative w-11 h-6 rounded-full transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-1 focus:ring-offset-bg-primary',
          value
            ? 'bg-accent shadow-inner'
            : 'bg-bg-tertiary border border-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ease-out',
            value
              ? 'left-[22px] bg-white'
              : 'left-0.5 bg-text-tertiary'
          )}
        />
      </button>
      <span
        className={cn(
          'text-sm font-mono font-medium transition-colors',
          value ? 'text-purple-400' : 'text-text-tertiary'
        )}
      >
        {value ? 'true' : 'false'}
      </span>
    </div>
  );
}

/**
 * Auto-resizing Textarea Component
 */
function AutoResizeTextarea({
  value,
  onChange,
  onKeyDown,
  error,
  onMount,
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  error?: string;
  onMount?: (el: HTMLTextAreaElement | null) => void;
}) {
  const internalRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize effect
  useEffect(() => {
    const textarea = internalRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 300);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Focus and select on mount
  useEffect(() => {
    const textarea = internalRef.current;
    if (textarea) {
      textarea.focus();
      textarea.select();
      onMount?.(textarea);
    }
  }, [onMount]);

  return (
    <textarea
      ref={internalRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Allow Shift+Enter for newlines
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onKeyDown(e);
        } else if (e.key === 'Escape') {
          onKeyDown(e);
        }
      }}
      className={cn(
        'w-full px-3 py-2 bg-bg-tertiary rounded-lg text-sm font-mono',
        'border transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-bg-primary',
        'resize-none overflow-hidden',
        'placeholder:text-text-tertiary',
        error
          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
          : 'border-border hover:border-neutral-600 focus:ring-accent/50 focus:border-accent'
      )}
      style={{ minHeight: '80px', maxHeight: '300px' }}
      spellCheck={false}
    />
  );
}

export function ValueEditor({
  value,
  type,
  onSave,
  onCancel,
  className,
}: ValueEditorProps) {
  const [editValue, setEditValue] = useState(() => formatForEdit(value, type));
  const [boolValue, setBoolValue] = useState(() =>
    type === 'boolean' ? value === true || String(value).toLowerCase() === 'true' : false
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Validation for JSON types
  const jsonValidation = useMemo(() => {
    if (type === 'array' || type === 'object') {
      return validateJson(editValue);
    }
    return { valid: true };
  }, [editValue, type]);

  // Focus input on mount (for non-multiline, non-boolean types)
  useEffect(() => {
    if (type !== 'boolean' && type !== 'array' && type !== 'object') {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [type]);

  // Handle save
  const handleSave = useCallback(() => {
    if (type === 'boolean') {
      onSave(boolValue);
    } else if ((type === 'array' || type === 'object') && !jsonValidation.valid) {
      // Don't save invalid JSON
      return;
    } else {
      onSave(parseValue(editValue, type));
    }
  }, [type, boolValue, editValue, jsonValidation.valid, onSave]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  // Format JSON
  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(editValue);
      setEditValue(JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore if invalid
    }
  }, [editValue]);

  // Use textarea for complex types
  const isMultiline = type === 'array' || type === 'object';
  const canSave = type === 'boolean' || (isMultiline ? jsonValidation.valid : true);

  return (
    <div
      className={cn(
        'bg-bg-secondary rounded-xl border border-border shadow-lg',
        'p-3 min-w-[280px] max-w-md',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with type badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase tracking-wide',
            getTypeBadgeColor(type)
          )}
        >
          {type}
        </span>
        <span className="text-[10px] text-text-tertiary">
          {isMultiline ? 'Shift+Enter for newline' : 'Enter to save'}
        </span>
      </div>

      {/* Input area */}
      <div className="mb-3">
        {type === 'boolean' ? (
          <BooleanToggle
            value={boolValue}
            onChange={setBoolValue}
            onKeyDown={handleKeyDown}
          />
        ) : isMultiline ? (
          <div className="space-y-2">
            <AutoResizeTextarea
              value={editValue}
              onChange={setEditValue}
              onKeyDown={handleKeyDown}
              error={jsonValidation.error}
            />
            {/* JSON validation feedback */}
            {jsonValidation.error && (
              <div className="flex items-start gap-1.5 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="break-all">{jsonValidation.error}</span>
              </div>
            )}
          </div>
        ) : (
          <input
            ref={inputRef}
            type={type === 'number' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full px-3 py-2 bg-bg-tertiary rounded-lg text-sm font-mono',
              'border border-border hover:border-neutral-600',
              'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
              'focus:ring-offset-1 focus:ring-offset-bg-primary',
              'transition-all duration-150',
              'placeholder:text-text-tertiary'
            )}
            placeholder={`Enter ${type} value...`}
            step={type === 'number' ? 'any' : undefined}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Format button for JSON */}
          {isMultiline && jsonValidation.valid && (
            <button
              onClick={handleFormat}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs',
                'bg-bg-tertiary hover:bg-bg-hover text-text-secondary',
                'border border-border hover:border-neutral-600',
                'transition-all duration-150'
              )}
              title="Format JSON"
            >
              <Wand2 className="w-3 h-3" />
              Format
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-bg-tertiary hover:bg-bg-hover text-text-secondary',
              'border border-border hover:border-neutral-600',
              'transition-all duration-150'
            )}
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'transition-all duration-150',
              canSave
                ? 'bg-accent hover:bg-accent/90 text-white shadow-sm'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
            )}
            title="Save (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default ValueEditor;
