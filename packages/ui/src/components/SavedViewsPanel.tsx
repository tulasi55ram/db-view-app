import { type FC, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { SavedView } from "@dbview/types";
import {
  Bookmark,
  Star,
  MoreVertical,
  Play,
  Download,
  Trash2,
  Upload,
  ChevronDown
} from "lucide-react";
import clsx from "clsx";

export interface SavedViewsPanelProps {
  views: SavedView[];
  activeViewId: string | null;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (viewId: string) => void;
  onExportView: (view: SavedView) => void;
  onSaveCurrentView: () => void;
  onImportView: () => void;
}

export const SavedViewsPanel: FC<SavedViewsPanelProps> = ({
  views,
  activeViewId,
  onApplyView,
  onDeleteView,
  onExportView,
  onSaveCurrentView,
  onImportView
}) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={clsx(
            "inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
            views.length > 0 && activeViewId
              ? "bg-vscode-accent/20 text-vscode-accent"
              : "text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text"
          )}
          title={activeViewId ? "View active" : "Saved views"}
        >
          <Bookmark className="h-4 w-4" />
          <span>Views</span>
          {views.length > 0 && (
            <span className="ml-0.5 rounded-full bg-vscode-accent/30 px-1.5 py-0.5 text-xs">
              {views.length}
            </span>
          )}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[280px] max-w-[400px] overflow-hidden rounded-md border border-vscode-border bg-vscode-bg-light shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          sideOffset={5}
          align="end"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-vscode-border px-3 py-2">
            <span className="text-sm font-semibold text-vscode-text">Saved Views</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onSaveCurrentView();
                  setOpen(false);
                }}
                className="rounded p-1 hover:bg-vscode-bg-hover text-vscode-text-muted transition-colors"
                title="Save current view"
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  onImportView();
                  setOpen(false);
                }}
                className="rounded p-1 hover:bg-vscode-bg-hover text-vscode-text-muted transition-colors"
                title="Import view"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Views List */}
          {views.length === 0 ? (
            <div className="py-8 px-4 text-center text-sm text-vscode-text-muted">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No saved views</p>
              <p className="text-xs mt-1">Click the bookmark icon to save the current view</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {views.map((view) => (
                <ViewItem
                  key={view.id}
                  view={view}
                  isActive={view.id === activeViewId}
                  onApply={() => {
                    onApplyView(view);
                    setOpen(false);
                  }}
                  onExport={() => {
                    onExportView(view);
                  }}
                  onDelete={() => {
                    onDeleteView(view.id);
                  }}
                />
              ))}
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

// Individual View Item Component
interface ViewItemProps {
  view: SavedView;
  isActive: boolean;
  onApply: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const ViewItem: FC<ViewItemProps> = ({ view, isActive, onApply, onExport, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filterCount = view.state.filters.length;
  const sortCount = view.state.sorting.length;
  const hasCustomColumns = view.state.visibleColumns.length > 0;

  return (
    <>
      <div
        className={clsx(
          "group flex items-start gap-2 px-3 py-2 hover:bg-vscode-bg-hover transition-colors border-b border-vscode-border last:border-0",
          isActive && "bg-vscode-accent/10"
        )}
      >
      {/* Default Star Icon */}
      <div className="mt-0.5">
        {view.isDefault ? (
          <Star className="h-4 w-4 text-vscode-accent fill-vscode-accent" />
        ) : (
          <div className="h-4 w-4" />
        )}
      </div>

      {/* View Info */}
      <button
        onClick={onApply}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-2">
          <span className={clsx(
            "text-sm font-medium truncate",
            isActive ? "text-vscode-accent" : "text-vscode-text"
          )}>
            {view.name}
          </span>
          {isActive && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-vscode-accent/20 text-vscode-accent">
              Active
            </span>
          )}
        </div>

        {view.description && (
          <p className="text-xs text-vscode-text-muted mt-0.5 truncate">
            {view.description}
          </p>
        )}

        {/* View Stats */}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-vscode-text-muted">
          {filterCount > 0 && (
            <span>{filterCount} filter{filterCount !== 1 ? 's' : ''}</span>
          )}
          {sortCount > 0 && (
            <>
              {filterCount > 0 && <span>•</span>}
              <span>{sortCount} sort{sortCount !== 1 ? 's' : ''}</span>
            </>
          )}
          {hasCustomColumns && (
            <>
              {(filterCount > 0 || sortCount > 0) && <span>•</span>}
              <span>Custom columns</span>
            </>
          )}
          {filterCount === 0 && sortCount === 0 && !hasCustomColumns && (
            <span>Default view</span>
          )}
        </div>
      </button>

      {/* Actions Menu */}
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-vscode-bg text-vscode-text-muted transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[160px] overflow-hidden rounded-md border border-vscode-border bg-vscode-bg-light shadow-lg"
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-vscode-text hover:bg-vscode-bg-hover cursor-pointer outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onApply();
                setMenuOpen(false);
              }}
            >
              <Play className="h-4 w-4" />
              Apply View
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-vscode-text hover:bg-vscode-bg-hover cursor-pointer outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onExport();
                setMenuOpen(false);
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-vscode-border" />

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 cursor-pointer outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
                setMenuOpen(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>

    {/* Delete Confirmation Dialog */}
    <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-vscode-border bg-vscode-bg p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <AlertDialog.Title className="text-lg font-semibold text-vscode-text mb-2">
            Delete View
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-vscode-text-muted mb-4">
            Are you sure you want to delete the view "{view.name}"? This action cannot be undone.
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 text-sm rounded bg-vscode-bg-lighter text-vscode-text hover:bg-vscode-bg-hover transition-colors">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onDelete}
                className="px-4 py-2 text-sm rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </>
  );
};
