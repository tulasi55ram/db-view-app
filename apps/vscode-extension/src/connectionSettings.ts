import * as vscode from "vscode";
import type { ConnectionConfig } from "@dbview/core";

const STATE_KEYS = {
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
): Promise<ConnectionConfig | null> {
  const host = context.globalState.get<string>(STATE_KEYS.host);
  const port = context.globalState.get<number>(STATE_KEYS.port);
  const user = context.globalState.get<string>(STATE_KEYS.user);
  const database = context.globalState.get<string>(STATE_KEYS.database);

  if (!host || !port || !user || !database) {
    return null;
  }

  const password = await context.secrets.get(PASSWORD_KEY);
  const activeConnectionName = await getActiveConnectionName(context);

  return {
    name: activeConnectionName,
    host,
    port,
    user,
    database,
    password: password ?? undefined
  };
}

export async function promptForConnectionDetails(
  context: vscode.ExtensionContext,
  defaults?: Partial<ConnectionConfig>
): Promise<ConnectionConfig | null> {
  const fallback = defaults ?? (await getStoredConnection(context)) ?? {};

  const host = await promptRequiredInput({
    title: "Postgres Host",
    prompt: "Enter the Postgres host",
    value: fallback.host ?? "localhost"
  });
  if (host === undefined) {
    return null;
  }

  const portValue = await promptRequiredInput({
    title: "Postgres Port",
    prompt: "Enter the Postgres port",
    value: String(fallback.port ?? 5432),
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
    value: fallback.database ?? "postgres"
  });
  if (database === undefined) {
    return null;
  }

  const user = await promptRequiredInput({
    title: "Username",
    prompt: "Enter the Postgres user",
    value: fallback.user ?? "postgres"
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

  const connection: ConnectionConfig = {
    host,
    port,
    database,
    user,
    password: password || undefined
  };

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
  connection: ConnectionConfig
): Promise<void> {
  await Promise.all([
    context.globalState.update(STATE_KEYS.host, connection.host),
    context.globalState.update(STATE_KEYS.port, connection.port),
    context.globalState.update(STATE_KEYS.user, connection.user),
    context.globalState.update(STATE_KEYS.database, connection.database),
    connection.password
      ? context.secrets.store(PASSWORD_KEY, connection.password)
      : context.secrets.delete(PASSWORD_KEY)
  ]);
}

// New functions for managing multiple connections

export async function getAllSavedConnections(
  context: vscode.ExtensionContext
): Promise<ConnectionConfig[]> {
  const connections = context.globalState.get<ConnectionConfig[]>(CONNECTIONS_KEY);
  if (!connections) {
    return [];
  }

  // Retrieve passwords from secrets for each connection
  const connectionsWithPasswords = await Promise.all(
    connections.map(async (conn) => {
      if (conn.name) {
        const password = await context.secrets.get(`dbview.connection.${conn.name}.password`);
        return { ...conn, password: password ?? undefined };
      }
      return conn;
    })
  );

  return connectionsWithPasswords;
}

export async function saveConnectionWithName(
  context: vscode.ExtensionContext,
  connection: ConnectionConfig
): Promise<void> {
  if (!connection.name?.trim()) {
    throw new Error("Connection name is required");
  }

  const connections = await getAllSavedConnections(context);

  // Check if connection with this name already exists
  const existingIndex = connections.findIndex(c => c.name === connection.name);

  // Store password in secrets if provided
  if (connection.password) {
    await context.secrets.store(`dbview.connection.${connection.name}.password`, connection.password);
  }

  // Remove password from the connection object before storing in globalState
  const connectionToStore = { ...connection };
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

export async function getActiveConnectionName(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return context.globalState.get<string>(ACTIVE_CONNECTION_KEY);
}

export async function setActiveConnection(
  context: vscode.ExtensionContext,
  connectionName: string
): Promise<ConnectionConfig | null> {
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
