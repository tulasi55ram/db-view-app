import { useState } from "react";
import { Download, X, FileText, Database, Code } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ExportFormat } from "@/utils/exportFormatters";

export interface ExportOptions {
  format: ExportFormat;
  includeHeaders: boolean;
  selectedRowsOnly: boolean;
  applyCurrentFilters: boolean;
}

interface ExportDataDialogProps {
  open: boolean;
  onClose: () => void;
  rowCount: number;
  selectedRowCount: number;
  hasFilters: boolean;
  onExport: (options: ExportOptions) => void;
}

export function ExportDataDialog({
  open,
  onClose,
  rowCount,
  selectedRowCount,
  hasFilters,
  onExport,
}: ExportDataDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [selectedRowsOnly, setSelectedRowsOnly] = useState(false);
  const [applyCurrentFilters, setApplyCurrentFilters] = useState(false);

  const handleExport = () => {
    onExport({
      format,
      includeHeaders: format === "csv" ? includeHeaders : true,
      selectedRowsOnly,
      applyCurrentFilters,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-[90vw] max-w-[450px] rounded-lg border border-border bg-bg-primary shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
              <Download className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Export Data</h2>
              <p className="mt-0.5 text-sm text-text-secondary">
                {rowCount} {rowCount === 1 ? "row" : "rows"} available to export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 hover:bg-bg-hover text-text-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Format</label>
            <div className="grid grid-cols-3 gap-2">
              <FormatButton
                icon={<FileText className="h-4 w-4" />}
                label="CSV"
                selected={format === "csv"}
                onClick={() => setFormat("csv")}
              />
              <FormatButton
                icon={<Code className="h-4 w-4" />}
                label="JSON"
                selected={format === "json"}
                onClick={() => setFormat("json")}
              />
              <FormatButton
                icon={<Database className="h-4 w-4" />}
                label="SQL"
                selected={format === "sql"}
                onClick={() => setFormat("sql")}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Options</label>

            {format === "csv" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHeaders}
                  onChange={(e) => setIncludeHeaders(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <span className="text-sm text-text-primary">Include column headers</span>
              </label>
            )}

            {selectedRowCount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRowsOnly}
                  onChange={(e) => setSelectedRowsOnly(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <span className="text-sm text-text-primary">
                  Export selected rows only ({selectedRowCount} selected)
                </span>
              </label>
            )}

            {hasFilters && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyCurrentFilters}
                  onChange={(e) => setApplyCurrentFilters(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <span className="text-sm text-text-primary">Apply current filters</span>
              </label>
            )}

            {!selectedRowCount && !hasFilters && format !== "csv" && (
              <p className="text-sm text-text-tertiary italic">No additional options available</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded bg-bg-secondary hover:bg-bg-hover text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium rounded bg-accent hover:bg-accent/90 text-white transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper component
function FormatButton({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded border transition-colors",
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-border hover:bg-bg-hover text-text-secondary"
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
