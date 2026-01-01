# Desktop Application Architecture Documentation

## Overview

The DB View Desktop Application is a cross-platform database management tool built with Electron. It provides a native desktop experience for connecting to multiple databases, browsing schemas, executing queries, and visualizing data relationships. The application runs on Windows, macOS, and Linux.

---

## High-Level Architecture

The desktop application follows Electron's **main/renderer process architecture**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Main Process (Node.js)                         │
│  ┌──────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │ Connection       │  │  Settings Store    │  │  Password Store    │  │
│  │ Manager          │  │  (electron-store)  │  │  (keytar)          │  │
│  └────────┬─────────┘  └─────────┬──────────┘  └─────────┬──────────┘  │
│           │                      │                       │              │
│           └──────────────────────┼───────────────────────┘              │
│                                  │                                      │
│                      ┌───────────▼───────────┐                          │
│                      │    IPC Handlers       │                          │
│                      │    (200+ handlers)    │                          │
│                      └───────────┬───────────┘                          │
│                                  │                                      │
│  ┌─────────────────────┐         │          ┌─────────────────────┐    │
│  │   Tray Manager      │         │          │   Auto Updater      │    │
│  └─────────────────────┘         │          └─────────────────────┘    │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
                    ipcMain / ipcRenderer
                                   │
┌──────────────────────────────────▼──────────────────────────────────────┐
│                           Preload Script                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  contextBridge.exposeInMainWorld                 │   │
│  │                       (electronAPI)                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                            electronAPI calls
                                   │
┌──────────────────────────────────▼──────────────────────────────────────┐
│                        Renderer Process (React)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  Sidebar    │  │   Tab Bar    │  │ Table View  │  │ SQL Runner   │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Filter UI   │  │  Data Grid   │  │ ER Diagram  │  │ Query History│  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                         Database Adapter Calls
                                   │
┌──────────────────────────────────▼──────────────────────────────────────┐
│                         Database Adapters                                │
│  ┌──────────┐ ┌───────┐ ┌────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐  │
│  │ Postgres │ │ MySQL │ │ SQLite │ │ MongoDB │ │  Redis  │ │ + more │  │
│  └──────────┘ └───────┘ └────────┘ └─────────┘ └─────────┘ └────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Process Architecture

### Main Process

The main process runs in Node.js and has full access to system resources. It handles:
- Window management
- File system operations
- Database connections
- Secure credential storage
- System tray integration
- Auto-updates

### Renderer Process

The renderer process runs in a Chromium-based browser environment. It handles:
- User interface (React application)
- User interactions
- State management
- Data visualization

### Preload Script

The preload script bridges the main and renderer processes securely:
- Runs in isolated context with Node.js access
- Exposes safe APIs to renderer via `contextBridge`
- Prevents direct Node.js access from web content

---

## Core Components

### 1. Main Entry Point

**File:** `apps/desktop/src/main/main.ts`

This is the Electron main process entry point that initializes the application.

**Responsibilities:**
- Create the main BrowserWindow
- Configure window settings (size, security, etc.)
- Load the UI from Vite dev server (development) or built files (production)
- Register all IPC handlers
- Set up theme synchronization
- Initialize system tray
- Configure auto-updater
- Enforce Content Security Policy

**Window Configuration:**
- Context isolation enabled (security)
- Node integration disabled in renderer
- Sandbox mode enabled
- Preload script specified

**Startup Flow:**
1. Create BrowserWindow with security settings
2. Register all IPC handlers via `registerAllHandlers()`
3. Load UI content (Vite dev server or production build)
4. Initialize TrayManager
5. Initialize AutoUpdater
6. Set up theme change listeners

---

### 2. IPC Handler System

**File:** `apps/desktop/src/main/ipc/index.ts`

The IPC (Inter-Process Communication) handler system processes requests from the renderer process.

**Key Function:** `registerAllHandlers(mainWindow)`

**Handler Categories:**

#### Connection Management
| Handler | Description |
|---------|-------------|
| `connection:getAll` | Get all saved connections with status |
| `connection:save` | Save connection configuration |
| `connection:delete` | Delete a connection |
| `connection:test` | Test connection without saving |
| `connection:connect` | Establish connection |
| `connection:disconnect` | Close connection |

#### Schema Operations
| Handler | Description |
|---------|-------------|
| `schema:list` | List all schemas |
| `schema:getTables` | Get tables in schema |
| `schema:getHierarchy` | Get full schema tree |
| `schema:getObjectCounts` | Get counts of objects |
| `schema:getViews` | List views |
| `schema:getMaterializedViews` | List materialized views |
| `schema:getFunctions` | List functions |

