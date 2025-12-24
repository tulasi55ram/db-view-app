import { useState, useMemo, useCallback } from 'react';
import type { FilterCondition } from '@dbview/core';
import { createFilterFn } from '../utils/filterOperators';

export function useTableFilters() {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>('AND');

  // Generate unique ID for new conditions
  const generateId = useCallback(() => {
    return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add a new empty condition
  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: generateId(),
      columnName: '',
      operator: 'equals',
      value: '',
      value2: undefined
    };
    setConditions(prev => [...prev, newCondition]);
  }, [generateId]);

  // Add a new empty condition after a specific condition
  const addAfter = useCallback((afterId: string) => {
    const newCondition: FilterCondition = {
      id: generateId(),
      columnName: '',
      operator: 'equals',
      value: '',
      value2: undefined
    };

    setConditions(prev => {
      const index = prev.findIndex(c => c.id === afterId);
      if (index === -1) return [...prev, newCondition];

      const newConditions = [...prev];
      newConditions.splice(index + 1, 0, newCondition);
      return newConditions;
    });
  }, [generateId]);

  // Remove a condition by ID
  const removeCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  // Update a condition
  const updateCondition = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setConditions(prev =>
      prev.map(condition =>
        condition.id === id
          ? { ...condition, ...updates }
          : condition
      )
    );
  }, []);

  // Clear all conditions and reset to one empty condition
  const clearAll = useCallback(() => {
    const newCondition: FilterCondition = {
      id: generateId(),
      columnName: '',
      operator: 'equals',
      value: '',
      value2: undefined
    };
    setConditions([newCondition]);
  }, [generateId]);

  // Set all conditions at once (useful for loading saved views)
  const setAllConditions = useCallback((newConditions: FilterCondition[]) => {
    setConditions(newConditions);
  }, []);

  // Convert conditions to TanStack Table's ColumnFiltersState format
  const columnFilters = useMemo(() => {
    return conditions
      .filter(c => c.columnName && c.operator) // Only include complete conditions
      .map(c => ({
        id: c.columnName,
        value: {
          operator: c.operator,
          value: c.value,
          value2: c.value2
        }
      }));
  }, [conditions]);

  // Create custom filter functions for each column with conditions
  const columnFilterFns = useMemo(() => {
    const fns: Record<string, any> = {};

    conditions.forEach(condition => {
      if (condition.columnName && condition.operator) {
        fns[condition.columnName] = createFilterFn(condition.operator);
      }
    });

    return fns;
  }, [conditions]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return conditions.some(c => c.columnName && c.operator);
  }, [conditions]);

  return {
    // State
    conditions,
    logicOperator,
    columnFilters,
    columnFilterFns,
    hasActiveFilters,

    // Actions
    addCondition,
    addAfter,
    removeCondition,
    updateCondition,
    clearAll,
    setAllConditions,
    setLogicOperator
  };
}
