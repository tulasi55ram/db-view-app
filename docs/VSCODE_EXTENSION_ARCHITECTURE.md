# VSCode Extension Architecture Documentation

## Overview

The DB View VSCode Extension is a comprehensive database exploration and management tool integrated directly into Visual Studio Code. It provides a native IDE experience for connecting to multiple database types, browsing schemas, querying data, and visualizing relationships through ER diagrams.

---

## High-Level Architecture

The extension follows a **three-layer architecture**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VSCode Extension Host                         │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │  Commands   │  │  Tree Providers  │  │   Connection Manager    │ │
│  │ (40+ cmds)  │  │ (Schema Explorer)│  │  (Settings + Secrets)   │ │
│  └──────┬──────┘  └────────┬─────────┘  └───────────┬─────────────┘ │
│         │                  │                        │               │
│         └──────────────────┼────────────────────────┘               │
│                            │                                        │
│                   ┌────────▼────────┐                               │
│                   │  Main Panel     │                               │
│                   │ (Webview Host)  │                               │
│                   └────────┬────────┘                               │
└────────────────────────────┼────────────────────────────────────────┘
                             │ postMessage / onMessage
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                         Webview (React UI)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Tab Bar    │  │  Table View  │  │  SQL Runner              │   │
│  └─────────────┘  └──────────────┘  └──────────────────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Filter UI   │  │  Data Grid   │  │  ER Diagram Panel        │   │
│  └─────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ Database Adapter Calls
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Database Adapters Layer                         │
│  ┌──────────┐ ┌───────┐ ┌────────┐ ┌─────────┐ ┌───────────────┐   │
│  │ Postgres │ │ MySQL │ │ SQLite │ │ MongoDB │ │ Redis + more  │   │
│  └──────────┘ └───────┘ └────────┘ └─────────┘ └───────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Extension Entry Point

**File:** `apps/vscode-extension/src/extension.ts`

This is the main entry point that VSCode calls when the extension activates. It orchestrates the entire extension lifecycle.

**Key Function:** `activate(context: vscode.ExtensionContext)`

**Responsibilities:**
- Runs data migration for multi-database support (upgrading from single to multi-connection)
- Loads stored connections from VSCode global state
- Creates the initial DatabaseAdapter via factory pattern
- Initializes the Schema Explorer tree view provider
- Registers all 40+ extension commands
- Sets up auto-connect behavior based on user preferences
- Manages the extension lifecycle and cleanup on deactivation

**Activation Flow:**
1. Migration check for legacy single-connection configs
2. Load all saved connection configurations
3. Register SchemaExplorerProvider with the sidebar tree view
4. Register all commands (connection management, schema operations, data operations)
5. Check for auto-connect preference and establish initial connection
6. Set up event listeners for configuration changes

---

### 2. Schema Explorer (Tree View)

**File:** `apps/vscode-extension/src/schemaExplorer.ts`

**Class:** `SchemaExplorerProvider`

Implements VSCode's `TreeDataProvider<SchemaTreeItem>` interface to display the database structure in a hierarchical tree view.

**Tree Hierarchy:**
```
Connection (Server Name)
├── Schema 1
│   ├── Tables
│   │   ├── Table A
│   │   │   ├── column_1 (type)
│   │   │   ├── column_2 (type)
│   │   │   └── ...
│   │   └── Table B
│   ├── Views
│   │   └── View A
│   ├── Materialized Views
│   │   └── Mat View A
│   └── Functions
│       └── function_name()
├── Schema 2
│   └── ...
└── [Add Connection]
```

**Key Methods:**
- `getOrCreateClient(connectionKey)` - Lazy client instantiation with caching
- `invalidateClient(connectionKey)` - Removes cached adapter when connection changes
- `disconnectConnection(connectionKey)` - Gracefully disconnects and cleans up
- `getChildren(element?)` - Returns tree children based on node type
- `refresh()` - Triggers tree view refresh via event emitter
- `getConnectionStatus(connectionKey)` - Returns current connection status