#### Table Operations
| Handler | Description |
|---------|-------------|
| `table:loadRows` | Load table data with pagination |
| `table:getRowCount` | Get total row count |
| `table:getMetadata` | Get column definitions |
| `table:updateCell` | Update single cell |
| `table:insertRow` | Insert new row |
| `table:deleteRows` | Delete selected rows |

#### Query Operations
| Handler | Description |
|---------|-------------|
| `query:run` | Execute SQL query |
| `query:format` | Format SQL query |
| `query:explain` | Get execution plan |

#### View Management
| Handler | Description |
|---------|-------------|
| `view:getAll` | Get saved views |
| `view:save` | Save view definition |
| `view:delete` | Delete saved view |

#### Other Operations
| Handler | Description |
|---------|-------------|
| `erDiagram:generate` | Generate ER diagram data |
| `history:get` | Get query history |
| `history:add` | Add to query history |
| `savedQueries:getAll` | Get saved queries |
| `savedQueries:save` | Save a query |
| `dialog:showSave` | Show save file dialog |
| `dialog:showOpen` | Show open file dialog |
| `clipboard:write` | Write to clipboard |
| `import:data` | Import data with progress |
| `export:data` | Export data with progress |

---

### 3. Preload Script

**File:** `apps/desktop/src/preload/preload.ts`

Exposes a safe API to the renderer process via `contextBridge`.

**Exposed Object:** `window.electronAPI`

**API Structure:**
```
electronAPI
├── connections
│   ├── getAll()
│   ├── save(config)
│   ├── delete(key)
│   ├── test(config)
│   ├── connect(key)
│   └── disconnect(key)
├── schema
│   ├── list(connectionKey)
│   ├── getTables(connectionKey, schema)
│   ├── getHierarchy(connectionKey)
│   └── ...
├── table
│   ├── loadRows(params)
│   ├── getRowCount(params)
│   ├── updateCell(params)
│   └── ...
├── query
│   ├── run(params)
│   ├── format(sql)
│   └── explain(params)
├── views
│   ├── getAll(connectionKey)
│   ├── save(view)
│   └── delete(viewId)
├── erDiagram
│   └── generate(connectionKey)
├── clipboard
│   └── write(text)
├── dialog
│   ├── showSave(options)
│   └── showOpen(options)
├── history
│   ├── get()
│   └── add(entry)
├── savedQueries
│   ├── getAll()
│   ├── save(query)
│   └── delete(id)
├── updates
│   ├── check()
│   └── install()
└── events
    ├── onConnectionStatusChange(callback)
    ├── onThemeChange(callback)
    ├── onImportProgress(callback)
    └── onUpdateAvailable(callback)
```

**Event Subscriptions:**
Each event subscription returns a cleanup function for proper listener removal.

---

### 4. Preload API Types

**File:** `apps/desktop/src/preload/api.ts`

Defines TypeScript interfaces for the exposed API, ensuring type safety between main and renderer processes.

**Key Interface:** `ElectronAPI`

This interface mirrors the structure exposed in preload.ts and is used by the renderer for type checking.

---

### 5. Connection Manager

**File:** `apps/desktop/src/main/services/ConnectionManager.ts`

**Class:** `ConnectionManager`

Central service for managing database connections in the main process.

**State:**
- `adapters: Map<connectionKey, DatabaseAdapter>` - Active adapter instances
- `statusListeners: Set<connectionKey>` - Tracks which connections have status listeners

**Key Methods:**

| Method | Description |
|--------|-------------|
| `getConnectionsWithStatus()` | Returns all connections with current status |
| `getOrCreateAdapter(connectionKey)` | Gets existing or creates new adapter |
| `testConnection(config)` | Tests connection without caching |
| `saveConnectionConfig(config)` | Persists connection to settings |
| `deleteConnection(connectionKey)` | Removes connection and adapter |
| `disconnect(connectionKey)` | Disconnects without removing config |
| `reconnect(connectionKey)` | Forces reconnection |

**Connection Key Generation:**
- Unique identifier per connection config
- Based on host, port, database, and type
- Used as map key for adapter lookup

**Status Broadcasting:**
When a connection's status changes, the manager broadcasts to all windows:
```
ConnectionManager
      │
      ▼
adapter.on('statusChange', event)
      │
      ▼
mainWindow.webContents.send('connection:statusChange', data)
      │
      ▼
All renderer processes receive update
```

