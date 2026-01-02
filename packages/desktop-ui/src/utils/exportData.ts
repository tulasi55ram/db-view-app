/**
 * Export utilities for query results
 */

export interface ExportOptions {
  filename?: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ExportResult {
  success: boolean;
  error?: string;
}

/**
 * Safely stringify a value, handling circular references
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[Object with circular reference]';
  }
}

/**
 * Export data to CSV format
 */
export function exportToCSV({ filename = 'query_results', columns, rows }: ExportOptions): ExportResult {
  if (columns.length === 0) {
    return { success: false, error: 'No columns to export' };
  }
  if (rows.length === 0) {
    return { success: false, error: 'No rows to export' };
  }

  // Escape CSV values (uses safeStringify to handle circular references)
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'object' ? safeStringify(value) : String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV content
  const header = columns.map(escapeCSV).join(',');
  const dataRows = rows.map(row =>
    columns.map(col => escapeCSV(row[col])).join(',')
  );
  const csvContent = [header, ...dataRows].join('\n');

  // Download file
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  return { success: true };
}

/**
 * Export data to JSON format
 */
export function exportToJSON({ filename = 'query_results', columns, rows }: ExportOptions): ExportResult {
  if (columns.length === 0) {
    return { success: false, error: 'No columns to export' };
  }
  if (rows.length === 0) {
    return { success: false, error: 'No rows to export' };
  }

  // Filter rows to only include specified columns (in case of extra properties)
  const filteredRows = rows.map(row => {
    const filtered: Record<string, unknown> = {};
    columns.forEach(col => {
      filtered[col] = row[col];
    });
    return filtered;
  });

  // Use try-catch to handle potential circular references
  let jsonContent: string;
  try {
    jsonContent = JSON.stringify(filteredRows, null, 2);
  } catch {
    // Handle circular references by converting each row individually
    const safeRows = filteredRows.map(row => {
      const safeRow: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        const value = row[key];
        if (typeof value === 'object' && value !== null) {
          safeRow[key] = safeStringify(value);
        } else {
          safeRow[key] = value;
        }
      }
      return safeRow;
    });
    jsonContent = JSON.stringify(safeRows, null, 2);
  }

  // Download file
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
  return { success: true };
}

/**
 * Copy data to clipboard as tab-separated values (for pasting into spreadsheets)
 * Returns an object with success status and optional error message
 */
export interface ClipboardResult {
  success: boolean;
  error?: string;
  fallbackUsed?: boolean;
}

export async function copyToClipboardAsTSV({ columns, rows }: ExportOptions): Promise<ClipboardResult> {
  if (columns.length === 0 || rows.length === 0) {
    return { success: false, error: 'No data to copy' };
  }

  const escapeTSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'object' ? safeStringify(value) : String(value);
    // Replace tabs and newlines
    return str.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
  };

  const header = columns.join('\t');
  const dataRows = rows.map(row =>
    columns.map(col => escapeTSV(row[col])).join('\t')
  );
  const tsvContent = [header, ...dataRows].join('\n');

  // Try modern clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(tsvContent);
      return { success: true };
    } catch (err) {
      // Check if it's a permission error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        console.warn('Clipboard permission denied, trying fallback:', err);
        // Try fallback method
        const fallbackResult = copyToClipboardFallback(tsvContent);
        if (fallbackResult) {
          return { success: true, fallbackUsed: true };
        }
        return {
          success: false,
          error: 'Clipboard permission denied. Please allow clipboard access or try the download option.',
        };
      }

      console.error('Failed to copy to clipboard:', err);
      // Try fallback for other errors too
      const fallbackResult = copyToClipboardFallback(tsvContent);
      if (fallbackResult) {
        return { success: true, fallbackUsed: true };
      }
      return { success: false, error: errorMessage };
    }
  }

  // Fallback for browsers without clipboard API
  const fallbackResult = copyToClipboardFallback(tsvContent);
  if (fallbackResult) {
    return { success: true, fallbackUsed: true };
  }
  return { success: false, error: 'Clipboard API not available' };
}

/**
 * Fallback clipboard copy using execCommand (deprecated but widely supported)
 */
function copyToClipboardFallback(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Helper to download a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
