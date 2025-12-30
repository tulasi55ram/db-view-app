import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QueryHistoryEntry, QueryHistoryState, DatabaseType } from '@dbview/types';

const STORAGE_KEY = 'dbview_query_history';
const MAX_ENTRIES = 100;

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterDbType, setFilterDbType] = useState<DatabaseType | undefined>(undefined);

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
    error?: string,
    dbType?: DatabaseType
  ) => {
    const entry: QueryHistoryEntry = {
      id: crypto.randomUUID(),
      sql: sql.trim(),
      executedAt: Date.now(),
      duration,
      rowCount,
      success,
      error,
      isFavorite: false,
      dbType
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

  // Clear all history (optionally only for current dbType)
  const clearHistory = useCallback((dbTypeOnly?: DatabaseType) => {
    if (dbTypeOnly) {
      // Only clear history for the specified dbType
      setHistory(prev => {
        const updated = prev.filter(entry => entry.dbType !== dbTypeOnly);
        saveToStorage(updated);
        return updated;
      });
    } else {
      // Clear all history
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [saveToStorage]);

  // Clear only non-favorite entries (optionally only for current dbType)
  const clearNonFavorites = useCallback((dbTypeOnly?: DatabaseType) => {
    setHistory(prev => {
      const updated = prev.filter(entry => {
        if (dbTypeOnly && entry.dbType !== dbTypeOnly) {
          return true; // Keep entries from other db types
        }
        return entry.isFavorite;
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Filter history based on search, favorites, and dbType
  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      const matchesSearch = searchTerm === '' ||
        entry.sql.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorite = !showFavoritesOnly || entry.isFavorite;
      const matchesDbType = !filterDbType || entry.dbType === filterDbType;
      return matchesSearch && matchesFavorite && matchesDbType;
    });
  }, [history, searchTerm, showFavoritesOnly, filterDbType]);

  // Get favorite queries (optionally filtered by dbType)
  const favorites = useMemo(() => {
    return history.filter(entry => {
      const matchesFavorite = entry.isFavorite;
      const matchesDbType = !filterDbType || entry.dbType === filterDbType;
      return matchesFavorite && matchesDbType;
    });
  }, [history, filterDbType]);

  // Get recent successful queries
  const recentSuccessful = useMemo(() => {
    return history
      .filter(entry => {
        const matchesDbType = !filterDbType || entry.dbType === filterDbType;
        return entry.success && matchesDbType;
      })
      .slice(0, 10);
  }, [history, filterDbType]);

  return {
    history,
    filteredHistory,
    favorites,
    recentSuccessful,
    searchTerm,
    setSearchTerm,
    showFavoritesOnly,
    setShowFavoritesOnly,
    filterDbType,
    setFilterDbType,
    addQuery,
    toggleFavorite,
    deleteEntry,
    clearHistory,
    clearNonFavorites
  };
}
