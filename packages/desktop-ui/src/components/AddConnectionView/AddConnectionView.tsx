import { useState, useEffect, useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, FolderOpen, ArrowLeft, Lock, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getElectronAPI } from "@/electron";
import type { DatabaseConnectionConfig } from "@dbview/types";
import { cn } from "@/utils/cn";
import { ColorPicker } from "@/components/ColorPicker";

interface AddConnectionViewProps {
  onSave: () => void;
  onCancel?: () => void;
  editingConnectionKey?: string | null;
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

export function AddConnectionView({ onSave, onCancel, editingConnectionKey }: AddConnectionViewProps) {
  const isEditMode = !!editingConnectionKey;
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [filePath, setFilePath] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [authDatabase, setAuthDatabase] = useState("");
  // SSL/Security options
  const [ssl, setSsl] = useState(false);
  const [sslMode, setSslMode] = useState<"disable" | "require" | "verify-ca" | "verify-full">("require");
  // SQL Server specific
  const [instanceName, setInstanceName] = useState("");
  const [authenticationType, setAuthenticationType] = useState<"sql" | "windows">("sql");
  const [domain, setDomain] = useState("");
  const [encrypt, setEncrypt] = useState(true);
  const [trustServerCertificate, setTrustServerCertificate] = useState(false);
  // Redis ACL
  const [redisUsername, setRedisUsername] = useState("");
  const [color, setColor] = useState("#3B82F6"); // Default blue
  const [readOnly, setReadOnly] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const api = getElectronAPI();

  // Detect if connection appears to be production
  const isLikelyProduction = useMemo(() => {
    const productionKeywords = ['prod', 'production', 'live', 'prd'];
    const valuesToCheck = [name.toLowerCase(), host.toLowerCase(), database.toLowerCase()];
    return valuesToCheck.some(value =>
      productionKeywords.some(keyword => value.includes(keyword))
    );
  }, [name, host, database]);

  // Load existing connection data in edit mode
  useEffect(() => {
    if (!isEditMode || !editingConnectionKey || !api) return;

    setIsLoadingConnection(true);
    api.getConnections()
      .then((connections) => {
        const connection = connections.find((c: any) => {
          const key = c.config.name
            ? `${c.config.dbType}:${c.config.name}`
            : c.config.host
            ? `${c.config.dbType}:${c.config.user}@${c.config.host}:${c.config.port}/${c.config.database}`
            : `${c.config.dbType}:${JSON.stringify(c.config)}`;
          return key === editingConnectionKey;
        });

        if (connection) {
          const config = connection.config;

          // Set database type first
          setDbType(config.dbType as DatabaseType);
          setPort(getDefaultPort(config.dbType as DatabaseType));

          // Set common fields
          setName(config.name || "");
          setColor(config.color || "#3B82F6");

          // Set type-specific fields
          if ((config as any).host) {
            setHost((config as any).host);
            setPort(String((config as any).port || ""));
          }
          if ((config as any).database) {
            setDatabase((config as any).database);
          }
          if ((config as any).user) {
            setUser((config as any).user);
          }
          // Don't load password for security
          if ((config as any).filePath) {
            setFilePath((config as any).filePath);
          }
          if ((config as any).connectionString) {
            setConnectionString((config as any).connectionString);
          }
          if ((config as any).authDatabase) {
            setAuthDatabase((config as any).authDatabase);
          }
          if ((config as any).readOnly !== undefined) {
            setReadOnly((config as any).readOnly);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load connection:", err);
        setTestResult({ success: false, message: "Failed to load connection data" });
      })
      .finally(() => {
        setIsLoadingConnection(false);
      });
  }, [isEditMode, editingConnectionKey, api]);

  // Smart color suggestions based on connection name (only in create mode)
  useEffect(() => {
    if (isEditMode) return; // Don't auto-change color in edit mode

    const nameLower = name.toLowerCase();
    if (nameLower.includes("prod") || nameLower.includes("production")) {
      setColor("#EF4444"); // Red for production
    } else if (nameLower.includes("staging") || nameLower.includes("stage")) {
      setColor("#F59E0B"); // Amber for staging
    } else if (nameLower.includes("dev") || nameLower.includes("development")) {
      setColor("#22C55E"); // Green for development
    } else if (nameLower.includes("test") || nameLower.includes("qa")) {
      setColor("#EAB308"); // Yellow for testing
    } else if (nameLower.includes("local")) {
      setColor("#06B6D4"); // Cyan for local
    }
    // If name doesn't match any pattern, keep the currently selected color
  }, [name, isEditMode]);

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
        return {
          dbType: "postgres",
          name: baseName,
          host,
          port: parseInt(port),
          database,
          user,
          password,
          ssl: ssl || undefined,
          sslMode: ssl ? sslMode : undefined,
          color,
          readOnly
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
          ssl: ssl || undefined,
          color,
          readOnly
        };
      case "sqlserver":
        return {
          dbType: "sqlserver",
          name: baseName,
          host,
          port: parseInt(port),
          database,
          user: authenticationType === "sql" ? user : undefined,
          password: authenticationType === "sql" ? password : undefined,
          instanceName: instanceName || undefined,
          authenticationType,
          domain: authenticationType === "windows" ? domain : undefined,
          encrypt,
          trustServerCertificate,
          color,
          readOnly
        };
      case "sqlite":
        return { dbType: "sqlite", name: baseName, filePath, color, readOnly };
      case "mongodb":
        return {
          dbType: "mongodb",
          name: baseName,
          host,
          port: parseInt(port),
          database: database || "test",
          user: user || undefined,
          password: password || undefined,
          authDatabase: authDatabase || undefined,
          connectionString: connectionString || undefined,
          ssl: ssl || undefined,
          color,
          readOnly
        };
      case "redis":
        return {
          dbType: "redis",
          name: baseName,
          host,
          port: parseInt(port),
          database: parseInt(database) || 0,
          username: redisUsername || undefined,
          password: password || undefined,
          ssl: ssl || undefined,
          color,
          readOnly
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
  const needsHostPort = ["postgres", "mysql", "sqlserver", "mongodb", "redis"].includes(dbType);
  const needsDatabase = ["postgres", "mysql", "sqlserver", "mongodb"].includes(dbType);
  const needsAuth = ["postgres", "mysql", "sqlserver", "mongodb"].includes(dbType);
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
          <h2 className="text-lg font-semibold text-text-primary">
            {isEditMode ? "Edit Connection" : "New Connection"}
          </h2>
          <p className="text-sm text-text-tertiary mt-1">
            {isEditMode ? "Update connection settings" : "Choose a database type"}
          </p>
        </div>

        {/* Database Type List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {DATABASE_TYPES.map((db) => (
              <button
                key={db.value}
                onClick={() => !isEditMode && handleDbTypeChange(db.value)}
                disabled={isEditMode}
                className={cn(
                  "w-full px-4 py-3 rounded-lg text-left transition-all duration-150",
                  "flex items-center gap-4",
                  dbType === db.value
                    ? "bg-accent/10 ring-1 ring-accent/30"
                    : "hover:bg-bg-hover",
                  isEditMode && "opacity-50 cursor-not-allowed"
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
        <div className="flex-1 overflow-y-auto relative">
          {isLoadingConnection && (
            <div className="absolute inset-0 bg-bg-primary/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm text-text-secondary">Loading connection...</p>
              </div>
            </div>
          )}
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

            {/* Connection Color */}
            <ColorPicker
              value={color}
              onChange={setColor}
              label="Connection Color"
            />

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

            {/* SQL Server Instance Name */}
            {dbType === "sqlserver" && (
              <FormField label="Instance Name" hint="Optional">
                <StyledInput
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="e.g., SQLEXPRESS"
                />
              </FormField>
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

            {/* SQL Server Authentication Type */}
            {dbType === "sqlserver" && (
              <FormField label="Authentication">
                <select
                  value={authenticationType}
                  onChange={(e) => setAuthenticationType(e.target.value as "sql" | "windows")}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg text-sm",
                    "bg-bg-tertiary border border-border",
                    "text-text-primary",
                    "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  )}
                >
                  <option value="sql">SQL Server Authentication</option>
                  <option value="windows">Windows Authentication</option>
                </select>
              </FormField>
            )}

            {/* Authentication */}
            {needsAuth && (dbType !== "sqlserver" || authenticationType === "sql") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Username" hint={dbType === "mongodb" ? "Optional" : undefined}>
                    <StyledInput
                      type="text"
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      placeholder={dbType === "postgres" ? "postgres" : dbType === "mongodb" ? "admin" : "root"}
                    />
                  </FormField>
                  <FormField label="Password" hint={dbType === "mongodb" ? "Optional" : undefined}>
                    <StyledInput
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </FormField>
                </div>
                {/* MongoDB Auth Database */}
                {dbType === "mongodb" && (
                  <FormField label="Auth Database" hint="Optional - defaults to admin">
                    <StyledInput
                      type="text"
                      value={authDatabase}
                      onChange={(e) => setAuthDatabase(e.target.value)}
                      placeholder="admin"
                    />
                  </FormField>
                )}
              </>
            )}

            {/* SQL Server Windows Authentication Domain */}
            {dbType === "sqlserver" && authenticationType === "windows" && (
              <FormField label="Domain" hint="Optional">
                <StyledInput
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="MYDOMAIN"
                />
                <p className="text-xs text-text-tertiary mt-1">
                  Uses current Windows credentials if not specified
                </p>
              </FormField>
            )}

            {/* Redis Authentication (ACL) */}
            {dbType === "redis" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Username" hint="Optional">
                    <StyledInput
                      type="text"
                      value={redisUsername}
                      onChange={(e) => setRedisUsername(e.target.value)}
                      placeholder="default"
                    />
                  </FormField>
                  <FormField label="Password" hint="Optional">
                    <StyledInput
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </FormField>
                </div>
                <p className="text-xs text-text-tertiary -mt-2">
                  Redis 6+ supports ACL with username. Leave username empty for legacy auth.
                </p>
              </>
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
              <FormField label="Connection String" hint="Optional - overrides host/port/auth">
                <StyledInput
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="mongodb://user:pass@host:27017/db?authSource=admin"
                />
              </FormField>
            )}

            {/* SSL/Security Section */}
            {["postgres", "mysql", "mongodb", "redis"].includes(dbType) && (
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    className="rounded cursor-pointer accent-accent"
                  />
                  <span className="text-sm text-text-secondary">
                    Use SSL/TLS encryption
                  </span>
                </label>
                {/* PostgreSQL SSL Mode */}
                {dbType === "postgres" && ssl && (
                  <FormField label="SSL Mode">
                    <select
                      value={sslMode}
                      onChange={(e) => setSslMode(e.target.value as typeof sslMode)}
                      className={cn(
                        "w-full h-10 px-3 rounded-lg text-sm",
                        "bg-bg-tertiary border border-border",
                        "text-text-primary",
                        "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      )}
                    >
                      <option value="require">Require (encrypt, no verify)</option>
                      <option value="verify-ca">Verify CA (validate certificate)</option>
                      <option value="verify-full">Verify Full (validate + hostname)</option>
                      <option value="disable">Disable</option>
                    </select>
                    <p className="text-xs text-text-tertiary mt-1">
                      verify-full recommended for production
                    </p>
                  </FormField>
                )}
              </div>
            )}

            {/* SQL Server Security Options */}
            {dbType === "sqlserver" && (
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={encrypt}
                    onChange={(e) => setEncrypt(e.target.checked)}
                    className="rounded cursor-pointer accent-accent"
                  />
                  <span className="text-sm text-text-secondary">
                    Encrypt connection
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustServerCertificate}
                    onChange={(e) => setTrustServerCertificate(e.target.checked)}
                    className="rounded cursor-pointer accent-accent"
                  />
                  <span className="text-sm text-text-secondary">
                    Trust server certificate
                  </span>
                </label>
                <p className="text-xs text-text-tertiary">
                  Enable "Trust server certificate" for self-signed certs (dev only)
                </p>
              </div>
            )}

            {/* Read-Only Mode Section */}
            <div className="pt-4 mt-2 border-t border-border">
              {/* Read-Only Mode Toggle */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                  className="mt-1 rounded cursor-pointer accent-accent"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Lock className={cn("w-4 h-4", readOnly ? "text-accent" : "text-text-tertiary")} />
                    <span className={cn("text-sm font-medium", readOnly ? "text-text-primary" : "text-text-secondary")}>
                      Read-Only Mode
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Block all write operations (INSERT, UPDATE, DELETE)
                  </p>
                </div>
              </label>

              {/* Production Warning */}
              <AnimatePresence>
                {isLikelyProduction && !readOnly && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-400">
                          Production Database Detected
                        </p>
                        <p className="text-[10px] text-amber-400/80 mt-0.5">
                          This appears to be a production database. Consider enabling read-only mode to prevent accidental data modifications.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
              {isEditMode ? "Update Connection" : "Save Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
