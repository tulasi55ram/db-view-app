/**
 * Export utilities for query results
 */

export interface ExportOptions {
  filename?: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * Export data to CSV format
 */
export function exportToCSV({ filename = 'query_results', columns, rows }: ExportOptions): void {
  if (columns.length === 0 || rows.length === 0) {
    return;
  }

  // Escape CSV values
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
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
}

/**
 * Export data to JSON format
 */
export function exportToJSON({ filename = 'query_results', columns, rows }: ExportOptions): void {
  if (rows.length === 0) {
    return;
  }

  // Filter rows to only include specified columns (in case of extra properties)
  const filteredRows = rows.map(row => {
    const filtered: Record<string, unknown> = {};
    columns.forEach(col => {
      filtered[col] = row[col];
    });
    return filtered;
  });

  const jsonContent = JSON.stringify(filteredRows, null, 2);

  // Download file
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
}

/**
 * Copy data to clipboard as tab-separated values (for pasting into spreadsheets)
 */
export async function copyToClipboardAsTSV({ columns, rows }: ExportOptions): Promise<boolean> {
  if (columns.length === 0 || rows.length === 0) {
    return false;
  }

  const escapeTSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Replace tabs and newlines
    return str.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
  };

  const header = columns.join('\t');
  const dataRows = rows.map(row =>
    columns.map(col => escapeTSV(row[col])).join('\t')
  );
  const tsvContent = [header, ...dataRows].join('\n');

  try {
    await navigator.clipboard.writeText(tsvContent);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
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