**Features:**
- Multi-connection support with connection-level grouping
- Lazy loading of schema tree (loads children on expand)
- Client caching to prevent redundant connections
- Status tracking per connection (connected, disconnected, error)
- Error notification deduplication (prevents alert spam)
- Context menu actions per node type

---

### 3. Main Panel (Webview Management)

**File:** `apps/vscode-extension/src/mainPanel.ts`

**Class:** `MainPanel`

Manages the webview panels that display the main UI (table data, query results, ER diagrams).

**Key Concepts:**

**Panel-Per-Connection Model:**
- Each connection gets its own webview panel
- Panels are tracked in a Map: `Map<connectionKey, WebviewPanel>`
- Reuses existing panel when switching back to a connection

**Message Queuing System:**
- Webview may not be ready immediately after creation
- Messages are queued until webview signals WEBVIEW_READY
- Queue is flushed once webview is ready

**Key Functions:**
- `getOrCreatePanel(connectionKey)` - Creates or reveals existing panel
- `openTableInPanel(tableIdentifier)` - Opens table in appropriate panel
- `sendMessageToPanel(message)` - Sends message with queue support
- `handleWebviewMessage(message)` - Processes incoming webview messages

**Supported Operations:**
- Table data loading with pagination
- Cell updates (inline editing)
- Row insertion and deletion
- SQL query execution
- Query formatting and explanation
- ER diagram generation
- Autocomplete data fetching

---

### 4. Webview Host

**File:** `apps/vscode-extension/src/webviewHost.ts`

Generates the HTML content for webview panels with proper security configurations.

**Security Features:**
- Content Security Policy (CSP) enforcement
- Nonce-based script loading (prevents XSS)
- Restricted resource loading (only from extension)
- Context isolation enabled

**Theme Integration:**
- Detects VSCode theme (light/dark/high-contrast)
- Passes theme to React app via data attributes
- Listens for theme changes and updates webview

**Key Function:** `getWebviewContent(webview, extensionUri, theme)`

---

### 5. Connection Settings Management

**File:** `apps/vscode-extension/src/connectionSettings.ts`

Handles persistence and retrieval of database connection configurations.

**Storage Strategy:**
- **Connection configs:** VSCode `globalState` (synced across machines if sync enabled)
- **Passwords:** VSCode `secrets` API (OS-level secure storage)

**Key Functions:**
- `getAllConnections(context)` - Retrieves all saved connections
- `saveConnection(context, config)` - Persists connection configuration
- `deleteConnection(context, connectionKey)` - Removes connection and associated password
- `migrateConnections(context)` - Upgrades legacy single-connection format
- `validateConnection(config)` - Validates configuration before saving

**Password Security:**
- Passwords never stored in plain text
- Uses VSCode's SecretStorage API
- Passwords stored separately from connection configs
- Automatic password retrieval on connect

---

### 6. Connection Config Panel

**File:** `apps/vscode-extension/src/connectionConfigPanel.ts`

A dedicated webview panel for creating and editing database connections.

**Features:**
- Form-based connection configuration
- Database type selection with appropriate fields
- Connection testing before saving
- SSH tunnel configuration
- SSL/TLS settings

---

## Command System

The extension registers 40+ commands organized by category:

### Connection Commands
| Command | Description |
|---------|-------------|
| `dbview.configureConnection` | Opens connection configuration panel |
| `dbview.addConnection` | Add a new database connection |
| `dbview.switchConnection` | Switch between saved connections |
| `dbview.manageConnections` | Open connection management UI |
| `dbview.editConnection` | Edit existing connection |
| `dbview.deleteConnection` | Remove a saved connection |
| `dbview.copyConnectionString` | Copy connection string to clipboard |
| `dbview.clearPassword` | Remove stored password |

### Schema Commands
| Command | Description |
|---------|-------------|
| `dbview.openTable` | Open table in data view |
| `dbview.openSqlRunner` | Open SQL query editor |
| `dbview.openERDiagram` | Generate ER diagram |
| `dbview.refreshExplorer` | Refresh schema tree |

