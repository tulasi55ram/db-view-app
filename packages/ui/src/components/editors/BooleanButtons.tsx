import { type FC, useEffect, useRef } from "react";

export interface BooleanButtonsProps {
  value: boolean | null;
  onSave: (value: boolean | null) => void;
  onCancel: () => void;
  nullable?: boolean;
}

export const BooleanButtons: FC<BooleanButtonsProps> = ({
  value,
  onSave,
  onCancel,
  nullable = false
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "true") {
      onSave(true);
    } else if (val === "false") {
      onSave(false);
    } else {
      onSave(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // Value is already saved on change
      onCancel();
    }
  };

  const currentValue = value === null ? "null" : String(value);

  return (
    <select
      ref={selectRef}
      value={currentValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      className="w-full h-full px-2 py-1 bg-vscode-bg-lighter border-2 border-vscode-accent outline-none text-sm font-mono cursor-pointer"
    >
      <option value="true">true</option>
      <option value="false">false</option>
      {nullable && <option value="null">NULL</option>}
    </select>
  );
};
