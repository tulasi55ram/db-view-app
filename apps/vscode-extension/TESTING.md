# Testing Guide for DBView VSCode Extension

## Overview

This document explains how to run integration tests for the database adapters, particularly for testing the PostgreSQL COUNT(*) performance fix and ensuring multi-database compatibility.

## Prerequisites

### 1. Install Test Dependencies

```bash
# From the vscode-extension directory
pnpm add -D vitest @vitest/ui @types/node

# Or from the root
pnpm --filter @dbview/vscode-extension add -D vitest @vitest/ui @types/node
```

### 2. Start Test Databases

The tests require PostgreSQL and MySQL test databases. Use Docker Compose to start them:

```bash
# From the project root
docker-compose -f docker-compose.test.yml up -d

# Check that databases are healthy
docker-compose -f docker-compose.test.yml ps
```

Expected output:
```
NAME                    STATUS              PORTS
dbview-postgres-test    Up (healthy)        0.0.0.0:5433->5432/tcp
dbview-mysql-test       Up (healthy)        0.0.0.0:3307->3306/tcp
```

### 3. Wait for Databases to Initialize

```bash
# Wait for PostgreSQL
docker-compose -f docker-compose.test.yml exec postgres-test pg_isready -U postgres

# Wait for MySQL
docker-compose -f docker-compose.test.yml exec mysql-test mysqladmin ping -h localhost -u testuser -ptestpass
```

## Running Tests

### Run All Tests

```bash
# From vscode-extension directory
pnpm test

# Or from root
pnpm --filter @dbview/vscode-extension test
```

### Run Specific Test Suites

```bash
# PostgreSQL adapter tests only
pnpm test -- PostgresAdapter.integration

# MySQL adapter tests only
pnpm test -- MySQLAdapter.integration

# Multi-DB comparison tests
pnpm test -- multi-db.integration
```

### Run Tests in Watch Mode

```bash
pnpm test:watch
```

### Run Tests with Coverage

```bash
pnpm test:coverage
```

Coverage report will be generated in `coverage/` directory.

### Run Tests with UI

```bash
pnpm test:ui
```

Opens Vitest UI in your browser for interactive test running.

## Test Structure

```
src/adapters/__tests__/
├── PostgresAdapter.integration.test.ts    # PostgreSQL adapter tests
├── MySQLAdapter.integration.test.ts       # MySQL adapter tests
├── multi-db.integration.test.ts           # Cross-database comparison tests
└── reconnection.integration.test.ts       # Connection resilience tests
```

## Test Categories

### 1. PostgreSQL Adapter Tests

**File**: `PostgresAdapter.integration.test.ts`

Tests the COUNT(*) performance fix:
- ✅ Returns NULL for unanalyzed tables
- ✅ Returns 0 for genuinely empty tables
- ✅ Returns approximate counts from statistics
- ✅ Does NOT trigger COUNT(*) in listTables()
- ✅ Completes quickly on large schemas (< 2 seconds)
- ✅ getActualRowCount() returns exact counts
- ✅ Handles edge cases (special characters, concurrent calls)

### 2. MySQL Adapter Tests

**File**: `MySQLAdapter.integration.test.ts`

Tests MySQL adapter behavior:
- ✅ Returns approximate counts from information_schema
- ✅ Does NOT trigger COUNT(*) in listTables()
- ✅ countTableRows() returns exact counts
- ✅ Handles filters correctly
- ✅ Completes quickly (< 1 second)

### 3. Multi-Database Comparison Tests

**File**: `multi-db.integration.test.ts`

Ensures consistent behavior across databases:
- ⏳ Both adapters implement DatabaseAdapter interface
- ⏳ listTables() returns consistent structure
- ⏳ Performance parity (both fast)
- ⏳ Edge cases handled consistently

### 4. Reconnection Tests

**File**: `reconnection.integration.test.ts`

Tests connection resilience:
- ⏳ Reconnects after database restart
- ⏳ Handles connection loss during query
- ⏳ Maintains connection pool
- ⏳ Emits status change events correctly

