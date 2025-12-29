import { useState, useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, FolderOpen, X, Lock, AlertTriangle } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { getElectronAPI } from "@/electron";
import type { DatabaseConnectionConfig } from "@dbview/types";
import { cn } from "@/utils/cn";

interface AddConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

type DatabaseType = "postgres" | "mysql" | "mariadb" | "sqlserver" | "sqlite" | "mongodb" | "redis" | "cassandra";

interface DatabaseTypeInfo {
  value: DatabaseType;
  label: string;
  description: string;
  color: string;
}

const DATABASE_TYPES: DatabaseTypeInfo[] = [
  { value: "postgres", label: "PostgreSQL", description: "Advanced open-source database", color: "#336791" },
  { value: "mysql", label: "MySQL", description: "Popular relational database", color: "#00758F" },
  { value: "mariadb", label: "MariaDB", description: "MySQL-compatible database", color: "#003545" },
  { value: "sqlserver", label: "SQL Server", description: "Microsoft SQL Server", color: "#CC2927" },
  { value: "sqlite", label: "SQLite", description: "Embedded file database", color: "#003B57" },
  { value: "mongodb", label: "MongoDB", description: "Document database", color: "#00ED64" },
  { value: "redis", label: "Redis", description: "In-memory data store", color: "#DC382D" },
  { value: "cassandra", label: "Cassandra", description: "Distributed NoSQL database", color: "#1287B1" },
];

// Database Icon
function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

// Form Field Component
function FormField({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
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
        "w-full h-9 px-3 rounded-md text-sm",
        "bg-neutral-900 border border-neutral-700",
        "text-text-primary placeholder:text-neutral-500",
        "transition-all duration-150",
        "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
        "hover:border-neutral-600",
        className
      )}
      {...props}
    />
  );
}

