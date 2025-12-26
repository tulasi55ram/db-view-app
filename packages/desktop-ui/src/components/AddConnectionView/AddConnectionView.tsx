import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, FolderOpen, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getElectronAPI } from "@/electron";
import type { DatabaseConnectionConfig } from "@dbview/core";
import { cn } from "@/utils/cn";

interface AddConnectionViewProps {
  onSave: () => void;
  onCancel?: () => void;
}

type DatabaseType = "postgres" | "mysql" | "sqlserver" | "sqlite" | "mongodb" | "redis";

interface DatabaseTypeInfo {
  value: DatabaseType;
  label: string;
  description: string;
  color: string;
}

const DATABASE_TYPES: DatabaseTypeInfo[] = [
  { value: "postgres", label: "PostgreSQL", description: "Advanced open-source relational database", color: "#336791" },
  { value: "mysql", label: "MySQL", description: "Popular open-source relational database", color: "#00758F" },
  { value: "sqlserver", label: "SQL Server", description: "Microsoft SQL Server database", color: "#CC2927" },
  { value: "sqlite", label: "SQLite", description: "Lightweight embedded database", color: "#003B57" },
  { value: "mongodb", label: "MongoDB", description: "NoSQL document database", color: "#00ED64" },
  { value: "redis", label: "Redis", description: "In-memory key-value data store", color: "#DC382D" },
];

// Database Icon
function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

// Form Field Component
function FormField({
  label,
  hint,
  children,
  className
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <label className="block text-sm font-medium text-text-primary">
          {label}
        </label>
        {hint && (
          <span className="text-xs text-text-tertiary">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// Input Component
function StyledInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full h-10 px-3 rounded-lg text-sm",
        "bg-bg-tertiary border border-border",
        "text-text-primary placeholder:text-text-tertiary",
        "transition-all duration-150",
        "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20",
        "hover:border-neutral-600",
        className
      )}
      {...props}
    />
  );
}

