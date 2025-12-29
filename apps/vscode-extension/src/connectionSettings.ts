import * as vscode from "vscode";
import type { ConnectionConfig, DatabaseConnectionConfig, DatabaseType } from "@dbview/types";

const STATE_KEYS = {
  dbType: "dbview.connection.dbType",
  host: "dbview.connection.host",
  port: "dbview.connection.port",
  user: "dbview.connection.user",
  database: "dbview.connection.database"
} as const;

const PASSWORD_KEY = "dbview.connection.password";
const CONNECTIONS_KEY = "dbview.connections";
const ACTIVE_CONNECTION_KEY = "dbview.activeConnection";

export async function getStoredConnection(
  context: vscode.ExtensionContext
): Promise<DatabaseConnectionConfig | null> {
  const dbType = context.globalState.get<DatabaseType>(STATE_KEYS.dbType) || 'postgres';
  const host = context.globalState.get<string>(STATE_KEYS.host);
  const port = context.globalState.get<number>(STATE_KEYS.port);
  const user = context.globalState.get<string>(STATE_KEYS.user);
  const database = context.globalState.get<string>(STATE_KEYS.database);

  if (!host || !port || !user || !database) {
    return null;
  }

  const activeConnectionName = await getActiveConnectionName(context);

  // Try to get password from named connection first, then fall back to legacy key
  let password: string | undefined;
  if (activeConnectionName) {
    password = await context.secrets.get(`dbview.connection.${activeConnectionName}.password`);
  }
  if (!password) {
    password = await context.secrets.get(PASSWORD_KEY);
  }

  return {
    dbType,
    name: activeConnectionName,
    host,
    port,
    user,
    database,
    password: password ?? undefined
  } as DatabaseConnectionConfig;
}

export async function promptForConnectionDetails(
  context: vscode.ExtensionContext,
  defaults?: Partial<DatabaseConnectionConfig>
): Promise<DatabaseConnectionConfig | null> {
  const fallback = defaults ?? (await getStoredConnection(context)) ?? {} as any;

  const host = await promptRequiredInput({
    title: "Postgres Host",
    prompt: "Enter the Postgres host",
    value: ('host' in fallback && fallback.host) || "localhost"
  });
  if (host === undefined) {
    return null;
  }

  const portValue = await promptRequiredInput({
    title: "Postgres Port",
    prompt: "Enter the Postgres port",
    value: String(('port' in fallback && fallback.port) || 5432),
    validateInput: (value) => {
      const port = Number(value);
      if (!Number.isInteger(port) || port <= 0) {
        return "Enter a valid port number";
      }
      return undefined;
    }
  });
  if (portValue === undefined) {
    return null;
  }
  const port = Number(portValue);

  const database = await promptRequiredInput({
    title: "Database Name",
    prompt: "Enter the Postgres database name",
    value: ('database' in fallback && fallback.database) || "postgres"
  });
  if (database === undefined) {
    return null;
  }

  const user = await promptRequiredInput({
    title: "Username",
    prompt: "Enter the Postgres user",
    value: ('user' in fallback && fallback.user) || "postgres"
  });
  if (user === undefined) {
    return null;
  }

  const password = await vscode.window.showInputBox({
    title: "Password",
    prompt: "Enter the Postgres password",
    password: true,
    ignoreFocusOut: true,
    value: ""
  });
  if (password === undefined) {
    return null;
  }

  const connection: DatabaseConnectionConfig = {
    dbType: 'postgres',
    host,
    port,
    database,
    user,
    password: password || undefined
  } as DatabaseConnectionConfig;

  const saveChoice = await vscode.window.showQuickPick(
    [
      { label: "Save connection", description: "Store credentials for future sessions", value: true },
      { label: "Use once", description: "Do not store connection details", value: false }
    ],
    {
      placeHolder: "Save these connection details?",
      ignoreFocusOut: true
    }
  );

  if (!saveChoice) {
    return null;
  }

  if (saveChoice.value) {
    await saveConnection(context, connection);
  }

  return connection;
}

async function promptRequiredInput(options: vscode.InputBoxOptions): Promise<string | undefined> {
  return vscode.window.showInputBox({
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value?.trim()) {
        return "This field is required";
      }
      if (options.validateInput) {
        return options.validateInput(value);
      }
      return undefined;
    },
    ...options
  });
}

