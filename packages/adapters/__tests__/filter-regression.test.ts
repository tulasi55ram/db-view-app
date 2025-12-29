/**
 * Regression tests for filter handling bugs
 *
 * CRITICAL BUG FIXED:
 * - buildWhereClause only handled 'in' operator when value is an array
 * - UI sends comma-separated strings for 'in' operator
 * - This caused empty WHERE clauses and silently dropped filters
 * - Result: Invalid SQL like "SELECT * FROM table WHERE LIMIT 100"
 *
 * This test file ensures the fix remains working.
 *
 * Run: pnpm test -- filter-regression
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MySQLAdapter } from '../src/adapters/MySQLAdapter';
import { PostgresAdapter } from '../src/adapters/PostgresAdapter';
import type { MySQLConnectionConfig, PostgresConnectionConfig } from '@dbview/types';

const MYSQL_CONFIG: MySQLConnectionConfig = {
  dbType: 'mysql',
  host: process.env.TEST_MYSQL_HOST || 'localhost',
  port: Number.parseInt(process.env.TEST_MYSQL_PORT || '3307', 10),
  user: process.env.TEST_MYSQL_USER || 'testuser',
  password: process.env.TEST_MYSQL_PASSWORD || 'testpass',
  database: process.env.TEST_MYSQL_DATABASE || 'testdb'
};

const POSTGRES_CONFIG: PostgresConnectionConfig = {
  dbType: 'postgres',
  host: process.env.TEST_PG_HOST || 'localhost',
  port: Number.parseInt(process.env.TEST_PG_PORT || '5433', 10),
  user: process.env.TEST_PG_USER || 'postgres',
  password: process.env.TEST_PG_PASSWORD || 'testpass',
  database: process.env.TEST_PG_DATABASE || 'testdb',
  ssl: false
};

describe('Filter Regression Tests - IN operator with comma-separated strings', () => {
  describe('MySQLAdapter', () => {
    let adapter: MySQLAdapter;
    const TEST_TABLE = 'filter_test';

    beforeAll(async () => {
      adapter = new MySQLAdapter(MYSQL_CONFIG);
      await adapter.connect();

      // Create test table and data
      await adapter.runQuery(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
      await adapter.runQuery(`
        CREATE TABLE ${TEST_TABLE} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          status VARCHAR(20),
          category VARCHAR(50)
        )
      `);
      await adapter.runQuery(`
        INSERT INTO ${TEST_TABLE} (status, category)
        VALUES
          ('active', 'A'),
          ('active', 'B'),
          ('inactive', 'A'),
          ('pending', 'C'),
          ('active', 'D')
      `);
    });

    afterAll(async () => {
      await adapter.runQuery(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
      await adapter.disconnect();
    });

    it('should handle IN operator with comma-separated string (UI format)', async () => {
      // This is how the UI sends the filter - as a comma-separated string
      const result = await adapter.fetchTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        0,
        100,
        [
          {
            columnName: 'status',
            operator: 'in',
            value: 'active,pending' // String, not array!
          }
        ]
      );

      expect(result.rows.length).toBe(4); // 3 active + 1 pending
      expect(result.rows.every((r: any) =>
        r.status === 'active' || r.status === 'pending'
      )).toBe(true);
    });

    it('should handle IN operator with array (programmatic format)', async () => {
      // This is the array format that previously worked
      const result = await adapter.fetchTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        0,
        100,
        [
          {
            columnName: 'status',
            operator: 'in',
            value: ['active', 'pending']
          }
        ]
      );

      expect(result.rows.length).toBe(4); // 3 active + 1 pending
    });

    it('should handle IN operator with single value string', async () => {
      const result = await adapter.fetchTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        0,
        100,
        [
          {
            columnName: 'status',
            operator: 'in',
            value: 'active' // Single value as string
          }
        ]
      );

      expect(result.rows.length).toBe(3); // 3 active
      expect(result.rows.every((r: any) => r.status === 'active')).toBe(true);
    });

    it('should handle IN operator with whitespace in comma-separated string', async () => {
      const result = await adapter.fetchTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        0,
        100,
        [
          {
            columnName: 'category',
            operator: 'in',
            value: ' A , B , C ' // Whitespace around values
          }
        ]
      );

      expect(result.rows.length).toBe(4); // 2 A + 1 B + 1 C
    });

    it('should return correct count with IN filter (comma-separated)', async () => {
      const count = await adapter.countTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        [
          {
            columnName: 'status',
            operator: 'in',
            value: 'active,pending'
          }
        ]
      );

      expect(count).toBe(4);
    });

    it('should not produce invalid SQL with empty IN clause', async () => {
      // Edge case: empty string should not crash
      const result = await adapter.fetchTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        0,
        100,
        [
          {
            columnName: 'status',
            operator: 'in',
            value: '' // Empty string
          }
        ]
      );

      // Empty IN clause should be silently ignored, return all rows
      expect(result.rows.length).toBe(5);
    });

    it('should handle multiple filters with IN operator', async () => {
      const result = await adapter.fetchTableRows(
        MYSQL_CONFIG.database,
        TEST_TABLE,
        0,
        100,
        [
          {
            columnName: 'status',
            operator: 'in',
            value: 'active,pending'
          },
          {
            columnName: 'category',
            operator: 'in',
            value: 'A,B'
          }
        ],
        'AND'
      );

      // active+A, active+B = 2 rows
      expect(result.rows.length).toBe(2);
      expect(result.rows.every((r: any) =>
        (r.status === 'active' || r.status === 'pending') &&
        (r.category === 'A' || r.category === 'B')
      )).toBe(true);
    });
  });

  describe('PostgresAdapter', () => {
    let adapter: PostgresAdapter;
    const TEST_SCHEMA = 'filter_test_schema';
    const TEST_TABLE = 'filter_test';

    beforeAll(async () => {
      adapter = new PostgresAdapter(POSTGRES_CONFIG);
      await adapter.connect();

      // Create test schema and table
      await adapter.runQuery(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
      await adapter.runQuery(`CREATE SCHEMA ${TEST_SCHEMA}`);
      await adapter.runQuery(`
        CREATE TABLE ${TEST_SCHEMA}.${TEST_TABLE} (
          id SERIAL PRIMARY KEY,
          status VARCHAR(20),
          category VARCHAR(50)
        )
      `);
      await adapter.runQuery(`
        INSERT INTO ${TEST_SCHEMA}.${TEST_TABLE} (status, category)
        VALUES
          ('active', 'A'),
          ('active', 'B'),
          ('inactive', 'A'),
          ('pending', 'C'),
          ('active', 'D')
      `);
    });

    afterAll(async () => {
      await adapter.runQuery(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
      await adapter.disconnect();
    });

    it('should handle IN operator with comma-separated string (UI format)', async () => {
      const result = await adapter.fetchTableRows(
        TEST_SCHEMA,
        TEST_TABLE,
        {
          limit: 100,
          offset: 0,
          filters: [
            {
              columnName: 'status',
              operator: 'in',
              value: 'active,pending' // String, not array!
            }
          ]
        }
      );

      expect(result.rows.length).toBe(4); // 3 active + 1 pending
    });

    it('should handle IN operator with array (programmatic format)', async () => {
      const result = await adapter.fetchTableRows(
        TEST_SCHEMA,
        TEST_TABLE,
        {
          filters: [
            {
              columnName: 'status',
              operator: 'in',
              value: ['active', 'pending']
            }
          ]
        }
      );

      expect(result.rows.length).toBe(4);
    });

    it('should handle IN operator with whitespace', async () => {
      const result = await adapter.fetchTableRows(
        TEST_SCHEMA,
        TEST_TABLE,
        {
          filters: [
            {
              columnName: 'category',
              operator: 'in',
              value: ' A , B , C '
            }
          ]
        }
      );

      expect(result.rows.length).toBe(4);
    });

    it('should return correct count with IN filter', async () => {
      const count = await adapter.getTableRowCount(
        TEST_SCHEMA,
        TEST_TABLE,
        {
          filters: [
            {
              columnName: 'status',
              operator: 'in',
              value: 'active,pending'
            }
          ]
        }
      );

      expect(count).toBe(4);
    });
  });
});
