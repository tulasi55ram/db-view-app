# Phase 5.1 - SQL Editor Testing Guide

## ✅ Implementation Status

All Phase 5.1 features have been successfully implemented:

- ✅ Monaco Editor integration with VSCode theme
- ✅ Syntax highlighting for SQL
- ✅ Schema-aware autocomplete (tables, columns, keywords, functions)
- ✅ SQL formatting with sql-formatter
- ✅ EXPLAIN ANALYZE visualization
- ✅ Multi-cursor editing and Find/Replace
- ✅ Keyboard shortcuts (Cmd+Enter, Cmd+Shift+F)

---

## 🧪 Testing Instructions

### Prerequisites

1. **Start PostgreSQL Test Database:**
   ```bash
   docker-compose up -d
   ```
   - Host: `localhost`
   - Port: `5432`
   - User: `postgres`
   - Password: `postgres`
   - Database: `dbview_test`

2. **Build and Launch Extension:**
   ```bash
   # From project root
   pnpm --filter @dbview/ui run build
   pnpm --filter @dbview/vscode-extension run compile

   # Press F5 in VSCode to launch Extension Development Host
   ```

3. **Connect to Database:**
   - In Extension Development Host: `Cmd+Shift+P` → "DBView: Add Connection"
   - Use credentials above

---

## Feature Testing Checklist

### 1. Monaco Editor - Basic Functionality

#### Test: Editor Loads Without Errors
1. Open SQL Runner (`Cmd+Shift+P` → "DBView: Open SQL Runner")
2. **Expected:**
   - Monaco Editor appears (not a basic textarea)
   - Dark VSCode theme applied
   - No CSP errors in DevTools Console
   - Cursor blinks in editor

**Status:** [ ] Pass / [ ] Fail

---

### 2. Syntax Highlighting

#### Test: SQL Keywords and Values
1. Type this query:
   ```sql
   SELECT id, email, created_at
   FROM public.users
   WHERE is_active = TRUE
   AND role IN ('admin', 'user')
   LIMIT 100;
   ```

2. **Expected Colors:**
   - `SELECT`, `FROM`, `WHERE`, `AND`, `LIMIT`, `IN` → **Blue** (keywords)
   - `id`, `email`, `created_at`, `is_active`, `role` → **Light blue** (identifiers)
   - `'admin'`, `'user'` → **Orange/Brown** (strings)
   - `TRUE` → **Blue** (boolean)
   - `100` → **Green** (number)

**Status:** [ ] Pass / [ ] Fail

---

### 3. Schema-Aware Autocomplete

#### Test A: Schema Suggestions
1. Type: `SELECT * FROM pu`
2. Press `Ctrl+Space` (or wait for auto-trigger)
3. **Expected:**
   - Dropdown shows `public` schema
   - Icon shows schema symbol
4. Select `public` and type `.`
5. **Expected:**
   - Shows tables in public schema

**Status:** [ ] Pass / [ ] Fail

#### Test B: Table Suggestions with Row Counts
1. Type: `SELECT * FROM public.`
2. **Expected:**
   - Dropdown shows all tables in public schema
   - Each table shows row count: `users (1,234 rows)`
   - Table icon displayed

**Status:** [ ] Pass / [ ] Fail

#### Test C: Column Suggestions
1. Type:
   ```sql
   SELECT u.
   FROM users u
   ```
2. Place cursor after `u.`
3. **Expected:**
   - Dropdown shows columns: `id`, `email`, `name`, `created_at`, etc.
   - Column type shown: `id (integer)`, `email (varchar)`

**Status:** [ ] Pass / [ ] Fail

#### Test D: SQL Keyword Suggestions
1. Type: `SEL`
2. **Expected:**
   - `SELECT` suggested
3. Type: `COUN`
4. **Expected:**
   - `COUNT()` function suggested

**Status:** [ ] Pass / [ ] Fail

---

### 4. SQL Formatting

#### Test A: Format Messy SQL
1. Type (all on one line):
   ```sql
   select id,email,name from users where is_active=true and role='admin' limit 10
   ```
2. Click **Format** button (📐 icon) or press `Cmd+Shift+F`
3. **Expected:**
   - SQL reformatted with proper indentation:
     ```sql
     SELECT
       id,
       email,
       name
     FROM
       users
     WHERE
       is_active = TRUE
       AND role = 'admin'
     LIMIT
       10
     ```
   - Toast notification: "SQL formatted successfully"

**Status:** [ ] Pass / [ ] Fail

#### Test B: Format Button Disabled When Empty
1. Clear SQL editor (click Clear button)
2. **Expected:**
   - Format button is disabled/grayed out

**Status:** [ ] Pass / [ ] Fail

---

### 5. EXPLAIN ANALYZE Visualization

