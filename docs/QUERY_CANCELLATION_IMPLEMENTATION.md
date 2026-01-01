# Query Cancellation Implementation Guide

## Overview

This document outlines the implementation plan for full database-level query cancellation across all supported database types in DBView.

**Current Status (v0.1.0)**: UI-level cancellation implemented
**Future Enhancement**: Database-level cancellation (this document)

---

## Current Implementation

### What Works Now (UI-Level Cancellation)

✅ **Frontend Implementation** (Completed)
- Run button transforms to Cancel button when query is executing
- Visual feedback: Red "Cancel" button with X icon
- Immediate UI response when user clicks Cancel
- Loading state cleared in frontend store
- User sees "Query cancelled by user" message

✅ **Files Modified**
- `packages/shared-state/src/hooks/useQueryActions.ts` - Added `cancelQuery()` action
- `packages/ui/src/components/SqlRunnerView.tsx` - Button transformation logic
- `packages/ui/src/components/ConnectedSqlRunnerView.tsx` - Cancel handler
- `apps/vscode-extension/src/mainPanel.ts` - CANCEL_QUERY message handler

### Limitations

⚠️ **What Doesn't Work Yet**
- Query continues running on database server until completion
- Database resources remain locked until query finishes
- For very long queries (minutes/hours), this defeats the purpose
- Network bandwidth continues being consumed for result streaming

---

## Why Full Database Cancellation Matters

### User Experience Issues
1. **Resource Waste**: Long-running queries consume CPU, memory, and I/O on database server
2. **Lock Contention**: Running queries may hold locks preventing other operations
3. **Cost**: Cloud database pricing based on compute time
4. **Confusion**: Users think query is cancelled but it's still running server-side

### Real-World Scenarios
```sql
-- Accidentally querying millions of rows
SELECT * FROM orders WHERE created_at > '2020-01-01';  -- Takes 5 minutes

-- Complex joins without proper indexes
SELECT * FROM users u
JOIN orders o ON u.id = o.user_id
JOIN products p ON o.product_id = p.id;  -- Takes 10 minutes

-- Cartesian product mistake
SELECT * FROM table1, table2;  -- Never completes
```

Without database-level cancellation, users must:
- Wait for timeout (30s+ default)
- Close the entire connection/tab
- Restart VS Code extension
- Kill the database process manually

---

## Technical Architecture

### High-Level Design

```
┌─────────────┐
│   Frontend  │  1. User clicks Cancel
│  (Webview)  │────────────────────────┐
└─────────────┘                        │
                                       ▼
                            ┌──────────────────┐
                            │  Message Handler │
                            │   (mainPanel)    │
                            └──────────────────┘
                                       │
                                       │ 2. Look up running query
                                       ▼
                            ┌──────────────────┐
                            │  Query Tracker   │
                            │  Map<tabId, {    │
                            │    controller,   │
                            │    queryHandle   │
                            │  }>              │
                            └──────────────────┘
                                       │
                                       │ 3. Call database-specific cancel
                                       ▼
                            ┌──────────────────┐
                            │ Database Adapter │
                            │  .cancelQuery()  │
                            └──────────────────┘
                                       │
                                       │ 4. Send cancel command
                                       ▼
                            ┌──────────────────┐
                            │  Database Server │
                            │  (pg_cancel_     │
                            │   backend, etc)  │
                            └──────────────────┘
```

### Data Structures

```typescript
// Track running queries globally
interface RunningQuery {
  tabId: string;
  controller: AbortController;      // For network cancellation
  queryHandle?: any;                // Database-specific handle
  startTime: number;
  sql: string;
  connectionKey: string;
}

// Global registry in mainPanel.ts
const runningQueries = new Map<string, RunningQuery>();
```

---

## Database-Specific Implementation

### 1. PostgreSQL

**Method 1: pg.Client.cancel()** (Recommended)
```typescript
// In PostgresAdapter.ts
import { Client } from 'pg';

class PostgresAdapter implements DatabaseAdapter {
  private runningQueries = new Map<string, Client>();

  async runQuery(sql: string, queryId?: string): Promise<QueryResultSet> {
    const client = new Client(this.config);
    await client.connect();

    if (queryId) {
      this.runningQueries.set(queryId, client);
    }

    try {
      const result = await client.query(sql);
      return this.formatResult(result);
    } finally {
      this.runningQueries.delete(queryId);
      await client.end();
    }
  }

  async cancelQuery(queryId: string): Promise<void> {
    const client = this.runningQueries.get(queryId);
    if (client) {
      // Cancel the query using PostgreSQL's cancel mechanism
      await client.cancel();
      this.runningQueries.delete(queryId);
    }
  }
}
```

