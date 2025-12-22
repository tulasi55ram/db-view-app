import { useState, useEffect, useCallback } from 'react';
import type { SavedView, ViewState } from '@dbview/core';
import { getVsCodeApi } from '../vscode';

export function useSavedViews(schema: string, table: string) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const vscode = getVsCodeApi();

  // Load views on mount and when schema/table changes
  useEffect(() => {
    if (vscode && schema && table) {
      vscode.postMessage({ type: 'LOAD_VIEWS', schema, table });
    }
  }, [vscode, schema, table]);

  // Listen for view-related messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'VIEWS_LOADED': {
          setViews(message.views || []);
          break;
        }

        case 'VIEW_SAVED': {
          // Update local state with saved view
          setViews(prev => {
            const existingIndex = prev.findIndex(v => v.id === message.view.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = message.view;
              return updated;
            }
            return [...prev, message.view];
          });
          break;
        }

        case 'VIEW_DELETED': {
          setViews(prev => prev.filter(v => v.id !== message.viewId));
          if (activeViewId === message.viewId) {
            setActiveViewId(null);
          }
          break;
        }

        case 'VIEW_IMPORTED': {
          // Add imported view to the list
          setViews(prev => {
            const existingIndex = prev.findIndex(v => v.id === message.view.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = message.view;
              return updated;
            }
            return [...prev, message.view];
          });
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeViewId]);

  // Save a new view or update existing one
  const saveView = useCallback((
    name: string,
    description: string,
    state: ViewState,
    isDefault: boolean
  ) => {
    const view: SavedView = {
      id: crypto.randomUUID(),
      name,
      description,
      schema,
      table,
      state,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault
    };

    vscode?.postMessage({ type: 'SAVE_VIEW', view });
  }, [vscode, schema, table]);

  // Update an existing view
  const updateView = useCallback((
    viewId: string,
    updates: Partial<Omit<SavedView, 'id' | 'schema' | 'table' | 'createdAt'>>
  ) => {
    const existingView = views.find(v => v.id === viewId);
    if (!existingView) return;

    const updatedView: SavedView = {
      ...existingView,
      ...updates,
      updatedAt: Date.now()
    };

    vscode?.postMessage({ type: 'SAVE_VIEW', view: updatedView });
  }, [vscode, views]);

  // Delete a view
  const deleteView = useCallback((viewId: string) => {
    vscode?.postMessage({ type: 'DELETE_VIEW', schema, table, viewId });
  }, [vscode, schema, table]);

  // Apply a view and return its state
  const applyView = useCallback((view: SavedView): ViewState => {
    setActiveViewId(view.id);
    return view.state;
  }, []);

  // Clear active view
  const clearActiveView = useCallback(() => {
    setActiveViewId(null);
  }, []);

  // Export a view to JSON file
  const exportView = useCallback((view: SavedView) => {
    vscode?.postMessage({ type: 'EXPORT_VIEW', view });
  }, [vscode]);

  // Import a view from JSON file
  const importView = useCallback(() => {
    vscode?.postMessage({ type: 'IMPORT_VIEW' });
  }, [vscode]);

  // Get the default view for this table
  const defaultView = views.find(v => v.isDefault);

  // Get the currently active view
  const activeView = activeViewId ? views.find(v => v.id === activeViewId) : null;

  return {
    views,
    activeViewId,
    activeView,
    defaultView,
    saveView,
    updateView,
    deleteView,
    applyView,
    clearActiveView,
    exportView,
    importView
  };
}
