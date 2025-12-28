# dbview — Feature Roadmap & UI/UX Specification

A modern, powerful database viewer/editor for VS Code with rich UI/UX.

**Reference:** [Database Client](https://database-client.com/), [DBCode](https://dbcode.io/), [TablePlus](https://tableplus.com/)

---

## Project Status

### VSCode Extension

| Phase | Name | Completion | Status |
|-------|------|------------|--------|
| Phase 1 | MVP (Core Foundation) | 100% | ✅ Complete |
| Phase 2 | Data Editing & UX | 95% | ✅ Complete |
| Phase 3 | Advanced Table Viewer | 85% | ✅ Complete |
| Phase 4 | Schema Insights & Tools | 90% | ✅ Complete |
| Phase 5 | Productivity Tools | 95% | ✅ Complete |
| Phase 6 | Security & Performance | 100% | ✅ Complete |
| Phase 7 | Multi-Database Support | 60% | ⏳ In Progress |
| Phase 8 | N/A | N/A | N/A |

**Overall VSCode Extension Completion: ~75%**

### Desktop Application (Electron)

| Phase | Name | Completion | Status |
|-------|------|------------|--------|
| Phase 1 | MVP (Core Foundation) | 95% | ✅ Complete |
| Phase 2 | Data Editing & UX | 95% | ✅ Complete |
| Phase 3 | Advanced Table Viewer | 85% | ✅ Mostly Complete |
| Phase 4 | Schema Insights & Tools | 75% | ✅ Mostly Complete |
| Phase 5 | Productivity Tools | 95% | ✅ Mostly Complete |
| Phase 6 | Security & Performance | 60% | ⏳ In Progress |
| Phase 7 | Multi-Database Support | 60% | ⏳ Backend Ready |
| Phase 8 | Desktop App Infrastructure | 85% | ✅ Mostly Complete |

**Overall Desktop App Completion: ~65-70%**

### Key Gaps: Desktop App
- ~~Advanced type editors (date picker modal, JSON editor modal)~~ ✅ Complete

---

# Phase 1 — MVP (Core Foundation) ✅

**VSCode Extension: 100% | Desktop App: 95%**

### Goal
Make the extension usable for basic database exploring.

### 1.1 Connection Management

**VSCode Extension:**
- [x] Add PostgreSQL connection
- [x] Save connection config in VS Code secret storage
- [x] Test connection button
- [x] Switch between saved connections
- [x] Edit/delete connections
- [x] Connection color coding
- [x] Multiple saved connections

**Desktop App:**
- [x] Add database connections (all types)
- [x] Save connection config (encrypted with Keytar)
- [x] Test connection button
- [x] Edit/delete connections
- [x] Connection color picker
- [x] Multiple connections in sidebar
- [ ] Connection switching (implicit via click)

**UI Components:**
```
┌─────────────────────────────────────────┐
│  Configure Connection                    │
├─────────────────────────────────────────┤
│  Connection Name: [________________]     │
│  Host:            [localhost_______]     │
│  Port:            [5432____________]     │
│  Username:        [________________]     │
│  Password:        [••••••••________]     │
│  Database:        [________________]     │
│  ☐ Use SSL                               │
├─────────────────────────────────────────┤
│  [Test Connection]  [Cancel]  [Save]     │
└─────────────────────────────────────────┘
```

### 1.2 Schema Explorer (Sidebar Tree)

**Features:**
- [x] Tree view: Connection → Schemas → Tables/Views/Functions
- [x] Refresh button
- [x] Right-click context menu
- [x] Database size indicator
- [x] Object counts per schema

**UI Components:**
```
DB VIEW
├─ 🔌 localhost:5432 (dbview_dev) [245 MB]
│  ├─ 📁 Schemas (3)
│  │  ├─ 📂 public
│  │  │  ├─ 📋 Tables (3)
│  │  │  │  ├─ 📄 users (5 rows)
│  │  │  │  ├─ 📄 orders
│  │  │  │  └─ 📄 order_items
│  │  │  ├─ 👁️ Views (1)
│  │  │  │  └─ user_order_summary
│  │  │  └─ ⚡ Functions (1)
│  │  ├─ 📂 inventory
│  │  └─ 📂 analytics
```

### 1.3 Table Viewer (Basic)

**Features:**
- [x] Open table in webview panel
- [x] Fetch first 100 rows
- [x] Basic data grid with headers
- [x] Row highlighting on hover
- [x] Refresh button

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📄 public.users                              [↻ Refresh]    │
├─────────────────────────────────────────────────────────────┤
│ id │ email              │ name          │ role    │ active  │
├────┼────────────────────┼───────────────┼─────────┼─────────┤
│ 1  │ alice@example.com  │ Alice Johnson │ admin   │ true    │
│ 2  │ bob@example.com    │ Bob Smith     │ user    │ true    │
│ 3  │ carol@example.com  │ Carol Williams│ user    │ true    │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 SQL Runner (Basic)

**Features:**
- [x] SQL editor with syntax highlighting
- [x] Run query button (Ctrl+Enter)
- [x] Results grid
- [x] Error display

---

# Phase 2 — Data Editing & UX ✅

**VSCode Extension: 95% | Desktop App: 95%**

### Goal
Add editable database features with rich UI feedback.

### 2.1 Inline Cell Editing

**VSCode Extension:**
- [x] Double-click cell to edit
- [x] Tab to move between cells
- [x] Enter to save, Escape to cancel
- [x] Visual indicator for modified cells (orange left border)
- [x] Success/error toast notifications
- [x] Type-specific cell editors (Boolean, DateTime, JSON, Enum, Array)
- [ ] Undo last change (Ctrl+Z) - Deferred to Phase 3

**Desktop App:**
- [x] Double-click cell to edit (inline editing in TableView)
- [x] Enter to save, Escape to cancel
- [x] Pending edits tracking with visual indicators (orange border)
- [x] Batch save functionality
- [x] Type validation (integers, floats, booleans, JSON)
- [x] NULL value handling
- [x] Toast notifications (Sonner wired)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📄 public.users                    [+ Add] [↻] [💾 Save]    │
├─────────────────────────────────────────────────────────────┤
│ ☐ │ id │ email              │ name          │ role         │
├───┼────┼────────────────────┼───────────────┼──────────────┤
│ ☐ │ 1  │ alice@example.com  │ Alice Johnson │ admin        │
│ ☐ │ 2  │ bob@example.com    │ [Bob Smith__] │ user         │  ← Editing
│ ☐ │ 3  │ carol@example.com  │ Carol Williams│ user         │
└─────────────────────────────────────────────────────────────┘
                                    ▲
                             Modified (unsaved)
```

**Toast Notifications:**
```
┌────────────────────────────────┐
│ ✅ Row updated successfully    │
└────────────────────────────────┘

┌────────────────────────────────┐
│ ❌ Error: Duplicate key value  │
└────────────────────────────────┘
```

### 2.2 Insert Row

**VSCode Extension:**
- [x] "Insert" button in toolbar
- [x] Modal form auto-generated from column types
- [x] Field validation based on constraints
- [x] Required field indicators
- [x] Default value hints and "Set NULL" toggle
- [x] Type-specific input fields

**Desktop App:**
- [x] Insert row UI (inline insertion in TableView, not modal)
- [x] Auto-generated input fields based on column types
- [x] Type-specific inputs (text, number, boolean dropdown, JSON textarea)
- [x] NULL checkbox for nullable columns
- [x] Required field indicators
- [x] Default value placeholders
- [x] UUID generator button for UUID columns
- [x] MongoDB ObjectId generator
- [x] Type validation before insert
- [x] Row duplication feature
- [x] IPC handler wired: `table:insertRow`

**UI Components:**
```
┌─────────────────────────────────────────┐
│  Insert New Row                      ✕  │
├─────────────────────────────────────────┤
│  id:        [Auto-generated________]    │
│  email: *   [_______________________]   │
│  name: *    [_______________________]   │
│  role:      [user_______________] ▼     │
│  is_active: [✓] Yes                     │
│  metadata:  [{ }__________________]     │
│             └─ Click to open JSON editor│
│  created_at:[Auto: NOW()___________]    │
├─────────────────────────────────────────┤
│  * Required fields                      │
│                    [Cancel]  [Insert]   │
└─────────────────────────────────────────┘
```

### 2.3 Delete Row

**VSCode Extension:**
- [x] Row selection checkboxes
- [x] Multi-row selection (click multiple checkboxes)
- [x] Delete button in toolbar
- [x] Confirmation dialog with row preview (shows primary keys)
- [x] Bulk delete support

**Desktop App:**
- [x] Delete row UI with delete button in toolbar
- [x] Row selection checkboxes
- [x] Select all checkbox
- [x] Multi-row selection
- [x] Confirmation dialog (native confirm)
- [x] Bulk delete support
- [x] IPC handler wired: `table:deleteRows`

**UI Components:**
```
┌─────────────────────────────────────────┐
│  ⚠️ Confirm Delete                   ✕  │
├─────────────────────────────────────────┤
│  Are you sure you want to delete        │
│  2 rows from "users"?                   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ id: 2, email: bob@example.com     │  │
│  │ id: 3, email: carol@example.com   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ⚠️ This action cannot be undone.       │
│                                         │
│            [Cancel]  [🗑️ Delete]        │
└─────────────────────────────────────────┘
```

### 2.4 Type-Based Editors

**Features:**
- [x] Boolean → Toggle switch (Radix UI Switch)
- [ ] Enum → Dropdown select - Deferred to Phase 3
- [x] Date/Time → Native HTML5 date/time pickers
- [x] Numeric → Number input with type parsing
- [x] JSON/JSONB → Multi-line textarea with validation
- [ ] Array → Tag input - Deferred to Phase 3
- [x] Text → Default text input
- [x] NULL → Explicit "Set NULL" toggle in insert modal

**Desktop App Advanced Type Editors:**
- [x] DateTimePopover - Inline popover anchored to cell with calendar picker, time inputs, NULL toggle, "Now" button, preview (follows UX best practices)
- [x] JSONEditor modal - CodeMirror-based with syntax highlighting, validation, format/minify/copy, expandable, centered dialog

**UI Components:**

**Boolean Toggle:**
```
is_active: [●───] Off    [───●] On
```

**Date Picker:**
```
created_at: [2024-01-15] [📅]
            ┌─────────────────┐
            │ ◀  January 2024 ▶│
            │ Su Mo Tu We Th Fr Sa│
            │     1  2  3  4  5  6│
            │  7  8  9 10 11 12 13│
            │ 14[15]16 17 18 19 20│
            └─────────────────┘
```

**JSON Editor Modal:**
```
┌─────────────────────────────────────────┐
│  Edit JSON: metadata                 ✕  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ {                                 │  │
│  │   "department": "Engineering",    │  │
│  │   "level": 5,                     │  │
│  │   "skills": ["react", "node"]     │  │
│  │ }                                 │  │
│  └───────────────────────────────────┘  │
│  ✅ Valid JSON                          │
│              [Format]  [Cancel]  [Save] │
└─────────────────────────────────────────┘
```

**Array/Tag Input:**
```
tags: [laptop] [computer] [work] [+ Add tag]
```

### 2.5 Enhanced Data Grid

**Features:**
- [ ] Column resizing (drag borders) - Deferred to Phase 3
- [ ] Column reordering (drag headers) - Deferred to Phase 3
- [x] Sort by clicking column header (TanStack Table built-in)
- [ ] Quick filter input per column - Moved to Phase 3.2
- [x] Column visibility toggle (Columns menu with show/hide)
- [ ] Freeze columns (pin left/right) - Deferred to Phase 3
- [ ] Copy cell/row/selection - Deferred to Phase 5

**UI Components:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📄 public.users                      [Columns ▼] [Filter] [+ Add]   │
├─────────────────────────────────────────────────────────────────────┤
│ ☐ │ id ↑│ email          🔍│ name         │ role    ▼│ active      │
│   │     │[____________]    │              │[All____]▼│             │
├───┼─────┼──────────────────┼──────────────┼──────────┼─────────────┤
│ ☐ │ 1   │ alice@example.com│ Alice Johnson│ admin    │ ●           │
│ ☐ │ 2   │ bob@example.com  │ Bob Smith    │ user     │ ●           │
│ ☑ │ 3   │ carol@example.com│ Carol Williams│ user    │ ●           │
├───┴─────┴──────────────────┴──────────────┴──────────┴─────────────┤
│ Showing 1-3 of 5 rows │ [◀ Prev] [Page 1 ▼] [Next ▶] │ [🗑️ Delete] │
└─────────────────────────────────────────────────────────────────────┘
```

---

# Phase 3 — Advanced Table Viewer ✅

**VSCode Extension: 85% | Desktop App: 85%**

### Goal
Make it feel like a professional database IDE.

### 3.1 Pagination

**VSCode Extension:**
- [x] Page size selector (25, 50, 100, 500)
- [x] Page navigation (first, prev, next, last)
- [x] Go to page input
- [x] Total row count display
- [x] Keyboard shortcuts (Ctrl+→, Ctrl+←)
- [x] Jump to row (Ctrl+G / Cmd+G)

**Desktop App:**
- [x] Full pagination (First/Previous/Next/Last buttons)
- [x] Page size selector (25, 50, 100, 250, 500)
- [x] Jump to page input
- [x] Row count display
- [x] Keyboard shortcuts (Ctrl+Home/End, Ctrl+Arrow keys)
- [x] Jump to row dialog (Ctrl+G / Cmd+G)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│ Showing 1-100 of 10,234 rows │ Per page: [100▼]            │
│ [|◀] [◀] Page [1__] of 103 [▶] [▶|]                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Advanced Filtering

**VSCode Extension:**
- [x] Filter builder sidebar (FilterBuilder.tsx)
- [x] Multiple conditions (AND/OR)
- [x] Operators: =, !=, <, >, <=, >=, LIKE, ILIKE, IN, BETWEEN, IS NULL
- [x] Save filter presets
- [x] Filter condition UI (FilterCondition.tsx)

**Desktop App:**
- [x] Filter builder UI (FilterBuilder.tsx component)
- [x] Filter chips display (FilterChips.tsx component)
- [x] Multiple filter conditions with AND/OR logic toggle
- [x] All operators: equals, not_equals, greater_than, less_than, contains, starts_with, ends_with, in, between, is_null, is_not_null
- [x] Add/remove filter conditions
- [x] Apply filters button
- [x] Clear all filters
- [x] IPC handler wired: `table:loadRows` with filters
- [ ] Save filter presets UI (handler exists: `views:*`)

**UI Components:**
```
┌─────────────────────────────────────────┐
│  Filters                            [+] │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ role      [equals ▼] [admin____] ✕│  │
│  └───────────────────────────────────┘  │
│                  AND                    │
│  ┌───────────────────────────────────┐  │
│  │ created_at [after ▼] [2024-01-01]✕│  │
│  └───────────────────────────────────┘  │
│                                         │
│  [+ Add condition]                      │
│                                         │
│  [Clear All]  [Save as Preset ▼] [Apply]│
└─────────────────────────────────────────┘
```

### 3.3 Saved Views

**VSCode Extension:**
- [x] Save current view (filters + sort + columns) - SaveViewDialog.tsx
- [x] Quick load saved views - SavedViewsPanel.tsx
- [x] Share views (export/import JSON)
- [x] Default view per table
- [x] Persistent storage (workspace state)

**Desktop App:**
- [ ] Save view UI (handler exists: `views:save`, no UI component)
- [ ] Load saved views UI (handler exists: `views:getAll`, no UI component)
- [ ] Share views (handlers exist: `views:export`, `views:import`)
- [ ] Default view (handler supports `isDefault` flag)
- [ ] Persistent storage (currently in-memory only, not saved to disk)

**UI Components:**
```
┌────────────────────────────┐
│  Saved Views           [+] │
├────────────────────────────┤
│  ★ Default                 │
│  📋 Active admins          │
│  📋 Recent orders          │
│  📋 High value customers   │
└────────────────────────────┘
```

### 3.4 Multi-Tab Support

**VSCode Extension:**
- [x] Multiple tables open in tabs
- [x] Tab context menu (close, close others, close all)
- [x] Single unified webview panel
- [x] Query tabs and table tabs
- [x] Tab switching with state preservation
- [x] ER diagram tabs
- [ ] Tab reordering (drag and drop) - Deferred to Phase 5
- [ ] Split view (horizontal/vertical) - Deferred to Phase 5

**Desktop App:**
- [x] Multiple tables/queries in tabs (TabBar.tsx)
- [x] Tab context menu (close, close others, close all)
- [x] Query tabs and table tabs
- [x] Tab switching with state
- [x] ER diagram viewer
- [ ] Tab reordering
- [ ] Split view

**UI Components:**
```
┌────────────────────────────────────────────────────────────────┐
│ [📄 users ✕] [📄 orders ✕] [📄 products ✕] [+ New Query]       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                    Table content here                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

# Phase 4 — Schema Insights & Tools ✅

**VSCode Extension: 90% | Desktop App: 75%**

### Goal
Add developer/admin-friendly tools for schema exploration.

### 4.1 Table Metadata Panel

**VSCode Extension:**
- [x] Slide-out panel with table details (TableMetadataPanel.tsx)
- [x] Column info (type, nullable, default, constraints)
- [x] Primary key indicator
- [x] Foreign key relationships
- [x] Indexes list
- [x] Table statistics (row count, size, last vacuum)
- [x] GET_TABLE_STATISTICS message handler

**Desktop App:**
- [x] Metadata panel UI (TableMetadataPanel.tsx slide-out panel)
- [x] Column info with types, nullable, defaults
- [x] Primary key indicators
- [x] Foreign key indicators
- [x] Indexes list
- [x] Table statistics (row count, size)
- [x] Info button in toolbar to open panel
- [x] IPC handlers wired: `table:getMetadata`, `table:getStatistics`, `table:getIndexes`

**UI Components:**
```
┌─────────────────────────────────────────┐
│  📄 users                            ✕  │
├─────────────────────────────────────────┤
│  📊 Statistics                          │
│  ├─ Rows: 10,234                        │
│  ├─ Size: 2.4 MB                        │
│  └─ Last analyzed: 2024-01-15           │
│                                         │
│  🔑 Primary Key                         │
│  └─ id (SERIAL)                         │
│                                         │
│  📋 Columns (8)                         │
│  ├─ id        INTEGER   NOT NULL  PK    │
│  ├─ email     VARCHAR   NOT NULL  UQ    │
│  ├─ name      VARCHAR   NOT NULL        │
│  ├─ role      VARCHAR   DEFAULT 'user'  │
│  ├─ is_active BOOLEAN   DEFAULT true    │
│  ├─ metadata  JSONB     NULLABLE        │
│  ├─ created_at TIMESTAMP DEFAULT NOW()  │
│  └─ updated_at TIMESTAMP DEFAULT NOW()  │
│                                         │
│  🔗 Foreign Keys                        │
│  └─ (none)                              │
│                                         │
│  📇 Indexes (2)                         │
│  ├─ users_pkey (PRIMARY)                │
│  └─ users_email_key (UNIQUE)            │
└─────────────────────────────────────────┘
```

### 4.2 ER Diagram

**VSCode Extension:**
- [x] Auto-generate from schema (ERDiagramPanel.tsx)
- [x] Interactive canvas (zoom, pan)
- [x] Click table to open
- [x] Show/hide relationships
- [x] Export as PNG/SVG
- [x] Filter by schema
- [x] Relationship visualization with foreign keys

**Desktop App:**
- [x] ER diagram UI (ERDiagramPanel.tsx)
- [x] Interactive canvas (zoom, pan, grid background)
- [x] Table visualization with columns and types
- [x] Relationship lines with hover tooltips
- [x] Backend handler ready (diagram:getER)
- [x] Export diagram as SVG
- [x] Schema filtering (right-click schema → ER Diagram)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│  ER Diagram: public              [Zoom: 100%▼] [📥 Export]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐          ┌──────────────┐               │
│   │    users     │          │    orders    │               │
│   ├──────────────┤          ├──────────────┤               │
│   │ 🔑 id        │──────────│ 🔑 id        │               │
│   │    email     │     ┌────│ 🔗 user_id   │               │
│   │    name      │     │    │    status    │               │
│   │    role      │     │    │    total     │               │
│   └──────────────┘     │    └──────────────┘               │
│                        │           │                        │
│                        │           │                        │
│                        │    ┌──────────────┐               │
│                        │    │ order_items  │               │
│                        │    ├──────────────┤               │
│                        │    │ 🔑 id        │               │
│                        └────│ 🔗 order_id  │               │
│                             │ 🔗 product_id│               │
│                             └──────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Query History

**VSCode Extension:**
- [x] Auto-save executed queries (workspace state)
- [x] Search history (QueryHistoryPanel.tsx)
- [x] Copy/re-run query
- [x] Star favorite queries
- [x] Clear history
- [x] Execution time and row count display

**Desktop App:**
- [x] Auto-save executed queries (QueryHistoryPanel.tsx)
- [x] Persistent history storage (queryHistory:* IPC handlers)
- [x] Copy/re-run query from history
- [x] Clear history
- [x] Success/failure status with error messages
- [x] Execution time and row count display
- [x] Resizable history panel
- [x] Star favorite queries (star button, filter starred only, starred sort to top)

**UI Components:**
```
┌─────────────────────────────────────────┐
│  Query History                   🔍 [x] │
├─────────────────────────────────────────┤
│  ★ SELECT * FROM users WHERE role='admin'│
│    └─ 2024-01-15 10:30 (5 rows, 12ms)   │
│                                         │
│  ○ SELECT COUNT(*) FROM orders          │
│    └─ 2024-01-15 10:28 (1 row, 8ms)     │
│                                         │
│  ○ UPDATE users SET is_active=false...  │
│    └─ 2024-01-15 10:25 (3 rows affected)│
│                                         │
│  [Load More...]                         │
└─────────────────────────────────────────┘
```

---

# Phase 5 — Productivity Tools ✅

**VSCode Extension: 95% | Desktop App: 95%**

### Goal
Developer-first enhancements for faster workflows.

### 5.1 SQL Editor Enhancements ✅ Complete

**VSCode Extension Implementation:** CodeMirror 6 (replaced Monaco Editor due to clipboard issues)
**Desktop App Implementation:** CodeMirror 6 with custom theme

**VSCode Extension:**
- [x] Syntax highlighting (SQL keywords, strings, numbers)
- [x] Auto-complete for tables, columns, keywords with fuzzy matching
- [x] Multi-cursor editing (CodeMirror built-in)
- [x] Format SQL (prettify) with sql-formatter
- [x] Error highlighting (visual border on error)
- [x] CodeMirror 6 integration with VSCode dark theme
- [x] Keyboard shortcuts (Cmd/Ctrl+Enter to run, Cmd/Ctrl+Shift+F to format)
- [x] Schema-aware autocomplete (schemas, tables, columns, functions)
- [x] Query EXPLAIN ANALYZE with performance insights - ✅ Complete
- [x] Native clipboard support (paste works in VSCode webviews)
- [x] 76% smaller bundle size (1.1MB vs 4.5MB Monaco)

**Desktop App:**
- [x] Syntax highlighting (SqlEditor.tsx)
- [x] Auto-complete for tables, columns, keywords
- [x] Multi-cursor editing
- [x] Format SQL (query:format handler)
- [x] Error highlighting
- [x] Custom dark theme for desktop
- [x] Keyboard shortcuts (Cmd+Enter to run)
- [x] Schema-aware autocomplete (loads from getAutocompleteData)
- [x] Query EXPLAIN UI (ExplainPlanPanel.tsx with tree visualization)
- [x] SQL snippet support (sqlSnippets.ts)

**Documentation:**
- [Migration Details](PASTE_FIX.md)
- [Testing Guide](PHASE5_1_TESTING.md)
- [Design Document](PHASE5_DESIGN.md)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│  SQL Query            [📐 Format] [⚡ Explain] [🕒] [Copy] [×]│
├─────────────────────────────────────────────────────────────┤
│  1 │ SELECT u.name,                                         │
│  2 │   COUNT(o.id) as order_count                           │
│  3 │ FROM users u                                           │
│  4 │ LEFT JOIN ord█                                         │
│  5 │            ┌─────────────────────────┐                 │
│  6 │            │ 📄 orders (10k rows)    │                 │
│  7 │            │ 📄 order_items (50k)    │                 │
│  8 │            └─────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

**EXPLAIN Panel:**
```
┌───────────────────────┬─────────────────────────────┐
│ SQL Query            │ Query Plan              [×] │
│ ┌──────────────────┐ │ ┌─────────────────────────┐ │
│ │ SELECT * FROM    │ │ │ ⏱️  45.2 ms              │ │
│ │ users WHERE...   │ │ │ 💰 Cost: 125.45         │ │
│ │                  │ │ │                         │ │
│ └──────────────────┘ │ │ ▼ Limit (2.1 ms)        │ │
│ [▶ Run] [⚡ Explain] │ │   ▼ Sort (15.3 ms)      │ │
│                      │ │     ▼ Seq Scan (27.8ms) │ │
│                      │ │       ⚠️  Warning...     │ │
└───────────────────────┴─────────────────────────────┘
```

### 5.2 Code Snippets ✅ Complete

**Implementation:** CodeMirror 6 native `snippetCompletion` with interactive tab-through

**Features:**
- [x] Built-in SQL snippets (8 templates) with Tab navigation
- [x] Interactive placeholder jumping (Tab/Shift-Tab/Escape)
- [x] Linked fields (edit one updates all matching placeholders)
- [x] Trigger-based autocomplete (type "sel" → shows SELECT snippet)
- [x] Visual distinction in autocomplete dropdown
- [ ] Custom snippet creation - Deferred to Phase 5.2.1

**Built-in Snippets:**

| Trigger | Template | Description |
|---------|----------|-------------|
| `sel` | SELECT | Basic SELECT with WHERE and LIMIT |
| `join` | SELECT JOIN | INNER JOIN with aliases |
| `lef` | LEFT JOIN | LEFT OUTER JOIN pattern |
| `ins` | INSERT | INSERT with RETURNING |
| `upd` | UPDATE | UPDATE with SET and WHERE |
| `del` | DELETE | DELETE with RETURNING |
| `cre` | CREATE TABLE | Table definition template |
| `cou` | COUNT GROUP | Aggregation with GROUP BY |

**Example Usage:**
```sql
-- Type "sel" → Select "SELECT" from autocomplete
-- Press Enter → Snippet expands:

SELECT columns
FROM table
WHERE condition
LIMIT limit;

-- Tab through: columns → table → condition → limit
-- First placeholder auto-selected, Tab to jump between fields
```

**Keyboard Shortcuts:**
- **Tab** - Jump to next placeholder
- **Shift+Tab** - Jump to previous placeholder
- **Escape** - Exit snippet mode

**Technical Details:**
- Zero bundle size increase (uses existing `@codemirror/autocomplete` API)
- Snippets integrate seamlessly with existing autocomplete
- Higher boost values ensure snippets appear at top when relevant
- Implementation: [sqlSnippets.ts](packages/ui/src/utils/sqlSnippets.ts)

### 5.3 Data Export/Import

**VSCode Extension: ✅ Complete | Desktop App: ✅ Complete**

**VSCode Implementation:** Native VSCode File System APIs with custom formatters/parsers
**Desktop App:** IPC handlers with ExportDataDialog and ImportDataDialog components

**VSCode Extension:**
- [x] Export to CSV with optional headers (ExportDataDialog.tsx)
- [x] Export to JSON (formatted, human-readable)
- [x] Export to SQL (INSERT statements with proper escaping)
- [x] Import from CSV (with/without headers) (ImportDataDialog.tsx)
- [x] Import from JSON (array of objects)
- [x] Copy selected rows as INSERT statements to clipboard
- [x] Export options: selected rows only, include headers (CSV)
- [x] Column validation on import
- [x] Partial import handling (continues on row errors)
- [x] VSCode save dialog integration
- [x] Toast notifications for success/error feedback
- [ ] Backup table (pg_dump) - Deferred to Phase 5.3.1

**Desktop App:**
- [x] Export UI (ExportDataDialog.tsx with format selection)
- [x] Import UI (ImportDataDialog.tsx with drag & drop)
- [x] Export formats (CSV, JSON, SQL)
- [x] Import formats (CSV, JSON)
- [x] Export options dialog (include headers, selected rows, apply filters)
- [x] Import validation with error reporting
- [x] Native file dialogs (Electron dialog.showSaveDialog)
- [x] Export/Import buttons in TableView toolbar

**Export Formats:**

| Format | Extension | Features |
|--------|-----------|----------|
| CSV | `.csv` | Headers optional, proper quoting/escaping |
| JSON | `.json` | Pretty-printed array of objects |
| SQL | `.sql` | PostgreSQL INSERT statements |

**UI Components:**

**Export Dialog:**
```
┌─────────────────────────────────────────┐
│  📥 Export Data                      ✕  │
├─────────────────────────────────────────┤
│  Format:                                │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ CSV  │ │ JSON │ │ SQL  │            │
│  └──────┘ └──────┘ └──────┘            │
│                                         │
│  Options:                               │
│  ☑ Include headers (CSV only)           │
│  ☐ Selected rows only (3 selected)      │
│  ☐ Apply current filters                │
│                                         │
│            [Cancel]  [📥 Export]        │
└─────────────────────────────────────────┘
```

**Import Dialog:**
```
┌─────────────────────────────────────────┐
│  📤 Import Data                      ✕  │
├─────────────────────────────────────────┤
│  File Format:                           │
│  ┌──────────┐ ┌──────────┐             │
│  │   CSV    │ │   JSON   │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  ☑ First row contains headers           │
│                                         │
│  Select File:                           │
│  [Choose File...] data.csv              │
│                                         │
│  ⚠️ Important:                          │
│  • Column names must match table        │
│  • Data types must be compatible        │
│                                         │
│            [Cancel]  [📤 Import]        │
└─────────────────────────────────────────┘
```

**Toolbar Integration:**
```
[Export] [Import] [Copy SQL] (when rows selected)
```

**Technical Details:**
- Export formatters: [exportFormatters.ts](packages/ui/src/utils/exportFormatters.ts)
- Import parsers: [importParsers.ts](packages/ui/src/utils/importParsers.ts)
- Export dialog: [ExportDataDialog.tsx](packages/ui/src/components/ExportDataDialog.tsx)
- Import dialog: [ImportDataDialog.tsx](packages/ui/src/components/ImportDataDialog.tsx)
- Backend handlers: [mainPanel.ts](apps/vscode-extension/src/mainPanel.ts) (EXPORT_DATA, IMPORT_DATA, COPY_TO_CLIPBOARD)

---

# Phase 6 — Security & Performance ✅

**VSCode Extension: 100% | Desktop App: 80%**

### Goal
Make dbview reliable and safe for production databases.

### 6.1 Read-Only Mode

**VSCode Extension: ✅ Complete | Desktop App: ✅ Complete**

**VSCode Implementation:** Connection config flag with visual indicators and write operation blocking

**VSCode Extension:**
- [x] Per-connection read-only toggle (checkbox in connection form)
- [x] Visual indicator (🔒 prefix on connection name in sidebar)
- [x] Block all write operations (UPDATE, INSERT, DELETE, IMPORT)
- [x] Warn on connection to production (detects 'prod', 'production', 'live' keywords)
- [x] Read-only state persists with connection config

**Desktop App:**
- [x] Read-only toggle (checkbox in AddConnectionDialog with Lock icon)
- [x] Visual indicator (Lock icon in sidebar + "Read-only" badge in TableView toolbar)
- [x] Block write operations (Insert, Duplicate, Delete, Import buttons disabled; cell editing blocked)
- [x] Production warning (detects 'prod', 'production', 'live', 'prd' keywords)
- [x] Read-only state in config (persisted with connection)

**Documentation:**
- [connectionConfigPanel.ts](apps/vscode-extension/src/connectionConfigPanel.ts) - Read-only toggle and production warning
- [schemaExplorer.ts](apps/vscode-extension/src/schemaExplorer.ts) - Visual 🔒 indicator
- [mainPanel.ts](apps/vscode-extension/src/mainPanel.ts) - Write operation blocking

**UI Components:**

**Connection Form:**
```
┌─────────────────────────────────────────┐
│  Configure Connection                    │
├─────────────────────────────────────────┤
│  Connection Name: [production-db_____]   │
│  Host:            [db.prod.example.com]  │
│  ...                                     │
│                                          │
│  ☑ 🔒 Read-Only Mode                     │
│    Block all write operations            │
│                                          │
│  ⚠️ Warning: This appears to be a        │
│  production database. Consider enabling  │
│  read-only mode for safety.              │
├─────────────────────────────────────────┤
│  [Test Connection]  [Cancel]  [Save]     │
└─────────────────────────────────────────┘
```

**Sidebar Tree:**
```
DB VIEW
├─ 🔒 production-db (Read-Only Mode)
│  └─ 📂 public
├─ 🔌 localhost:5432 (dbview_dev)
│  └─ 📂 public
```

**Blocked Operation Error:**
```
┌────────────────────────────────────────┐
│ 🔒 Connection is in read-only mode.    │
│    Write operations are blocked.        │
└────────────────────────────────────────┘
```

### 6.2 Virtual Scrolling ✅ Complete

**VSCode Extension Implementation:** TanStack Virtual with TanStack Table integration
**Desktop App Implementation:** TanStack Virtual (useVirtualizer in QueryResultsGrid)

**VSCode Extension:**
- [x] Render only visible rows (TanStack Virtual with 5-row overscan)
- [x] Smooth scrolling for large datasets at 60 FPS
- [x] Scroll progress bar (thin blue bar at top showing position)
- [x] Scroll status bar (rows X-Y of Z, page info)
- [x] Floating scroll-to-top/bottom buttons
- [x] Jump-to-row dialog (Ctrl+G / Cmd+G)
- [x] Keyboard navigation (Home/End to scroll)
- [x] Spinner loading state
- [x] Performance optimizations (React.memo, CSS containment)

**Desktop App:**
- [x] Render only visible rows (QueryResultsGrid.tsx with useVirtualizer)
- [x] Smooth scrolling
- [x] Scroll progress bar (ScrollProgressBar.tsx)
- [x] Scroll status bar (visible row range indicator)
- [x] Floating scroll buttons (ScrollButtons.tsx)
- [x] Jump-to-row dialog (JumpToRowDialog.tsx, Ctrl+G / Cmd+G)
- [x] Keyboard navigation (Home/End to scroll)
- [x] Loading spinner
- [x] Performance optimizations

**Documentation:**
- [VirtualDataGrid.tsx](packages/ui/src/components/VirtualDataGrid.tsx)
- [ScrollProgressBar.tsx](packages/ui/src/components/ScrollProgressBar.tsx) - VSCode
- [ScrollButtons.tsx](packages/ui/src/components/ScrollButtons.tsx) - VSCode
- [JumpToRowDialog.tsx](packages/ui/src/components/JumpToRowDialog.tsx) - VSCode
- [TableView/ScrollProgressBar.tsx](packages/desktop-ui/src/components/TableView/ScrollProgressBar.tsx) - Desktop
- [TableView/ScrollButtons.tsx](packages/desktop-ui/src/components/TableView/ScrollButtons.tsx) - Desktop
- [TableView/JumpToRowDialog.tsx](packages/desktop-ui/src/components/TableView/JumpToRowDialog.tsx) - Desktop

### 6.3 Connection Health ✅ Complete

**VSCode Extension Implementation:** PostgresClient with EventEmitter for status tracking, auto-reconnect, and health checks
**Desktop App Implementation:** DatabaseAdapter with EventEmitter, ConnectionManager tracks status per adapter

**VSCode Extension:**
- [x] Connection status indicator (🟢 connected, 🟡 connecting, 🔴 error, ⚪ disconnected)
- [x] Visual status in sidebar with icon colors and description
- [x] Auto-reconnect on disconnect (up to 3 attempts with 2s delay)
- [x] Connection timeout handling (10s connection, 30s idle, 60s query timeout)
- [x] Periodic health check ping (every 30 seconds)
- [x] Connection lost notification with Reconnect/Dismiss options
- [x] Connection restored notification

**Desktop App:**
- [x] Connection status tracking (ConnectionManager with clientStatuses Map)
- [x] Visual status in sidebar (colored dots: green/yellow/red/gray)
- [x] Status event listeners (statusChange events)
- [ ] Auto-reconnect (not implemented)
- [x] Connection timeout (adapter-level)
- [x] Health check ping (adapter.ping() and startHealthCheck())
- [ ] Connection lost notification
- [ ] Connection restored notification

**Documentation:**
- [postgresClient.ts](apps/vscode-extension/src/postgresClient.ts) - Connection status, health check, auto-reconnect
- [schemaExplorer.ts](apps/vscode-extension/src/schemaExplorer.ts) - Status listener and visual indicators
- [extension.ts](apps/vscode-extension/src/extension.ts) - Reconnect command and initial health check

**UI Components:**

**Sidebar Connection Status:**
```
DB VIEW
├─ 🟢 production-db (64 MB)        ← Connected (green icon)
├─ 🟡 staging-db (Connecting...)   ← Connecting (yellow icon, spinning)
├─ 🔴 dev-db (Connection Error)    ← Error (red warning icon)
├─ ⚪ backup-db (Disconnected)     ← Disconnected (gray icon)
```

**Tooltip Status:**
```
┌────────────────────────────────────┐
│ **mydb**                           │
│                                    │
│ 🟢 **Status:** connected           │
│ 🖥️ Host: localhost:5432           │
│ 📀 Database: mydb                  │
│ 👤 User: postgres                  │
│ 💾 Size: 64 MB                     │
└────────────────────────────────────┘
```

**Connection Error Notification:**
```
┌────────────────────────────────────────┐
│ dbview: Connection issue - ECONNRESET  │
│    [Reconnect] [Dismiss]               │
└────────────────────────────────────────┘
```

**Technical Details:**
- Pool settings: 10 max connections, 10s connection timeout, 30s idle timeout
- Auto-reconnect: 3 max attempts, 2s delay between attempts
- Health check: Runs `SELECT 1` every 30 seconds
- Connection errors detected: ECONNREFUSED, ECONNRESET, ETIMEDOUT, server termination

### 6.4 Theme Support ✅ Complete

**VSCode Extension Implementation:** VS Code ColorThemeKind detection with CSS custom properties
**Desktop App Implementation:** ThemeProvider with dark/light/high-contrast modes, system theme detection

**VSCode Extension:**
- [x] Auto-detect VS Code theme (Light, Dark, High Contrast, High Contrast Light)
- [x] Light mode support with appropriate color palette
- [x] Dark mode support (default)
- [x] High contrast mode for accessibility
- [x] High contrast light mode support
- [x] Real-time theme switching (listens for VS Code theme changes)
- [x] Theme-aware Toaster notifications

**Desktop App:**
- [x] ThemeProvider context (ThemeContext.tsx)
- [x] Dark mode (default)
- [x] Light mode
- [x] High contrast mode
- [x] System theme detection
- [x] Real-time theme switching
- [x] Theme-aware Toaster (Sonner with theme prop)
- [x] Custom color tokens (design-system/tokens/colors.ts)

**Documentation:**
- [webviewHost.ts](apps/vscode-extension/src/webviewHost.ts) - Theme detection and HTML injection
- [index.css](packages/ui/src/styles/index.css) - CSS variables for all themes
- [extension.ts](apps/vscode-extension/src/extension.ts) - Theme change listener
- [mainPanel.ts](apps/vscode-extension/src/mainPanel.ts) - Theme update messaging
- [App.tsx](packages/ui/src/App.tsx) - Theme message handler

**Technical Details:**
- Theme is passed to webview via `data-theme` attribute on `<html>` element
- CSS custom properties (`--color-*`) change based on `[data-theme]` selector
- Body gets `vscode-light`, `vscode-dark`, or `vscode-high-contrast` class
- Theme changes trigger `THEME_CHANGE` message to webview
- Toaster component dynamically switches between light/dark themes

**Theme Color Variables:**

| Variable | Dark | Light | High Contrast |
|----------|------|-------|---------------|
| `--color-bg` | #1e1e1e | #ffffff | #000000 |
| `--color-text` | #cccccc | #333333 | #ffffff |
| `--color-accent` | #007acc | #0066b8 | #6fc3df |
| `--color-border` | #3c3c3c | #cecece | #6fc3df |

---

# Phase 7 — Multi-Database Support ⏳

**VSCode Extension: 60% | Desktop App: 60%**

### Goal
Expand dbview beyond PostgreSQL.

**Status:** Database adapters implemented in shared `packages/adapters/` package. Both VSCode extension and Desktop app use DatabaseAdapterFactory. Full CRUD operations exist for all database types, but some advanced features may be incomplete.

### 7.1 Database Adapter System

**Architecture:**
```typescript
interface DatabaseAdapter {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  listSchemas(): Promise<Schema[]>;
  listTables(schema: string): Promise<Table[]>;
  fetchRows(table: string, options: QueryOptions): Promise<Row[]>;
  executeQuery(sql: string): Promise<QueryResult>;
  // ... CRUD operations
}
```

### 7.2 Supported Databases

| Database | Adapter | VSCode Extension | Desktop App | Features |
|----------|---------|------------------|-------------|----------|
| PostgreSQL | ✅ Complete | ✅ Full Support | ✅ Full Support | Full CRUD, schemas, views, functions, procedures, types |
| MySQL | ✅ Complete | ⏳ Partial | ⏳ Partial | Full CRUD, schemas, views, functions (adapters/MySQLAdapter.ts) |
| MariaDB | ✅ Complete | ⏳ Partial | ⏳ Partial | Full CRUD, MySQL-compatible (adapters/MariaDBAdapter.ts) |
| SQL Server | ✅ Complete | ⏳ Partial | ⏳ Partial | Full CRUD, schemas, views, procedures (adapters/SQLServerAdapter.ts) |
| SQLite | ✅ Complete | ⏳ Partial | ⏳ Partial | Full CRUD, local file, tables, views (adapters/SQLiteAdapter.ts) |
| MongoDB | ✅ Complete | ⏳ Partial | ⏳ Partial | Collections, documents, aggregation (adapters/MongoDBAdapter.ts) |
| Redis | ⏳ Partial | ❌ Not Integrated | ❌ Not Integrated | Key browser, TTL viewer (adapters/RedisAdapter.ts - incomplete) |
| Elasticsearch | ✅ Complete | ⏳ Partial | ⏳ Partial | Indices, documents, Query DSL, mappings (adapters/ElasticsearchAdapter.ts) |

**Implementation Status:**
- All adapters located in `packages/adapters/src/adapters/`
- DatabaseAdapterFactory supports all 7 database types
- Shared adapter package used by both VSCode extension and Desktop app
- Integration tests exist for PostgreSQL and MySQL
- Advanced features (EXPLAIN, functions, procedures) may vary by database

---

# Phase 8 — Electron Desktop App ⏳

**Overall Completion: ~55-60%**

### Goal
Turn dbview into a standalone desktop database client.

### 8.1 Desktop Infrastructure ✅ 85% Complete

**Features:**
- [x] Standalone Electron app (apps/desktop/)
- [x] React UI package (packages/desktop-ui/)
- [x] IPC communication layer (apps/desktop/src/main/ipc/index.ts)
- [x] Native menus (apps/desktop/src/main/menu.ts)
- [x] Keyboard shortcuts (Cmd+N, Cmd+R, etc.)
- [ ] System tray integration
- [ ] Auto-updates
- [x] Native file dialogs (Electron API available)
- [x] Window management
- [x] Dev tools integration

### 8.2 Core Features Implementation

**Completed (90%):**
- [x] Connection management (AddConnectionView, AddConnectionDialog)
- [x] Schema explorer sidebar (Sidebar component with connection tree)
- [x] SQL query runner (QueryView with SqlEditor)
- [x] Query history (QueryHistoryPanel with persistence)
- [x] Table viewer (TableView with full CRUD)
- [x] Multi-tab support (TabBar with table/query/ER tabs)
- [x] Theme system (ThemeProvider with dark/light/high-contrast)
- [x] Design system (packages/desktop-ui/src/design-system/)
- [x] Password encryption (PasswordStore with Keytar)
- [x] Settings persistence (SettingsStore)
- [x] Inline cell editing with batch save (TableView.tsx)
- [x] Row insertion (inline in TableView, not modal)
- [x] Row deletion with selection checkboxes (TableView.tsx)
- [x] Advanced filtering (FilterBuilder.tsx, FilterChips.tsx)
- [x] Table metadata panel (TableMetadataPanel.tsx)
- [x] Export/Import dialogs (ExportDataDialog.tsx, ImportDataDialog.tsx)

**Missing UI Components (5%):**
- [ ] Page size selector in TableView
- [ ] Jump to row/page input

### 8.3 Local Workspace ✅ 85% Complete

**Features:**
- [x] Save connections locally (ConnectionManager in main process)
- [x] Encrypted password storage (Keytar integration via PasswordStore)
- [x] Connection persistence (SettingsStore with JSON file)
- [x] Query history persistence (query:history:* IPC handlers)
- [x] Settings persistence (workspace settings)
- [x] Recent connections (connection list in sidebar)
- [ ] Offline schema cache
- [ ] Layout preferences (not persisted)

### 8.4 Distribution ❌ Not Started

**Platforms:**
- [ ] macOS (.dmg, Apple Silicon + Intel)
- [ ] Windows (.exe, installer + portable)
- [ ] Linux (.AppImage, .deb)
- [ ] Code signing
- [ ] Auto-updater integration
- [ ] Build scripts (electron-builder config needed)

### 8.5 Desktop-Specific Features

**Unique to Desktop App:**
- [x] Multi-window support (can open multiple app windows)
- [x] Native notifications (Electron API)
- [x] OS-level password management (Keytar)
- [x] File system access (no restrictions)
- [x] Custom application menu
- [ ] System tray icon
- [ ] Global keyboard shortcuts
- [ ] Offline mode

### 8.6 Technical Stack

**Frontend (packages/desktop-ui/):**
- React 18 with TypeScript
- Vite for bundling
- TanStack Table for data grids
- TanStack Virtual for scrolling
- CodeMirror 6 for SQL editor
- Radix UI for primitives
- Tailwind CSS for styling
- Sonner for notifications

**Backend (apps/desktop/):**
- Electron main process
- IPC handlers for all operations
- Database adapters (shared package)
- Connection pooling
- Settings management
- Password encryption

**Build:**
- [ ] electron-builder configuration
- [ ] CI/CD pipeline
- [ ] Release automation

---

# UI/UX Design Principles

### Color Scheme (Dark Mode)

```css
--bg-primary: #0f172a;      /* Slate 900 */
--bg-secondary: #1e293b;    /* Slate 800 */
--bg-tertiary: #334155;     /* Slate 700 */
--text-primary: #f8fafc;    /* Slate 50 */
--text-secondary: #94a3b8;  /* Slate 400 */
--accent: #3b82f6;          /* Blue 500 */
--success: #22c55e;         /* Green 500 */
--warning: #f59e0b;         /* Amber 500 */
--error: #ef4444;           /* Red 500 */
```

### Typography

```css
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-sans: 'Inter', -apple-system, sans-serif;
--font-size-sm: 12px;
--font-size-base: 13px;
--font-size-lg: 14px;
```

### Spacing

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
```

### Component Library

| Component | Library | Notes |
|-----------|---------|-------|
| Data Grid | TanStack Table | Virtual scrolling, sorting, filtering |
| Icons | Lucide React | Consistent icon set |
| Toasts | Sonner | Beautiful notifications |
| Modals | Radix UI Dialog | Accessible modals |
| Forms | React Hook Form | Form validation |
| Date Picker | React Day Picker | Calendar component |

---

# Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Run Query | `Ctrl+Enter` / `Cmd+Enter` |
| Run All | `Ctrl+Shift+Enter` |
| New Query Tab | `Ctrl+N` |
| Save | `Ctrl+S` |
| Refresh | `Ctrl+R` / `F5` |
| Find in Table | `Ctrl+F` |
| Next Page | `Ctrl+→` |
| Previous Page | `Ctrl+←` |
| Delete Row | `Delete` / `Backspace` |
| Copy Cell | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Undo | `Ctrl+Z` |
| Format SQL | `Ctrl+Shift+F` |

---

# Future Database Adapters (Implementation Roadmap)

The following databases are prioritized for future adapter implementation, based on DB-Engines 2025 rankings, Stack Overflow survey data, and market demand.

### Currently Supported
- PostgreSQL ✅
- MySQL ✅
- MariaDB ✅
- SQL Server ✅
- SQLite ✅
- MongoDB ✅
- Redis ⏳ (partial)
- Elasticsearch ✅ (NEW)

### High Priority (Popular & Widely Used)

| # | Database | Type | Use Case | Effort |
|---|----------|------|----------|--------|
| 1 | ~~**MariaDB**~~ | SQL | ✅ **IMPLEMENTED** | Done |
| 2 | **Oracle** | SQL | #1 in DB-Engines ranking, enterprise standard | High |
| 3 | **Elasticsearch** | Search/Document | Full-text search, log analytics, ~8% market share | Medium |
| 4 | **Cassandra** | Wide-Column NoSQL | Massive scale, high availability (Netflix, Apple use it) | High |
| 5 | **Neo4j** | Graph | Relationship-focused data, fraud detection, recommendations | Medium |
| 6 | **DynamoDB** | Key-Value NoSQL | AWS native, serverless, highly scalable | Medium |

### Medium Priority (Growing & Specialized)

| # | Database | Type | Use Case | Effort |
|---|----------|------|----------|--------|
| 7 | **InfluxDB** | Time-Series | IoT, monitoring, metrics (75% growth in IoT apps) | Medium |
| 8 | **CouchDB** | Document NoSQL | Offline-first apps, multi-master replication | Medium |
| 9 | **Snowflake** | Cloud Data Warehouse | Analytics, top climber in 2025 rankings | High |
| 10 | **ClickHouse** | Column-Oriented | Fast analytics, BI, telemetry (jumped from #37 to #31) | Medium |
| 11 | **Firebase/Firestore** | Document NoSQL | Real-time apps, mobile development | Medium |
| 12 | **CockroachDB** | Distributed SQL | Globally distributed, PostgreSQL compatible | Low (PostgreSQL-compatible) |

### Emerging & Specialized

| # | Database | Type | Use Case | Effort |
|---|----------|------|----------|--------|
| 13 | **DuckDB** | Embedded Analytics | In-process OLAP, rising popularity | Low |
| 14 | **TimescaleDB** | Time-Series (PostgreSQL) | Time-series on PostgreSQL, easy adoption | Low (PostgreSQL extension) |
| 15 | **OpenSearch** | Search | Elasticsearch fork, open-source (jumped #40 to #32) | Medium |
| 16 | **Supabase** | PostgreSQL-based | Firebase alternative, real-time subscriptions | Low (PostgreSQL-based) |
| 17 | **PlanetScale** | MySQL-based | Serverless MySQL, branching workflows | Low (MySQL-compatible) |
| 18 | **Milvus/Pinecone** | Vector DB | AI/ML embeddings, semantic search | High |
| 19 | **ScyllaDB** | Wide-Column | Cassandra-compatible, better performance | Medium |
| 20 | **ArangoDB** | Multi-Model | Graph + Document + Key-Value in one | High |

### Recommended Implementation Order

1. ~~**MariaDB**~~ - ✅ **IMPLEMENTED**
2. **Elasticsearch** - High demand for search functionality
3. **Neo4j** - Graph databases are trending
4. **InfluxDB** - Time-series is growing fast
5. **DynamoDB** - AWS ecosystem is huge
6. **Cassandra** - Enterprise distributed workloads

### References
- [DB-Engines Ranking 2025](https://db-engines.com/en/ranking)
- [Stack Overflow Developer Survey 2024](https://survey.stackoverflow.co/2024/)
- [The Most Popular Databases in 2025 - BairesDev](https://www.bairesdev.com/blog/most-popular-databases/)

---

# Future Ideas

- AI-assisted SQL generation (Copilot integration)
- Team collaboration (shared queries, schemas)
- Schema migration diff viewer
- Database monitoring dashboard
- Query performance analyzer
- Data masking for sensitive columns
- Audit logging
- Webhooks on data changes
