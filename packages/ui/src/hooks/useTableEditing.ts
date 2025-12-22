import { useState, useCallback } from 'react';
import type { CellEdit, ColumnMetadata } from '@dbview/core';
import { toast } from 'sonner';

export function useTableEditing(
  rows: Record<string, unknown>[],
  columns: ColumnMetadata[]
) {
  const [pendingEdits, setPendingEdits] = useState<Map<string, CellEdit>>(new Map());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const getCellKey = (rowIndex: number, columnKey: string) => `${rowIndex}:${columnKey}`;

  const startEdit = useCallback((rowIndex: number, columnKey: string) => {
    const column = columns.find(c => c.name === columnKey);
    if (!column?.editable) {
      toast.error(`Column "${columnKey}" is not editable`);
      return false;
    }
    setEditingCell({ rowIndex, columnKey });
    return true;
  }, [columns]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const saveEdit = useCallback((rowIndex: number, columnKey: string, newValue: unknown) => {
    const key = getCellKey(rowIndex, columnKey);
    const originalValue = rows[rowIndex]?.[columnKey];

    // Don't track if value hasn't changed
    if (originalValue === newValue) {
      setEditingCell(null);
      return;
    }

    const edit: CellEdit = {
      rowIndex,
      columnKey,
      originalValue,
      newValue,
      timestamp: Date.now(),
    };

    setPendingEdits(prev => new Map(prev).set(key, edit));
    setEditingCell(null);
    toast.success('Change tracked', { description: 'Click Save to commit' });
  }, [rows]);

  const discardEdit = useCallback((rowIndex: number, columnKey: string) => {
    const key = getCellKey(rowIndex, columnKey);
    setPendingEdits(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const discardAllEdits = useCallback(() => {
    setPendingEdits(new Map());
    setErrors(new Map());
    toast.info('All changes discarded');
  }, []);

  const toggleRowSelection = useCallback((rowIndex: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, []);

  const setRowSelection = useCallback((selectedRowSet: Set<number>) => {
    setSelectedRows(selectedRowSet);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const isPending = useCallback((rowIndex: number, columnKey: string) => {
    return pendingEdits.has(getCellKey(rowIndex, columnKey));
  }, [pendingEdits]);

  const hasError = useCallback((rowIndex: number, columnKey: string) => {
    return errors.has(getCellKey(rowIndex, columnKey));
  }, [errors]);

  const getEditValue = useCallback((rowIndex: number, columnKey: string) => {
    const key = getCellKey(rowIndex, columnKey);
    return pendingEdits.get(key)?.newValue;
  }, [pendingEdits]);

  return {
    // State
    pendingEdits,
    selectedRows,
    editingCell,
    errors,

    // Actions
    startEdit,
    cancelEdit,
    saveEdit,
    discardEdit,
    discardAllEdits,
    toggleRowSelection,
    setRowSelection,
    clearSelection,

    // Queries
    isPending,
    hasError,
    getEditValue,
  };
}
