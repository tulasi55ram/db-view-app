/**
 * ImportModal
 *
 * Modal for importing documents from JSON or CSV files.
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/primitives/Dialog';
import { Button } from '@/primitives';
import { toast } from 'sonner';
import type { DocumentDbType } from '../types';
import { DB_LABELS } from '../types';

interface ImportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Database type for terminology */
  dbType: DocumentDbType;
  /** Collection/table name */
  tableName: string;
  /** Callback to insert documents */
  onImport: (documents: Record<string, unknown>[]) => Promise<{ success: number; failed: number }>;
}

type ImportFormat = 'json' | 'csv';

interface ParsedData {
  documents: Record<string, unknown>[];
  format: ImportFormat;
  errors: string[];
}

/**
 * Parse CSV string to array of objects
 */
function parseCSV(content: string): Record<string, unknown>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const documents: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const doc: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const value = values[idx];
      // Try to parse as JSON for nested objects/arrays
      try {
        doc[header] = JSON.parse(value);
      } catch {
        // Try to parse as number
        const num = parseFloat(value);
        if (!isNaN(num) && value.trim() !== '') {
          doc[header] = num;
        } else if (value.toLowerCase() === 'true') {
          doc[header] = true;
        } else if (value.toLowerCase() === 'false') {
          doc[header] = false;
        } else if (value === '' || value.toLowerCase() === 'null') {
          doc[header] = null;
        } else {
          doc[header] = value;
        }
      }
    });
    documents.push(doc);
  }

  return documents;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

/**
 * Parse JSON string to array of objects
 */
function parseJSON(content: string): Record<string, unknown>[] {
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    return parsed.filter((item) => typeof item === 'object' && item !== null);
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Single object, wrap in array
    return [parsed];
  }

  throw new Error('JSON must be an array of objects or a single object');
}

export function ImportModal({
  open,
  onClose,
  dbType,
  tableName,
  onImport,
}: ImportModalProps) {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = DB_LABELS[dbType];

  // Reset state when modal opens/closes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setParsedData(null);
      setIsImporting(false);
      setDragOver(false);
      onClose();
    }
  }, [onClose]);

  // Parse file content
  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      const errors: string[] = [];
      let documents: Record<string, unknown>[] = [];
      let format: ImportFormat = 'json';

      try {
        if (file.name.endsWith('.csv')) {
          format = 'csv';
          documents = parseCSV(content);
        } else {
          format = 'json';
          documents = parseJSON(content);
        }

        if (documents.length === 0) {
          errors.push('No valid documents found in file');
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Failed to parse file');
      }

      setParsedData({ documents, format, errors });
    };

    reader.onerror = () => {
      setParsedData({
        documents: [],
        format: 'json',
        errors: ['Failed to read file'],
      });
    };

    reader.readAsText(file);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  }, [parseFile]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.json') || file.name.endsWith('.csv'))) {
      parseFile(file);
    } else {
      toast.error('Please drop a JSON or CSV file');
    }
  }, [parseFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parsedData || parsedData.documents.length === 0) return;

    setIsImporting(true);

    try {
      const result = await onImport(parsedData.documents);

      if (result.failed === 0) {
        toast.success(`Imported ${result.success} ${labels.itemLabelPlural.toLowerCase()}`);
        handleOpenChange(false);
      } else {
        toast.warning(`Imported ${result.success}, failed ${result.failed}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, onImport, labels, handleOpenChange]);

  // Clear selected file
  const handleClear = useCallback(() => {
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title={`Import ${labels.itemLabelPlural}`} className="max-w-lg">
        <div className="space-y-4">
          {/* File drop zone */}
          {!parsedData ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dragOver
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-text-tertiary hover:bg-bg-tertiary'
              )}
            >
              <Upload className={cn('w-10 h-10 mx-auto mb-3', dragOver ? 'text-accent' : 'text-text-tertiary')} />
              <p className="text-sm text-text-primary mb-1">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-text-tertiary">
                Supports JSON and CSV files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary border border-border">
                <div className="flex items-center gap-3">
                  {parsedData.format === 'json' ? (
                    <FileJson className="w-8 h-8 text-accent" />
                  ) : (
                    <FileSpreadsheet className="w-8 h-8 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {parsedData.format.toUpperCase()} File
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {parsedData.documents.length} {labels.itemLabelPlural.toLowerCase()} found
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Errors */}
              {parsedData.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                    <div>
                      {parsedData.errors.map((error, i) => (
                        <p key={i} className="text-sm text-error">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              {parsedData.documents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-text-tertiary">Preview (first 3 {labels.itemLabelPlural.toLowerCase()}):</p>
                  <div className="max-h-48 overflow-auto rounded border border-border bg-bg-primary">
                    <pre className="p-3 text-xs font-mono text-text-secondary">
                      {JSON.stringify(parsedData.documents.slice(0, 3), null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Success indicator */}
              {parsedData.documents.length > 0 && parsedData.errors.length === 0 && (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Ready to import {parsedData.documents.length} {labels.itemLabelPlural.toLowerCase()}
                </div>
              )}
            </div>
          )}

          {/* Target info */}
          <div className="text-xs text-text-tertiary">
            Importing to: <span className="font-mono text-text-secondary">{tableName}</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" disabled={isImporting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={isImporting || !parsedData || parsedData.documents.length === 0 || parsedData.errors.length > 0}
          >
            {isImporting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportModal;
