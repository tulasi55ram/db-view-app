import type { DatabaseConnectionConfig } from "@dbview/core";
import type { DatabaseAdapter } from "./DatabaseAdapter";
import { PostgresAdapter } from "./PostgresAdapter";
import { MySQLAdapter } from "./MySQLAdapter";
import { SQLServerAdapter } from "./SQLServerAdapter";
import { SQLiteAdapter } from "./SQLiteAdapter";
import { MongoDBAdapter } from "./MongoDBAdapter";

/**
 * Factory for creating database adapters based on connection type
 *
 * This factory provides a centralized way to create the appropriate database adapter
 * based on the database type specified in the connection configuration.
 */
export class DatabaseAdapterFactory {
  /**
   * Create a database adapter for the given connection configuration
   *
   * @param config Database connection configuration
   * @returns Database adapter instance
   * @throws Error if database type is not supported
   */
  static create(config: DatabaseConnectionConfig): DatabaseAdapter {
    switch (config.dbType) {
      case 'postgres':
        return new PostgresAdapter(config);

      case 'mysql':
        return new MySQLAdapter(config);

      case 'sqlserver':
        return new SQLServerAdapter(config);

      case 'sqlite':
        return new SQLiteAdapter(config);

      case 'mongodb':
        return new MongoDBAdapter(config);

      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = config;
        throw new Error(`Unknown database type: ${(config as any).dbType}`);
    }
  }

  /**
   * Check if a database type is supported
   *
   * @param dbType Database type
   * @returns true if supported, false otherwise
   */
  static isSupported(dbType: string): boolean {
    const supportedTypes = ['postgres', 'mysql', 'sqlserver', 'sqlite', 'mongodb'];
    return supportedTypes.includes(dbType);
  }

  /**
   * Get list of supported database types
   *
   * @returns Array of supported database type strings
   */
  static getSupportedTypes(): string[] {
    return ['postgres', 'mysql', 'sqlserver', 'sqlite', 'mongodb'];
  }

  /**
   * Get list of currently implemented database types
   *
   * @returns Array of implemented database type strings
   */
  static getImplementedTypes(): string[] {
    return ['postgres', 'mysql', 'sqlserver', 'sqlite', 'mongodb'];
  }
}
