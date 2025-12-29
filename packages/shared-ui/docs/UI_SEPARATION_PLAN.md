# UI Separation Plan: Database-Specific Views

This document outlines the implementation plan for separating the UI based on database types, following the **Hybrid Approach** - a shared shell with specialized content viewers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Shared Shell                              │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │   Sidebar   │  │           Content Area               │  │
│  │  (shared)   │  │  ┌──────────────────────────────┐   │  │
│  │             │  │  │    DataView Router           │   │  │
│  │  - Tree     │  │  │                              │   │  │
│  │  - Search   │  │  │  ┌────────────────────────┐  │   │  │
│  │  - Quick    │  │  │  │ SqlDataView           │  │   │  │
│  │    Actions  │  │  │  │ (PostgreSQL, MySQL)   │  │   │  │
│  │             │  │  │  ├────────────────────────┤  │   │  │
│  │             │  │  │  │ DocumentDataView      │  │   │  │
│  │             │  │  │  │ (MongoDB, ES, Cass.)  │  │   │  │
│  │             │  │  │  ├────────────────────────┤  │   │  │
│  │             │  │  │  │ RedisDataView         │  │   │  │
│  │             │  │  │  │ (Key-Value)           │  │   │  │
│  │             │  │  │  └────────────────────────┘  │   │  │
│  │             │  │  └──────────────────────────────┘   │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Database Categories

| Category | Database Types | UI Component |
|----------|---------------|--------------|
| SQL | PostgreSQL, MySQL, MariaDB, SQLServer, SQLite | `SqlDataView` (existing `TableView`) |
| Document | MongoDB, Elasticsearch, Cassandra | `DocumentDataView` |
| Key-Value | Redis | `RedisDataView` |

---

## Implementation Phases

### Phase 1: Foundation & Routing ✅ COMPLETED

**Objective:** Set up the infrastructure for database-specific views.

**Files Created:**
- `src/utils/dbTypeUtils.ts` - Database type detection utilities
- `src/hooks/useDbType.ts` - Hook for DB type detection
- `src/hooks/index.ts` - Hooks barrel export
- `src/components/DataView/DataView.tsx` - Router component
- `src/components/DataView/types.ts` - Type definitions
- `src/components/DataView/index.ts` - Barrel export
- `src/components/DocumentDataView/DocumentDataView.tsx` - Main document viewer
- `src/components/DocumentDataView/types.ts` - Document types
- `src/components/DocumentDataView/index.ts` - Barrel export

**Changes:**
- Updated `App.tsx` to use the new `DataView` router

---

### Phase 2: Tree View Component ✅ COMPLETED

**Objective:** Build the core tree view for document visualization.

**Files Created:**
- `src/components/DocumentDataView/components/TypeIndicator.tsx` - Type badges
- `src/components/DocumentDataView/components/ValueEditor.tsx` - Inline editor
- `src/components/DocumentDataView/components/TreeNode.tsx` - Recursive tree node
- `src/components/DocumentDataView/views/TreeView.tsx` - Tree view wrapper
- `src/components/DocumentDataView/components/index.ts` - Components barrel

**Features:**
- Recursive tree rendering with expand/collapse
- Color-coded type indicators
- Inline value editing (UI ready)
- Copy/edit/delete action buttons
- Expand all / collapse all

---

### Phase 3: Document List & Navigation ✅ COMPLETED

**Objective:** Implement the document list sidebar with virtualization.

**Files Created:**
- `src/components/DocumentDataView/components/DocumentPreview.tsx` - List item preview
- `src/components/DocumentDataView/components/DocumentList.tsx` - Virtualized list

**Features:**
- TanStack Virtual for efficient rendering
- Smart field extraction for previews
- Keyboard navigation (Arrow Up/Down, Enter)
- Search/filter functionality
- Infinite scroll with "Load more"
- Auto-scroll to selected document

---

### Phase 4: Alternative Views ✅ COMPLETED

**Objective:** Add Table and JSON view modes with persistence.

