/**
 * Integration tests for MySQLAdapter
 *
 * Prerequisites:
 * - MySQL test database running (see docker-compose.test.yml)
 * - Environment variables set:
 *   - TEST_MYSQL_HOST=localhost
 *   - TEST_MYSQL_PORT=3307
 *   - TEST_MYSQL_USER=testuser
 *   - TEST_MYSQL_PASSWORD=testpass
 *   - TEST_MYSQL_DATABASE=testdb
 *
 * Run tests:
 *   pnpm test -- MySQLAdapter.integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MySQLAdapter } from '../MySQLAdapter';
import type { MySQLConnectionConfig } from '@dbview/core';

const TEST_CONFIG: MySQLConnectionConfig = {
  dbType: 'mysql',
  host: process.env.TEST_MYSQL_HOST || 'localhost',
  port: Number.parseInt(process.env.TEST_MYSQL_PORT || '3307', 10),
  user: process.env.TEST_MYSQL_USER || 'testuser',
  password: process.env.TEST_MYSQL_PASSWORD || 'testpass',
  database: process.env.TEST_MYSQL_DATABASE || 'testdb'
};

describe('MySQLAdapter Integration Tests', () => {
  let adapter: MySQLAdapter;

  beforeAll(async () => {
    adapter = new MySQLAdapter(TEST_CONFIG);
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  afterEach(async () => {
    // Cleanup all test tables
    const tables = await adapter.listTables(TEST_CONFIG.database);
    for (const table of tables) {
      await adapter.execute(`DROP TABLE IF EXISTS ${adapter.quoteIdentifier(table.name)}`);
    }
  });

  describe('listTables() - Information Schema Approach', () => {
    it('should return approximate counts from information_schema', async () => {
      // Create table with data
      await adapter.execute(`
        CREATE TABLE test_approximate (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100)
        )
      `);
      await adapter.execute(`
        INSERT INTO test_approximate (name)
        VALUES ${Array.from({ length: 100 }, (_, i) => `('name_${i}')`).join(',')}
      `);

      const tables = await adapter.listTables(TEST_CONFIG.database);
      const table = tables.find(t => t.name === 'test_approximate');

      expect(table).toBeDefined();
      // MySQL information_schema.table_rows is approximate, allow 10% tolerance
      expect(table?.rowCount).toBeGreaterThan(90);
      expect(table?.rowCount).toBeLessThan(110);
    });

    it('should NOT trigger COUNT(*) queries in listTables()', async () => {
      // Create multiple tables
      for (let i = 0; i < 5; i++) {
        await adapter.execute(`CREATE TABLE test_no_count_${i} (id INT)`);
      }

      // Mock execute to track COUNT(*) calls
      const originalExecute = adapter.execute.bind(adapter);
      let countQueries = 0;

      adapter.execute = async function(sql: string, params?: unknown[]) {
        if (sql.toUpperCase().includes('COUNT(*)')) {
          countQueries++;
        }
        return originalExecute(sql, params);
      } as any;

      await adapter.listTables(TEST_CONFIG.database);

      expect(countQueries).toBe(0);

      // Restore original execute
      adapter.execute = originalExecute as any;
    });

    it('should handle empty tables', async () => {
      await adapter.execute(`
        CREATE TABLE test_empty (
          id INT AUTO_INCREMENT PRIMARY KEY,
          value TEXT
        )
      `);

      const tables = await adapter.listTables(TEST_CONFIG.database);
      const table = tables.find(t => t.name === 'test_empty');

      expect(table).toBeDefined();
      // Empty tables should show 0 or undefined
      expect(table?.rowCount === 0 || table?.rowCount === undefined).toBe(true);
    });

    it('should complete quickly on many tables', async () => {
      // Create 50 tables
      for (let i = 0; i < 50; i++) {
        await adapter.execute(`
          CREATE TABLE test_many_tables_${i} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            data TEXT
          )
        `);
      }

      const startTime = Date.now();
      const tables = await adapter.listTables(TEST_CONFIG.database);
      const duration = Date.now() - startTime;

      expect(tables.length).toBe(50);
      expect(duration).toBeLessThan(2000); // Should complete under 2 seconds
    });
  });

  describe('countTableRows() - Exact Count Method', () => {
    it('should return exact count via COUNT(*)', async () => {
      await adapter.execute(`
        CREATE TABLE test_exact_count (
          id INT AUTO_INCREMENT PRIMARY KEY,
          value INT
        )
      `);
      await adapter.execute(`
        INSERT INTO test_exact_count (value)
        VALUES ${Array.from({ length: 123 }, (_, i) => `(${i})`).join(',')}
      `);

      const count = await adapter.countTableRows(TEST_CONFIG.database, 'test_exact_count');

      expect(count).toBe(123);
    });

    it('should handle filters correctly', async () => {
      await adapter.execute(`
        CREATE TABLE test_filtered_count (
          id INT AUTO_INCREMENT PRIMARY KEY,
          status VARCHAR(20)
        )
      `);
      await adapter.execute(`
        INSERT INTO test_filtered_count (status)
        VALUES ${ Array.from({ length: 50 }, () => "('active')").join(',')},
               ${Array.from({ length: 30 }, () => "('inactive')").join(',')}
      `);

      const totalCount = await adapter.countTableRows(TEST_CONFIG.database, 'test_filtered_count');
      expect(totalCount).toBe(80);

      const filteredCount = await adapter.countTableRows(
        TEST_CONFIG.database,
        'test_filtered_count',
        [{ column: 'status', operator: '=', value: 'active' }]
      );
      expect(filteredCount).toBe(50);
    });

    it('should handle empty tables', async () => {
      await adapter.execute(`CREATE TABLE test_count_empty (id INT)`);

      const count = await adapter.countTableRows(TEST_CONFIG.database, 'test_count_empty');

      expect(count).toBe(0);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle tables with special characters', async () => {
      await adapter.execute('CREATE TABLE `table-with-dashes` (id INT)');
      await adapter.execute('CREATE TABLE `table_with_underscores` (id INT)');

      const tables = await adapter.listTables(TEST_CONFIG.database);

      expect(tables.some(t => t.name === 'table-with-dashes')).toBe(true);
      expect(tables.some(t => t.name === 'table_with_underscores')).toBe(true);
    });

    it('should return empty array for database with no tables', async () => {
      // All tables cleaned up by afterEach
      const tables = await adapter.listTables(TEST_CONFIG.database);

      expect(tables).toEqual([]);
    });

    it('should handle concurrent listTables() calls', async () => {
      // Create some tables
      for (let i = 0; i < 10; i++) {
        await adapter.execute(`CREATE TABLE test_concurrent_${i} (id INT)`);
      }

      // Call listTables() concurrently
      const promises = Array.from({ length: 5 }, () =>
        adapter.listTables(TEST_CONFIG.database)
      );

      const results = await Promise.all(promises);

      // All should return same results
      results.forEach(tables => {
        expect(tables.length).toBe(10);
      });
    });
  });

  describe('Connection & Reconnection', () => {
    it('should maintain connection after multiple queries', async () => {
      await adapter.execute('CREATE TABLE test_conn (id INT)');

      for (let i = 0; i < 10; i++) {
        const tables = await adapter.listTables(TEST_CONFIG.database);
        expect(tables.length).toBeGreaterThan(0);
      }

      expect(adapter.status).toBe('connected');
    });

    it('should handle query errors gracefully', async () => {
      await expect(
        adapter.execute('INVALID SQL SYNTAX')
      ).rejects.toThrow();

      // Should still be connected
      expect(adapter.status).toBe('connected');

      // Should be able to execute valid queries
      const tables = await adapter.listTables(TEST_CONFIG.database);
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  describe('Performance Comparison with PostgreSQL', () => {
    it('should list tables as quickly as PostgreSQL', async () => {
      // Create 30 tables
      for (let i = 0; i < 30; i++) {
        await adapter.execute(`
          CREATE TABLE test_perf_${i} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            data TEXT
          )
        `);
      }

      const startTime = Date.now();
      const tables = await adapter.listTables(TEST_CONFIG.database);
      const duration = Date.now() - startTime;

      expect(tables.length).toBe(30);
      expect(duration).toBeLessThan(1000); // MySQL should be very fast
    });
  });
});
