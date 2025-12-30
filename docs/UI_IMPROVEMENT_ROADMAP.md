# DB View UI & Architecture Improvement Roadmap

> **Purpose**: This document outlines phased improvements for both the DB View VS Code extension and Desktop application. It covers UI enhancements and state management architecture using Zustand + TanStack Query.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Phase 1: Quick Wins (UI)](#phase-1-quick-wins-ui)
3. [Phase 2: Medium Effort (UI)](#phase-2-medium-effort-ui)
4. [Phase 3: State Management Architecture](#phase-3-state-management-architecture)
5. [Phase 4: Component Refactoring](#phase-4-component-refactoring)
6. [Implementation Checklists](#implementation-checklists)

---

## Current State Analysis

### Applications Overview

| Application | Package | Primary Issues |
|-------------|---------|----------------|
| VS Code Extension | `packages/ui` | Props drilling, large components, message handler complexity |
| Desktop App | `packages/desktop-ui` | Props drilling, 13+ useState hooks in App, callback chains |

### Issues Identified

#### Shared Issues (Both Apps)
1. **Props Drilling**: Callbacks passed through 3-4+ component levels
2. **Large Component Files**: Components exceed 700+ lines
3. **Scattered State**: useState hooks spread across components
4. **No Data Caching**: Every navigation re-fetches data

#### VS Code Extension Specific
1. **Modal Overuse**: Custom dialogs don't align with VS Code native UX
2. **Message Handler Complexity**: App.tsx has ~300+ line switch statement
3. **Inconsistent Spacing**: Padding/margins vary across components

#### Desktop App Specific
1. **Tab Object "Kitchen Sink"**: Single Tab type with 15+ fields for different tab types
2. **Sidebar Callback Chain**: 7+ callbacks passed through tree nodes
3. **No State Persistence**: Tab state lost on refresh

### Files Requiring Changes

| File | App | Lines | Primary Issues |
|------|-----|-------|----------------|
| `packages/ui/src/App.tsx` | VS Code | ~970 | Message handler, state management |
| `packages/desktop-ui/src/App.tsx` | Desktop | ~800 | 13+ useState, props drilling |
| `packages/ui/src/components/dataViews/SqlDataView.tsx` | VS Code | ~820 | Multiple concerns |
| `packages/desktop-ui/src/components/Sidebar/Sidebar.tsx` | Desktop | ~400 | 7 callback props |
| `packages/desktop-ui/src/components/TabBar/TabBar.tsx` | Desktop | ~300 | 9+ props |

---

## Phase 1: Quick Wins (UI)

*Applies to: VS Code Extension*
*Effort: 5-30 minutes each*

### 1.1 Replace Delete Confirmations with VS Code Native Dialog

**Current**: Custom `DeleteConfirmDialog` modal component
**Target**: VS Code `showWarningMessage` with action buttons

**Files to modify**:
- `apps/vscode-extension/src/connectionConfigPanel.ts`
- `packages/ui/src/components/dataViews/SqlDataView.tsx`
- `packages/ui/src/components/dataViews/DocumentDataView.tsx`

**Implementation**:
```typescript
// In webview - send message to extension
vscode.postMessage({
  type: 'confirmDelete',
  payload: { ids: selectedIds, table: tableName }
});

// In extension - use native dialog
const result = await vscode.window.showWarningMessage(
  `Delete ${count} ${count === 1 ? 'row' : 'rows'}?`,
  { modal: true },
  'Delete'
);
if (result === 'Delete') {
  // Proceed with deletion
}
```

---

### 1.2 Replace "Jump to Row" Dialog with VS Code InputBox

**Current**: Custom modal with input field
**Target**: VS Code `showInputBox`

**Implementation**:
```typescript
// In webview
vscode.postMessage({ type: 'showJumpToRow', payload: { maxRows: totalRows } });

// In extension
const input = await vscode.window.showInputBox({
  prompt: 'Enter row number',
  placeHolder: '1',
  validateInput: (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > maxRows) {
      return `Enter a number between 1 and ${maxRows}`;
    }
    return null;
  }
});
```

---

### 1.3 Replace "Save View" Dialog with VS Code InputBox

**Current**: Custom modal for naming saved views
**Target**: VS Code `showInputBox`

---

### 1.4 Add Tooltips to All Icon Buttons

**Checklist**:
- [ ] Refresh button
- [ ] Filter toggle
- [ ] Column visibility toggle
- [ ] Export button
- [ ] Add row button
- [ ] Delete button
- [ ] View mode toggles (tree/table/json)
- [ ] Expand/collapse all

---

### 1.5 Standardize Button Styles

**CSS Variables to use**:
```css
/* Primary actions */
background: var(--vscode-button-background);
color: var(--vscode-button-foreground);

/* Secondary actions */
background: var(--vscode-button-secondaryBackground);
color: var(--vscode-button-secondaryForeground);

/* Destructive actions */
background: var(--vscode-inputValidation-errorBackground);
```

---

## Phase 2: Medium Effort (UI)

*Applies to: VS Code Extension (some patterns apply to Desktop)*
*Effort: 1-2 hours each*

### 2.1 Convert Insert Row Modal to Slide-Out Panel

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│ Data Table                              │ Insert New Row    │
│ ┌─────────────────────────────────────┐ │ ───────────────── │
│ │ id │ name │ email │ created_at │    │ │ Column: id        │
│ │────│──────│───────│────────────│    │ │ [____________]    │
│ │ 1  │ John │ j@... │ 2024-01-01 │    │ │                   │
│ └─────────────────────────────────────┘ │ [Cancel] [Insert] │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 Convert Export Dialog to QuickPick Flow

```typescript
const format = await vscode.window.showQuickPick(
  ['CSV', 'JSON', 'SQL INSERT', 'Excel'],
  { placeHolder: 'Select export format' }
);

const uri = await vscode.window.showSaveDialog({
  filters: { [format]: [getExtension(format)] }
});
```

---

### 2.3 Standardize Spacing and Padding

**Spacing Scale**:
```css
--spacing-xs: 4px;   /* 0.25rem */
--spacing-sm: 8px;   /* 0.5rem */
--spacing-md: 12px;  /* 0.75rem */
--spacing-lg: 16px;  /* 1rem */
--spacing-xl: 24px;  /* 1.5rem */
```

---

### 2.4 Add Skeleton Loading States

```tsx
export function TableSkeleton({ rows = 10, columns = 5 }) {
  return (
    <div className="animate-pulse">
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="flex gap-2 mb-1">
          {Array(columns).fill(0).map((_, j) => (
            <div key={j} className="h-6 bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

### 2.5 Improve Filter Panel UX

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│ Filters (3 active)                              [Clear All] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ status = active │ │ created > 2024  │ │ type != deleted │ │
│ │            [×]  │ │            [×]  │ │            [×]  │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 3: State Management Architecture

*Applies to: BOTH VS Code Extension AND Desktop App*
*This is the most impactful change for long-term maintainability*

### 3.1 Technology Stack

| Library | Purpose | Bundle Size |
|---------|---------|-------------|
| **Zustand** | Client/UI state (tabs, selections, UI flags) | ~1.2 KB |
| **TanStack Query** | Server state (table data, connections, metadata) | ~12 KB |
| **Total** | | ~13 KB |

### 3.2 Package Structure

Create a new shared package:

```
packages/
├── shared-state/                    # NEW PACKAGE
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # Public exports
│   │   │
│   │   ├── stores/                  # Zustand stores
│   │   │   ├── tabStore.ts          # Tab management
│   │   │   ├── uiStore.ts           # UI state (modals, panels)
│   │   │   ├── selectionStore.ts    # Row/document selection
│   │   │   └── index.ts
│   │   │
│   │   ├── queries/                 # TanStack Query hooks
│   │   │   ├── useTableData.ts      # Fetch table rows
│   │   │   ├── useConnections.ts    # Connection list
│   │   │   ├── useMetadata.ts       # Table/column metadata
│   │   │   ├── useRowCount.ts       # Total row count
│   │   │   └── index.ts
│   │   │
│   │   ├── types/                   # Shared types
│   │   │   ├── tabs.ts
│   │   │   ├── queries.ts
│   │   │   └── index.ts
│   │   │
│   │   └── utils/                   # Utilities
│   │       ├── messageAdapter.ts    # VS Code/Electron message abstraction
│   │       └── index.ts
│   │
│   └── README.md
│
├── ui/                              # VS Code webview
│   └── imports from @dbview/shared-state
│
└── desktop-ui/                      # Electron app
    └── imports from @dbview/shared-state
```

### 3.3 Zustand Stores Implementation

#### Tab Store

```typescript
// packages/shared-state/src/stores/tabStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type TabType = 'table' | 'query' | 'er-diagram';

export interface BaseTab {
  id: string;
  type: TabType;
  title: string;
  connectionKey?: string;
  connectionName?: string;
  connectionColor?: string;
}

export interface TableTab extends BaseTab {
  type: 'table';
  schema: string;
  table: string;
  limit: number;
  offset: number;
  dbType?: string;
  readOnly?: boolean;
}

export interface QueryTab extends BaseTab {
  type: 'query';
  sql: string;
  dbType?: string;
  isDirty?: boolean;
}

export interface ERDiagramTab extends BaseTab {
  type: 'er-diagram';
  schemas: string[];
}

export type Tab = TableTab | QueryTab | ERDiagramTab;

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  secondActiveTabId: string | null; // For split view (Desktop)
  splitMode: 'horizontal' | 'vertical' | null;
}

interface TabActions {
  addTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: <T extends Tab>(tabId: string, updates: Partial<T>) => void;
  reorderTabs: (tabs: Tab[]) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  findOrCreateTableTab: (schema: string, table: string, connectionKey?: string) => string;

  // Split view (Desktop only)
  setSplitMode: (mode: 'horizontal' | 'vertical' | null) => void;
  setSecondActiveTab: (tabId: string | null) => void;
}

export const useTabStore = create<TabState & TabActions>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        tabs: [],
        activeTabId: null,
        secondActiveTabId: null,
        splitMode: null,

        // Actions
        addTab: (tab) => set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
        })),

        closeTab: (tabId) => set((state) => {
          const tabs = state.tabs.filter((t) => t.id !== tabId);
          let activeTabId = state.activeTabId;

          if (activeTabId === tabId) {
            const index = state.tabs.findIndex((t) => t.id === tabId);
            activeTabId = tabs[Math.min(index, tabs.length - 1)]?.id ?? null;
          }

          return { tabs, activeTabId };
        }),

        setActiveTab: (tabId) => set({ activeTabId: tabId }),

        updateTab: (tabId, updates) => set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...updates } : t
          ),
        })),

        reorderTabs: (tabs) => set({ tabs }),

        closeAllTabs: () => set({ tabs: [], activeTabId: null }),

        closeOtherTabs: (tabId) => set((state) => ({
          tabs: state.tabs.filter((t) => t.id === tabId),
          activeTabId: tabId,
        })),

        findOrCreateTableTab: (schema, table, connectionKey) => {
          const existing = get().tabs.find(
            (t) => t.type === 'table' &&
                   (t as TableTab).schema === schema &&
                   (t as TableTab).table === table &&
                   t.connectionKey === connectionKey
          );

          if (existing) {
            set({ activeTabId: existing.id });
            return existing.id;
          }

          const newTab: TableTab = {
            id: `table-${Date.now()}`,
            type: 'table',
            title: table,
            schema,
            table,
            connectionKey,
            limit: 100,
            offset: 0,
          };

          get().addTab(newTab);
          return newTab.id;
        },

        // Split view
        setSplitMode: (mode) => set({ splitMode: mode }),
        setSecondActiveTab: (tabId) => set({ secondActiveTabId: tabId }),
      }),
      {
        name: 'dbview-tabs',
        partialize: (state) => ({
          tabs: state.tabs,
          activeTabId: state.activeTabId,
        }),
      }
    ),
    { name: 'TabStore' }
  )
);