**Reconnection Logic:**
- Implements exponential backoff for failed connections
- Maximum retry attempts configurable
- Automatic reconnection on transient failures

---

### 6. Settings Store

**File:** `apps/desktop/src/main/services/SettingsStore.ts`

Uses `electron-store` for persistent settings storage.

**Storage Location:**
- Windows: `%APPDATA%/dbview/config.json`
- macOS: `~/Library/Application Support/dbview/config.json`
- Linux: `~/.config/dbview/config.json`

**Stored Data:**

| Key | Description |
|-----|-------------|
| `connections` | Array of connection configurations |
| `connectionOrder` | Order of connections in sidebar |
| `queryHistory` | Recent query history |
| `savedQueries` | User-saved queries |
| `filterPresets` | Saved filter configurations |
| `tabState` | Open tabs per connection |
| `viewDefinitions` | Saved view definitions |
| `preferences` | User preferences (theme, density, etc.) |

**Key Methods:**
- `getAllConnections()` - Get all saved connections
- `saveConnection(config)` - Add or update connection
- `deleteConnectionConfig(key)` - Remove connection
- `getQueryHistory()` - Get query history
- `addQueryHistoryEntry(entry)` - Add to history
- `getSavedQueries()` - Get saved queries
- `getTabState(connectionKey)` - Get persisted tabs

---

### 7. Password Store

**File:** `apps/desktop/src/main/services/PasswordStore.ts`

Uses `keytar` for OS-level secure credential storage.

**Storage Backends:**
- **Windows:** Windows Credential Manager
- **macOS:** macOS Keychain
- **Linux:** Secret Service (libsecret)

**Service Name:** `dbview`

**Key Methods:**
| Method | Description |
|--------|-------------|
| `getPassword(connectionKey)` | Retrieve password from OS store |
| `setPassword(connectionKey, password)` | Store password securely |
| `deletePassword(connectionKey)` | Remove stored password |

**Security Benefits:**
- Passwords encrypted at rest by OS
- Protected by OS user authentication
- Never stored in plain text files
- Not accessible by other applications

---

### 8. Tray Manager

**File:** `apps/desktop/src/main/services/TrayManager.ts`

**Class:** `TrayManager` (Singleton)

Manages the system tray icon and context menu.

**Features:**
- Application icon in system tray
- Right-click context menu
- Quick access to common actions
- Show/hide window toggle
- Quit application

**Menu Items:**
- Show/Hide Window
- New Query
- Manage Connections
- Preferences
- Check for Updates
- Quit

---

### 9. Auto Updater

**File:** `apps/desktop/src/main/services/AutoUpdater.ts`

Uses `electron-updater` for automatic application updates.

**Features:**
- Checks for updates on startup
- Downloads updates in background
- Notifies user when update ready
- Installs update on quit

**Update Flow:**
1. App starts → Check for updates
2. Update available → Download in background
3. Download complete → Notify user
4. User confirms → Install and restart

**Events Broadcast:**
- `update:available` - New version found
- `update:downloaded` - Ready to install
- `update:error` - Update failed

---

## Renderer Process (UI Layer)

### UI Entry Point

**File:** `packages/desktop-ui/src/App.tsx`

The desktop-specific wrapper that loads the shared UI components.

**Responsibilities:**
- Initialize theme from Electron
- Set up menu event handlers
- Provide ElectronAPI context to components
- Render main application layout

### Shared UI Components

The renderer loads components from the shared `@dbview/ui` package:

**Core Layout:**
- `Sidebar` - Connection tree and schema explorer
- `TabBar` - Tab management
- `TableView` - Table data display
- `SqlRunnerView` - SQL query editor

**Data Components:**
- `DataGridV2` - Advanced data grid with virtualization
- `VirtualDataGrid` - Virtualized rows for large datasets
- `FilterBuilder` - Dynamic filter UI
- `InsertRowPanel` - Row insertion form

**Dialogs:**
- `AddConnectionDialog` - New connection form
- `SaveViewDialog` - Save view configuration
- `ImportDataDialog` - Data import UI
- `ExportDataDialog` - Data export UI
- `DeleteConfirmDialog` - Deletion confirmation

---

## Communication Patterns

### Synchronous IPC (invoke/handle)

Used for request/response operations:

```
Renderer                          Main
   │                                │
   │  ipcRenderer.invoke(           │
   │    'channel', args)            │
   │  ─────────────────────────────►│
   │                                │
   │                      ipcMain.handle(
   │                        'channel',
   │                        handler)
   │                                │
   │  ◄───────────────────────────  │
   │       Promise resolves         │
   │       with result              │
```

