# Integration Test Plan for Database Adapters

## Overview
This document outlines the integration tests needed to ensure proper behavior across multiple database adapters and connection scenarios, particularly after the PostgreSQL COUNT(*) performance fix.

## Test Setup Requirements

### Testing Framework
Recommend using **Vitest** or **Jest** with the following packages:
```bash
pnpm add -D vitest @vitest/ui @types/node
# or
pnpm add -D jest @types/jest ts-jest
```

### Test Databases
Use Docker Compose to spin up test databases:
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: testdb
    ports:
      - "5433:5432"

  mysql-test:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: testpass
      MYSQL_DATABASE: testdb
    ports:
      - "3307:3306"
```

## Test Suites

### 1. PostgreSQL Adapter Integration Tests
**File**: `src/adapters/__tests__/PostgresAdapter.integration.test.ts`

#### Test Cases:

##### 1.1 listTables() Behavior
- **Test**: Should return NULL for unanalyzed tables
  - Create a new table without running ANALYZE
  - Call listTables()
  - Assert rowCount is undefined/null

- **Test**: Should return 0 for genuinely empty tables
  - Create empty table and run ANALYZE
  - Call listTables()
  - Assert rowCount is 0

- **Test**: Should return approximate counts from statistics
  - Create table with data and run ANALYZE
  - Call listTables()
  - Assert rowCount is close to actual (within tolerance)

- **Test**: Should not trigger COUNT(*) queries
  - Mock/spy on query execution
  - Call listTables()
  - Assert no COUNT(*) queries were executed

- **Test**: Should complete quickly on large schemas
  - Create schema with 50+ tables
  - Measure time for listTables()
  - Assert completion under 2 seconds

##### 1.2 getActualRowCount() Behavior
- **Test**: Should return exact row count via COUNT(*)
  - Create table with known row count (e.g., 100 rows)
  - Call getActualRowCount()
  - Assert exact count returned

- **Test**: Should handle large tables
  - Create table with 100k+ rows
  - Call getActualRowCount()
  - Assert correct count (allow longer timeout)

- **Test**: Should throw error on invalid table
  - Call getActualRowCount() with non-existent table
  - Assert error is thrown with appropriate message

##### 1.3 Statistics Query Correctness
- **Test**: Should distinguish NULL vs 0 correctly
  ```sql
  -- Setup:
  CREATE TABLE never_analyzed (id INT);  -- Should return NULL
  CREATE TABLE empty_analyzed (id INT);  -- Should return 0
  ANALYZE empty_analyzed;
  CREATE TABLE has_data (id INT);        -- Should return estimate
  INSERT INTO has_data SELECT generate_series(1, 100);
  ANALYZE has_data;
  ```
  - Call listTables()
  - Assert: never_analyzed.rowCount === undefined
  - Assert: empty_analyzed.rowCount === 0
  - Assert: has_data.rowCount > 0

### 2. MySQL Adapter Integration Tests
**File**: `src/adapters/__tests__/MySQLAdapter.integration.test.ts`

#### Test Cases:

##### 2.1 listTables() Behavior
- **Test**: Should return approximate counts from information_schema
  - Create table with data
  - Call listTables()
  - Assert rowCount is approximate (within 10% tolerance)

- **Test**: Should not trigger COUNT(*) queries
  - Mock/spy on query execution
  - Call listTables()
  - Assert no COUNT(*) queries executed

- **Test**: Should handle empty tables
  - Create empty table
  - Call listTables()
  - Assert rowCount is 0 or undefined (depends on InnoDB)

##### 2.2 countTableRows() Behavior
- **Test**: Should return exact count via COUNT(*)
  - Create table with known row count
  - Call countTableRows()
  - Assert exact count returned

- **Test**: Should handle filters correctly
  - Create table with data
  - Call countTableRows() with filter
  - Assert filtered count is correct

### 3. Multi-Database Comparison Tests
**File**: `src/adapters/__tests__/multi-db.integration.test.ts`

#### Test Cases:

##### 3.1 Consistent Interface Behavior
- **Test**: Both adapters should implement DatabaseAdapter interface
  - Instantiate PostgresAdapter and MySQLAdapter
  - Assert both have required methods
  - Assert optional methods are properly typed

- **Test**: listTables() returns consistent TableInfo structure
  - Create identical tables in both databases
  - Call listTables() on both
  - Assert same structure (name, rowCount?, sizeBytes?)

##### 3.2 Performance Parity
- **Test**: Both adapters should list tables quickly
  - Create 50 tables in each database
  - Measure listTables() for both
  - Assert both complete under 2 seconds

- **Test**: getActualRowCount() should work on both (where supported)
  - For PostgreSQL: Call getActualRowCount()
  - For MySQL: Verify method doesn't exist or returns error
  - Assert appropriate behavior for each

##### 3.3 Edge Cases
- **Test**: Both adapters handle special characters in table names
  - Create tables with spaces, quotes, unicode
  - Call listTables()
  - Assert all tables returned correctly

- **Test**: Both adapters handle large row counts
  - Create tables with millions of rows
  - Call listTables()
  - Assert counts are reasonable (approximate is fine)

### 4. Reconnection & Resilience Tests
**File**: `src/adapters/__tests__/reconnection.integration.test.ts`

#### Test Cases:

##### 4.1 PostgreSQL Reconnection
- **Test**: Should reconnect after database restart
  - Connect to PostgreSQL
  - Stop/restart container
  - Call reconnect()
  - Assert connection restored

- **Test**: Should handle connection loss during query
  - Connect to PostgreSQL
  - Start long-running query
  - Kill connection mid-query
  - Assert error handling and reconnect logic

- **Test**: Should maintain connection pool after reconnect
  - Connect to PostgreSQL
  - Execute multiple queries
  - Reconnect
  - Execute queries again
  - Assert pool is healthy

##### 4.2 MySQL Reconnection
- **Test**: Should reconnect after database restart
  - Same as PostgreSQL test

- **Test**: Should handle connection timeout
  - Connect to MySQL
  - Wait for connection timeout
  - Execute query
  - Assert auto-reconnect works

##### 4.3 Status Events
- **Test**: Should emit status change events
  - Subscribe to status events
  - Connect/disconnect/reconnect
  - Assert events emitted in correct order

- **Test**: Should update lastError property
  - Trigger connection error
  - Assert lastError is populated
  - Reconnect successfully
  - Assert lastError is cleared

### 5. Regression Tests for COUNT(*) Fix
**File**: `src/adapters/__tests__/count-performance.regression.test.ts`

#### Test Cases:

##### 5.1 Performance Regression
- **Test**: listTables() should not degrade over time
  - Baseline: Measure current listTables() time
  - Create snapshot of execution time
  - Future runs: Assert time doesn't exceed baseline + 20%

- **Test**: Should not execute COUNT(*) queries in listTables()
  - Use query logging/monitoring
  - Call listTables() on schema with 100 tables
  - Assert zero COUNT(*) queries in logs

##### 5.2 Correctness Regression
- **Test**: Row counts should be accurate enough for UI display
  - Create tables with known counts (0, 100, 1000, 10000)
  - Call listTables()
  - Assert counts are within acceptable tolerance:
    - 0 rows: exact 0 or undefined
    - 100 rows: 90-110 range
    - 1000 rows: 900-1100 range
    - 10000 rows: 9000-11000 range (10% tolerance)

##### 5.3 Manual Refresh Behavior
- **Test**: getActualRowCount() should provide exact counts
  - Create table with 123 rows
  - Call getActualRowCount()
  - Assert exactly 123 returned (no tolerance)

## Test Execution

### Running Tests
```bash
# Run all tests
pnpm test

