/**
 * Integration tests for PostgresAdapter
 *
 * Prerequisites:
 * - PostgreSQL test database running (see docker-compose.test.yml)
 * - Environment variables set:
 *   - TEST_PG_HOST=localhost
 *   - TEST_PG_PORT=5433
 *   - TEST_PG_USER=postgres
 *   - TEST_PG_PASSWORD=testpass
 *   - TEST_PG_DATABASE=testdb
 *
 * Run tests:
 *   pnpm test -- PostgresAdapter.integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PostgresAdapter } from '../src/adapters/PostgresAdapter';
import type { PostgresConnectionConfig } from '@dbview/types';

const TEST_CONFIG: PostgresConnectionConfig = {
  dbType: 'postgres',
  host: process.env.TEST_PG_HOST || 'localhost',
  port: Number.parseInt(process.env.TEST_PG_PORT || '5433', 10),
  user: process.env.TEST_PG_USER || 'postgres',
  password: process.env.TEST_PG_PASSWORD || 'testpass',
  database: process.env.TEST_PG_DATABASE || 'testdb',
  ssl: false
};

describe('PostgresAdapter Integration Tests', () => {
  let adapter: PostgresAdapter;
  const TEST_SCHEMA = 'test_schema';

  beforeAll(async () => {
    adapter = new PostgresAdapter(TEST_CONFIG);
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  beforeEach(async () => {
    // Create fresh test schema
    await adapter.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await adapter.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
  });

  afterEach(async () => {
    // Cleanup test schema
    await adapter.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  });

  describe('listTables() - COUNT(*) Performance Fix', () => {
    it('should return NULL for unanalyzed tables', async () => {
      // Create table without ANALYZE
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.never_analyzed (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `);

      const tables = await adapter.listTables(TEST_SCHEMA);
      const table = tables.find(t => t.name === 'never_analyzed');

      expect(table).toBeDefined();
      expect(table?.rowCount).toBeUndefined();
    });

    it('should return 0 for genuinely empty tables', async () => {
      // Create empty table and analyze
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.empty_analyzed (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `);
      await adapter.query(`ANALYZE ${TEST_SCHEMA}.empty_analyzed`);

      const tables = await adapter.listTables(TEST_SCHEMA);
      const table = tables.find(t => t.name === 'empty_analyzed');

      expect(table).toBeDefined();
      expect(table?.rowCount).toBe(0);
    });

    it('should return approximate counts from statistics', async () => {
      // Create table with data and analyze
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.has_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `);
      await adapter.query(`
        INSERT INTO ${TEST_SCHEMA}.has_data (name)
        SELECT 'name_' || i FROM generate_series(1, 100) AS i
      `);
      await adapter.query(`ANALYZE ${TEST_SCHEMA}.has_data`);

      const tables = await adapter.listTables(TEST_SCHEMA);
      const table = tables.find(t => t.name === 'has_data');

      expect(table).toBeDefined();
      expect(table?.rowCount).toBeGreaterThan(0);
      expect(table?.rowCount).toBeCloseTo(100, -1); // Within 10% tolerance
    });

    it('should NOT trigger COUNT(*) queries in listTables()', async () => {
      // Create multiple tables
      for (let i = 0; i < 5; i++) {
        await adapter.query(`
          CREATE TABLE ${TEST_SCHEMA}.table_${i} (id INT)
        `);
      }

      // Mock query to track COUNT(*) calls
      const originalQuery = adapter.query.bind(adapter);
      let countQueries = 0;

      adapter.query = async function(text: string, params?: unknown[]) {
        if (text.toUpperCase().includes('COUNT(*)')) {
          countQueries++;
        }
        return originalQuery(text, params);
      } as any;

      await adapter.listTables(TEST_SCHEMA);

      expect(countQueries).toBe(0);

      // Restore original query
      adapter.query = originalQuery as any;
    });

    it('should complete quickly on large schemas', async () => {
      // Create 50 tables
      for (let i = 0; i < 50; i++) {
        await adapter.query(`
          CREATE TABLE ${TEST_SCHEMA}.large_schema_table_${i} (
            id SERIAL PRIMARY KEY,
            data TEXT
          )
        `);
      }

      const startTime = Date.now();
      const tables = await adapter.listTables(TEST_SCHEMA);
      const duration = Date.now() - startTime;

      expect(tables.length).toBe(50);
      expect(duration).toBeLessThan(2000); // Should complete under 2 seconds
    });
  });

  describe('getActualRowCount() - Manual Refresh Feature', () => {
    it('should return exact row count via COUNT(*)', async () => {
      // Create table with known row count
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.exact_count_test (
          id SERIAL PRIMARY KEY,
          value INT
        )
      `);
      await adapter.query(`
        INSERT INTO ${TEST_SCHEMA}.exact_count_test (value)
        SELECT i FROM generate_series(1, 123) AS i
      `);

      const count = await adapter.getActualRowCount(TEST_SCHEMA, 'exact_count_test');

      expect(count).toBe(123);
    });

    it('should handle empty tables correctly', async () => {
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.empty_table (id INT)
      `);

      const count = await adapter.getActualRowCount(TEST_SCHEMA, 'empty_table');

      expect(count).toBe(0);
    });

    it('should throw error on invalid table', async () => {
      await expect(
        adapter.getActualRowCount(TEST_SCHEMA, 'nonexistent_table')
      ).rejects.toThrow();
    });

    it('should handle large tables (stress test)', async () => {
      // Create table with 10k rows
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.large_table (
          id SERIAL PRIMARY KEY,
          data TEXT
        )
      `);
      await adapter.query(`
        INSERT INTO ${TEST_SCHEMA}.large_table (data)
        SELECT 'data_' || i FROM generate_series(1, 10000) AS i
      `);

      const startTime = Date.now();
      const count = await adapter.getActualRowCount(TEST_SCHEMA, 'large_table');
      const duration = Date.now() - startTime;

      expect(count).toBe(10000);
      expect(duration).toBeLessThan(5000); // Should complete under 5 seconds
    }, 10000); // Increase timeout for this test
  });

  describe('Statistics Query Correctness', () => {
    it('should distinguish NULL vs 0 correctly', async () => {
      // Setup three scenarios
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.never_analyzed (id INT)
      `);

      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.empty_analyzed (id INT)
      `);
      await adapter.query(`ANALYZE ${TEST_SCHEMA}.empty_analyzed`);

      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.has_data (id INT)
      `);
      await adapter.query(`
        INSERT INTO ${TEST_SCHEMA}.has_data
        SELECT generate_series(1, 100)
      `);
      await adapter.query(`ANALYZE ${TEST_SCHEMA}.has_data`);

      const tables = await adapter.listTables(TEST_SCHEMA);

      const neverAnalyzed = tables.find(t => t.name === 'never_analyzed');
      const emptyAnalyzed = tables.find(t => t.name === 'empty_analyzed');
      const hasData = tables.find(t => t.name === 'has_data');

      expect(neverAnalyzed?.rowCount).toBeUndefined();
      expect(emptyAnalyzed?.rowCount).toBe(0);
      expect(hasData?.rowCount).toBeGreaterThan(0);
    });

    it('should use pg_stat_user_tables when available', async () => {
      // Create table with data
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}.stats_test (id INT)
      `);
      await adapter.query(`
        INSERT INTO ${TEST_SCHEMA}.stats_test
        SELECT generate_series(1, 1000)
      `);
      await adapter.query(`ANALYZE ${TEST_SCHEMA}.stats_test`);

      // Generate some activity to populate pg_stat_user_tables
      await adapter.query(`SELECT COUNT(*) FROM ${TEST_SCHEMA}.stats_test`);

      const tables = await adapter.listTables(TEST_SCHEMA);
      const table = tables.find(t => t.name === 'stats_test');

      // Should have row count from statistics
      expect(table?.rowCount).toBeGreaterThan(900);
      expect(table?.rowCount).toBeLessThan(1100);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle tables with special characters', async () => {
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}."Table With Spaces" (id INT)
      `);
      await adapter.query(`
        CREATE TABLE ${TEST_SCHEMA}."table-with-dashes" (id INT)
      `);

      const tables = await adapter.listTables(TEST_SCHEMA);

      expect(tables.some(t => t.name === 'Table With Spaces')).toBe(true);
      expect(tables.some(t => t.name === 'table-with-dashes')).toBe(true);
    });

    it('should return empty array for schema with no tables', async () => {
      const tables = await adapter.listTables(TEST_SCHEMA);

      expect(tables).toEqual([]);
    });

    it('should handle concurrent listTables() calls', async () => {
      // Create some tables
      for (let i = 0; i < 10; i++) {
        await adapter.query(`CREATE TABLE ${TEST_SCHEMA}.concurrent_${i} (id INT)`);
      }

      // Call listTables() concurrently
      const promises = Array.from({ length: 5 }, () =>
        adapter.listTables(TEST_SCHEMA)
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
      await adapter.query(`CREATE TABLE ${TEST_SCHEMA}.conn_test (id INT)`);

      for (let i = 0; i < 10; i++) {
        const tables = await adapter.listTables(TEST_SCHEMA);
        expect(tables.length).toBeGreaterThan(0);
      }

      expect(adapter.status).toBe('connected');
    });

    it('should handle query errors gracefully', async () => {
      await expect(
        adapter.query('INVALID SQL SYNTAX')
      ).rejects.toThrow();

      // Should still be connected
      expect(adapter.status).toBe('connected');

      // Should be able to execute valid queries
      const tables = await adapter.listTables(TEST_SCHEMA);
      expect(Array.isArray(tables)).toBe(true);
    });
  });
});
