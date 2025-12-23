import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SQLServerConnectionConfig } from '@dbview/core';
import { SQLServerAdapter } from './SQLServerAdapter';

/**
 * Integration tests for SQLServerAdapter
 *
 * Prerequisites:
 * - SQL Server running on localhost:1433
 * - Database: dbview_dev
 * - User: sa
 * - Password: DbView123!
 *
 * Run Docker container:
 *   docker-compose up -d sqlserver
 *
 * Or use test environment:
 *   docker-compose -f docker-compose.test.yml up -d sqlserver
 */
describe('SQLServerAdapter Integration Tests', () => {
  let adapter: SQLServerAdapter;

  const config: SQLServerConnectionConfig = {
    dbType: 'sqlserver',
    host: 'localhost',
    port: 1433,
    user: 'sa',
    password: 'DbView123!',
    database: 'dbview_dev',
    authenticationType: 'sql',
    encrypt: true,
    trustServerCertificate: true,
  };

  beforeAll(async () => {
    adapter = new SQLServerAdapter(config);
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  describe('Connection Management', () => {
    it('should test connection successfully', async () => {
      const result = await adapter.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('SQL Server');
    });

    it('should ping database successfully', async () => {
      const result = await adapter.ping();
      expect(result).toBe(true);
    });

    it('should have connected status', () => {
      expect(adapter.status).toBe('connected');
    });
  });

  describe('Hierarchy & Discovery', () => {
    it('should get database hierarchy', async () => {
      const hierarchy = await adapter.getHierarchy();
      expect(hierarchy.type).toBe('schema-based');
      expect(hierarchy.levels).toContain('schema');
      expect(hierarchy.levels).toContain('table');
    });

    it('should list schemas', async () => {
      const schemas = await adapter.listSchemas();
      expect(schemas).toBeInstanceOf(Array);
      expect(schemas).toContain('dbo'); // Default schema
      // Should not contain system schemas
      expect(schemas).not.toContain('sys');
      expect(schemas).not.toContain('INFORMATION_SCHEMA');
    });

    it('should list databases', async () => {
      const databases = await adapter.listDatabases();
      expect(databases).toBeInstanceOf(Array);
      expect(databases).toContain('dbview_dev');
      // Should not contain system databases
      expect(databases).not.toContain('master');
      expect(databases).not.toContain('tempdb');
    });
  });

  describe('Table Operations', () => {
    it('should list tables in dbo schema', async () => {
      const tables = await adapter.listTables('dbo');
      expect(tables).toBeInstanceOf(Array);
      expect(tables.length).toBeGreaterThan(0);

      const userTable = tables.find((t) => t.name === 'users');
      expect(userTable).toBeDefined();
      expect(userTable?.name).toBe('users');
    });

    it('should get table metadata for users table', async () => {
      const metadata = await adapter.getTableMetadata('dbo', 'users');
      expect(metadata).toBeInstanceOf(Array);
      expect(metadata.length).toBeGreaterThan(0);

      const idColumn = metadata.find((col) => col.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn?.isPrimaryKey).toBe(true);
      expect(idColumn?.isAutoIncrement).toBe(true);

      const emailColumn = metadata.find((col) => col.name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn?.nullable).toBe(false);
    });

    it('should list columns in users table', async () => {
      const columns = await adapter.listColumns('dbo', 'users');
      expect(columns).toBeInstanceOf(Array);
      expect(columns.length).toBeGreaterThan(0);

      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('role');
    });

    it('should fetch table rows with pagination', async () => {
      const result = await adapter.fetchTableRows('dbo', 'users', {
        limit: 10,
        offset: 0,
      });

      expect(result.columns).toBeInstanceOf(Array);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.columns.length).toBeGreaterThan(0);
      expect(result.rows.length).toBeLessThanOrEqual(10);

      if (result.rows.length > 0) {
        expect(result.rows[0]).toHaveProperty('email');
        expect(result.rows[0]).toHaveProperty('name');
      }
    });

    it('should get table row count', async () => {
      const count = await adapter.getTableRowCount('dbo', 'users');
      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should get actual row count', async () => {
      const count = await adapter.getActualRowCount('dbo', 'users');
      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should get table statistics', async () => {
      const stats = await adapter.getTableStatistics('dbo', 'users');
      expect(stats).toBeDefined();
      expect(stats.rowCount).toBeGreaterThan(0);
      expect(stats.totalSize).toBeDefined();
      expect(stats.tableSize).toBeDefined();
    });
  });

  describe('Query Execution', () => {
    it('should run simple SELECT query', async () => {
      const result = await adapter.runQuery('SELECT TOP 5 * FROM users');
      expect(result.columns).toBeInstanceOf(Array);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.rows.length).toBeLessThanOrEqual(5);
    });

    it('should run COUNT query', async () => {
      const result = await adapter.runQuery('SELECT COUNT(*) as count FROM users');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('count');
      expect(typeof result.rows[0].count).toBe('number');
    });

    it('should run query with WHERE clause', async () => {
      const result = await adapter.runQuery("SELECT * FROM users WHERE role = 'admin'");
      expect(result.rows).toBeInstanceOf(Array);
      if (result.rows.length > 0) {
        expect(result.rows[0].role).toBe('admin');
      }
    });
  });

  describe('CRUD Operations', () => {
    it('should insert a new row', async () => {
      const newUser = {
        email: `test_${Date.now()}@example.com`,
        name: 'Test User',
        role: 'user',
        is_active: true,
      };

      const inserted = await adapter.insertRow('dbo', 'users', newUser);
      expect(inserted).toBeDefined();
      expect(inserted.email).toBe(newUser.email);
      expect(inserted.name).toBe(newUser.name);
      expect(inserted).toHaveProperty('id');
      expect(typeof inserted.id).toBe('number');
    });

    it('should update a cell value', async () => {
      // First, insert a test row
      const testUser = {
        email: `update_test_${Date.now()}@example.com`,
        name: 'Update Test',
        role: 'user',
        is_active: true,
      };

      const inserted = await adapter.insertRow('dbo', 'users', testUser);
      const userId = inserted.id;

      // Update the name
      await adapter.updateCell('dbo', 'users', { id: userId }, 'name', 'Updated Name');

      // Verify the update
      const result = await adapter.runQuery(`SELECT name FROM users WHERE id = ${userId}`);
      expect(result.rows[0].name).toBe('Updated Name');
    });

    it('should delete rows by primary key', async () => {
      // Insert test rows
      const testUser1 = {
        email: `delete_test1_${Date.now()}@example.com`,
        name: 'Delete Test 1',
        role: 'user',
        is_active: true,
      };

      const testUser2 = {
        email: `delete_test2_${Date.now()}@example.com`,
        name: 'Delete Test 2',
        role: 'user',
        is_active: true,
      };

      const inserted1 = await adapter.insertRow('dbo', 'users', testUser1);
      const inserted2 = await adapter.insertRow('dbo', 'users', testUser2);

      // Delete both rows
      const deletedCount = await adapter.deleteRows('dbo', 'users', [
        { id: inserted1.id },
        { id: inserted2.id },
      ]);

      expect(deletedCount).toBe(2);

      // Verify deletion
      const result = await adapter.runQuery(
        `SELECT COUNT(*) as count FROM users WHERE id IN (${inserted1.id}, ${inserted2.id})`
      );
      expect(result.rows[0].count).toBe(0);
    });
  });

  describe('Filtering', () => {
    it('should filter rows with equals operator', async () => {
      const result = await adapter.fetchTableRows('dbo', 'users', {
        limit: 100,
        offset: 0,
        filters: [{ id: '1', columnName: 'role', operator: 'equals', value: 'admin' }],
        filterLogic: 'AND',
      });

      expect(result.rows).toBeInstanceOf(Array);
      result.rows.forEach((row) => {
        expect(row.role).toBe('admin');
      });
    });

    it('should filter rows with contains operator', async () => {
      const result = await adapter.fetchTableRows('dbo', 'users', {
        limit: 100,
        offset: 0,
        filters: [{ id: '1', columnName: 'email', operator: 'contains', value: 'example.com' }],
        filterLogic: 'AND',
      });

      expect(result.rows).toBeInstanceOf(Array);
      result.rows.forEach((row) => {
        expect(String(row.email)).toContain('example.com');
      });
    });

    it('should filter rows with is_null operator', async () => {
      const result = await adapter.fetchTableRows('dbo', 'users', {
        limit: 100,
        offset: 0,
        filters: [{ id: '1', columnName: 'metadata', operator: 'is_null', value: null }],
        filterLogic: 'AND',
      });

      expect(result.rows).toBeInstanceOf(Array);
      result.rows.forEach((row) => {
        expect(row.metadata).toBeNull();
      });
    });

    it('should filter rows with multiple conditions (AND)', async () => {
      const result = await adapter.fetchTableRows('dbo', 'users', {
        limit: 100,
        offset: 0,
        filters: [
          { id: '1', columnName: 'role', operator: 'equals', value: 'user' },
          { id: '2', columnName: 'is_active', operator: 'equals', value: true },
        ],
        filterLogic: 'AND',
      });

      expect(result.rows).toBeInstanceOf(Array);
      result.rows.forEach((row) => {
        expect(row.role).toBe('user');
        expect(row.is_active).toBe(true);
      });
    });
  });

  describe('Metadata Operations', () => {
    it('should get database info', async () => {
      const info = await adapter.getDatabaseInfo();
      expect(info).toBeDefined();
      expect(info.version).toBeDefined();
      expect(info.databaseName).toBe('dbview_dev');
      expect(info.size).toBeDefined();
      expect(typeof info.tableCount).toBe('number');
    });

    it('should get database size', async () => {
      const size = await adapter.getDatabaseSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });

    it('should get object counts for schema', async () => {
      const counts = await adapter.getObjectCounts('dbo');
      expect(counts).toBeDefined();
      expect(typeof counts.tables).toBe('number');
      expect(typeof counts.views).toBe('number');
      expect(counts.tables).toBeGreaterThan(0);
    });

    it('should list views', async () => {
      const views = await adapter.listViews('dbo');
      expect(views).toBeInstanceOf(Array);
      expect(views).toContain('user_order_summary');
    });

    it('should get indexes for table', async () => {
      const indexes = await adapter.getIndexes('dbo', 'users');
      expect(indexes).toBeInstanceOf(Array);

      // Should have at least a primary key index
      const pkIndex = indexes.find((idx) => idx.isPrimary);
      expect(pkIndex).toBeDefined();
    });
  });

  describe('SQL Helpers', () => {
    it('should quote identifiers with square brackets', () => {
      expect(adapter.quoteIdentifier('table')).toBe('[table]');
      expect(adapter.quoteIdentifier('my_column')).toBe('[my_column]');
      expect(adapter.quoteIdentifier('user]name')).toBe('[user]]name]'); // Escape closing bracket
    });

    it('should format parameters correctly', () => {
      expect(adapter.formatParameter(1)).toBe('@param1');
      expect(adapter.formatParameter(5)).toBe('@param5');
    });

    it('should build WHERE clause correctly', () => {
      const { whereClause, params } = adapter.buildWhereClause(
        [
          { id: '1', columnName: 'email', operator: 'equals', value: 'test@example.com' },
          { id: '2', columnName: 'role', operator: 'equals', value: 'admin' },
        ],
        'AND'
      );

      expect(whereClause).toContain('[email]');
      expect(whereClause).toContain('[role]');
      expect(whereClause).toContain('AND');
      expect(Object.keys(params).length).toBe(2);
      expect(Object.values(params)).toContain('test@example.com');
      expect(Object.values(params)).toContain('admin');
    });
  });

  describe('Event Emitters', () => {
    it('should emit statusChange events', async () => {
      const testAdapter = new SQLServerAdapter(config);

      let statusChanges: string[] = [];
      testAdapter.on('statusChange', (event) => {
        statusChanges.push(event.status);
      });

      await testAdapter.connect();
      expect(statusChanges).toContain('connecting');
      expect(statusChanges).toContain('connected');

      await testAdapter.disconnect();
      expect(statusChanges).toContain('disconnected');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection test failure with invalid credentials', async () => {
      const invalidConfig: SQLServerConnectionConfig = {
        ...config,
        password: 'wrong_password',
      };

      const testAdapter = new SQLServerAdapter(invalidConfig);
      const result = await testAdapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.message.toLowerCase()).toContain('authentication');
    });

    it('should handle connection test failure with invalid host', async () => {
      const invalidConfig: SQLServerConnectionConfig = {
        ...config,
        host: 'nonexistent.host',
      };

      const testAdapter = new SQLServerAdapter(invalidConfig);
      const result = await testAdapter.testConnection();

      expect(result.success).toBe(false);
    });

    it('should handle query error gracefully', async () => {
      await expect(adapter.runQuery('SELECT * FROM nonexistent_table')).rejects.toThrow();
    });
  });
});