# Run integration tests only
pnpm test:integration

# Run specific adapter tests
pnpm test -- PostgresAdapter
pnpm test -- MySQLAdapter

# Run with coverage
pnpm test:coverage
```

### CI/CD Integration
Add to GitHub Actions or similar:
```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: testpass
        options: >-
          --health-cmd "mysqladmin ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:integration
```

## Coverage Goals

### Minimum Coverage Targets
- **Unit Tests**: 80% code coverage
- **Integration Tests**:
  - All adapter methods: 90% coverage
  - Connection scenarios: 80% coverage
  - Multi-DB flows: 70% coverage

### Critical Paths (Must Have 100% Coverage)
1. PostgresAdapter.listTables() - new statistics logic
2. PostgresAdapter.getActualRowCount() - new method
3. MySQLAdapter.listTables() - ensure no regressions
4. Connection/reconnection logic
5. Error handling in adapters

## Test Data Management

### Fixtures
Create reusable test fixtures:
```typescript
// __fixtures__/database-schemas.ts
export const smallSchema = {
  tables: [
    { name: 'users', rows: 100 },
    { name: 'posts', rows: 500 },
    { name: 'comments', rows: 2000 }
  ]
};

export const largeSchema = {
  tables: Array.from({ length: 100 }, (_, i) => ({
    name: `table_${i}`,
    rows: Math.floor(Math.random() * 10000)
  }))
};
```

### Cleanup
Always clean up test data:
```typescript
afterEach(async () => {
  // Drop all test tables
  await adapter.query('DROP SCHEMA IF EXISTS test CASCADE');
});
```

## Monitoring & Observability

### Metrics to Track
1. **Performance**: listTables() execution time
2. **Query Count**: Number of queries per operation
3. **Accuracy**: Deviation of row counts from actual
4. **Reliability**: Connection success/failure rates

### Logging
Add debug logging in tests:
```typescript
beforeEach(() => {
  process.env.DEBUG = 'dbview:*';
});
```

## Known Limitations & Future Work

### Current Gaps
1. No tests for SQLite adapter (not yet implemented)
2. No tests for SQL Server adapter (not yet implemented)
3. No tests for MongoDB adapter (not yet implemented)
4. Limited testing of concurrent operations
5. No load/stress testing

### Future Enhancements
1. Add stress tests for high-concurrency scenarios
2. Add tests for transaction handling
3. Add tests for query cancellation
4. Add tests for connection pooling limits
5. Add benchmarking suite for performance tracking

## References

- [PostgreSQL Statistics Documentation](https://www.postgresql.org/docs/current/monitoring-stats.html)
- [MySQL Information Schema](https://dev.mysql.com/doc/refman/8.0/en/information-schema.html)
- [VSCode Extension Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Vitest Documentation](https://vitest.dev/)
