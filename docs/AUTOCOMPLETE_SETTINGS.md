# DBView Autocomplete Settings Guide

## Overview

DBView uses configurable limits for autocomplete to prevent performance issues on large databases. This guide explains how to adjust these settings using VS Code's built-in Settings UI.

---

## 🎯 Quick Access

### Method 1: VS Code Settings UI (Recommended)

1. **Open Settings:**
   - **Windows/Linux:** `File > Preferences > Settings` or press `Ctrl+,`
   - **macOS:** `Code > Preferences > Settings` or press `Cmd+,`

2. **Search for DBView:**
   - In the search bar at the top, type: `dbview autocomplete`
   - You'll see three settings appear:

3. **Adjust the Settings:**
   - **Max Tables Per Schema** - Default: 200 (Range: 10-1000)
   - **Max Total Tables** - Default: 500 (Range: 50-2000)
   - **Max Tables With Metadata** - Default: 100 (Range: 10-500)

4. **Save & Reload:**
   - Settings are saved automatically
   - Reload the window: `Ctrl+Shift+P` → "Developer: Reload Window"
   - Or close and reopen the DBView panel

---

### Method 2: Edit settings.json Directly

1. **Open settings.json:**
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type: `Preferences: Open User Settings (JSON)`
   - Press Enter

2. **Add these lines:**
   ```json
   {
     "dbview.autocomplete.maxTablesPerSchema": 500,
     "dbview.autocomplete.maxTotalTables": 1000,
     "dbview.autocomplete.maxTablesWithMetadata": 200
   }
   ```

3. **Save the file:** `Ctrl+S` (or `Cmd+S`)

4. **Reload Window:** `Ctrl+Shift+P` → "Developer: Reload Window"

---

## ⚙️ Available Settings

### 1. Max Tables Per Schema
**Setting ID:** `dbview.autocomplete.maxTablesPerSchema`

- **Default:** 200
- **Range:** 10 - 1000
- **Description:** Maximum number of tables to fetch from each schema
- **Use case:** If a single schema has hundreds of tables, this prevents loading all of them

**Example:**
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 300
}
```

---

### 2. Max Total Tables
**Setting ID:** `dbview.autocomplete.maxTotalTables`

- **Default:** 500
- **Range:** 50 - 2000
- **Description:** Total number of tables to load across all schemas
- **Use case:** Hard limit to prevent overwhelming the autocomplete system

**Example:**
```json
{
  "dbview.autocomplete.maxTotalTables": 1000
}
```

---

### 3. Max Tables With Metadata
**Setting ID:** `dbview.autocomplete.maxTablesWithMetadata`

- **Default:** 100
- **Range:** 10 - 500
- **Description:** Number of tables to fetch detailed column metadata for
- **Use case:** Column autocomplete is expensive - limit it to most important tables

**Example:**
```json
{
  "dbview.autocomplete.maxTablesWithMetadata": 150
}
```

---

## 📊 Recommended Settings by Database Size

### Small Database (< 100 tables)
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 100,
  "dbview.autocomplete.maxTotalTables": 100,
  "dbview.autocomplete.maxTablesWithMetadata": 100
}
```
**Result:** Full autocomplete for all tables and columns

---

### Medium Database (100-500 tables)
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 200,
  "dbview.autocomplete.maxTotalTables": 500,
  "dbview.autocomplete.maxTablesWithMetadata": 200
}
```
**Result:** Good balance of performance and coverage

---

### Large Database (500-2000 tables)
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 300,
  "dbview.autocomplete.maxTotalTables": 1000,
  "dbview.autocomplete.maxTablesWithMetadata": 150
}
```
**Result:** More tables in autocomplete, controlled metadata load

---