#### Test A: Basic Query Execution Plan
1. Type:
   ```sql
   SELECT * FROM users WHERE email = 'test@example.com'
   ```
2. Click **Explain** button (⚡ Zap icon)
3. **Expected:**
   - Side panel slides in from right
   - Shows summary cards:
     - **Execution Time**: X ms
     - **Total Cost**: X.XX
     - **Planning Time**: X ms
     - **Estimated Rows**: X
   - Shows execution plan tree with nodes
   - Each node shows timing and percentage

**Status:** [ ] Pass / [ ] Fail

#### Test B: Performance Insights - Sequential Scan Warning
1. Type:
   ```sql
   SELECT * FROM users WHERE name LIKE '%john%'
   ```
2. Click **Explain** button
3. **Expected:**
   - Panel shows **Performance Insights** section
   - Warning about Sequential Scan:
     - Icon: ⚠️
     - Message: "Sequential Scan detected on large table"
     - Suggestion: "Consider adding an index..."

**Status:** [ ] Pass / [ ] Fail

#### Test C: Complex Query with Joins
1. Type:
   ```sql
   SELECT u.email, o.total
   FROM users u
   JOIN orders o ON u.id = o.user_id
   WHERE o.status = 'completed'
   ORDER BY o.created_at DESC
   LIMIT 10
   ```
2. Click **Explain**
3. **Expected:**
   - Shows nested plan nodes:
     - Limit
     - Sort
     - Hash Join
     - Seq Scan on users
     - Seq Scan on orders
   - Each node expandable/collapsible
   - Time percentages color-coded:
     - Red (>50%), Orange (>25%), Yellow (>10%)

**Status:** [ ] Pass / [ ] Fail

#### Test D: Close EXPLAIN Panel
1. With EXPLAIN panel open, click **Close** (X button)
2. **Expected:**
   - Panel slides out and closes
   - Main editor still shows query results

**Status:** [ ] Pass / [ ] Fail

#### Test E: EXPLAIN Error Handling
1. Type invalid SQL: `SELEC * FROM invalid_table`
2. Click **Explain** button
3. **Expected:**
   - Error toast appears
   - Panel shows error message
   - No crash

**Status:** [ ] Pass / [ ] Fail

---

### 6. Multi-Cursor Editing

#### Test: Edit Multiple Lines Simultaneously
1. Type:
   ```sql
   SELECT
     id,
     email,
     name
   FROM users;
   ```
2. Hold `Alt/Option` and click before `id`, `email`, and `name`
3. Type `u.` before each
4. **Expected:**
   - All three lines update at once:
     ```sql
     SELECT
       u.id,
       u.email,
       u.name
     FROM users u;
     ```

**Status:** [ ] Pass / [ ] Fail

---

### 7. Keyboard Shortcuts

| Shortcut | Action | Test |
|----------|--------|------|
| `Cmd/Ctrl+Enter` | Run Query | Type query → Press shortcut → Query executes |
| `Cmd/Ctrl+Shift+F` | Format SQL | Messy SQL → Press shortcut → Formatted |
| `Cmd/Ctrl+F` | Find | Press → Find dialog appears |
| `Cmd/Ctrl+H` | Replace | Press → Replace dialog appears |
| `Ctrl+Space` | Trigger Autocomplete | Type partial → Press → Suggestions |

**Status:** [ ] Pass / [ ] Fail

---

### 8. Find & Replace

#### Test A: Find Text
1. Type a longer query with repeated words
2. Press `Cmd+F`
3. Search for `SELECT`
4. **Expected:**
   - Find dialog appears
   - All instances of `SELECT` highlighted
   - Can navigate with next/previous

**Status:** [ ] Pass / [ ] Fail

#### Test B: Replace Text
1. Press `Cmd+H`
2. Find: `users`, Replace: `customers`
3. Click "Replace All"
4. **Expected:**
   - All instances of `users` replaced with `customers`

**Status:** [ ] Pass / [ ] Fail

---

### 9. Loading States

#### Test: Query Execution Loading
1. Type: `SELECT pg_sleep(3);` (3-second delay)
2. Click **Run Query**
3. **Expected During Execution:**
   - Editor dims with semi-transparent overlay
   - "Executing query..." message shown
   - Cannot type/edit during execution
   - Run button shows spinner and "Running..."
   - Status bar shows "Executing query..." with pulsing indicator
4. **After Completion:**
   - Editor returns to normal
   - Results displayed
   - Status bar shows "Ready"

**Status:** [ ] Pass / [ ] Fail

---

### 10. Error Handling

#### Test A: SQL Syntax Error
1. Type: `SELEC * FORM users;` (intentional typos)
2. Click **Run Query**
3. **Expected:**
   - Error message displayed below editor
   - Red alert icon shown
   - Query history shows failed query with ❌
   - Error text is descriptive

