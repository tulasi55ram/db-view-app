import { type FC, useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

export interface ArrayInputProps {
  value: unknown;
  onSave: (value: unknown[]) => void;
  onCancel: () => void;
}

export const ArrayInput: FC<ArrayInputProps> = ({ value, onSave, onCancel }) => {
  const [items, setItems] = useState<string[]>(() => {
    if (Array.isArray(value)) {
      return value.map(String);
    }
    return [];
  });
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        // Add new item
        setItems([...items, inputValue.trim()]);
        setInputValue("");
      } else {
        // Save if input is empty
        handleSave();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Backspace" && inputValue === "" && items.length > 0) {
      // Remove last item on backspace when input is empty
      e.preventDefault();
      setItems(items.slice(0, -1));
    }
  };

  const handleSave = () => {
    onSave(items);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full h-full px-2 py-1 bg-vscode-bg-lighter border-2 border-vscode-accent flex flex-wrap gap-1 items-center">
      {items.map((item, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-vscode-accent/20 text-vscode-text rounded text-xs"
        >
          {item}
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="hover:text-vscode-error transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder={items.length === 0 ? "Type and press Enter..." : ""}
        className={clsx(
          "flex-1 min-w-[120px] bg-transparent outline-none text-sm font-mono",
          items.length === 0 && "w-full"
        )}
      />
    </div>
  );
};
