import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Table2, FileCode, X, Plus, Workflow, Database, GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { motion, AnimatePresence } from "framer-motion";
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

interface Tab {
  id: string;
  type: "table" | "query" | "er-diagram";
  title: string;
  schema?: string;
  table?: string;
  connectionKey?: string; // Unique identifier for the connection
  connectionName?: string; // Display name for the connection
  connectionColor?: string; // Custom color for the connection
  isDirty?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewQuery: () => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onReorderTabs?: (tabs: Tab[]) => void;
  onSplitView?: (direction: "horizontal" | "vertical") => void;
  onCloseSplit?: () => void;
  isSplitView?: boolean;
}

interface ConnectionGroup {
  connectionKey: string; // Unique identifier
  connectionName: string; // Display name
  tabs: Tab[];
  color: string;
}

// Sortable Tab Component
interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  activeGroup: ConnectionGroup | undefined;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  getTabIcon: (type: Tab["type"]) => React.ReactNode;
  onSplitView?: (direction: "horizontal" | "vertical") => void;
  onCloseSplit?: () => void;
  isSplitView?: boolean;
  tabCount: number;
}

function SortableTab({
  tab,
  isActive,
  activeGroup,
  onTabSelect,
  onTabClose,
  onCloseOtherTabs,
  onCloseAllTabs,
  getTabIcon,
  onSplitView,
  onCloseSplit,
  isSplitView,
  tabCount,
}: SortableTabProps) {
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
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "group flex items-center gap-1.5 h-9 px-3 text-sm relative cursor-pointer",
            "border-r border-border min-w-[120px] max-w-[200px] flex-shrink-0",
            isActive
              ? "bg-bg-primary text-text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-fast",
            isDragging && "shadow-lg rounded-md border border-border"
          )}
          onClick={() => onTabSelect(tab.id)}
        >
          {/* Active indicator */}
          {isActive && activeGroup && (
            <motion.div
              layoutId="activeTab"
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: activeGroup.color }}
            />
          )}

          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "flex-shrink-0 cursor-grab active:cursor-grabbing touch-none",
              "opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3" />
          </div>

          {/* Icon */}
          <span className="flex-shrink-0">{getTabIcon(tab.type)}</span>

          {/* Title */}
          <span className="truncate flex-1 min-w-0">{tab.title}</span>

          {/* Dirty indicator */}
          {tab.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
          )}

          {/* Close button */}
          <div
            className={cn(
              "w-4 h-4 flex items-center justify-center rounded flex-shrink-0",
              "hover:bg-bg-active transition-all cursor-pointer",
              isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
          >
            <X className="w-3 h-3" />
          </div>
        </div>
      </ContextMenu.Trigger>

      {/* Tab Context Menu */}
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={cn(
            "min-w-[140px] py-1 rounded-md",
            "bg-bg-tertiary border border-border shadow-panel",
            "animate-scale-in origin-top-left"
          )}
        >
          <ContextMenu.Item
            className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
            onSelect={() => onTabClose(tab.id)}
          >
            Close
          </ContextMenu.Item>
          {onCloseOtherTabs && (
            <ContextMenu.Item
              className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
              onSelect={() => onCloseOtherTabs(tab.id)}
            >
              Close Others
            </ContextMenu.Item>
          )}
          {onCloseAllTabs && (
            <ContextMenu.Item
              className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
              onSelect={onCloseAllTabs}
            >
              Close All
            </ContextMenu.Item>
          )}

          {/* Split View Options */}
          {onSplitView && tabCount >= 2 && !isSplitView && (
            <>
              <ContextMenu.Separator className="h-px bg-border my-1" />
              <ContextMenu.Item
                className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                onSelect={() => onSplitView("horizontal")}
              >
                Split Right
              </ContextMenu.Item>
              <ContextMenu.Item
                className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                onSelect={() => onSplitView("vertical")}
              >
                Split Down
              </ContextMenu.Item>
            </>
          )}
          {onCloseSplit && isSplitView && (
            <>
              <ContextMenu.Separator className="h-px bg-border my-1" />
              <ContextMenu.Item
                className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                onSelect={onCloseSplit}
              >
                Close Split
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// Smart color assignment based on connection name patterns
function getConnectionColor(connectionName: string): string {
  const lowerName = connectionName.toLowerCase();

  // Production environments - Warning colors
  if (lowerName.includes('prod') || lowerName.includes('production')) {
    return '#ef4444'; // red-500
  }

  // Staging/UAT environments - Warning yellow
  if (lowerName.includes('staging') || lowerName.includes('uat') || lowerName.includes('stage')) {
    return '#f59e0b'; // amber-500
  }

  // Development environments - Safe blue
  if (lowerName.includes('dev') || lowerName.includes('develop')) {
    return '#3b82f6'; // blue-500
  }

  // Test environments - Purple
  if (lowerName.includes('test') || lowerName.includes('qa')) {
    return '#a855f7'; // purple-500
  }

  // Local/localhost - Green
  if (lowerName.includes('local') || lowerName.includes('localhost')) {
    return '#10b981'; // emerald-500
  }

  // Default palette for other connections
  const palette = [
    '#06b6d4', // cyan-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#6366f1', // indigo-500
  ];

  // Use connection name hash to consistently assign color
  const hash = connectionName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewQuery,
  onCloseOtherTabs,
  onCloseAllTabs,
  onReorderTabs,
  onSplitView,
  onCloseSplit,
  isSplitView,
}: TabBarProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [activeConnectionKey, setActiveConnectionKey] = useState<string | null>(null);
  const lastActiveTabPerConnection = useRef<Map<string, string>>(new Map());

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder tabs
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderTabs) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTabs = arrayMove(tabs, oldIndex, newIndex);
        onReorderTabs(reorderedTabs);
      }
    }
  }, [tabs, onReorderTabs]);

  // Group tabs by connection
  const connectionGroups = useMemo((): ConnectionGroup[] => {
    const groups = new Map<string, { connectionName: string; tabs: Tab[]; customColor?: string }>();

    tabs.forEach((tab) => {
      const key = tab.connectionKey || 'no-connection';
      const name = tab.connectionName || 'No Connection';

      if (!groups.has(key)) {
        groups.set(key, { connectionName: name, tabs: [], customColor: tab.connectionColor });
      }
      groups.get(key)!.tabs.push(tab);
    });

    return Array.from(groups.entries()).map(([connectionKey, { connectionName, tabs, customColor }]) => ({
      connectionKey,
      connectionName,
      tabs,
      // Use custom color if available, otherwise use smart color assignment
      color: customColor || getConnectionColor(connectionName),
    }));
  }, [tabs]);

  // Auto-select connection when active tab changes or when tabs are added
  useEffect(() => {
    if (activeTabId) {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab?.connectionKey) {
        // Remember this as the last active tab for this connection
        lastActiveTabPerConnection.current.set(activeTab.connectionKey, activeTabId);
        // Always switch to the connection of the active tab
        setActiveConnectionKey(activeTab.connectionKey);
      }
    } else if (connectionGroups.length > 0 && !activeConnectionKey) {
      // If no active tab but we have connections, select the first one
      setActiveConnectionKey(connectionGroups[0].connectionKey);
    } else if (connectionGroups.length === 0) {
      // If no connections, clear the active connection
      setActiveConnectionKey(null);
    }
  }, [activeTabId, tabs, connectionGroups, activeConnectionKey]);

  // Handle manual connection switching
  const handleConnectionSwitch = useCallback((connectionKey: string) => {
    setActiveConnectionKey(connectionKey);

    // Try to restore the last active tab for this connection
    const lastTabId = lastActiveTabPerConnection.current.get(connectionKey);
    const group = connectionGroups.find(g => g.connectionKey === connectionKey);

    if (lastTabId && group?.tabs.some(t => t.id === lastTabId)) {
      // Last active tab still exists, select it
      onTabSelect(lastTabId);
    } else if (group && group.tabs.length > 0) {
      // No last tab or it was closed, select the first tab
      onTabSelect(group.tabs[0].id);
    }
  }, [connectionGroups, onTabSelect]);

  // Get tabs for active connection
  const activeConnectionTabs = useMemo(() => {
    if (!activeConnectionKey) return [];
    const group = connectionGroups.find(g => g.connectionKey === activeConnectionKey);
    return group?.tabs || [];
  }, [activeConnectionKey, connectionGroups]);

  const getTabIcon = (type: Tab["type"]) => {
    switch (type) {
      case "table":
        return <Table2 className="w-3.5 h-3.5" />;
      case "query":
        return <FileCode className="w-3.5 h-3.5" />;
      case "er-diagram":
        return <Workflow className="w-3.5 h-3.5" />;
    }
  };

  const handleCloseConnectionTabs = (connectionKey: string) => {
    const group = connectionGroups.find(g => g.connectionKey === connectionKey);
    if (!group) return;

    group.tabs.forEach(tab => onTabClose(tab.id));

    // Switch to another connection if this was the active one
    if (connectionKey === activeConnectionKey) {
      const remainingGroups = connectionGroups.filter(g => g.connectionKey !== connectionKey);
      setActiveConnectionKey(remainingGroups.length > 0 ? remainingGroups[0].connectionKey : null);
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  const activeGroup = connectionGroups.find(g => g.connectionKey === activeConnectionKey);

  return (
    <div className="flex flex-col bg-bg-secondary border-b border-border overflow-hidden">
      {/* Row 1: Connection Tabs */}
      <div className="flex items-center h-8 border-b border-border/50">
        <div
          className="flex-1 flex items-center overflow-x-auto overflow-y-hidden px-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--bg-tertiary) transparent',
          }}
        >
          <AnimatePresence initial={false}>
            {connectionGroups.map((group) => {
              const isActive = group.connectionKey === activeConnectionKey;

              return (
                <ContextMenu.Root key={group.connectionKey}>
                  <ContextMenu.Trigger>
                    <motion.div
                      layout
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "group flex items-center gap-1.5 h-7 px-2.5 mr-1 rounded-md cursor-pointer",
                        "transition-colors duration-fast flex-shrink-0 text-xs font-medium",
                        isActive
                          ? "bg-bg-primary text-text-primary shadow-sm"
                          : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                      )}
                      onClick={() => handleConnectionSwitch(group.connectionKey)}
                    >
                      {/* Color indicator */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />

                      {/* Connection icon */}
                      <Database className="w-3 h-3 flex-shrink-0 opacity-70" />

                      {/* Connection name */}
                      <span className="truncate max-w-[120px]">
                        {group.connectionName}
                      </span>

                      {/* Tab count badge */}
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0",
                        isActive
                          ? "bg-bg-tertiary text-text-secondary"
                          : "bg-bg-hover text-text-tertiary"
                      )}>
                        {group.tabs.length}
                      </span>

                      {/* Close button */}
                      <div
                        className={cn(
                          "w-4 h-4 flex items-center justify-center rounded flex-shrink-0",
                          "hover:bg-bg-active transition-all cursor-pointer",
                          isActive
                            ? "opacity-70 hover:opacity-100"
                            : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseConnectionTabs(group.connectionKey);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </div>
                    </motion.div>
                  </ContextMenu.Trigger>

                  {/* Connection Context Menu */}
                  <ContextMenu.Portal>
                    <ContextMenu.Content
                      className={cn(
                        "min-w-[160px] py-1 rounded-md",
                        "bg-bg-tertiary border border-border shadow-panel",
                        "animate-scale-in origin-top-left"
                      )}
                    >
                      <ContextMenu.Item
                        className="px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-hover outline-none"
                        onSelect={() => handleCloseConnectionTabs(group.connectionKey)}
                      >
                        Close All Tabs
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Row 2: Table Tabs for Active Connection */}
      <div className="flex items-center h-9" key={activeConnectionKey || 'no-connection'}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeConnectionTabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              ref={tabsRef}
              className="flex-1 flex items-center overflow-x-auto overflow-y-hidden"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--bg-tertiary) transparent',
              }}
            >
              {activeConnectionTabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  activeGroup={activeGroup}
                  onTabSelect={onTabSelect}
                  onTabClose={onTabClose}
                  onCloseOtherTabs={onCloseOtherTabs}
                  onCloseAllTabs={onCloseAllTabs}
                  getTabIcon={getTabIcon}
                  onSplitView={onSplitView}
                  onCloseSplit={onCloseSplit}
                  isSplitView={isSplitView}
                  tabCount={tabs.length}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* New Query Button */}
        <div className="flex-shrink-0 px-2 border-l border-border">
          <button
            onClick={onNewQuery}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Query
          </button>
        </div>
      </div>
    </div>
  );
}
