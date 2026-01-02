/**
 * useViewModePreference
 *
 * Hook for persisting view mode preference to localStorage.
 * Supports per-database-type preferences.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ViewMode, DocumentDbType } from '@/components/DocumentDataView/types';

const STORAGE_KEY = 'dbview:viewModePreference';
const DEFAULT_VIEW_MODE: ViewMode = 'tree';

interface ViewModePreferences {
  default: ViewMode;
  [key: string]: ViewMode;
}

/**
 * Get the storage key for a specific context
 */
function getStorageKey(dbType?: DocumentDbType, containerName?: string): string {
  if (containerName && dbType) {
    return `${dbType}:${containerName}`;
  }
  if (dbType) {
    return dbType;
  }
  return 'default';
}

/**
 * Load preferences from localStorage
 */
function loadPreferences(): ViewModePreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as ViewModePreferences;
      }
      // Invalid structure - clear corrupted data
      console.warn('Invalid view mode preferences structure, resetting to defaults');
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    // Clear corrupted data on parse error
    console.warn('Failed to parse view mode preferences, resetting to defaults:', error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore removal errors
    }
  }
  return { default: DEFAULT_VIEW_MODE };
}

/**
 * Save preferences to localStorage
 */
function savePreferences(prefs: ViewModePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export interface UseViewModePreferenceOptions {
  /** Database type for scoped preference */
  dbType?: DocumentDbType;
  /** Container name (collection/index) for more specific scoping */
  containerName?: string;
  /** Whether to also persist per-container preferences */
  persistPerContainer?: boolean;
}

export interface UseViewModePreferenceResult {
  /** Current view mode */
  viewMode: ViewMode;
  /** Set the view mode (persists to localStorage) */
  setViewMode: (mode: ViewMode) => void;
  /** Reset to default view mode */
  resetToDefault: () => void;
}

/**
 * Hook for managing view mode preference with localStorage persistence.
 *
 * The preference resolution order is:
 * 1. Container-specific preference (if persistPerContainer is true)
 * 2. Database type preference
 * 3. Global default preference
 *
 * @example
 * ```tsx
 * const { viewMode, setViewMode } = useViewModePreference({
 *   dbType: 'mongodb',
 *   containerName: 'users',
 * });
 * ```
 */
export function useViewModePreference({
  dbType,
  containerName,
  persistPerContainer = false,
}: UseViewModePreferenceOptions = {}): UseViewModePreferenceResult {
  const [preferences, setPreferences] = useState<ViewModePreferences>(loadPreferences);

  // Determine the current view mode based on preference hierarchy
  const viewMode: ViewMode = (() => {
    // Check container-specific preference first
    if (persistPerContainer && containerName && dbType) {
      const containerKey = getStorageKey(dbType, containerName);
      if (preferences[containerKey]) {
        return preferences[containerKey];
      }
    }

    // Check database type preference
    if (dbType && preferences[dbType]) {
      return preferences[dbType];
    }

    // Fall back to default
    return preferences.default || DEFAULT_VIEW_MODE;
  })();

  // Set view mode with persistence
  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setPreferences((prev) => {
        const key = persistPerContainer && containerName
          ? getStorageKey(dbType, containerName)
          : dbType || 'default';

        const next = {
          ...prev,
          [key]: mode,
        };

        savePreferences(next);
        return next;
      });
    },
    [dbType, containerName, persistPerContainer]
  );

  // Reset to default
  const resetToDefault = useCallback(() => {
    setPreferences((prev) => {
      const next = { ...prev };

      // Remove container-specific preference
      if (persistPerContainer && containerName && dbType) {
        delete next[getStorageKey(dbType, containerName)];
      }

      // Remove database type preference
      if (dbType) {
        delete next[dbType];
      }

      savePreferences(next);
      return next;
    });
  }, [dbType, containerName, persistPerContainer]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setPreferences(JSON.parse(e.newValue));
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    viewMode,
    setViewMode,
    resetToDefault,
  };
}

export default useViewModePreference;
