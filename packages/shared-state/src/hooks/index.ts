/**
 * React hooks for shared state and actions
 */

export {
  useQueryActions,
  useTableActions,
  useERDiagramActions,
  // Standalone timing functions for message handlers
  getQueryStartTime,
  setQueryStartTime,
  clearQueryStartTime,
} from './useQueryActions.js';

// Table editing hook
export {
  useTableEditing,
  type UseTableEditingOptions,
  type UseTableEditingResult,
} from './useTableEditing.js';

// Table filters hook
export {
  useTableFilters,
  type UseTableFiltersResult,
} from './useTableFilters.js';

// Saved views hook
export {
  useSavedViews,
  type UseSavedViewsCallbacks,
  type UseSavedViewsResult,
  type SavedViewsMessages,
} from './useSavedViews.js';
