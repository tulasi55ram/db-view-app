# Show All Databases Feature - Fix Summary

## Issue Diagnosed
The error "listDatabases not supported for this database type" was occurring because the `listDatabases()` method was missing from PostgresAdapter.

## Changes Made

### 1. PostgresAdapter - Added listDatabases() Method
**File**: [packages/adapters/src/adapters/PostgresAdapter.ts](packages/adapters/src/adapters/PostgresAdapter.ts#L329-L338)

Added a new method to list all databases on the PostgreSQL server:

```typescript
async listDatabases(): Promise<string[]> {
  const result = await this.query<{ datname: string }>(
    `SELECT datname
     FROM pg_database
     WHERE datistemplate = false
     AND datname != 'postgres'
     ORDER BY datname`
  );
  return result.rows.map((row) => row.datname);
}
```

This query:
- Fetches all database names from `pg_database`
- Excludes template databases (template0, template1)
- Excludes the default 'postgres' database
- Returns sorted list of database names

### 2. Verified Other Adapters Already Have listDatabases()
- **MySQLAdapter**: Already implemented (line 272-280)
- **MariaDBAdapter**: Already implemented (line 309-317)
- **SQLServerAdapter**: Already implemented (line 345-355)

### 3. Improved IPC Handler Error Handling
**File**: [apps/desktop/src/main/ipc/index.ts](apps/desktop/src/main/ipc/index.ts#L157-L172)

Added detailed logging to help diagnose issues:

```typescript
ipcMain.handle("database:list", async (_event, connectionKey: string) => {
  const adapter = connectionManager.getAdapter(connectionKey);
  if (!adapter) {
    throw new Error(`Not connected: ${connectionKey}`);
  }
  console.log(`[IPC] database:list called for ${connectionKey}, adapter type: ${adapter.type}, has listDatabases: ${typeof adapter.listDatabases}`);

  if (typeof adapter.listDatabases !== 'function') {
    console.error(`[IPC] listDatabases is not a function for adapter type: ${adapter.type}`);
    throw new Error(`listDatabases not supported for this database type: ${adapter.type}`);
  }

  const databases = await adapter.listDatabases();
  console.log(`[IPC] database:list returned ${databases.length} databases:`, databases);
  return databases;
});
```

### 4. Fixed AddConnectionView Config Building
**File**: [packages/desktop-ui/src/components/AddConnectionView/AddConnectionView.tsx](packages/desktop-ui/src/components/AddConnectionView/AddConnectionView.tsx)

Changed from:
```typescript
showAllDatabases: showAllDatabases || undefined,
```

To:
```typescript
showAllDatabases,
```

This ensures the boolean value is saved correctly (true/false) instead of converting false to undefined.

### 5. Enhanced Debug Logging in Sidebar
**Files**:
- [packages/desktop-ui/src/components/Sidebar/Sidebar.tsx](packages/desktop-ui/src/components/Sidebar/Sidebar.tsx)
- [packages/desktop-ui/src/components/AddConnectionView/AddConnectionView.tsx](packages/desktop-ui/src/components/AddConnectionView/AddConnectionView.tsx)

Added comprehensive console logging to trace:
1. When connection config is saved with showAllDatabases flag
2. When tree nodes are built from connections
3. When expanding connections with showAllDatabases
4. When loading databases from the backend
5. Backend IPC handler execution

## How to Test

1. **Restart the application** (important - the compiled code has been updated)

2. **Create a new PostgreSQL connection**:
   - Host: localhost
   - Port: 5432
   - Database: dbview_dev (or any database)
   - User: dbview
   - Password: dbview123
   - ✅ **Check "Show all databases"**

3. **Connect and expand**:
   - Save and connect to the database
   - Expand the connection node in the sidebar
   - You should now see a list of databases:
     - analytics_staging
     - dbview_dev
     - ecommerce_prod
     - finance_app
     - hr_system
     - test_playground

4. **Expand a database**:
   - Click on any database (e.g., "ecommerce_prod")
   - It will load schemas for that specific database
   - You can then browse tables, views, etc.

## Docker Test Databases

The Docker setup now creates multiple databases for testing:

### PostgreSQL (port 5432)
- dbview_dev (default)
- ecommerce_prod
- analytics_staging
- hr_system
- finance_app
- test_playground

### MySQL (port 3306)
- dbview_dev (default)
- ecommerce_prod
- analytics_staging
- inventory_system
- customer_portal
- test_environment

### MariaDB (port 3307)
- dbview_dev (default)
- production_app
- staging_env
- development_db
- reporting_system

## Console Output to Expect

When testing, you should see logs like:

```
Saving connection with config: { name: "Test PostgreSQL", dbType: "postgres", showAllDatabases: true }
Building tree node for "Test PostgreSQL": { nodeId: "...", status: "connected", dbType: "postgres", showAllDatabases: true, ... }
Expanding connection node: { name: "Test PostgreSQL", dbType: "postgres", showAllDatabases: true, isNoSchemaDb: false }
[IPC] database:list called for postgres:..., adapter type: postgres, has listDatabases: function
[IPC] database:list returned 6 databases: ["analytics_staging", "dbview_dev", ...]
Loaded databases: [{ id: "...", type: "database", name: "analytics_staging", ...}, ...]
```

## What's Fixed

✅ PostgresAdapter now has `listDatabases()` method
✅ The showAllDatabases flag is saved correctly as a boolean
✅ IPC handler properly checks for and calls listDatabases()
✅ Comprehensive debug logging throughout the flow
✅ All adapters (PostgreSQL, MySQL, MariaDB, SQL Server) support the feature

## Next Steps

1. Restart the app completely
2. Test with the provided connection details
3. If you see any errors, check the console logs
4. Share the console output if issues persist

The feature should now work correctly!
