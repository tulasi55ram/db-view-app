import * as vscode from "vscode";
import type { ConnectionConfig } from "@dbview/core";

const STATE_KEYS = {
  host: "dbview.connection.host",
  port: "dbview.connection.port",
  user: "dbview.connection.user",
  database: "dbview.connection.database"
} as const;

const PASSWORD_KEY = "dbview.connection.password";

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
  return {
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
