/**
 * useTableFilters - Shared hook for table filter state management
 *
 * Manages filter conditions and logic operators for table queries.
 * This hook is UI-framework agnostic and doesn't include TanStack Table
 * specific conversions - those should be done in the UI layer.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { FilterCondition, FilterOperator } from '@dbview/types';

/**
 * Return type for useTableFilters hook
 */
export interface UseTableFiltersResult {
  // State
  conditions: FilterCondition[];
  logicOperator: 'AND' | 'OR';
  hasActiveFilters: boolean;
  validConditions: FilterCondition[];

  // Actions
  addCondition: (initialValues?: Partial<FilterCondition>) => string;
  addAfter: (afterId: string, initialValues?: Partial<FilterCondition>) => string;
  removeCondition: (id: string) => void;
  updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
  clearAll: () => void;
  setAllConditions: (newConditions: FilterCondition[]) => void;
  setLogicOperator: (op: 'AND' | 'OR') => void;

  // Queries
  getCondition: (id: string) => FilterCondition | undefined;
  getConditionsForColumn: (columnName: string) => FilterCondition[];
}

/**
 * Generate unique ID for filter conditions
 */
function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create an empty filter condition with default values
 */
function createEmptyCondition(overrides?: Partial<FilterCondition>): FilterCondition {
  return {
    id: generateFilterId(),
    columnName: '',
    operator: 'equals' as FilterOperator,
    value: '',
    value2: undefined,
    ...overrides,
  };
}

/**
 * Default values for hook parameters - defined as constants to maintain stable references
 */
const DEFAULT_INITIAL_CONDITIONS: FilterCondition[] = [];
const DEFAULT_INITIAL_LOGIC: 'AND' | 'OR' = 'AND';

/**
 * Hook for managing table filter state.
 *
 * @param initialConditions - Optional initial filter conditions
 * @param initialLogic - Optional initial logic operator (default: 'AND')
 * @returns Filter state and actions
 *
 * @example
 * ```tsx
 * const filters = useTableFilters();
 *
 * // Add a filter
 * filters.addCondition({ columnName: 'status', operator: 'equals', value: 'active' });
 *
 * // Update a filter
 * filters.updateCondition(id, { value: 'inactive' });
 *
 * // Get valid filters for query
 * const queryFilters = filters.validConditions;
 * ```
 */
export function useTableFilters(
  initialConditions: FilterCondition[] = DEFAULT_INITIAL_CONDITIONS,
  initialLogic: 'AND' | 'OR' = DEFAULT_INITIAL_LOGIC
): UseTableFiltersResult {
  const [conditions, setConditions] = useState<FilterCondition[]>(
    initialConditions.length > 0 ? initialConditions : []
  );
  const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>(initialLogic);

  // Track whether initial sync has happened to prevent initial sync on mount
  const hasSyncedRef = useRef(false);

  // Track previous initial values to detect when caller changes them
  // (e.g., loading a saved view, switching tables)
  const prevInitialConditions = useRef(initialConditions);
  const prevInitialLogic = useRef(initialLogic);

  // Sync state when initial values change after mount
  useEffect(() => {
    // Skip on mount - only sync after mount when values actually change
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      prevInitialConditions.current = initialConditions;
      prevInitialLogic.current = initialLogic;
      return;
    }

    // Check if initialConditions actually changed (by reference)
    if (prevInitialConditions.current !== initialConditions) {
      prevInitialConditions.current = initialConditions;
      setConditions(initialConditions.length > 0 ? initialConditions : []);
    }

    // Check if initialLogic actually changed
    if (prevInitialLogic.current !== initialLogic) {
      prevInitialLogic.current = initialLogic;
      setLogicOperator(initialLogic);
    }
  }, [initialConditions, initialLogic]);

  /**
   * Add a new condition at the end
   * @returns The ID of the newly created condition
   */
  const addCondition = useCallback((initialValues?: Partial<FilterCondition>): string => {
    const newCondition = createEmptyCondition(initialValues);
    setConditions(prev => [...prev, newCondition]);
    return newCondition.id;
  }, []);

  /**
   * Add a new condition after a specific condition
   * @returns The ID of the newly created condition
   */
  const addAfter = useCallback((afterId: string, initialValues?: Partial<FilterCondition>): string => {
    const newCondition = createEmptyCondition(initialValues);

    setConditions(prev => {
      const index = prev.findIndex(c => c.id === afterId);
      if (index === -1) return [...prev, newCondition];

      const newConditions = [...prev];
      newConditions.splice(index + 1, 0, newCondition);
      return newConditions;
    });

    return newCondition.id;
  }, []);

  /**
   * Remove a condition by ID
   */
  const removeCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  /**
   * Update a condition by ID
   */
  const updateCondition = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setConditions(prev =>
      prev.map(condition =>
        condition.id === id
          ? { ...condition, ...updates }
          : condition
      )
    );
  }, []);

  /**
   * Clear all conditions
   */
  const clearAll = useCallback(() => {
    setConditions([]);
  }, []);

  /**
   * Replace all conditions at once (useful for loading saved views)
   */
  const setAllConditions = useCallback((newConditions: FilterCondition[]) => {
    setConditions(newConditions);
  }, []);

  /**
   * Get a specific condition by ID
   */
  const getCondition = useCallback((id: string): FilterCondition | undefined => {
    return conditions.find(c => c.id === id);
  }, [conditions]);

  /**
   * Get all conditions for a specific column
   */
  const getConditionsForColumn = useCallback((columnName: string): FilterCondition[] => {
    return conditions.filter(c => c.columnName === columnName);
  }, [conditions]);

  /**
   * Valid conditions - those with columnName, operator, and required values set
   * Use these for actual queries
   */
  const validConditions = useMemo(() => {
    return conditions.filter(c => {
      // Must have columnName and operator
      if (!c.columnName || !c.operator) {
        return false;
      }

      // Operators that don't need a value
      if (c.operator === 'is_null' || c.operator === 'is_not_null') {
        return true;
      }

      // Between operator needs both value and value2
      if (c.operator === 'between') {
        return c.value !== undefined && c.value !== null && c.value !== '' &&
               c.value2 !== undefined && c.value2 !== null && c.value2 !== '';
      }

      // All other operators need a value
      // Check for undefined, null, or empty string
      return c.value !== undefined && c.value !== null && c.value !== '';
    });
  }, [conditions]);

  /**
   * Whether any valid filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return validConditions.length > 0;
  }, [validConditions]);

  return {
    // State
    conditions,
    logicOperator,
    hasActiveFilters,
    validConditions,

    // Actions
    addCondition,
    addAfter,
    removeCondition,
    updateCondition,
    clearAll,
    setAllConditions,
    setLogicOperator,

    // Queries
    getCondition,
    getConditionsForColumn,
  };
}
