/**
 * Connected Document Query View - Uses Zustand stores directly for state management
 *
 * This component wraps DocumentQueryView and provides all state from stores,
 * for MongoDB, Elasticsearch, and Cassandra query views.
 */
import { type FC, useCallback, useMemo } from 'react';
import { DocumentQueryView } from './DocumentQueryView';
import type { DataGridColumn } from './DataGrid';
import type { DatabaseType } from '@dbview/types';
import {
  useActiveQueryTab,
  useUpdateActiveQueryTab,
  useQueryHistoryStore,
  useFilteredHistory,
  useSavedQueriesStore,
  useQueryActions,
} from '@dbview/shared-state';

export interface ConnectedDocumentQueryViewProps {
  // Database type - required to know which query view to render
  dbType: DatabaseType;
  // Collections list - external data
  collections?: string[];
}

function toColumn(name: string): DataGridColumn {
  return {
    key: name,
    label: name.replace(/_/g, ' '),
  };
}

export const ConnectedDocumentQueryView: FC<ConnectedDocumentQueryViewProps> = ({
  dbType,
  collections = [],
}) => {
  // Get active query tab from store
  const queryTab = useActiveQueryTab();
  const updateQueryTab = useUpdateActiveQueryTab();

  // Query actions
  const { runDocumentQuery } = useQueryActions();

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

  // Saved queries from store
  const { queries: savedQueries, addQuery: saveQuery, deleteQuery, updateQuery } = useSavedQueriesStore();

  // Handlers
  const handleQueryChange = useCallback(
    (value: string) => {
      updateQueryTab({ sql: value });
    },
    [updateQueryTab]
  );

  const handleRunQuery = useCallback(() => {
    if (queryTab) {
      runDocumentQuery(queryTab.id, queryTab.sql, dbType);
    }
  }, [queryTab, runDocumentQuery, dbType]);

  const handleSaveQuery = useCallback(
    (name: string, description: string) => {
      if (queryTab) {
        saveQuery(name, queryTab.sql, description);
      }
    },
    [queryTab, saveQuery]
  );

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
    <DocumentQueryView
      // Tab data from store
      dbType={dbType}
      query={queryTab.sql}
      onQueryChange={handleQueryChange}
      onRunQuery={handleRunQuery}
      loading={queryTab.loading}
      error={queryTab.error}
      columns={columns}
      rows={queryTab.rows}
      duration={queryTab.duration}
      connectionName={queryTab.connectionName}
      collections={collections}
      // Query history from store
      history={history}
      filteredHistory={filteredHistory}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onToggleFavorite={toggleFavorite}
      onDeleteEntry={deleteEntry}
      onClearHistory={clearHistory}
      // Saved queries from store
      savedQueries={savedQueries}
      onSaveQuery={handleSaveQuery}
      onDeleteSavedQuery={deleteQuery}
      onUpdateSavedQuery={updateQuery}
    />
  );
};
