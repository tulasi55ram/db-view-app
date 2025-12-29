/**
 * ExportModal
 *
 * Modal for exporting documents to JSON or CSV format.
 */

import { useState, useCallback, useMemo } from 'react';
import { Download, FileJson, FileSpreadsheet, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/primitives/Dialog';
import { Button } from '@/primitives';
import { getElectronAPI } from '@/electron';
import { toast } from 'sonner';
import type { DocumentItem, DocumentDbType } from '../types';
import { DB_LABELS } from '../types';

interface ExportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Documents to export */
  documents: DocumentItem[];
  /** Selected document IDs (for exporting selection) */
  selectedIds?: Set<string>;
  /** Database type for terminology */
  dbType: DocumentDbType;
  /** Collection/table name */
  tableName: string;
}

type ExportFormat = 'json' | 'csv';
type ExportScope = 'all' | 'selected' | 'current';

interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  prettyPrint: boolean;
  includeIds: boolean;
  flattenNested: boolean;
}

/**
 * Flatten a nested object for CSV export
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[fullKey] = '';
    } else if (Array.isArray(value)) {
      result[fullKey] = JSON.stringify(value);
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (value instanceof Date) {
      result[fullKey] = value.toISOString();
    } else {
      result[fullKey] = String(value);
    }
  }

  return result;
}

/**
 * Convert documents to CSV string
 */
function documentsToCSV(
  documents: DocumentItem[],
  includeIds: boolean,
  flattenNested: boolean
): string {
  if (documents.length === 0) return '';

  // Get all unique keys
  const allKeys = new Set<string>();
  const flattenedDocs: Record<string, string>[] = [];

  for (const doc of documents) {
    const flatDoc = flattenNested
      ? flattenObject(doc._source)
      : Object.fromEntries(
          Object.entries(doc._source).map(([k, v]) => [
            k,
            typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
          ])
        );

    if (includeIds) {
      flatDoc._id = doc._id;
    }

    flattenedDocs.push(flatDoc);
    Object.keys(flatDoc).forEach((k) => allKeys.add(k));
  }

  // Sort keys (put _id first if present)
  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    if (a === '_id') return -1;
    if (b === '_id') return 1;
    return a.localeCompare(b);
  });

  // Build CSV
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const header = sortedKeys.map(escapeCSV).join(',');
  const rows = flattenedDocs.map((doc) =>
    sortedKeys.map((key) => escapeCSV(doc[key] ?? '')).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Convert documents to JSON string
 */
function documentsToJSON(
  documents: DocumentItem[],
  includeIds: boolean,
  prettyPrint: boolean
): string {
  const data = documents.map((doc) => {
    if (includeIds) {
      return { _id: doc._id, ...doc._source };
    }
    return doc._source;
  });

  return prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

export function ExportModal({
  open,
  onClose,
  documents,
  selectedIds,
  dbType,
  tableName,
}: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    scope: 'all',
    prettyPrint: true,
    includeIds: true,
    flattenNested: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const labels = DB_LABELS[dbType];
  const api = getElectronAPI();

  // Calculate document counts
  const counts = useMemo(() => ({
    all: documents.length,
    selected: selectedIds?.size ?? 0,
  }), [documents.length, selectedIds?.size]);

  // Get documents to export based on scope
  const getDocumentsToExport = useCallback((): DocumentItem[] => {
    switch (options.scope) {
      case 'selected':
        return documents.filter((d) => selectedIds?.has(d._id));
      case 'all':
      default:
        return documents;
    }
  }, [documents, selectedIds, options.scope]);

  // Handle export
  const handleExport = useCallback(async () => {
    const docsToExport = getDocumentsToExport();

    if (docsToExport.length === 0) {
      toast.error('No documents to export');
      return;
    }

    setIsExporting(true);

    try {
      let content: string;
      let extension: string;

      if (options.format === 'json') {
        content = documentsToJSON(docsToExport, options.includeIds, options.prettyPrint);
        extension = 'json';
      } else {
        content = documentsToCSV(docsToExport, options.includeIds, options.flattenNested);
        extension = 'csv';
      }

      // Use Electron API to save file if available
      if (api && api.showSaveDialog) {
        const result = await api.showSaveDialog({
          defaultPath: `${tableName}_export.${extension}`,
          filters: [
            options.format === 'json'
              ? { name: 'JSON', extensions: ['json'] }
              : { name: 'CSV', extensions: ['csv'] },
          ],
        });

        if (!result.canceled && result.filePaths[0]) {
          // For now, we'll copy to clipboard as file writing needs backend support
          await api.copyToClipboard(content);
          toast.success(`Exported ${docsToExport.length} ${labels.itemLabelPlural.toLowerCase()} (copied to clipboard)`);
          onClose();
        }
      } else {
        // Fallback: Download via browser
        const blob = new Blob([content], {
          type: options.format === 'json' ? 'application/json' : 'text/csv',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tableName}_export.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${docsToExport.length} ${labels.itemLabelPlural.toLowerCase()}`);
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [getDocumentsToExport, options, api, tableName, labels, onClose]);

  // Update option
  const updateOption = <K extends keyof ExportOptions>(
    key: K,
    value: ExportOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`Export ${labels.itemLabelPlural}`} className="max-w-md">
        <div className="space-y-5">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateOption('format', 'json')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  options.format === 'json'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-bg-tertiary text-text-secondary hover:border-text-tertiary'
                )}
              >
                <FileJson className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm font-medium">JSON</div>
                  <div className="text-xs opacity-70">Structured data</div>
                </div>
                {options.format === 'json' && (
                  <Check className="w-4 h-4 ml-auto" />
                )}
              </button>
              <button
                onClick={() => updateOption('format', 'csv')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  options.format === 'csv'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-bg-tertiary text-text-secondary hover:border-text-tertiary'
                )}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm font-medium">CSV</div>
                  <div className="text-xs opacity-70">Spreadsheet</div>
                </div>
                {options.format === 'csv' && (
                  <Check className="w-4 h-4 ml-auto" />
                )}
              </button>
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              {labels.itemLabelPlural} to Export
            </label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                <input
                  type="radio"
                  checked={options.scope === 'all'}
                  onChange={() => updateOption('scope', 'all')}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">
                  All loaded ({counts.all})
                </span>
              </label>
              {counts.selected > 0 && (
                <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="radio"
                    checked={options.scope === 'selected'}
                    onChange={() => updateOption('scope', 'selected')}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">
                    Selected only ({counts.selected})
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Options</label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeIds}
                  onChange={(e) => updateOption('includeIds', e.target.checked)}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">Include document IDs</span>
              </label>

              {options.format === 'json' && (
                <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.prettyPrint}
                    onChange={(e) => updateOption('prettyPrint', e.target.checked)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Pretty print (formatted)</span>
                </label>
              )}

              {options.format === 'csv' && (
                <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.flattenNested}
                    onChange={(e) => updateOption('flattenNested', e.target.checked)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Flatten nested objects</span>
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" disabled={isExporting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportModal;
