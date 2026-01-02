/**
 * Saved Queries Store - Zustand store for managing saved SQL queries
 *
 * Features:
 * - Save queries with names and descriptions
 * - Update and delete saved queries
 * - Persist to localStorage
 */
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { SavedQuery } from '@dbview/types';

const MAX_QUERIES = 50;

interface SavedQueriesState {
  queries: SavedQuery[];
}

interface SavedQueriesActions {
  addQuery: (name: string, sql: string, description?: string) => string;
  updateQuery: (id: string, updates: Partial<SavedQuery>) => void;
  deleteQuery: (id: string) => void;
  clearAll: () => void;
}

export const useSavedQueriesStore = create<SavedQueriesState & SavedQueriesActions>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        queries: [],

        // Add a new saved query
        addQuery: (name, sql, description) => {
          const id = crypto.randomUUID();
          const query: SavedQuery = {
            id,
            name: name.trim(),
            sql: sql.trim(),
            description: description?.trim(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          set(
            (state) => ({
              queries: [query, ...state.queries].slice(0, MAX_QUERIES),
            }),
            false,
            'addQuery'
          );

          return id;
        },

        // Update an existing query
        updateQuery: (id, updates) =>
          set(
            (state) => ({
              queries: state.queries.map((query) =>
                query.id === id ? { ...query, ...updates, updatedAt: Date.now() } : query
              ),
            }),
            false,
            'updateQuery'
          ),

        // Delete a query
        deleteQuery: (id) =>
          set(
            (state) => ({
              queries: state.queries.filter((query) => query.id !== id),
            }),
            false,
            'deleteQuery'
          ),

        // Clear all saved queries
        clearAll: () => set({ queries: [] }, false, 'clearAll'),
      }),
      {
        name: 'dbview-saved-queries',
        storage: createJSONStorage(() => localStorage),
      }
    ),
    { name: 'SavedQueriesStore' }
  )
);

// Selector hooks
export const useSavedQueries = () => useSavedQueriesStore((s) => s.queries);
