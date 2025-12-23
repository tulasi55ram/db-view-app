/**
 * Vitest setup file
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest';

// Set test environment variables if not already set
beforeAll(() => {
  process.env.NODE_ENV = 'test';

  // PostgreSQL test defaults
  process.env.TEST_PG_HOST = process.env.TEST_PG_HOST || 'localhost';
  process.env.TEST_PG_PORT = process.env.TEST_PG_PORT || '5433';
  process.env.TEST_PG_USER = process.env.TEST_PG_USER || 'postgres';
  process.env.TEST_PG_PASSWORD = process.env.TEST_PG_PASSWORD || 'testpass';
  process.env.TEST_PG_DATABASE = process.env.TEST_PG_DATABASE || 'testdb';

  // MySQL test defaults
  process.env.TEST_MYSQL_HOST = process.env.TEST_MYSQL_HOST || 'localhost';
  process.env.TEST_MYSQL_PORT = process.env.TEST_MYSQL_PORT || '3307';
  process.env.TEST_MYSQL_USER = process.env.TEST_MYSQL_USER || 'testuser';
  process.env.TEST_MYSQL_PASSWORD = process.env.TEST_MYSQL_PASSWORD || 'testpass';
  process.env.TEST_MYSQL_DATABASE = process.env.TEST_MYSQL_DATABASE || 'testdb';

  console.log('[vitest] Test environment configured');
});

afterAll(() => {
  console.log('[vitest] All tests completed');
});