**Method 2: pg_cancel_backend()** (Alternative)
```typescript
async cancelQuery(queryId: string): Promise<void> {
  // Get the process ID of the running query
  const pidResult = await this.adminClient.query(
    `SELECT pid FROM pg_stat_activity
     WHERE query = $1 AND state = 'active'`,
    [sql]
  );

  if (pidResult.rows.length > 0) {
    const pid = pidResult.rows[0].pid;
    await this.adminClient.query('SELECT pg_cancel_backend($1)', [pid]);
  }
}
```

**Pros**: Native PostgreSQL support, clean cancellation
**Cons**: Requires tracking query PIDs or using separate admin connection

### 2. MySQL

**Using KILL QUERY**
```typescript
class MySQLAdapter implements DatabaseAdapter {
  private connectionIds = new Map<string, number>();

  async runQuery(sql: string, queryId?: string): Promise<QueryResultSet> {
    const connection = await mysql.createConnection(this.config);

    if (queryId) {
      const [rows] = await connection.query('SELECT CONNECTION_ID()');
      this.connectionIds.set(queryId, rows[0]['CONNECTION_ID()']);
    }

    try {
      const [results] = await connection.query(sql);
      return this.formatResult(results);
    } finally {
      this.connectionIds.delete(queryId);
      await connection.end();
    }
  }

  async cancelQuery(queryId: string): Promise<void> {
    const connectionId = this.connectionIds.get(queryId);
    if (connectionId) {
      // Use a separate connection to kill the query
      const killConnection = await mysql.createConnection(this.config);
      await killConnection.query(`KILL QUERY ${connectionId}`);
      await killConnection.end();
      this.connectionIds.delete(queryId);
    }
  }
}
```

**Pros**: Built-in KILL QUERY command
**Cons**: Requires separate admin connection for killing

### 3. MongoDB

**Using AbortController**
```typescript
class MongoDBAdapter implements DatabaseAdapter {
  private controllers = new Map<string, AbortController>();

  async runQuery(query: string, queryId?: string): Promise<QueryResultSet> {
    const controller = new AbortController();

    if (queryId) {
      this.controllers.set(queryId, controller);
    }

    try {
      // Parse query JSON
      const { collection, filter, options } = JSON.parse(query);

      // Pass AbortSignal to find operation
      const cursor = this.db.collection(collection)
        .find(filter, {
          ...options,
          signal: controller.signal
        });

      const results = await cursor.toArray();
      return this.formatResult(results);
    } finally {
      this.controllers.delete(queryId);
    }
  }

  async cancelQuery(queryId: string): Promise<void> {
    const controller = this.controllers.get(queryId);
    if (controller) {
      controller.abort();
      this.controllers.delete(queryId);
    }
  }
}
```

**Alternative: Cursor.close()**
```typescript
private cursors = new Map<string, Cursor>();

async cancelQuery(queryId: string): Promise<void> {
  const cursor = this.cursors.get(queryId);
  if (cursor) {
    await cursor.close();
    this.cursors.delete(queryId);
  }
}
```

**Pros**: Native AbortController support in modern drivers
**Cons**: Only works with async operations

### 4. SQLite

**Challenge**: No native query cancellation

**Option 1: Statement.finalize()**
```typescript
class SQLiteAdapter implements DatabaseAdapter {
  private statements = new Map<string, Statement>();

  async cancelQuery(queryId: string): Promise<void> {
    const stmt = this.statements.get(queryId);
    if (stmt) {
      stmt.finalize();
      this.statements.delete(queryId);
    }
  }
}
```

**Option 2: Close and Reopen Database**
```typescript
async cancelQuery(queryId: string): Promise<void> {
  // Nuclear option: close database and reopen
  await this.db.close();
  await this.connect();
}
```

**Pros**: Simple to implement
**Cons**: No true cancellation, must close connection

### 5. SQL Server

**Using mssql.cancel()**
```typescript
class SQLServerAdapter implements DatabaseAdapter {
  private requests = new Map<string, Request>();

  async runQuery(sql: string, queryId?: string): Promise<QueryResultSet> {
    const request = new sql.Request(this.pool);

    if (queryId) {
      this.requests.set(queryId, request);
    }

    try {
      const result = await request.query(sql);
      return this.formatResult(result);
    } finally {
      this.requests.delete(queryId);
    }
  }

  async cancelQuery(queryId: string): Promise<void> {
    const request = this.requests.get(queryId);
    if (request) {
      request.cancel();
      this.requests.delete(queryId);
    }
  }
}
```

