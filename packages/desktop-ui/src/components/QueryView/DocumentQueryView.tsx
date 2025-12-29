/**
 * Document Query View
 *
 * A specialized query editor for document databases:
 * - MongoDB: Aggregation pipelines and find queries (JSON)
 * - Elasticsearch: Query DSL (JSON)
 * - Cassandra: CQL (SQL-like)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, History, Trash2, BookOpen, Wand2, Save, Bookmark } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { QueryResultsGrid } from "./QueryResultsGrid";
import { SavedQueriesPanel } from "./SavedQueriesPanel";
import { SaveQueryModal } from "./SaveQueryModal";
import { getElectronAPI, type QueryHistoryEntry, type SavedQuery } from "@/electron";
import { useTheme } from "@/design-system";
import { toast } from "sonner";
import {
  MONGO_COMMANDS,
  MONGO_OPERATORS,
  MONGO_STAGES,
  ES_COMMANDS,
  ES_QUERY_AUTOCOMPLETE,
  ES_AGG_AUTOCOMPLETE,
  CQL_KEYWORDS,
  CASSANDRA_COMMANDS,
} from "./constants";

export interface DocumentQueryViewProps {
  tab: {
    id: string;
    connectionKey?: string;
    connectionName?: string;
    sql?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    loading?: boolean;
    error?: string;
  };
  onTabUpdate: (
    tabId: string,
    updates: {
      sql?: string;
      columns?: string[];
      rows?: Record<string, unknown>[];
      loading?: boolean;
      error?: string;
      isDirty?: boolean;
    }
  ) => void;
  dbType: "mongodb" | "elasticsearch" | "cassandra";
}

export function DocumentQueryView({ tab, onTabUpdate, dbType }: DocumentQueryViewProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [persistedHistory, setPersistedHistory] = useState<QueryHistoryEntry[]>([]);
  const [showReference, setShowReference] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  const api = getElectronAPI();
  const { resolvedTheme } = useTheme();

  // Database-specific configuration
  const config = {
    mongodb: {
      name: "MongoDB",
      icon: "🍃",
      color: "text-green-500",
      bgColor: "bg-green-500",
      borderColor: "border-green-500",
      placeholder: 'Enter MongoDB query with collection name...\n\nFind: { "collection": "users", "find": { "status": "active" }, "limit": 10 }\n\nAggregate: { "collection": "orders", "pipeline": [{ "$match": {} }] }',
      language: json(),
    },
    elasticsearch: {
      name: "Elasticsearch",
      icon: "🔍",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      borderColor: "border-yellow-500",
      placeholder: 'Enter Query DSL with index...\nExample: { "index": "my-index", "query": { "match_all": {} }, "size": 10 }',
      language: json(),
    },
    cassandra: {
      name: "Cassandra",
      icon: "👁️",
      color: "text-blue-400",
      bgColor: "bg-blue-400",
      borderColor: "border-blue-400",
      placeholder: 'Enter CQL query...\nExample: SELECT * FROM users WHERE status = \'active\' LIMIT 10;',
      language: sql(),
    },
  }[dbType];

  // Load persisted history and saved queries on mount
  useEffect(() => {
    if (tab.connectionKey && api) {
      api
        .getQueryHistory(tab.connectionKey)
        .then((history) => {
          setPersistedHistory(history);
        })
        .catch((err) => {
          console.error("Failed to load query history:", err);
        });

      api
        .getSavedQueries(tab.connectionKey)
        .then((queries) => {
          setSavedQueries(queries);
        })
        .catch((err) => {
          console.error("Failed to load saved queries:", err);
        });
    }
  }, [tab.connectionKey, api]);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current) return;

    // Autocomplete based on database type
    const autocomplete = (context: CompletionContext) => {
      const word = context.matchBefore(/[\w$]*/);
      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      const input = word.text.toLowerCase();
      const suggestions: any[] = [];

      if (dbType === "mongodb") {
        // MongoDB stages
        MONGO_STAGES.forEach(({ stage, desc }) => {
          if (stage.toLowerCase().includes(input)) {
            suggestions.push({
              label: stage,
              detail: desc,
              type: "keyword",
              boost: 2,
            });
          }
        });
        // MongoDB operators
        MONGO_OPERATORS.forEach(({ op, desc }) => {
          if (op.toLowerCase().includes(input)) {
            suggestions.push({
              label: op,
              detail: desc,
              type: "function",
              boost: 1,
            });
          }
        });
      } else if (dbType === "elasticsearch") {
        // ES query types
        ES_QUERY_AUTOCOMPLETE.forEach(({ type, desc }) => {
          if (type.toLowerCase().includes(input)) {
            suggestions.push({
              label: type,
              detail: desc,
              type: "keyword",
              boost: 2,
            });
          }
        });
        // ES aggregations
        ES_AGG_AUTOCOMPLETE.forEach(({ type, desc }) => {
          if (type.toLowerCase().includes(input)) {
            suggestions.push({
              label: type,
              detail: `Agg: ${desc}`,
              type: "function",
              boost: 1,
            });
          }
        });
      } else if (dbType === "cassandra") {
        // CQL keywords
        CQL_KEYWORDS.forEach((kw) => {
          if (kw.toLowerCase().includes(input)) {
            suggestions.push({
              label: kw,
              type: "keyword",
            });
          }
        });
      }

      return {
        from: word.from,
        options: suggestions,
        validFor: /^[\w$]*$/,
      };
    };

    // Create theme based on current mode
    const accentColor = dbType === "mongodb" ? "#22c55e" : dbType === "elasticsearch" ? "#eab308" : "#60a5fa";
    const isDark = resolvedTheme === "dark";

    const createEditorTheme = (dark: boolean) => EditorView.theme(
      {
        "&": {
          backgroundColor: dark ? "#171717" : "#ffffff",
          color: dark ? "#fafafa" : "#171717",
          height: "220px",
          fontSize: "13px",
          lineHeight: "1.5",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        },
        ".cm-content": {
          caretColor: accentColor,
          padding: "12px 0",
        },
        ".cm-line": {
          lineHeight: "1.5",
        },
        ".cm-cursor": {
          borderLeftColor: accentColor,
          borderLeftWidth: "2px",
          height: "1.2em !important",
        },
        ".cm-activeLine": {
          backgroundColor: dark ? "#262626" : "#f5f5f5",
        },
        ".cm-activeLineGutter": {
          backgroundColor: dark ? "#262626" : "#f5f5f5",
        },
        ".cm-gutters": {
          backgroundColor: dark ? "#171717" : "#fafafa",
          color: dark ? "#737373" : "#a3a3a3",
          border: "none",
          minWidth: "40px",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          padding: "0 12px 0 8px",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: accentColor,
          color: "#ffffff",
        },
        ".cm-selectionBackground": {
          backgroundColor: dark ? "#262626" : "#e5e5e5",
        },
        ".cm-tooltip": {
          backgroundColor: dark ? "#262626" : "#ffffff",
          border: dark ? "1px solid #404040" : "1px solid #e5e5e5",
          color: dark ? "#fafafa" : "#171717",
        },
        ".cm-tooltip-autocomplete": {
          backgroundColor: dark ? "#262626" : "#ffffff",
          border: dark ? "1px solid #404040" : "1px solid #e5e5e5",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: dark ? "#404040" : "#e5e5e5",
          color: dark ? "#fafafa" : "#171717",
        },
        ".cm-placeholder": {
          color: "#737373",
          lineHeight: "1.5",
        },
      },
      { dark }
    );

    const editorTheme = createEditorTheme(isDark);

    const startState = EditorState.create({
      doc: tab.sql || getDefaultQuery(dbType),
      extensions: [
        EditorView.lineWrapping,
        history(),
        config.language,
        syntaxHighlighting(defaultHighlightStyle),
        autocompletion({
          override: [autocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 15,
        }),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              handleRunQuery();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(tab.loading || false)),
        placeholderExt(config.placeholder),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onTabUpdate(tab.id, { sql: newValue, isDirty: true });
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
    };
  }, [dbType]);

  // Update readonly state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(
          EditorState.readOnly.of(tab.loading || false)
        ),
      });
    }
  }, [tab.loading]);

  // Update theme when resolvedTheme changes
  useEffect(() => {
    if (viewRef.current) {
      const isDark = resolvedTheme === "dark";
      const newTheme = EditorView.theme(
        {
          "&": {
            backgroundColor: isDark ? "#171717" : "#ffffff",
            color: isDark ? "#fafafa" : "#171717",
          },
          ".cm-activeLine": {
            backgroundColor: isDark ? "#262626" : "#f5f5f5",
          },
          ".cm-activeLineGutter": {
            backgroundColor: isDark ? "#262626" : "#f5f5f5",
          },
          ".cm-gutters": {
            backgroundColor: isDark ? "#171717" : "#fafafa",
            color: isDark ? "#737373" : "#a3a3a3",
          },
          ".cm-selectionBackground": {
            backgroundColor: isDark ? "#262626" : "#e5e5e5",
          },
          ".cm-tooltip": {
            backgroundColor: isDark ? "#262626" : "#ffffff",
            border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
            color: isDark ? "#fafafa" : "#171717",
          },
          ".cm-tooltip-autocomplete": {
            backgroundColor: isDark ? "#262626" : "#ffffff",
            border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
          },
          ".cm-tooltip-autocomplete ul li[aria-selected]": {
            backgroundColor: isDark ? "#404040" : "#e5e5e5",
            color: isDark ? "#fafafa" : "#171717",
          },
        },
        { dark: isDark }
      );
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(newTheme),
      });
    }
  }, [resolvedTheme]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== tab.sql && tab.sql !== undefined) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: tab.sql },
        });
      }
    }
  }, [tab.sql]);

  // Handle format JSON
  const handleFormat = useCallback(() => {
    if (!tab.sql || dbType === "cassandra") return;

    try {
      const parsed = JSON.parse(tab.sql);
      const formatted = JSON.stringify(parsed, null, 2);
      onTabUpdate(tab.id, { sql: formatted, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: formatted },
        });
      }
      toast.success("Query formatted");
    } catch {
      toast.error("Invalid JSON - cannot format");
    }
  }, [tab.sql, tab.id, dbType, onTabUpdate]);

  // Handle run query
  const handleRunQuery = useCallback(async () => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      if (!tab.connectionKey) {
        toast.error("No connection selected");
      }
      return;
    }

    const startTime = Date.now();
    onTabUpdate(tab.id, { loading: true, error: undefined });

    try {
      const result = await api.runQuery({
        connectionKey: tab.connectionKey,
        sql: tab.sql,
      });

      const duration = Date.now() - startTime;

      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        rowCount: result.rows.length,
        success: true,
      };

      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-50));

      onTabUpdate(tab.id, {
        columns: result.columns,
        rows: result.rows,
        loading: false,
      });

      toast.success(`Query executed (${result.rows.length} docs, ${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        success: false,
        error: error.message || "Unknown error",
      };

      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-50));

      onTabUpdate(tab.id, {
        loading: false,
        error: error.message || "Failed to execute query",
      });

      toast.error(`Query failed: ${error.message}`);
    }
  }, [tab, onTabUpdate, api]);

  // Handle history selection (replaces entire content)
  const handleSelectFromHistory = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: sql },
        });
      }
    },
    [tab.id, onTabUpdate]
  );

  // Handle inserting example from reference panel (replaces if empty, otherwise inserts at cursor)
  const handleInsertExample = useCallback(
    (example: string) => {
      if (!viewRef.current) return;

      const currentValue = viewRef.current.state.doc.toString().trim();
      const defaultQuery = getDefaultQuery(dbType).trim();

      // If editor is empty or has default content, replace entirely
      if (!currentValue || currentValue === defaultQuery) {
        onTabUpdate(tab.id, { sql: example, isDirty: true });
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: example },
        });
      } else {
        // Append at the end
        const insertText = "\n\n" + example;
        const newContent = currentValue + insertText;

        onTabUpdate(tab.id, { sql: newContent, isDirty: true });
        viewRef.current.dispatch({
          changes: { from: viewRef.current.state.doc.length, insert: insertText },
          selection: { anchor: viewRef.current.state.doc.length + insertText.length },
        });
      }

      // Focus editor after insert
      viewRef.current.focus();
    },
    [tab.id, onTabUpdate, dbType]
  );

  // Handle clear history
  const handleClearHistory = useCallback(async () => {
    if (!tab.connectionKey || !api) return;

    try {
      await api.clearQueryHistory(tab.connectionKey);
      setPersistedHistory([]);
      toast.success("Query history cleared");
    } catch (error: any) {
      toast.error(`Failed to clear history: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  // Handle save current query - opens modal
  const handleSaveQuery = useCallback(() => {
    if (!tab.sql?.trim()) {
      toast.error("No query to save");
      return;
    }
    setShowSaveModal(true);
  }, [tab.sql]);

  // Handle actual save from modal
  const handleSaveQueryConfirm = useCallback(async (name: string, description: string) => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      return;
    }

    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      name,
      sql: tab.sql.trim(),
      description: description || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await api.addSavedQuery(tab.connectionKey, newQuery);
      setSavedQueries((prev) => [...prev, newQuery]);
      toast.success(`Query "${name}" saved successfully`);
    } catch (error: any) {
      toast.error(`Failed to save query: ${error.message}`);
    }
  }, [tab.sql, tab.connectionKey, api]);

  // Handle select saved query
  const handleSelectSavedQuery = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: sql },
        });
      }
    },
    [tab.id, onTabUpdate]
  );

  // Handle update saved query
  const handleUpdateSavedQuery = useCallback(async (queryId: string, updates: Partial<SavedQuery>) => {
    if (!tab.connectionKey || !api) return;

    try {
      await api.updateSavedQuery(tab.connectionKey, queryId, updates);
      setSavedQueries((prev) =>
        prev.map((q) => (q.id === queryId ? { ...q, ...updates, updatedAt: Date.now() } : q))
      );
      toast.success("Query updated");
    } catch (error: any) {
      toast.error(`Failed to update query: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  // Handle delete saved query
  const handleDeleteSavedQuery = useCallback(async (queryId: string) => {
    if (!tab.connectionKey || !api) return;

    if (!confirm("Are you sure you want to delete this saved query?")) return;

    try {
      await api.deleteSavedQuery(tab.connectionKey, queryId);
      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId));
      toast.success("Query deleted");
    } catch (error: any) {
      toast.error(`Failed to delete query: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${config.color}`}>
            <span>{config.icon}</span>
            <span className="text-xs font-medium">{config.name}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={handleRunQuery}
            disabled={tab.loading || !tab.sql?.trim()}
            className={`h-7 px-3 rounded flex items-center gap-1.5 ${config.bgColor} hover:opacity-90 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Play className="w-3 h-3" />
            Run
            <span className="opacity-70">(Cmd+Enter)</span>
          </button>
          {dbType !== "cassandra" && (
            <button
              onClick={handleFormat}
              disabled={tab.loading || !tab.sql?.trim()}
              className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Wand2 className="w-3 h-3" />
              Format
            </button>
          )}
          <button
            onClick={handleSaveQuery}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newValue = !showSavedQueries;
              setShowSavedQueries(newValue);
              if (newValue) {
                setShowReference(false);
                setShowHistory(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showSavedQueries
                ? `${config.bgColor}/20 ${config.color}`
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <Bookmark className="w-3 h-3" />
            Saved
          </button>
          <button
            onClick={() => {
              const newValue = !showReference;
              setShowReference(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowHistory(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showReference
                ? `${config.bgColor}/20 ${config.color}`
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Reference
          </button>
          <button
            onClick={() => {
              const newValue = !showHistory;
              setShowHistory(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowReference(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showHistory
                ? `${config.bgColor}/20 ${config.color}`
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <History className="w-3 h-3" />
            History
          </button>
        </div>
      </div>

      {/* Main content area with vertical resizing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Editor Panel - Resizable */}
          <Panel defaultSize={30} minSize={15} maxSize={60}>
            <div className="relative h-full">
              <div ref={editorRef} className="h-full" />
              {tab.error && (
                <div className={`absolute inset-0 pointer-events-none border-2 ${config.borderColor}/50 rounded`} />
              )}
              {tab.loading && (
                <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <div className={`h-4 w-4 animate-spin rounded-full border-2 ${config.borderColor} border-t-transparent`} />
                    <span>Executing query...</span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Vertical Resize Handle */}
          <PanelResizeHandle className={`h-1 bg-border hover:${config.bgColor} transition-colors cursor-row-resize`} />

          {/* Results Panel */}
          <Panel defaultSize={70} minSize={30}>
            <div className="h-full flex overflow-hidden">
              <PanelGroup direction="horizontal">
                <Panel defaultSize={showHistory || showReference || showSavedQueries ? 60 : 100} minSize={40}>
                  <QueryResultsGrid
                    columns={tab.columns || []}
                    rows={tab.rows || []}
                    loading={tab.loading || false}
                  />
                </Panel>

                {(showHistory || showReference || showSavedQueries) && (
                  <>
                    <PanelResizeHandle className={`w-1 bg-border hover:${config.bgColor} transition-colors cursor-col-resize`} />
                    <Panel defaultSize={40} minSize={25} maxSize={60}>
                      {showSavedQueries ? (
                        <SavedQueriesPanel
                          queries={savedQueries}
                          onSelectQuery={handleSelectSavedQuery}
                          onDeleteQuery={handleDeleteSavedQuery}
                          onUpdateQuery={handleUpdateSavedQuery}
                        />
                      ) : showReference ? (
                        <ReferencePanel dbType={dbType} onSelectExample={handleInsertExample} />
                      ) : (
                        <HistoryPanel
                          history={persistedHistory}
                          onSelectQuery={handleSelectFromHistory}
                          onClearHistory={handleClearHistory}
                        />
                      )}
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Save Query Modal */}
      <SaveQueryModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveQueryConfirm}
      />
    </div>
  );
}

// Get default query based on database type
function getDefaultQuery(dbType: "mongodb" | "elasticsearch" | "cassandra"): string {
  switch (dbType) {
    case "mongodb":
      return `{
  "collection": "your_collection",
  "find": {},
  "limit": 10
}`;
    case "elasticsearch":
      return `{
  "index": "your_index",
  "query": {
    "match_all": {}
  },
  "size": 10
}`;
    case "cassandra":
      return `-- Replace my_keyspace.my_table with your keyspace and table
SELECT * FROM my_keyspace.my_table LIMIT 10;`;
    default:
      return "";
  }
}

// Reference Panel
function ReferencePanel({
  dbType,
  onSelectExample,
}: {
  dbType: "mongodb" | "elasticsearch" | "cassandra";
  onSelectExample: (example: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("examples");

  if (dbType === "mongodb") {
    const categories = [
      { id: "examples", label: "Examples", icon: "⚡" },
      { id: "stages", label: "Stages", icon: "🔄" },
      { id: "comparison", label: "Compare", icon: "⚖️" },
      { id: "logical", label: "Logic", icon: "🔀" },
      { id: "element", label: "Element", icon: "📦" },
      { id: "evaluation", label: "Eval", icon: "🔍" },
      { id: "array", label: "Array", icon: "📋" },
      { id: "accumulators", label: "Accum", icon: "📊" },
      { id: "dateOps", label: "Date", icon: "📅" },
      { id: "stringOps", label: "String", icon: "📝" },
      { id: "mathOps", label: "Math", icon: "🔢" },
      { id: "conditional", label: "Cond", icon: "❓" },
      { id: "update", label: "Update", icon: "✏️" },
    ];

    const commands = MONGO_COMMANDS[selectedCategory as keyof typeof MONGO_COMMANDS] || [];

    return (
      <div className="h-full flex flex-col bg-bg-secondary">
        <div className="p-2 border-b border-border">
          <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
            <BookOpen className="w-3 h-3" />
            MongoDB Reference
          </h3>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 p-2 border-b border-border">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === cat.id
                  ? "bg-green-500/20 text-green-500"
                  : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-y-auto">
          {commands.map(({ name, desc, example }) => (
            <button
              key={name}
              onClick={() => onSelectExample(example)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono text-green-400 font-medium">{name}</code>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
              <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded truncate overflow-hidden">
                {example.split('\n')[0]}...
              </code>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (dbType === "elasticsearch") {
    const esCategories = [
      { id: "examples", label: "Examples", icon: "⚡" },
      { id: "fullText", label: "Full-Text", icon: "📝" },
      { id: "termLevel", label: "Term", icon: "🎯" },
      { id: "compound", label: "Compound", icon: "🔀" },
      { id: "nested", label: "Nested", icon: "📂" },
      { id: "metricAggs", label: "Metrics", icon: "📊" },
      { id: "bucketAggs", label: "Buckets", icon: "🪣" },
      { id: "sorting", label: "Sort", icon: "↕️" },
      { id: "highlight", label: "Highlight", icon: "✨" },
      { id: "suggest", label: "Suggest", icon: "💡" },
      { id: "geo", label: "Geo", icon: "🌍" },
      { id: "source", label: "Source", icon: "📄" },
    ];

    const esCommands = ES_COMMANDS[selectedCategory as keyof typeof ES_COMMANDS] || [];

    return (
      <div className="h-full flex flex-col bg-bg-secondary">
        <div className="p-2 border-b border-border">
          <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
            <BookOpen className="w-3 h-3" />
            Elasticsearch Reference
          </h3>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 p-2 border-b border-border">
          {esCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === cat.id
                  ? "bg-yellow-500/20 text-yellow-500"
                  : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-y-auto">
          {esCommands.map(({ name, desc, example }) => (
            <button
              key={name}
              onClick={() => onSelectExample(example)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono text-yellow-400 font-medium">{name}</code>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
              <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded truncate overflow-hidden">
                {example.split('\n')[0]}...
              </code>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Cassandra CQL
  const cqlCategories = [
    { id: "examples", label: "Examples", icon: "⚡" },
    { id: "select", label: "SELECT", icon: "🔍" },
    { id: "insert", label: "INSERT", icon: "➕" },
    { id: "update", label: "UPDATE", icon: "✏️" },
    { id: "delete", label: "DELETE", icon: "🗑️" },
    { id: "ddl", label: "DDL", icon: "🏗️" },
    { id: "collections", label: "Collections", icon: "📦" },
    { id: "functions", label: "Functions", icon: "⚙️" },
    { id: "aggregates", label: "Aggregates", icon: "📊" },
    { id: "batch", label: "Batch", icon: "📋" },
    { id: "admin", label: "Admin", icon: "🔧" },
  ];

  const cqlCommands = CASSANDRA_COMMANDS[selectedCategory as keyof typeof CASSANDRA_COMMANDS] || [];

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <BookOpen className="w-3 h-3" />
          CQL Reference
        </h3>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {cqlCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedCategory === cat.id
                ? "bg-blue-500/20 text-blue-400"
                : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Commands list */}
      <div className="flex-1 overflow-y-auto">
        {cqlCommands.map(({ name, desc, example }) => (
          <button
            key={name}
            onClick={() => onSelectExample(example)}
            className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
          >
            <div className="flex items-start gap-2">
              <code className="text-xs font-mono text-blue-400 font-medium">{name}</code>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
            <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded overflow-hidden whitespace-pre-wrap max-h-16">
              {example.split('\n').slice(0, 2).join('\n')}{example.split('\n').length > 2 ? '...' : ''}
            </code>
          </button>
        ))}
      </div>
    </div>
  );
}

// History Panel
function HistoryPanel({
  history,
  onSelectQuery,
  onClearHistory,
}: {
  history: QueryHistoryEntry[];
  onSelectQuery: (sql: string) => void;
  onClearHistory: () => void;
}) {
  const sortedHistory = [...history].reverse();

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <History className="w-3 h-3" />
          Query History
        </h3>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-red-500 transition-colors"
            title="Clear history"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedHistory.length === 0 ? (
          <div className="p-4 text-center text-text-tertiary text-xs">
            No query history yet
          </div>
        ) : (
          sortedHistory.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectQuery(entry.sql)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <code className="text-xs font-mono text-text-primary line-clamp-3">
                {entry.sql}
              </code>
              <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                <span className={entry.success ? "text-green-500" : "text-red-500"}>
                  {entry.success ? "✓" : "✗"}
                </span>
                {entry.rowCount !== undefined && <span>{entry.rowCount} docs</span>}
                <span>{entry.duration}ms</span>
                <span>•</span>
                <span>{new Date(entry.executedAt).toLocaleTimeString()}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default DocumentQueryView;