// Selector hooks for performance
export const useTabs = () => useTabStore((s) => s.tabs);
export const useActiveTabId = () => useTabStore((s) => s.activeTabId);
export const useActiveTab = () => useTabStore((s) =>
  s.tabs.find((t) => t.id === s.activeTabId)
);
```

#### UI Store

```typescript
// packages/shared-state/src/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  // Panels
  sidebarCollapsed: boolean;
  insertPanelOpen: boolean;
  filterPanelOpen: boolean;

  // Dialogs (Desktop only - VS Code uses native)
  showAddConnection: boolean;
  editingConnectionKey: string | null;
  showShortcutsDialog: boolean;

  // Theme
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
}

interface UIActions {
  toggleSidebar: () => void;
  setInsertPanelOpen: (open: boolean) => void;
  setFilterPanelOpen: (open: boolean) => void;
  setShowAddConnection: (show: boolean) => void;
  setEditingConnection: (key: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  // State
  sidebarCollapsed: false,
  insertPanelOpen: false,
  filterPanelOpen: false,
  showAddConnection: false,
  editingConnectionKey: null,
  showShortcutsDialog: false,
  theme: 'system',
  resolvedTheme: 'dark',

  // Actions
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setInsertPanelOpen: (open) => set({ insertPanelOpen: open }),
  setFilterPanelOpen: (open) => set({ filterPanelOpen: open }),
  setShowAddConnection: (show) => set({ showAddConnection: show }),
  setEditingConnection: (key) => set({ editingConnectionKey: key }),
  setTheme: (theme) => set({ theme }),
  setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
}));
```

#### Selection Store

```typescript
// packages/shared-state/src/stores/selectionStore.ts
import { create } from 'zustand';

