/**
 * useSavedViews - Shared hook for table view state persistence
 *
 * Manages saved views (filter + sort + column configurations) for tables.
 * Uses the messageAdapter for cross-platform communication (VS Code/Electron).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SavedView, ViewState } from '@dbview/types';
import { getMessageAdapter } from '../utils/messageAdapter.js';

/**
 * Message types for saved views
 */
export interface SavedViewsMessages {
  // Outgoing
  LOAD_VIEWS: { type: 'LOAD_VIEWS'; schema: string; table: string };
  SAVE_VIEW: { type: 'SAVE_VIEW'; view: SavedView };
  DELETE_VIEW: { type: 'DELETE_VIEW'; schema: string; table: string; viewId: string };
  EXPORT_VIEW: { type: 'EXPORT_VIEW'; view: SavedView };
  IMPORT_VIEW: { type: 'IMPORT_VIEW' };

  // Incoming
  VIEWS_LOADED: { type: 'VIEWS_LOADED'; views: SavedView[] };
  VIEW_SAVED: { type: 'VIEW_SAVED'; view: SavedView };
  VIEW_DELETED: { type: 'VIEW_DELETED'; viewId: string };
  VIEW_IMPORTED: { type: 'VIEW_IMPORTED'; view: SavedView };
}

/**
 * Callbacks for saved views operations
 */
export interface UseSavedViewsCallbacks {
  onViewSaved?: (view: SavedView) => void;
  onViewDeleted?: (viewId: string) => void;
  onViewImported?: (view: SavedView) => void;
  onError?: (message: string) => void;
}

/**
 * Return type for useSavedViews hook
 */
export interface UseSavedViewsResult {
  // State
  views: SavedView[];
  activeViewId: string | null;
  activeView: SavedView | null;
  defaultView: SavedView | undefined;
  isLoading: boolean;

  // Actions
  saveView: (name: string, description: string, state: ViewState, isDefault?: boolean) => void;
  updateView: (viewId: string, updates: Partial<Omit<SavedView, 'id' | 'schema' | 'table' | 'createdAt'>>) => void;
  deleteView: (viewId: string) => void;
  applyView: (view: SavedView) => ViewState;
  clearActiveView: () => void;
  exportView: (view: SavedView) => void;
  importView: () => void;
  reloadViews: () => void;
}

/**
 * Generate a UUID for new views
 */
function generateViewId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing saved table views.
 *
 * @param schema - Schema name
 * @param table - Table name
 * @param callbacks - Optional callbacks for operations
 * @returns Saved views state and actions
 *
 * @example
 * ```tsx
 * const savedViews = useSavedViews(schema, table, {
 *   onViewSaved: (view) => toast.success(`View "${view.name}" saved`),
 *   onViewDeleted: () => toast.info('View deleted'),
 * });
 *
 * // Save current state as a view
 * savedViews.saveView('My View', 'Description', currentState, true);
 *
 * // Apply a saved view
 * const viewState = savedViews.applyView(someView);
 * ```
 */
