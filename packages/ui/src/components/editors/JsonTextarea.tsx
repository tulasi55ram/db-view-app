import { type FC, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export interface JsonTextareaProps {
  value: unknown;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

export const JsonTextarea: FC<JsonTextareaProps> = ({
  value,
  onSave,
  onCancel
}) => {
  const [editValue, setEditValue] = useState(() => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });

  const [isValid, setIsValid] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const validateJson = (text: string): boolean => {
    if (text.trim() === "") return true;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    setIsValid(validateJson(newValue));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    // Allow Tab for indentation
    else if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = editValue.substring(0, start) + "  " + editValue.substring(end);
      setEditValue(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleSave = () => {
    if (!isValid) {
      toast.error("Invalid JSON", {
        description: "Please fix JSON syntax errors before saving"
      });
      return;
    }

    if (editValue.trim() === "") {
      onSave(null);
    } else {
      try {
        const parsed = JSON.parse(editValue);
        onSave(parsed);
      } catch {
        onSave(editValue);
      }
    }
  };

  return (
    <div className="absolute top-0 left-0 z-50 bg-vscode-bg-lighter border-2 border-vscode-accent p-2 shadow-xl rounded" style={{ width: '400px', minHeight: '250px' }}>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className={isValid ? "text-vscode-text-muted" : "text-red-500 font-semibold"}>
          {isValid ? "JSON Editor" : "⚠️ Invalid JSON"}
        </span>
        <span className="text-vscode-text-muted">
          Ctrl+Enter to save, Esc to cancel
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className={`w-full px-2 py-1 bg-vscode-bg border ${
          isValid ? "border-vscode-border" : "border-red-500"
        } outline-none text-sm font-mono resize-none`}
        style={{ height: '200px' }}
        placeholder='{"key": "value"}'
      />
    </div>
  );
};