async function saveConnection(
  context: vscode.ExtensionContext,
  connection: DatabaseConnectionConfig
): Promise<void> {
  const updates: Promise<void>[] = [
    Promise.resolve(context.globalState.update(STATE_KEYS.dbType, connection.dbType))
  ];

  // Only save host/port/user/database if they exist (not for SQLite)
  if ('host' in connection && connection.host) {
    updates.push(Promise.resolve(context.globalState.update(STATE_KEYS.host, connection.host)));
  }
  if ('port' in connection && connection.port) {
    updates.push(Promise.resolve(context.globalState.update(STATE_KEYS.port, connection.port)));
  }
  if ('user' in connection && connection.user) {
    updates.push(Promise.resolve(context.globalState.update(STATE_KEYS.user, connection.user)));
  }
  if ('database' in connection && connection.database) {
    updates.push(Promise.resolve(context.globalState.update(STATE_KEYS.database, connection.database)));
  }

  // Save password if it exists
  if ('password' in connection && connection.password) {
    updates.push(Promise.resolve(context.secrets.store(PASSWORD_KEY, connection.password)));
  } else {
    updates.push(Promise.resolve(context.secrets.delete(PASSWORD_KEY)));
  }

  await Promise.all(updates);
}

// New functions for managing multiple connections

export async function getAllSavedConnections(
  context: vscode.ExtensionContext
): Promise<DatabaseConnectionConfig[]> {
  const connections = context.globalState.get<DatabaseConnectionConfig[]>(CONNECTIONS_KEY);
  if (!connections) {
    return [];
  }

  // Retrieve passwords from secrets for each connection
  const connectionsWithPasswords = await Promise.all(
    connections.map(async (conn) => {
      // Add dbType if missing (backward compatibility)
      const connWithType = ('dbType' in conn ? conn : { ...(conn as any), dbType: 'postgres' as const }) as DatabaseConnectionConfig;

      if (conn.name) {
        const password = await context.secrets.get(`dbview.connection.${conn.name}.password`);
        return { ...(connWithType as any), password: password ?? undefined } as DatabaseConnectionConfig;
      }
      return connWithType;
    })
  );

  return connectionsWithPasswords;
}

export async function saveConnectionWithName(
  context: vscode.ExtensionContext,
  connection: DatabaseConnectionConfig
): Promise<void> {
  if (!connection.name?.trim()) {
    throw new Error("Connection name is required");
  }

  const connections = await getAllSavedConnections(context);

  // Check if connection with this name already exists
  const existingIndex = connections.findIndex(c => c.name === connection.name);

  // Store password in secrets if provided
  if ('password' in connection && connection.password) {
    await context.secrets.store(`dbview.connection.${connection.name}.password`, connection.password);
  }

  // Remove password from the connection object before storing in globalState
  const connectionToStore = { ...connection } as any;
  delete connectionToStore.password;

  if (existingIndex >= 0) {
    // Update existing connection
    connections[existingIndex] = connectionToStore;
  } else {
    // Add new connection
    connections.push(connectionToStore);
  }

  await context.globalState.update(CONNECTIONS_KEY, connections);

  // Also save as the legacy single connection for backward compatibility
  await saveConnection(context, connection);

  // Set as active connection
  await context.globalState.update(ACTIVE_CONNECTION_KEY, connection.name);
}

export async function deleteConnection(
  context: vscode.ExtensionContext,
  connectionName: string
): Promise<void> {
  const connections = await getAllSavedConnections(context);
  const filteredConnections = connections.filter(c => c.name !== connectionName);

  await context.globalState.update(CONNECTIONS_KEY, filteredConnections);
  await context.secrets.delete(`dbview.connection.${connectionName}.password`);

  // If the deleted connection was active, clear the active connection
  const activeConnection = context.globalState.get<string>(ACTIVE_CONNECTION_KEY);
  if (activeConnection === connectionName) {
    await context.globalState.update(ACTIVE_CONNECTION_KEY, undefined);
  }
}

/**
 * Update an existing connection, handling name changes properly
 */