**Files Created:**
- `src/components/DocumentDataView/views/TableView.tsx` - Flattened table view
- `src/components/DocumentDataView/views/JsonView.tsx` - Raw JSON editor
- `src/hooks/useViewModePreference.ts` - View mode persistence

**Features:**
- **TableView:**
  - Nested field flattening with dot notation
  - Column sorting (field, value, type)
  - Quick filter for searching fields
  - Type indicators and copy buttons

- **JsonView:**
  - CodeMirror with JSON syntax highlighting
  - Real-time validation with error display
  - Format/beautify, copy, download buttons
  - Word wrap toggle, fullscreen mode
  - Save/revert for edit mode

- **Persistence:**
  - View mode saved to localStorage
  - Per-database-type preferences
  - Optional per-container scoping

---

### Phase 5: Edit Mode & Operations ✅ COMPLETED

**Objective:** Implement actual CRUD operations for documents.

**Files Created:**
- `src/components/DocumentDataView/hooks/useDocumentOperations.ts` - CRUD operations hook
- `src/components/DocumentDataView/hooks/index.ts` - Hooks barrel export
- `src/components/DocumentDataView/components/AddFieldModal.tsx` - Add field modal
- `src/components/DocumentDataView/components/DeleteDocumentDialog.tsx` - Delete confirmation

**Features:**
- Inline field editing with actual database updates
- Field-level operations (add, edit, delete)
- Document deletion with confirmation dialog
- JSON view editing with save functionality
- Loading states during operations
- Error handling with toast notifications
- Read-only mode detection

---

### Phase 6: Advanced Features ✅ COMPLETED

**Objective:** Add power-user features.

**Files Created:**
- `src/components/DocumentDataView/components/ExportModal.tsx` - JSON/CSV export
- `src/components/DocumentDataView/components/QueryFilterBuilder.tsx` - Visual query builder
- `src/components/DocumentDataView/components/ImportModal.tsx` - JSON/CSV import with drag & drop
- `src/components/DocumentDataView/components/IndexManagementPanel.tsx` - Index viewer and creator
- `src/components/DocumentDataView/components/AggregationPipelineBuilder.tsx` - MongoDB aggregation pipeline

**Features:**
- [x] Export to JSON/CSV with options (scope, format, pretty print, flatten)
- [x] Multi-select mode with checkbox UI
- [x] Shift+click for range selection
- [x] Select all / deselect all controls
- [x] Bulk action bar with export and delete buttons
- [x] Bulk delete with confirmation dialog
- [x] Query builder for MongoDB/Elasticsearch with:
  - Visual condition builder (field, operator, value)
  - Field autocomplete from document schema
  - Support for multiple operators (equals, contains, regex, comparisons, exists)
  - Query preview showing generated MongoDB/Elasticsearch query
  - Filter indicator in toolbar
- [x] Import from JSON/CSV files with:
  - Drag & drop file upload
  - File parsing and validation
  - Preview of documents to import
  - Batch insert support
- [x] Index management UI with:
  - View existing indexes with details
  - Create new indexes (compound, unique, sparse, background)
  - Drop indexes with confirmation
  - Expand/collapse index details
- [x] MongoDB Aggregation Pipeline Builder with:
  - Visual stage builder with drag & reorder
  - Support for $match, $group, $sort, $project, $limit, $skip, $unwind, $lookup
  - Stage enable/disable toggle
  - Live pipeline preview
  - Field autocomplete from schema

---

### Phase 7: Redis Data View ✅ COMPLETED

**Objective:** Specialized view for Redis key-value data.

