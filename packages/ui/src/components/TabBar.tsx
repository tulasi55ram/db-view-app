import { FC, useState, useRef, useEffect, useCallback } from 'react';
import type { Tab } from '@dbview/types';
import { Table2, FileCode, X, Plus, GripVertical, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import { useTabStore } from '@dbview/shared-state/stores';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TabBarProps {
  onNewQuery: () => void;
  onSplitView?: (direction: "horizontal" | "vertical") => void;
  onCloseSplit?: () => void;
  isSplitView?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

// SortableTab component for drag-and-drop
interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SortableTab: FC<SortableTabProps> = ({
  tab,
  isActive,
  onSelect,
  onClose,
  onContextMenu
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const getTabIcon = (type: Tab["type"]) => {
    switch (type) {
      case 'table':
        return <Table2 className="h-3.5 w-3.5" />;
      case 'query':
        return <FileCode className="h-3.5 w-3.5" />;
      case 'er-diagram':
        return <GitBranch className="h-3.5 w-3.5" />;
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
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-1 px-1 py-1.5 rounded-t cursor-pointer group min-w-[120px] max-w-[200px] transition-all',
        isActive
          ? 'bg-vscode-bg text-vscode-text border-t-2 border-t-vscode-accent'
          : 'bg-vscode-bg-light text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text',
        isDragging && 'opacity-80 shadow-lg'
      )}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      role="tab"
      aria-selected={isActive}
      title={getTabTitle(tab)}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={clsx(
          'flex-shrink-0 p-0.5 rounded cursor-grab active:cursor-grabbing transition-opacity',
          isActive ? 'opacity-50 hover:opacity-100' : 'opacity-0 group-hover:opacity-50 hover:!opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </div>

      {/* Tab Content */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className="flex-shrink-0">{getTabIcon(tab.type)}</div>
        <span className="text-xs truncate">{getTabTitle(tab)}</span>
      </div>

      {/* Close Button */}
      <button
        className={clsx(
          'flex-shrink-0 p-0.5 rounded hover:bg-vscode-bg-hover transition-colors',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        onClick={onClose}
        aria-label="Close tab"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const TabBar: FC<TabBarProps> = ({
  onNewQuery,
  onSplitView,
  onCloseSplit,
  isSplitView = false
}) => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reorderTabs
  } = useTabStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTabs = arrayMove(tabs, oldIndex, newIndex);
        reorderTabs(reorderedTabs);
      }
    }
  }, [tabs, reorderTabs]);

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

  const handleContextMenuAction = (action: 'close' | 'close-others' | 'close-all' | 'split-right' | 'split-down' | 'close-split') => {
    const tabId = contextMenu.tabId;
    setContextMenu({ visible: false, x: 0, y: 0, tabId: null });

    if (!tabId && action !== 'close-all' && action !== 'split-right' && action !== 'split-down' && action !== 'close-split') return;

    switch (action) {
      case 'close':
        if (tabId) closeTab(tabId);
        break;
      case 'close-others':
        if (tabId) closeOtherTabs(tabId);
        break;
      case 'close-all':
        closeAllTabs();
        break;
      case 'split-right':
        onSplitView?.("horizontal");
        break;
      case 'split-down':
        onSplitView?.("vertical");
        break;
      case 'close-split':
        onCloseSplit?.();
        break;
    }
  };

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-vscode-border bg-vscode-bg-light px-2 py-1 overflow-x-auto scrollbar-thin">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={() => setActiveTab(tab.id)}
                onClose={(e) => handleCloseTab(e, tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

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

          {/* Split View Options */}
          {onSplitView && tabs.length >= 2 && !isSplitView && (
            <>
              <div className="h-px bg-vscode-border my-1" />
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors"
                onClick={() => handleContextMenuAction('split-right')}
              >
                Split Right
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors"
                onClick={() => handleContextMenuAction('split-down')}
              >
                Split Down
              </button>
            </>
          )}

          {/* Close Split Option */}
          {onCloseSplit && isSplitView && (
            <>
              <div className="h-px bg-vscode-border my-1" />
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors"
                onClick={() => handleContextMenuAction('close-split')}
              >
                Close Split
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};
