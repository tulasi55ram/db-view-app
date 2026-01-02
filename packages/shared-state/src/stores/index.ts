/**
 * Zustand stores for shared state management
 */

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
} from './tabStore.js';

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
} from './uiStore.js';

// Selection store
export {
  useSelectionStore,
  useTabSelection,
  useTabExpanded,
  useSelectedDocId,
  useEditingCell,
} from './selectionStore.js';

// Query history store
export {
  useQueryHistoryStore,
  useQueryHistory,
  useQueryHistorySearchTerm,
  useShowFavoritesOnly,
  useFilterDbType,
  useFilteredHistory,
  useFavorites,
} from './queryHistoryStore.js';

// Saved queries store
export {
  useSavedQueriesStore,
  useSavedQueries,
} from './savedQueriesStore.js';
