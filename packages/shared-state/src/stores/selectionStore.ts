/**
 * Selection Store - Zustand store for managing row/document selection
 *
 * Features:
 * - Per-tab selection state (multiple tabs can have different selections)
 * - Row selection (for SQL tables)
 * - Row expansion (for nested JSON/documents)
 * - Document selection (for MongoDB/document databases)
 *
 * Note: Uses arrays instead of Sets for proper JSON serialization
 */
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

interface SelectionState {
  // Per-tab selection state (keyed by tabId)
  // Using arrays instead of Sets for JSON serialization compatibility
  selectedRows: Record<string, number[]>;
  expandedRows: Record<string, string[]>;
  selectedDocId: Record<string, string | null>;

  // Editing state
  editingCell: { tabId: string; rowIndex: number; columnKey: string } | null;
}

// Helper functions for array-based set operations
function addToArray<T>(arr: T[], item: T): T[] {
  if (arr.includes(item)) return arr;
  return [...arr, item];
}

function removeFromArray<T>(arr: T[], item: T): T[] {
  return arr.filter((x) => x !== item);
}

function toggleInArray<T>(arr: T[], item: T): T[] {
  if (arr.includes(item)) {
    return removeFromArray(arr, item);
  }
  return addToArray(arr, item);
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

  // Getters - return arrays for JSON serialization compatibility
  getSelectedRows: (tabId: string) => number[];
  getExpandedRows: (tabId: string) => string[];
  getSelectedRowCount: (tabId: string) => number;
  isRowSelected: (tabId: string, rowIndex: number) => boolean;
  isRowExpanded: (tabId: string, rowId: string) => boolean;
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  devtools(
    persist(
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
              const current = state.selectedRows[tabId] ?? [];
              return {
                selectedRows: {
                  ...state.selectedRows,
                  [tabId]: addToArray(current, rowIndex),
                },
              };
            },
            false,
            'selectRow'
          ),

        deselectRow: (tabId, rowIndex) =>
          set(
            (state) => {
              const current = state.selectedRows[tabId] ?? [];
              return {
                selectedRows: {
                  ...state.selectedRows,
                  [tabId]: removeFromArray(current, rowIndex),
                },
              };
            },
            false,
            'deselectRow'
          ),

        toggleRowSelection: (tabId, rowIndex) => {
          const current = get().selectedRows[tabId] ?? [];
          if (current.includes(rowIndex)) {
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
                [tabId]: Array.from({ length: rowCount }, (_, i) => i),
              },
            }),
            false,
            'selectAllRows'
          ),

        selectRowRange: (tabId, startIndex, endIndex) =>
          set(
            (state) => {
              const current = state.selectedRows[tabId] ?? [];
              const [min, max] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
              const rangeItems = Array.from({ length: max - min + 1 }, (_, i) => min + i);
              // Merge existing with range using Set for O(n) deduplication instead of O(n²)
              const mergedSet = new Set(current);
              for (const item of rangeItems) {
                mergedSet.add(item);
              }
              return {
                selectedRows: {
                  ...state.selectedRows,
                  [tabId]: Array.from(mergedSet),
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
                [tabId]: [],
              },
            }),
            false,
            'clearSelection'
          ),

        // Row expansion
        toggleRowExpand: (tabId, rowId) =>
          set(
            (state) => {
              const current = state.expandedRows[tabId] ?? [];
              return {
                expandedRows: {
                  ...state.expandedRows,
                  [tabId]: toggleInArray(current, rowId),
                },
              };
            },
            false,
            'toggleRowExpand'
          ),

        expandRow: (tabId, rowId) =>
          set(
            (state) => {
              const current = state.expandedRows[tabId] ?? [];
              return {
                expandedRows: {
                  ...state.expandedRows,
                  [tabId]: addToArray(current, rowId),
                },
              };
            },
            false,
            'expandRow'
          ),

        collapseRow: (tabId, rowId) =>
          set(
            (state) => {
              const current = state.expandedRows[tabId] ?? [];
              return {
                expandedRows: {
                  ...state.expandedRows,
                  [tabId]: removeFromArray(current, rowId),
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
                [tabId]: [...rowIds],
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
                [tabId]: [],
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

        // Getters - return arrays
        getSelectedRows: (tabId) => get().selectedRows[tabId] ?? [],
        getExpandedRows: (tabId) => get().expandedRows[tabId] ?? [],
        getSelectedRowCount: (tabId) => (get().selectedRows[tabId] ?? []).length,
        isRowSelected: (tabId, rowIndex) =>
          (get().selectedRows[tabId] ?? []).includes(rowIndex),
        isRowExpanded: (tabId, rowId) =>
          (get().expandedRows[tabId] ?? []).includes(rowId),
      }),
      {
        name: 'dbview-selection',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          selectedRows: state.selectedRows,
          expandedRows: state.expandedRows,
        }),
      }
    ),
    { name: 'SelectionStore' }
  )
);

// Selector hooks - return arrays for JSON serialization compatibility
export const useTabSelection = (tabId: string) =>
  useSelectionStore((s) => s.selectedRows[tabId] ?? []);
export const useTabExpanded = (tabId: string) =>
  useSelectionStore((s) => s.expandedRows[tabId] ?? []);
export const useSelectedDocId = (tabId: string) =>
  useSelectionStore((s) => s.selectedDocId[tabId] ?? null);
export const useEditingCell = () => useSelectionStore((s) => s.editingCell);
