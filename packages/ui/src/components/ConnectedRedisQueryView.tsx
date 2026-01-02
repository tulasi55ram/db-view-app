/**
 * Connected Redis Query View - Uses Zustand stores directly for state management
 *
 * This component wraps RedisQueryView and provides all state from stores.
 */
import { type FC, useCallback, useMemo } from 'react';
import { RedisQueryView } from './RedisQueryView';
import type { DataGridColumn } from './DataGrid';
import {
  useActiveQueryTab,
  useUpdateActiveQueryTab,
  useQueryHistoryStore,
  useFilteredHistory,
  useQueryActions,
} from '@dbview/shared-state';

export interface ConnectedRedisQueryViewProps {
  // No external props needed - everything comes from stores
}

function toColumn(name: string): DataGridColumn {
  return {
    key: name,
    label: name.replace(/_/g, ' '),
  };
}

export const ConnectedRedisQueryView: FC<ConnectedRedisQueryViewProps> = () => {
  // Get active query tab from store
  const queryTab = useActiveQueryTab();
  const updateQueryTab = useUpdateActiveQueryTab();

  // Query actions
  const { runRedisCommand } = useQueryActions();

  // Query history from store
  const filteredHistory = useFilteredHistory();
  const {
    entries: history,
    searchTerm,
    setSearchTerm,
    toggleFavorite,
    deleteEntry,
    clearHistory,
  } = useQueryHistoryStore();

  // Handlers
  const handleCommandChange = useCallback(
    (value: string) => {
      updateQueryTab({ sql: value });
    },
    [updateQueryTab]
  );

  const handleRunCommand = useCallback(() => {
    if (queryTab) {
      runRedisCommand(queryTab.id, queryTab.sql);
    }
  }, [queryTab, runRedisCommand]);

  // Convert column names to DataGridColumn format
  const columns = useMemo(
    () => (queryTab?.columns || []).map(toColumn),
    [queryTab?.columns]
  );

  // If no active query tab, show nothing
  if (!queryTab) {
    return null;
  }

  return (
    <RedisQueryView
      // Tab data from store
      command={queryTab.sql}
      onCommandChange={handleCommandChange}
      onRunCommand={handleRunCommand}
      loading={queryTab.loading}
      error={queryTab.error}
      columns={columns}
      rows={queryTab.rows}
      duration={queryTab.duration}
      connectionName={queryTab.connectionName}
      // Query history from store
      history={history}
      filteredHistory={filteredHistory}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onToggleFavorite={toggleFavorite}
      onDeleteEntry={deleteEntry}
      onClearHistory={clearHistory}
    />
  );
};
