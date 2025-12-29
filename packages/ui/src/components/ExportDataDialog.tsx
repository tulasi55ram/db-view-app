import { type FC, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ExportFormat, ExportOptions } from "@dbview/types";
import { Download, X, FileText, Database, Code } from "lucide-react";

export interface ExportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowCount: number;
  selectedRowCount: number;
  hasFilters: boolean;
  onExport: (options: ExportOptions) => void;
}

export const ExportDataDialog: FC<ExportDataDialogProps> = ({
  open,
  onOpenChange,
  rowCount,
  selectedRowCount,
  hasFilters,
  onExport
}) => {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [selectedRowsOnly, setSelectedRowsOnly] = useState(false);
  const [applyCurrentFilters, setApplyCurrentFilters] = useState(false);

  const handleExport = () => {
    onExport({
      format,
      includeHeaders: format === 'csv' ? includeHeaders : undefined,
      selectedRowsOnly,
      applyCurrentFilters,
      encoding: 'UTF-8'
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-lg border border-vscode-border bg-vscode-bg-light p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Dialog header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vscode-accent/20">
                <Download className="h-5 w-5 text-vscode-accent" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-vscode-text-bright">
                  Export Data
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-vscode-text-muted">
                  Choose format and export options
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded p-1 hover:bg-vscode-bg-hover text-vscode-text-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Format selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-vscode-text mb-2">
                Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                <FormatButton
                  icon={<FileText className="h-4 w-4" />}
                  label="CSV"
                  selected={format === 'csv'}
                  onClick={() => setFormat('csv')}
                />
                <FormatButton
                  icon={<Code className="h-4 w-4" />}
                  label="JSON"
                  selected={format === 'json'}
                  onClick={() => setFormat('json')}
                />
                <FormatButton
                  icon={<Database className="h-4 w-4" />}
                  label="SQL"
                  selected={format === 'sql'}
                  onClick={() => setFormat('sql')}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-vscode-text">
                Options
              </label>

              {format === 'csv' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHeaders}
                    onChange={(e) => setIncludeHeaders(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-vscode-text">Include headers</span>
                </label>
              )}

              {selectedRowCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRowsOnly}
                    onChange={(e) => setSelectedRowsOnly(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-vscode-text">
                    Selected rows only ({selectedRowCount} selected)
                  </span>
                </label>
              )}

              {hasFilters && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyCurrentFilters}
                    onChange={(e) => setApplyCurrentFilters(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-vscode-text">
                    Apply current filters
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-vscode-border">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm font-medium rounded bg-vscode-accent hover:bg-vscode-accent-hover text-white transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// Helper component
const FormatButton: FC<{
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, label, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-3 rounded border transition-colors ${
      selected
        ? 'border-vscode-accent bg-vscode-accent/10 text-vscode-accent'
        : 'border-vscode-border hover:bg-vscode-bg-hover text-vscode-text-muted'
    }`}
  >
    {icon}
    <span className="text-xs font-medium">{label}</span>
  </button>
);