**Files Created:**
- `src/components/RedisDataView/RedisDataView.tsx` - Main Redis component with key browser
- `src/components/RedisDataView/types.ts` - Redis type definitions
- `src/components/RedisDataView/utils.ts` - Utility functions (TTL/memory formatting, clipboard)
- `src/components/RedisDataView/index.ts` - Barrel export
- `src/components/RedisDataView/views/RedisStringView.tsx` - String value viewer/editor
- `src/components/RedisDataView/views/RedisHashView.tsx` - Hash field viewer/editor
- `src/components/RedisDataView/views/RedisListView.tsx` - List operations viewer
- `src/components/RedisDataView/views/RedisSetView.tsx` - Set member viewer
- `src/components/RedisDataView/views/RedisSortedSetView.tsx` - Sorted set with scores
- `src/components/RedisDataView/views/RedisStreamView.tsx` - Stream entries viewer
- `src/components/RedisDataView/components/ValuePreview.tsx` - Value preview component

**Features:**
- [x] Key browser with pattern filtering and infinite scroll
- [x] Type-specific viewers (String, List, Hash, Set, Sorted Set, Stream)
- [x] TTL display with color-coded urgency indicators
- [x] TTL management (set, update, persist)
- [x] Key operations (add, delete, copy)
- [x] Memory usage display
- [x] Read-only mode support
- [x] Add new key dialog with type selection
- [x] Value format detection (JSON, text, hex)
- [x] Integrated with DataView router

---

### Phase 8: SQL Index Management 🔜 PLANNED

**Objective:** Add full index management (create/drop) for SQL databases, matching MongoDB's capabilities.

**Current Gap Analysis:**
| Database | List Indexes | Create Index | Drop Index |
|----------|:---:|:---:|:---:|
| PostgreSQL | ✓ | ✗ | ✗ |
| MySQL | ✗ (missing!) | ✗ | ✗ |
| MariaDB | ✓ | ✗ | ✗ |
| SQLite | ✓ | ✗ | ✗ |
| SQL Server | ✓ | ✗ | ✗ |

**Backend Tasks:**

1. **Fix MySQL `getIndexes()` gap:**
   - `packages/adapters/src/adapters/MySQLAdapter.ts`
   - Query `INFORMATION_SCHEMA.STATISTICS` for index metadata

2. **Add `createIndex()` to SQL adapters:**
   - PostgreSQL: `CREATE INDEX [CONCURRENTLY] name ON table (columns)`
   - MySQL: `CREATE INDEX name ON table (columns)`
   - MariaDB: Same as MySQL
   - SQLite: `CREATE INDEX name ON table (columns)`
   - SQL Server: `CREATE [UNIQUE] [CLUSTERED|NONCLUSTERED] INDEX name ON table (columns)`

3. **Add `dropIndex()` to SQL adapters:**
   - PostgreSQL: `DROP INDEX [CONCURRENTLY] IF EXISTS name`
   - MySQL/MariaDB: `DROP INDEX name ON table`
   - SQLite: `DROP INDEX IF EXISTS name`
   - SQL Server: `DROP INDEX name ON table`

4. **Add Electron API types:**
   - `CreateSqlIndexParams` with database-specific options
   - `DropSqlIndexParams`

**Frontend Tasks:**

1. **Enhance TableMetadataPanel:**
   - Add "Create Index" button with dialog
   - Add delete button for each index (except PRIMARY)
   - Show index type (btree, hash, gin, etc.)
   - Confirmation dialog for drop operations

2. **Create `CreateIndexDialog` component:**
   - Column multi-select for composite indexes
   - Index name input (auto-generate option)
   - Unique constraint toggle
   - Index type dropdown (database-specific)
   - Preview generated SQL
   - Options: CONCURRENTLY (PostgreSQL), CLUSTERED (SQL Server)

3. **Add index statistics display:**
   - Index size (where supported)
   - Usage statistics (PostgreSQL: `pg_stat_user_indexes`)

**Files to Create/Modify:**
- `packages/adapters/src/adapters/MySQLAdapter.ts` - Add getIndexes()
- `packages/adapters/src/adapters/PostgresAdapter.ts` - Add createIndex(), dropIndex()
- `packages/adapters/src/adapters/MySQLAdapter.ts` - Add createIndex(), dropIndex()
- `packages/adapters/src/adapters/MariaDBAdapter.ts` - Add createIndex(), dropIndex()
- `packages/adapters/src/adapters/SQLiteAdapter.ts` - Add createIndex(), dropIndex()
- `packages/adapters/src/adapters/SQLServerAdapter.ts` - Add createIndex(), dropIndex()
- `packages/desktop-ui/src/components/TableView/TableMetadataPanel.tsx` - Enhance UI
- `packages/desktop-ui/src/components/TableView/CreateIndexDialog.tsx` - New component
- `packages/desktop-ui/src/electron.ts` - Add SQL index API types

