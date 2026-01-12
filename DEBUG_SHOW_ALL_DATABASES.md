# Debug Guide: Show All Databases Feature

## Current Issue
When "Show all databases" checkbox is checked and connection is established, expanding the connection shows "no schemas" instead of showing the database list.

## Debug Steps

### 1. Open Developer Console
- In the desktop app, open the developer console (usually View → Developer Tools or Ctrl+Shift+I / Cmd+Option+I)
- Keep the console visible while testing

### 2. Test Scenario
1. Add a new SQL connection (PostgreSQL, MySQL, or MariaDB)
2. **Check the "Show all databases" checkbox**
3. Test the connection (should show success)
4. Save the connection
5. Connect to the database by clicking on it
6. Expand the connection node in the sidebar

### 3. What to Look For in Console

The console should show a series of log messages:

#### When Building Tree Node:
```
Building tree node for "Your Connection Name": {
  nodeId: "...",
  status: "connected",
  dbType: "postgres" (or "mysql", "mariadb"),
  showAllDatabases: true,  ← Should be TRUE
  hasExistingNode: false,
  existingChildren: 0
}
```

#### When Expanding Connection:
```
Expanding connection node: {
  name: "Your Connection Name",
  dbType: "postgres",
  showAllDatabases: true,  ← Should be TRUE
  isNoSchemaDb: false
}
```

#### If showAllDatabases is TRUE:
```
Loading databases for connection with showAllDatabases=true: Your Connection Name true
Loaded databases: [
  { id: "...", type: "database", name: "database1", ... },
  { id: "...", type: "database", name: "database2", ... },
  ...
]
```

#### If showAllDatabases is FALSE (wrong behavior):
```
Loading schemas for connection (no showAllDatabases): Your Connection Name
```

### 4. Possible Issues to Identify

**Issue A: showAllDatabases is undefined/false in tree node building**
- If `showAllDatabases: false` or `undefined` in the first log
- **Cause**: The flag isn't being saved in the connection config
- **Fix needed**: Check AddConnectionView.tsx buildConfig() function

**Issue B: showAllDatabases becomes false during expansion**
- If `showAllDatabases: true` in tree building but `false` during expansion
- **Cause**: The flag is being lost when updating tree nodes
- **Fix needed**: Check updateTreeNode() function to preserve the flag

**Issue C: Database list is empty**
- If `Loaded databases: []` appears
- **Cause**: The database list API is returning no results
- **Fix needed**: Check IPC handler and database adapter listDatabases() implementation

**Issue D: Error in loading databases**
- If you see a toast error message or console error
- **Cause**: The API call is failing
- **Fix needed**: Check the error message and fix the backend implementation

## Expected Behavior

With the debug logs, you should see:
1. Tree node built with `showAllDatabases: true` ✓
2. Expansion takes the `node.showAllDatabases` branch ✓
3. `loadDatabases()` is called ✓
4. Multiple database objects are returned ✓
5. Tree updates with database nodes as children ✓

## Report Back

Please share:
1. **All console log output** from the test scenario
2. **Screenshot** of the sidebar after expanding the connection
3. Any **error messages** or toast notifications that appear

This will help identify exactly where the feature is breaking.
