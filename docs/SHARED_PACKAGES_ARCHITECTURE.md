# Shared Packages Architecture Documentation

## Overview

The DB View project is a monorepo that shares code between a VSCode Extension and a Desktop Application. This document explains how the shared packages work, the package dependency hierarchy, and the control flow across platforms.

---

## Monorepo Structure

```
db-view-app/
├── apps/
│   ├── vscode-extension/    # VSCode Extension
│   ├── desktop/             # Electron Desktop App
│   └── web/                 # Web Application (future)
│
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── adapters/            # Database adapter implementations
│   ├── ui/                  # Shared React UI components
│   ├── desktop-ui/          # Desktop-specific UI wrapper
│   ├── shared-state/        # State management (Zustand + TanStack Query)
│   ├── utils/               # Utility functions
│   └── core/                # Core business logic
│
├── pnpm-workspace.yaml      # Workspace configuration
└── package.json             # Root package.json
```

---

## Package Dependency Hierarchy

```
                            ┌─────────────────┐
                            │    @dbview/     │
                            │     types       │
                            │  (Foundation)   │
                            └────────┬────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
                 ▼                   ▼                   ▼
        ┌────────────────┐  ┌───────────────┐  ┌────────────────┐
        │   @dbview/     │  │   @dbview/    │  │   @dbview/     │
        │    utils       │  │    adapters   │  │  shared-state  │
        └────────┬───────┘  └───────┬───────┘  └────────┬───────┘
                 │                  │                   │
                 └──────────────────┼───────────────────┘
                                    │
                           ┌────────▼────────┐
                           │    @dbview/     │
                           │       ui        │
                           │ (Shared React)  │
                           └────────┬────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
                 ▼                                     ▼
        ┌────────────────┐                   ┌─────────────────┐
        │   @dbview/     │                   │   VSCode        │
        │   desktop-ui   │                   │   Extension     │
        └────────┬───────┘                   │  (webview)      │
                 │                           └─────────────────┘
                 ▼
        ┌────────────────┐
        │    Desktop     │
        │  Application   │
        └────────────────┘
```

---

## Package Details

### 1. @dbview/types

**Location:** `packages/types/`

**Purpose:** Foundation package containing all shared TypeScript type definitions.

**Key Exports:**

**Database Connection Types:**
- `DatabaseType` - Union of all supported database types
- `PostgresConnectionConfig` - PostgreSQL connection settings
- `MySQLConnectionConfig` - MySQL connection settings
- `MariaDBConnectionConfig` - MariaDB connection settings
- `SQLServerConnectionConfig` - SQL Server connection settings
- `SQLiteConnectionConfig` - SQLite connection settings
- `MongoDBConnectionConfig` - MongoDB connection settings
- `RedisConnectionConfig` - Redis connection settings
- `ElasticsearchConnectionConfig` - Elasticsearch connection settings
- `CassandraConnectionConfig` - Cassandra connection settings
- `DatabaseConnectionConfig` - Discriminated union of all configs

**Tab Types:**
- `BaseTab` - Common tab properties
- `TableTab` - Table browsing tab
- `QueryTab` - SQL query tab
- `ERDiagramTab` - ER diagram tab
- `Tab` - Discriminated union of tab types

**Data Types:**
- `ColumnMetadata` - Column definition with constraints
- `FilterCondition` - Filter configuration
- `FilterOperator` - Available filter operators
- `TableStatistics` - Table stats (rows, size)
- `TableIndex` - Index information
- `QueryResultSet` - Query execution results
- `ExplainPlan` - Query execution plan
- `RunningQuery` - Active query information

**State Types:**
- `QueryHistoryEntry` - Query history record
- `SavedQuery` - User-saved query
- `TabState` - Persisted tab configuration
- `ViewDefinition` - Saved view settings

**Why Separate Package:**
- No runtime dependencies
- Used by all other packages
- Enables type checking across package boundaries
- Changes here propagate to all consumers

---

### 2. @dbview/adapters

**Location:** `packages/adapters/`

**Purpose:** Database adapter implementations using the adapter pattern.

**Core Interface:** `DatabaseAdapter`

This abstract interface defines all database operations that adapters must implement.

**Key Methods:**

| Category | Methods |
|----------|---------|
| Connection | `connect()`, `disconnect()`, `ping()`, `healthCheck()` |
| Schema | `listSchemas()`, `listTables()`, `listViews()`, `listFunctions()` |
| Table Data | `loadTableRows()`, `getRowCount()`, `getColumns()`, `getMetadata()` |
| Mutations | `insertRow()`, `updateCell()`, `deleteRows()` |
| Queries | `runQuery()`, `formatQuery()`, `explainQuery()`, `validateQuery()` |
| Diagram | `getERDiagram()` |
| Info | `getDatabaseInfo()`, `getRunningQueries()` |

