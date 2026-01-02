import { FC, useState, useRef, useEffect } from 'react';
import type { Tab } from '@dbview/types';
import { Table2, FileCode, X, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useTabStore } from '@dbview/shared-state/stores';

interface TabBarProps {
  onNewQuery: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

export const TabBar: FC<TabBarProps> = ({ onNewQuery }) => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs
  } = useTabStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
    if (contextMenu.tabId === tabId) {
      setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
    }
  };

  const handleContextMenuAction = (action: 'close' | 'close-others' | 'close-all') => {
    const tabId = contextMenu.tabId;
    setContextMenu({ visible: false, x: 0, y: 0, tabId: null });

    if (!tabId) return;

    switch (action) {
      case 'close':
        closeTab(tabId);
        break;
      case 'close-others':
        closeOtherTabs(tabId);
        break;
      case 'close-all':
        closeAllTabs();
        break;
    }
  };

  const getTabIcon = (tab: Tab) => {
    switch (tab.type) {
      case 'table':
        return <Table2 className="h-3.5 w-3.5" />;
      case 'query':
        return <FileCode className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getTabTitle = (tab: Tab) => {
    if (tab.type === 'table') {
      return `${tab.schema}.${tab.table}`;
    }
    return tab.title;
  };

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-vscode-border bg-vscode-bg-light px-2 py-1 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-t cursor-pointer group min-w-[120px] max-w-[200px] transition-colors',
                isActive
                  ? 'bg-vscode-bg text-vscode-text border-t-2 border-t-vscode-accent'
                  : 'bg-vscode-bg-light text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text'
              )}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              role="tab"
              aria-selected={isActive}
              title={getTabTitle(tab)}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="flex-shrink-0">{getTabIcon(tab)}</div>
                <span className="text-xs truncate">{getTabTitle(tab)}</span>
              </div>
              <button
                className={clsx(
                  'flex-shrink-0 p-0.5 rounded hover:bg-vscode-bg-hover transition-colors',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
                onClick={(e) => handleCloseTab(e, tab.id)}
                aria-label="Close tab"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {/* New Query Button */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-vscode-text-muted hover:text-vscode-accent hover:bg-vscode-bg-hover transition-colors"
          onClick={onNewQuery}
          title="New Query (Ctrl+N)"
          aria-label="New query tab"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">New Query</span>
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-vscode-bg border border-vscode-border rounded shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors"
            onClick={() => handleContextMenuAction('close')}
          >
            Close
          </button>
          {tabs.length > 1 && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors"
              onClick={() => handleContextMenuAction('close-others')}
            >
              Close Others
            </button>
          )}
          {tabs.length > 0 && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors"
              onClick={() => handleContextMenuAction('close-all')}
            >
              Close All
            </button>
          )}
        </div>
      )}
    </>
  );
};
