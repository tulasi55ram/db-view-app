import { type FC, useState, useEffect, useCallback, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import {
  Code2, Play, Sigma, LayoutGrid, Zap, Save, RefreshCw, Copy, RotateCcw,
  Play as ExecuteIcon, Loader2, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import type { FunctionDetails, TriggerDetails, FunctionExecutionResult } from "@dbview/types";
import { useTheme } from "@/design-system";

const api = (window as any).electronAPI;

interface FunctionViewProps {
  connectionKey: string;
  connectionName: string;
  schema: string;
  functionName: string;
  functionType: 'function' | 'procedure' | 'aggregate' | 'window' | 'trigger';
  tabId: string;
}

const FUNCTION_TYPE_ICONS = {
  function: Code2,
  procedure: Play,
  aggregate: Sigma,
  window: LayoutGrid,
  trigger: Zap
};

export const FunctionView: FC<FunctionViewProps> = ({
  connectionKey,
  connectionName: _connectionName,
  schema,
  functionName,
  functionType,
  tabId: _tabId
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<FunctionDetails | TriggerDetails | null>(null);
  const [definition, setDefinition] = useState("");
  const [originalDefinition, setOriginalDefinition] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<FunctionExecutionResult | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());

  const { resolvedTheme } = useTheme();
  const IconComponent = FUNCTION_TYPE_ICONS[functionType];

  // Load function details
  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        let functionDetails;
        if (functionType === 'trigger') {
          functionDetails = await api.getTriggerDetails(connectionKey, schema, functionName);
        } else {
          functionDetails = await api.getFunctionDetails(connectionKey, schema, functionName);
        }

        setDetails(functionDetails);
        setDefinition(functionDetails.definition);
        setOriginalDefinition(functionDetails.definition);
        setIsDirty(false);
      } catch (err) {
        console.error("Failed to load function details:", err);
        setError(err instanceof Error ? err.message : "Failed to load function");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [connectionKey, schema, functionName, functionType]);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const extensions = [
      sql({ dialect: PostgreSQL }),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          run: () => {
            handleSave();
            return true;
          }
        },
        {
          key: "Mod-Enter",
          run: () => {
            if (functionType !== 'trigger') {
              handleExecute();
            }
            return true;
          }
        }
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          setDefinition(newValue);
          setIsDirty(newValue !== originalDefinition);
        }
      }),
      themeCompartment.current.of(createEditorTheme(resolvedTheme === 'dark')),
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: definition,
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update editor content when definition changes
  useEffect(() => {
    if (viewRef.current && definition !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: definition,
        },
      });
    }
  }, [definition]);

  // Update theme
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(createEditorTheme(resolvedTheme === 'dark')),
      });
    }
  }, [resolvedTheme]);

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;

    try {
      setSaving(true);
      setError(null);
      await api.updateFunctionDefinition(connectionKey, definition);
      setOriginalDefinition(definition);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [connectionKey, definition, isDirty, saving]);

  const handleRevert = useCallback(() => {
    setDefinition(originalDefinition);
    setIsDirty(false);
  }, [originalDefinition]);

  const handleRefresh = useCallback(async () => {
    if (isDirty) {
      if (!confirm("You have unsaved changes. Discard them?")) return;
    }

    try {
      setLoading(true);
      const functionDetails = functionType === 'trigger'
        ? await api.getTriggerDetails(connectionKey, schema, functionName)
        : await api.getFunctionDetails(connectionKey, schema, functionName);

      setDetails(functionDetails);
      setDefinition(functionDetails.definition);
      setOriginalDefinition(functionDetails.definition);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setLoading(false);
    }
  }, [connectionKey, schema, functionName, functionType, isDirty]);

  const handleCopy = useCallback(async () => {
    try {
      await api.copyToClipboard(definition);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [definition]);

  const handleExecute = useCallback(async () => {
    if (functionType === 'trigger' || executing) return;

    const functionDetails = details as FunctionDetails;
    if (!functionDetails) return;

    try {
      setExecuting(true);
      setError(null);

      // Convert parameter values to appropriate types
      const parameters = functionDetails.parameters
        .filter(p => p.mode === 'IN' || p.mode === 'INOUT')
        .map(p => {
          const value = parameterValues[p.name] || '';
          // Basic type conversion - could be enhanced
          if (p.type.includes('int')) return parseInt(value) || 0;
          if (p.type.includes('bool')) return value === 'true';
          if (p.type.includes('json')) return value ? JSON.parse(value) : null;
          return value;
        });

      const result = await api.executeFunction(connectionKey, schema, functionName, parameters);
      setExecutionResult(result);
    } catch (err) {
      setExecutionResult({
        success: false,
        error: err instanceof Error ? err.message : "Execution failed"
      });
    } finally {
      setExecuting(false);
    }
  }, [connectionKey, schema, functionName, functionType, details, parameterValues, executing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <p className="text-text-primary">{error}</p>
        </div>
      </div>
    );
  }

  const functionDetails = functionType !== 'trigger' ? details as FunctionDetails : null;
  const triggerDetails = functionType === 'trigger' ? details as TriggerDetails : null;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <IconComponent className="w-5 h-5 text-accent" />
          <span className="font-medium text-text-primary">
            {schema}.{functionName}
          </span>
          {isDirty && (
            <span className="flex items-center gap-1 text-xs text-orange-500">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              Unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-accent text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>

          {functionType !== 'trigger' && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-50 hover:bg-green-700"
            >
              <ExecuteIcon className="w-4 h-4" />
              {executing ? "Running..." : "Execute"}
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-1 text-text-secondary hover:text-text-primary"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopy}
            className="p-1 text-text-secondary hover:text-text-primary"
            title="Copy"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={handleRevert}
            disabled={!isDirty}
            className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-50"
            title="Revert"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <div ref={editorRef} className="h-full" />
      </div>

      {/* Metadata & Execution Panel */}
      <div className="border-t border-border bg-bg-secondary">
        <div className="grid grid-cols-2 gap-4 p-4 max-h-80 overflow-auto">
          {/* Left: Metadata */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-text-primary">
              {functionType === 'trigger' ? 'Trigger Info' : 'Function Info'}
            </h3>

            {functionDetails && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Language:</span>
                  <span className="text-text-primary font-mono">{functionDetails.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Return Type:</span>
                  <span className="text-text-primary font-mono">{functionDetails.returnType}</span>
                </div>
                {functionDetails.parameters.length > 0 && (
                  <div>
                    <span className="text-text-tertiary">Parameters:</span>
                    <div className="mt-1 space-y-1">
                      {functionDetails.parameters.map(p => (
                        <div key={p.name} className="flex items-center gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded ${
                            p.mode === 'IN' ? 'bg-blue-500/10 text-blue-500' :
                            p.mode === 'OUT' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-purple-500/10 text-purple-500'
                          }`}>
                            {p.mode}
                          </span>
                          <span className="font-mono">{p.name}: {p.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {triggerDetails && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Table:</span>
                  <span className="text-text-primary font-mono">{triggerDetails.tableName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Timing:</span>
                  <span className="text-text-primary">{triggerDetails.timing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Events:</span>
                  <span className="text-text-primary">{triggerDetails.events.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Function:</span>
                  <span className="text-text-primary font-mono">{triggerDetails.functionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Status:</span>
                  <span className={triggerDetails.isEnabled ? "text-green-500" : "text-red-500"}>
                    {triggerDetails.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Execution */}
          {functionType !== 'trigger' && functionDetails && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-text-primary">Execute</h3>

              {functionDetails.parameters.filter(p => p.mode === 'IN' || p.mode === 'INOUT').map(p => (
                <div key={p.name} className="mb-2">
                  <label className="block text-xs text-text-tertiary mb-1">
                    {p.name} ({p.type})
                  </label>
                  <input
                    type="text"
                    value={parameterValues[p.name] || ''}
                    onChange={(e) => setParameterValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                    className="w-full px-2 py-1 text-sm bg-bg-primary border border-border rounded text-text-primary"
                    placeholder={`Enter ${p.type}`}
                  />
                </div>
              ))}

              {executionResult && (
                <div className={`mt-4 p-3 rounded text-sm ${
                  executionResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {executionResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={executionResult.success ? "text-green-500" : "text-red-500"}>
                      {executionResult.success ? "Success" : "Error"}
                    </span>
                    {executionResult.executionTime && (
                      <span className="text-text-tertiary flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {executionResult.executionTime}ms
                      </span>
                    )}
                  </div>

                  {executionResult.error && (
                    <div className="text-red-500">{executionResult.error}</div>
                  )}

                  {executionResult.success && executionResult.result !== undefined && (
                    <div className="text-text-primary">
                      <strong>Result:</strong> {JSON.stringify(executionResult.result)}
                    </div>
                  )}

                  {executionResult.rows && executionResult.rows.length > 0 && (
                    <div className="text-text-primary">
                      <strong>Rows:</strong> {executionResult.rowCount}
                      <pre className="mt-1 text-xs overflow-auto max-h-40">
                        {JSON.stringify(executionResult.rows, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function createEditorTheme(isDark: boolean) {
  return EditorView.theme({
    "&": {
      backgroundColor: isDark ? "#171717" : "#ffffff",
      color: isDark ? "#fafafa" : "#171717",
      height: "100%",
    },
    ".cm-content": {
      caretColor: isDark ? "#fafafa" : "#171717",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "13px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: isDark ? "#fafafa" : "#171717",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: isDark ? "#3b82f6" : "#bfdbfe",
    },
    ".cm-gutters": {
      backgroundColor: isDark ? "#262626" : "#f5f5f5",
      color: isDark ? "#737373" : "#a3a3a3",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: isDark ? "#404040" : "#e5e5e5",
    },
    ".cm-activeLine": {
      backgroundColor: isDark ? "#262626" : "#fafafa",
    },
  }, { dark: isDark });
}