### Data Commands
| Command | Description |
|---------|-------------|
| `dbview.copyTableName` | Copy table name |
| `dbview.copySchemaTableName` | Copy schema.table name |
| `dbview.generateSelect` | Generate SELECT statement |
| `dbview.refreshTableCount` | Update row count display |

### Database Info Commands
| Command | Description |
|---------|-------------|
| `dbview.showDatabaseInfo` | Display database information |
| `dbview.showRunningQueries` | Show active queries |
| `dbview.showSecurityInfo` | Display security configuration |

---

## Communication Flow

### Extension to Webview Communication

```
Extension Host                          Webview (React)
     │                                       │
     │  ───── postMessage(data) ─────────►   │
     │                                       │
     │  (e.g., LOAD_TABLE_ROWS,              │
     │   RUN_QUERY_COMPLETE,                 │
     │   THEME_CHANGE)                       │
     │                                       │
     │  ◄───── postMessage(request) ─────   │
     │                                       │
     │  (e.g., WEBVIEW_READY,                │
     │   REQUEST_TABLE_DATA,                 │
     │   EXECUTE_QUERY)                      │
     │                                       │
```

### Message Types

**Outgoing (Extension → Webview):**
- `LOAD_TABLE_ROWS` - Table data with pagination info
- `LOAD_TABLE_ERROR` - Error loading table
- `GET_ROW_COUNT` - Total row count for pagination
- `RUN_QUERY_COMPLETE` - Query execution results
- `RUN_QUERY_ERROR` - Query execution error
- `EXPLAIN_QUERY` - Query execution plan
- `FORMAT_SQL` - Formatted SQL string
- `GET_AUTOCOMPLETE_DATA` - Schema/table/column names for autocomplete
- `THEME_CHANGE` - VSCode theme changed

**Incoming (Webview → Extension):**
- `WEBVIEW_READY` - Webview initialization complete
- `REQUEST_TABLE_DATA` - Request to load table rows
- `EXECUTE_QUERY` - Execute SQL query
- `UPDATE_CELL` - Update single cell value
- `INSERT_ROW` - Insert new row
- `DELETE_ROWS` - Delete selected rows
- `FORMAT_SQL_REQUEST` - Format SQL query
- `EXPLAIN_QUERY_REQUEST` - Get query execution plan

---

## Database Connection Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Connection Lifecycle                          │
└──────────────────────────────────────────────────────────────────────┘

1. User Action
   └─► Command: dbview.addConnection or dbview.configureConnection

2. Configuration Panel
   └─► User enters connection details
   └─► Test connection (optional)
   └─► Save configuration

3. Storage
   ├─► Connection config → globalState
   └─► Password → SecretStorage (encrypted)

4. Connection Establishment
   └─► DatabaseAdapterFactory.create(config)
       ├─► PostgresAdapter (postgres)
       ├─► MySQLAdapter (mysql)
       ├─► SQLiteAdapter (sqlite)
       ├─► MongoDBAdapter (mongodb)
       ├─► RedisAdapter (redis)
       └─► ... other adapters

5. Schema Loading
   └─► SchemaExplorerProvider.getChildren()
       ├─► adapter.listSchemas()
       ├─► adapter.listTables()
       ├─► adapter.listViews()
       └─► adapter.getColumns()

6. Tree View Update
   └─► TreeDataProvider fires change event
   └─► VSCode refreshes tree view
```

---

## Data Operations Flow

### Loading Table Data

```
User clicks table in tree
         │
         ▼
SchemaExplorerProvider
         │
         ▼
MainPanel.openTableInPanel()
         │
         ▼
Create/Reveal WebviewPanel
         │
         ▼
Send LOAD_TABLE_ROWS message
         │
         ▼
App.tsx message handler
         │
         ▼
DatabaseAdapter.loadTableRows()
         │
         ▼
Database query execution
         │
         ▼
Return rows + metadata
         │
         ▼
TableView component renders
```

### Running SQL Query

```
User types SQL in editor
         │
         ▼
Clicks Execute button
         │
         ▼