**Pros**: Native driver support
**Cons**: None

### 6. Redis

**Usually not needed** (operations are typically fast)

**If needed: Pipeline abort**
```typescript
class RedisAdapter implements DatabaseAdapter {
  private pipelines = new Map<string, Pipeline>();

  async cancelQuery(queryId: string): Promise<void> {
    const pipeline = this.pipelines.get(queryId);
    if (pipeline) {
      // Redis doesn't have true cancellation
      // Just don't wait for results
      this.pipelines.delete(queryId);
    }
  }
}
```

**Pros**: Redis is fast, rarely needs cancellation
**Cons**: No true cancellation support

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. **Add cancelQuery() to DatabaseAdapter interface**
   ```typescript
   // packages/core/src/adapters/DatabaseAdapter.ts
   export interface DatabaseAdapter {
     // ... existing methods
     cancelQuery?(queryId: string): Promise<void>;
   }
   ```

2. **Update mainPanel.ts to track running queries**
   ```typescript
   const runningQueries = new Map<string, RunningQuery>();

   case "RUN_QUERY": {
     const queryId = `${tabId}-${Date.now()}`;
     runningQueries.set(queryId, {
       tabId,
       startTime: Date.now(),
       sql: message.sql,
       connectionKey: key,
     });

     try {
       const result = await currentClient.runQuery(message.sql, queryId);
       // ... handle result
     } finally {
       runningQueries.delete(queryId);
     }
   }
   ```

3. **Implement CANCEL_QUERY handler**
   ```typescript
   case "CANCEL_QUERY": {
     const query = Array.from(runningQueries.values())
       .find(q => q.tabId === tabId);

     if (query && currentClient.cancelQuery) {
       await currentClient.cancelQuery(query.queryId);
     }

     runningQueries.delete(query.queryId);
   }
   ```

### Phase 2: Database Adapters (Week 2)

Implement `cancelQuery()` for each adapter:
- ✅ PostgreSQL (highest priority)
- ✅ MySQL
- ✅ MongoDB
- ⚠️  SQLite (best effort)
- ✅ SQL Server
- ⚠️  Redis (low priority)

### Phase 3: Testing (Week 3)

**Test Cases**:
1. Cancel query within 1 second of starting
2. Cancel query after 5 seconds
3. Cancel query that has locks
4. Cancel multiple queries simultaneously
5. Network interruption during cancellation
6. Database connection lost during cancellation

**Long-Running Test Queries**:
```sql
-- PostgreSQL: Simulate slow query
SELECT pg_sleep(30), * FROM large_table;

-- MySQL: Cartesian product
SELECT * FROM users, orders LIMIT 1000000;

-- MongoDB: Slow aggregation
db.collection.aggregate([
  { $match: {} },
  { $lookup: { ... } },
  { $group: { ... } }
])
```

### Phase 4: Error Handling (Week 4)

**Edge Cases**:
1. Query finishes before cancel arrives
2. Database connection dies during cancel
3. User has insufficient permissions to cancel
4. Query is already in COMMIT phase
5. Nested transactions

**Error Messages**:
```typescript
try {
  await adapter.cancelQuery(queryId);
  toast.success("Query cancelled successfully");
} catch (error) {
  if (error.code === 'INSUFFICIENT_PRIVILEGES') {
    toast.error("Cannot cancel query: Insufficient permissions");
  } else if (error.code === 'QUERY_COMPLETED') {
    toast.info("Query already completed");
  } else {
    toast.error("Failed to cancel query", { description: error.message });
  }
}
```

---

## Challenges and Considerations

### 1. Transaction Handling

**Problem**: What happens if cancelled query is inside a transaction?

**Solution**:
```typescript
// Detect transaction state
if (adapter.isInTransaction()) {
  const choice = await vscode.window.showWarningMessage(
    'Query is part of an active transaction. Cancel anyway?',
    'Cancel and Rollback',
    'Keep Running'
  );

  if (choice === 'Cancel and Rollback') {
    await adapter.cancelQuery(queryId);
    await adapter.rollback();
  }
}
```

### 2. Streaming Results

**Problem**: Query is streaming 1M rows, user cancels at 100K rows