interface SelectionState {
  // Per-tab selection state (keyed by tabId)
  selectedRows: Record<string, Set<number>>;
  expandedRows: Record<string, Set<string>>;
  selectedDocId: Record<string, string | null>;
}

interface SelectionActions {
  selectRow: (tabId: string, rowIndex: number) => void;
  deselectRow: (tabId: string, rowIndex: number) => void;
  toggleRowSelection: (tabId: string, rowIndex: number) => void;
  selectAllRows: (tabId: string, rowCount: number) => void;
  clearSelection: (tabId: string) => void;

  toggleRowExpand: (tabId: string, rowId: string) => void;
  setSelectedDoc: (tabId: string, docId: string | null) => void;
}

export const useSelectionStore = create<SelectionState & SelectionActions>((set, get) => ({
  selectedRows: {},
  expandedRows: {},
  selectedDocId: {},

  selectRow: (tabId, rowIndex) => set((state) => {
    const current = state.selectedRows[tabId] ?? new Set();
    return {
      selectedRows: {
        ...state.selectedRows,
        [tabId]: new Set([...current, rowIndex]),
      },
    };
  }),

  deselectRow: (tabId, rowIndex) => set((state) => {
    const current = state.selectedRows[tabId] ?? new Set();
    current.delete(rowIndex);
    return {
      selectedRows: {
        ...state.selectedRows,
        [tabId]: new Set(current),
      },
    };
  }),

  toggleRowSelection: (tabId, rowIndex) => {
    const current = get().selectedRows[tabId] ?? new Set();
    if (current.has(rowIndex)) {
      get().deselectRow(tabId, rowIndex);
    } else {
      get().selectRow(tabId, rowIndex);
    }
  },

  selectAllRows: (tabId, rowCount) => set((state) => ({
    selectedRows: {
      ...state.selectedRows,
      [tabId]: new Set(Array.from({ length: rowCount }, (_, i) => i)),
    },
  })),

  clearSelection: (tabId) => set((state) => ({
    selectedRows: {
      ...state.selectedRows,
      [tabId]: new Set(),
    },
  })),

  toggleRowExpand: (tabId, rowId) => set((state) => {
    const current = state.expandedRows[tabId] ?? new Set();
    if (current.has(rowId)) {
      current.delete(rowId);
    } else {
      current.add(rowId);
    }
    return {
      expandedRows: {
        ...state.expandedRows,
        [tabId]: new Set(current),
      },
    };
  }),

  setSelectedDoc: (tabId, docId) => set((state) => ({
    selectedDocId: {
      ...state.selectedDocId,
      [tabId]: docId,
    },
  })),
}));

