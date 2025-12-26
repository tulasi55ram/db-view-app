import type { DatabaseConnectionConfig } from "@dbview/core";
import type { DatabaseAdapter } from "../adapters/DatabaseAdapter";
import { DatabaseAdapterFactory } from "../adapters/DatabaseAdapterFactory";
import {
  getAllConnections,
  saveConnection,
  deleteConnectionConfig,
  getActiveConnectionName,
  setActiveConnectionName,
  type StoredConnectionConfig,
} from "./SettingsStore";
import { passwordStore } from "./PasswordStore";

export interface ConnectionWithStatus {
  config: StoredConnectionConfig;
  status: "connected" | "disconnected" | "connecting" | "error";
  error?: string;
}

/**
 * ConnectionManager - Manages multiple database connections
 *
 * Handles:
 * - Connection lifecycle (create, connect, disconnect)
 * - Adapter caching and reuse
 * - Health checks
 * - Password retrieval from secure storage
 */
export class ConnectionManager {
  private adapters: Map<string, DatabaseAdapter> = new Map();
  private connectionStatus: Map<string, ConnectionWithStatus["status"]> = new Map();

  /**
   * Get unique key for a connection config
   */
  getConnectionKey(config: DatabaseConnectionConfig | StoredConnectionConfig): string {
    const dbType = config.dbType || "postgres";

    if (config.name) {
      return `${dbType}:${config.name}`;
    }

    switch (dbType) {
      case "sqlite":
        return `${dbType}:${(config as any).filePath}`;
      case "mongodb":
        if ((config as any).connectionString) {
          return `${dbType}:${(config as any).connectionString}`;
        }
        return `${dbType}:${(config as any).user || "anonymous"}@${(config as any).host || "localhost"}:${(config as any).port || 27017}/${(config as any).database}`;
      case "redis":
        return `${dbType}:${(config as any).host || "localhost"}:${(config as any).port || 6379}/${(config as any).database || 0}`;
      case "postgres":
      case "mysql":
      case "sqlserver":
        return `${dbType}:${(config as any).user}@${(config as any).host}:${(config as any).port}/${(config as any).database}`;
      default:
        return `${dbType}:${JSON.stringify(config)}`;
    }
  }

  /**
   * Get all saved connections with their current status
   */
  async getConnectionsWithStatus(): Promise<ConnectionWithStatus[]> {
    const connections = getAllConnections();
    return connections.map((config) => ({
      config,
      status: this.connectionStatus.get(this.getConnectionKey(config as any)) || "disconnected",
    }));
  }

  /**
   * Get a full connection config with password from secure storage
   */
  async getFullConnectionConfig(storedConfig: StoredConnectionConfig): Promise<DatabaseConnectionConfig> {
    // For databases that need passwords
    if ("host" in storedConfig && storedConfig.name) {
      const password = await passwordStore.getPassword(storedConfig.name);
      return {
        ...storedConfig,
        password: password || "",
      } as DatabaseConnectionConfig;
    }

    return storedConfig as DatabaseConnectionConfig;
  }

  /**
   * Save a connection (password stored separately in keychain)
   */
  async saveConnectionConfig(config: DatabaseConnectionConfig): Promise<void> {
    // Extract password for secure storage
    if ("password" in config && config.password && config.name) {
      await passwordStore.setPassword(config.name, config.password);
    }

    // Store config without password
    const { password, ...configWithoutPassword } = config as any;
    saveConnection(configWithoutPassword);
  }

  /**
   * Delete a connection and its stored password
   */
  async deleteConnection(name: string): Promise<void> {
    // Disconnect if connected
    const connections = getAllConnections();
    const config = connections.find((c) => c.name === name);
    if (config) {
      const key = this.getConnectionKey(config as any);
      await this.disconnect(key);
    }

    // Delete password from keychain
    await passwordStore.deletePassword(name);

    // Delete from settings
    deleteConnectionConfig(name);
  }

  /**
   * Get or create an adapter for a connection
   */
  async getOrCreateAdapter(config: DatabaseConnectionConfig | StoredConnectionConfig): Promise<DatabaseAdapter> {
    const key = this.getConnectionKey(config as any);

    // Return existing adapter if available and connected
    const existing = this.adapters.get(key);
    if (existing && existing.status === "connected") {
      return existing;
    }

    // Get full config with password
    const fullConfig = await this.getFullConnectionConfig(config as StoredConnectionConfig);

    // Create new adapter
    this.connectionStatus.set(key, "connecting");
    const adapter = DatabaseAdapterFactory.create(fullConfig);

    try {
      await adapter.connect();
      this.adapters.set(key, adapter);
      this.connectionStatus.set(key, "connected");

      // Start health checks
      adapter.startHealthCheck();

      // Listen for status changes
      adapter.on("statusChange", (event) => {
        this.connectionStatus.set(key, event.status === "connected" ? "connected" : "disconnected");
      });

      return adapter;
    } catch (error) {
      this.connectionStatus.set(key, "error");
      throw error;
    }
  }

  /**
   * Get adapter for a connection key (if exists)
   */
  getAdapter(connectionKey: string): DatabaseAdapter | undefined {
    return this.adapters.get(connectionKey);
  }

  /**
   * Disconnect a specific connection
   */
  async disconnect(connectionKey: string): Promise<void> {
    const adapter = this.adapters.get(connectionKey);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(connectionKey);
      this.connectionStatus.set(connectionKey, "disconnected");
    }
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.entries()).map(async ([key, adapter]) => {
      try {
        await adapter.disconnect();
        this.connectionStatus.set(key, "disconnected");
      } catch (error) {
        console.error(`Failed to disconnect ${key}:`, error);
      }
    });

    await Promise.all(disconnectPromises);
    this.adapters.clear();
  }

  /**
   * Test a connection without saving
   */
  async testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string }> {
    try {
      const adapter = DatabaseAdapterFactory.create(config);
      const result = await adapter.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get active connection name
   */
  getActiveConnectionName(): string | null {
    return getActiveConnectionName();
  }

  /**
   * Set active connection name
   */
  setActiveConnectionName(name: string | null): void {
    setActiveConnectionName(name);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(connectionKey: string): ConnectionWithStatus["status"] {
    return this.connectionStatus.get(connectionKey) || "disconnected";
  }
}