**Options**:
- **Discard all results** (simple, clean)
- **Show partial results** (complex, useful for debugging)

**Recommendation**: Discard all results (consistency)

### 3. Connection Pooling

**Problem**: Cancelled query leaves connection in bad state

**Solution**:
```typescript
async cancelQuery(queryId: string): Promise<void> {
  const client = this.pool.getClient(queryId);

  try {
    await client.cancel();
  } catch (error) {
    // Connection is in bad state, destroy it
    client.destroy();
    this.pool.removeClient(client);
  }
}
```

### 4. Permissions

**Problem**: User lacks permission to cancel queries

**Detection**:
```sql
-- PostgreSQL: Check permissions
SELECT has_database_privilege(current_user, current_database(), 'CONNECT');

-- MySQL: Check SUPER privilege
SHOW GRANTS FOR CURRENT_USER;
```

### 5. Cross-Database Transactions

**Problem**: MongoDB doesn't support transactions in older versions

**Solution**: Feature detection
```typescript
async cancelQuery(queryId: string): Promise<void> {
  if (this.supportsTransactions) {
    // Safe cancellation with transaction awareness
  } else {
    // Best-effort cancellation
  }
}
```

---

## Performance Considerations

### Tracking Overhead

**Memory**: `~200 bytes per running query`
- TabId: 50 bytes
- SQL: ~100 bytes
- Timestamps: 16 bytes
- Handles: 34 bytes

**CPU**: Negligible (Map lookups are O(1))

### Cleanup Strategy

```typescript
// Clean up orphaned queries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [queryId, query] of runningQueries) {
    if (now - query.startTime > timeout) {
      console.warn(`Orphaned query detected: ${queryId}`);
      adapter.cancelQuery(queryId);
      runningQueries.delete(queryId);
    }
  }
}, 5 * 60 * 1000);
```

---

## Security Considerations

### 1. Authorization

**Only allow users to cancel their own queries**:
```typescript
case "CANCEL_QUERY": {
  const query = runningQueries.get(queryId);

  // Verify query belongs to this connection
  if (query.connectionKey !== key) {
    throw new Error('Cannot cancel queries from other connections');
  }

  await currentClient.cancelQuery(queryId);
}
```

### 2. SQL Injection in KILL Commands

**Bad**:
```typescript
await pool.query(`KILL QUERY ${connectionId}`); // Vulnerable!
```

**Good**:
```typescript
await pool.query('KILL QUERY ?', [connectionId]); // Parameterized
```

### 3. DoS Protection

**Prevent cancel spam**:
```typescript
const cancelCooldown = new Map<string, number>();

case "CANCEL_QUERY": {
  const lastCancel = cancelCooldown.get(tabId) || 0;
  const now = Date.now();

  if (now - lastCancel < 1000) {
    throw new Error('Please wait before cancelling again');
  }

  cancelCooldown.set(tabId, now);
  await adapter.cancelQuery(queryId);
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('Query Cancellation', () => {
  it('should cancel PostgreSQL query', async () => {
    const adapter = new PostgresAdapter(config);
    const queryId = 'test-123';

    // Start long-running query
    const promise = adapter.runQuery('SELECT pg_sleep(10)', queryId);

    // Cancel after 1 second
    await sleep(1000);
    await adapter.cancelQuery(queryId);

    // Verify query was cancelled
    await expect(promise).rejects.toThrow('Query cancelled');
  });

  it('should handle already-completed query', async () => {
    const adapter = new PostgresAdapter(config);
    const queryId = 'test-456';

    // Run fast query
    await adapter.runQuery('SELECT 1', queryId);

    // Try to cancel (should not throw)
    await expect(
      adapter.cancelQuery(queryId)
    ).resolves.not.toThrow();
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Cancellation', () => {
  it('should cancel from UI', async () => {
    // 1. Open query tab
    await vscode.commands.executeCommand('dbview.newQuery');

    // 2. Type slow query
    await setEditorContent('SELECT pg_sleep(30)');

    // 3. Click Run
    await clickButton('Run');

    // 4. Wait for loading state
    await waitFor(() => getButton('Cancel').exists());

    // 5. Click Cancel
    await clickButton('Cancel');

    // 6. Verify query stopped
    await waitFor(() => !isLoading());
    expect(getErrorMessage()).toBe('Query cancelled by user');
  });
});
```

### Manual Testing Checklist