Webview posts EXECUTE_QUERY
         │
         ▼
MainPanel.handleWebviewMessage()
         │
         ▼
DatabaseAdapter.runQuery()
         │
         ▼
Parse and execute SQL
         │
         ▼
Return QueryResultSet
         │
         ▼
Post RUN_QUERY_COMPLETE
         │
         ▼
SqlRunnerView displays results
```

---

## State Management in Webview

The webview uses a combination of state management approaches:

### Client State (Zustand)
- **Tab Store:** Open tabs, active tab, split view mode
- **UI Store:** Sidebar state, theme, panel visibility
- **Selection Store:** Current selections, editing cell
- **Query History Store:** Recent queries, favorites

### Server State (TanStack Query)
- Table data caching and invalidation
- Connection status caching
- Automatic refetch on window focus

### Message Adapter
The webview uses a `MessageAdapter` that abstracts the VSCode API:
- `acquireVsCodeApi()` - Gets VSCode API instance
- `postMessage(message)` - Sends message to extension
- `onMessage(handler)` - Listens for extension messages

---

## Security Model

### Password Storage
```
┌─────────────────────────────────────────────┐
│           VSCode SecretStorage               │
│  ┌───────────────────────────────────────┐  │
│  │  OS-Level Encryption                  │  │
│  │  ├─► Windows: Credential Manager      │  │
│  │  ├─► macOS: Keychain                  │  │
│  │  └─► Linux: Secret Service            │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Webview Security
- Content Security Policy restricts script sources
- Nonce-based script loading
- No inline scripts allowed
- Resources loaded only from extension
- Context isolation prevents global access

---

## Multi-Connection Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Connection Management                        │
│                                                                │
│   connections: Map<connectionKey, DatabaseAdapter>             │
│                                                                │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │ Connection 1 │  │ Connection 2 │  │ Connection 3 │        │
│   │ (postgres)   │  │ (mysql)      │  │ (mongodb)    │        │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│          │                 │                 │                 │
│          ▼                 ▼                 ▼                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │ WebviewPanel │  │ WebviewPanel │  │ WebviewPanel │        │
│   │ (Connection1)│  │ (Connection2)│  │ (Connection3)│        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────────────────────────────────────────┘
```

Each connection maintains:
- Its own DatabaseAdapter instance (cached)
- Its own WebviewPanel (one per connection)
- Independent status tracking
- Separate tree branch in Schema Explorer

---

## File Structure Summary

```
apps/vscode-extension/
├── src/
│   ├── extension.ts          # Main entry point
│   ├── schemaExplorer.ts     # Tree view provider
│   ├── mainPanel.ts          # Webview panel management
│   ├── webviewHost.ts        # Webview HTML generation
│   ├── connectionSettings.ts # Connection persistence
│   └── connectionConfigPanel.ts # Connection form UI
├── package.json              # Extension manifest
└── tsconfig.json             # TypeScript configuration
```

---

## Key Architectural Decisions

1. **Panel-Per-Connection Model**
   - Each database connection gets its own webview panel
   - Prevents context confusion when switching connections
   - Allows side-by-side comparison of different databases

2. **Lazy Client Creation**
   - Database adapters created only when needed
   - Cached for reuse to prevent connection overhead
   - Invalidated on configuration changes

3. **Message Queue System**
   - Handles race condition between panel creation and webview ready state
   - Ensures no messages lost during initialization

4. **Shared UI Package**
   - Webview loads React components from shared `@dbview/ui` package
   - Same components used in desktop app
   - Reduces code duplication

5. **Adapter Pattern for Databases**
   - All database operations go through abstract DatabaseAdapter interface
   - New databases added by implementing adapter interface
   - No changes needed to extension core code

---

## Performance Considerations

- **Pagination:** Large tables loaded in pages (configurable limit)
- **Autocomplete Limits:** Configurable limits on schema/table/column suggestions
- **Tree Lazy Loading:** Schema tree loads children on expand, not upfront
- **Client Caching:** Database connections reused, not recreated
- **Message Batching:** Related operations grouped when possible
