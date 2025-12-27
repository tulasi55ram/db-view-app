import { type FC, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ViewState } from "@dbview/types";
import { Save, X, Eye, Filter, Columns3, ArrowUpDown, Hash } from "lucide-react";

export interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentState: ViewState;
  onSave: (name: string, description: string, isDefault: boolean) => void;
}

export const SaveViewDialog: FC<SaveViewDialogProps> = ({
  open,
  onOpenChange,
  currentState,
  onSave
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim(), isDefault);
    // Reset form
    setName("");
    setDescription("");
    setIsDefault(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset form
    setName("");
    setDescription("");
    setIsDefault(false);
    onOpenChange(false);
  };

  const hasFilters = currentState.filters.length > 0;
  const hasSorting = currentState.sorting.length > 0;
  const hasHiddenColumns = currentState.visibleColumns.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[550px] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg border border-vscode-border bg-vscode-bg-light p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vscode-accent/20">
                <Save className="h-5 w-5 text-vscode-accent" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-vscode-text-bright">
                  Save View
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-vscode-text-muted">
                  Save the current table configuration as a named view
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded p-1 hover:bg-vscode-bg-hover text-vscode-text-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="mt-6 space-y-4">
            {/* Name Input */}
            <div>
              <label htmlFor="view-name" className="block text-sm font-medium text-vscode-text mb-1.5">
                View Name <span className="text-red-500">*</span>
              </label>
              <input
                id="view-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Active Users, Recent Orders"
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-sm text-vscode-text placeholder:text-vscode-text-muted focus:outline-none focus:border-vscode-accent"
                autoFocus
              />
            </div>

            {/* Description Input */}
            <div>
              <label htmlFor="view-description" className="block text-sm font-medium text-vscode-text mb-1.5">
                Description <span className="text-xs text-vscode-text-muted">(optional)</span>
              </label>
              <textarea
                id="view-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this view..."
                rows={2}
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-sm text-vscode-text placeholder:text-vscode-text-muted focus:outline-none focus:border-vscode-accent resize-none"
              />
            </div>

            {/* Default Checkbox */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-sm text-vscode-text">
                  Set as default view for this table
                </span>
              </label>
              <p className="ml-6 mt-1 text-xs text-vscode-text-muted">
                Default views are automatically applied when opening the table
              </p>
            </div>

            {/* Preview Section */}
            <div className="border-t border-vscode-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-vscode-text-muted" />
                <h3 className="text-sm font-medium text-vscode-text">
                  What will be saved
                </h3>
              </div>

              <div className="space-y-2">
                {/* Filters */}
                <div className="flex items-start gap-2 text-sm">
                  <Filter className="h-4 w-4 text-vscode-text-muted mt-0.5" />
                  <div className="flex-1">
                    <span className="text-vscode-text-muted">Filters:</span>{" "}
                    <span className="text-vscode-text">
                      {hasFilters ? (
                        <>
                          {currentState.filters.length} condition{currentState.filters.length !== 1 ? 's' : ''}{" "}
                          <span className="text-xs text-vscode-accent">({currentState.filterLogic})</span>
                        </>
                      ) : (
                        <span className="text-vscode-text-muted">None</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Sorting */}
                <div className="flex items-start gap-2 text-sm">
                  <ArrowUpDown className="h-4 w-4 text-vscode-text-muted mt-0.5" />
                  <div className="flex-1">
                    <span className="text-vscode-text-muted">Sorting:</span>{" "}
                    <span className="text-vscode-text">
                      {hasSorting ? (
                        <>
                          {currentState.sorting.map((s, i) => (
                            <span key={i}>
                              {i > 0 && ", "}
                              {s.columnName} ({s.direction})
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-vscode-text-muted">None</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Visible Columns */}
                <div className="flex items-start gap-2 text-sm">
                  <Columns3 className="h-4 w-4 text-vscode-text-muted mt-0.5" />
                  <div className="flex-1">
                    <span className="text-vscode-text-muted">Visible Columns:</span>{" "}
                    <span className="text-vscode-text">
                      {hasHiddenColumns ? (
                        `${currentState.visibleColumns.length} column${currentState.visibleColumns.length !== 1 ? 's' : ''}`
                      ) : (
                        <span className="text-vscode-text-muted">All columns</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Page Size */}
                {currentState.pageSize && (
                  <div className="flex items-start gap-2 text-sm">
                    <Hash className="h-4 w-4 text-vscode-text-muted mt-0.5" />
                    <div className="flex-1">
                      <span className="text-vscode-text-muted">Page Size:</span>{" "}
                      <span className="text-vscode-text">{currentState.pageSize} rows</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-vscode-border">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium rounded bg-vscode-accent hover:bg-vscode-accent-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save View
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