// Selector hooks
export const useTabSelection = (tabId: string) =>
  useSelectionStore((s) => s.selectedRows[tabId] ?? new Set());
```

### 3.4 TanStack Query Implementation

#### Query Client Setup

```typescript
// packages/shared-state/src/queries/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

#### Message Adapter (Abstract VS Code/Electron differences)

```typescript
// packages/shared-state/src/utils/messageAdapter.ts

export interface MessageAdapter {
  postMessage: (message: unknown) => void;
  onMessage: (handler: (message: unknown) => void) => () => void;
}

// VS Code implementation
export function createVSCodeAdapter(): MessageAdapter {
  const vscode = (window as any).acquireVsCodeApi?.();

  return {
    postMessage: (message) => vscode?.postMessage(message),
    onMessage: (handler) => {
      const listener = (event: MessageEvent) => handler(event.data);
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },
  };
}

// Electron implementation
export function createElectronAdapter(): MessageAdapter {
  const api = (window as any).electronAPI;

  return {
    postMessage: (message) => api?.send('message', message),
    onMessage: (handler) => {
      return api?.onMessage(handler) ?? (() => {});
    },
  };
}

// Auto-detect environment
export function createMessageAdapter(): MessageAdapter {
  if (typeof (window as any).acquireVsCodeApi === 'function') {
    return createVSCodeAdapter();
  }
  if ((window as any).electronAPI) {
    return createElectronAdapter();
  }
  // Fallback for development/testing
  return {
    postMessage: (msg) => console.log('[MessageAdapter]', msg),
    onMessage: () => () => {},
  };
}
```

