import { useState, useEffect, type FC } from "react";
import { X, Save } from "lucide-react";
import clsx from "clsx";

export interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  sql?: string;
}

export const SaveQueryModal: FC<SaveQueryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  sql = ""
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-vscode-bg border border-vscode-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
          <h2 className="text-sm font-semibold text-vscode-text flex items-center gap-2">
            <Save className="h-4 w-4 text-vscode-accent" />
            Save Query
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name field */}
          <div>
            <label className="block text-xs font-medium text-vscode-text mb-1.5">
              Query Name <span className="text-vscode-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Active users report"
              className="w-full px-3 py-2 text-sm rounded border border-vscode-border bg-vscode-bg-lighter text-vscode-text placeholder-vscode-text-muted focus:outline-none focus:border-vscode-accent"
              autoFocus
            />
          </div>

          {/* Description field */}
          <div>
            <label className="block text-xs font-medium text-vscode-text mb-1.5">
              Description <span className="text-vscode-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Gets all active users with their order count"
              className="w-full px-3 py-2 text-sm rounded border border-vscode-border bg-vscode-bg-lighter text-vscode-text placeholder-vscode-text-muted focus:outline-none focus:border-vscode-accent"
            />
          </div>

          {/* SQL Preview */}
          {sql && (
            <div>
              <label className="block text-xs font-medium text-vscode-text-muted mb-1.5">
                SQL Preview
              </label>
              <code className="block text-2xs font-mono text-vscode-text-muted bg-vscode-bg-lighter px-3 py-2 rounded whitespace-pre-wrap line-clamp-3 overflow-hidden border border-vscode-border">
                {sql}
              </code>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={clsx(
                "px-4 py-2 text-xs font-medium rounded transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "bg-vscode-accent text-white hover:bg-vscode-accent/80"
              )}
            >
              Save Query
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
