/**
 * Connected SQL Runner View - Uses Zustand stores directly for state management
 *
 * This component wraps SqlRunnerView and provides all state from stores,
 * only requiring external autocomplete data as props.
 */
import { type FC, useCallback, useMemo } from 'react';
import { SqlRunnerView } from './SqlRunnerView';
import type { DataGridColumn } from './DataGrid';
import type { TableInfo, ColumnMetadata } from '@dbview/types';
import {
  useActiveQueryTab,
  useUpdateActiveQueryTab,
  useQueryHistoryStore,
  useFilteredHistory,
  useFavorites,
  useSavedQueriesStore,
  useQueryActions,
} from '@dbview/shared-state';

export interface ConnectedSqlRunnerViewProps {
  // Autocomplete data - external, not from stores
  schemas?: string[];
  tables?: TableInfo[];
  columnMetadata?: Record<string, ColumnMetadata[]>;
}

function toColumn(name: string): DataGridColumn {
  return {
    key: name,
    label: name.replace(/_/g, ' '),
  };
}

export const ConnectedSqlRunnerView: FC<ConnectedSqlRunnerViewProps> = ({
  schemas = [],
  tables = [],
  columnMetadata = {},
}) => {
  // Get active query tab from store
  const queryTab = useActiveQueryTab();
  const updateQueryTab = useUpdateActiveQueryTab();

  // Query actions
  const { runQuery, cancelQuery, formatSql, explainQuery } = useQueryActions();

  // Query history from store
  const filteredHistory = useFilteredHistory();
  const favorites = useFavorites();
  const {
    entries: history,
    searchTerm,
    showFavoritesOnly,
    setSearchTerm,
    toggleFavorite,
    deleteEntry,
    clearHistory,
    clearNonFavorites,
    toggleShowFavorites,
  } = useQueryHistoryStore();

  // Saved queries from store
  const { queries: savedQueries, addQuery: saveQuery, deleteQuery, updateQuery } = useSavedQueriesStore();

  // Handlers
  const handleSqlChange = useCallback(
    (value: string) => {
      updateQueryTab({ sql: value });
    },
    [updateQueryTab]
  );

  const handleRunQuery = useCallback(() => {
    if (queryTab) {
      runQuery(queryTab.id, queryTab.sql);
    }
  }, [queryTab, runQuery]);

  const handleCancelQuery = useCallback(() => {
    if (queryTab) {
      cancelQuery(queryTab.id);
    }
  }, [queryTab, cancelQuery]);

  const handleFormatSql = useCallback(() => {
    if (queryTab) {
      formatSql(queryTab.id, queryTab.sql);
    }
  }, [queryTab, formatSql]);

  const handleExplainQuery = useCallback(() => {
    if (queryTab) {
      explainQuery(queryTab.id, queryTab.sql);
    }
  }, [queryTab, explainQuery]);

  const handleCloseExplainPanel = useCallback(() => {
    updateQueryTab({ showExplainPanel: false });
  }, [updateQueryTab]);

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
    <SqlRunnerView
      // Tab data from store
      sql={queryTab.sql}
      onSqlChange={handleSqlChange}
      onRunQuery={handleRunQuery}
      onCancelQuery={handleCancelQuery}
      onFormatSql={handleFormatSql}
      onExplainQuery={handleExplainQuery}
      loading={queryTab.loading}
      error={queryTab.error}
      columns={columns}
      rows={queryTab.rows}
      duration={queryTab.duration}
      connectionName={queryTab.connectionName}
      // Explain plan from store
      explainPlan={queryTab.explainPlan}
      explainLoading={queryTab.explainLoading}
      explainError={queryTab.explainError}
      showExplainPanel={queryTab.showExplainPanel}
      onCloseExplainPanel={handleCloseExplainPanel}
      // Autocomplete data (props)
      schemas={schemas}
      tables={tables}
      columnMetadata={columnMetadata}
      // Query history from store
      history={history}
      filteredHistory={filteredHistory}
      favorites={favorites}
      searchTerm={searchTerm}
      showFavoritesOnly={showFavoritesOnly}
      onSearchChange={setSearchTerm}
      onToggleFavorite={toggleFavorite}
      onDeleteEntry={deleteEntry}
      onClearHistory={clearHistory}
      onClearNonFavorites={clearNonFavorites}
      onToggleShowFavorites={toggleShowFavorites}
      // Saved queries from store
      savedQueries={savedQueries}
      onSaveQuery={handleSaveQuery}
      onDeleteSavedQuery={deleteQuery}
      onUpdateSavedQuery={updateQuery}
    />
  );
};
