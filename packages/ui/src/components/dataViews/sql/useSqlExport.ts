/**
 * useSqlExport - Hook for export/import operations in SqlDataView
 */
import { useCallback } from 'react';
import type { ColumnMetadata, ExportOptions } from '@dbview/types';
import { formatAsCSV, formatAsJSON, formatAsSQL } from '../../../utils/exportFormatters';
import { parseCSV, parseJSON } from '../../../utils/importParsers';
import { toast } from 'sonner';

interface UseSqlExportProps {
  schema: string;
  table: string;
  columns: ColumnMetadata[] | undefined;
  rows: Record<string, unknown>[];
  selectedRows: Set<number>;
  vscode: ReturnType<typeof import('../../../vscode').getVsCodeApi>;
  setImportDialogOpen: (open: boolean) => void;
}

export function useSqlExport({
  schema,
  table,
  columns,
  rows,
  selectedRows,
  vscode,
  setImportDialogOpen,
}: UseSqlExportProps) {

  const handleExport = useCallback((options: ExportOptions) => {
    let dataToExport = rows;
    const columnsToExport = columns?.map(m => m.name) || [];

    if (options.selectedRowsOnly && selectedRows.size > 0) {
      const selectedIndices = Array.from(selectedRows);
      dataToExport = selectedIndices.map(idx => rows[idx]);
    }

    let content: string;
    let extension: string;

    switch (options.format) {
      case 'csv':
        content = formatAsCSV(dataToExport, columnsToExport, options.includeHeaders);
        extension = 'csv';
        break;
      case 'json':
        content = formatAsJSON(dataToExport, columnsToExport);
        extension = 'json';
        break;
      case 'sql':
        content = formatAsSQL(dataToExport, columnsToExport, schema, table);
        extension = 'sql';
        break;
    }

    vscode?.postMessage({
      type: 'EXPORT_DATA',
      schema,
      table,
      content,
      extension,
      mimeType: options.format === 'json' ? 'application/json' : 'text/plain'
    });
  }, [rows, columns, selectedRows, vscode, schema, table]);

  const handleImport = useCallback(async (
    format: 'csv' | 'json',
    content: string,
    hasHeaders?: boolean
  ) => {
    try {
      const { columns: parsedColumns, rows: parsedRows } =
        format === 'csv'
          ? parseCSV(content, hasHeaders)
          : parseJSON(content);

      if (columns) {
        const tableColumns = new Set(columns.map(m => m.name));
        const invalidColumns = parsedColumns.filter(c => !tableColumns.has(c));

        if (invalidColumns.length > 0) {
          toast.error('Invalid columns', {
            description: `Columns not found in table: ${invalidColumns.join(', ')}`
          });
          return;
        }
      }

      vscode?.postMessage({
        type: 'IMPORT_DATA',
        schema,
        table,
        rows: parsedRows
      });

      setImportDialogOpen(false);
      toast.success(`Importing ${parsedRows.length} rows...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Import failed', { description: errorMessage });
    }
  }, [columns, vscode, schema, table, setImportDialogOpen]);

  const handleCopyAsSQL = useCallback(() => {
    if (selectedRows.size === 0) {
      toast.error('No rows selected');
      return;
    }

    const selectedIndices = Array.from(selectedRows);
    const selectedRowsData = selectedIndices.map(idx => rows[idx]);
    const columnsToExport = columns?.map(m => m.name) || [];

    const sql = formatAsSQL(selectedRowsData, columnsToExport, schema, table);

    navigator.clipboard.writeText(sql).then(() => {
      toast.success(`Copied ${selectedIndices.length} rows as INSERT statements`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  }, [selectedRows, rows, columns, schema, table]);

  return {
    handleExport,
    handleImport,
    handleCopyAsSQL,
  };
}