**SQL Syntax Reference:**

```sql
-- PostgreSQL
CREATE INDEX CONCURRENTLY idx_name ON table_name (col1, col2);
CREATE UNIQUE INDEX idx_name ON table_name (col1) WHERE condition;
DROP INDEX CONCURRENTLY IF EXISTS idx_name;

-- MySQL/MariaDB
CREATE INDEX idx_name ON table_name (col1, col2);
CREATE UNIQUE INDEX idx_name ON table_name (col1);
DROP INDEX idx_name ON table_name;

-- SQLite
CREATE INDEX idx_name ON table_name (col1, col2);
CREATE UNIQUE INDEX IF NOT EXISTS idx_name ON table_name (col1);
DROP INDEX IF EXISTS idx_name;

-- SQL Server
CREATE NONCLUSTERED INDEX idx_name ON table_name (col1, col2);
CREATE UNIQUE CLUSTERED INDEX idx_name ON table_name (col1);
DROP INDEX idx_name ON table_name;
```

---

## File Structure

```
src/
├── components/
│   ├── DataView/
│   │   ├── DataView.tsx          # Router component
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── DocumentDataView/
│   │   ├── DocumentDataView.tsx  # Main component
│   │   ├── types.ts
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── TreeNode.tsx
│   │   │   ├── TypeIndicator.tsx
│   │   │   ├── ValueEditor.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentPreview.tsx
│   │   │   └── index.ts
│   │   ├── views/
│   │   │   ├── TreeView.tsx
│   │   │   ├── TableView.tsx
│   │   │   ├── JsonView.tsx
│   │   │   └── index.ts
│   │   └── hooks/
│   │       └── useDocumentOperations.ts (Phase 5)
│   │
│   ├── TableView/                # SQL data view (existing)
│   │
│   └── RedisDataView/            # Phase 7
│       ├── RedisDataView.tsx     # Main component
│       ├── types.ts
│       ├── utils.ts
│       ├── index.ts
│       ├── components/
│       │   └── ValuePreview.tsx
│       └── views/
│           ├── RedisStringView.tsx
│           ├── RedisHashView.tsx
│           ├── RedisListView.tsx
│           ├── RedisSetView.tsx
│           ├── RedisSortedSetView.tsx
│           ├── RedisStreamView.tsx
│           └── index.ts
│
├── hooks/
│   ├── useDbType.ts
│   ├── useViewModePreference.ts
│   └── index.ts
│
└── utils/
    └── dbTypeUtils.ts
```

---

## API Requirements

The following Electron API methods are used/needed:

### Existing (Used)
- `loadTableRows()` - Load documents with pagination
- `getConnections()` - Get connection configs (for read-only check)

### Needed for Phase 5
- `updateDocument(connectionKey, schema, collection, docId, updates)` - Update a document
- `deleteDocument(connectionKey, schema, collection, docId)` - Delete a document
- `insertDocument(connectionKey, schema, collection, document)` - Insert new document

---

## Design Decisions

1. **Hybrid Approach**: Shared shell (sidebar, tabs) with specialized content viewers per database category.

2. **View Modes**: Three view modes for documents - Tree (default), Table (flattened), JSON (raw editor).

3. **Virtualization**: Using TanStack Virtual for document list to handle large collections efficiently.

4. **Persistence**: View mode preferences stored in localStorage with hierarchical scoping (global → db type → container).

5. **Inline Editing**: Edit values directly in the tree view without modal dialogs for simple types.

6. **Type Indicators**: Color-coded badges showing data types at a glance.
