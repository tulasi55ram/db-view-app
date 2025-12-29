/**
 * Database Type Utilities
 *
 * Utilities for detecting and categorizing database types
 * to route to the appropriate UI components.
 */

import type { DatabaseType } from '@dbview/types';

/**
 * Database categories for UI routing
 */
export type DbCategory = 'sql' | 'document' | 'keyvalue';

/**
 * Document database types that use DocumentDataView
 */
export const DOCUMENT_DB_TYPES: DatabaseType[] = ['mongodb', 'elasticsearch', 'cassandra'];

/**
 * SQL database types that use SqlDataView
 */
export const SQL_DB_TYPES: DatabaseType[] = ['postgres', 'mysql', 'mariadb', 'sqlserver', 'sqlite'];

/**
 * Key-value database types that use RedisDataView
 */
export const KEYVALUE_DB_TYPES: DatabaseType[] = ['redis'];

/**
 * Extract database type from connection key
 * Connection keys are formatted as "dbType:identifier"
 * e.g., "postgres:user@host:5432/db" or "mongodb:myconnection"
 */
export function getDbTypeFromConnectionKey(connectionKey: string): DatabaseType {
  const colonIndex = connectionKey.indexOf(':');
  if (colonIndex === -1) {
    return 'postgres'; // Default fallback
  }

  const dbType = connectionKey.substring(0, colonIndex) as DatabaseType;
  return dbType;
}

/**
 * Get the UI category for a database type
 */
export function getDbCategory(dbType: DatabaseType): DbCategory {
  if (KEYVALUE_DB_TYPES.includes(dbType)) {
    return 'keyvalue';
  }
  if (DOCUMENT_DB_TYPES.includes(dbType)) {
    return 'document';
  }
  return 'sql';
}

/**
 * Get the UI category from a connection key
 */
export function getDbCategoryFromConnectionKey(connectionKey: string): DbCategory {
  const dbType = getDbTypeFromConnectionKey(connectionKey);
  return getDbCategory(dbType);
}

/**
 * Check if database type is a document database
 */
export function isDocumentDb(dbType: DatabaseType): boolean {
  return DOCUMENT_DB_TYPES.includes(dbType);
}

/**
 * Check if database type is a SQL database
 */
export function isSqlDb(dbType: DatabaseType): boolean {
  return SQL_DB_TYPES.includes(dbType);
}

/**
 * Check if database type is a key-value database
 */
export function isKeyValueDb(dbType: DatabaseType): boolean {
  return KEYVALUE_DB_TYPES.includes(dbType);
}

/**
 * Check if connection key is for a document database
 */
export function isDocumentDbConnection(connectionKey: string): boolean {
  return getDbCategoryFromConnectionKey(connectionKey) === 'document';
}

/**
 * Check if connection key is for a SQL database
 */
export function isSqlDbConnection(connectionKey: string): boolean {
  return getDbCategoryFromConnectionKey(connectionKey) === 'sql';
}

/**
 * Check if connection key is for a key-value database
 */
export function isKeyValueDbConnection(connectionKey: string): boolean {
  return getDbCategoryFromConnectionKey(connectionKey) === 'keyvalue';
}

/**
 * Sidebar terminology configuration by database type
 */
export interface SidebarTerminology {
  schemaLabel: string;
  schemaLabelPlural: string;
  tableLabel: string;
  tableLabelPlural: string;
  rowLabel: string;
  rowLabelPlural: string;
  columnLabel: string;
  columnLabelPlural: string;
}

export const SIDEBAR_TERMINOLOGY: Record<DatabaseType, SidebarTerminology> = {
  postgres: {
    schemaLabel: 'Schema',
    schemaLabelPlural: 'Schemas',
    tableLabel: 'Table',
    tableLabelPlural: 'Tables',
    rowLabel: 'row',
    rowLabelPlural: 'rows',
    columnLabel: 'Column',
    columnLabelPlural: 'Columns',
  },
  mysql: {
    schemaLabel: 'Database',
    schemaLabelPlural: 'Databases',
    tableLabel: 'Table',
    tableLabelPlural: 'Tables',
    rowLabel: 'row',
    rowLabelPlural: 'rows',
    columnLabel: 'Column',
    columnLabelPlural: 'Columns',
  },
  mariadb: {
    schemaLabel: 'Database',
    schemaLabelPlural: 'Databases',
    tableLabel: 'Table',
    tableLabelPlural: 'Tables',
    rowLabel: 'row',
    rowLabelPlural: 'rows',
    columnLabel: 'Column',
    columnLabelPlural: 'Columns',
  },
  sqlserver: {
    schemaLabel: 'Schema',
    schemaLabelPlural: 'Schemas',
    tableLabel: 'Table',
    tableLabelPlural: 'Tables',
    rowLabel: 'row',
    rowLabelPlural: 'rows',
    columnLabel: 'Column',
    columnLabelPlural: 'Columns',
  },
  sqlite: {
    schemaLabel: 'Database',
    schemaLabelPlural: 'Databases',
    tableLabel: 'Table',
    tableLabelPlural: 'Tables',
    rowLabel: 'row',
    rowLabelPlural: 'rows',
    columnLabel: 'Column',
    columnLabelPlural: 'Columns',
  },
  mongodb: {
    schemaLabel: 'Database',
    schemaLabelPlural: 'Databases',
    tableLabel: 'Collection',
    tableLabelPlural: 'Collections',
    rowLabel: 'document',
    rowLabelPlural: 'documents',
    columnLabel: 'Field',
    columnLabelPlural: 'Fields',
  },
  elasticsearch: {
    schemaLabel: 'Cluster',
    schemaLabelPlural: 'Clusters',
    tableLabel: 'Index',
    tableLabelPlural: 'Indices',
    rowLabel: 'document',
    rowLabelPlural: 'documents',
    columnLabel: 'Field',
    columnLabelPlural: 'Fields',
  },
  cassandra: {
    schemaLabel: 'Keyspace',
    schemaLabelPlural: 'Keyspaces',
    tableLabel: 'Table',
    tableLabelPlural: 'Tables',
    rowLabel: 'row',
    rowLabelPlural: 'rows',
    columnLabel: 'Column',
    columnLabelPlural: 'Columns',
  },
  redis: {
    schemaLabel: 'Database',
    schemaLabelPlural: 'Databases',
    tableLabel: 'Key',
    tableLabelPlural: 'Keys',
    rowLabel: 'key',
    rowLabelPlural: 'keys',
    columnLabel: 'Field',
    columnLabelPlural: 'Fields',
  },
};

/**
 * Get sidebar terminology for a database type
 */
export function getTerminology(dbType: DatabaseType): SidebarTerminology {
  return SIDEBAR_TERMINOLOGY[dbType] || SIDEBAR_TERMINOLOGY.postgres;
}

/**
 * Get sidebar terminology from connection key
 */
export function getTerminologyFromConnectionKey(connectionKey: string): SidebarTerminology {
  const dbType = getDbTypeFromConnectionKey(connectionKey);
  return getTerminology(dbType);
}