#### Table Data Query Hook

```typescript
// packages/shared-state/src/queries/useTableData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createMessageAdapter } from '../utils/messageAdapter';

interface TableDataParams {
  schema: string;
  table: string;
  limit: number;
  offset: number;
  filters?: FilterCondition[];
  filterLogic?: 'AND' | 'OR';
  sorting?: SortingState;
}

interface TableDataResult {
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number | null;
}

export function useTableData(params: TableDataParams) {
  const adapter = createMessageAdapter();

  return useQuery({
    queryKey: ['tableData', params],
    queryFn: () => new Promise<TableDataResult>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);

      const unsubscribe = adapter.onMessage((message: any) => {
        if (message.type === 'LOAD_TABLE_ROWS' &&
            message.schema === params.schema &&
            message.table === params.table) {
          clearTimeout(timeout);
          unsubscribe();
          resolve({
            columns: message.columns,
            rows: message.rows,
            totalRows: message.totalRows ?? null,
          });
        }

        if (message.type === 'LOAD_TABLE_ERROR') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error(message.error));
        }
      });

      adapter.postMessage({
        type: 'LOAD_TABLE_ROWS',
        ...params,
      });
    }),
  });
}

// Mutations for CRUD
export function useInsertRow() {
  const queryClient = useQueryClient();
  const adapter = createMessageAdapter();

  return useMutation({
    mutationFn: (params: { schema: string; table: string; values: Record<string, unknown> }) =>
      new Promise((resolve, reject) => {
        const unsubscribe = adapter.onMessage((message: any) => {
          if (message.type === 'INSERT_SUCCESS') {
            unsubscribe();
            resolve(message);
          }
          if (message.type === 'INSERT_ERROR') {
            unsubscribe();
            reject(new Error(message.error));
          }
        });

        adapter.postMessage({
          type: 'INSERT_ROW',
          ...params,
        });
      }),
    onSuccess: (_, variables) => {
      // Invalidate table data to refetch
      queryClient.invalidateQueries({
        queryKey: ['tableData', { schema: variables.schema, table: variables.table }],
      });
    },
  });
}

export function useUpdateCell() {
  const queryClient = useQueryClient();
  const adapter = createMessageAdapter();

  return useMutation({
    mutationFn: (params: {
      schema: string;
      table: string;
      primaryKey: Record<string, unknown>;
      column: string;
      value: unknown;
    }) => new Promise((resolve, reject) => {
      const unsubscribe = adapter.onMessage((message: any) => {
        if (message.type === 'UPDATE_SUCCESS') {
          unsubscribe();
          resolve(message);
        }
        if (message.type === 'UPDATE_ERROR') {
          unsubscribe();
          reject(new Error(message.error));
        }
      });

      adapter.postMessage({
        type: 'UPDATE_CELL',
        ...params,
      });
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tableData', { schema: variables.schema, table: variables.table }],
      });
    },
  });
}

export function useDeleteRows() {
  const queryClient = useQueryClient();
  const adapter = createMessageAdapter();

  return useMutation({
    mutationFn: (params: {
      schema: string;
      table: string;
      primaryKeys: Record<string, unknown>[];
    }) => new Promise((resolve, reject) => {
      const unsubscribe = adapter.onMessage((message: any) => {
        if (message.type === 'DELETE_SUCCESS') {
          unsubscribe();
          resolve(message);
        }
        if (message.type === 'DELETE_ERROR') {
          unsubscribe();
          reject(new Error(message.error));
        }
      });

      adapter.postMessage({
        type: 'DELETE_ROWS',
        ...params,
      });
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tableData', { schema: variables.schema, table: variables.table }],
      });
    },
  });
}
```

