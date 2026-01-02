import { type FC, useEffect, useRef } from "react";

export interface BooleanEditorProps {
  value: string; // The current edit value as string ("true", "false", "NULL")
  nullable?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const BooleanEditor: FC<BooleanEditorProps> = ({
  value,
  nullable = false,
  onSave,
  onCancel,
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    // Immediately save the new value
    onSave(val);
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

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      className="w-full min-w-[100px] px-2 py-1 bg-bg-primary border-2 border-accent rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
    >
      <option value="true">true</option>
      <option value="false">false</option>
      {nullable && <option value="NULL">NULL</option>}
    </select>
  );
};
