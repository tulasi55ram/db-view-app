/**
 * Markdown Export Functions
 * @dbview/core - Phase 3: Export/Import
 */

import type { MarkdownExportOptions, RowData } from './types.js';

/**
 * Default Markdown export options
 */
const DEFAULT_OPTIONS: Required<MarkdownExportOptions> = {
  alignment: 'left',
  maxColumnWidth: 0, // 0 = no limit
  nullValue: '',
};

/**
 * Convert rows to Markdown table format
 *
 * @param rows - Array of row objects
 * @param columns - Column names to include
 * @param options - Export options
 * @returns Markdown table string
 *
 * @example
 * ```ts
 * const md = toMarkdown(
 *   [{ name: 'John', age: 30 }],
 *   ['name', 'age']
 * );
 * // | name | age |
 * // |:-----|:----|
 * // | John | 30  |
 * ```
 */
export function toMarkdown(
  rows: RowData[],
  columns: string[],
  options: MarkdownExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // Calculate column widths for alignment
  const widths = calculateColumnWidths(rows, columns, opts);

  // Header row
  const headerCells = columns.map((col, i) => padCell(col, widths[i], 'left'));
  lines.push(`| ${headerCells.join(' | ')} |`);

  // Separator row with alignment indicators
  const separatorCells = columns.map((col, i) => {
    const align = getColumnAlignment(col, opts.alignment);
    return createSeparator(widths[i], align);
  });
  lines.push(`|${separatorCells.join('|')}|`);

  // Data rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const value = formatValue(row[col], opts.nullValue, opts.maxColumnWidth);
      const align = getColumnAlignment(col, opts.alignment);
      return padCell(value, widths[i], align);
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Calculate column widths based on content
 */
function calculateColumnWidths(
  rows: RowData[],
  columns: string[],
  opts: Required<MarkdownExportOptions>
): number[] {
  const widths: number[] = columns.map((col) => col.length);

  for (const row of rows) {
    columns.forEach((col, i) => {
      const value = formatValue(row[col], opts.nullValue, opts.maxColumnWidth);
      widths[i] = Math.max(widths[i], value.length);
    });
  }

  // Apply max width if specified
  if (opts.maxColumnWidth > 0) {
    return widths.map((w) => Math.min(w, opts.maxColumnWidth));
  }

  // Ensure minimum width of 3 for separator
  return widths.map((w) => Math.max(w, 3));
}

/**
 * Get alignment for a specific column
 */
function getColumnAlignment(
  column: string,
  alignment: MarkdownExportOptions['alignment']
): 'left' | 'center' | 'right' {
  if (typeof alignment === 'object') {
    return alignment[column] || 'left';
  }
  return alignment || 'left';
}

/**
 * Create separator cell with alignment indicators
 */
function createSeparator(width: number, align: 'left' | 'center' | 'right'): string {
  const dashes = '-'.repeat(Math.max(width, 1));

  switch (align) {
    case 'center':
      return `:${dashes}:`;
    case 'right':
      return `${dashes}:`;
    case 'left':
    default:
      return `:${dashes}`;
  }
}

/**
 * Pad cell content to width with alignment
 */
function padCell(value: string, width: number, align: 'left' | 'center' | 'right'): string {
  const padding = Math.max(0, width - value.length);

  switch (align) {
    case 'center': {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + value + ' '.repeat(right);
    }
    case 'right':
      return ' '.repeat(padding) + value;
    case 'left':
    default:
      return value + ' '.repeat(padding);
  }
}

/**
 * Format a value for Markdown output
 */
function formatValue(value: unknown, nullValue: string, maxWidth: number): string {
  let result: string;

  if (value === null || value === undefined) {
    result = nullValue;
  } else if (value instanceof Date) {
    result = value.toISOString();
  } else if (typeof value === 'object') {
    result = JSON.stringify(value);
  } else {
    result = String(value);
  }

  // Escape pipe characters in Markdown tables
  result = result.replace(/\|/g, '\\|');

  // Handle newlines
  result = result.replace(/\n/g, '<br>');

  // Truncate if needed
  if (maxWidth > 0 && result.length > maxWidth) {
    result = result.substring(0, maxWidth - 3) + '...';
  }

  return result;
}