### Enterprise Database (2000+ tables)
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 500,
  "dbview.autocomplete.maxTotalTables": 2000,
  "dbview.autocomplete.maxTablesWithMetadata": 100
}
```
**Result:** Maximum coverage with reasonable performance

---

## 🚀 Performance Impact

| Configuration | Small DB (50 tables) | Medium DB (500 tables) | Large DB (2000 tables) |
|--------------|---------------------|------------------------|------------------------|
| **Low (100/100)** | ~0.5s ✅ | ~1s ✅ | ~1s ✅ |
| **Default (500/100)** | ~1s ✅ | ~3s ✅ | ~5s ✅ |
| **High (1000/150)** | ~1s ✅ | ~5s ⚠️ | ~8s ⚠️ |
| **Maximum (2000/200)** | ~1s ✅ | ~8s ⚠️ | ~15s ⚠️ |

**Legend:**
- ✅ Good (< 5 seconds)
- ⚠️ Acceptable (5-15 seconds)
- ❌ Slow (> 15 seconds)

---

## 💡 Understanding the Limits

### What Happens When Limits Are Reached?

#### Scenario: Database with 1000 tables, default settings (500/100)

1. **Tables 1-100:**
   - ✅ Show in autocomplete
   - ✅ Have column autocomplete
   - ✅ Full metadata available

2. **Tables 101-500:**
   - ✅ Show in autocomplete
   - ❌ No column autocomplete
   - ⚠️ Table name only

3. **Tables 501-1000:**
   - ❌ Not in autocomplete
   - ✅ But still accessible via Schema Explorer
   - ✅ Can be typed manually in SQL
   - ✅ Can be opened by clicking in tree view

---

## 🔍 How to Access Tables Beyond Limits

Even if a table doesn't appear in autocomplete, you can still use it:

### Option 1: Schema Explorer (Left Sidebar)
- Shows **ALL tables** regardless of limits
- Click any table to open it
- Use `Ctrl+F` in the tree view to search

### Option 2: Type Table Names Manually
```sql
-- Even if "my_large_table" isn't in autocomplete, this works:
SELECT * FROM schema.my_large_table;
```

### Option 3: Query for Table Names
```sql
-- List all tables in a schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'your_schema'
ORDER BY table_name;
```

---

## 🔄 How to Apply Settings Changes

After changing settings, you must reload the DBView panel:

### Method 1: Reload Window
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type: `Developer: Reload Window`
3. Press Enter

### Method 2: Restart Extension
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type: `Developer: Restart Extension Host`
3. Press Enter

### Method 3: Reconnect Database
1. In DBView Explorer, right-click your connection
2. Click "Disconnect"
3. Right-click again and click "Reconnect"

---

## 📝 Console Logs

To see how limits are being applied, open the Developer Console:

1. Press `Ctrl+Shift+I` (or `Cmd+Option+I`)
2. Click the "Console" tab
3. Look for these messages:

```
[dbview] Using limits: 1000 tables max, 150 with metadata
[dbview] Fetched 50 schemas in 120ms
[dbview] Schema 'public' has 800 tables, limiting to 300
[dbview] Reached max table limit (1000), skipping remaining schemas
[dbview] Fetched 1000 tables in 2500ms
[dbview] Limiting column metadata fetch to 150 of 1000 tables
[dbview] Autocomplete ready: 50 schemas, 1000 tables, 150 with metadata (4800ms)
```

---

## ⚠️ Troubleshooting

### Problem: Autocomplete is slow
**Solution:** Reduce the limits:
```json
{
  "dbview.autocomplete.maxTotalTables": 300,
  "dbview.autocomplete.maxTablesWithMetadata": 50
}
```

### Problem: Missing tables in autocomplete
**Solution 1:** Increase limits:
```json
{
  "dbview.autocomplete.maxTotalTables": 1000
}
```

**Solution 2:** Use Schema Explorer instead
- All tables are visible in the left sidebar tree
- No performance penalty
- Click to open any table

### Problem: Settings not taking effect
**Solution:**
1. Save settings file
2. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Check console logs to verify new limits

### Problem: Extension freezes on startup
**Solution:** Your limits are too high for your database size
```json
{
  "dbview.autocomplete.maxTotalTables": 200,
  "dbview.autocomplete.maxTablesWithMetadata": 50
}
```

---

## 🎯 Best Practices

1. **Start with defaults** - Only increase if you notice missing tables
2. **Monitor console logs** - Check load times before increasing limits
3. **Use Schema Explorer** - For tables beyond autocomplete limits
4. **Incremental increases** - Increase by 100-200 at a time, test performance
5. **Balance is key** - More tables = slower startup

---

## 📱 Location of Settings File

Your settings are stored in:

- **Windows:** `%APPDATA%\Code\User\settings.json`
- **macOS:** `~/Library/Application Support/Code/User/settings.json`
- **Linux:** `~/.config/Code/User/settings.json`

You can also use workspace settings (`.vscode/settings.json` in your project folder) to have different limits per project.

---

## 🔮 Future Enhancements

We're planning to implement **lazy loading** in a future version:

- Load all table names instantly
- Fetch column metadata only when you type a table name
- No upfront performance cost
- Unlimited autocomplete with on-demand details

Stay tuned for updates!

---

## 📞 Need Help?

- **Check console logs** for performance metrics
- **Try different limit combinations** to find the sweet spot
- **Use Schema Explorer** for full table access without limits
- **Report issues** at: https://github.com/anthropics/dbview/issues

---

**Last Updated:** December 2024
**Version:** 0.0.1
