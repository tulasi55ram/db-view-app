import { useState, useEffect, useCallback } from 'react';
import type { SavedQuery } from '../components/SavedQueriesPanel';

const STORAGE_KEY = 'dbview_saved_queries';
const MAX_QUERIES = 50;

interface SavedQueriesState {
  queries: SavedQuery[];
  maxQueries: number;
}

export function useSavedQueries() {
  const [queries, setQueries] = useState<SavedQuery[]>([]);

  // Load saved queries from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SavedQueriesState = JSON.parse(stored);
        setQueries(parsed.queries || []);
      }
    } catch (error) {
      console.error('Failed to load saved queries:', error);
    }
  }, []);

  // Save queries to localStorage whenever they change
  const saveToStorage = useCallback((queries: SavedQuery[]) => {
    try {
      const state: SavedQueriesState = {
        queries,
        maxQueries: MAX_QUERIES
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save queries:', error);
    }
  }, []);

  // Add a new saved query
  const addQuery = useCallback((name: string, sql: string, description?: string) => {
    const query: SavedQuery = {
      id: crypto.randomUUID(),
      name: name.trim(),
      sql: sql.trim(),
      description: description?.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setQueries(prev => {
      // Add to the beginning and limit to MAX_QUERIES
      const updated = [query, ...prev].slice(0, MAX_QUERIES);
      saveToStorage(updated);
      return updated;
    });

    return query.id;
  }, [saveToStorage]);

  // Update an existing query
  const updateQuery = useCallback((id: string, updates: Partial<SavedQuery>) => {
    setQueries(prev => {
      const updated = prev.map(query =>
        query.id === id
          ? { ...query, ...updates, updatedAt: Date.now() }
          : query
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Delete a query
  const deleteQuery = useCallback((id: string) => {
    setQueries(prev => {
      const updated = prev.filter(query => query.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clear all saved queries
  const clearAll = useCallback(() => {
    setQueries([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    queries,
    addQuery,
    updateQuery,
    deleteQuery,
    clearAll
  };
}
