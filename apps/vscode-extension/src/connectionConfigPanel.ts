import * as vscode from "vscode";
import type { ConnectionConfig, DatabaseConnectionConfig, DatabaseType } from "@dbview/types";
import { saveConnectionWithName } from "./connectionSettings";
import { DatabaseAdapterFactory } from "@dbview/adapters";

export function showConnectionConfigPanel(
  context: vscode.ExtensionContext,
  defaults?: Partial<ConnectionConfig | DatabaseConnectionConfig>,
  options?: { skipSave?: boolean }
): Promise<DatabaseConnectionConfig | null> {
  console.log("[dbview] showConnectionConfigPanel called with defaults:", defaults);
  const skipSave = options?.skipSave ?? false;

  return new Promise((resolve) => {
    let resolved = false;
    const panel = vscode.window.createWebviewPanel(
      "dbviewConnectionConfig",
      defaults?.name ? `Edit Connection: ${defaults.name}` : "Add New Connection",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    console.log("[dbview] Webview panel created, setting HTML content");

    // Get URI for media folder
    const mediaUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'media', 'db-icons')
    );

    panel.webview.html = getWebviewContent(defaults, mediaUri.toString());
    console.log("[dbview] Webview HTML set");

    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log("[dbview] Received message from webview:", message.command);
        switch (message.command) {
          case "submit":
            console.log("[dbview] Submit command received, saveConnection:", message.saveConnection);

            // If editing an existing connection and password is empty, retrieve from secrets
            let password = message.password || undefined;
            if (!password) {
              // Try named connection key first
              if (defaults?.name) {
                console.log("[dbview] No password provided, checking secrets for existing connection:", defaults.name);
                const storedPassword = await context.secrets.get(`dbview.connection.${defaults.name}.password`);
                if (storedPassword) {
                  console.log("[dbview] Found stored password for connection");
                  password = storedPassword;
                }
              }
              // Fall back to legacy key if still no password
              if (!password) {
                console.log("[dbview] Checking legacy password key");
                const legacyPassword = await context.secrets.get("dbview.connection.password");
                if (legacyPassword) {
                  console.log("[dbview] Found password from legacy key");
                  password = legacyPassword;
                }
              }
            }

            const dbType = message.dbType || 'postgres';
            let connection: DatabaseConnectionConfig;

            if (dbType === 'sqlserver') {
              connection = {
                dbType: 'sqlserver',
                name: message.name || undefined,
                host: message.host,
                port: parseInt(message.port, 10) || 1433,
                database: message.database,
                user: message.user,
                password,
                authenticationType: 'sql',
                encrypt: true,
                trustServerCertificate: true,
                readOnly: message.readOnly || false
              };
            } else if (dbType === 'sqlite') {
              connection = {
                dbType: 'sqlite',
                name: message.name || undefined,
                filePath: message.filePath,
                mode: message.mode || 'readwrite',
                readOnly: message.readOnly || false
              };
            } else if (dbType === 'mongodb') {
              connection = {
                dbType: 'mongodb',
                name: message.name || undefined,
                host: message.host,
                port: parseInt(message.port, 10) || 27017,
                database: message.database,
                user: message.user,
                password,
                authDatabase: message.authDatabase || 'admin',
                readOnly: message.readOnly || false
              };
            } else {
              connection = {
                dbType,
                name: message.name || undefined,
                host: message.host,
                port: parseInt(message.port, 10),
                database: message.database,
                user: message.user,
                password,
                readOnly: message.readOnly || false
              } as DatabaseConnectionConfig;
            }

            const logConnection = { ...connection } as any;
            if ('password' in logConnection && logConnection.password) {
              logConnection.password = "***";
            }
            console.log("[dbview] Connection object created:", logConnection);

            if (skipSave) {
              console.log("[dbview] Skipping save (caller will handle it)");
            } else if (message.saveConnection) {
              console.log("[dbview] Saving connection...");
              if (connection.name?.trim()) {
                console.log("[dbview] Saving with name:", connection.name);
                await saveConnectionWithName(context, connection);
              } else {
                console.log("[dbview] Saving without name (legacy mode)");
                await saveConnection(context, connection);
              }
              console.log("[dbview] Connection saved successfully");
            } else {
              console.log("[dbview] Not saving connection (temporary connection)");
            }

            console.log("[dbview] Disposing panel and resolving with connection");
            resolved = true;
            panel.dispose();
            resolve(connection);
            break;

          case "cancel":
            console.log("[dbview] Cancel command received");
            resolved = true;
            panel.dispose();
            resolve(null);
            break;

          case "testConnection":
            console.log("[dbview] Testing connection...");
            try {
              let testPassword = message.password || undefined;
              if (!testPassword) {
                if (defaults?.name) {
                  const storedPassword = await context.secrets.get(`dbview.connection.${defaults.name}.password`);
                  if (storedPassword) {
                    testPassword = storedPassword;
                  }
                }
                if (!testPassword) {
                  const legacyPassword = await context.secrets.get("dbview.connection.password");
                  if (legacyPassword) {
                    testPassword = legacyPassword;
                  }
                }
              }

              const dbType = message.dbType || 'postgres';
              let testConfig: DatabaseConnectionConfig;

              if (dbType === 'sqlserver') {
                testConfig = {
                  dbType: 'sqlserver',
                  name: message.name || undefined,
                  host: message.host,
                  port: parseInt(message.port, 10) || 1433,
                  database: message.database,
                  user: message.user,
                  password: testPassword,
                  authenticationType: 'sql',
                  encrypt: true,
                  trustServerCertificate: true,
                  readOnly: message.readOnly || false
                };
              } else if (dbType === 'mongodb') {
                testConfig = {
                  dbType: 'mongodb',
                  name: message.name || undefined,
                  host: message.host,
                  port: parseInt(message.port, 10) || 27017,
                  database: message.database,
                  user: message.user,
                  password: testPassword,
                  authDatabase: message.authDatabase || 'admin',
                  readOnly: message.readOnly || false
                };
              } else if (dbType === 'sqlite') {
                testConfig = {
                  dbType: 'sqlite',
                  name: message.name || undefined,
                  filePath: message.filePath,
                  mode: message.mode || 'readwrite',
                  readOnly: message.readOnly || false
                };
              } else {
                testConfig = {
                  dbType,
                  name: message.name || undefined,
                  host: message.host,
                  port: parseInt(message.port, 10),
                  database: message.database,
                  user: message.user,
                  password: testPassword,
                  readOnly: message.readOnly || false
                } as DatabaseConnectionConfig;
              }

              const adapter = DatabaseAdapterFactory.create(testConfig);
              await adapter.connect();
              await adapter.disconnect();

              panel.webview.postMessage({
                command: "testResult",
                success: true,
                message: `Successfully connected to ${dbType.toUpperCase()} database`
              });
            } catch (error) {
              console.error("[dbview] Connection test error:", error);
              panel.webview.postMessage({
                command: "testResult",
                success: false,
                message: error instanceof Error ? error.message : "Connection test failed"
              });
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    panel.onDidDispose(() => {
      if (!resolved) {
        console.log("[dbview] Panel disposed without explicit resolution, resolving with null");
        resolve(null);
      }
    });
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function saveConnection(
  context: vscode.ExtensionContext,
  connection: DatabaseConnectionConfig
): Promise<void> {
  const STATE_KEYS = {
    dbType: "dbview.connection.dbType",
    host: "dbview.connection.host",
    port: "dbview.connection.port",
    user: "dbview.connection.user",
    database: "dbview.connection.database"
  };

  const PASSWORD_KEY = "dbview.connection.password";

  const updates: Promise<void>[] = [
    Promise.resolve(context.globalState.update(STATE_KEYS.dbType, connection.dbType))
  ];

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

  if ('password' in connection && connection.password) {
    updates.push(Promise.resolve(context.secrets.store(PASSWORD_KEY, connection.password)));
  } else {
    updates.push(Promise.resolve(context.secrets.delete(PASSWORD_KEY)));
  }

  await Promise.all(updates);
}

function getWebviewContent(defaults?: Partial<ConnectionConfig | DatabaseConnectionConfig>, mediaUri?: string): string {
  const iconBaseUri = mediaUri || '';
  const dbType = (defaults && 'dbType' in defaults) ? defaults.dbType : 'postgres';
  const defaultName = escapeHtml(defaults?.name ?? "");
  const defaultHost = escapeHtml((defaults && 'host' in defaults ? defaults.host : undefined) ?? "localhost");
  const defaultPort = (defaults && 'port' in defaults ? defaults.port : undefined) ??
    (dbType === 'mysql' ? 3306 : dbType === 'sqlserver' ? 1433 : dbType === 'mongodb' ? 27017 : 5432);
  const defaultDatabase = escapeHtml(String((defaults && 'database' in defaults ? defaults.database : undefined) ?? ""));
  const defaultUser = escapeHtml((defaults && 'user' in defaults ? defaults.user : undefined) ?? "");
  const defaultFilePath = escapeHtml((defaults && 'filePath' in defaults ? defaults.filePath : undefined) ?? "");
  const defaultAuthDatabase = escapeHtml((defaults && 'authDatabase' in defaults ? defaults.authDatabase : undefined) ?? "admin");
  const defaultReadOnly = defaults?.readOnly ?? false;
  const isEditing = Boolean(defaults?.name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isEditing ? 'Edit Connection' : 'Add New Connection'}</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.5;
            min-height: 100vh;
        }

        .container {
            display: grid;
            grid-template-columns: 220px 1fr;
            min-height: 100vh;
        }

        /* Left Panel - Database Type Selector */
        .left-panel {
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 24px 16px;
        }

        .left-panel h2 {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
        }

        .db-type-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .db-type-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: left;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }

        .db-type-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .db-type-btn.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-color: var(--vscode-focusBorder);
        }

        .db-type-btn.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .db-icon {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .db-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .db-type-info {
            display: flex;
            flex-direction: column;
        }

        .db-type-name {
            font-weight: 500;
        }

        .db-type-desc {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .db-type-btn.selected .db-type-desc {
            color: var(--vscode-list-activeSelectionForeground);
            opacity: 0.8;
        }

        /* Right Panel - Form */
        .right-panel {
            padding: 32px 40px;
            overflow-y: auto;
            max-height: 100vh;
        }

        .form-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .form-header-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .form-header-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .form-header-text h1 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .form-header-text p {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .form-section {
            margin-bottom: 28px;
        }

        .form-section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 3fr 1fr;
            gap: 16px;
        }

        label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-weight: 500;
            font-size: 13px;
            color: var(--vscode-foreground);
        }

        .label-badge {
            font-size: 10px;
            padding: 2px 6px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            font-weight: normal;
        }

        input[type="text"],
        input[type="number"],
        input[type="password"],
        select {
            width: 100%;
            padding: 10px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        input:focus,
        select:focus {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
        }

        /* Checkbox */
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            cursor: pointer;
            transition: border-color 0.15s ease;
        }

        .checkbox-group:hover {
            border-color: var(--vscode-focusBorder);
        }

        .checkbox-group input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: var(--vscode-focusBorder);
        }

        .checkbox-group label {
            margin: 0;
            cursor: pointer;
            font-weight: normal;
            flex: 1;
        }

        .checkbox-icon {
            font-size: 16px;
        }

        /* Warnings */
        .warning-box {
            display: none;
            padding: 14px 16px;
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .warning-box.show {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .warning-box .warning-icon {
            font-size: 18px;
            flex-shrink: 0;
        }

        .warning-box .warning-content h4 {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--vscode-inputValidation-warningForeground);
        }

        .warning-box .warning-content p {
            font-size: 12px;
            color: var(--vscode-inputValidation-warningForeground);
            opacity: 0.9;
        }

        /* Status Messages */
        .status-message {
            display: none;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 13px;
            margin-bottom: 20px;
            align-items: center;
            gap: 10px;
        }

        .status-message.show {
            display: flex;
        }

        .status-message.success {
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #22c55e;
        }

        .status-message.error {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
        }

        .status-message.testing {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .status-icon {
            font-size: 16px;
        }

        /* Buttons */
        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        button {
            padding: 10px 20px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            font-weight: 500;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            outline: none;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-test {
            background-color: transparent;
            border: 1px solid var(--vscode-button-border, var(--vscode-input-border));
            color: var(--vscode-foreground);
        }

        .btn-test:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .btn-test:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .spacer {
            flex: 1;
        }

        /* Hidden fields */
        .hidden {
            display: none !important;
        }

        /* Spinner */
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Left Panel: Database Type Selector -->
        <div class="left-panel">
            <h2>Database Type</h2>
            <div class="db-type-list">
                <button type="button" class="db-type-btn ${dbType === 'postgres' ? 'selected' : ''} ${isEditing ? 'disabled' : ''}" data-type="postgres" ${isEditing ? 'disabled' : ''}>
                    <div class="db-icon postgres">
                        <img src="${iconBaseUri}/postgres.svg" alt="PostgreSQL" />
                    </div>
                    <div class="db-type-info">
                        <span class="db-type-name">PostgreSQL</span>
                        <span class="db-type-desc">Advanced open source</span>
                    </div>
                </button>
                <button type="button" class="db-type-btn ${dbType === 'mysql' ? 'selected' : ''} ${isEditing ? 'disabled' : ''}" data-type="mysql" ${isEditing ? 'disabled' : ''}>
                    <div class="db-icon mysql">
                        <img src="${iconBaseUri}/mysql.svg" alt="MySQL" />
                    </div>
                    <div class="db-type-info">
                        <span class="db-type-name">MySQL</span>
                        <span class="db-type-desc">Popular open source</span>
                    </div>
                </button>
                <button type="button" class="db-type-btn ${dbType === 'sqlserver' ? 'selected' : ''} ${isEditing ? 'disabled' : ''}" data-type="sqlserver" ${isEditing ? 'disabled' : ''}>
                    <div class="db-icon sqlserver">
                        <img src="${iconBaseUri}/sqlserver.svg" alt="SQL Server" />
                    </div>
                    <div class="db-type-info">
                        <span class="db-type-name">SQL Server</span>
                        <span class="db-type-desc">Microsoft database</span>
                    </div>
                </button>
                <button type="button" class="db-type-btn ${dbType === 'sqlite' ? 'selected' : ''} ${isEditing ? 'disabled' : ''}" data-type="sqlite" ${isEditing ? 'disabled' : ''}>
                    <div class="db-icon sqlite">
                        <img src="${iconBaseUri}/sqlite.svg" alt="SQLite" />
                    </div>
                    <div class="db-type-info">
                        <span class="db-type-name">SQLite</span>
                        <span class="db-type-desc">File-based database</span>
                    </div>
                </button>
                <button type="button" class="db-type-btn ${dbType === 'mongodb' ? 'selected' : ''} ${isEditing ? 'disabled' : ''}" data-type="mongodb" ${isEditing ? 'disabled' : ''}>
                    <div class="db-icon mongodb">
                        <img src="${iconBaseUri}/mongodb.svg" alt="MongoDB" />
                    </div>
                    <div class="db-type-info">
                        <span class="db-type-name">MongoDB</span>
                        <span class="db-type-desc">Document database</span>
                    </div>
                </button>
            </div>
        </div>

        <!-- Right Panel: Connection Form -->
        <div class="right-panel">
            <div class="form-header">
                <div class="form-header-icon" id="headerIcon"></div>
                <div class="form-header-text">
                    <h1 id="formTitle">${isEditing ? 'Edit Connection' : 'New Connection'}</h1>
                    <p id="formSubtitle">Configure your database connection details</p>
                </div>
            </div>

            <form id="connectionForm">
                <input type="hidden" id="dbType" name="dbType" value="${dbType}">

                <!-- Connection Identity Section -->
                <div class="form-section">
                    <div class="form-section-title">Connection Identity</div>

                    <div class="form-group">
                        <label for="name">Connection Name <span class="label-badge">Optional</span></label>
                        <input type="text" id="name" name="name" value="${defaultName}" placeholder="e.g., Production DB, Local Dev">
                        <div class="help-text">A friendly name to identify this connection</div>
                    </div>
                </div>

                <!-- Server Connection Section (for server-based DBs) -->
                <div class="form-section server-fields">
                    <div class="form-section-title">Server Connection</div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="host">Host</label>
                            <input type="text" id="host" name="host" value="${defaultHost}" placeholder="localhost">
                        </div>
                        <div class="form-group">
                            <label for="port">Port</label>
                            <input type="number" id="port" name="port" value="${defaultPort}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="database">Database Name</label>
                        <input type="text" id="database" name="database" value="${defaultDatabase}" placeholder="Enter database name">
                    </div>
                </div>

                <!-- SQLite Section -->
                <div class="form-section sqlite-fields hidden">
                    <div class="form-section-title">Database File</div>

                    <div class="form-group">
                        <label for="filePath">File Path</label>
                        <input type="text" id="filePath" name="filePath" value="${defaultFilePath}" placeholder="/path/to/database.db">
                        <div class="help-text">Full path to your SQLite database file</div>
                    </div>
                </div>

                <!-- Authentication Section -->
                <div class="form-section auth-fields">
                    <div class="form-section-title">Authentication</div>

                    <div class="form-group">
                        <label for="user">Username</label>
                        <input type="text" id="user" name="user" value="${defaultUser}" placeholder="Enter username">
                    </div>

                    <div class="form-group">
                        <label for="password">Password ${isEditing ? '<span class="label-badge">Leave empty to keep existing</span>' : ''}</label>
                        <input type="password" id="password" name="password" placeholder="${isEditing ? '••••••••' : 'Enter password'}">
                    </div>

                    <!-- MongoDB specific -->
                    <div class="form-group mongodb-fields hidden">
                        <label for="authDatabase">Auth Database <span class="label-badge">Optional</span></label>
                        <input type="text" id="authDatabase" name="authDatabase" value="${defaultAuthDatabase}" placeholder="admin">
                        <div class="help-text">Database to authenticate against (default: admin)</div>
                    </div>
                </div>

                <!-- Options Section -->
                <div class="form-section">
                    <div class="form-section-title">Options</div>

                    <div class="checkbox-group" onclick="document.getElementById('readOnly').click()">
                        <input type="checkbox" id="readOnly" name="readOnly" ${defaultReadOnly ? 'checked' : ''} onclick="event.stopPropagation()">
                        <label for="readOnly" onclick="event.stopPropagation()">
                            <strong>Read-only mode</strong>
                            <div class="help-text" style="margin-top: 2px;">Blocks INSERT, UPDATE, DELETE operations</div>
                        </label>
                        <span class="checkbox-icon">🔒</span>
                    </div>
                </div>

                <!-- Production Warning -->
                <div class="warning-box" id="productionWarning">
                    <span class="warning-icon">⚠️</span>
                    <div class="warning-content">
                        <h4>Production Database Detected</h4>
                        <p>This appears to be a production database. Consider enabling read-only mode to prevent accidental data changes.</p>
                    </div>
                </div>

                <!-- Status Message -->
                <div class="status-message" id="statusMessage">
                    <span class="status-icon" id="statusIcon"></span>
                    <span id="statusText"></span>
                </div>

                <!-- Buttons -->
                <div class="button-group">
                    <button type="button" id="testBtn" class="btn-test">
                        <span id="testBtnText">Test Connection</span>
                    </button>
                    <div class="spacer"></div>
                    <button type="button" id="cancelBtn" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">${isEditing ? 'Update Connection' : 'Save Connection'}</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Media URI for database icons
        const mediaUri = '${iconBaseUri}';

        // Icon paths for each database type (SVG for better quality)
        const dbIcons = {
            postgres: mediaUri + '/postgres.svg',
            mysql: mediaUri + '/mysql.svg',
            sqlserver: mediaUri + '/sqlserver.svg',
            sqlite: mediaUri + '/sqlite.svg',
            mongodb: mediaUri + '/mongodb.svg'
        };

        // Database type configurations
        const dbTypeConfig = {
            postgres: { name: 'PostgreSQL', color: '#336791', defaultPort: 5432, subtitle: 'Configure your PostgreSQL connection' },
            mysql: { name: 'MySQL', color: '#00618a', defaultPort: 3306, subtitle: 'Configure your MySQL connection' },
            sqlserver: { name: 'SQL Server', color: '#cc2927', defaultPort: 1433, subtitle: 'Configure your SQL Server connection' },
            sqlite: { name: 'SQLite', color: '#003b57', defaultPort: 0, subtitle: 'Select your SQLite database file' },
            mongodb: { name: 'MongoDB', color: '#13aa52', defaultPort: 27017, subtitle: 'Configure your MongoDB connection' }
        };

        // DOM Elements
        const form = document.getElementById('connectionForm');
        const dbTypeInput = document.getElementById('dbType');
        const headerIcon = document.getElementById('headerIcon');
        const formSubtitle = document.getElementById('formSubtitle');
        const nameInput = document.getElementById('name');
        const hostInput = document.getElementById('host');
        const portInput = document.getElementById('port');
        const databaseInput = document.getElementById('database');
        const readOnlyCheckbox = document.getElementById('readOnly');
        const productionWarning = document.getElementById('productionWarning');
        const statusMessage = document.getElementById('statusMessage');
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');
        const testBtn = document.getElementById('testBtn');
        const testBtnText = document.getElementById('testBtnText');
        const cancelBtn = document.getElementById('cancelBtn');

        // Handle database type selection
        document.querySelectorAll('.db-type-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                if (!type) return;

                // Update selection UI
                document.querySelectorAll('.db-type-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                // Update hidden input
                dbTypeInput.value = type;

                // Update form
                updateFormForDbType(type);
            });
        });

        function updateFormForDbType(type) {
            const config = dbTypeConfig[type];
            if (!config) return;

            // Update header with PNG icon
            headerIcon.innerHTML = '<img src="' + dbIcons[type] + '" alt="' + config.name + '" />';
            headerIcon.className = 'form-header-icon';
            formSubtitle.textContent = config.subtitle;

            // Show/hide field sections
            const isSQLite = type === 'sqlite';
            const isMongoDB = type === 'mongodb';

            document.querySelectorAll('.server-fields').forEach(el => {
                el.classList.toggle('hidden', isSQLite);
            });
            document.querySelectorAll('.sqlite-fields').forEach(el => {
                el.classList.toggle('hidden', !isSQLite);
            });
            document.querySelectorAll('.auth-fields').forEach(el => {
                el.classList.toggle('hidden', isSQLite);
            });
            document.querySelectorAll('.mongodb-fields').forEach(el => {
                el.classList.toggle('hidden', !isMongoDB);
            });

            // Update default port when switching database types
            if (!isSQLite && config.defaultPort) {
                portInput.value = config.defaultPort;
            }
        }

        // Production detection
        function checkProductionWarning() {
            const name = nameInput.value.toLowerCase();
            const host = hostInput.value.toLowerCase();
            const database = databaseInput.value.toLowerCase();
            const isReadOnly = readOnlyCheckbox.checked;

            const keywords = ['prod', 'production', 'live', 'main', 'master'];
            const isPossiblyProduction = keywords.some(k =>
                name.includes(k) || host.includes(k) || database.includes(k)
            );

            productionWarning.classList.toggle('show', isPossiblyProduction && !isReadOnly);
        }

        // Status messages
        function showStatus(message, type) {
            const icons = {
                success: '✓',
                error: '✗',
                testing: ''
            };

            statusMessage.className = 'status-message show ' + type;
            statusIcon.textContent = icons[type] || '';

            if (type === 'testing') {
                statusIcon.innerHTML = '<span class="spinner"></span>';
            }

            statusText.textContent = message;

            if (type === 'success' || type === 'error') {
                setTimeout(() => {
                    statusMessage.classList.remove('show');
                }, 5000);
            }
        }

        // Form submission
        function submitForm() {
            const formData = new FormData(form);
            const dbType = formData.get('dbType') || 'postgres';

            // Validation for server-based DBs
            if (dbType !== 'sqlite') {
                const host = formData.get('host');
                const port = formData.get('port');
                const database = formData.get('database');

                if (!host || !port || !database) {
                    showStatus('Please fill in all required fields', 'error');
                    return;
                }

                const portNum = parseInt(port, 10);
                if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
                    showStatus('Please enter a valid port number (1-65535)', 'error');
                    return;
                }
            } else {
                const filePath = formData.get('filePath');
                if (!filePath) {
                    showStatus('Please enter the database file path', 'error');
                    return;
                }
            }

            vscode.postMessage({
                command: 'submit',
                dbType: formData.get('dbType'),
                name: formData.get('name'),
                host: formData.get('host'),
                port: formData.get('port'),
                database: formData.get('database'),
                user: formData.get('user'),
                password: formData.get('password'),
                filePath: formData.get('filePath'),
                authDatabase: formData.get('authDatabase'),
                readOnly: formData.get('readOnly') === 'on',
                saveConnection: true
            });
        }

        // Test connection
        function testConnection() {
            const formData = new FormData(form);
            const dbType = formData.get('dbType') || 'postgres';

            // Validation
            if (dbType !== 'sqlite') {
                const host = formData.get('host');
                const port = formData.get('port');

                if (!host || !port) {
                    showStatus('Please fill in host and port', 'error');
                    return;
                }
            } else {
                const filePath = formData.get('filePath');
                if (!filePath) {
                    showStatus('Please enter the database file path', 'error');
                    return;
                }
            }

            showStatus('Testing connection...', 'testing');
            testBtn.disabled = true;

            vscode.postMessage({
                command: 'testConnection',
                dbType: formData.get('dbType'),
                name: formData.get('name'),
                host: formData.get('host'),
                port: formData.get('port'),
                database: formData.get('database'),
                user: formData.get('user'),
                password: formData.get('password'),
                filePath: formData.get('filePath'),
                authDatabase: formData.get('authDatabase'),
                readOnly: formData.get('readOnly') === 'on'
            });
        }

        // Event listeners
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm();
        });

        testBtn.addEventListener('click', testConnection);
        cancelBtn.addEventListener('click', () => vscode.postMessage({ command: 'cancel' }));

        nameInput.addEventListener('input', checkProductionWarning);
        hostInput.addEventListener('input', checkProductionWarning);
        databaseInput.addEventListener('input', checkProductionWarning);
        readOnlyCheckbox.addEventListener('change', checkProductionWarning);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'testResult':
                    testBtn.disabled = false;
                    if (message.success) {
                        showStatus(message.message, 'success');
                    } else {
                        showStatus(message.message, 'error');
                    }
                    break;
            }
        });

        // Initialize - ensure first option (or saved type) is selected
        const initialDbType = '${dbType}' || 'postgres';

        // Ensure the correct button is visually selected
        document.querySelectorAll('.db-type-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.type === initialDbType) {
                btn.classList.add('selected');
            }
        });

        // Set the hidden input value
        dbTypeInput.value = initialDbType;

        // Update form UI for the selected database type
        updateFormForDbType(initialDbType);
        checkProductionWarning();
    </script>
</body>
</html>`;
}
