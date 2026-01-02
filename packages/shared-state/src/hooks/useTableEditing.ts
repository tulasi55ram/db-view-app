/**
 * useTableEditing - Shared hook for table cell editing state management
 *
 * Manages:
 * - Pending cell edits (tracked changes not yet committed)
 * - Row selection
 * - Currently editing cell
 * - Edit validation errors
 *
 * Uses callback pattern for notifications to be UI-framework agnostic.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import type { CellEdit, ColumnMetadata } from '@dbview/types';

/**
 * Options for useTableEditing hook
 */
export interface UseTableEditingOptions {
  /**
   * Function to get a stable unique ID for a row.
   * If provided, edits are keyed by this ID instead of row index,
   * making them stable across sorting, filtering, and pagination.
   *
   * @example
   * ```tsx
   * // Using primary key
   * getRowId: (row) => String(row.id)
   *
   * // Using composite key
   * getRowId: (row) => `${row.schema}.${row.table}.${row.id}`
   * ```
   */
  getRowId?: (row: Record<string, unknown>, rowIndex: number) => string;

  /** Called when edit is saved/tracked */
  onEditSaved?: (rowId: string, columnKey: string) => void;
  /** Called when edit is discarded */
  onEditDiscarded?: (rowId: string, columnKey: string) => void;
  /** Called when all edits are discarded */
  onAllEditsDiscarded?: (count: number) => void;
  /** Called when edits are cleared due to data change */
  onEditsInvalidated?: (count: number, reason: string) => void;
  /** Called when an error occurs (e.g., column not editable) */
  onError?: (message: string) => void;
}

/**
 * Return type for useTableEditing hook
 */
export interface UseTableEditingResult {
  // State
  pendingEdits: Map<string, CellEdit>;
  selectedRows: Set<number>;
  editingCell: { rowIndex: number; columnKey: string } | null;
  errors: Map<string, string>;

  // Actions - rowIndex is still used for UI interaction, internally converted to rowId
  startEdit: (rowIndex: number, columnKey: string) => boolean;
  cancelEdit: () => void;
  saveEdit: (rowIndex: number, columnKey: string, newValue: unknown) => void;
  discardEdit: (rowIndex: number, columnKey: string) => void;
  discardAllEdits: (silent?: boolean) => void;
  toggleRowSelection: (rowIndex: number) => void;
  setRowSelection: (selectedRowSet: Set<number>) => void;
  clearSelection: () => void;
  selectAllRows: (rowCount: number) => void;
  selectRowRange: (startIndex: number, endIndex: number) => void;

  // Queries
  isPending: (rowIndex: number, columnKey: string) => boolean;
  hasError: (rowIndex: number, columnKey: string) => boolean;
  getEditValue: (rowIndex: number, columnKey: string) => unknown | undefined;
  getPendingEditCount: () => number;

  // Utility
  getRowId: (rowIndex: number) => string;

  // Setters for state sync
  setErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setPendingEdits: React.Dispatch<React.SetStateAction<Map<string, CellEdit>>>;
}

/**
 * Generate a unique key for a cell based on row ID and column
 */
function getCellKey(rowId: string, columnKey: string): string {
  return `${rowId}:${columnKey}`;
}

/**
 * Default row ID generator using index (not stable across data changes)
 */
function defaultGetRowId(_row: Record<string, unknown>, rowIndex: number): string {
  return `idx:${rowIndex}`;
}

/**
 * Hook for managing table editing state.
 *
 * @param rows - Current row data
 * @param columns - Column metadata
 * @param options - Options including getRowId and callbacks
 * @returns Editing state and actions
 *
 * @example
 * ```tsx
 * const editing = useTableEditing(rows, metadata, {
 *   // Use primary key for stable edit tracking
 *   getRowId: (row) => String(row.id),
 *   onEditSaved: () => toast.success('Change tracked'),
 *   onAllEditsDiscarded: (count) => toast.info(`Discarded ${count} changes`),
 *   onError: (msg) => toast.error(msg),
 * });
 * ```
 */
