/**
 * @dbview/shared-state
 *
 * Shared state management for DB View VS Code extension and Desktop app.
 *
 * Uses:
 * - Zustand for client/UI state (tabs, selections, UI flags)
 * - TanStack Query for server state (table data, connections)
 *
 * @example
 * ```tsx
 * import { useTabStore, useTableData, getQueryClient } from '@dbview/shared-state';
 * import { QueryClientProvider } from '@tanstack/react-query';
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={getQueryClient()}>
 *       <MyApp />
 *     </QueryClientProvider>
 *   );
 * }
 *
 * function MyApp() {
 *   const { tabs, addTab, closeTab } = useTabStore();
 *   const activeTab = useActiveTab();
 *
 *   const { data, isLoading } = useTableData({
 *     schema: activeTab?.schema,
 *     table: activeTab?.table,
 *     limit: 100,
 *     offset: 0,
 *     enabled: activeTab?.type === 'table',
 *   });
 *
 *   return <DataView data={data} loading={isLoading} />;
 * }
 * ```
 */

// ============================================
// Zustand Stores
// ============================================

// Tab store
export {
  useTabStore,
  useTabs,
  useActiveTabId,
  useActiveTab,
  useSplitMode,
  useActiveQueryTab,
  useActiveTableTab,
  useActiveERDiagramTab,
  useUpdateActiveQueryTab,
  useUpdateActiveTableTab,
} from './stores/tabStore.js';

// UI store
export {
  useUIStore,
  useSidebarCollapsed,
  useInsertPanelOpen,
  useFilterPanelOpen,
  useTheme,
  useResolvedTheme,
  useShowAddConnection,
  useEditingConnectionKey,
  useShowShortcutsDialog,
  useSidebarRefreshTrigger,
  useExpandConnectionKey,
} from './stores/uiStore.js';

// Selection store
export {
  useSelectionStore,
  useTabSelection,
  useTabExpanded,
  useSelectedDocId,
  useEditingCell,
} from './stores/selectionStore.js';

// Query history store
export {
  useQueryHistoryStore,
  useQueryHistory,
  useQueryHistorySearchTerm,
  useShowFavoritesOnly,
  useFilterDbType,
  useFilteredHistory,
  useFavorites,
} from './stores/queryHistoryStore.js';

// Saved queries store
export {
  useSavedQueriesStore,
  useSavedQueries,
} from './stores/savedQueriesStore.js';

// ============================================
// Action Hooks
// ============================================

export {
  useQueryActions,
  useTableActions,
  useERDiagramActions,
  getQueryStartTime,
  setQueryStartTime,
  clearQueryStartTime,
} from './hooks/useQueryActions.js';

// ============================================
// TanStack Query
// ============================================

// Query client
export {
  createQueryClient,
  getQueryClient,
  resetQueryClient,
  invalidateTableQueries,
  invalidateConnectionQueries,
} from './queries/queryClient.js';

// Table data hooks
export {
  useTableData,
  useInsertRow,
  useUpdateCell,
  useDeleteRows,
  usePrefetchTableData,
} from './queries/useTableData.js';

// Connection hooks
export {
  useConnections,
  useConnect,
  useDisconnect,
  useSaveConnection,
  useDeleteConnection,
} from './queries/useConnections.js';

// ============================================
// Utilities
// ============================================

export {
  createMessageAdapter,
  createVSCodeAdapter,
  createElectronAdapter,
  createDevAdapter,
  getMessageAdapter,
  resetMessageAdapter,
  sendMessage,
  sendMessageMulti,
} from './utils/messageAdapter.js';

// ============================================
// Types
// ============================================

export type { MessageAdapter, TableDataParams, TableDataResult } from './types/index.js';

// Re-export useful types from @dbview/types
export type {
  Tab,
  TabType,
  TableTab,
  QueryTab,
  ERDiagramTab,
  BaseTab,
  TabState,
  DatabaseType,
  ColumnMetadata,
  FilterCondition,
  FilterOperator,
  QueryHistoryEntry,
  SavedQuery,
} from '@dbview/types';

// Re-export TanStack Query types that consumers might need
export { QueryClientProvider, useQueryClient } from '@tanstack/react-query';

// Query hook types
export type { TableDataParams as UseTableDataParams, TableDataResult as UseTableDataResult } from './queries/useTableData.js';
export type { ConnectionInfo } from './queries/useConnections.js';