export function useSavedViews(
  schema: string,
  table: string,
  callbacks: UseSavedViewsCallbacks = {}
): UseSavedViewsResult {
  const { onViewSaved, onViewDeleted, onViewImported, onError } = callbacks;

  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const adapter = getMessageAdapter();

  /**
   * Load views from backend
   */
  const loadViews = useCallback(() => {
    if (schema && table) {
      setIsLoading(true);
      adapter.postMessage({ type: 'LOAD_VIEWS', schema, table });
    }
  }, [adapter, schema, table]);

  // Load views on mount and when schema/table changes
  useEffect(() => {
    loadViews();
  }, [loadViews]);

  // Listen for view-related messages
  useEffect(() => {
    const unsubscribe = adapter.onMessage((message: unknown) => {
      if (typeof message !== 'object' || message === null || !('type' in message)) {
        return;
      }

      const msg = message as { type: string; [key: string]: unknown };

      switch (msg.type) {
        case 'VIEWS_LOADED': {
          const viewsData = msg.views as SavedView[] | undefined;
          setViews(viewsData || []);
          setIsLoading(false);
          break;
        }

        case 'VIEW_SAVED': {
          const savedView = msg.view as SavedView;
          setViews(prev => {
            const existingIndex = prev.findIndex(v => v.id === savedView.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = savedView;
              return updated;
            }
            return [...prev, savedView];
          });
          onViewSaved?.(savedView);
          break;
        }

        case 'VIEW_DELETED': {
          const deletedViewId = msg.viewId as string;
          setViews(prev => prev.filter(v => v.id !== deletedViewId));
          if (activeViewId === deletedViewId) {
            setActiveViewId(null);
          }
          onViewDeleted?.(deletedViewId);
          break;
        }

        case 'VIEW_IMPORTED': {
          const importedView = msg.view as SavedView;
          setViews(prev => {
            const existingIndex = prev.findIndex(v => v.id === importedView.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = importedView;
              return updated;
            }
            return [...prev, importedView];
          });
          onViewImported?.(importedView);
          break;
        }

        case 'VIEW_ERROR': {
          const errorMsg = msg.error as string;
          setIsLoading(false);
          onError?.(errorMsg || 'An error occurred');
          break;
        }
      }
    });

    return unsubscribe;
  }, [adapter, activeViewId, onViewSaved, onViewDeleted, onViewImported, onError]);

  /**
   * Save a new view
   */
  const saveView = useCallback((
    name: string,
    description: string,
    state: ViewState,
    isDefault: boolean = false
  ) => {
    const view: SavedView = {
      id: generateViewId(),
      name,
      description,
      schema,
      table,
      state,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault
    };

    adapter.postMessage({ type: 'SAVE_VIEW', view });
  }, [adapter, schema, table]);

  /**
   * Update an existing view
   */
  const updateView = useCallback((
    viewId: string,
    updates: Partial<Omit<SavedView, 'id' | 'schema' | 'table' | 'createdAt'>>
  ) => {
    const existingView = views.find(v => v.id === viewId);
    if (!existingView) {
      onError?.(`View with ID ${viewId} not found`);
      return;
    }

    const updatedView: SavedView = {
      ...existingView,
      ...updates,
      updatedAt: Date.now()
    };

    adapter.postMessage({ type: 'SAVE_VIEW', view: updatedView });
  }, [adapter, views, onError]);

  /**
   * Delete a view
   */
  const deleteView = useCallback((viewId: string) => {
    adapter.postMessage({ type: 'DELETE_VIEW', schema, table, viewId });
  }, [adapter, schema, table]);

  /**
   * Apply a view and return its state
   */
  const applyView = useCallback((view: SavedView): ViewState => {
    setActiveViewId(view.id);
    return view.state;
  }, []);

  /**
   * Clear active view
   */
  const clearActiveView = useCallback(() => {
    setActiveViewId(null);
  }, []);

  /**
   * Export a view to JSON file
   */
  const exportView = useCallback((view: SavedView) => {
    adapter.postMessage({ type: 'EXPORT_VIEW', view });
  }, [adapter]);

  /**
   * Import a view from JSON file
   */
  const importView = useCallback(() => {
    adapter.postMessage({ type: 'IMPORT_VIEW' });
  }, [adapter]);

  /**
   * Manually reload views
   */
  const reloadViews = useCallback(() => {
    loadViews();
  }, [loadViews]);

  // Get the default view for this table
  const defaultView = useMemo(() => {
    return views.find(v => v.isDefault);
  }, [views]);

  // Get the currently active view
  const activeView = useMemo(() => {
    return activeViewId ? views.find(v => v.id === activeViewId) ?? null : null;
  }, [views, activeViewId]);

  return {
    // State
    views,
    activeViewId,
    activeView,
    defaultView,
    isLoading,

    // Actions
    saveView,
    updateView,
    deleteView,
    applyView,
    clearActiveView,
    exportView,
    importView,
    reloadViews,
  };
}