### 3.5 Migration Strategy

#### Step 1: Create Package (1 session)

```bash
# Create package directory
mkdir -p packages/shared-state/src/{stores,queries,types,utils}

# Initialize package.json
cd packages/shared-state
pnpm init

# Install dependencies
pnpm add zustand @tanstack/react-query
pnpm add -D typescript @types/node
```

**package.json**:
```json
{
  "name": "@dbview/shared-state",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

#### Step 2: Migrate VS Code Extension (2-3 sessions)

1. **Session 1**: Replace `useTabManager` with `useTabStore`
   - Update `packages/ui/src/App.tsx`
   - Remove tab-related props from components

2. **Session 2**: Add TanStack Query for data fetching
   - Wrap app with `QueryClientProvider`
   - Replace manual message handlers with query hooks

3. **Session 3**: Migrate selection state and cleanup

#### Step 3: Migrate Desktop App (2-3 sessions)

1. **Session 1**: Replace 13+ useState with stores
   - Tab state → `useTabStore`
   - UI state → `useUIStore`

2. **Session 2**: Remove callback props from Sidebar/TabBar
   - Components call store actions directly

3. **Session 3**: Add TanStack Query and cleanup

### 3.6 Before/After Comparison

#### Before (Current)

```tsx
// App.tsx - Props drilling
function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // ... 10+ more useState

  return (
    <div>
      <Sidebar
        onTableSelect={handleTableSelect}
        onQueryOpen={handleQueryOpen}
        onAddConnection={() => setShowAddConnection(true)}
        onEditConnection={handleEditConnection}
        refreshTrigger={refreshTrigger}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleTabClose}
        onReorderTabs={setTabs}
      />
      <DataView
        tab={activeTab}
        onUpdate={handleUpdate}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
```

#### After (With Zustand + TanStack Query)

```tsx
// App.tsx - No props drilling
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <Sidebar />
        <TabBar />
        <DataView />
      </div>
    </QueryClientProvider>
  );
}

// Sidebar.tsx - Uses store directly
function Sidebar() {
  const { setShowAddConnection } = useUIStore();
  const { findOrCreateTableTab } = useTabStore();

  const handleTableSelect = (schema: string, table: string) => {
    findOrCreateTableTab(schema, table);
  };

  return (/* ... */);
}

