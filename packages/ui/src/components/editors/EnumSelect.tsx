import { type FC, useState, useEffect, useRef } from "react";

export interface EnumSelectProps {
  value: unknown;
  enumValues: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const EnumSelect: FC<EnumSelectProps> = ({
  value,
  enumValues,
  onSave,
  onCancel
}) => {
  const [editValue, setEditValue] = useState(value === null ? "" : String(value));
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSave = () => {
    onSave(editValue);
  };

  return (
    <select
      ref={selectRef}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      className="w-full h-full px-2 py-1 bg-vscode-bg-lighter border-2 border-vscode-accent outline-none text-sm"
    >
      <option value="">-- Select --</option>
      {enumValues.map((enumVal) => (
        <option key={enumVal} value={enumVal}>
          {enumVal}
        </option>
      ))}
    </select>
  );
};