**Example Channels:**
- `connection:getAll`
- `table:loadRows`
- `query:run`

### Asynchronous Broadcasting (send/on)

Used for one-way notifications:

```
Main                              Renderer
  │                                  │
  │  webContents.send(               │
  │    'channel', data)              │
  │  ───────────────────────────────►│
  │                                  │
  │                       ipcRenderer.on(
  │                         'channel',
  │                         listener)
```

**Example Channels:**
- `connection:statusChange`
- `theme:change`
- `import:progress`
- `update:available`

---

## Data Flow Examples

### Loading Table Data

```
User clicks table in sidebar
           │
           ▼
Component calls electronAPI.table.loadRows()
           │
           ▼
Preload: ipcRenderer.invoke('table:loadRows', params)
           │
           ▼
Main: IPC handler receives request
           │
           ▼
ConnectionManager.getOrCreateAdapter(key)
           │
           ▼
DatabaseAdapter.loadTableRows(params)
           │
           ▼
Database executes query
           │
           ▼
Returns { rows, columns, totalCount }
           │
           ▼
IPC returns to renderer
           │
           ▼
TableView component renders data
```

### Connection Status Update

```
Database connection drops
           │
           ▼
DatabaseAdapter emits 'statusChange' event
           │
           ▼
ConnectionManager status listener fires
           │
           ▼
Broadcasts to all windows:
  window.webContents.send('connection:statusChange', data)
           │
           ▼
Preload listener receives event
           │
           ▼
electronAPI.events.onConnectionStatusChange(callback)
           │
           ▼
Sidebar updates connection icon (red/green)
```

### Running SQL Query

```
User types SQL and clicks Execute
           │
           ▼
SqlRunnerView calls electronAPI.query.run()
           │
           ▼
Preload: ipcRenderer.invoke('query:run', { connectionKey, sql })
           │
           ▼
Main: Query handler
           │
           ▼
ConnectionManager.getOrCreateAdapter(key)
           │
           ▼
Adapter.runQuery(sql)
           │
           ▼
Database executes, returns ResultSet
           │
           ▼
IPC returns QueryResultSet
           │
           ▼
SqlRunnerView displays results in grid
           │
           ▼
Optionally add to query history
```

---

## State Management

### Client/UI State (Zustand)

Managed in renderer process via shared-state package:

```
┌─────────────────────────────────────────────────┐
│                  Zustand Stores                  │
├─────────────────────────────────────────────────┤
│  Tab Store                                      │
│  ├─ tabs: Tab[]                                 │
│  ├─ activeTabId: string                         │
│  ├─ secondActiveTabId: string (split view)      │
│  └─ splitMode: 'horizontal' | 'vertical' | null │
├─────────────────────────────────────────────────┤
│  UI Store                                       │
│  ├─ sidebarCollapsed: boolean                   │
│  ├─ theme: 'light' | 'dark'                     │
│  ├─ tableDensity: 'compact' | 'normal'          │
│  └─ showLineNumbers: boolean                    │
├─────────────────────────────────────────────────┤
│  Selection Store                                │
│  ├─ selectedTable: TableIdentifier              │
│  └─ editingCell: CellLocation                   │
├─────────────────────────────────────────────────┤
│  Query History Store                            │
│  ├─ queryHistory: QueryHistoryEntry[]           │
│  └─ savedQueries: SavedQuery[]                  │
└─────────────────────────────────────────────────┘
```

### Server State (TanStack Query)

Caches data fetched from main process:

```
┌─────────────────────────────────────────────────┐
│              TanStack Query Cache                │
├─────────────────────────────────────────────────┤
│  ['connections']                                │
│    └─ All saved connections with status         │
├─────────────────────────────────────────────────┤
│  ['table', connectionKey, schema, table]        │
│    └─ Table data with pagination                │
├─────────────────────────────────────────────────┤
│  ['schema', connectionKey]                      │
│    └─ Schema hierarchy for connection           │
├─────────────────────────────────────────────────┤
│  ['views', connectionKey]                       │
│    └─ Saved views for connection                │
└─────────────────────────────────────────────────┘
```

**Cache Invalidation:**
- On data mutation (insert, update, delete)
- On connection change
- On window focus (configurable)
- Manual refresh by user

---

## Security Model

### Process Isolation