// DataView.tsx - Uses query hook
function DataView() {
  const activeTab = useActiveTab();
  const { data, isLoading, refetch } = useTableData({
    schema: activeTab.schema,
    table: activeTab.table,
    limit: activeTab.limit,
    offset: activeTab.offset,
  });

  const insertMutation = useInsertRow();

  return (/* ... */);
}
```

---

## Phase 4: Component Refactoring

*Applies to: Both applications*
*Effort: Multi-session*

### 4.1 Split SqlDataView.tsx into Smaller Components

**Proposed Structure**:
```
packages/ui/src/components/dataViews/
├── SqlDataView.tsx              # Main container (~200 lines)
├── sql/
│   ├── SqlTable.tsx             # Table rendering (~250 lines)
│   ├── SqlToolbar.tsx           # Toolbar actions (~150 lines)
│   ├── SqlPagination.tsx        # Pagination controls (~100 lines)
│   ├── SqlCellEditor.tsx        # Inline cell editing (~150 lines)
│   └── SqlColumnHeader.tsx      # Column headers with sort (~100 lines)
```

---

### 4.2 Extract Message Handler from App.tsx

**Proposed Structure**:
```typescript
// packages/ui/src/handlers/index.ts
export const messageHandlers: Record<string, MessageHandler> = {
  'OPEN_TABLE': handleOpenTable,
  'LOAD_TABLE_ROWS': handleLoadTableRows,
  'QUERY_RESULT': handleQueryResult,
  // ...
};
```

---

### 4.3 Implement Virtual Scrolling

**Library**: `@tanstack/react-virtual`

**Implementation Notes**:
- Only render rows in viewport + buffer
- Handle variable row heights for expanded JSON
- Maintain smooth scrolling performance

---

## Implementation Checklists

### Phase 1 Checklist (UI Quick Wins)
- [ ] 1.1 Delete confirmations → VS Code native
- [ ] 1.2 Jump to Row → VS Code InputBox
- [ ] 1.3 Save View → VS Code InputBox
- [ ] 1.4 Add tooltips to all icon buttons
- [ ] 1.5 Standardize button styles

### Phase 2 Checklist (UI Medium Effort)
- [ ] 2.1 Insert Row → Slide-out panel
- [ ] 2.2 Export → QuickPick flow
- [ ] 2.3 Standardize spacing
- [ ] 2.4 Add skeleton loaders
- [ ] 2.5 Improve filter panel

### Phase 3 Checklist (State Management)
- [ ] 3.1 Create `packages/shared-state` package
- [ ] 3.2 Implement Zustand stores (tabStore, uiStore, selectionStore)
- [ ] 3.3 Implement TanStack Query hooks
- [ ] 3.4 Create message adapter for VS Code/Electron
- [ ] 3.5 Migrate VS Code extension to new stores
- [ ] 3.6 Migrate Desktop app to new stores
- [ ] 3.7 Remove props drilling from both apps
- [ ] 3.8 Add DevTools integration

### Phase 4 Checklist (Component Refactoring)
- [ ] 4.1 Split SqlDataView.tsx
- [ ] 4.2 Split DocumentDataView.tsx
- [ ] 4.3 Extract message handlers
- [ ] 4.4 Implement virtual scrolling

---

## Notes for Future Sessions

### Testing Strategy
Each change should be tested with:
- PostgreSQL (SQL type)
- MongoDB (Document type)
- Redis (Key-value type)
- Light and dark themes
- Both VS Code extension and Desktop app

### Performance Considerations
- Profile before/after for state management migration
- Monitor bundle size after adding Zustand + TanStack Query
- Test with 1000+ rows to verify virtual scrolling

### Keyboard Navigation
Ensure all changes maintain keyboard accessibility:
- Tab navigation through UI elements
- Enter/Escape for dialogs
- Arrow keys for table navigation

---

## Bundle Size Impact

| Package | Size (min+gzip) | Purpose |
|---------|-----------------|---------|
| Zustand | ~1.2 KB | UI/client state |
| TanStack Query | ~12 KB | Server state, caching |
| **Total Added** | **~13 KB** | |

**Trade-off**: 13 KB for significantly simpler code, better DX, data caching, and shared state between apps.

---

*Last Updated: December 30, 2025*
*Covers: VS Code Extension + Desktop Application*