- [ ] PostgreSQL: Cancel SELECT with large result set
- [ ] PostgreSQL: Cancel slow JOIN
- [ ] PostgreSQL: Cancel query in transaction
- [ ] MySQL: Cancel long-running query
- [ ] MongoDB: Cancel slow aggregation
- [ ] SQLite: Attempt cancellation
- [ ] Multiple databases: Cancel multiple queries at once
- [ ] Network: Cancel with poor connection
- [ ] Permissions: Cancel without proper privileges

---

## Rollout Plan

### Stage 1: Beta Testing (Internal)
- Enable for PostgreSQL only
- Test with internal team
- Gather feedback on UX

### Stage 2: Limited Release
- Enable for PostgreSQL + MySQL
- Release to early adopters
- Monitor error rates

### Stage 3: Full Release
- Enable for all databases
- Document limitations (SQLite, Redis)
- Add telemetry for cancellation success rates

### Metrics to Track
- Cancellation success rate by database type
- Time from cancel request to actual cancellation
- Number of orphaned queries
- User satisfaction (survey)

---

## Future Enhancements

### 1. Query Timeout Configuration

```typescript
// User setting in VS Code
"dbview.queryTimeout": 30000,  // 30 seconds

// Auto-cancel after timeout
const timeoutId = setTimeout(() => {
  adapter.cancelQuery(queryId);
  showWarning('Query exceeded timeout, cancelled automatically');
}, config.queryTimeout);
```

### 2. Cancel All Queries

```typescript
// Button in toolbar
<button onClick={cancelAllQueries}>
  Cancel All Running Queries
</button>

function cancelAllQueries() {
  for (const [queryId, query] of runningQueries) {
    adapter.cancelQuery(queryId);
  }
}
```

### 3. Query History with Cancellation Stats

```sql
-- Track in query history
{
  sql: "SELECT * FROM huge_table",
  duration: 5234,
  cancelled: true,
  cancelledAfter: 2100,  // Cancelled after 2.1 seconds
  rowsRetrieved: 0
}
```

### 4. Cost Estimation

```typescript
// Warn before running expensive queries
if (estimatedCost > threshold) {
  const proceed = await showWarning(
    'This query may take a long time. Continue?',
    'Run Anyway',
    'Cancel'
  );
}
```

---

## References

### Documentation
- [PostgreSQL: Canceling Requests](https://www.postgresql.org/docs/current/libpq-cancel.html)
- [MySQL: KILL Syntax](https://dev.mysql.com/doc/refman/8.0/en/kill.html)
- [MongoDB: AbortController](https://mongodb.github.io/node-mongodb-native/4.0/classes/abortcontroller.html)
- [node-postgres: Query Cancellation](https://node-postgres.com/features/cancelling-queries)

### Related Issues
- #42: Add query cancellation support
- #89: Long-running queries hang UI
- #156: Cannot stop expensive EXPLAIN queries

---

## Contributors

This feature requires collaboration across teams:
- **Backend**: Database adapter implementation
- **Frontend**: UI/UX for cancel button
- **QA**: Testing across databases
- **DevOps**: Monitoring and telemetry

---

## Appendix A: Error Codes

| Code | Database | Meaning | Action |
|------|----------|---------|--------|
| `57014` | PostgreSQL | Query cancelled | Expected |
| `1317` | MySQL | Query execution was interrupted | Expected |
| `ABORT_ERR` | MongoDB | Operation aborted | Expected |
| `SQLITE_INTERRUPT` | SQLite | Query interrupted | Expected |
| `INSUFFICIENT_PRIVILEGE` | Any | Cannot cancel query | Show permission error |

---

## Appendix B: Database Feature Matrix

| Database | Cancel Support | Method | Complexity | Priority |
|----------|----------------|--------|------------|----------|
| PostgreSQL | ✅ Full | `client.cancel()` | Low | High |
| MySQL | ✅ Full | `KILL QUERY` | Medium | High |
| MongoDB | ✅ Full | `AbortController` | Low | High |
| SQL Server | ✅ Full | `request.cancel()` | Low | Medium |
| SQLite | ⚠️ Limited | Connection close | High | Low |
| Redis | ⚠️ Limited | N/A (fast) | N/A | Low |
| Cassandra | ✅ Full | `execute.cancel()` | Medium | Medium |
| Elasticsearch | ✅ Full | `AbortController` | Low | Medium |

---

## Document Version

- **Version**: 1.0
- **Last Updated**: 2025-12-31
- **Author**: DBView Team
- **Status**: Planning / Not Yet Implemented