**Factory:** `DatabaseAdapterFactory`

Static factory that creates the appropriate adapter based on database type.

**Method:** `create(config: DatabaseConnectionConfig): DatabaseAdapter`

**Supported Databases:**
| Database | Adapter Class | Library |
|----------|---------------|---------|
| PostgreSQL | `PostgresAdapter` | pg |
| MySQL | `MySQLAdapter` | mysql2 |
| MariaDB | `MariaDBAdapter` | mysql2 |
| SQL Server | `SQLServerAdapter` | mssql |
| SQLite | `SQLiteAdapter` | better-sqlite3 |
| MongoDB | `MongoDBAdapter` | mongodb |
| Redis | `RedisAdapter` | ioredis |
| Elasticsearch | `ElasticsearchAdapter` | @elastic/elasticsearch |
| Cassandra | `CassandraAdapter` | cassandra-driver |

**Capabilities Detection:** `DatabaseCapabilities`

Functions to query database-specific capabilities:
- `getDatabaseCapabilities(type)` - Get all capabilities
- `supportsFeature(type, feature)` - Check specific feature
- `getDatabaseDefaultPort(type)` - Get default port
- `getSystemSchemas(type)` - Get system schema names

**Why Separate Package:**
- Isolates database-specific code
- Can be used independently
- New databases added without touching other packages
- Heavy dependencies (database drivers) contained here

---

### 3. @dbview/shared-state

**Location:** `packages/shared-state/`

**Purpose:** Unified state management for both platforms using Zustand (client state) and TanStack Query (server state).

