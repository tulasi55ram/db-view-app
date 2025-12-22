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
    <div className="absolute inset-0 z-10 bg-vscode-bg-light border-2 border-vscode-accent p-2 shadow-lg">
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className={isValid ? "text-vscode-text-muted" : "text-red-500"}>
          {isValid ? "JSON Editor" : "Invalid JSON"}
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
        className={`w-full h-[calc(100%-24px)] px-2 py-1 bg-vscode-bg border ${
          isValid ? "border-vscode-border" : "border-red-500"
        } outline-none text-sm font-mono resize-none`}
        placeholder='{"key": "value"}'
      />
    </div>
  );
};
