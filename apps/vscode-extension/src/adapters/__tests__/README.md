# Database Adapter Integration Tests

## Quick Start

### 1. Install Test Dependencies

```bash
pnpm --filter @dbview/vscode-extension add -D vitest @vitest/ui @types/node
```

### 2. Start Test Databases

```bash
# From project root
docker-compose -f docker-compose.test.yml up -d

# Verify databases are running
docker-compose -f docker-compose.test.yml ps
```

### 3. Run Tests

```bash
# From project root
pnpm --filter @dbview/vscode-extension test

# Or from vscode-extension directory
cd apps/vscode-extension
pnpm test
```

## Test Files

- **PostgresAdapter.integration.test.ts** - Tests PostgreSQL COUNT(*) performance fix
- **MySQLAdapter.integration.test.ts** - Tests MySQL adapter behavior
- **multi-db.integration.test.ts** - Cross-database comparison tests (TODO)
- **reconnection.integration.test.ts** - Connection resilience tests (TODO)

## What's Tested

### PostgreSQL Adapter ✅
- ✅ listTables() returns NULL for unanalyzed tables
- ✅ listTables() returns 0 for genuinely empty tables
- ✅ listTables() does NOT trigger COUNT(*) queries
- ✅ getActualRowCount() returns exact counts via COUNT(*)
- ✅ Performance: completes under 2 seconds for 50+ tables
- ✅ Edge cases: special characters, concurrent calls

### MySQL Adapter ✅
- ✅ listTables() returns approximate counts from information_schema
- ✅ listTables() does NOT trigger COUNT(*) queries
- ✅ countTableRows() returns exact counts with filters
- ✅ Performance: completes under 1 second for 50+ tables

### Multi-DB Comparison ⏳
- ⏳ Consistent TableInfo structure across databases
- ⏳ Performance parity between adapters
- ⏳ Edge case handling consistency

### Reconnection & Resilience ⏳
- ⏳ Reconnects after database restart
- ⏳ Handles connection loss during queries
- ⏳ Status event emission

## Coverage Target

- **PostgreSQL Adapter**: 90% coverage
- **MySQL Adapter**: 90% coverage
- **Connection logic**: 80% coverage

## Documentation

- [TESTING.md](../../TESTING.md) - Detailed testing guide
- [TEST_PLAN.md](../../TEST_PLAN.md) - Complete test plan and specifications

## Troubleshooting

### Tests won't connect
```bash
docker-compose -f docker-compose.test.yml logs postgres-test
docker-compose -f docker-compose.test.yml logs mysql-test
```

### Clean slate
```bash
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```
