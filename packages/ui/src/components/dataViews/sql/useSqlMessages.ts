/**
 * useSqlMessages - Hook for handling VS Code message events in SqlDataView
 */
import { useEffect, useCallback } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { TableIndex, TableStatistics, FilterCondition } from '@dbview/types';
import type { ExportOptions } from '@dbview/types';

interface UseSqlMessagesProps {
  // Callbacks
  onRefresh: () => void;
  executeDelete: () => void;
  handleExport: (options: ExportOptions) => void;

  // Filter state
  filters: {
    conditions: FilterCondition[];
    logicOperator: 'AND' | 'OR';
  };

  // Sorting
  sorting: SortingState;

  // View state
  visibleColumns: Set<string>;
  pageSize: number;

  // Saved views
  savedViews: {
    saveView: (name: string, description: string, state: any, isDefault: boolean) => void;
  };

  // Insert state setters
  setIsInserting: (value: boolean) => void;
  setInsertError: (error: string | null) => void;
  setInsertModalOpen: (open: boolean) => void;
  setDuplicateRowData: (data: Record<string, unknown> | undefined) => void;

  // Metadata state setters
  setIndexes: (indexes: TableIndex[]) => void;
  setStatistics: (stats: TableStatistics | undefined) => void;
  setMetadataLoading: (loading: boolean) => void;
  setMetadataResponsesReceived: React.Dispatch<React.SetStateAction<{ indexes: boolean; statistics: boolean }>>;
}

// Convert TanStack SortingState to ViewState sorting format
const convertSortingToViewState = (
  tanstackSorting: SortingState
): Array<{ columnName: string; direction: 'asc' | 'desc' }> => {
  return tanstackSorting.map(sort => ({
    columnName: sort.id,
    direction: sort.desc ? 'desc' : 'asc'
  }));
};

export function useSqlMessages({
  onRefresh,
  executeDelete,
  handleExport,
  filters,
  sorting,
  visibleColumns,
  pageSize,
  savedViews,
  setIsInserting,
  setInsertError,
  setInsertModalOpen,
  setDuplicateRowData,
  setIndexes,
  setStatistics,
  setMetadataLoading,
  setMetadataResponsesReceived,
}: UseSqlMessagesProps) {

  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data;

    switch (message.type) {
      case 'CONFIRM_DELETE_RESULT':
        if (message.confirmed) {
          executeDelete();
        }
        break;

      case 'JUMP_TO_ROW_RESULT':
        console.log('[SqlDataView] Jump to row:', message.rowIndex);
        break;

      case 'SAVE_VIEW_RESULT': {
        const { name, description, isDefault } = message;
        const state = {
          filters: filters.conditions,
          filterLogic: filters.logicOperator,
          sorting: convertSortingToViewState(sorting),
          visibleColumns: Array.from(visibleColumns),
          pageSize: pageSize
        };
        savedViews.saveView(name, description, state, isDefault);
        break;
      }

      case 'EXPORT_RESULT':
        handleExport(message.options);
        break;

      case 'INSERT_SUCCESS':
        setIsInserting(false);
        setInsertError(null);
        setInsertModalOpen(false);
        setDuplicateRowData(undefined);
        onRefresh();
        break;

      case 'INSERT_ERROR':
        setIsInserting(false);
        setInsertError(message.error);
        break;

      case 'TABLE_INDEXES':
        setIndexes(message.indexes || []);
        setMetadataResponsesReceived(prev => {
          const updated = { ...prev, indexes: true };
          if (updated.indexes && updated.statistics) {
            setMetadataLoading(false);
          }
          return updated;
        });
        break;

      case 'TABLE_STATISTICS':
        setStatistics(message.statistics);
        setMetadataResponsesReceived(prev => {
          const updated = { ...prev, statistics: true };
          if (updated.indexes && updated.statistics) {
            setMetadataLoading(false);
          }
          return updated;
        });
        break;

      case 'EXPORT_DATA_SUCCESS':
        // Toast handled by parent
        break;

      case 'EXPORT_DATA_ERROR':
        // Toast handled by parent
        break;

      case 'IMPORT_DATA_SUCCESS':
        onRefresh();
        break;

      case 'IMPORT_DATA_ERROR':
        // Toast handled by parent
        break;
    }
  }, [
    executeDelete,
    handleExport,
    filters,
    sorting,
    visibleColumns,
    pageSize,
    savedViews,
    setIsInserting,
    setInsertError,
    setInsertModalOpen,
    setDuplicateRowData,
    setIndexes,
    setStatistics,
    setMetadataLoading,
    setMetadataResponsesReceived,
    onRefresh
  ]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);
}