## Environment Variables

You can override default test database settings:

```bash
# PostgreSQL
export TEST_PG_HOST=localhost
export TEST_PG_PORT=5433
export TEST_PG_USER=postgres
export TEST_PG_PASSWORD=testpass
export TEST_PG_DATABASE=testdb

# MySQL
export TEST_MYSQL_HOST=localhost
export TEST_MYSQL_PORT=3307
export TEST_MYSQL_USER=testuser
export TEST_MYSQL_PASSWORD=testpass
export TEST_MYSQL_DATABASE=testdb

# Run tests with custom settings
pnpm test
```

## Troubleshooting

### Tests Fail to Connect

**Error**: `ECONNREFUSED` or timeout errors

**Solution**:
1. Check that Docker containers are running:
   ```bash
   docker-compose -f docker-compose.test.yml ps
   ```

2. Check container logs:
   ```bash
   docker-compose -f docker-compose.test.yml logs postgres-test
   docker-compose -f docker-compose.test.yml logs mysql-test
   ```

3. Restart containers:
   ```bash
   docker-compose -f docker-compose.test.yml down
   docker-compose -f docker-compose.test.yml up -d
   ```

### Tests Timeout

**Error**: `Test timeout exceeded`

**Solution**:
- Increase timeout in `vitest.config.ts`:
  ```typescript
  testTimeout: 60000  // 60 seconds
  ```

### Port Conflicts

**Error**: `Port already in use`

**Solution**:
- Change ports in `docker-compose.test.yml`:
  ```yaml
  ports:
    - "5434:5432"  # Use different host port
  ```
- Update environment variables accordingly

### Permission Issues

**Error**: `Permission denied`

**Solution**:
```bash
# Clean up Docker volumes
docker-compose -f docker-compose.test.yml down -v

# Restart with fresh volumes
docker-compose -f docker-compose.test.yml up -d
```

## Continuous Integration

### GitHub Actions Example

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
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432

      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: testpass
          MYSQL_DATABASE: testdb
          MYSQL_USER: testuser
          MYSQL_PASSWORD: testpass
        options: >-
          --health-cmd "mysqladmin ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 3307:3306

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter @dbview/vscode-extension test
      - run: pnpm --filter @dbview/vscode-extension test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/vscode-extension/coverage/coverage-final.json
```

## Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| PostgresAdapter | 90% | ⏳ |
| MySQLAdapter | 90% | ⏳ |
| Connection logic | 80% | ⏳ |
| Edge cases | 70% | ⏳ |

## Best Practices

### 1. Clean Up After Each Test

Always clean up test data in `afterEach`:
```typescript
afterEach(async () => {
  await adapter.query('DROP SCHEMA IF EXISTS test_schema CASCADE');
});
```

### 2. Use Descriptive Test Names

```typescript
// Good
it('should return NULL for unanalyzed tables', ...)

// Bad
it('works', ...)
```

### 3. Test One Thing Per Test

```typescript
// Good
it('should return exact count via COUNT(*)', async () => {
  // Single assertion
});

// Bad
it('should work correctly', async () => {
  // Multiple unrelated assertions
});
```

### 4. Use Realistic Test Data

```typescript
// Create tables with realistic schemas
await adapter.query(`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);
```

### 5. Document Prerequisites

Add comments explaining test setup:
```typescript
// Requires: Table with 100 rows and fresh ANALYZE
await setupTableWithData(100);
await adapter.query('ANALYZE test_table');
```

## Cleanup

Stop and remove test databases:

```bash
# Stop containers
docker-compose -f docker-compose.test.yml down

# Remove volumes (clean slate)
docker-compose -f docker-compose.test.yml down -v
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [PostgreSQL Testing Guide](https://www.postgresql.org/docs/current/regress.html)
- [MySQL Testing Best Practices](https://dev.mysql.com/doc/dev/mysql-server/latest/PAGE_TESTING.html)
- [TEST_PLAN.md](./TEST_PLAN.md) - Comprehensive test plan