**State Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    State Management                          │
├──────────────────────────┬──────────────────────────────────┤
│      Client/UI State     │        Server/Data State         │
│        (Zustand)         │       (TanStack Query)           │
├──────────────────────────┼──────────────────────────────────┤
│ • Tab management         │ • Table data                     │
│ • UI preferences         │ • Connection status              │
│ • Selection state        │ • Schema hierarchy               │
│ • Theme settings         │ • Query results                  │
│ • Panel visibility       │ • Row counts                     │
└──────────────────────────┴──────────────────────────────────┘
```

**Zustand Stores:**

**Tab Store** (`stores/tabStore.ts`)
- State: `tabs[]`, `activeTabId`, `secondActiveTabId`, `splitMode`
- Actions: `addTab()`, `closeTab()`, `setActiveTab()`, `updateTab()`, `reorderTabs()`, `findOrCreateTableTab()`, `addQueryTab()`, `addERDiagramTab()`
- Persistence: Yes (with createJSONStorage)

**UI Store** (`stores/uiStore.ts`)
- State: `sidebarCollapsed`, `insertPanelOpen`, `filterPanelOpen`, `showAddConnection`, `editingConnectionKey`, `theme`, `tableDensity`, `showLineNumbers`
- Actions: `toggleSidebar()`, `setInsertPanelOpen()`, `setTheme()`, `openAddConnection()`, `openEditConnection()`, `closeConnectionDialog()`
- Persistence: Yes

**Selection Store** (`stores/selectionStore.ts`)
- State: `tabSelection`, `tabExpanded`, `selectedDocId`, `editingCell`
- Actions: Selection management actions
- Persistence: No (ephemeral)

**Query History Store** (`stores/queryHistoryStore.ts`)
- State: `queryHistory[]`, `searchTerm`, `showFavoritesOnly`, `filterDbType`
- Actions: `addQuery()`, `deleteQuery()`, `toggleStar()`, `setSearchTerm()`
- Persistence: Varies by platform

**Saved Queries Store** (`stores/savedQueriesStore.ts`)
- State: `savedQueries[]`
- Actions: `addQuery()`, `updateQuery()`, `deleteQuery()`, `getQueries()`
- Persistence: Varies by platform

**TanStack Query Hooks:**

**Connection Hooks** (`queries/useConnections.ts`)
- `useConnections()` - List all connections with status
- `useConnect(key)` - Connect mutation
- `useDisconnect(key)` - Disconnect mutation
- `useSaveConnection()` - Save connection mutation
- `useDeleteConnection()` - Delete connection mutation

**Table Data Hooks** (`queries/useTableData.ts`)
- `useTableData(params)` - Fetch table rows with pagination/filtering
- `useInsertRow()` - Insert row mutation
- `useUpdateCell()` - Update cell mutation
- `useDeleteRows()` - Delete rows mutation
- `usePrefetchTableData()` - Prefetch for performance

**Query Client** (`queries/queryClient.ts`)
- `createQueryClient()` - Factory function
- `getQueryClient()` - Singleton accessor
- `resetQueryClient()` - Clear all cache
- `invalidateTableQueries()` - Invalidate specific table
- `invalidateConnectionQueries()` - Invalidate connection data

**Message Adapter** (`utils/messageAdapter.ts`)

Platform abstraction for communication:

```
┌─────────────────────────────────────────────────────────┐
│                    MessageAdapter                        │
├─────────────────────────────────────────────────────────┤
│  Auto-detects platform and uses appropriate backend:    │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   VSCode    │  │   Electron  │  │   Development   │ │
│  │  Webview    │  │   IPC       │  │   (Console)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                         │
│  Detection:                                             │
│  • window.acquireVsCodeApi → VSCode                     │
│  • window.electronAPI → Electron                        │
│  • Default → Development                                │
└─────────────────────────────────────────────────────────┘
```

**Key Functions:**
- `getMessageAdapter()` - Get platform-appropriate adapter
- `sendMessage(type, payload)` - Send single message
- `sendMessageMulti(messages)` - Send batch messages

**Why Separate Package:**
- Unified state across platforms
- Reduces duplicate state logic
- TanStack Query provides caching/invalidation
- Zustand stores are portable

---

### 4. @dbview/ui

**Location:** `packages/ui/`

**Purpose:** Shared React UI components used by both VSCode Extension (webview) and Desktop Application.

**Component Categories:**

**Layout Components:**
- `Sidebar` - Connection tree and schema explorer
- `TabBar` - Tab management and navigation
- `TableView` - Main table display wrapper
- `SqlRunnerView` - SQL editor with results

**Data Display:**
- `DataGridV2` - Advanced data grid component
- `VirtualDataGrid` - Virtualized grid for large datasets
- `ERDiagramPanel` - Entity relationship visualization
- `TableMetadataPanel` - Column and constraint info
- `QueryHistoryPanel` - Query history list
- `SavedViewsPanel` - Saved views list

**Forms and Dialogs:**
- `AddConnectionDialog` - New connection form
- `InsertRowModal` / `InsertRowPanel` - Row insertion
- `FilterBuilder` - Dynamic filter UI
- `SaveViewDialog` - Save view configuration
- `ImportDataDialog` - Data import wizard
- `ExportDataDialog` - Data export wizard
- `DeleteConfirmDialog` - Delete confirmation

**Platform-Specific Entry Points:**

**VSCode Entry** (`App.tsx`)
- Initializes with VSCode theme
- Sets up webview message listeners
- Manages tab state and query history
- Handles autocomplete data

**Electron Entry** (`ElectronApp.tsx`)
- Initializes with Electron theme
- Sets up menu event handlers
- Uses electronAPI for operations
- Handles split view mode

**Hooks:**
- `useAppMessages()` - Message handler for webview communication
- Re-exports hooks from @dbview/shared-state

**Styling:**
- Tailwind CSS for styling
- Theme-aware design (light/dark)
- Platform-consistent appearance

**Why Separate Package:**
- Maximum code reuse
- Single source of truth for UI
- Consistent look and feel
- Bug fixes benefit both platforms

---

### 5. @dbview/desktop-ui

**Location:** `packages/desktop-ui/`

**Purpose:** Desktop-specific UI wrapper that loads the shared UI with Electron-specific configuration.

**Entry Point:** `App.tsx`

**Responsibilities:**
- Provide Electron API context to shared components
- Handle desktop-specific features (split view, menus)
- Theme synchronization with OS
- Menu action handlers

**Build Output:**
- Built with Vite
- Outputs to `dist/` folder
- Loaded by Electron main process

---

### 6. @dbview/utils

**Location:** `packages/utils/`

**Purpose:** Common utility functions used across packages.

**Utilities:**
- String formatting helpers
- Date/time utilities
- Connection key generators
- SQL formatting wrappers
- Type guards

---

### 7. @dbview/core

**Location:** `packages/core/`

**Purpose:** Core business logic that doesn't fit in specific packages.

---

## Cross-Platform Control Flow

### How VSCode Extension Uses Packages

```
┌────────────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                          │
│                                                                     │
│  extension.ts                                                       │
│       │                                                             │
│       ├──► imports @dbview/adapters                                 │
│       │    └─► Creates DatabaseAdapter via factory                  │
│       │                                                             │
│       ├──► imports @dbview/types                                    │
│       │    └─► Uses type definitions                                │
│       │                                                             │
│       └──► Sends data to webview                                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                   postMessage / onMessage
                              │
