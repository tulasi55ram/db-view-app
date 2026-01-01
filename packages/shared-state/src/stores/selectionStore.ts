/**
 * Selection Store - Zustand store for managing row/document selection
 *
 * Features:
 * - Per-tab selection state (multiple tabs can have different selections)
 * - Row selection (for SQL tables)
 * - Row expansion (for nested JSON/documents)
 * - Document selection (for MongoDB/document databases)
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface SelectionState {
  // Per-tab selection state (keyed by tabId)
  selectedRows: Record<string, Set<number>>;
  expandedRows: Record<string, Set<string>>;
  selectedDocId: Record<string, string | null>;

  // Editing state
  editingCell: { tabId: string; rowIndex: number; columnKey: string } | null;
}

interface SelectionActions {
  // Row selection
  selectRow: (tabId: string, rowIndex: number) => void;
  deselectRow: (tabId: string, rowIndex: number) => void;
  toggleRowSelection: (tabId: string, rowIndex: number) => void;
  selectAllRows: (tabId: string, rowCount: number) => void;
  selectRowRange: (tabId: string, startIndex: number, endIndex: number) => void;
  clearSelection: (tabId: string) => void;

  // Row expansion
  toggleRowExpand: (tabId: string, rowId: string) => void;
  expandRow: (tabId: string, rowId: string) => void;
  collapseRow: (tabId: string, rowId: string) => void;
  expandAllRows: (tabId: string, rowIds: string[]) => void;
  collapseAllRows: (tabId: string) => void;

  // Document selection (MongoDB)
  setSelectedDoc: (tabId: string, docId: string | null) => void;

  // Editing
  setEditingCell: (cell: { tabId: string; rowIndex: number; columnKey: string } | null) => void;
  clearEditingCell: () => void;

  // Cleanup
  clearTabSelection: (tabId: string) => void;

  // Getters
  getSelectedRows: (tabId: string) => Set<number>;
  getExpandedRows: (tabId: string) => Set<string>;
  getSelectedRowCount: (tabId: string) => number;
  isRowSelected: (tabId: string, rowIndex: number) => boolean;
  isRowExpanded: (tabId: string, rowId: string) => boolean;
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedRows: {},
      expandedRows: {},
      selectedDocId: {},
      editingCell: null,

      // Row selection
      selectRow: (tabId, rowIndex) =>
        set(
          (state) => {
            const current = state.selectedRows[tabId] ?? new Set();
            return {
              selectedRows: {
                ...state.selectedRows,
                [tabId]: new Set([...current, rowIndex]),
              },
            };
          },
          false,
          'selectRow'
        ),

      deselectRow: (tabId, rowIndex) =>
        set(
          (state) => {
            const current = new Set(state.selectedRows[tabId] ?? []);
            current.delete(rowIndex);
            return {
              selectedRows: {
                ...state.selectedRows,
                [tabId]: current,
              },
            };
          },
          false,
          'deselectRow'
        ),

      toggleRowSelection: (tabId, rowIndex) => {
        const current = get().selectedRows[tabId] ?? new Set();
        if (current.has(rowIndex)) {
          get().deselectRow(tabId, rowIndex);
        } else {
          get().selectRow(tabId, rowIndex);
        }
      },

      selectAllRows: (tabId, rowCount) =>
        set(
          (state) => ({
            selectedRows: {
              ...state.selectedRows,
              [tabId]: new Set(Array.from({ length: rowCount }, (_, i) => i)),
            },
          }),
          false,
          'selectAllRows'
        ),

      selectRowRange: (tabId, startIndex, endIndex) =>
        set(
          (state) => {
            const current = state.selectedRows[tabId] ?? new Set();
            const newSet = new Set(current);
            const [min, max] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
            for (let i = min; i <= max; i++) {
              newSet.add(i);
            }
            return {
              selectedRows: {
                ...state.selectedRows,
                [tabId]: newSet,
              },
            };
          },
          false,
          'selectRowRange'
        ),

      clearSelection: (tabId) =>
        set(
          (state) => ({
            selectedRows: {
              ...state.selectedRows,
              [tabId]: new Set(),
            },
          }),
          false,
          'clearSelection'
        ),

      // Row expansion
      toggleRowExpand: (tabId, rowId) =>
        set(
          (state) => {
            const current = new Set(state.expandedRows[tabId] ?? []);
            if (current.has(rowId)) {
              current.delete(rowId);
            } else {
              current.add(rowId);
            }
            return {
              expandedRows: {
                ...state.expandedRows,
                [tabId]: current,
              },
            };
          },
          false,
          'toggleRowExpand'
        ),

      expandRow: (tabId, rowId) =>
        set(
          (state) => {
            const current = state.expandedRows[tabId] ?? new Set();
            return {
              expandedRows: {
                ...state.expandedRows,
                [tabId]: new Set([...current, rowId]),
              },
            };
          },
          false,
          'expandRow'
        ),

      collapseRow: (tabId, rowId) =>
        set(
          (state) => {
            const current = new Set(state.expandedRows[tabId] ?? []);
            current.delete(rowId);
            return {
              expandedRows: {
                ...state.expandedRows,
                [tabId]: current,
              },
            };
          },
          false,
          'collapseRow'
        ),

      expandAllRows: (tabId, rowIds) =>
        set(
          (state) => ({
            expandedRows: {
              ...state.expandedRows,
              [tabId]: new Set(rowIds),
            },
          }),
          false,
          'expandAllRows'
        ),

      collapseAllRows: (tabId) =>
        set(
          (state) => ({
            expandedRows: {
              ...state.expandedRows,
              [tabId]: new Set(),
            },
          }),
          false,
          'collapseAllRows'
        ),

      // Document selection
      setSelectedDoc: (tabId, docId) =>
        set(
          (state) => ({
            selectedDocId: {
              ...state.selectedDocId,
              [tabId]: docId,
            },
          }),
          false,
          'setSelectedDoc'
        ),

      // Editing
      setEditingCell: (cell) => set({ editingCell: cell }, false, 'setEditingCell'),
      clearEditingCell: () => set({ editingCell: null }, false, 'clearEditingCell'),

      // Cleanup - call when closing a tab
      clearTabSelection: (tabId) =>
        set(
          (state) => {
            const { [tabId]: _selectedRows, ...restSelectedRows } = state.selectedRows;
            const { [tabId]: _expandedRows, ...restExpandedRows } = state.expandedRows;
            const { [tabId]: _selectedDoc, ...restSelectedDoc } = state.selectedDocId;
            return {
              selectedRows: restSelectedRows,
              expandedRows: restExpandedRows,
              selectedDocId: restSelectedDoc,
              editingCell: state.editingCell?.tabId === tabId ? null : state.editingCell,
            };
          },
          false,
          'clearTabSelection'
        ),

      // Getters
      getSelectedRows: (tabId) => get().selectedRows[tabId] ?? new Set(),
      getExpandedRows: (tabId) => get().expandedRows[tabId] ?? new Set(),
      getSelectedRowCount: (tabId) => (get().selectedRows[tabId] ?? new Set()).size,
      isRowSelected: (tabId, rowIndex) =>
        (get().selectedRows[tabId] ?? new Set()).has(rowIndex),
      isRowExpanded: (tabId, rowId) =>
        (get().expandedRows[tabId] ?? new Set()).has(rowId),
    }),
    { name: 'SelectionStore' }
  )
);

// Selector hooks
export const useTabSelection = (tabId: string) =>
  useSelectionStore((s) => s.selectedRows[tabId] ?? new Set());
export const useTabExpanded = (tabId: string) =>
  useSelectionStore((s) => s.expandedRows[tabId] ?? new Set());
export const useSelectedDocId = (tabId: string) =>
  useSelectionStore((s) => s.selectedDocId[tabId] ?? null);
export const useEditingCell = () => useSelectionStore((s) => s.editingCell);
