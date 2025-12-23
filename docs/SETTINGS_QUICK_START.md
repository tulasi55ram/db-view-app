# Quick Start: Adjusting Autocomplete Limits

## 📍 Where to Find Settings

### Visual Guide

```
┌─────────────────────────────────────────────────────┐
│ VS Code Menu Bar                                     │
├─────────────────────────────────────────────────────┤
│ File > Preferences > Settings                        │
│ (or press Ctrl+,)                                   │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Settings Tab                                         │
├─────────────────────────────────────────────────────┤
│ 🔍 Search settings                                   │
│ ┌─────────────────────────────────────────────┐     │
│ │ dbview autocomplete                          │     │
│ └─────────────────────────────────────────────┘     │
│                                                      │
│ Extensions › DBView › Autocomplete                   │
│                                                      │
│ ◉ Max Tables Per Schema                             │
│   [200                              ] ← Adjust this  │
│   Maximum number of tables to fetch per schema       │
│                                                      │
│ ◉ Max Total Tables                                   │
│   [500                              ] ← Adjust this  │
│   Maximum total tables across all schemas            │
│                                                      │
│ ◉ Max Tables With Metadata                           │
│   [100                              ] ← Adjust this  │
│   Maximum tables to fetch column metadata for        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## ⚡ 30-Second Setup

### Step 1: Open Settings
- Press `Ctrl+,` (Windows/Linux) or `Cmd+,` (macOS)

### Step 2: Search
- Type: `dbview autocomplete`

### Step 3: Adjust
- Change the numbers based on your database size:
  - **Small DB (< 100 tables):** Keep defaults or lower
  - **Medium DB (100-500 tables):** Defaults are fine
  - **Large DB (500+ tables):** Increase to 1000-2000

### Step 4: Reload
- Press `Ctrl+Shift+P` → Type "Reload Window" → Press Enter

---

## 🎯 One-Click Configurations

### For Small Databases (< 100 tables)
**Copy-paste into settings.json:**
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 100,
  "dbview.autocomplete.maxTotalTables": 100,
  "dbview.autocomplete.maxTablesWithMetadata": 100
}
```

### For Medium Databases (100-500 tables)
**Use default settings** - no changes needed!

### For Large Databases (500-1000 tables)
**Copy-paste into settings.json:**
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 300,
  "dbview.autocomplete.maxTotalTables": 1000,
  "dbview.autocomplete.maxTablesWithMetadata": 150
}
```

### For Enterprise Databases (1000+ tables)
**Copy-paste into settings.json:**
```json
{
  "dbview.autocomplete.maxTablesPerSchema": 500,
  "dbview.autocomplete.maxTotalTables": 2000,
  "dbview.autocomplete.maxTablesWithMetadata": 100
}
```

---

## 📝 How to Edit settings.json Directly

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type: `Preferences: Open User Settings (JSON)`
3. Press Enter
4. Add your configuration (see examples above)
5. Save: `Ctrl+S` (or `Cmd+S`)
6. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"

---

## ✅ Verify Settings Are Working

After changing settings:

1. **Open Developer Console:** `Ctrl+Shift+I` (or `Cmd+Option+I`)
2. **Click "Console" tab**
3. **Look for this message:**
   ```
   [dbview] Using limits: 1000 tables max, 150 with metadata
   ```
4. **Check if your new limits are shown**

---

## ❓ Common Questions

### Q: Where are these settings stored?
**A:** In your VS Code user settings:
- Windows: `%APPDATA%\Code\User\settings.json`
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Linux: `~/.config/Code/User/settings.json`

### Q: Can I have different settings per workspace?
**A:** Yes! Create `.vscode/settings.json` in your project folder with the same settings.

### Q: What if I set the limits too high?
**A:** The extension might freeze during startup. Lower the limits and reload.

### Q: Can I remove limits entirely?
**A:** Not recommended, but you can set to maximum (2000). Performance will suffer on very large databases.

### Q: Will this affect the Schema Explorer?
**A:** No! The sidebar tree view shows ALL tables regardless of these limits.

---

## 🔗 Full Documentation

For detailed explanations, performance analysis, and troubleshooting:
👉 [AUTOCOMPLETE_SETTINGS.md](../AUTOCOMPLETE_SETTINGS.md)

---

**Quick tip:** Start with defaults, increase only if needed!
