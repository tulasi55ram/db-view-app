import { useState, useRef } from "react";
import { Upload, X, AlertCircle, FileUp } from "lucide-react";
import { cn } from "@/utils/cn";

type ImportFormat = "csv" | "json";

interface ImportDataDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (format: ImportFormat, content: string, hasHeaders?: boolean) => void;
}

export function ImportDataDialog({ open, onClose, onImport }: ImportDataDialogProps) {
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [hasHeaders, setHasHeaders] = useState(true);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      setFileName(file.name);

      // Auto-detect format from extension
      if (file.name.endsWith(".json")) {
        setFormat("json");
      } else if (file.name.endsWith(".csv")) {
        setFormat("csv");
      }
    };
    reader.readAsText(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImport = () => {
    if (!fileContent) return;
    onImport(format, fileContent, format === "csv" ? hasHeaders : undefined);
    handleReset();
  };

  const handleReset = () => {
    setFileContent(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative z-10 w-[90vw] max-w-[500px] rounded-lg border border-border bg-bg-primary shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
              <Upload className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Import Data</h2>
              <p className="mt-0.5 text-sm text-text-secondary">
                Import rows from CSV or JSON file
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1.5 hover:bg-bg-hover text-text-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">File Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat("csv")}
                className={cn(
                  "flex-1 px-4 py-2 text-sm rounded border transition-colors",
                  format === "csv"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:bg-bg-hover text-text-secondary"
                )}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat("json")}
                className={cn(
                  "flex-1 px-4 py-2 text-sm rounded border transition-colors",
                  format === "json"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:bg-bg-hover text-text-secondary"
                )}
              >
                JSON
              </button>
            </div>
          </div>

          {/* CSV Options */}
          {format === "csv" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasHeaders}
                onChange={(e) => setHasHeaders(e.target.checked)}
                className="rounded cursor-pointer"
              />
              <span className="text-sm text-text-primary">First row contains headers</span>
            </label>
          )}

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-accent bg-accent/5"
                : "border-border hover:border-text-tertiary hover:bg-bg-secondary"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={format === "csv" ? ".csv" : ".json"}
              onChange={handleInputChange}
              className="hidden"
            />
            {fileName ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-accent" />
                <p className="text-sm font-medium text-text-primary">{fileName}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  className="text-xs text-text-tertiary hover:text-text-secondary"
                >
                  Click to change file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-text-tertiary" />
                <p className="text-sm text-text-secondary">
                  Drop a {format.toUpperCase()} file here or click to browse
                </p>
                <p className="text-xs text-text-tertiary">
                  Accepts .{format} files
                </p>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded bg-warning/10 border border-warning/30">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs text-warning">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Column names must match table columns</li>
                <li>Data types must be compatible</li>
                <li>Null values: empty strings (CSV) or null (JSON)</li>
                <li>Large imports may take some time</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded bg-bg-secondary hover:bg-bg-hover text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!fileContent}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2",
              fileContent
                ? "bg-accent hover:bg-accent/90 text-white"
                : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
            )}
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
