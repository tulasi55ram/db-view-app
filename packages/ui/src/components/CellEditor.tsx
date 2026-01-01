import { useEffect, useRef, useState } from 'react';
import type { ColumnMetadata } from '@dbview/types';
import { BooleanButtons } from './editors/BooleanButtons';
import { EnumSelect } from './editors/EnumSelect';
import { validateCellValue } from '../utils/validateCell';
import { toast } from 'sonner';

interface CellEditorProps {
  value: unknown;
  column: ColumnMetadata;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

export function CellEditor({ value, column, onSave, onCancel }: CellEditorProps) {
  // Use specialized editors for specific types
  if (column.type === 'boolean') {
    return (
      <BooleanButtons
        value={value as boolean | null}
        onSave={onSave}
        onCancel={onCancel}
        nullable={column.nullable}
      />
    );
  }

  // JSON/JSONB/Array columns now use the side panel editor (handled in TableView)
  // This inline editor should not be reached for JSON or Array columns

  // Date/time fields: Use default text input to show raw database value
  // No special formatting - display exactly what the database returns

  // Enum editor - check for enumValues
  if ((column.type === 'enum' || column.type === 'USER-DEFINED') && column.enumValues && column.enumValues.length > 0) {
    return (
      <EnumSelect
        value={value}
        enumValues={column.enumValues}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  // Default text input for other types
  return <DefaultTextInput value={value} column={column} onSave={onSave} onCancel={onCancel} />;
}

// Default text input editor
function DefaultTextInput({ value, column, onSave, onCancel }: CellEditorProps) {
  const [editValue, setEditValue] = useState(value === null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = () => {
    // Validate the value
    const validation = validateCellValue(editValue, column);

    if (!validation.valid) {
      // Show error and keep editor open
      toast.error('Validation failed', {
        description: validation.error
      });
      return;
    }

    onSave(validation.value);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      className="w-full h-full px-2 py-1 bg-vscode-bg-lighter border-2 border-vscode-accent outline-none text-sm font-mono"
    />
  );
}
