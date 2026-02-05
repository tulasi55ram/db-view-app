/**
 * useAppMessages - Hook for handling VS Code messages in the main App component
 */
import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { ColumnMetadata, TableTab, QueryTab, ERDiagramTab, ERDiagramData, TableInfo, ExplainPlan, DatabaseType } from '@dbview/types';
import { getQueryStartTime, clearQueryStartTime } from '@dbview/shared-state';

type ThemeKind = 'light' | 'dark' | 'high-contrast' | 'high-contrast-light';

export type IncomingMessage =
  | { type: "OPEN_TABLE"; schema: string; table: string; limit?: number; connectionName?: string; dbType?: DatabaseType; readOnly?: boolean }
  | { type: "OPEN_QUERY_TAB"; connectionName?: string; dbType?: DatabaseType; database?: string }
  | { type: "OPEN_ER_DIAGRAM"; schemas: string[] }
  | { type: "DOCUMENT_QUERY_RESULT"; tabId: string; columns: string[]; rows: Record<string, unknown>[]; duration?: number }
  | { type: "DOCUMENT_QUERY_ERROR"; tabId: string; message: string }
  | { type: "REDIS_COMMAND_RESULT"; tabId: string; columns: string[]; rows: Record<string, unknown>[]; duration?: number }
  | { type: "REDIS_COMMAND_ERROR"; tabId: string; message: string }
  | { type: "LOAD_TABLE_ROWS"; tabId?: string; schema: string; table: string; columns: string[]; rows: Record<string, unknown>[]; limit?: number; offset?: number; dbType?: DatabaseType }
  | { type: "ROW_COUNT"; tabId?: string; totalRows: number }
  | { type: "ROW_COUNT_ERROR"; tabId?: string; error: string }
  | { type: "QUERY_RESULT"; tabId?: string; columns: string[]; rows: Record<string, unknown>[] }
  | { type: "QUERY_ERROR"; tabId?: string; message?: string }
  | { type: "TABLE_METADATA"; tabId?: string; columns: ColumnMetadata[]; dbType?: DatabaseType }
  | { type: "ER_DIAGRAM_DATA"; diagramData: ERDiagramData }
  | { type: "ER_DIAGRAM_ERROR"; error: string }
  | { type: "UPDATE_SUCCESS"; tabId?: string; rowIndex?: number }
  | { type: "UPDATE_ERROR"; tabId?: string; error: string; rowIndex?: number; column?: string }
  | { type: "INSERT_SUCCESS"; tabId?: string; newRow: Record<string, unknown> }
  | { type: "INSERT_ERROR"; tabId?: string; error: string }
  | { type: "DELETE_SUCCESS"; tabId?: string; deletedCount: number }
  | { type: "DELETE_ERROR"; tabId?: string; error: string }
  | { type: "COMMIT_SUCCESS"; tabId?: string; successCount: number }
  | { type: "COMMIT_ERROR"; tabId?: string; error: string }
  | { type: "AUTOCOMPLETE_DATA"; schemas: string[]; tables: TableInfo[]; columns: Record<string, ColumnMetadata[]> }
  | { type: "SQL_FORMATTED"; tabId: string; formattedSql: string; error?: string }
  | { type: "EXPLAIN_RESULT"; tabId: string; plan: ExplainPlan }
  | { type: "EXPLAIN_ERROR"; tabId: string; error: string }
  | { type: "THEME_CHANGE"; theme: ThemeKind };

interface UseAppMessagesProps {
  vscode: ReturnType<typeof import('../vscode').getVsCodeApi>;
  tabs: Array<{ id: string; type: string; dbType?: DatabaseType }>;
  activeTabId: string | null;

  // Tab operations
  findOrCreateTableTab: (opts: { schema: string; table: string; limit?: number; connectionName?: string; dbType?: DatabaseType; readOnly?: boolean }) => string;
  addQueryTab: (opts: { connectionName?: string; dbType?: DatabaseType; database?: string }) => void;
  addERDiagramTab: (opts: { availableSchemas: string[] }) => void;
  getActiveTab: () => any;
  getTab: (id: string) => any;
  updateTab: <T>(id: string, updates: Partial<T>) => void;

  // Request functions
  requestTableRows: (tabId: string, schema: string, table: string, limit: number, offset: number) => void;
  requestRowCount: (tabId: string, schema: string, table: string) => void;

  // Query history
  addQueryToHistory: (sql: string, success: boolean, duration?: number, rowCount?: number, error?: string, dbType?: DatabaseType) => void;

  // Autocomplete
  setAutocompleteData: (data: { schemas: string[]; tables: TableInfo[]; columns: Record<string, ColumnMetadata[]> }) => void;

  // Theme
  setTheme: (theme: ThemeKind) => void;
}

