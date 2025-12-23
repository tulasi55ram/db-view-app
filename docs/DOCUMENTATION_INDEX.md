# DBView Documentation Index

## 📚 Available Documentation

### 1. Main README
**File:** [README.md](./README.md)
- Project overview and structure
- Getting started guide
- Build instructions
- Docker database setup
- **NEW:** Configuration & Settings section

### 2. Autocomplete Settings Guide (Complete)
**File:** [AUTOCOMPLETE_SETTINGS.md](./AUTOCOMPLETE_SETTINGS.md)
- **What:** Comprehensive guide to autocomplete performance settings
- **For:** Users with large databases or slow autocomplete
- **Includes:**
  - Step-by-step VS Code Settings UI instructions
  - All three configurable settings explained
  - Recommended configurations by database size
  - Performance impact analysis
  - Troubleshooting guide
  - How to access tables beyond limits

### 3. Quick Start Settings Guide
**File:** [docs/SETTINGS_QUICK_START.md](./docs/SETTINGS_QUICK_START.md)
- **What:** Visual quick reference
- **For:** Users who want instant setup
- **Includes:**
  - Visual diagram of where to find settings
  - 30-second setup instructions
  - One-click configuration examples
  - Common questions & answers

---

## 🎯 Where to Adjust Max Total Tables

### Option 1: VS Code Settings UI (Easiest)

1. **Open Settings:**
   - Windows/Linux: `File > Preferences > Settings` or `Ctrl+,`
   - macOS: `Code > Preferences > Settings` or `Cmd+,`

2. **Search:** Type `dbview autocomplete` in the search bar

3. **Adjust:** You'll see three settings with sliders/input boxes:
   - Max Tables Per Schema (default: 200)
   - **Max Total Tables (default: 500)** ← This one!
   - Max Tables With Metadata (default: 100)

4. **Save & Reload:** Settings auto-save, then reload window

---

### Option 2: Edit settings.json Directly (Advanced)

1. **Open:** `Ctrl+Shift+P` → `Preferences: Open User Settings (JSON)`

2. **Add:**
   ```json
   {
     "dbview.autocomplete.maxTotalTables": 1000
   }
   ```

3. **Save:** `Ctrl+S` or `Cmd+S`

4. **Reload:** `Ctrl+Shift+P` → `Developer: Reload Window`

---

## 📖 Which Document Should I Read?

| If you want to... | Read this |
|------------------|-----------|
| Get started quickly | [Quick Start Guide](./docs/SETTINGS_QUICK_START.md) |
| Understand all settings in detail | [Complete Settings Guide](./AUTOCOMPLETE_SETTINGS.md) |
| See visual diagrams | [Quick Start Guide](./docs/SETTINGS_QUICK_START.md) |
| Configure for specific DB size | [Complete Settings Guide](./AUTOCOMPLETE_SETTINGS.md) - See "Recommended Settings" |
| Troubleshoot performance | [Complete Settings Guide](./AUTOCOMPLETE_SETTINGS.md) - See "Troubleshooting" |
| Access tables beyond limits | [Complete Settings Guide](./AUTOCOMPLETE_SETTINGS.md) - See "How to Access" |
| Copy-paste configuration | [Quick Start Guide](./docs/SETTINGS_QUICK_START.md) - See "One-Click" |

---

## 🔑 Key Points

### About the 500 Table Limit

**What it means:**
- SQL autocomplete will suggest first 500 tables
- Tables 1-100 include column autocomplete
- Tables 101-500 show table name only

**What it DOESN'T mean:**
- ✅ Schema Explorer (sidebar) shows ALL tables (unlimited)
- ✅ You can still use any table in SQL queries
- ✅ You can still open any table by clicking in tree view
- ✅ You can type table names manually even if not in autocomplete

### How to Increase Limits

**Quick answer:** Adjust `dbview.autocomplete.maxTotalTables` in VS Code settings

**Recommended values:**
- Small DB: 100-200
- Medium DB: 500 (default)
- Large DB: 1000
- Enterprise DB: 2000 (maximum)

### Where Settings Are Stored

**User Settings (Global):**
- Windows: `%APPDATA%\Code\User\settings.json`
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Linux: `~/.config/Code/User/settings.json`

**Workspace Settings (Per Project):**
- `.vscode/settings.json` in your project folder

---

## 📞 Getting Help

1. **Check the documentation** (links above)
2. **Open Developer Console** (`Ctrl+Shift+I`) to see performance logs
3. **Try different limit values** to find what works for your database
4. **Use Schema Explorer** for unlimited table access

---

## 🎉 Quick Win

**Fastest way to adjust Max Total Tables:**

1. Press `Ctrl+,` (Settings)
2. Type `dbview autocomplete`
3. Change "Max Total Tables" number
4. Press `Ctrl+Shift+P` → Type "Reload" → Press Enter

Done! ✅

---

**Last Updated:** December 2024
