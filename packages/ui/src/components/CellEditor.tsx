import { useEffect, useRef, useState } from 'react';
import type { ColumnMetadata } from '@dbview/core';
import { BooleanToggle } from './editors/BooleanToggle';
import { DateTimeInput } from './editors/DateTimeInput';
import { JsonTextarea } from './editors/JsonTextarea';
import { EnumSelect } from './editors/EnumSelect';
import { ArrayInput } from './editors/ArrayInput';
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
      <BooleanToggle
        value={value as boolean | null}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (column.type === 'json' || column.type === 'jsonb') {
    return (
      <JsonTextarea
        value={value}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (
    column.type === 'date' ||
    column.type.includes('timestamp') ||
    column.type.includes('time')
  ) {
    return (
      <DateTimeInput
        value={value}
        columnType={column.type}
        onSave={(val) => onSave(val)}
        onCancel={onCancel}
      />
    );
  }

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

  // Array editor
  if (column.type === 'array' || column.type.includes('[]')) {
    return (
      <ArrayInput
        value={value}
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