```
┌──────────────────────────────────────────────────────────┐
│  Main Process (Trusted)                                  │
│  ├─ Full Node.js access                                  │
│  ├─ File system access                                   │
│  ├─ Database connections                                 │
│  └─ OS integrations                                      │
└──────────────────────────────────────────────────────────┘
                         │
              contextBridge (limited API)
                         │
┌──────────────────────────────────────────────────────────┐
│  Preload Script (Sandboxed)                              │
│  ├─ Limited Node.js access                               │
│  ├─ Exposes only safe functions                          │
│  └─ No direct require() in renderer                      │
└──────────────────────────────────────────────────────────┘
                         │
              electronAPI (exposed)
                         │
┌──────────────────────────────────────────────────────────┐
│  Renderer Process (Untrusted)                            │
│  ├─ Web content only                                     │
│  ├─ No Node.js access                                    │
│  ├─ No file system access                                │
│  └─ Uses electronAPI for all operations                  │
└──────────────────────────────────────────────────────────┘
```

### Content Security Policy

The application enforces CSP to prevent:
- Inline script execution
- Loading scripts from unauthorized sources
- Cross-origin requests to untrusted domains

### Credential Storage

```
Password Request Flow:
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Renderer   │────►│    Main      │────►│   OS Keychain    │
│  (UI form)   │     │PasswordStore │     │ (encrypted)      │
└──────────────┘     └──────────────┘     └──────────────────┘
```

Passwords are:
- Never sent to renderer process
- Retrieved only when connection is established
- Stored encrypted by operating system
- Deleted when connection is removed

---

## Split View Architecture

The desktop app supports split view for comparing data:

```
┌─────────────────────────────────────────────────────────┐
│                        Tab Bar                           │
├─────────────────────────────────────────────────────────┤
│                    │                                    │
│   Primary View     │   Secondary View                   │
│   (activeTabId)    │   (secondActiveTabId)              │
│                    │                                    │
│   ┌─────────────┐  │  ┌─────────────┐                  │
│   │ Table A     │  │  │ Table B     │                  │
│   │ (postgres)  │  │  │ (mysql)     │                  │
│   └─────────────┘  │  └─────────────┘                  │
│                    │                                    │
└─────────────────────────────────────────────────────────┘
```

**Split Modes:**
- `null` - Single view (default)
- `horizontal` - Side by side
- `vertical` - Top and bottom

**Tab Store Actions:**
- `setSplitMode(mode)` - Enable/disable split
- `setSecondActiveTab(tabId)` - Set secondary view
- `closeSplit()` - Return to single view

---

## File Structure Summary

```
apps/desktop/
├── src/
│   ├── main/
│   │   ├── main.ts                    # Main process entry
│   │   ├── ipc/
│   │   │   └── index.ts               # IPC handler registration
│   │   └── services/
│   │       ├── ConnectionManager.ts   # Connection lifecycle
│   │       ├── SettingsStore.ts       # Persistent settings
│   │       ├── PasswordStore.ts       # Secure credentials
│   │       ├── TrayManager.ts         # System tray
│   │       └── AutoUpdater.ts         # Auto updates
│   └── preload/
│       ├── preload.ts                 # Context bridge
│       └── api.ts                     # API type definitions
├── package.json
└── electron-builder.yml               # Build configuration

packages/desktop-ui/
├── src/
│   ├── App.tsx                        # Desktop app wrapper
│   └── index.tsx                      # Entry point
└── package.json
```

---

## Key Architectural Decisions

1. **Context Isolation**
   - Renderer has no direct Node.js access
   - All system operations go through IPC
   - Prevents malicious code execution

2. **Connection Pooling**
   - Adapters cached in ConnectionManager
   - Reused across multiple operations
   - Prevents connection exhaustion

3. **Event-Driven Status Updates**
   - Connection status changes broadcast via IPC
   - UI subscribes to events
   - Decoupled from request/response flow

4. **Shared UI Package**
   - Same React components as VSCode extension
   - Platform-specific wrappers for Electron API
   - Reduces code duplication

5. **Persistent State Strategy**
   - Connection configs in electron-store
   - Passwords in OS keychain
   - Tab state persisted for session restoration

---

## Performance Considerations

- **Virtualized Data Grid:** Only visible rows rendered
- **Connection Caching:** Adapters reused, not recreated
- **Query Result Pagination:** Large results loaded in chunks
- **Background Downloads:** Updates downloaded without blocking
- **Event Batching:** Status changes debounced to prevent UI thrashing
- **Lazy Schema Loading:** Tree nodes load children on expand
