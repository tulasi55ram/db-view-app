import { useState, useEffect } from "react";
import {
  Database,
  Plus,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Table2,
  Code2,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { getElectronAPI, type QueryHistoryEntry, type ConnectionInfo } from "@/electron";

interface HomeViewProps {
  onAddConnection: () => void;
  onQueryOpen: (connectionKey: string, connectionName: string) => void;
  onEditConnection: (connectionKey: string) => void;
  onBrowseConnection: (connectionKey: string) => void;
}

const DB_TYPE_INFO: Record<string, { name: string; color: string; description: string }> = {
  postgres: { name: "PostgreSQL", color: "#336791", description: "Advanced open-source database" },
  mysql: { name: "MySQL", color: "#4479A1", description: "Popular open-source database" },
  sqlserver: { name: "SQL Server", color: "#CC2927", description: "Microsoft's database platform" },
  sqlite: { name: "SQLite", color: "#003B57", description: "Lightweight embedded database" },
  mongodb: { name: "MongoDB", color: "#47A248", description: "Document-oriented NoSQL" },
  redis: { name: "Redis", color: "#DC382D", description: "In-memory data structure store" },
};

export function HomeView({ onAddConnection, onQueryOpen, onEditConnection, onBrowseConnection }: HomeViewProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [recentQueries, setRecentQueries] = useState<Array<{ connectionKey: string; entry: QueryHistoryEntry }>>([]);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyQuery = async (sql: string, index: number) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy query:", err);
    }
  };

  const api = getElectronAPI();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!api) return;

    setLoading(true);
    try {
      // Load connections
      const conns = await api.getConnections();
      setConnections(conns);

      // Load recent queries from all connections
      const allQueries: Array<{ connectionKey: string; entry: QueryHistoryEntry }> = [];
      for (const conn of conns) {
        const connectionKey = getConnectionKey(conn.config);
        try {
          const history = await api.getQueryHistory(connectionKey);
          history.forEach((entry) => {
            allQueries.push({ connectionKey, entry });
          });
        } catch (err) {
          console.error(`Failed to load history for ${connectionKey}:`, err);
        }
      }

      // Sort by execution time and take top 5
      const sorted = allQueries.sort((a, b) => b.entry.executedAt - a.entry.executedAt).slice(0, 5);
      setRecentQueries(sorted);
    } catch (error) {
      console.error("Failed to load home data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getConnectionKey = (config: any): string => {
    const dbType = config.dbType || "postgres";
    if (config.name) return `${dbType}:${config.name}`;
    if (config.filePath) return `${dbType}:${config.filePath}`;
    if (config.host) {
      return `${dbType}:${config.user}@${config.host}:${config.port}/${config.database}`;
    }
    return `${dbType}:${JSON.stringify(config)}`;
  };

  const handleConnect = async (connectionKey: string) => {
    if (!api) return;
    try {
      await api.connectToDatabase(connectionKey);
      await loadData();
    } catch (error) {
      console.error("Failed to connect:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Connection failed: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
      </div>
    );
  }

  // No connections state
  if (connections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary p-8">
        <div className="max-w-3xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-6">
              <Database className="w-12 h-12 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-3">Welcome to DBView</h1>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              A modern database client for exploring and managing your data across multiple database systems
            </p>
          </div>

          {/* Supported Databases */}
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wide text-center mb-6">
              Supported Databases
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(DB_TYPE_INFO).map(([key, info]) => (
                <div
                  key={key}
                  className="p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: info.color }}
                    >
                      {info.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary truncate">{info.name}</div>
                    </div>
                  </div>
                  <p className="text-xs text-text-tertiary">{info.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={onAddConnection}
              className="h-12 px-8 rounded-lg flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-base font-semibold transition-colors mx-auto shadow-lg shadow-accent/20"
            >
              <Plus className="w-5 h-5" />
              Add Your First Connection
            </button>
            <p className="text-sm text-text-tertiary mt-4">Get started by connecting to your database</p>
          </div>
        </div>
      </div>
    );
  }

  // Has connections state
  return (
    <div className="flex-1 overflow-auto bg-bg-primary p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome back to DBView</h1>
          <p className="text-text-secondary">
            You have {connections.length} {connections.length === 1 ? "connection" : "connections"} configured
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Connections */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Your Connections</h2>
              <button
                onClick={onAddConnection}
                className="h-8 px-4 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium transition-colors border border-border"
              >
                <Plus className="w-4 h-4" />
                New Connection
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connections.map((conn) => {
                const dbInfo = DB_TYPE_INFO[conn.config.dbType] || {
                  name: conn.config.dbType,
                  color: "#6B7280",
                  description: "Database",
                };
                const connectionKey = getConnectionKey(conn.config);
                // Use custom color if set, otherwise use database type color
                const displayColor = (conn.config as any).color || dbInfo.color;

                return (
                  <div
                    key={connectionKey}
                    className="p-4 rounded-xl border hover:shadow-lg transition-all group relative overflow-hidden"
                    style={{
                      borderColor: `${displayColor}40`,
                      backgroundColor: "var(--bg-secondary)",
                    }}
                  >
                    {/* Color accent bar on left */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: displayColor }}
                    />
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: displayColor }}
                        >
                          {dbInfo.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-text-primary truncate">{conn.config.name}</h3>
                          <p className="text-xs text-text-tertiary truncate">{dbInfo.name}</p>
                        </div>
                      </div>

                      {/* Status Badge and Edit Button */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Edit Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditConnection(connectionKey);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                          title="Edit connection"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>

                        {/* Status Badge */}
                        <div>
                          {conn.status === "connected" && (
                            <div className="flex items-center gap-1 text-2xs text-emerald-500">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Connected
                            </div>
                          )}
                          {conn.status === "disconnected" && (
                            <div className="flex items-center gap-1 text-2xs text-text-tertiary">
                              <XCircle className="w-3.5 h-3.5" />
                              Disconnected
                            </div>
                          )}
                          {conn.status === "connecting" && (
                            <div className="flex items-center gap-1 text-2xs text-yellow-500">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Connecting
                            </div>
                          )}
                          {conn.status === "error" && (
                            <div className="flex items-center gap-1 text-2xs text-error">
                              <XCircle className="w-3.5 h-3.5" />
                              Error
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Connection Info */}
                    {(conn.config as any).host && (
                      <div className="text-xs text-text-tertiary mb-3 truncate">
                        {(conn.config as any).host}:{(conn.config as any).port}/{(conn.config as any).database}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {conn.status !== "connected" ? (
                        <button
                          onClick={() => handleConnect(connectionKey)}
                          className="flex-1 h-8 px-3 rounded flex items-center justify-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
                        >
                          <Database className="w-3.5 h-3.5" />
                          Connect
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => onQueryOpen(connectionKey, conn.config.name || "Unknown")}
                            className="flex-1 h-8 px-3 rounded flex items-center justify-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            New Query
                          </button>
                          <button
                            onClick={() => onBrowseConnection(connectionKey)}
                            className="h-8 px-3 rounded flex items-center justify-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors border border-border"
                          >
                            <Table2 className="w-3.5 h-3.5" />
                            Browse
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="space-y-6">
            {/* Recent Queries */}
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Queries</h2>
              {recentQueries.length === 0 ? (
                <div className="p-6 rounded-xl border border-border bg-bg-secondary text-center">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-text-tertiary opacity-30" />
                  <p className="text-sm text-text-tertiary">No queries executed yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentQueries.map((item, index) => {
                    const connection = connections.find((c) => getConnectionKey(c.config) === item.connectionKey);
                    return (
                      <div
                        key={index}
                        className={cn(
                          "p-3 rounded-lg border transition-colors group",
                          item.entry.success
                            ? "border-border bg-bg-secondary hover:bg-bg-hover"
                            : "border-error/30 bg-error/5"
                        )}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <Code2 className={cn("w-4 h-4 flex-shrink-0 mt-0.5", item.entry.success ? "text-emerald-500" : "text-error")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-text-tertiary mb-1 truncate">
                              {connection?.config.name || "Unknown Connection"}
                            </p>
                            <p className="text-xs font-mono text-text-primary line-clamp-2">{item.entry.sql}</p>
                          </div>
                          <button
                            onClick={() => handleCopyQuery(item.entry.sql, index)}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
                            title="Copy query"
                          >
                            {copiedIndex === index ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-2xs text-text-tertiary">
                          <span>{formatTime(item.entry.executedAt)}</span>
                          {item.entry.success && item.entry.rowCount !== undefined && (
                            <span className="text-emerald-500">{item.entry.rowCount} rows</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={onAddConnection}
                  className="w-full h-10 px-4 rounded-lg flex items-center gap-3 bg-bg-secondary hover:bg-bg-hover text-text-primary text-sm font-medium transition-colors border border-border"
                >
                  <Plus className="w-4 h-4 text-accent" />
                  Add Connection
                </button>
                {connections.filter((c) => c.status === "connected").length > 0 && (
                  <button
                    onClick={() => {
                      const connected = connections.find((c) => c.status === "connected");
                      if (connected) {
                        onQueryOpen(getConnectionKey(connected.config), connected.config.name || "Unknown");
                      }
                    }}
                    className="w-full h-10 px-4 rounded-lg flex items-center gap-3 bg-bg-secondary hover:bg-bg-hover text-text-primary text-sm font-medium transition-colors border border-border"
                  >
                    <Play className="w-4 h-4 text-accent" />
                    New Query
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
