/**
 * UI Store - Zustand store for managing UI state
 *
 * Handles:
 * - Sidebar collapse state
 * - Panel visibility (insert panel, filter panel)
 * - Dialog visibility (Desktop only - VS Code uses native dialogs)
 * - Theme settings
 */
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Panels
  sidebarCollapsed: boolean;
  insertPanelOpen: boolean;
  filterPanelOpen: boolean;

  // Dialogs (Desktop only - VS Code uses native)
  showAddConnection: boolean;
  editingConnectionKey: string | null;
  showShortcutsDialog: boolean;
  showExportDialog: boolean;

  // Theme
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';

  // View preferences
  tableDensity: 'compact' | 'normal' | 'comfortable';
  showLineNumbers: boolean;

  // Refresh triggers (Desktop)
  sidebarRefreshTrigger: number;
  expandConnectionKey: string | null;
}

interface UIActions {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Panels
  setInsertPanelOpen: (open: boolean) => void;
  setFilterPanelOpen: (open: boolean) => void;
  toggleFilterPanel: () => void;

  // Dialogs
  setShowAddConnection: (show: boolean) => void;
  setEditingConnection: (key: string | null) => void;
  setShowShortcutsDialog: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;

  // View preferences
  setTableDensity: (density: 'compact' | 'normal' | 'comfortable') => void;
  setShowLineNumbers: (show: boolean) => void;

  // Refresh triggers (Desktop)
  triggerSidebarRefresh: () => void;
  setExpandConnectionKey: (key: string | null) => void;
  expandAndClearConnection: (key: string) => void;

  // Connection dialog helpers
  openAddConnection: () => void;
  openEditConnection: (connectionKey: string) => void;
  closeConnectionDialog: () => void;

  // Reset
  resetUI: () => void;
}

const initialState: UIState = {
  sidebarCollapsed: false,
  insertPanelOpen: false,
  filterPanelOpen: false,
  showAddConnection: false,
  editingConnectionKey: null,
  showShortcutsDialog: false,
  showExportDialog: false,
  theme: 'system',
  resolvedTheme: 'dark',
  tableDensity: 'normal',
  showLineNumbers: true,
  sidebarRefreshTrigger: 0,
  expandConnectionKey: null,
};

// Track pending timeout for expandAndClearConnection to allow cancellation
let expandClearTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        // Sidebar
        toggleSidebar: () =>
          set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }), false, 'toggleSidebar'),
        setSidebarCollapsed: (collapsed) =>
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),

        // Panels
        setInsertPanelOpen: (open) =>
          set({ insertPanelOpen: open }, false, 'setInsertPanelOpen'),
        setFilterPanelOpen: (open) =>
          set({ filterPanelOpen: open }, false, 'setFilterPanelOpen'),
        toggleFilterPanel: () =>
          set((s) => ({ filterPanelOpen: !s.filterPanelOpen }), false, 'toggleFilterPanel'),

        // Dialogs
        setShowAddConnection: (show) =>
          set({ showAddConnection: show }, false, 'setShowAddConnection'),
        setEditingConnection: (key) =>
          set({ editingConnectionKey: key }, false, 'setEditingConnection'),
        setShowShortcutsDialog: (show) =>
          set({ showShortcutsDialog: show }, false, 'setShowShortcutsDialog'),
        setShowExportDialog: (show) =>
          set({ showExportDialog: show }, false, 'setShowExportDialog'),

        // Theme
        setTheme: (theme) => set({ theme }, false, 'setTheme'),
        setResolvedTheme: (theme) => set({ resolvedTheme: theme }, false, 'setResolvedTheme'),

        // View preferences
        setTableDensity: (density) =>
          set({ tableDensity: density }, false, 'setTableDensity'),
        setShowLineNumbers: (show) =>
          set({ showLineNumbers: show }, false, 'setShowLineNumbers'),

        // Refresh triggers (Desktop)
        triggerSidebarRefresh: () =>
          set((s) => ({ sidebarRefreshTrigger: s.sidebarRefreshTrigger + 1 }), false, 'triggerSidebarRefresh'),
        setExpandConnectionKey: (key) =>
          set({ expandConnectionKey: key }, false, 'setExpandConnectionKey'),
        expandAndClearConnection: (key) => {
          // Clear any pending timeout to prevent stale updates
          if (expandClearTimeoutId !== null) {
            clearTimeout(expandClearTimeoutId);
          }

          set({ expandConnectionKey: key }, false, 'expandAndClearConnection:set');

          // Clear after a short delay to allow re-triggering
          expandClearTimeoutId = setTimeout(() => {
            expandClearTimeoutId = null;
            set({ expandConnectionKey: null }, false, 'expandAndClearConnection:clear');
          }, 100);
        },

        // Connection dialog helpers
        openAddConnection: () =>
          set({ showAddConnection: true, editingConnectionKey: null }, false, 'openAddConnection'),
        openEditConnection: (connectionKey) =>
          set({ showAddConnection: true, editingConnectionKey: connectionKey }, false, 'openEditConnection'),
        closeConnectionDialog: () =>
          set({ showAddConnection: false, editingConnectionKey: null }, false, 'closeConnectionDialog'),

        // Reset
        resetUI: () => set(initialState, false, 'resetUI'),
      }),
      {
        name: 'dbview-ui',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          theme: state.theme,
          tableDensity: state.tableDensity,
          showLineNumbers: state.showLineNumbers,
        }),
      }
    ),
    { name: 'UIStore' }
  )
);

// Selector hooks
export const useSidebarCollapsed = () => useUIStore((s) => s.sidebarCollapsed);
export const useInsertPanelOpen = () => useUIStore((s) => s.insertPanelOpen);
export const useFilterPanelOpen = () => useUIStore((s) => s.filterPanelOpen);
export const useTheme = () => useUIStore((s) => s.theme);
export const useResolvedTheme = () => useUIStore((s) => s.resolvedTheme);
export const useShowAddConnection = () => useUIStore((s) => s.showAddConnection);
export const useEditingConnectionKey = () => useUIStore((s) => s.editingConnectionKey);
export const useShowShortcutsDialog = () => useUIStore((s) => s.showShortcutsDialog);
export const useSidebarRefreshTrigger = () => useUIStore((s) => s.sidebarRefreshTrigger);
export const useExpandConnectionKey = () => useUIStore((s) => s.expandConnectionKey);
