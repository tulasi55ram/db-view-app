import { useState, type FC } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DataGrid, type DataGridColumn } from "./DataGrid";
import { CodeMirrorRedisEditor } from "./CodeMirrorRedisEditor";
import { RedisReferencePanel } from "./RedisReferencePanel";
import type { QueryHistoryEntry } from "@dbview/types";
import {
  Play,
  Terminal,
  Clock,
  AlertCircle,
  CheckCircle2,
  History,
  BookOpen,
  Download,
  ChevronDown,
  Copy,
  Check
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

export interface RedisQueryViewProps {
  command: string;
  onCommandChange: (value: string) => void;
  onRunCommand: () => void;
  loading: boolean;
  error?: string;
  columns: DataGridColumn[];
  rows: Record<string, unknown>[];
  duration?: number;
  connectionName?: string;
  // Query history props
  history: QueryHistoryEntry[];
  filteredHistory: QueryHistoryEntry[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}

// Format execution time for display
function formatExecutionTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

// Export functions
function exportToJSON(rows: Record<string, unknown>[]) {
  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `redis_results_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(rows: Record<string, unknown>[]): Promise<boolean> {
  const json = JSON.stringify(rows, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    return true;
  } catch {
    return false;
  }
}

export const RedisQueryView: FC<RedisQueryViewProps> = ({
  command,
  onCommandChange,
  onRunCommand,
  loading,
  error,
  columns,
  rows,
  duration,
  connectionName,
  history,
  filteredHistory,
  searchTerm,
  onSearchChange,
  onToggleFavorite,
  onDeleteEntry,
  onClearHistory
}) => {
  const hasResults = columns.length > 0;
  const rowCount = rows.length;

  // Side panel state
  const [activePanel, setActivePanel] = useState<'history' | 'reference' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const togglePanel = (panel: 'history' | 'reference') => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const handleInsertCommand = (example: string) => {
    onCommandChange(example);
  };

  const handleExportJSON = () => {
    exportToJSON(rows);
    toast.success("Exported to JSON");
    setShowExportMenu(false);
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(rows);
    if (success) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy");
    }
    setShowExportMenu(false);
  };

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Toolbar */}
      <header className="flex items-center justify-between border-b border-vscode-border bg-vscode-bg-light px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              loading
                ? "bg-vscode-warning/20 text-vscode-warning"
                : "bg-red-600 text-white hover:bg-red-700"
            )}
            onClick={onRunCommand}
            disabled={loading || !command.trim()}
          >
            {loading ? (
              <>
                <Clock className="h-3.5 w-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run
              </>
            )}
          </button>

          <div className="h-4 w-px bg-vscode-border mx-1" />

          <div className="flex items-center gap-1.5 text-xs text-vscode-text-muted">
            <Terminal className="h-3.5 w-3.5" />
            {connectionName ? (
              <span>
                <span className="text-red-500 font-medium">{connectionName}</span>
              </span>
            ) : (
              'No connection'
            )}
          </div>

          <div className="h-4 w-px bg-vscode-border mx-1" />

          <div className="flex items-center gap-1.5 text-xs text-vscode-text-muted">
            <kbd className="rounded bg-vscode-bg-lighter px-1.5 py-0.5 text-2xs">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
            </kbd>
            <span>to run</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePanel('history')}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              activePanel === 'history'
                ? "bg-red-500/20 text-red-500"
                : "bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text"
            )}
            title="Command History"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>

          <button
            onClick={() => togglePanel('reference')}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              activePanel === 'reference'
                ? "bg-red-500/20 text-red-500"
                : "bg-vscode-bg-lighter hover:bg-vscode-bg-hover text-vscode-text"
            )}
            title="Redis Commands Reference"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Commands
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Editor Panel */}
          <Panel defaultSize={25} minSize={10} maxSize={50}>
            <div className="h-full p-3 bg-vscode-bg-light/50">
              <CodeMirrorRedisEditor
                value={command}
                onChange={onCommandChange}
                onRunCommand={onRunCommand}
                height="100%"
                loading={loading}
                error={error}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="h-1 bg-vscode-border hover:bg-red-500 transition-colors cursor-row-resize" />

          {/* Results Panel */}
          <Panel defaultSize={75} minSize={40}>
            <div className="h-full flex flex-col overflow-hidden">
              {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-vscode-error/10 border-b border-vscode-error/30 text-vscode-error text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal">
                  <Panel defaultSize={activePanel ? 65 : 100} minSize={40}>
                    <div className="h-full flex flex-col">
                      {hasResults ? (
                        <>
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-vscode-border bg-vscode-bg-light text-xs">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-vscode-success">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {rowCount.toLocaleString()} {rowCount === 1 ? "result" : "results"}
                              </span>
                              {duration !== undefined && (
                                <span className="flex items-center gap-1 text-vscode-text-muted">
                                  <Clock className="h-3 w-3" />
                                  {formatExecutionTime(duration)}
                                </span>
                              )}
                            </div>

                            <div className="relative">
                              <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Export</span>
                                <ChevronDown className="h-3 w-3" />
                              </button>

                              {showExportMenu && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-vscode-bg-light border border-vscode-border rounded-lg shadow-lg z-50 py-1">
                                  <button
                                    onClick={handleExportJSON}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-vscode-bg-hover flex items-center gap-2 text-vscode-text"
                                  >
                                    <Download className="h-3.5 w-3.5 text-vscode-text-muted" />
                                    Export as JSON
                                  </button>
                                  <div className="border-t border-vscode-border my-1" />
                                  <button
                                    onClick={handleCopyToClipboard}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-vscode-bg-hover flex items-center gap-2 text-vscode-text"
                                  >
                                    {copied ? (
                                      <Check className="h-3.5 w-3.5 text-vscode-success" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-vscode-text-muted" />
                                    )}
                                    Copy to Clipboard
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 overflow-auto">
                            <DataGrid
                              columns={columns}
                              rows={rows}
                              loading={loading}
                              showRowNumbers={true}
                              emptyMessage="Command returned no results"
                            />
                          </div>
                        </>
                      ) : (
                        <EmptyResults loading={loading} />
                      )}
                    </div>
                  </Panel>

                  {activePanel && (
                    <>
                      <PanelResizeHandle className="w-1 bg-vscode-border hover:bg-red-500 transition-colors cursor-col-resize" />
                      <Panel defaultSize={35} minSize={20} maxSize={50}>
                        <div className="h-full border-l border-vscode-border">
                          {activePanel === 'history' && (
                            <CommandHistorySidePanel
                              filteredHistory={filteredHistory}
                              searchTerm={searchTerm}
                              onSearchChange={onSearchChange}
                              onToggleFavorite={onToggleFavorite}
                              onDeleteEntry={onDeleteEntry}
                              onClearHistory={onClearHistory}
                              onRunCommand={(cmd) => {
                                onCommandChange(cmd);
                                setTimeout(() => onRunCommand(), 50);
                              }}
                              onCopyCommand={(cmd) => {
                                navigator.clipboard.writeText(cmd);
                                toast.success("Command copied to clipboard");
                              }}
                            />
                          )}
                          {activePanel === 'reference' && (
                            <RedisReferencePanel onInsertCommand={handleInsertCommand} />
                          )}
                        </div>
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between border-t border-vscode-border bg-vscode-bg-light px-4 py-1 text-xs text-vscode-text-muted">
        <div className="flex items-center gap-4">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Executing command...
            </span>
          ) : hasResults ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-success" />
              Command completed
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vscode-text-muted" />
              Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-red-500">Redis</span>
        </div>
      </footer>
    </div>
  );
};

// Empty state
const EmptyResults: FC<{ loading: boolean }> = ({ loading }) => {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Clock className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-sm text-vscode-text-muted">Executing command...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vscode-bg-light">
          <Terminal className="h-6 w-6 text-vscode-text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-vscode-text">No results yet</p>
          <p className="text-xs text-vscode-text-muted">
            Enter a Redis command and press Run to see results
          </p>
        </div>
      </div>
    </div>
  );
};

// Command History Side Panel
interface CommandHistorySidePanelProps {
  filteredHistory: QueryHistoryEntry[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
  onRunCommand: (cmd: string) => void;
  onCopyCommand: (cmd: string) => void;
}

const CommandHistorySidePanel: FC<CommandHistorySidePanelProps> = ({
  filteredHistory,
  searchTerm,
  onSearchChange,
  onToggleFavorite,
  onDeleteEntry,
  onClearHistory,
  onRunCommand,
  onCopyCommand
}) => {
  return (
    <div className="h-full flex flex-col bg-vscode-bg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-vscode-text-muted" />
          <span className="text-sm font-medium text-vscode-text">History</span>
          <span className="text-xs text-vscode-text-muted">({filteredHistory.length})</span>
        </div>
        <button
          onClick={onClearHistory}
          className="p-1 rounded text-xs text-vscode-text-muted hover:text-vscode-error"
          title="Clear history"
        >
          Clear
        </button>
      </div>

      <div className="px-3 py-2 border-b border-vscode-border">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search commands..."
          className="w-full px-2 py-1.5 text-xs rounded bg-vscode-bg-lighter border border-vscode-border text-vscode-text placeholder-vscode-text-muted focus:outline-none focus:border-red-500"
        />
      </div>

      <div className="flex-1 overflow-auto">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted text-xs p-4">
            <History className="h-8 w-8 mb-2 opacity-30" />
            <p>No commands in history</p>
          </div>
        ) : (
          <div className="divide-y divide-vscode-border">
            {filteredHistory.map((entry) => (
              <div key={entry.id} className="p-2 hover:bg-vscode-bg-hover group">
                <div className="flex items-start justify-between gap-2">
                  <code className="text-xs text-red-400 font-mono line-clamp-2 flex-1">
                    {entry.sql}
                  </code>
                  <button
                    onClick={() => onToggleFavorite(entry.id)}
                    className={clsx(
                      "text-xs flex-shrink-0",
                      entry.isFavorite ? "text-vscode-warning" : "text-vscode-text-muted opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {entry.isFavorite ? "★" : "☆"}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2 text-2xs text-vscode-text-muted">
                    <span className={entry.success ? "text-vscode-success" : "text-vscode-error"}>
                      {entry.success ? "✓" : "✗"}
                    </span>
                    {entry.duration && <span>{entry.duration}ms</span>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => onRunCommand(entry.sql)}
                      className="px-1.5 py-0.5 text-2xs rounded bg-red-500/20 text-red-500 hover:bg-red-500/30"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => onCopyCommand(entry.sql)}
                      className="px-1.5 py-0.5 text-2xs rounded text-vscode-text-muted hover:bg-vscode-bg-lighter"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => onDeleteEntry(entry.id)}
                      className="px-1.5 py-0.5 text-2xs rounded text-vscode-error/70 hover:text-vscode-error hover:bg-vscode-bg-lighter"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
