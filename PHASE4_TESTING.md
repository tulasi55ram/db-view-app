# Phase 4 - Testing Instructions

## Phase 4.1 - Table Metadata Panel

### How to Access
1. **Open a table** in the DBView extension
   - In the DBView Explorer sidebar, expand a schema
   - Click on any table to open it

2. **Click the Info button** (ℹ️ icon) in the table toolbar
   - Located in the top-right area of the table view

### What You'll See
- **Slide-out panel** from the right side showing:
  - 📊 **Statistics**: Row count, table size, index size, last vacuum/analyze times
  - 🔑 **Primary Keys**: All primary key columns
  - 🔗 **Foreign Keys**: All foreign key relationships with target tables
  - 📋 **Indexes**: Complete list of indexes with type (BTREE, etc.) and columns
  - 📄 **Columns**: Detailed column information (type, nullable, default values, constraints)

### Key Features
- Collapsible sections for each metadata category
- Color-coded icons (yellow for PKs, blue for FKs, green for indexes)
- Click anywhere outside the panel or the X button to close

---

## Phase 4.2 - ER Diagram

### How to Access

**Option 1 - Toolbar Button (Recommended):**
1. Open the **DBView Explorer** panel in VS Code's sidebar
2. Look at the toolbar at the top of the DBView panel
3. Click the **graph icon** (📊) - it's next to the SQL Runner icon

**Option 2 - Command Palette:**
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: **`DBView: Open ER Diagram`**
3. Press Enter

### What You'll See
- **Interactive canvas** with all your database tables as nodes
- **Automatic layout** using Dagre hierarchical algorithm
- **Relationship lines** showing foreign key connections (animated blue arrows)

### Interactive Features
- 🔍 **Zoom & Pan**: Mouse wheel to zoom, click-drag to pan
- 🗺️ **Minimap**: Bottom-right corner for navigation
- 🔽 **Schema Filter**: "Schemas (N)" button - select which schemas to display
- 👁️ **Relationships Toggle**: Show/hide foreign key connections
- 📥 **Export**: Export to PNG/SVG (buttons ready for implementation)
- ⛶ **Fullscreen**: Toggle fullscreen mode
- 🔄 **Re-layout**: Re-arrange diagram automatically

### Table Nodes Show
- 🔑 Primary keys (yellow key icon)
- 🔗 Foreign keys (blue link icon)
- Regular columns (first 5 shown, "+N more" if there are more)

**Note:** Click any table to open it in a new data view tab!

---

## Phase 4.3 - Query History

### How to Access
1. **Open SQL Runner**
   - Click the SQL Runner icon (▶️) in DBView Explorer toolbar, OR
   - Command Palette → `DBView: Open SQL Runner`

2. **Click the History button**
   - Located in the top-right of the SQL Runner view
   - Shows a clock icon (🕒) with a dropdown

### What You'll See
- **Dropdown panel** showing all executed queries
- Each entry displays:
  - ✅/❌ Success or failure indicator
  - 📅 Timestamp (when the query was run)
  - ⏱️ Duration (how long it took in milliseconds)
  - 📊 Row count (how many rows returned)
  - ⭐ Star icon (to favorite/unfavorite)

### Features
- 🔍 **Search**: Filter queries by SQL text
- ⭐ **Favorites**: Toggle to show only starred queries
- 🔄 **Re-run**: Click any query to re-run it
- 📋 **Copy**: Copy query SQL to clipboard
- 🗑️ **Delete**: Remove individual queries
- 🧹 **Clear All**: Clear entire history or just non-favorites
- 💾 **Auto-save**: Automatically saves last 100 queries to localStorage

### Pro Tips
- Use `Cmd/Ctrl + Enter` to run queries quickly
- Star important queries for easy access later
- Search feature works across all query text
- History persists across VS Code sessions

---

## Quick Reference

| Feature | Access Method | Icon | Location |
|---------|--------------|------|----------|
| **Table Metadata** | Click Info button | ℹ️ | Table view toolbar |
| **ER Diagram** | Click graph icon | 📊 | DBView Explorer toolbar |
| **Query History** | In SQL Runner | 🕒 | SQL Runner top-right |

---

## Testing Checklist

### Phase 4.1 - Table Metadata Panel
- [ ] Open a table and click the Info button
- [ ] Verify statistics (row count, sizes, vacuum times) are displayed
- [ ] Check primary keys are listed with yellow key icons
- [ ] Check foreign keys are listed with blue link icons and target tables
- [ ] Verify indexes list shows all indexes with types and columns
- [ ] Verify all columns are listed with correct metadata
- [ ] Test closing the panel with X button
- [ ] Test closing by clicking outside the panel

### Phase 4.2 - ER Diagram
- [ ] Open ER diagram from toolbar
- [ ] Verify all tables are displayed as nodes
- [ ] Check tables show primary keys, foreign keys, and columns correctly
- [ ] Verify relationship lines connect related tables
- [ ] Test zoom in/out with mouse wheel
- [ ] Test pan by dragging canvas
- [ ] Test schema filter - toggle schemas on/off
- [ ] Test relationship toggle - show/hide connections
- [ ] Test re-layout button
- [ ] Click on a table node to open it in a new tab
- [ ] Test fullscreen mode toggle
- [ ] Check minimap navigation works

### Phase 4.3 - Query History
- [ ] Open SQL Runner
- [ ] Execute a few queries (successful and failed)
- [ ] Click history button to open the dropdown
- [ ] Verify queries are listed with timestamp, duration, and row count
- [ ] Test starring/unstarring a query
- [ ] Test search functionality
- [ ] Test favorites-only toggle
- [ ] Test re-running a query from history
- [ ] Test copying a query to clipboard
- [ ] Test deleting a single query
- [ ] Test clearing all history
- [ ] Test clearing non-favorites only
- [ ] Close and reopen VS Code - verify history persists