**Status:** [ ] Pass / [ ] Fail

#### Test B: Format Invalid SQL
1. Type: `SELECT * FROM ((((`
2. Click **Format**
3. **Expected:**
   - Error toast appears
   - SQL remains unchanged
   - No crash

**Status:** [ ] Pass / [ ] Fail

---

### 11. Query History Integration

#### Test A: Successful Query Added to History
1. Run: `SELECT * FROM users LIMIT 5;`
2. Click Query History icon (clock)
3. **Expected:**
   - History panel shows the query
   - Green checkmark icon
   - Duration displayed (e.g., "45ms")
   - Row count shown (e.g., "5 rows")

**Status:** [ ] Pass / [ ] Fail

#### Test B: Failed Query Added to History
1. Run: `SELECT * FROM nonexistent_table;`
2. Open Query History
3. **Expected:**
   - Query shown with red ❌ icon
   - Error message displayed
   - Duration recorded

**Status:** [ ] Pass / [ ] Fail

#### Test C: Rerun Query from History
1. Click on a previous query in history
2. **Expected:**
   - SQL editor populated with that query
   - Query automatically executes after brief delay

**Status:** [ ] Pass / [ ] Fail

---

## 🐛 Troubleshooting

### Issue: Monaco Editor Not Loading
**Symptoms:** Blank editor or basic textarea appears

**Fix:**
```bash
# Clear build and rebuild
rm -rf apps/vscode-extension/media/webview
pnpm --filter @dbview/ui run build
pnpm --filter @dbview/vscode-extension run compile
```

---

### Issue: CSP Errors in Console
**Symptoms:**
```
Refused to load script from 'https://cdn.jsdelivr.net/...'
```

**Fix:** Verify [webviewHost.ts](apps/vscode-extension/src/webviewHost.ts#L15-L16) includes:
```typescript
`worker-src blob:`,
`child-src blob:`
```

---

### Issue: Autocomplete Not Working
**Check:**
1. Open DevTools: `Help` → `Toggle Developer Tools`
2. Look for message: `[dbview-ui] Received autocomplete data: X schemas, Y tables`
3. If missing, check backend connection

**Debug:**
```javascript
// In DevTools Console:
window.postMessage({ command: 'message', data: { type: 'GET_AUTOCOMPLETE_DATA' } }, '*');
```

---

### Issue: EXPLAIN Panel Empty
**Symptoms:** Panel opens but shows no data

**Check Backend Logs:**
1. View Extension Host logs: `Developer: Show Logs...` → `Extension Host`
2. Look for: `[dbview] EXPLAIN result received`
3. Verify query executes without errors

---

### Issue: Format Does Nothing
**Check:**
1. SQL is not empty (button disabled when empty)
2. DevTools console for errors
3. Verify `sql-formatter` installed:
   ```bash
   pnpm list sql-formatter
   # Should show: sql-formatter@15.6.12
   ```

---

## 📊 Performance Benchmarks

| Metric | Expected | Notes |
|--------|----------|-------|
| Editor Startup | <200ms | Time from mount to interactive |
| Autocomplete Response | <200ms | Time from trigger to suggestions |
| Format SQL | <500ms | For queries <1000 lines |
| EXPLAIN Query | <2s | Depends on query complexity |
| Keystroke Latency | <50ms | No lag when typing |

---

## ✅ Success Criteria

All features must pass for Phase 5.1 completion:

- [ ] Monaco Editor loads without CSP errors
- [ ] Syntax highlighting displays correct colors
- [ ] Autocomplete suggests schemas, tables, columns, and keywords
- [ ] Format SQL beautifies code correctly
- [ ] EXPLAIN ANALYZE panel shows execution plan
- [ ] Performance insights appear for inefficient queries
- [ ] Multi-cursor editing works
- [ ] All keyboard shortcuts functional
- [ ] Find/Replace dialogs open and work
- [ ] Error handling shows appropriate messages
- [ ] Loading states display during operations
- [ ] Query history tracks all executions
- [ ] No console errors in DevTools

---

## 🎯 Next Steps After Testing

Once all tests pass:

1. **Phase 5.2:** SQL Code Snippets
   - Predefined query templates
   - Custom snippet creation
   - Variable placeholders

2. **Phase 5.3:** Data Export/Import
   - Export results to CSV, JSON, Excel
   - Import data from files
   - Bulk operations

---

## 📝 Test Results Summary

**Date Tested:** _______________
**Tester:** _______________
**Build Version:** _______________

**Results:**
- Tests Passed: ___ / 25
- Tests Failed: ___ / 25
- Critical Issues: _______________
- Minor Issues: _______________

**Notes:**
_______________________________________
_______________________________________
_______________________________________

---

**Status:** ✅ Ready for Testing
**Last Updated:** 2025-12-22
