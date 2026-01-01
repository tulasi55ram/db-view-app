import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { getElectronAPI } from "../../electron";
import type { DatabaseConnectionConfig } from "@dbview/types";
import clsx from "clsx";

interface AddConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

type DatabaseType = "postgres" | "mysql" | "sqlserver" | "sqlite" | "mongodb" | "redis";

const DATABASE_TYPES: { value: DatabaseType; label: string; icon: string }[] = [
  { value: "postgres", label: "PostgreSQL", icon: "🐘" },
  { value: "mysql", label: "MySQL", icon: "🐬" },
  { value: "sqlserver", label: "SQL Server", icon: "🗄️" },
  { value: "sqlite", label: "SQLite", icon: "📦" },
  { value: "mongodb", label: "MongoDB", icon: "🍃" },
  { value: "redis", label: "Redis", icon: "🔴" },
];

export function AddConnectionDialog({ isOpen, onClose, onSave }: AddConnectionDialogProps) {
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [filePath, setFilePath] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const api = getElectronAPI();

  const getDefaultPort = (type: DatabaseType): string => {
    switch (type) {
      case "postgres":
        return "5432";
      case "mysql":
        return "3306";
      case "sqlserver":
        return "1433";
      case "mongodb":
        return "27017";
      case "redis":
        return "6379";
      default:
        return "";
    }
  };

  const handleDbTypeChange = (type: DatabaseType) => {
    setDbType(type);
    setPort(getDefaultPort(type));
    setTestResult(null);
  };

  const buildConfig = (): DatabaseConnectionConfig => {
    const baseName = name || `${dbType}-${Date.now()}`;

    switch (dbType) {
      case "postgres":
        return {
          dbType: "postgres",
          name: baseName,
          host,
          port: parseInt(port),
          database,
          user,
          password,
        };
      case "mysql":
        return {
          dbType: "mysql",
          name: baseName,
          host,
          port: parseInt(port),
          database,
          user,
          password,
        };
      case "sqlserver":
        return {
          dbType: "sqlserver",
          name: baseName,
          host,
          port: parseInt(port),
          database,
          user,
          password,
          options: { encrypt: false, trustServerCertificate: true },
        };
      case "sqlite":
        return {
          dbType: "sqlite",
          name: baseName,
          filePath,
        };
      case "mongodb":
        return {
          dbType: "mongodb",
          name: baseName,
          connectionString: connectionString || `mongodb://${host}:${port}/${database}`,
        };
      case "redis":
        return {
          dbType: "redis",
          name: baseName,
          host,
          port: parseInt(port),
          database: parseInt(database) || 0,
          password: password || undefined,
        };
      default:
        throw new Error(`Unknown database type: ${dbType}`);
    }
  };

  const handleTest = async () => {
    if (!api) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const config = buildConfig();
      const result = await api.testConnection(config);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!api) return;
    setIsSaving(true);
    try {
      const config = buildConfig();
      await api.saveConnection(config);
      onSave();
      resetForm();
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseSqlite = async () => {
    if (!api) return;
    const result = await api.showOpenDialog({
      filters: [
        { name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      setFilePath(result.filePaths[0]);
    }
  };

  const resetForm = () => {
    setName("");
    setHost("localhost");
    setPort(getDefaultPort(dbType));
    setDatabase("");
    setUser("");
    setPassword("");
    setFilePath("");
    setConnectionString("");
    setTestResult(null);
  };

  if (!isOpen) return null;

  const needsHostPort = ["postgres", "mysql", "sqlserver", "redis"].includes(dbType);
  const needsDatabase = ["postgres", "mysql", "sqlserver"].includes(dbType);
  const needsAuth = ["postgres", "mysql", "sqlserver"].includes(dbType);
  const needsFilePath = dbType === "sqlite";
  const needsConnectionString = dbType === "mongodb";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-vscode-editor-background border border-vscode-widget-border rounded-lg shadow-xl w-[480px] max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-widget-border">
          <h2 className="text-lg font-medium">Add Connection</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Database Type Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Database Type</label>
            <div className="grid grid-cols-3 gap-2">
              {DATABASE_TYPES.map((db) => (
                <button
                  key={db.value}
                  onClick={() => handleDbTypeChange(db.value)}
                  className={clsx(
                    "px-3 py-2 rounded border text-sm flex items-center gap-2 transition-colors",
                    dbType === db.value
                      ? "border-vscode-accent bg-vscode-accent/10 text-vscode-accent"
                      : "border-vscode-widget-border hover:border-gray-500"
                  )}
                >
                  <span>{db.icon}</span>
                  <span>{db.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Connection Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Database"
              className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
            />
          </div>

          {/* Host & Port */}
          {needsHostPort && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                  className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder={getDefaultPort(dbType)}
                  className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Database */}
          {needsDatabase && (
            <div>
              <label className="block text-sm font-medium mb-1">Database</label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="my_database"
                className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
              />
            </div>
          )}

          {/* Redis Database (0-15) */}
          {dbType === "redis" && (
            <div>
              <label className="block text-sm font-medium mb-1">Database (0-15)</label>
              <input
                type="number"
                min="0"
                max="15"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
              />
            </div>
          )}

          {/* Username & Password */}
          {needsAuth && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="postgres"
                  className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Redis Password */}
          {dbType === "redis" && (
            <div>
              <label className="block text-sm font-medium mb-1">Password (optional)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
              />
            </div>
          )}

          {/* SQLite File Path */}
          {needsFilePath && (
            <div>
              <label className="block text-sm font-medium mb-1">Database File</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="/path/to/database.db"
                  className="flex-1 px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
                />
                <button
                  onClick={handleBrowseSqlite}
                  className="px-3 py-2 rounded border border-vscode-input-border hover:bg-vscode-toolbar-hoverBackground"
                >
                  Browse
                </button>
              </div>
            </div>
          )}

          {/* MongoDB Connection String */}
          {needsConnectionString && (
            <div>
              <label className="block text-sm font-medium mb-1">Connection String</label>
              <input
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="mongodb://localhost:27017/mydb"
                className="w-full px-3 py-2 rounded border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground focus:border-vscode-accent focus:outline-none"
              />
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={clsx(
                "px-3 py-2 rounded text-sm",
                testResult.success ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"
              )}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-vscode-widget-border">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 rounded border border-vscode-button-border hover:bg-vscode-toolbar-hoverBackground disabled:opacity-50 flex items-center gap-2"
          >
            {isTesting && <Loader2 className="w-4 h-4 animate-spin" />}
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded bg-vscode-accent hover:bg-vscode-accent/90 text-white disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
