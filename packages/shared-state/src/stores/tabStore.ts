/**
 * Tab Store - Zustand store for managing tabs across VS Code extension and Desktop app
 *
 * Features:
 * - Add, close, update tabs
 * - Find or create table tabs (deduplication)
 * - Persist tabs to storage
 * - Split view support (Desktop only)
 */
import { useCallback } from 'react';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { Tab, TableTab, QueryTab, ERDiagramTab, DatabaseType } from '@dbview/types';

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  secondActiveTabId: string | null; // For split view (Desktop)
  splitMode: 'horizontal' | 'vertical' | null;
}

interface TabActions {
  // Core tab actions
  addTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: <T extends Tab>(tabId: string, updates: Partial<T>) => void;
  reorderTabs: (tabs: Tab[]) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;

  // Smart tab creation
  findOrCreateTableTab: (params: {
    schema: string;
    table: string;
    connectionName?: string;
    connectionKey?: string;
    connectionColor?: string;
    dbType?: DatabaseType;
    readOnly?: boolean;
    limit?: number;
  }) => string;

  addQueryTab: (params: {
    connectionName?: string;
    connectionKey?: string;
    connectionColor?: string;
    dbType?: DatabaseType;
  }) => string;

  addERDiagramTab: (params: {
    availableSchemas: string[];
    connectionName?: string;
    connectionKey?: string;
    connectionColor?: string;
  }) => string;

  // Split view (Desktop only)
  setSplitMode: (mode: 'horizontal' | 'vertical' | null) => void;
  setSecondActiveTab: (tabId: string | null) => void;

  // Getters
  getTab: (tabId: string) => Tab | undefined;
  getActiveTab: () => Tab | undefined;
}

