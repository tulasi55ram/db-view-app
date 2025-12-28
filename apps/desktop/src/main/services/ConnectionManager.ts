import type { DatabaseConnectionConfig } from "@dbview/types";
import {
  isSQLiteConfig,
  isMongoDBConfig,
  isRedisConfig,
} from "@dbview/types";
import type { DatabaseAdapter } from "@dbview/adapters";
import { DatabaseAdapterFactory } from "@dbview/adapters";
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
 * - Auto-reconnection on disconnect
 */
export class ConnectionManager {
  private adapters: Map<string, DatabaseAdapter> = new Map();
  private connectionStatus: Map<string, ConnectionWithStatus["status"]> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private connectionConfigs: Map<string, StoredConnectionConfig> = new Map();

  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly INITIAL_RECONNECT_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

  /**
   * Get unique key for a connection config
   */
  getConnectionKey(config: DatabaseConnectionConfig | StoredConnectionConfig): string {
    const dbType = config.dbType || "postgres";

    if (config.name) {
      return `${dbType}:${config.name}`;
    }

    // Use property checks instead of type guards for flexibility with StoredConnectionConfig
    if (dbType === "sqlite" && "filePath" in config) {
      return `${dbType}:${config.filePath}`;
    }

    if (dbType === "mongodb") {
      if ("connectionString" in config && config.connectionString) {
        return `${dbType}:${config.connectionString}`;
      }
      const user = "user" in config ? config.user : "anonymous";
      const host = "host" in config ? config.host : "localhost";
      const port = "port" in config ? config.port : 27017;
      const database = "database" in config ? config.database : "";
      return `${dbType}:${user}@${host}:${port}/${database}`;
    }

    if (dbType === "redis") {
      const host = "host" in config ? config.host : "localhost";
      const port = "port" in config ? config.port : 6379;
      const database = "database" in config ? config.database : 0;
      return `${dbType}:${host}:${port}/${database}`;
    }

    // For postgres, mysql, sqlserver
    if ("host" in config && "port" in config && "database" in config) {
      const user = "user" in config ? config.user : "unknown";
      return `${dbType}:${user}@${config.host}:${config.port}/${config.database}`;
    }

    return `${dbType}:${JSON.stringify(config)}`;
  }

  /**
   * Get all saved connections with their current status
   */
  async getConnectionsWithStatus(): Promise<ConnectionWithStatus[]> {
    const connections = getAllConnections();
    return connections.map((config) => ({
      config,
      status: this.connectionStatus.get(this.getConnectionKey(config)) || "disconnected",
    }));
  }

  /**
   * Get a full connection config with password from secure storage
   */
  async getFullConnectionConfig(storedConfig: StoredConnectionConfig): Promise<DatabaseConnectionConfig> {
    // For databases that need passwords (including Elasticsearch which uses node instead of host)
    const needsPassword = "host" in storedConfig ||
                          storedConfig.dbType === "elasticsearch" ||
                          storedConfig.dbType === "mongodb";

    if (needsPassword && storedConfig.name) {
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
    const configWithoutPassword: Partial<DatabaseConnectionConfig> = { ...config };
    if ("password" in configWithoutPassword) {
      delete configWithoutPassword.password;
    }
    saveConnection(configWithoutPassword as StoredConnectionConfig);
  }

  /**
   * Delete a connection and its stored password
   */
  async deleteConnection(name: string): Promise<void> {
    // Disconnect if connected
    const connections = getAllConnections();
    const config = connections.find((c) => c.name === name);
    if (config) {
      const key = this.getConnectionKey(config);
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
    const key = this.getConnectionKey(config);

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

      // Store config for reconnection
      this.connectionConfigs.set(key, config as StoredConnectionConfig);

      // Listen for status changes and trigger auto-reconnect
      adapter.on("statusChange", (event) => {
        const newStatus = event.status === "connected" ? "connected" : "disconnected";
        this.connectionStatus.set(key, newStatus);

        // Trigger auto-reconnect if connection was lost unexpectedly
        if (newStatus === "disconnected" && this.connectionConfigs.has(key)) {
          this.scheduleReconnect(key);
        }

        // Reset reconnect attempts on successful connection
        if (newStatus === "connected") {
          this.reconnectAttempts.delete(key);
          this.clearReconnectTimer(key);
        }
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
   * Clear reconnect timer for a connection
   */
  private clearReconnectTimer(key: string): void {
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(key: string): void {
    const attempts = this.reconnectAttempts.get(key) || 0;

    // Don't reconnect if max attempts reached
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`[ConnectionManager] Max reconnect attempts reached for ${key}`);
      this.connectionStatus.set(key, "error");
      return;
    }

    // Clear any existing timer
    this.clearReconnectTimer(key);

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, attempts),
      this.MAX_RECONNECT_DELAY
    );

    console.log(`[ConnectionManager] Scheduling reconnect for ${key} in ${delay}ms (attempt ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);

    const timer = setTimeout(async () => {
      this.reconnectAttempts.set(key, attempts + 1);

      const config = this.connectionConfigs.get(key);
      if (!config) {
        console.log(`[ConnectionManager] No config found for ${key}, skipping reconnect`);
        return;
      }

      try {
        console.log(`[ConnectionManager] Attempting to reconnect ${key}...`);
        this.connectionStatus.set(key, "connecting");

        // Remove old adapter
        this.adapters.delete(key);

        // Get full config with password and reconnect
        const fullConfig = await this.getFullConnectionConfig(config);
        const adapter = DatabaseAdapterFactory.create(fullConfig);

        await adapter.connect();
        this.adapters.set(key, adapter);
        this.connectionStatus.set(key, "connected");

        // Start health checks
        adapter.startHealthCheck();

        // Re-attach status change listener
        adapter.on("statusChange", (event) => {
          const newStatus = event.status === "connected" ? "connected" : "disconnected";
          this.connectionStatus.set(key, newStatus);

          if (newStatus === "disconnected" && this.connectionConfigs.has(key)) {
            this.scheduleReconnect(key);
          }

          if (newStatus === "connected") {
            this.reconnectAttempts.delete(key);
            this.clearReconnectTimer(key);
          }
        });

        console.log(`[ConnectionManager] Successfully reconnected ${key}`);
        this.reconnectAttempts.delete(key);
      } catch (error) {
        console.error(`[ConnectionManager] Reconnect failed for ${key}:`, error);
        this.connectionStatus.set(key, "disconnected");

        // Schedule another attempt
        this.scheduleReconnect(key);
      }
    }, delay);

    this.reconnectTimers.set(key, timer);
  }

  /**
   * Disconnect a specific connection
   */
  async disconnect(connectionKey: string): Promise<void> {
    // Clear reconnect attempts - user intentionally disconnected
    this.clearReconnectTimer(connectionKey);
    this.reconnectAttempts.delete(connectionKey);
    this.connectionConfigs.delete(connectionKey);

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
    // Clear all reconnect timers
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();
    this.connectionConfigs.clear();

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
