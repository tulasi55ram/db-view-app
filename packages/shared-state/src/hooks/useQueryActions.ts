/**
 * Query Actions Hook - Provides methods to send query-related messages to VS Code/Electron
 *
 * This hook abstracts the message sending logic so components don't need to know
 * about the underlying communication mechanism.
 */
import { useCallback, useRef } from 'react';
import { getMessageAdapter } from '../utils/messageAdapter.js';
import { useTabStore } from '../stores/tabStore.js';
import { useQueryHistoryStore } from '../stores/queryHistoryStore.js';
import type { QueryTab, DatabaseType } from '@dbview/types';

// Store query start times for duration calculation (module-level for sharing across components)
const queryStartTimes = new Map<string, number>();

// Standalone timing functions for use outside of React components
export function getQueryStartTime(tabId: string): number | undefined {
  return queryStartTimes.get(tabId);
}

export function setQueryStartTime(tabId: string): void {
  queryStartTimes.set(tabId, Date.now());
}

export function clearQueryStartTime(tabId: string): void {
  queryStartTimes.delete(tabId);
}

export function useQueryActions() {
  const adapter = getMessageAdapter();
  const { updateTab, getTab } = useTabStore();
  const { addQuery } = useQueryHistoryStore();

  // Run SQL query
  const runQuery = useCallback(
    (tabId: string, sql: string) => {
      updateTab<QueryTab>(tabId, { loading: true, error: undefined });
      queryStartTimes.set(tabId, Date.now());
      adapter.postMessage({ type: 'RUN_QUERY', tabId, sql });
    },
    [adapter, updateTab]
  );

  // Format SQL
  const formatSql = useCallback(
    (tabId: string, sql: string) => {
      if (sql.trim()) {
        adapter.postMessage({ type: 'FORMAT_SQL', tabId, sql });
      }
    },
    [adapter]
  );

  // Explain query
  const explainQuery = useCallback(
    (tabId: string, sql: string) => {
      if (sql.trim()) {
        updateTab<QueryTab>(tabId, {
          explainLoading: true,
          explainError: undefined,
          showExplainPanel: true,
        });
        adapter.postMessage({ type: 'EXPLAIN_QUERY', tabId, sql });
      }
    },
    [adapter, updateTab]
  );

  // Run document query (MongoDB/Elasticsearch/Cassandra)
  const runDocumentQuery = useCallback(
    (tabId: string, query: string, dbType: DatabaseType) => {
      updateTab<QueryTab>(tabId, { loading: true, error: undefined });
      queryStartTimes.set(tabId, Date.now());
      adapter.postMessage({ type: 'RUN_DOCUMENT_QUERY', tabId, query, dbType });
    },
    [adapter, updateTab]
  );

  // Run Redis command
  const runRedisCommand = useCallback(
    (tabId: string, command: string) => {
      updateTab<QueryTab>(tabId, { loading: true, error: undefined });
      queryStartTimes.set(tabId, Date.now());
      adapter.postMessage({ type: 'RUN_REDIS_COMMAND', tabId, command });
    },
    [adapter, updateTab]
  );

  // Cancel running query
  const cancelQuery = useCallback(
    (tabId: string) => {
      updateTab<QueryTab>(tabId, { loading: false, error: 'Query cancelled by user' });
      queryStartTimes.delete(tabId);
      adapter.postMessage({ type: 'CANCEL_QUERY', tabId });
    },
    [adapter, updateTab]
  );

  // Calculate and record query duration
  const recordQueryCompletion = useCallback(
    (tabId: string, success: boolean, rowCount?: number, error?: string) => {
      const startTime = queryStartTimes.get(tabId);
      const duration = startTime ? Date.now() - startTime : undefined;
      queryStartTimes.delete(tabId);

      const tab = getTab(tabId);
      if (tab?.type === 'query') {
        addQuery(tab.sql, success, duration, rowCount, error, tab.dbType);
      }

      return duration;
    },
    [getTab, addQuery]
  );

  return {
    runQuery,
    cancelQuery,
    formatSql,
    explainQuery,
    runDocumentQuery,
    runRedisCommand,
    recordQueryCompletion,
    // Expose start times for external duration calculation
    getQueryStartTime: (tabId: string) => queryStartTimes.get(tabId),
    setQueryStartTime: (tabId: string) => queryStartTimes.set(tabId, Date.now()),
    clearQueryStartTime: (tabId: string) => queryStartTimes.delete(tabId),
  };
}

export function useTableActions() {
  const adapter = getMessageAdapter();
  const { updateTab } = useTabStore();

  // Request table rows
  const requestTableRows = useCallback(
    (
      tabId: string,
      schema: string,
      table: string,
      limit: number,
      offset: number,
      filters?: unknown[],
      filterLogic?: 'AND' | 'OR'
    ) => {
      updateTab(tabId, { loading: true });
      adapter.postMessage({
        type: 'LOAD_TABLE_ROWS',
        tabId,
        schema,
        table,
        limit,
        offset,
        filters,
        filterLogic,
      });
    },
    [adapter, updateTab]
  );

  // Request row count
  const requestRowCount = useCallback(
    (
      tabId: string,
      schema: string,
      table: string,
      filters?: unknown[],
      filterLogic?: 'AND' | 'OR'
    ) => {
      adapter.postMessage({
        type: 'GET_ROW_COUNT',
        tabId,
        schema,
        table,
        filters,
        filterLogic,
      });
    },
    [adapter]
  );

  // Request table metadata
  const requestTableMetadata = useCallback(
    (tabId: string, schema: string, table: string) => {
      adapter.postMessage({
        type: 'GET_TABLE_METADATA',
        tabId,
        schema,
        table,
      });
    },
    [adapter]
  );

  // Update cell
  const updateCell = useCallback(
    (
      schema: string,
      table: string,
      primaryKey: Record<string, unknown>,
      column: string,
      value: unknown
    ) => {
      adapter.postMessage({
        type: 'UPDATE_CELL',
        schema,
        table,
        primaryKey,
        column,
        value,
      });
    },
    [adapter]
  );

  // Insert row
  const insertRow = useCallback(
    (schema: string, table: string, row: Record<string, unknown>) => {
      adapter.postMessage({
        type: 'INSERT_ROW',
        schema,
        table,
        row,
      });
    },
    [adapter]
  );

  // Delete rows
  const deleteRows = useCallback(
    (schema: string, table: string, primaryKeys: Record<string, unknown>[]) => {
      adapter.postMessage({
        type: 'DELETE_ROWS',
        schema,
        table,
        primaryKeys,
      });
    },
    [adapter]
  );

  return {
    requestTableRows,
    requestRowCount,
    requestTableMetadata,
    updateCell,
    insertRow,
    deleteRows,
  };
}

export function useERDiagramActions() {
  const adapter = getMessageAdapter();

  // Request ER diagram data
  const requestERDiagram = useCallback(
    (schemas: string[]) => {
      adapter.postMessage({
        type: 'GET_ER_DIAGRAM',
        schemas,
      });
    },
    [adapter]
  );

  return {
    requestERDiagram,
  };
}