export function AddConnectionDialog({ open, onOpenChange, onSave }: AddConnectionDialogProps) {
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
  // Cassandra specific
  const [cassContactPoints, setCassContactPoints] = useState("localhost");
  const [cassKeyspace, setCassKeyspace] = useState("");
  const [cassDatacenter, setCassDatacenter] = useState("datacenter1");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const api = getElectronAPI();

  // Detect if connection appears to be production
  const isLikelyProduction = useMemo(() => {
    const productionKeywords = ['prod', 'production', 'live', 'prd'];
    const valuesToCheck = [name.toLowerCase(), host.toLowerCase(), database.toLowerCase()];
    return valuesToCheck.some(value =>
      productionKeywords.some(keyword => value.includes(keyword))
    );
  }, [name, host, database]);

  const getDefaultPort = (type: DatabaseType): string => {
    switch (type) {
      case "postgres": return "5432";
      case "mysql": return "3306";
      case "mariadb": return "3306";
      case "sqlserver": return "1433";
      case "mongodb": return "27017";
      case "redis": return "6379";
      case "cassandra": return "9042";
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
          readOnly
        };
      case "mariadb":
        return {
          dbType: "mariadb",
          name: baseName,
          host,
          port: parseInt(port),
          database,
          user,
          password,
          ssl: ssl || undefined,
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
          readOnly
        };
      case "sqlite":
        return { dbType: "sqlite", name: baseName, filePath, readOnly };
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
          readOnly
        };
      case "cassandra":
        return {
          dbType: "cassandra",
          name: baseName,
          contactPoints: cassContactPoints.split(',').map(cp => cp.trim()).filter(cp => cp),
          port: parseInt(port),
          keyspace: cassKeyspace,
          localDatacenter: cassDatacenter,
          username: user || undefined,
          password: password || undefined,
          ssl: ssl || undefined,
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
      resetForm();
      onOpenChange(false);
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

  const resetForm = () => {
    setName("");
    setHost("localhost");
    setPort(getDefaultPort(dbType));
    setDatabase("");
    setUser("");
    setPassword("");
    setFilePath("");
    setConnectionString("");
    setAuthDatabase("");
    setSsl(false);
    setSslMode("require");
    setInstanceName("");
    setAuthenticationType("sql");
    setDomain("");
    setEncrypt(true);
    setTrustServerCertificate(false);
    setRedisUsername("");
    setCassContactPoints("localhost");
    setCassKeyspace("");
    setCassDatacenter("datacenter1");
    setTestResult(null);
    setReadOnly(false);
  };

  const currentDbInfo = DATABASE_TYPES.find(db => db.value === dbType)!;
  const needsHostPort = ["postgres", "mysql", "mariadb", "sqlserver", "mongodb", "redis"].includes(dbType);
  const needsDatabase = ["postgres", "mysql", "mariadb", "sqlserver", "mongodb"].includes(dbType);
  const needsAuth = ["postgres", "mysql", "mariadb", "sqlserver", "mongodb", "cassandra"].includes(dbType);
  const needsFilePath = dbType === "sqlite";
  const needsConnectionString = dbType === "mongodb";
  const isCassandra = dbType === "cassandra";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
                  "w-[680px] max-h-[85vh] overflow-hidden",
                  "bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl",
                  "focus:outline-none"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                  <div>
                    <DialogPrimitive.Title className="text-base font-semibold text-text-primary">
                      New Connection
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="text-xs text-text-tertiary mt-0.5">
                      Connect to a database server
                    </DialogPrimitive.Description>
                  </div>
                  <DialogPrimitive.Close asChild>
                    <button
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-md",
                        "text-text-tertiary hover:text-text-primary",
                        "hover:bg-neutral-800 transition-colors"
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </DialogPrimitive.Close>
                </div>

                {/* Content */}
                <div className="flex">
                  {/* Left Panel - Database Types */}
                  <div className="w-[200px] border-r border-neutral-800 p-3 bg-neutral-950/50">
                    <div className="space-y-1">
                      {DATABASE_TYPES.map((db) => (
                        <button
                          key={db.value}
                          onClick={() => handleDbTypeChange(db.value)}
                          className={cn(
                            "w-full px-3 py-2.5 rounded-lg text-left transition-all duration-150",
                            "flex items-center gap-3",
                            dbType === db.value
                              ? "bg-accent/10 border border-accent/30"
                              : "hover:bg-neutral-800/50 border border-transparent"
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center",
                              dbType === db.value ? "bg-accent/20" : "bg-neutral-800"
                            )}
                            style={{
                              backgroundColor: dbType === db.value ? `${db.color}20` : undefined,
                              color: db.color
                            }}
                          >
                            <DatabaseIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "text-sm font-medium truncate",
                              dbType === db.value ? "text-text-primary" : "text-text-secondary"
                            )}>
                              {db.label}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Panel - Connection Form */}
                  <div className="flex-1 p-5 overflow-y-auto max-h-[calc(85vh-140px)]">
                    {/* Connection Type Header */}
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${currentDbInfo.color}20`, color: currentDbInfo.color }}
                      >
                        <DatabaseIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{currentDbInfo.label}</h3>
                        <p className="text-xs text-text-tertiary">{currentDbInfo.description}</p>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                      {/* Connection Name */}
                      <FormField label="Connection Name">
                        <StyledInput
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={`My ${currentDbInfo.label} Connection`}
                        />
                      </FormField>

                      {/* Host & Port */}
                      {needsHostPort && (
                        <div className="grid grid-cols-3 gap-3">
                          <FormField label="Host" className="col-span-2">
                            <StyledInput
                              type="text"
                              value={host}
                              onChange={(e) => setHost(e.target.value)}
                              placeholder="localhost"
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
                        <FormField label="Instance Name (optional)">
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
                        <FormField label="Database Index (0-15)">
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
                              "w-full h-9 px-3 rounded-md text-sm",
                              "bg-neutral-900 border border-neutral-700",
                              "text-text-primary",
                              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
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
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label={dbType === "mongodb" ? "Username (optional)" : "Username"}>
                              <StyledInput
                                type="text"
                                value={user}
                                onChange={(e) => setUser(e.target.value)}
                                placeholder={dbType === "postgres" ? "postgres" : dbType === "mongodb" ? "admin" : "root"}
                              />
                            </FormField>
                            <FormField label={dbType === "mongodb" ? "Password (optional)" : "Password"}>
                              <StyledInput
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                              />
                            </FormField>
                          </div>
                          {/* MongoDB Auth Database */}
                          {dbType === "mongodb" && (
                            <FormField label="Auth Database (optional)">
                              <StyledInput
                                type="text"
                                value={authDatabase}
                                onChange={(e) => setAuthDatabase(e.target.value)}
                                placeholder="admin"
                              />
                              <p className="text-[10px] text-text-tertiary mt-1">
                                Database where credentials are stored. Defaults to &quot;admin&quot;
                              </p>
                            </FormField>
                          )}
                        </>
                      )}

                      {/* SQL Server Windows Authentication Domain */}
                      {dbType === "sqlserver" && authenticationType === "windows" && (
                        <FormField label="Domain (optional)">
                          <StyledInput
                            type="text"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="MYDOMAIN"
                          />
                          <p className="text-[10px] text-text-tertiary mt-1">
                            Uses current Windows credentials if not specified
                          </p>
                        </FormField>
                      )}

                      {/* Redis Authentication (ACL) */}
                      {dbType === "redis" && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Username (optional)">
                              <StyledInput
                                type="text"
                                value={redisUsername}
                                onChange={(e) => setRedisUsername(e.target.value)}
                                placeholder="default"
                              />
                            </FormField>
                            <FormField label="Password (optional)">
                              <StyledInput
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                              />
                            </FormField>
                          </div>
                          <p className="text-[10px] text-text-tertiary -mt-2">
                            Redis 6+ supports ACL with username. Leave username empty for legacy auth.
                          </p>
                        </>
                      )}

                      {/* SQLite File Path */}
                      {needsFilePath && (
                        <FormField label="Database File">
                          <div className="flex gap-2">
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
                                "h-9 px-3 rounded-md flex items-center gap-2",
                                "bg-neutral-800 border border-neutral-700",
                                "text-sm text-text-secondary hover:text-text-primary",
                                "hover:bg-neutral-700 transition-colors"
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
                        <FormField label="Connection String (optional override)">
                          <StyledInput
                            type="text"
                            value={connectionString}
                            onChange={(e) => setConnectionString(e.target.value)}
                            placeholder="mongodb://user:pass@host:27017/db?authSource=admin"
                          />
                          <p className="text-[10px] text-text-tertiary mt-1">
                            Full MongoDB URI. If provided, overrides host/port/auth fields above
                          </p>
                        </FormField>
                      )}

                      {/* Cassandra Configuration */}
                      {isCassandra && (
                        <>
                          <FormField label="Contact Points">
                            <StyledInput
                              type="text"
                              value={cassContactPoints}
                              onChange={(e) => setCassContactPoints(e.target.value)}
                              placeholder="node1.example.com, node2.example.com"
                            />
                            <p className="text-[10px] text-text-tertiary mt-1">
                              Comma-separated list of Cassandra nodes
                            </p>
                          </FormField>

                          <div className="grid grid-cols-3 gap-3">
                            <FormField label="Port">
                              <StyledInput
                                type="text"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                placeholder="9042"
                              />
                            </FormField>
                            <FormField label="Keyspace" className="col-span-2">
                              <StyledInput
                                type="text"
                                value={cassKeyspace}
                                onChange={(e) => setCassKeyspace(e.target.value)}
                                placeholder="my_keyspace"
                              />
                            </FormField>
                          </div>

                          <FormField label="Local Datacenter">
                            <StyledInput
                              type="text"
                              value={cassDatacenter}
                              onChange={(e) => setCassDatacenter(e.target.value)}
                              placeholder="datacenter1"
                            />
                            <p className="text-[10px] text-text-tertiary mt-1">
                              Required for token-aware load balancing
                            </p>
                          </FormField>

                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Username (optional)">
                              <StyledInput
                                type="text"
                                value={user}
                                onChange={(e) => setUser(e.target.value)}
                                placeholder="cassandra"
                              />
                            </FormField>
                            <FormField label="Password (optional)">
                              <StyledInput
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                              />
                            </FormField>
                          </div>
                        </>
                      )}

                      {/* SSL/Security Section */}
                      {["postgres", "mysql", "mariadb", "mongodb", "redis", "cassandra"].includes(dbType) && (
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
                                  "w-full h-9 px-3 rounded-md text-sm",
                                  "bg-neutral-900 border border-neutral-700",
                                  "text-text-primary",
                                  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                                )}
                              >
                                <option value="require">Require (encrypt, no verify)</option>
                                <option value="verify-ca">Verify CA (validate certificate)</option>
                                <option value="verify-full">Verify Full (validate + hostname)</option>
                                <option value="disable">Disable</option>
                              </select>
                              <p className="text-[10px] text-text-tertiary mt-1">
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
                          <p className="text-[10px] text-text-tertiary">
                            Enable &quot;Trust server certificate&quot; for self-signed certs (dev only)
                          </p>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-neutral-800 pt-4 mt-2">
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
                            <p className="text-[10px] text-text-tertiary mt-0.5">
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
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium",
                                testResult.success ? "text-emerald-400" : "text-red-400"
                              )}>
                                {testResult.success ? "Connection successful" : "Connection failed"}
                              </p>
                              <p className="text-xs text-text-tertiary mt-0.5 break-words">
                                {testResult.message}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-800 bg-neutral-950/30">
                  <button
                    onClick={handleTest}
                    disabled={isTesting}
                    className={cn(
                      "h-9 px-4 rounded-md flex items-center gap-2",
                      "text-sm font-medium",
                      "bg-neutral-800 border border-neutral-700",
                      "text-text-secondary hover:text-text-primary",
                      "hover:bg-neutral-700 transition-colors",
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

                  <div className="flex items-center gap-2">
                    <DialogPrimitive.Close asChild>
                      <button
                        className={cn(
                          "h-9 px-4 rounded-md",
                          "text-sm font-medium text-text-secondary",
                          "hover:bg-neutral-800 transition-colors"
                        )}
                      >
                        Cancel
                      </button>
                    </DialogPrimitive.Close>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className={cn(
                        "h-9 px-5 rounded-md flex items-center gap-2",
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
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
