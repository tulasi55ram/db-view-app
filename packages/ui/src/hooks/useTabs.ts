import { useState, useCallback } from 'react';
import type { Tab, TableTab, QueryTab, ERDiagramTab } from '@dbview/types';

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Generate unique tab ID
  const generateTabId = useCallback(() => {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add a new table tab
  const addTableTab = useCallback((schema: string, table: string, limit: number = 100, connectionName?: string) => {
    const tabId = generateTabId();
    const newTab: TableTab = {
      id: tabId,
      type: 'table',
      title: `${schema}.${table}`,
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
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    return tabId;
  }, [generateTabId]);

  // Add a new query tab
  const addQueryTab = useCallback((connectionName?: string) => {
    const tabId = generateTabId();
    const newTab: QueryTab = {
      id: tabId,
      type: 'query',
      title: connectionName ? `Query - ${connectionName}` : 'New Query',
      sql: 'SELECT NOW();',
      columns: [],
      rows: [],
      loading: false,
      createdAt: Date.now(),
      connectionName,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    return tabId;
  }, [generateTabId]);

  // Add a new ER diagram tab
  const addERDiagramTab = useCallback((availableSchemas: string[]) => {
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
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    return tabId;
  }, [generateTabId]);

  // Find or create table tab
  const findOrCreateTableTab = useCallback((schema: string, table: string, limit: number = 100, connectionName?: string) => {
    // Check if tab already exists for this table (and same connection)
    const existingTab = tabs.find(
      (t) => t.type === 'table' && t.schema === schema && t.table === table && t.connectionName === connectionName
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      return existingTab.id;
    }

    return addTableTab(schema, table, limit, connectionName);
  }, [tabs, addTableTab]);

  // Update tab data
  const updateTab = useCallback(<T extends Tab>(tabId: string, updates: Partial<T>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  }, []);

  // Close a tab
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);

      // If closing active tab, switch to another tab
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex((tab) => tab.id === tabId);
        if (newTabs.length > 0) {
          // Switch to next tab, or previous if last
          const nextIndex = closedIndex < newTabs.length ? closedIndex : newTabs.length - 1;
          setActiveTabId(newTabs[nextIndex].id);
        } else {
          setActiveTabId(null);
        }
      }

      return newTabs;
    });
  }, [activeTabId]);

  // Close other tabs
  const closeOtherTabs = useCallback((keepTabId: string) => {
    setTabs((prev) => prev.filter((tab) => tab.id === keepTabId));
    setActiveTabId(keepTabId);
  }, []);

  // Close all tabs
  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  // Get active tab
  const getActiveTab = useCallback(() => {
    return tabs.find((tab) => tab.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  // Get tab by ID
  const getTab = useCallback((tabId: string) => {
    return tabs.find((tab) => tab.id === tabId) || null;
  }, [tabs]);

  // Switch to tab
  const switchToTab = useCallback((tabId: string) => {
    if (tabs.some((tab) => tab.id === tabId)) {
      setActiveTabId(tabId);
    }
  }, [tabs]);

  return {
    tabs,
    activeTabId,
    addTableTab,
    addQueryTab,
    addERDiagramTab,
    findOrCreateTableTab,
    updateTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    getActiveTab,
    getTab,
    switchToTab,
    setActiveTabId,
  };
}
