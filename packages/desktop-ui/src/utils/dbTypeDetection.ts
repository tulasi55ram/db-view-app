/**
 * Database Type Detection Utility
 *
 * Centralized database type detection and classification logic.
 * This consolidates scattered db type detection throughout the codebase.
 */

// Database type utilities - using local type definitions for flexibility

// SQL database types
export type SqlDatabaseType = "postgres" | "mysql" | "mariadb" | "sqlserver" | "sqlite";

// Document database types
export type DocumentDatabaseType = "mongodb" | "elasticsearch" | "cassandra";

// All database types
export type AllDatabaseType = SqlDatabaseType | DocumentDatabaseType | "redis";

// Database type categories
export type DatabaseCategory = "sql" | "document" | "keyvalue";

/**
 * Valid SQL database types
 */
export const SQL_DB_TYPES: SqlDatabaseType[] = ["postgres", "mysql", "mariadb", "sqlserver", "sqlite"];

/**
 * Valid document database types
 */
export const DOCUMENT_DB_TYPES: DocumentDatabaseType[] = ["mongodb", "elasticsearch", "cassandra"];

/**
 * Check if a database type is a SQL database
 */
export function isSqlDatabase(dbType: string | undefined): dbType is SqlDatabaseType {
  if (!dbType) return false;
  return SQL_DB_TYPES.includes(dbType as SqlDatabaseType);
}

/**
 * Check if a database type is a document database
 */
export function isDocumentDatabase(dbType: string | undefined): dbType is DocumentDatabaseType {
  if (!dbType) return false;
  return DOCUMENT_DB_TYPES.includes(dbType as DocumentDatabaseType);
}

/**
 * Check if a database type is Redis (key-value)
 */
export function isRedisDatabase(dbType: string | undefined): boolean {
  return dbType === "redis";
}

/**
 * Get the category of a database type
 */
export function getDatabaseCategory(dbType: string | undefined): DatabaseCategory | null {
  if (!dbType) return null;

  if (isSqlDatabase(dbType)) return "sql";
  if (isDocumentDatabase(dbType)) return "document";
  if (isRedisDatabase(dbType)) return "keyvalue";

  return null;
}

/**
 * Extract database type from a connection key
 * Connection keys have format: "dbtype:identifier" or "dbtype:user@host:port/database"
 *
 * @param connectionKey The connection key string
 * @returns The extracted database type or null if not valid
 */
export function extractDbTypeFromConnectionKey(connectionKey: string | undefined): AllDatabaseType | null {
  if (!connectionKey || typeof connectionKey !== "string") return null;

  const colonIndex = connectionKey.indexOf(":");
  if (colonIndex === -1) return null;

  const dbType = connectionKey.substring(0, colonIndex).toLowerCase();

  // Validate it's a known database type
  if (isSqlDatabase(dbType)) return dbType;
  if (isDocumentDatabase(dbType)) return dbType;
  if (isRedisDatabase(dbType)) return "redis";

  return null;
}

/**
 * Extract SQL database type from a connection key.
 *
 * This function is specifically for SQL-only contexts. It returns null for
 * non-SQL databases (MongoDB, Redis, Elasticsearch, Cassandra) to allow
 * callers to handle them appropriately rather than silently misrouting them.
 *
 * @param connectionKey The connection key string
 * @returns The extracted SQL database type, or null if not a SQL database
 *
 * @example
 * ```typescript
 * const dbType = getSqlDbTypeFromConnectionKey(connectionKey);
 * if (!dbType) {
 *   // Handle non-SQL database (MongoDB, Redis, etc.)
 *   return;
 * }
 * // Safe to use SQL-specific logic with dbType
 * ```
 */
export function getSqlDbTypeFromConnectionKey(connectionKey: string | undefined): SqlDatabaseType | null {
  const dbType = extractDbTypeFromConnectionKey(connectionKey);

  if (dbType && isSqlDatabase(dbType)) {
    return dbType;
  }

  // Return null for non-SQL databases to prevent misrouting
  // Callers should handle null appropriately
  return null;
}

/**
 * @deprecated Use getSqlDbTypeFromConnectionKey instead, which returns null for non-SQL databases
 * instead of silently defaulting to "postgres".
 */
export function getDbTypeFromConnectionKey(connectionKey: string | undefined): SqlDatabaseType {
  return getSqlDbTypeFromConnectionKey(connectionKey) ?? "postgres";
}

/**
 * Check if a database type supports schemas
 * (e.g., PostgreSQL has schemas, MySQL uses databases as schema equivalent)
 */
export function supportsSchemas(dbType: string | undefined): boolean {
  if (!dbType) return false;

  switch (dbType) {
    case "postgres":
    case "sqlserver":
      return true;
    case "mysql":
    case "mariadb":
    case "sqlite":
      return false;
    default:
      return false;
  }
}

/**
 * Get the default schema for a database type
 */
export function getDefaultSchema(dbType: string | undefined): string {
  if (!dbType) return "public";

  switch (dbType) {
    case "postgres":
      return "public";
    case "sqlserver":
      return "dbo";
    case "mysql":
    case "mariadb":
      return ""; // MySQL uses database name, not schema
    case "sqlite":
      return "main";
    default:
      return "public";
  }
}

/**
 * Check if a database type supports LIMIT/OFFSET syntax
 */
export function supportsLimitOffset(dbType: string | undefined): boolean {
  if (!dbType) return true;

  // SQL Server uses TOP instead of LIMIT
  return dbType !== "sqlserver";
}

/**
 * Get the appropriate LIMIT syntax for a database type
 *
 * @param dbType Database type
 * @param limit Number of rows to limit
 * @returns SQL LIMIT clause or equivalent
 */
export function getLimitSyntax(dbType: string | undefined, limit: number): string {
  const safeLimit = Math.max(1, Math.min(limit, 100000)); // Ensure safe limit value

  if (dbType === "sqlserver") {
    return `TOP ${safeLimit}`;
  }

  return `LIMIT ${safeLimit}`;
}
