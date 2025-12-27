import { useState, useCallback, memo } from "react";
import { X, Bookmark } from "lucide-react";
import { cn } from "@/utils/cn";

interface SaveViewDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, isDefault: boolean) => void;
  existingNames: string[];
}

export const SaveViewDialog = memo(function SaveViewDialog({
  open,
  onClose,
  onSave,
  existingNames,
}: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a view name");
      return;
    }

    if (existingNames.includes(trimmedName)) {
      setError("A view with this name already exists");
      return;
    }

    onSave(trimmedName, description.trim(), isDefault);
    setName("");
    setDescription("");
    setIsDefault(false);
    setError(null);
    onClose();
  }, [name, description, isDefault, existingNames, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSave, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-[400px] rounded-lg border border-border bg-bg-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-accent" />
            Save Current View
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              View Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Active Users, Recent Orders"
              className={cn(
                "w-full px-3 py-2 bg-bg-tertiary border rounded text-sm text-text-primary",
                "placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent",
                error ? "border-error" : "border-border"
              )}
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-error">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Description <span className="text-text-tertiary">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this view shows..."
              rows={2}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              Set as default view for this table
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-bg-secondary/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
          >
            Save View
          </button>
        </div>
      </div>
    </div>
  );
});
