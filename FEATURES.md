# dbview — Feature Roadmap & UI/UX Specification

A modern, powerful database viewer/editor for VS Code with rich UI/UX.

**Reference:** [Database Client](https://database-client.com/), [DBCode](https://dbcode.io/), [TablePlus](https://tableplus.com/)

---

## Project Status

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | MVP (Core Foundation) | ✅ Complete |
| Phase 2 | Data Editing & UX | ✅ Complete |
| Phase 3 | Advanced Table Viewer | ✅ Complete |
| Phase 4 | Schema Insights & Tools | ✅ Complete |
| Phase 5 | Productivity Tools | 🔄 Phase 5.3 Complete |
| Phase 6 | Security & Performance | ⏳ Planned |
| Phase 7 | Multi-Database Support | ⏳ Planned |
| Phase 8 | Electron Desktop App | ⏳ Planned |

---

# Phase 1 — MVP (Core Foundation) ✅

### Goal
Make the extension usable for basic database exploring.

### 1.1 Connection Management

**Features:**
- [x] Add PostgreSQL connection
- [x] Save connection config in VS Code secret storage
- [x] Test connection button
- [x] Switch between saved connections
- [x] Edit/delete connections

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

### Goal
Add editable database features with rich UI feedback.

### 2.1 Inline Cell Editing

**Features:**
- [x] Double-click cell to edit
- [x] Tab to move between cells
- [x] Enter to save, Escape to cancel
- [x] Visual indicator for modified cells (orange left border)
- [x] Success/error toast notifications
- [ ] Undo last change (Ctrl+Z) - Deferred to Phase 3

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

**Features:**
- [x] "Insert" button in toolbar
- [x] Modal form auto-generated from column types
- [x] Field validation based on constraints
- [x] Required field indicators
- [x] Default value hints and "Set NULL" toggle

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

**Features:**
- [x] Row selection checkboxes
- [x] Multi-row selection (click multiple checkboxes)
- [x] Delete button in toolbar
- [x] Confirmation dialog with row preview (shows primary keys)
- [x] Bulk delete support

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

# Phase 3 — Advanced Table Viewer

### Goal
Make it feel like a professional database IDE.

### 3.1 Pagination

**Features:**
- [x] Page size selector (25, 50, 100, 500)
- [x] Page navigation (first, prev, next, last)
- [x] Go to page input
- [x] Total row count display
- [x] Keyboard shortcuts (Ctrl+→, Ctrl+←)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│ Showing 1-100 of 10,234 rows │ Per page: [100▼]            │
│ [|◀] [◀] Page [1__] of 103 [▶] [▶|]                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Advanced Filtering

**Features:**
- [x] Filter builder sidebar
- [x] Multiple conditions (AND/OR)
- [x] Operators: =, !=, <, >, <=, >=, LIKE, ILIKE, IN, BETWEEN, IS NULL
- [ ] Save filter presets
- [x] Quick search across all columns

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
│  ──────────────────────────────────     │
│  Quick search: [________________] 🔍    │
│                                         │
│  [Clear All]  [Save as Preset ▼] [Apply]│
└─────────────────────────────────────────┘
```

### 3.3 Saved Views

**Features:**
- [x] Save current view (filters + sort + columns)
- [x] Quick load saved views
- [x] Share views (export/import JSON)
- [x] Default view per table

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

**Features:**
- [x] Multiple tables open in tabs
- [x] Tab context menu (close, close others, close all)
- [x] Single unified webview panel
- [x] Query tabs and table tabs
- [x] Tab switching with state preservation
- [ ] Tab reordering (drag and drop) - Deferred to Phase 5
- [ ] Split view (horizontal/vertical) - Deferred to Phase 5
- [ ] Tab persistence across sessions - Deferred to Phase 5

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

# Phase 4 — Schema Insights & Tools

### Goal
Add developer/admin-friendly tools for schema exploration.

### 4.1 Table Metadata Panel

**Features:**
- [x] Slide-out panel with table details
- [x] Column info (type, nullable, default, constraints)
- [x] Primary key indicator
- [x] Foreign key relationships
- [x] Indexes list
- [x] Table statistics (row count, size, last vacuum)

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

**Features:**
- [x] Auto-generate from schema
- [x] Interactive canvas (zoom, pan)
- [x] Click table to open
- [x] Show/hide relationships
- [x] Export as PNG/SVG
- [x] Filter by schema

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

**Features:**
- [x] Auto-save executed queries
- [x] Search history
- [x] Copy/re-run query
- [x] Star favorite queries
- [x] Clear history

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

# Phase 5 — Productivity Tools

### Goal
Developer-first enhancements for faster workflows.

### 5.1 SQL Editor Enhancements ✅ Complete

**Implementation:** CodeMirror 6 (replaced Monaco Editor due to clipboard issues)

**Features:**
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

### 5.3 Data Export/Import ✅ Complete

**Implementation:** Native VSCode File System APIs with custom formatters/parsers

**Features:**
- [x] Export to CSV with optional headers
- [x] Export to JSON (formatted, human-readable)
- [x] Export to SQL (INSERT statements with proper escaping)
- [x] Import from CSV (with/without headers)
- [x] Import from JSON (array of objects)
- [x] Copy selected rows as INSERT statements to clipboard
- [x] Export options: selected rows only, include headers (CSV)
- [x] Column validation on import
- [x] Partial import handling (continues on row errors)
- [x] VSCode save dialog integration
- [x] Toast notifications for success/error feedback
- [ ] Backup table (pg_dump) - Deferred to Phase 5.3.1

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

# Phase 6 — Security & Performance

### Goal
Make dbview reliable and safe for production databases.

### 6.1 Read-Only Mode

**Features:**
- [ ] Per-connection read-only toggle
- [ ] Visual indicator (badge on connection)
- [ ] Block all write operations
- [ ] Warn on connection to production

**UI Components:**
```
DB VIEW
├─ 🔒 production-db (READ ONLY)
│  └─ 📂 public
├─ 🔌 localhost:5432 (dbview_dev)
│  └─ 📂 public
```

### 6.2 Virtual Scrolling

**Features:**
- [ ] Render only visible rows
- [ ] Smooth scrolling for 100k+ rows
- [ ] Lazy load on scroll
- [ ] Skeleton loading states

### 6.3 Connection Health

**Features:**
- [ ] Connection status indicator
- [ ] Auto-reconnect on disconnect
- [ ] Connection timeout handling
- [ ] Multiple connection pools

**UI Components:**
```
┌────────────────────────────────────────┐
│ 🔴 Connection lost to localhost:5432   │
│    [Reconnect] [Dismiss]               │
└────────────────────────────────────────┘
```

### 6.4 Theme Support

**Features:**
- [ ] Auto-detect VS Code theme
- [ ] Light/dark mode support
- [ ] High contrast mode
- [ ] Custom color overrides

---

# Phase 7 — Multi-Database Support

### Goal
Expand dbview beyond PostgreSQL.

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

| Database | Status | Features |
|----------|--------|----------|
| PostgreSQL | ✅ Supported | Full CRUD, schemas, views, functions |
| MySQL | ⏳ Phase 7 | Full CRUD, schemas |
| SQLite | ⏳ Phase 7 | Full CRUD, local file |
| MongoDB | ⏳ Phase 7 | Collections, document viewer |
| Redis | 🔮 Future | Key browser, TTL viewer |
| SQL Server | 🔮 Future | Full CRUD |

---

# Phase 8 — Electron Desktop App

### Goal
Turn dbview into a standalone desktop database client.

### 8.1 Desktop Features

**Features:**
- [ ] Standalone app (no VS Code required)
- [ ] Native menus and shortcuts
- [ ] System tray integration
- [ ] Auto-updates
- [ ] Native file dialogs

### 8.2 Local Workspace

**Features:**
- [ ] Save connections locally (encrypted)
- [ ] Save layouts and preferences
- [ ] Offline schema cache
- [ ] Recent connections list

### 8.3 Distribution

**Platforms:**
- [ ] macOS (.dmg, Apple Silicon + Intel)
- [ ] Windows (.exe, installer + portable)
- [ ] Linux (.AppImage, .deb)

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

# Future Ideas

- AI-assisted SQL generation (Copilot integration)
- Team collaboration (shared queries, schemas)
- Schema migration diff viewer
- Database monitoring dashboard
- Query performance analyzer
- Data masking for sensitive columns
- Audit logging
- Webhooks on data changes