┌────────────────────────────────────────────────────────────────────┐
│                        Webview (React)                              │
│                                                                     │
│  @dbview/ui (App.tsx)                                               │
│       │                                                             │
│       ├──► imports @dbview/shared-state                             │
│       │    ├─► Zustand stores (tabs, UI, selection)                 │
│       │    └─► TanStack Query (caching)                             │
│       │                                                             │
│       ├──► imports @dbview/types                                    │
│       │    └─► Type checking                                        │
│       │                                                             │
│       └──► Uses MessageAdapter (VSCode mode)                        │
│            └─► Communicates via acquireVsCodeApi                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### How Desktop Application Uses Packages

```
┌────────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                           │
│                                                                     │
│  main.ts                                                            │
│       │                                                             │
│       ├──► imports @dbview/adapters                                 │
│       │    └─► Creates DatabaseAdapter via factory                  │
│       │                                                             │
│       ├──► imports @dbview/types                                    │
│       │    └─► Uses type definitions                                │
│       │                                                             │
│       └──► Handles IPC from renderer                                │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                    IPC (invoke/handle)
                              │
┌────────────────────────────────────────────────────────────────────┐
│                     Electron Renderer Process                       │
│                                                                     │
│  @dbview/desktop-ui (App.tsx)                                       │
│       │                                                             │
│       └──► imports @dbview/ui                                       │
│            │                                                        │
│            ├──► imports @dbview/shared-state                        │
│            │    ├─► Zustand stores (tabs, UI, selection)            │
│            │    └─► TanStack Query (caching)                        │
│            │                                                        │
│            ├──► imports @dbview/types                               │
│            │    └─► Type checking                                   │
│            │                                                        │
│            └──► Uses MessageAdapter (Electron mode)                 │
│                 └─► Communicates via electronAPI                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Platform Abstraction Pattern

The `MessageAdapter` in `@dbview/shared-state` is the key to cross-platform operation:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Component Code                            │
│                                                                 │
│   const adapter = getMessageAdapter();                          │
│   adapter.sendMessage('LOAD_TABLE_ROWS', params);               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MessageAdapter                              │
│                                                                 │
│   if (window.acquireVsCodeApi) {                                │
│       // VSCode webview mode                                    │
│       vscodeApi.postMessage(message);                           │
│   }                                                             │
│   else if (window.electronAPI) {                                │
│       // Electron renderer mode                                 │
│       electronAPI[channel].invoke(params);                      │
│   }                                                             │
│   else {                                                        │
│       // Development mode                                       │
│       console.log('Message:', message);                         │
│   }                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Components don't know which platform they're on
- Same React code works in both environments
- Platform-specific logic isolated to adapter
- Easy to add new platforms (web, mobile)

---

## Data Flow Comparison

### Table Data Loading - VSCode

```
TableView Component
        │
        ▼
MessageAdapter.sendMessage('LOAD_TABLE_ROWS', params)
        │
        ▼
acquireVsCodeApi().postMessage()
        │
        ▼
Extension Host receives message
        │
        ▼
DatabaseAdapter.loadTableRows()
        │
        ▼
Database returns data
        │
        ▼
Extension posts response to webview
        │
        ▼
MessageAdapter.onMessage() fires
        │
        ▼
TanStack Query cache updated
        │
        ▼
TableView re-renders with data
```

### Table Data Loading - Desktop

```
TableView Component
        │
        ▼
MessageAdapter.sendMessage('LOAD_TABLE_ROWS', params)
        │
        ▼
electronAPI.table.loadRows(params)
        │
        ▼
ipcRenderer.invoke('table:loadRows', params)
        │
        ▼
Main Process IPC Handler
        │
        ▼
ConnectionManager.getOrCreateAdapter()
        │
        ▼
DatabaseAdapter.loadTableRows()
        │
        ▼
Database returns data
        │
        ▼
IPC returns result to renderer
        │
        ▼
TanStack Query cache updated
        │
        ▼
