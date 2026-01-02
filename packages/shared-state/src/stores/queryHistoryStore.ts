/**
 * Query History Store - Zustand store for managing query execution history
 *
 * Features:
 * - Track executed queries with results
 * - Favorite queries for quick access
 * - Filter by database type, search term
 * - Persist to localStorage
 */
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { QueryHistoryEntry, DatabaseType } from '@dbview/types';

const MAX_ENTRIES = 100;

interface QueryHistoryState {
  entries: QueryHistoryEntry[];
  searchTerm: string;
  showFavoritesOnly: boolean;
  filterDbType: DatabaseType | undefined;
}

interface QueryHistoryActions {
  addQuery: (
    sql: string,
    success: boolean,
    duration?: number,
    rowCount?: number,
    error?: string,
    dbType?: DatabaseType
  ) => string;
  toggleFavorite: (id: string) => void;
  deleteEntry: (id: string) => void;
  clearHistory: (dbTypeOnly?: DatabaseType) => void;
  clearNonFavorites: (dbTypeOnly?: DatabaseType) => void;
  setSearchTerm: (term: string) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  toggleShowFavorites: () => void;
  setFilterDbType: (dbType: DatabaseType | undefined) => void;
}

// Computed selectors
interface QueryHistoryComputed {
  getFilteredHistory: () => QueryHistoryEntry[];
  getFavorites: () => QueryHistoryEntry[];
  getRecentSuccessful: () => QueryHistoryEntry[];
}

export const useQueryHistoryStore = create<QueryHistoryState & QueryHistoryActions & QueryHistoryComputed>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        entries: [],
        searchTerm: '',
        showFavoritesOnly: false,
        filterDbType: undefined,

        // Add a new query to history
        addQuery: (sql, success, duration, rowCount, error, dbType) => {
          const id = crypto.randomUUID();
          const entry: QueryHistoryEntry = {
            id,
            sql: sql.trim(),
            executedAt: Date.now(),
            duration,
            rowCount,
            success,
            error,
            isFavorite: false,
            dbType,
          };

          set(
            (state) => ({
              entries: [entry, ...state.entries].slice(0, MAX_ENTRIES),
            }),
            false,
            'addQuery'
          );

          return id;
        },

        // Toggle favorite status
        toggleFavorite: (id) =>
          set(
            (state) => ({
              entries: state.entries.map((entry) =>
                entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
              ),
            }),
            false,
            'toggleFavorite'
          ),

        // Delete a single entry
        deleteEntry: (id) =>
          set(
            (state) => ({
              entries: state.entries.filter((entry) => entry.id !== id),
            }),
            false,
            'deleteEntry'
          ),

        // Clear history (optionally only for specific dbType)
        clearHistory: (dbTypeOnly) =>
          set(
            (state) => ({
              entries: dbTypeOnly
                ? state.entries.filter((entry) => entry.dbType !== dbTypeOnly)
                : [],
            }),
            false,
            'clearHistory'
          ),

        // Clear only non-favorite entries
        clearNonFavorites: (dbTypeOnly) =>
          set(
            (state) => ({
              entries: state.entries.filter((entry) => {
                if (dbTypeOnly && entry.dbType !== dbTypeOnly) {
                  return true;
                }
                return entry.isFavorite;
              }),
            }),
            false,
            'clearNonFavorites'
          ),

        // Search and filter actions
        setSearchTerm: (term) => set({ searchTerm: term }, false, 'setSearchTerm'),
        setShowFavoritesOnly: (show) => set({ showFavoritesOnly: show }, false, 'setShowFavoritesOnly'),
        toggleShowFavorites: () =>
          set((state) => ({ showFavoritesOnly: !state.showFavoritesOnly }), false, 'toggleShowFavorites'),
        setFilterDbType: (dbType) => set({ filterDbType: dbType }, false, 'setFilterDbType'),

        // Computed getters
        getFilteredHistory: () => {
          const { entries, searchTerm, showFavoritesOnly, filterDbType } = get();
          return entries.filter((entry) => {
            const matchesSearch =
              searchTerm === '' || entry.sql.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFavorite = !showFavoritesOnly || entry.isFavorite;
            const matchesDbType = !filterDbType || entry.dbType === filterDbType;
            return matchesSearch && matchesFavorite && matchesDbType;
          });
        },

        getFavorites: () => {
          const { entries, filterDbType } = get();
          return entries.filter((entry) => {
            const matchesDbType = !filterDbType || entry.dbType === filterDbType;
            return entry.isFavorite && matchesDbType;
          });
        },

        getRecentSuccessful: () => {
          const { entries, filterDbType } = get();
          return entries
            .filter((entry) => {
              const matchesDbType = !filterDbType || entry.dbType === filterDbType;
              return entry.success && matchesDbType;
            })
            .slice(0, 10);
        },
      }),
      {
        name: 'dbview-query-history',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          entries: state.entries,
        }),
      }
    ),
    { name: 'QueryHistoryStore' }
  )
);

// Selector hooks for optimized re-renders
export const useQueryHistory = () => useQueryHistoryStore((s) => s.entries);
export const useQueryHistorySearchTerm = () => useQueryHistoryStore((s) => s.searchTerm);
export const useShowFavoritesOnly = () => useQueryHistoryStore((s) => s.showFavoritesOnly);
export const useFilterDbType = () => useQueryHistoryStore((s) => s.filterDbType);

// Hook that returns filtered history (reactive)
export const useFilteredHistory = () => {
  const entries = useQueryHistoryStore((s) => s.entries);
  const searchTerm = useQueryHistoryStore((s) => s.searchTerm);
  const showFavoritesOnly = useQueryHistoryStore((s) => s.showFavoritesOnly);
  const filterDbType = useQueryHistoryStore((s) => s.filterDbType);

  return entries.filter((entry) => {
    const matchesSearch =
      searchTerm === '' || entry.sql.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFavorite = !showFavoritesOnly || entry.isFavorite;
    const matchesDbType = !filterDbType || entry.dbType === filterDbType;
    return matchesSearch && matchesFavorite && matchesDbType;
  });
};

// Hook that returns favorites (reactive)
export const useFavorites = () => {
  const entries = useQueryHistoryStore((s) => s.entries);
  const filterDbType = useQueryHistoryStore((s) => s.filterDbType);

  return entries.filter((entry) => {
    const matchesDbType = !filterDbType || entry.dbType === filterDbType;
    return entry.isFavorite && matchesDbType;
  });
};