export function useAppMessages({
  vscode,
  tabs,
  activeTabId,
  findOrCreateTableTab,
  addQueryTab,
  addERDiagramTab,
  getActiveTab,
  getTab,
  updateTab,
  requestTableRows,
  requestRowCount,
  addQueryToHistory,
  setAutocompleteData,
  setTheme,
}: UseAppMessagesProps) {

  const handleMessage = useCallback((event: MessageEvent<IncomingMessage>) => {
    const message = event.data;

    switch (message?.type) {
      case "OPEN_TABLE": {
        const tabId = findOrCreateTableTab({
          schema: message.schema,
          table: message.table,
          limit: message.limit ?? 100,
          connectionName: message.connectionName,
          dbType: message.dbType,
          readOnly: message.readOnly,
        });

        requestTableRows(tabId, message.schema, message.table, message.limit ?? 100, 0);
        requestRowCount(tabId, message.schema, message.table);

        if (vscode) {
          vscode.postMessage({
            type: "GET_TABLE_METADATA",
            tabId,
            schema: message.schema,
            table: message.table
          });
        }
        break;
      }

      case "OPEN_QUERY_TAB": {
        addQueryTab({
          connectionName: message.connectionName,
          dbType: message.dbType,
          database: message.database,
        });
        break;
      }

      case "OPEN_ER_DIAGRAM": {
        addERDiagramTab({ availableSchemas: message.schemas });

        if (vscode) {
          vscode.postMessage({
            type: "GET_ER_DIAGRAM",
            schemas: message.schemas
          });
        }
        break;
      }

      case "ER_DIAGRAM_DATA": {
        const activeTab = getActiveTab();
        if (activeTab?.type === 'er-diagram') {
          updateTab<ERDiagramTab>(activeTab.id, {
            diagramData: message.diagramData,
            loading: false
          });
        }
        break;
      }

      case "ER_DIAGRAM_ERROR": {
        const activeTab = getActiveTab();
        if (activeTab?.type === 'er-diagram') {
          console.error(`[dbview-ui] ER diagram error:`, message.error);
          updateTab<ERDiagramTab>(activeTab.id, {
            loading: false,
            error: message.error
          });
          toast.error("Failed to load ER diagram", {
            description: message.error
          });
        }
        break;
      }

      case "LOAD_TABLE_ROWS": {
        const tabId = message.tabId || activeTabId;
        if (!tabId) break;

        const updates: Partial<TableTab> = {
          schema: message.schema,
          table: message.table,
          columns: message.columns,
          rows: message.rows,
          limit: message.limit ?? 100,
          offset: message.offset ?? 0,
          loading: false
        };

        if (message.dbType) {
          updates.dbType = message.dbType;
        }

        updateTab<TableTab>(tabId, updates);
        break;
      }

      case "ROW_COUNT": {
        const tabId = message.tabId || activeTabId;
        if (!tabId) break;

        updateTab<TableTab>(tabId, {
          totalRows: message.totalRows
        });
        break;
      }

      case "ROW_COUNT_ERROR": {
        console.error(`[dbview-ui] Row count error:`, message.error);
        break;
      }

      case "QUERY_RESULT": {
        const tabId = message.tabId || activeTabId;
        if (!tabId) break;

        const startTime = getQueryStartTime(tabId);
        const duration = startTime ? Date.now() - startTime : undefined;
        clearQueryStartTime(tabId);

        const tab = getTab(tabId);
        if (tab?.type === 'query') {
          addQueryToHistory(
            tab.sql,
            true,
            duration,
            message.rows.length,
            undefined,
            tab.dbType
          );
        }

        updateTab<QueryTab>(tabId, {
          loading: false,
          error: undefined,
          columns: message.columns,
          rows: message.rows,
          duration
        });
        break;
      }

      case "QUERY_ERROR": {
        const tabId = message.tabId || activeTabId;
        if (!tabId) break;

        console.error(`[dbview-ui] Query error for tab ${tabId}:`, message.message);

        const startTime = getQueryStartTime(tabId);
        const duration = startTime ? Date.now() - startTime : undefined;
        clearQueryStartTime(tabId);

        const tab = getTab(tabId);
        if (tab?.type === 'query') {
          addQueryToHistory(
            tab.sql,
            false,
            duration,
            undefined,
            message.message ?? "Query failed",
            tab.dbType
          );
        }

        updateTab<QueryTab>(tabId, {
          loading: false,
          error: message.message ?? "Query failed"
        });
        break;
      }

      case "TABLE_METADATA": {
        const tabId = message.tabId || activeTabId;
        if (!tabId) break;

        const metadataUpdates: Partial<TableTab> = {
          metadata: message.columns
        };

        if (message.dbType) {
          metadataUpdates.dbType = message.dbType;
        }

        updateTab<TableTab>(tabId, metadataUpdates);
        break;
      }

      case "UPDATE_SUCCESS": {
        toast.success("Cell updated successfully");
        break;
      }

      case "UPDATE_ERROR": {
        toast.error("Failed to update cell", {
          description: message.error
        });
        break;
      }

      case "INSERT_SUCCESS": {
        const activeTab = tabs.find(t => t.id === activeTabId);
        const dbType = activeTab?.dbType;
        const isDocumentDb = dbType && ['mongodb', 'elasticsearch', 'cassandra'].includes(dbType);
        if (!isDocumentDb) {
          toast.success("Row inserted successfully");
        }
        break;
      }

      case "INSERT_ERROR": {
        const activeTabForError = tabs.find(t => t.id === activeTabId);
        const dbTypeForError = activeTabForError?.dbType;
        const isDocDb = dbTypeForError && ['mongodb', 'elasticsearch', 'cassandra'].includes(dbTypeForError);
        if (!isDocDb) {
          toast.error("Failed to insert row", {
            description: message.error
          });
        }
        break;
      }

      case "DELETE_SUCCESS": {
        toast.success(`${message.deletedCount} row(s) deleted successfully`);
        break;
      }

      case "DELETE_ERROR": {
        toast.error("Failed to delete row(s)", {
          description: message.error
        });
        break;
      }

      case "COMMIT_SUCCESS": {
        toast.success(`${message.successCount} change(s) committed successfully`);
        break;
      }

      case "COMMIT_ERROR": {
        toast.error("Failed to commit changes", {
          description: message.error
        });
        break;
      }

      case "AUTOCOMPLETE_DATA": {
        setAutocompleteData({
          schemas: message.schemas,
          tables: message.tables,
          columns: message.columns
        });
        break;
      }

      case "SQL_FORMATTED": {
        const tabId = message.tabId;
        if (message.error) {
          toast.error("Failed to format SQL", {
            description: message.error
          });
        } else {
          updateTab<QueryTab>(tabId, { sql: message.formattedSql });
          toast.success("SQL formatted successfully");
        }
        break;
      }

      case "EXPLAIN_RESULT": {
        const tabId = message.tabId;
        updateTab<QueryTab>(tabId, {
          explainPlan: message.plan,
          explainLoading: false,
          explainError: undefined
        });
        break;
      }

      case "EXPLAIN_ERROR": {
        const tabId = message.tabId;
        updateTab<QueryTab>(tabId, {
          explainLoading: false,
          explainError: message.error
        });
        toast.error("Failed to explain query", {
          description: message.error
        });
        break;
      }

      case "DOCUMENT_QUERY_RESULT": {
        const tabId = message.tabId;

        const startTime = getQueryStartTime(tabId);
        const duration = message.duration ?? (startTime ? Date.now() - startTime : undefined);
        clearQueryStartTime(tabId);

        const tab = getTab(tabId);
        if (tab?.type === 'query') {
          addQueryToHistory(
            tab.sql,
            true,
            duration,
            message.rows.length,
            undefined,
            tab.dbType
          );
        }

        updateTab<QueryTab>(tabId, {
          loading: false,
          error: undefined,
          columns: message.columns,
          rows: message.rows,
          duration
        });
        break;
      }

      case "DOCUMENT_QUERY_ERROR": {
        const tabId = message.tabId;

        const startTime = getQueryStartTime(tabId);
        const duration = startTime ? Date.now() - startTime : undefined;
        clearQueryStartTime(tabId);

        const tab = getTab(tabId);
        if (tab?.type === 'query') {
          addQueryToHistory(
            tab.sql,
            false,
            duration,
            undefined,
            message.message,
            tab.dbType
          );
        }

        updateTab<QueryTab>(tabId, {
          loading: false,
          error: message.message
        });
        break;
      }

      case "REDIS_COMMAND_RESULT": {
        const tabId = message.tabId;

        const startTime = getQueryStartTime(tabId);
        const duration = message.duration ?? (startTime ? Date.now() - startTime : undefined);
        clearQueryStartTime(tabId);

        const tab = getTab(tabId);
        if (tab?.type === 'query') {
          addQueryToHistory(
            tab.sql,
            true,
            duration,
            message.rows.length,
            undefined,
            'redis'
          );
        }

        updateTab<QueryTab>(tabId, {
          loading: false,
          error: undefined,
          columns: message.columns,
          rows: message.rows,
          duration
        });
        break;
      }

      case "REDIS_COMMAND_ERROR": {
        const tabId = message.tabId;

        const startTime = getQueryStartTime(tabId);
        const duration = startTime ? Date.now() - startTime : undefined;
        clearQueryStartTime(tabId);

        const tab = getTab(tabId);
        if (tab?.type === 'query') {
          addQueryToHistory(
            tab.sql,
            false,
            duration,
            undefined,
            message.message,
            'redis'
          );
        }

        updateTab<QueryTab>(tabId, {
          loading: false,
          error: message.message
        });
        break;
      }

      case "THEME_CHANGE": {
        document.documentElement.setAttribute('data-theme', message.theme);
        // Set full theme class to properly detect high-contrast-light as light mode
        document.body.className = `vscode-${message.theme}`;
        setTheme(message.theme);
        break;
      }

      default:
        break;
    }
  }, [
    vscode,
    tabs,
    activeTabId,
    findOrCreateTableTab,
    addQueryTab,
    addERDiagramTab,
    getActiveTab,
    getTab,
    updateTab,
    requestTableRows,
    requestRowCount,
    addQueryToHistory,
    setAutocompleteData,
    setTheme,
  ]);

  useEffect(() => {
    if (!vscode) return;

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vscode, handleMessage]);
}