export function useTableEditing(
  rows: Record<string, unknown>[],
  columns: ColumnMetadata[],
  options: UseTableEditingOptions = {}
): UseTableEditingResult {
  const {
    getRowId: getRowIdOption,
    onEditSaved,
    onEditDiscarded,
    onAllEditsDiscarded,
    onEditsInvalidated,
    onError,
  } = options;

  // Use provided getRowId or fall back to index-based (unstable)
  const hasStableIds = !!getRowIdOption;
  const getRowIdFn = getRowIdOption ?? defaultGetRowId;

  const [pendingEdits, setPendingEdits] = useState<Map<string, CellEdit>>(new Map());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Track previous rows reference to detect data changes
  const prevRowsRef = useRef(rows);

  // Clear edits when rows change if not using stable IDs
  // This prevents edits from being applied to wrong rows after sort/filter/pagination
  useEffect(() => {
    if (prevRowsRef.current !== rows) {
      prevRowsRef.current = rows;

      // If using unstable index-based IDs, clear pending edits and selection
      // because the same indexes now point to different rows
      if (!hasStableIds && pendingEdits.size > 0) {
        const count = pendingEdits.size;
        setPendingEdits(new Map());
        setErrors(new Map());
        setSelectedRows(new Set());
        setEditingCell(null);
        onEditsInvalidated?.(count, 'Data changed - edits cleared to prevent misapplication');
      }
    }
  }, [rows, hasStableIds, pendingEdits.size, onEditsInvalidated]);

  /**
   * Get a stable row ID for a given row index
   */
  const getRowId = useCallback((rowIndex: number): string => {
    const row = rows[rowIndex];
    if (!row) return `idx:${rowIndex}`;
    return getRowIdFn(row, rowIndex);
  }, [rows, getRowIdFn]);

  /**
   * Start editing a cell. Returns false if column is not editable.
   */
  const startEdit = useCallback((rowIndex: number, columnKey: string): boolean => {
    const column = columns.find(c => c.name === columnKey);
    if (!column?.editable) {
      onError?.(`Column "${columnKey}" is not editable`);
      return false;
    }
    setEditingCell({ rowIndex, columnKey });
    return true;
  }, [columns, onError]);

  /**
   * Cancel current edit without saving
   */
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  /**
   * Save edit - adds to pending edits if value changed
   */
  const saveEdit = useCallback((rowIndex: number, columnKey: string, newValue: unknown) => {
    const rowId = getRowId(rowIndex);
    const key = getCellKey(rowId, columnKey);
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
    onEditSaved?.(rowId, columnKey);
  }, [rows, getRowId, onEditSaved]);

  /**
   * Discard a specific edit
   */
  const discardEdit = useCallback((rowIndex: number, columnKey: string) => {
    const rowId = getRowId(rowIndex);
    const key = getCellKey(rowId, columnKey);
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
    onEditDiscarded?.(rowId, columnKey);
  }, [getRowId, onEditDiscarded]);

  /**
   * Discard all pending edits
   */
  const discardAllEdits = useCallback((silent = false) => {
    const count = pendingEdits.size;
    setPendingEdits(new Map());
    setErrors(new Map());
    if (!silent && count > 0) {
      onAllEditsDiscarded?.(count);
    }
  }, [pendingEdits.size, onAllEditsDiscarded]);

  /**
   * Toggle selection state for a row
   */
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

  /**
   * Set row selection directly
   */
  const setRowSelection = useCallback((selectedRowSet: Set<number>) => {
    setSelectedRows(selectedRowSet);
  }, []);

  /**
   * Clear all row selections
   */
  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  /**
   * Select all rows (0 to rowCount-1)
   */
  const selectAllRows = useCallback((rowCount: number) => {
    const allRows = new Set<number>();
    for (let i = 0; i < rowCount; i++) {
      allRows.add(i);
    }
    setSelectedRows(allRows);
  }, []);

  /**
   * Select a range of rows (inclusive)
   */
  const selectRowRange = useCallback((startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    setSelectedRows(prev => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) {
        next.add(i);
      }
      return next;
    });
  }, []);

  /**
   * Check if a cell has pending edits
   */
  const isPending = useCallback((rowIndex: number, columnKey: string): boolean => {
    const rowId = getRowId(rowIndex);
    return pendingEdits.has(getCellKey(rowId, columnKey));
  }, [getRowId, pendingEdits]);

  /**
   * Check if a cell has an error
   */
  const hasError = useCallback((rowIndex: number, columnKey: string): boolean => {
    const rowId = getRowId(rowIndex);
    return errors.has(getCellKey(rowId, columnKey));
  }, [getRowId, errors]);

  /**
   * Get the pending edit value for a cell
   */
  const getEditValue = useCallback((rowIndex: number, columnKey: string): unknown | undefined => {
    const rowId = getRowId(rowIndex);
    const key = getCellKey(rowId, columnKey);
    return pendingEdits.get(key)?.newValue;
  }, [getRowId, pendingEdits]);

  /**
   * Get total count of pending edits
   */
  const getPendingEditCount = useCallback((): number => {
    return pendingEdits.size;
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
    selectAllRows,
    selectRowRange,

    // Queries
    isPending,
    hasError,
    getEditValue,
    getPendingEditCount,

    // Utility
    getRowId,

    // Setters for advanced usage
    setErrors,
    setPendingEdits,
  };
}
