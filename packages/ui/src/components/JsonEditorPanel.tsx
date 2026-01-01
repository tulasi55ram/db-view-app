/**
 * JsonEditorPanel - Side panel for editing JSON/JSONB data
 * Slides in from the right side with a large editor
 */

import { useState, useEffect, type FC, useRef } from "react";
import { X, Check, AlertCircle, Braces } from "lucide-react";
import { toast } from "sonner";
import { SidePanel } from "./panels/SidePanel";

export interface JsonEditorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: unknown;
  onSave: (value: unknown) => void;
  columnName?: string;
  rowIndex?: number;
  variant?: "inline" | "overlay";
}

export const JsonEditorPanel: FC<JsonEditorPanelProps> = ({
  open,
  onOpenChange,
  value,
  onSave,
  columnName = "JSON",
  rowIndex,
  variant = "inline",
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [editValue, setEditValue] = useState(() => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") {
      // Try to parse and pretty-print if it's a JSON string
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });

  const [isValid, setIsValid] = useState(true);

  // Reset when opening with new value
  useEffect(() => {
    if (open) {
      if (value === null || value === undefined) {
        setEditValue("");
      } else if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          setEditValue(JSON.stringify(parsed, null, 2));
        } catch {
          setEditValue(value);
        }
      } else {
        try {
          setEditValue(JSON.stringify(value, null, 2));
        } catch {
          setEditValue(String(value));
        }
      }
      setIsValid(true);
      // Focus textarea after a short delay to ensure panel is visible
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [open, value]);

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
      onOpenChange(false);
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
      onOpenChange(false);
    } else {
      try {
        const parsed = JSON.parse(editValue);
        onSave(parsed);
        onOpenChange(false);
      } catch {
        onSave(editValue);
        onOpenChange(false);
      }
    }
  };

  const formatJson = () => {
    if (editValue.trim() === "") return;
    try {
      const parsed = JSON.parse(editValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditValue(formatted);
      setIsValid(true);
      toast.success("JSON formatted successfully");
    } catch (error) {
      toast.error("Cannot format invalid JSON");
    }
  };

  if (!open) return null;

  // Content component (shared between modes)
  const editorContent = (
    <>
      {/* Validation status */}
      <div className="px-4 py-2 border-b border-vscode-border bg-vscode-bg-lighter">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isValid ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-500 font-medium">Valid JSON</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-red-500 font-semibold">Invalid JSON - Fix syntax errors</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={formatJson}
              disabled={!isValid}
              className="px-2 py-1 text-xs rounded bg-vscode-accent/10 hover:bg-vscode-accent/20 text-vscode-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Format JSON
            </button>
            <span className="text-xs text-vscode-text-muted">
              Ctrl+Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={`w-full h-full px-3 py-2 bg-vscode-bg border ${
            isValid ? "border-vscode-border" : "border-red-500"
          } rounded outline-none text-sm font-mono resize-none focus:ring-2 ${
            isValid ? "focus:ring-vscode-accent/50" : "focus:ring-red-500/50"
          }`}
          placeholder='{\n  "key": "value"\n}'
          spellCheck={false}
        />
      </div>
    </>
  );

  // Footer component (shared between modes)
  const footerContent = (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => onOpenChange(false)}
        className="px-3 py-1.5 text-sm rounded border border-vscode-border hover:bg-vscode-bg-hover transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={!isValid}
        className="px-3 py-1.5 text-sm rounded bg-vscode-accent hover:bg-vscode-accent/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Changes
      </button>
    </div>
  );

  // Inline mode - use SidePanel wrapper
  if (variant === "inline") {
    return (
      <SidePanel
        title={`Edit JSON: ${columnName}`}
        subtitle={rowIndex !== undefined ? `Row ${rowIndex + 1}` : undefined}
        icon={<Braces className="h-4 w-4" />}
        onClose={() => onOpenChange(false)}
        footer={footerContent}
      >
        {editorContent}
      </SidePanel>
    );
  }

  // Overlay mode - original fixed positioning with backdrop
  return (
    <>
      {/* Backdrop - subtle overlay */}
      <div
        className="absolute inset-0 bg-black/20 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Side panel */}
      <div
        ref={panelRef}
        className="absolute top-0 right-0 bottom-0 w-[600px] bg-vscode-bg border-l border-vscode-border shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-vscode-bg-lighter">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-vscode-text">
              Edit JSON: {columnName}
            </h2>
            {rowIndex !== undefined && (
              <span className="text-xs text-vscode-text-muted">
                (Row {rowIndex + 1})
              </span>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-vscode-bg-hover rounded transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {editorContent}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-vscode-border bg-vscode-bg-lighter">
          {footerContent}
        </div>
      </div>
    </>
  );
};