// Generate unique tab ID
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTabStore = create<TabState & TabActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        tabs: [],
        activeTabId: null,
        secondActiveTabId: null,
        splitMode: null,

        // Add a new tab
        addTab: (tab) =>
          set(
            (state) => ({
              tabs: [...state.tabs, tab],
              activeTabId: tab.id,
            }),
            false,
            'addTab'
          ),

        // Close a tab
        closeTab: (tabId) =>
          set(
            (state) => {
              const tabs = state.tabs.filter((t) => t.id !== tabId);
              let activeTabId = state.activeTabId;

              // If closing the active tab, switch to adjacent tab
              if (activeTabId === tabId) {
                const index = state.tabs.findIndex((t) => t.id === tabId);
                activeTabId = tabs[Math.min(index, tabs.length - 1)]?.id ?? null;
              }

              // Also clear second active tab if it's being closed
              const secondActiveTabId =
                state.secondActiveTabId === tabId ? null : state.secondActiveTabId;

              return { tabs, activeTabId, secondActiveTabId };
            },
            false,
            'closeTab'
          ),

        // Set active tab
        setActiveTab: (tabId) =>
          set(
            (state) => {
              if (state.tabs.some((t) => t.id === tabId)) {
                return { activeTabId: tabId };
              }
              return state;
            },
            false,
            'setActiveTab'
          ),

        // Update tab properties
        updateTab: (tabId, updates) =>
          set(
            (state) => ({
              tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
            }),
            false,
            'updateTab'
          ),

        // Reorder tabs (for drag-and-drop)
        reorderTabs: (tabs) => set({ tabs }, false, 'reorderTabs'),

        // Close all tabs
        closeAllTabs: () =>
          set(
            { tabs: [], activeTabId: null, secondActiveTabId: null },
            false,
            'closeAllTabs'
          ),

        // Close all tabs except one
        closeOtherTabs: (tabId) =>
          set(
            (state) => ({
              tabs: state.tabs.filter((t) => t.id === tabId),
              activeTabId: tabId,
              secondActiveTabId: null,
            }),
            false,
            'closeOtherTabs'
          ),

        // Find existing table tab or create new one
        findOrCreateTableTab: ({
          schema,
          table,
          connectionName,
          connectionKey,
          connectionColor,
          dbType,
          readOnly = false,
          limit = 100,
        }) => {
          const state = get();

          // Check if tab already exists for this table (and same connection)
          const existingTab = state.tabs.find(
            (t) =>
              t.type === 'table' &&
              (t as TableTab).schema === schema &&
              (t as TableTab).table === table &&
              (connectionKey ? t.connectionKey === connectionKey : t.connectionName === connectionName)
          );

          if (existingTab) {
            set({ activeTabId: existingTab.id }, false, 'findOrCreateTableTab:existing');
            return existingTab.id;
          }

          // Create new table tab
          const tabId = generateTabId();
          const newTab: TableTab = {
            id: tabId,
            type: 'table',
            title: table, // Just the table name, not schema.table
            schema,
            table,
            limit,
            offset: 0,
            totalRows: null,
            columns: [],
            rows: [],
            loading: true,
            createdAt: Date.now(),
            connectionName,
            connectionKey,
            connectionColor,
            dbType,
            readOnly,
          };

          set(
            (s) => ({
              tabs: [...s.tabs, newTab],
              activeTabId: tabId,
            }),
            false,
            'findOrCreateTableTab:create'
          );

          return tabId;
        },

        // Add a new query tab
        addQueryTab: ({ connectionName, connectionKey, connectionColor, dbType }) => {
          const tabId = generateTabId();
          const newTab: QueryTab = {
            id: tabId,
            type: 'query',
            title: 'New Query',
            sql: '',
            columns: [],
            rows: [],
            loading: false,
            createdAt: Date.now(),
            connectionName,
            connectionKey,
            connectionColor,
            dbType,
          };

          set(
            (state) => ({
              tabs: [...state.tabs, newTab],
              activeTabId: tabId,
            }),
            false,
            'addQueryTab'
          );

          return tabId;
        },

        // Add a new ER diagram tab
        addERDiagramTab: ({ availableSchemas, connectionName, connectionKey, connectionColor }) => {
          const tabId = generateTabId();
          const newTab: ERDiagramTab = {
            id: tabId,
            type: 'er-diagram',
            title: 'ER Diagram',
            availableSchemas,
            selectedSchemas: availableSchemas, // All schemas selected by default
            diagramData: null,
            loading: true,
            createdAt: Date.now(),
            connectionName,
            connectionKey,
            connectionColor,
          };

          set(
            (state) => ({
              tabs: [...state.tabs, newTab],
              activeTabId: tabId,
            }),
            false,
            'addERDiagramTab'
          );

          return tabId;
        },

        // Split view
        setSplitMode: (mode) => set({ splitMode: mode }, false, 'setSplitMode'),
        setSecondActiveTab: (tabId) =>
          set({ secondActiveTabId: tabId }, false, 'setSecondActiveTab'),

        // Getters
        getTab: (tabId) => get().tabs.find((t) => t.id === tabId),
        getActiveTab: () => {
          const state = get();
          return state.tabs.find((t) => t.id === state.activeTabId);
        },
      }),
      {
        name: 'dbview-tabs',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          tabs: state.tabs,
          activeTabId: state.activeTabId,
        }),
      }
    ),
    { name: 'TabStore' }
  )
);

// Selector hooks for optimized re-renders
export const useTabs = () => useTabStore((s) => s.tabs);
export const useActiveTabId = () => useTabStore((s) => s.activeTabId);
export const useActiveTab = () =>
  useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
export const useSplitMode = () => useTabStore((s) => s.splitMode);

// Type-specific active tab selectors
export const useActiveQueryTab = () =>
  useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.type === 'query' ? (tab as QueryTab) : null;
  });

export const useActiveTableTab = () =>
  useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.type === 'table' ? (tab as TableTab) : null;
  });

export const useActiveERDiagramTab = () =>
  useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.type === 'er-diagram' ? (tab as ERDiagramTab) : null;
  });

// Hook to update current query tab
export const useUpdateActiveQueryTab = () => {
  const updateTab = useTabStore((s) => s.updateTab);

  // Use a callback that reads the latest activeTabId from the store
  return useCallback((updates: Partial<QueryTab>) => {
    const currentActiveTabId = useTabStore.getState().activeTabId;
    if (currentActiveTabId) {
      updateTab<QueryTab>(currentActiveTabId, updates);
    }
  }, [updateTab]);
};

// Hook to update current table tab
export const useUpdateActiveTableTab = () => {
  const updateTab = useTabStore((s) => s.updateTab);

  // Use a callback that reads the latest activeTabId from the store
  return useCallback((updates: Partial<TableTab>) => {
    const currentActiveTabId = useTabStore.getState().activeTabId;
    if (currentActiveTabId) {
      updateTab<TableTab>(currentActiveTabId, updates);
    }
  }, [updateTab]);
};