export function AddConnectionView({ onSave, onCancel }: AddConnectionViewProps) {
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
      case "postgres": return "5432";
      case "mysql": return "3306";
      case "sqlserver": return "1433";
      case "mongodb": return "27017";
      case "redis": return "6379";
      default: return "";
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
        return { dbType: "postgres", name: baseName, host, port: parseInt(port), database, user, password };
      case "mysql":
        return { dbType: "mysql", name: baseName, host, port: parseInt(port), database, user, password };
      case "sqlserver":
        return { dbType: "sqlserver", name: baseName, host, port: parseInt(port), database, user, password, authenticationType: "sql" as const };
      case "sqlite":
        return { dbType: "sqlite", name: baseName, filePath };
      case "mongodb":
        return { dbType: "mongodb", name: baseName, database: database || "test", connectionString: connectionString || `mongodb://${host}:${port}/${database || "test"}` };
      case "redis":
        return { dbType: "redis", name: baseName, host, port: parseInt(port), database: parseInt(database) || 0, password: password || undefined };
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
      setTestResult({ success: false, message: error instanceof Error ? error.message : String(error) });
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
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : String(error) });
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

  const currentDbInfo = DATABASE_TYPES.find(db => db.value === dbType)!;
  const needsHostPort = ["postgres", "mysql", "sqlserver", "redis"].includes(dbType);
  const needsDatabase = ["postgres", "mysql", "sqlserver", "mongodb"].includes(dbType);
  const needsAuth = ["postgres", "mysql", "sqlserver"].includes(dbType);
  const needsFilePath = dbType === "sqlite";
  const needsConnectionString = dbType === "mongodb";

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-primary">
      {/* Left Panel - Database Types */}
      <div className="w-[280px] border-r border-border bg-bg-secondary flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <h2 className="text-lg font-semibold text-text-primary">New Connection</h2>
          <p className="text-sm text-text-tertiary mt-1">Choose a database type</p>
        </div>

        {/* Database Type List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {DATABASE_TYPES.map((db) => (
              <button
                key={db.value}
                onClick={() => handleDbTypeChange(db.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-lg text-left transition-all duration-150",
                  "flex items-center gap-4",
                  dbType === db.value
                    ? "bg-accent/10 ring-1 ring-accent/30"
                    : "hover:bg-bg-hover"
                )}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${db.color}15`,
                    color: db.color
                  }}
                >
                  <DatabaseIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-medium",
                    dbType === db.value ? "text-text-primary" : "text-text-secondary"
                  )}>
                    {db.label}
                  </div>
                  <div className="text-xs text-text-tertiary truncate mt-0.5">
                    {db.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Connection Form */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Form Header */}
        <div className="px-8 py-5 border-b border-border bg-bg-secondary/50">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${currentDbInfo.color}15`, color: currentDbInfo.color }}
            >
              <DatabaseIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">{currentDbInfo.label} Connection</h3>
              <p className="text-sm text-text-tertiary">{currentDbInfo.description}</p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl px-8 py-6 space-y-5">
            {/* Connection Name */}
            <FormField label="Connection Name" hint="Optional">
              <StyledInput
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`My ${currentDbInfo.label} Database`}
              />
            </FormField>

            {/* Host & Port */}
            {needsHostPort && (
              <div className="grid grid-cols-4 gap-4">
                <FormField label="Host" className="col-span-3">
                  <StyledInput
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost or IP address"
                  />
                </FormField>
                <FormField label="Port">
                  <StyledInput
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder={getDefaultPort(dbType)}
                  />
                </FormField>
              </div>
            )}

            {/* Database */}
            {needsDatabase && (
              <FormField label="Database">
                <StyledInput
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="database_name"
                />
              </FormField>
            )}

            {/* Redis Database */}
            {dbType === "redis" && (
              <FormField label="Database Index" hint="0-15">
                <StyledInput
                  type="number"
                  min={0}
                  max={15}
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="0"
                />
              </FormField>
            )}

            {/* Authentication */}
            {needsAuth && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Username">
                  <StyledInput
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder={dbType === "postgres" ? "postgres" : "root"}
                  />
                </FormField>
                <FormField label="Password">
                  <StyledInput
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </FormField>
              </div>
            )}

            {/* Redis Password */}
            {dbType === "redis" && (
              <FormField label="Password" hint="Optional">
                <StyledInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </FormField>
            )}

            {/* SQLite File Path */}
            {needsFilePath && (
              <FormField label="Database File">
                <div className="flex gap-3">
                  <StyledInput
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="/path/to/database.db"
                    className="flex-1"
                  />
                  <button
                    onClick={handleBrowseSqlite}
                    className={cn(
                      "h-10 px-4 rounded-lg flex items-center gap-2",
                      "bg-bg-tertiary border border-border",
                      "text-sm font-medium text-text-secondary",
                      "hover:bg-bg-hover hover:text-text-primary transition-colors"
                    )}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
              </FormField>
            )}

            {/* MongoDB Connection String */}
            {needsConnectionString && (
              <FormField label="Connection String" hint="Optional - overrides above fields">
                <StyledInput
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="mongodb://localhost:27017/mydb"
                />
              </FormField>
            )}

            {/* Test Result */}
            <AnimatePresence>
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 rounded-lg",
                    testResult.success
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  )}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      testResult.success ? "text-emerald-400" : "text-red-400"
                    )}>
                      {testResult.success ? "Connection successful!" : "Connection failed"}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1 break-words">
                      {testResult.message}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Form Footer */}
        <div className="px-8 py-4 border-t border-border bg-bg-secondary/30 flex items-center justify-between">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className={cn(
              "h-10 px-5 rounded-lg flex items-center gap-2",
              "text-sm font-medium",
              "bg-bg-tertiary border border-border",
              "text-text-secondary hover:text-text-primary",
              "hover:bg-bg-hover transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-current" />
            )}
            Test Connection
          </button>

          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className={cn(
                  "h-10 px-5 rounded-lg",
                  "text-sm font-medium text-text-secondary",
                  "hover:bg-bg-hover transition-colors"
                )}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "h-10 px-6 rounded-lg flex items-center gap-2",
                "text-sm font-medium",
                "bg-accent hover:bg-accent/90",
                "text-white transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
