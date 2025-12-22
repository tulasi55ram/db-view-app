import { type FC, useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, X, AlertCircle } from "lucide-react";

export interface ImportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (format: 'csv' | 'json', content: string, hasHeaders?: boolean) => void;
}

export const ImportDataDialog: FC<ImportDataDialogProps> = ({
  open,
  onOpenChange,
  onImport
}) => {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!fileContent) return;
    onImport(format, fileContent, format === 'csv' ? hasHeaders : undefined);
    // Reset state
    setFileContent(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-lg border border-vscode-border bg-vscode-bg-light p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vscode-accent/20">
                <Upload className="h-5 w-5 text-vscode-accent" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-vscode-text-bright">
                  Import Data
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-vscode-text-muted">
                  Import rows from CSV or JSON file
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded p-1 hover:bg-vscode-bg-hover text-vscode-text-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Format selection */}
            <div>
              <label className="block text-sm font-medium text-vscode-text mb-2">
                File Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormat('csv')}
                  className={`flex-1 px-4 py-2 text-sm rounded border transition-colors ${
                    format === 'csv'
                      ? 'border-vscode-accent bg-vscode-accent/10 text-vscode-accent'
                      : 'border-vscode-border hover:bg-vscode-bg-hover text-vscode-text-muted'
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={() => setFormat('json')}
                  className={`flex-1 px-4 py-2 text-sm rounded border transition-colors ${
                    format === 'json'
                      ? 'border-vscode-accent bg-vscode-accent/10 text-vscode-accent'
                      : 'border-vscode-border hover:bg-vscode-bg-hover text-vscode-text-muted'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

            {/* CSV Options */}
            {format === 'csv' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasHeaders}
                  onChange={(e) => setHasHeaders(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-sm text-vscode-text">First row contains headers</span>
              </label>
            )}

            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-vscode-text mb-2">
                Select File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={format === 'csv' ? '.csv' : '.json'}
                onChange={handleFileSelect}
                className="w-full text-sm text-vscode-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-vscode-accent file:text-white hover:file:bg-vscode-accent-hover file:cursor-pointer"
              />
              {fileName && (
                <p className="mt-2 text-xs text-vscode-text-muted">
                  Selected: {fileName}
                </p>
              )}
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded bg-vscode-warning/10 border border-vscode-warning/30">
              <AlertCircle className="h-4 w-4 text-vscode-warning flex-shrink-0 mt-0.5" />
              <div className="text-xs text-vscode-warning">
                <p className="font-medium mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Column names must match table columns</li>
                  <li>Data types must be compatible</li>
                  <li>Null values should be empty strings (CSV) or null (JSON)</li>
                  <li>Large imports may take time</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-vscode-border">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!fileContent}
              className="px-4 py-2 text-sm font-medium rounded bg-vscode-accent hover:bg-vscode-accent-hover text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
