/**
 * useSqlCrud - Hook for CRUD operations in SqlDataView
 */
import { useCallback, useState } from 'react';
import type { ColumnMetadata } from '@dbview/types';
import { toast } from 'sonner';

interface UseSqlCrudProps {
  schema: string;
  table: string;
  columns: ColumnMetadata[] | undefined;
  rows: Record<string, unknown>[];
  editing: {
    pendingEdits: Map<string, { rowIndex: number; columnKey: string; newValue: unknown }>;
    selectedRows: Set<number>;
    discardAllEdits: () => void;
    clearSelection: () => void;
  };
  vscode: ReturnType<typeof import('../../../vscode').getVsCodeApi>;
}

export function useSqlCrud({
  schema,
  table,
  columns,
  rows,
  editing,
  vscode,
}: UseSqlCrudProps) {
  // Insert operation state
  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [duplicateRowData, setDuplicateRowData] = useState<Record<string, unknown> | undefined>(undefined);

  const hasPendingChanges = editing.pendingEdits.size > 0;
  const hasSelectedRows = editing.selectedRows.size > 0;

  // Save pending changes
  const handleSaveChanges = useCallback(() => {
    if (!columns || editing.pendingEdits.size === 0) return;

    const primaryKeyColumns = columns.filter(col => col.isPrimaryKey).map(col => col.name);
    if (primaryKeyColumns.length === 0) {
      toast.error("Cannot save changes", {
        description: "This table has no primary key defined"
      });
      return;
    }

    const edits = Array.from(editing.pendingEdits.values()).map(edit => {
      const row = rows[edit.rowIndex];
      const primaryKey: Record<string, unknown> = {};
      primaryKeyColumns.forEach(col => {
        primaryKey[col] = row[col];
      });
      return {
        primaryKey,
        columnKey: edit.columnKey,
        newValue: edit.newValue
      };
    });

    vscode?.postMessage({ type: "COMMIT_CHANGES", schema, table, edits });
    editing.discardAllEdits(true); // Silent - don't show "discarded" toast when saving
  }, [columns, editing, rows, vscode, schema, table]);

  // Request delete confirmation from VS Code
  const handleDeleteRows = useCallback(() => {
    if (!columns || editing.selectedRows.size === 0) return;
    vscode?.postMessage({
      type: "CONFIRM_DELETE",
      rowCount: editing.selectedRows.size
    });
  }, [columns, editing.selectedRows, vscode]);

  // Execute the actual delete after confirmation
  const executeDelete = useCallback(() => {
    if (!columns || editing.selectedRows.size === 0) return;

    const primaryKeyColumns = columns.filter(col => col.isPrimaryKey).map(col => col.name);
    const selectedIndices = Array.from(editing.selectedRows);
    const primaryKeys = selectedIndices.map(idx => {
      const row = rows[idx];
      const pk: Record<string, unknown> = {};
      primaryKeyColumns.forEach(col => {
        pk[col] = row[col];
      });
      return pk;
    });

    vscode?.postMessage({ type: "DELETE_ROWS", schema, table, primaryKeys });
    editing.clearSelection();
  }, [columns, editing, rows, vscode, schema, table]);

  // Open insert modal
  const handleInsertRow = useCallback(() => {
    setDuplicateRowData(undefined);
    setInsertError(null);
    setIsInserting(false);
    setInsertModalOpen(true);
  }, []);

  // Duplicate a selected row
  const handleDuplicateRow = useCallback(() => {
    if (!hasSelectedRows || editing.selectedRows.size !== 1) {
      toast.error("Select exactly one row to duplicate");
      return;
    }

    const selectedRowIndex = Array.from(editing.selectedRows)[0];
    const selectedRow = rows[selectedRowIndex];

    if (selectedRow) {
      setDuplicateRowData(selectedRow);
      setInsertError(null);
      setIsInserting(false);
      setInsertModalOpen(true);
    }
  }, [hasSelectedRows, editing.selectedRows, rows]);

  // Perform the insert
  const handleInsert = useCallback((values: Record<string, unknown>) => {
    setIsInserting(true);
    setInsertError(null);
    vscode?.postMessage({ type: "INSERT_ROW", schema, table, values });
  }, [vscode, schema, table]);

  return {
    // State
    isInserting,
    insertError,
    insertModalOpen,
    duplicateRowData,
    hasPendingChanges,
    hasSelectedRows,

    // State setters
    setIsInserting,
    setInsertError,
    setInsertModalOpen,
    setDuplicateRowData,

    // Operations
    handleSaveChanges,
    handleDeleteRows,
    executeDelete,
    handleInsertRow,
    handleDuplicateRow,
    handleInsert,
  };
}
