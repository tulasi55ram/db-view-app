import type { DatabaseConnectionConfig } from "@dbview/types";
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
   * Get unique key for a connection config.
   * IMPORTANT: This key must NOT contain secrets (passwords, connection strings with credentials).
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
      // Never use connectionString in key - it may contain passwords
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

    // Fallback: create a key from safe properties only (exclude password, connectionString)
    const safeProps = this.getSafeConfigProps(config);
    return `${dbType}:${safeProps}`;
  }

  /**
   * Get a string representation of config properties that are safe to log/store.
   * Excludes passwords, connection strings, and other secrets.
   */
  private getSafeConfigProps(config: DatabaseConnectionConfig | StoredConnectionConfig): string {
    const safeKeys = ["host", "port", "database", "user", "filePath", "dbType", "name", "node"];
    const safeEntries: string[] = [];

    for (const key of safeKeys) {
      if (key in config && (config as Record<string, unknown>)[key] !== undefined) {
        safeEntries.push(`${key}=${(config as Record<string, unknown>)[key]}`);
      }
    }

    return safeEntries.join(",") || "unknown";
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
   * Get a full connection config with secrets from secure storage
   */
  async getFullConnectionConfig(storedConfig: StoredConnectionConfig): Promise<DatabaseConnectionConfig> {
    const result: Record<string, unknown> = { ...storedConfig };

    // Use _passwordConnectionName if present (for database-specific adapters),
    // otherwise use the regular name field
    const passwordLookupName = (storedConfig as any)._passwordConnectionName || storedConfig.name;

    // Retrieve password from keychain if this connection type needs one
    const needsPassword = "host" in storedConfig ||
                          storedConfig.dbType === "elasticsearch" ||
                          storedConfig.dbType === "mongodb";

    if (needsPassword && passwordLookupName) {
      const password = await passwordStore.getPassword(passwordLookupName);
      if (password) {
        result.password = password;
      }
    }

    // Retrieve connection string from keychain if flagged
    if ((storedConfig as Record<string, unknown>).hasConnectionString && passwordLookupName) {
      const connectionString = await passwordStore.getPassword(`${passwordLookupName}:connectionString`);
      if (connectionString) {
        result.connectionString = connectionString;
      }
      delete result.hasConnectionString; // Remove the flag, not needed in runtime config
    }

    // Clean up internal fields
    delete result._passwordConnectionName;

    return result as unknown as DatabaseConnectionConfig;
  }

  /**
   * Save a connection (secrets stored separately in keychain)
   */
  async saveConnectionConfig(config: DatabaseConnectionConfig): Promise<void> {
    // Connection name is mandatory for all saved connections
    if (!config.name) {
      throw new Error("Connection name is required when saving a connection");
    }

    // Store password in keychain if provided
    if ("password" in config && config.password) {
      await passwordStore.setPassword(config.name, config.password);
    }

    // Store connection string in keychain if provided (it may contain credentials)
    if ("connectionString" in config && config.connectionString) {
      await passwordStore.setPassword(`${config.name}:connectionString`, config.connectionString);
    }

    // Store config without secrets
    const configWithoutSecrets: Partial<DatabaseConnectionConfig> & { hasConnectionString?: boolean } = { ...config };
    if ("password" in configWithoutSecrets) {
      delete configWithoutSecrets.password;
    }
    if ("connectionString" in configWithoutSecrets) {
      // Replace connection string with a flag indicating it exists in keychain
      configWithoutSecrets.hasConnectionString = true;
      delete (configWithoutSecrets as Record<string, unknown>).connectionString;
    }
    saveConnection(configWithoutSecrets as StoredConnectionConfig);
  }

  /**
   * Delete a connection and its stored secrets
   */
  async deleteConnection(name: string): Promise<void> {
    // Disconnect if connected
    const connections = getAllConnections();
    const config = connections.find((c) => c.name === name);
    if (config) {
      const key = this.getConnectionKey(config);
      await this.disconnect(key);
    }

    // Delete secrets from keychain (password and connection string)
    await passwordStore.deletePassword(name);
    await passwordStore.deletePassword(`${name}:connectionString`);

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
   * Get adapter for a specific database when in "show all databases" mode.
   * If database is provided, creates a new adapter connection to that database.
   * Otherwise, returns the existing adapter.
   */
  async getAdapterForDatabase(connectionKey: string, database?: string): Promise<DatabaseAdapter | undefined> {
    // If no database specified, return existing adapter
    if (!database) {
      return this.getAdapter(connectionKey);
    }

    // Find the original connection config
    const connections = getAllConnections();
    const originalConfig = connections.find((c) => this.getConnectionKey(c as any) === connectionKey);
    if (!originalConfig) {
      throw new Error(`Connection config not found for key: ${connectionKey}`);
    }

    // Create a new config with the specific database
    // Store the original name for password retrieval, but use unique name for adapter key
    const dbSpecificConfig = {
      ...originalConfig,
      database,
      name: `${originalConfig.name}:${database}`, // Make the name unique for adapter key
      _passwordConnectionName: originalConfig.name // Store original name for password lookup
    } as StoredConnectionConfig & { _passwordConnectionName?: string };

    // Get the key for this database-specific connection
    const dbSpecificKey = this.getConnectionKey(dbSpecificConfig);

    // Check if we already have an adapter for this database
    const existingAdapter = this.adapters.get(dbSpecificKey);
    if (existingAdapter && existingAdapter.status === "connected") {
      return existingAdapter;
    }

    // Create a new adapter for this database
    console.log(`[ConnectionManager] Creating adapter for database: ${database} (key: ${dbSpecificKey})`);
    return this.getOrCreateAdapter(dbSpecificConfig);
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
    let adapter: DatabaseAdapter | null = null;
    try {
      adapter = DatabaseAdapterFactory.create(config);
      const result = await adapter.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Always clean up the adapter to prevent resource leaks
      if (adapter) {
        try {
          await adapter.disconnect();
        } catch {
          // Ignore disconnect errors during cleanup
        }
      }
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