TableView re-renders with data
```

---

## State Synchronization

Both platforms share the same state structure via `@dbview/shared-state`:

```
┌──────────────────────────────────────────────────────────────────┐
│                    Shared State Layer                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Zustand Stores                         │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │  tabStore   │  │  uiStore    │  │  selectionStore │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │                                                           │   │
│  │  Same store definitions in both VSCode and Desktop        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  TanStack Query                           │   │
│  │                                                           │   │
│  │  Same query keys, same cache structure                    │   │
│  │  Different fetch implementations per platform             │   │
│  │                                                           │   │
│  │  Queries:                                                 │   │
│  │  • ['connections'] → fetches via platform adapter         │   │
│  │  • ['table', key, schema, table] → fetches via adapter    │   │
│  │  • ['schema', connectionKey] → fetches via adapter        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Package Build Order

Due to dependencies, packages must be built in order:

```
1. @dbview/types        (no dependencies)
        │
        ▼
2. @dbview/utils        (depends on types)
        │
        ▼
3. @dbview/adapters     (depends on types)
        │
        ▼
4. @dbview/shared-state (depends on types)
        │
        ▼
5. @dbview/ui           (depends on all above)
        │
        ▼
6. @dbview/desktop-ui   (depends on ui)
        │
        ▼
7. apps/vscode-extension (depends on adapters, types)
   apps/desktop          (depends on adapters, desktop-ui)
```

---

## Workspace Configuration

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**Package References:**

Each package uses workspace protocol for internal dependencies:

```
"dependencies": {
  "@dbview/types": "workspace:*",
  "@dbview/shared-state": "workspace:*"
}
```

**Benefits:**
- Automatic version resolution
- Changes immediately available
- No manual version bumping
- Consistent dependency versions

---

## Adding New Shared Functionality

### Adding a New Type

1. Define type in `packages/types/src/types/index.ts`
2. Export from package index
3. Available in all consuming packages

### Adding a New Component

1. Create component in `packages/ui/src/components/`
2. Export from package index
3. Use in both VSCode and Desktop apps
4. Handle platform differences via MessageAdapter

### Adding a New Store

1. Create store in `packages/shared-state/src/stores/`
2. Export from package index
3. Available in both platforms
4. Configure persistence per platform if needed

### Adding a New Database

1. Create adapter in `packages/adapters/src/adapters/`
2. Implement DatabaseAdapter interface
3. Add to DatabaseAdapterFactory
4. Update DatabaseType union in types package
5. Add capability configuration

---

## Key Architectural Benefits

1. **Single Source of Truth**
   - Types defined once, used everywhere
   - Components defined once, rendered anywhere
   - State management unified across platforms

2. **Platform Independence**
   - Business logic doesn't know about platform
   - UI components are platform-agnostic
   - MessageAdapter handles platform specifics

3. **Maintainability**
   - Bug fixes benefit all platforms
   - Feature additions available everywhere
   - Consistent behavior across platforms

4. **Scalability**
   - New databases via adapter pattern
   - New platforms via MessageAdapter
   - New features in shared packages

5. **Developer Experience**
   - TypeScript everywhere
   - Shared tooling and configs
   - Consistent code style

---

## File Structure Summary

```
db-view-app/
├── packages/
│   ├── types/
│   │   └── src/types/index.ts        # All shared types
│   │
│   ├── adapters/
│   │   └── src/
│   │       ├── adapters/             # Database adapters
│   │       │   ├── DatabaseAdapter.ts
│   │       │   ├── PostgresAdapter.ts
│   │       │   └── ...
│   │       ├── DatabaseAdapterFactory.ts
│   │       └── capabilities/
│   │
│   ├── shared-state/
│   │   └── src/
│   │       ├── stores/               # Zustand stores
│   │       │   ├── tabStore.ts
│   │       │   ├── uiStore.ts
│   │       │   └── ...
│   │       ├── queries/              # TanStack Query hooks
│   │       │   ├── queryClient.ts
│   │       │   ├── useTableData.ts
│   │       │   └── useConnections.ts
│   │       └── utils/
│   │           └── messageAdapter.ts
│   │
│   ├── ui/
│   │   └── src/
│   │       ├── App.tsx               # VSCode entry
│   │       ├── ElectronApp.tsx       # Desktop entry
│   │       ├── components/           # Shared components
│   │       └── hooks/                # Shared hooks
│   │
│   └── desktop-ui/
│       └── src/
│           └── App.tsx               # Desktop wrapper
│
└── apps/
    ├── vscode-extension/
    │   └── src/
    │       ├── extension.ts          # Uses @dbview/adapters
    │       └── webviewHost.ts        # Loads @dbview/ui
    │
    └── desktop/
        └── src/
            ├── main/                 # Uses @dbview/adapters
            └── preload/              # Exposes API for @dbview/ui
```