export async function updateConnection(
  context: vscode.ExtensionContext,
  originalName: string,
  connection: DatabaseConnectionConfig
): Promise<void> {
  if (!connection.name?.trim()) {
    throw new Error("Connection name is required");
  }

  const connections = context.globalState.get<DatabaseConnectionConfig[]>(CONNECTIONS_KEY) || [];

  // Find by original name
  const existingIndex = connections.findIndex(c => c.name === originalName);

  // If name changed, delete old password
  if (originalName !== connection.name) {
    await context.secrets.delete(`dbview.connection.${originalName}.password`);
  }

  // Store new password in secrets if provided
  if ('password' in connection && connection.password) {
    await context.secrets.store(`dbview.connection.${connection.name}.password`, connection.password);
  }

  // Remove password from the connection object before storing in globalState
  const connectionToStore = { ...connection } as any;
  delete connectionToStore.password;

  if (existingIndex >= 0) {
    // Update existing connection
    connections[existingIndex] = connectionToStore;
  } else {
    // Add new connection (shouldn't happen for edit, but fallback)
    connections.push(connectionToStore);
  }

  await context.globalState.update(CONNECTIONS_KEY, connections);

  // Also save as the legacy single connection for backward compatibility
  await saveConnection(context, connection);

  // Set as active connection
  await context.globalState.update(ACTIVE_CONNECTION_KEY, connection.name);
}

export async function getActiveConnectionName(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return context.globalState.get<string>(ACTIVE_CONNECTION_KEY);
}

export async function setActiveConnection(
  context: vscode.ExtensionContext,
  connectionName: string
): Promise<DatabaseConnectionConfig | null> {
  const connections = await getAllSavedConnections(context);
  const connection = connections.find(c => c.name === connectionName);

  if (!connection) {
    return null;
  }

  await context.globalState.update(ACTIVE_CONNECTION_KEY, connectionName);

  // Also save as the legacy single connection for backward compatibility
  await saveConnection(context, connection);

  return connection;
}

export async function clearStoredConnection(context: vscode.ExtensionContext): Promise<void> {
  await Promise.all([
    context.globalState.update(STATE_KEYS.host, undefined),
    context.globalState.update(STATE_KEYS.port, undefined),
    context.globalState.update(STATE_KEYS.user, undefined),
    context.globalState.update(STATE_KEYS.database, undefined),
    context.secrets.delete(PASSWORD_KEY)
  ]);

  await context.globalState.update(ACTIVE_CONNECTION_KEY, undefined);
}

// ============================================================================
// Password Management Functions
// ============================================================================

/**
 * Check if a password is saved for the current connection
 */
export async function isPasswordSaved(
  context: vscode.ExtensionContext,
  connectionName?: string
): Promise<boolean> {
  if (connectionName) {
    const password = await context.secrets.get(`dbview.connection.${connectionName}.password`);
    return password !== undefined;
  }

  const password = await context.secrets.get(PASSWORD_KEY);
  return password !== undefined;
}

/**
 * Clear password for a specific connection
 */
export async function clearPassword(
  context: vscode.ExtensionContext,
  connectionName?: string
): Promise<void> {
  if (connectionName) {
    await context.secrets.delete(`dbview.connection.${connectionName}.password`);
  } else {
    await context.secrets.delete(PASSWORD_KEY);
  }
}

/**
 * Clear all saved passwords
 */
export async function clearAllPasswords(context: vscode.ExtensionContext): Promise<void> {
  // Clear legacy password
  await context.secrets.delete(PASSWORD_KEY);

  // Clear all connection passwords
  const connections = await getAllSavedConnections(context);
  await Promise.all(
    connections.map(conn =>
      conn.name ? context.secrets.delete(`dbview.connection.${conn.name}.password`) : Promise.resolve()
    )
  );
}

/**
 * Get connection security info
 */
export async function getConnectionSecurityInfo(
  context: vscode.ExtensionContext,
  connectionName?: string
): Promise<{ passwordSaved: boolean; sslEnabled: boolean }> {
  const passwordSaved = await isPasswordSaved(context, connectionName);
  const connection = await getStoredConnection(context);
  const sslEnabled = Boolean(connection && 'ssl' in connection && connection.ssl);

  return { passwordSaved, sslEnabled };
}
