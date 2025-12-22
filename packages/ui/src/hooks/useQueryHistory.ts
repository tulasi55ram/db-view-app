import { useState, useEffect, useCallback } from 'react';
import type { QueryHistoryEntry, QueryHistoryState } from '@dbview/core';

const STORAGE_KEY = 'dbview_query_history';
const MAX_ENTRIES = 100;

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: QueryHistoryState = JSON.parse(stored);
        setHistory(parsed.entries || []);
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveToStorage = useCallback((entries: QueryHistoryEntry[]) => {
    try {
      const state: QueryHistoryState = {
        entries,
        maxEntries: MAX_ENTRIES
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save query history:', error);
    }
  }, []);

  // Add a new query to history
  const addQuery = useCallback((
    sql: string,
    success: boolean,
    duration?: number,
    rowCount?: number,
    error?: string
  ) => {
    const entry: QueryHistoryEntry = {
      id: crypto.randomUUID(),
      sql: sql.trim(),
      executedAt: Date.now(),
      duration,
      rowCount,
      success,
      error,
      isFavorite: false
    };

    setHistory(prev => {
      // Add to the beginning and limit to MAX_ENTRIES
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveToStorage(updated);
      return updated;
    });

    return entry.id;
  }, [saveToStorage]);

  // Toggle favorite status
  const toggleFavorite = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.map(entry =>
        entry.id === id
          ? { ...entry, isFavorite: !entry.isFavorite }
          : entry
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Delete a single entry
  const deleteEntry = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(entry => entry.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Clear only non-favorite entries
  const clearNonFavorites = useCallback(() => {
    setHistory(prev => {
      const updated = prev.filter(entry => entry.isFavorite);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Filter history based on search and favorites
  const filteredHistory = history.filter(entry => {
    const matchesSearch = searchTerm === '' ||
      entry.sql.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFavorite = !showFavoritesOnly || entry.isFavorite;
    return matchesSearch && matchesFavorite;
  });

  // Get favorite queries
  const favorites = history.filter(entry => entry.isFavorite);

  // Get recent successful queries
  const recentSuccessful = history
    .filter(entry => entry.success)
    .slice(0, 10);

  return {
    history,
    filteredHistory,
    favorites,
    recentSuccessful,
    searchTerm,
    setSearchTerm,
    showFavoritesOnly,
    setShowFavoritesOnly,
    addQuery,
    toggleFavorite,
    deleteEntry,
    clearHistory,
    clearNonFavorites
  };
}
