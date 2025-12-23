import * as vscode from "vscode";
import type { ConnectionConfig, DatabaseConnectionConfig, DatabaseType } from "@dbview/core";
import { saveConnectionWithName } from "./connectionSettings";
import { DatabaseAdapterFactory } from "./adapters/DatabaseAdapterFactory";

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
      "Configure Database Connection",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    console.log("[dbview] Webview panel created, setting HTML content");
    panel.webview.html = getWebviewContent(defaults);
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
            const connection: DatabaseConnectionConfig = {
              dbType,
              name: message.name || undefined,
              host: message.host,
              port: parseInt(message.port, 10),
              database: message.database,
              user: message.user,
              password,
              readOnly: message.readOnly || false
            } as DatabaseConnectionConfig;

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
              // If editing an existing connection and password is empty, retrieve from secrets
              let testPassword = message.password || undefined;
              if (!testPassword) {
                // Try named connection key first
                if (defaults?.name) {
                  console.log("[dbview] No password provided for test, checking secrets for existing connection:", defaults.name);
                  const storedPassword = await context.secrets.get(`dbview.connection.${defaults.name}.password`);
                  if (storedPassword) {
                    console.log("[dbview] Found stored password for connection test");
                    testPassword = storedPassword;
                  }
                }
                // Fall back to legacy key if still no password
                if (!testPassword) {
                  console.log("[dbview] Checking legacy password key for test");
                  const legacyPassword = await context.secrets.get("dbview.connection.password");
                  if (legacyPassword) {
                    console.log("[dbview] Found password from legacy key for test");
                    testPassword = legacyPassword;
                  }
                }
              }

              const dbType = message.dbType || 'postgres';
              const testConfig: DatabaseConnectionConfig = {
                dbType,
                name: message.name || undefined,
                host: message.host,
                port: parseInt(message.port, 10),
                database: message.database,
                user: message.user,
                password: testPassword,
                readOnly: message.readOnly || false
              } as DatabaseConnectionConfig;

              // Create adapter and test connection
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
      } else {
        console.log("[dbview] Panel disposed after explicit resolution, ignoring");
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

function getWebviewContent(defaults?: Partial<ConnectionConfig | DatabaseConnectionConfig>): string {
  // Determine the database type
  const dbType = (defaults && 'dbType' in defaults) ? defaults.dbType : 'postgres';

  const defaultName = escapeHtml(defaults?.name ?? "");
  const defaultHost = escapeHtml((defaults && 'host' in defaults ? defaults.host : undefined) ?? "localhost");
  const defaultPort = (defaults && 'port' in defaults ? defaults.port : undefined) ?? (dbType === 'mysql' ? 3306 : 5432);
  const defaultDatabase = escapeHtml((defaults && 'database' in defaults ? defaults.database : undefined) ?? (dbType === 'mysql' ? 'mysql' : 'postgres'));
  const defaultUser = escapeHtml((defaults && 'user' in defaults ? defaults.user : undefined) ?? (dbType === 'mysql' ? 'root' : 'postgres'));
  const defaultReadOnly = defaults?.readOnly ?? false;
  const isEditing = Boolean(defaults?.name);

  console.log("[dbview] Webview defaults:", { dbType, defaultName, defaultHost, defaultPort, defaultDatabase, defaultUser, defaultReadOnly, isEditing });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure Database Connection</title>
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
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
        }

        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .subtitle {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 32px;
            font-size: 14px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            font-size: 13px;
            color: var(--vscode-foreground);
        }

        input[type="text"],
        input[type="number"],
        input[type="password"],
        select {
            width: 100%;
            padding: 8px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            font-family: var(--vscode-font-family);
            font-size: 13px;
            outline: none;
        }

        select {
            cursor: pointer;
        }

        select option:disabled {
            color: var(--vscode-disabledForeground);
        }

        input:focus,
        select:focus {
            border-color: var(--vscode-focusBorder);
        }

        .checkbox-group {
            margin: 24px 0;
            display: flex;
            align-items: center;
        }

        .checkbox-group input[type="checkbox"] {
            margin-right: 8px;
            cursor: pointer;
        }

        .checkbox-group label {
            margin: 0;
            cursor: pointer;
            font-weight: normal;
        }

        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 32px;
        }

        button {
            padding: 8px 16px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            border: none;
            cursor: pointer;
            outline: none;
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

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .row {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 12px;
        }

        .error {
            color: var(--vscode-errorForeground);
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }

        .error.show {
            display: block;
        }

        .success {
            color: var(--vscode-testing-iconPassed);
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }

        .success.show {
            display: block;
        }

        .status-message {
            padding: 8px 12px;
            margin: 16px 0;
            border-radius: 4px;
            font-size: 13px;
            display: none;
        }

        .status-message.show {
            display: block;
        }

        .status-message.success {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }

        .status-message.error {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .status-message.testing {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .status-message.warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
        }

        .btn-test {
            background-color: transparent;
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
        }

        .btn-test:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn-test:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Configure Database Connection</h1>
        <p class="subtitle" id="subtitle">Enter your database connection details</p>

        <form id="connectionForm">
            <div class="form-group">
                <label for="dbType">Database Type</label>
                <select id="dbType" name="dbType">
                    <option value="postgres" ${dbType === 'postgres' ? 'selected' : ''}>🐘 PostgreSQL</option>
                    <option value="mysql" ${dbType === 'mysql' ? 'selected' : ''}>🐬 MySQL</option>
                    <option value="sqlserver" disabled>🗄️ SQL Server (Coming Soon)</option>
                    <option value="sqlite" disabled>🪶 SQLite (Coming Soon)</option>
                    <option value="mongodb" disabled>🍃 MongoDB (Coming Soon)</option>
                </select>
                <div class="help-text">Select the type of database you want to connect to</div>
            </div>

            <div class="form-group">
                <label for="name">Connection Name (optional)</label>
                <input type="text" id="name" name="name" value="${defaultName}" placeholder="e.g., Production, Development">
                <div class="help-text">Give this connection a name to save and switch between multiple connections</div>
            </div>

            <div class="row">
                <div class="form-group">
                    <label for="host">Host</label>
                    <input type="text" id="host" name="host" value="${defaultHost}" required>
                    <div class="help-text">Database server hostname or IP address</div>
                </div>

                <div class="form-group">
                    <label for="port">Port</label>
                    <input type="number" id="port" name="port" value="${defaultPort}" required>
                </div>
            </div>

            <div class="form-group">
                <label for="database">Database Name</label>
                <input type="text" id="database" name="database" value="${defaultDatabase}" required>
                <div class="help-text">Name of the database to connect to</div>
            </div>

            <div class="form-group">
                <label for="user">Username</label>
                <input type="text" id="user" name="user" value="${defaultUser}" required>
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" autocomplete="off" placeholder="${isEditing ? "Leave empty to keep existing password" : ""}">
                <div class="help-text">${isEditing ? "Leave empty to keep the existing password, or enter a new one to change it" : "Leave empty if no password is required"}</div>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="saveConnection" name="saveConnection" checked>
                <label for="saveConnection">Save connection for future sessions</label>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="readOnly" name="readOnly" ${defaultReadOnly ? "checked" : ""}>
                <label for="readOnly">🔒 Read-only mode (block INSERT, UPDATE, DELETE)</label>
            </div>
            <div class="help-text" style="margin-top: -12px; margin-bottom: 16px; margin-left: 24px;">Enable for production databases to prevent accidental data changes</div>

            <div id="productionWarning" class="status-message warning" style="display: none;">
                ⚠️ This looks like a production database. Consider enabling read-only mode.
            </div>

            <div id="statusMessage" class="status-message"></div>

            <div class="button-group">
                <button type="button" id="testBtn" class="btn-test">Test Connection</button>
                <button type="submit" class="btn-primary">Connect</button>
                <button type="button" id="saveBtn" class="btn-primary">Save Connection</button>
                <button type="button" id="cancelBtn" class="btn-secondary">Cancel</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const form = document.getElementById('connectionForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const testBtn = document.getElementById('testBtn');
        const saveBtn = document.getElementById('saveBtn');
        const statusMessage = document.getElementById('statusMessage');
        const productionWarning = document.getElementById('productionWarning');
        const nameInput = document.getElementById('name');
        const hostInput = document.getElementById('host');
        const portInput = document.getElementById('port');
        const databaseInput = document.getElementById('database');
        const userInput = document.getElementById('user');
        const readOnlyCheckbox = document.getElementById('readOnly');
        const dbTypeSelect = document.getElementById('dbType');
        const subtitleElement = document.getElementById('subtitle');

        // Database type configuration
        const dbTypeConfig = {
            postgres: {
                name: 'PostgreSQL',
                defaultPort: 5432,
                defaultDatabase: 'postgres',
                defaultUser: 'postgres',
                subtitle: 'Enter your PostgreSQL database connection details'
            },
            mysql: {
                name: 'MySQL',
                defaultPort: 3306,
                defaultDatabase: 'mysql',
                defaultUser: 'root',
                subtitle: 'Enter your MySQL database connection details'
            },
            sqlserver: {
                name: 'SQL Server',
                defaultPort: 1433,
                defaultDatabase: 'master',
                defaultUser: 'sa',
                subtitle: 'Enter your SQL Server database connection details'
            },
            sqlite: {
                name: 'SQLite',
                defaultPort: 0,
                defaultDatabase: '',
                defaultUser: '',
                subtitle: 'Select your SQLite database file'
            },
            mongodb: {
                name: 'MongoDB',
                defaultPort: 27017,
                defaultDatabase: 'admin',
                defaultUser: '',
                subtitle: 'Enter your MongoDB connection details'
            }
        };

        // Handle database type change
        function handleDatabaseTypeChange() {
            const selectedType = dbTypeSelect.value;
            const config = dbTypeConfig[selectedType];

            if (!config) return;

            // Update subtitle
            if (subtitleElement) {
                subtitleElement.textContent = config.subtitle;
            }

            // Update default port if current port matches another database's default
            const currentPort = parseInt(portInput.value, 10);
            const isDefaultPort = Object.values(dbTypeConfig).some(c => c.defaultPort === currentPort);

            if (!currentPort || isDefaultPort) {
                portInput.value = config.defaultPort;
            }

            // Update database and user placeholders if they are empty or contain defaults
            const currentDatabase = databaseInput.value.toLowerCase();
            const isDefaultDatabase = Object.values(dbTypeConfig).some(c =>
                c.defaultDatabase && currentDatabase === c.defaultDatabase.toLowerCase()
            );

            if (!currentDatabase || isDefaultDatabase) {
                databaseInput.value = config.defaultDatabase;
            }

            const currentUser = userInput.value.toLowerCase();
            const isDefaultUser = Object.values(dbTypeConfig).some(c =>
                c.defaultUser && currentUser === c.defaultUser.toLowerCase()
            );

            if (!currentUser || isDefaultUser) {
                userInput.value = config.defaultUser;
            }

            console.log('[dbview-webview] Database type changed to:', selectedType);
        }

        // Listen for database type changes
        dbTypeSelect.addEventListener('change', handleDatabaseTypeChange);

        // Production database detection
        const productionKeywords = ['prod', 'production', 'live', 'main', 'master'];

        function checkProductionWarning() {
            const name = nameInput.value.toLowerCase();
            const host = hostInput.value.toLowerCase();
            const database = databaseInput.value.toLowerCase();
            const isReadOnly = readOnlyCheckbox.checked;

            const isPossiblyProduction = productionKeywords.some(keyword =>
                name.includes(keyword) || host.includes(keyword) || database.includes(keyword)
            );

            if (isPossiblyProduction && !isReadOnly) {
                productionWarning.style.display = 'block';
            } else {
                productionWarning.style.display = 'none';
            }
        }

        // Check on input changes
        nameInput.addEventListener('input', checkProductionWarning);
        hostInput.addEventListener('input', checkProductionWarning);
        databaseInput.addEventListener('input', checkProductionWarning);
        readOnlyCheckbox.addEventListener('change', checkProductionWarning);

        // Initial check
        checkProductionWarning();

        function submitForm({ forceSave = false } = {}) {
            console.log('[dbview-webview] submitForm called, forceSave:', forceSave);
            const formData = new FormData(form);
            const dbType = formData.get('dbType') || 'postgres';
            const name = formData.get('name');
            const host = formData.get('host');
            const port = formData.get('port');
            const database = formData.get('database');
            const user = formData.get('user');
            const password = formData.get('password');
            const saveConnectionCheckbox = formData.get('saveConnection') === 'on';
            const saveConnection = forceSave ? true : saveConnectionCheckbox;
            const readOnly = formData.get('readOnly') === 'on';

            console.log('[dbview-webview] Form data:', { dbType, name, host, port, database, user, saveConnection });

            // Basic validation
            if (!host || !port || !database || !user) {
                console.log('[dbview-webview] Validation failed: missing required fields');
                showStatus('Please fill in all required fields', 'error');
                return;
            }

            if (forceSave && !name?.trim()) {
                console.log('[dbview-webview] Validation failed: name required for save');
                showStatus('Enter a connection name to save it', 'error');
                return;
            }

            const portNum = parseInt(port, 10);
            if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
                console.log('[dbview-webview] Validation failed: invalid port');
                showStatus('Please enter a valid port number (1-65535)', 'error');
                return;
            }

            console.log('[dbview-webview] Validation passed, posting message to extension');
            vscode.postMessage({
                command: 'submit',
                dbType,
                name,
                host,
                port,
                database,
                user,
                password,
                saveConnection,
                readOnly
            });
            console.log('[dbview-webview] Message posted');
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm();
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                submitForm({ forceSave: true });
            });
        }

        testBtn.addEventListener('click', () => {
            const formData = new FormData(form);
            const dbType = formData.get('dbType') || 'postgres';
            const name = formData.get('name');
            const host = formData.get('host');
            const port = formData.get('port');
            const database = formData.get('database');
            const user = formData.get('user');
            const password = formData.get('password');
            const readOnly = formData.get('readOnly') === 'on';

            // Basic validation
            if (!host || !port || !database || !user) {
                showStatus('Please fill in all required fields', 'error');
                return;
            }

            const portNum = parseInt(port, 10);
            if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
                showStatus('Please enter a valid port number (1-65535)', 'error');
                return;
            }

            showStatus('Testing connection...', 'testing');
            testBtn.disabled = true;

            vscode.postMessage({
                command: 'testConnection',
                dbType,
                name,
                host,
                port,
                database,
                user,
                password,
                readOnly
            });
        });

        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });

        function showStatus(message, type) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message show ' + type;

            if (type === 'success' || type === 'error') {
                setTimeout(() => {
                    statusMessage.classList.remove('show');
                }, 5000);
            }
        }

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'testResult':
                    testBtn.disabled = false;
                    if (message.success) {
                        showStatus('✓ ' + message.message, 'success');
                    } else {
                        showStatus('✗ ' + message.message, 'error');
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
}
