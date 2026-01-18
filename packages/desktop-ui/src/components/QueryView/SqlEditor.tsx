import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL, MySQL, MariaSQL, SQLite, MSSQL } from "@codemirror/lang-sql";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import {
  autocompletion,
  nextSnippetField,
  prevSnippetField,
  clearSnippet,
} from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import type { ColumnMetadata, TableInfo } from "@dbview/types";
import { SQL_SNIPPETS } from "@/utils/sqlSnippets";
import { useTheme } from "@/design-system";
import {
  createSmartSqlCompletion,
  type SqlDatabaseType,
  type ForeignKeyRelation,
  type EnhancedAutocompleteData,
} from "@/utils/sqlAutocomplete";
import { getQueryAtCursor } from "@/utils/queryParser";

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: (sqlToExecute?: string) => void;
  height?: string;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  // Database type for dialect-specific features
  dbType?: SqlDatabaseType;
  // Autocomplete data
  schemas?: string[];
  tables?: TableInfo[];
  columns?: Record<string, ColumnMetadata[]>;
  // Foreign key relationships for JOIN suggestions
  foreignKeys?: ForeignKeyRelation[];
}

export interface SqlEditorRef {
  getSelectedText: () => string | undefined;
}

/**
 * Get the CodeMirror SQL dialect for a database type
 */
function getSqlDialect(dbType?: SqlDatabaseType) {
  switch (dbType) {
    case "mysql":
      return MySQL;
    case "mariadb":
      return MariaSQL;
    case "sqlite":
      return SQLite;
    case "sqlserver":
      return MSSQL;
    case "postgres":
    default:
      return PostgreSQL;
  }
}

export const SqlEditor = forwardRef<SqlEditorRef, SqlEditorProps>(({
  value,
  onChange,
  onRunQuery,
  height: _height = "200px", // Unused, editor now fills container
  readOnly = false,
  loading = false,
  error,
  dbType = "postgres",
  schemas = [],
  tables = [],
  columns = {},
  foreignKeys = [],
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const highlightCompartment = useRef(new Compartment());

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getSelectedText: () => {
      if (!viewRef.current) return undefined;
      const { from, to } = viewRef.current.state.selection.main;

      // If text is selected, return it
      if (from !== to) {
        return viewRef.current.state.doc.sliceString(from, to);
      }

      // Otherwise, find the query at cursor position
      const fullText = viewRef.current.state.doc.toString();
      return getQueryAtCursor(fullText, from);
    },
  }));

  // Get current theme
  const { resolvedTheme } = useTheme();

  // Store autocomplete data in a ref so it can be updated without recreating the editor
  const autocompleteDataRef = useRef<EnhancedAutocompleteData>({
    schemas,
    tables,
    columns,
    foreignKeys,
    dbType,
  });

  // Update the ref whenever autocomplete data changes
  useEffect(() => {
    autocompleteDataRef.current = {
      schemas,
      tables,
      columns,
      foreignKeys,
      dbType,
    };
  }, [schemas, tables, columns, foreignKeys, dbType]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Create smart SQL autocomplete using the new system
    const smartSqlComplete = createSmartSqlCompletion(() => autocompleteDataRef.current);

    // Also include SQL snippets
    const snippetComplete = (context: any) => {
      const word = context.matchBefore(/\w*/);
      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      const snippetMatches = SQL_SNIPPETS.filter((snippet) =>
        snippet.label.toLowerCase().startsWith(word.text.toLowerCase())
      );

      if (snippetMatches.length === 0) {
        return null;
      }

      return {
        from: word.from,
        options: snippetMatches.map((s) => ({ ...s, boost: 100 })), // High boost for snippets
        validFor: /^\w*$/,
      };
    };

    // Create theme based on current mode
    const createEditorTheme = (isDark: boolean) =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: isDark ? "#171717" : "#ffffff",
            color: isDark ? "#fafafa" : "#171717",
            minHeight: "100%",
            fontSize: "13px",
            lineHeight: "1.5",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            display: "flex",
            flexDirection: "column",
          },
          ".cm-scroller": {
            overflow: "auto",
            height: "100%",
            flex: "1",
          },
          ".cm-content": {
            caretColor: "#3b82f6",
            padding: "12px 0",
          },
          ".cm-line": {
            lineHeight: "1.5",
          },
          ".cm-cursor": {
            borderLeftColor: "#3b82f6",
            borderLeftWidth: "2px",
            height: "1.2em !important",
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
            border: "none",
            minWidth: "40px",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            padding: "0 12px 0 8px",
          },
          "&.cm-focused .cm-selectionBackground, ::selection": {
            backgroundColor: "#3b82f6",
            color: "#ffffff",
          },
          ".cm-selectionBackground": {
            backgroundColor: isDark ? "#262626" : "#e5e5e5",
          },
          ".cm-tooltip": {
            backgroundColor: isDark ? "#262626" : "#ffffff",
            border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
            color: isDark ? "#fafafa" : "#171717",
            borderRadius: "6px",
            boxShadow: isDark
              ? "0 4px 12px rgba(0, 0, 0, 0.4)"
              : "0 4px 12px rgba(0, 0, 0, 0.1)",
          },
          ".cm-tooltip-autocomplete": {
            backgroundColor: isDark ? "#262626" : "#ffffff",
            border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
            maxWidth: "400px",
          },
          ".cm-tooltip-autocomplete ul": {
            maxHeight: "300px",
          },
          ".cm-tooltip-autocomplete ul li": {
            padding: "4px 8px",
            borderRadius: "4px",
            margin: "2px 4px",
          },
          ".cm-tooltip-autocomplete ul li[aria-selected]": {
            backgroundColor: isDark ? "#404040" : "#e5e5e5",
            color: isDark ? "#fafafa" : "#171717",
          },
          ".cm-completionIcon": {
            width: "1.2em",
            fontSize: "14px",
            lineHeight: "1",
            marginRight: "0.5em",
            textAlign: "center",
            color: isDark ? "#a3a3a3" : "#737373",
          },
          ".cm-completionIcon-keyword": { color: isDark ? "#569cd6" : "#0000ff" },
          ".cm-completionIcon-function": { color: isDark ? "#dcdcaa" : "#795e26" },
          ".cm-completionIcon-class": { color: isDark ? "#4ec9b0" : "#267f99" },
          ".cm-completionIcon-property": { color: isDark ? "#9cdcfe" : "#001080" },
          ".cm-completionIcon-namespace": { color: isDark ? "#c586c0" : "#af00db" },
          ".cm-completionIcon-snippet": { color: isDark ? "#c586c0" : "#af00db", fontWeight: "500" },
          ".cm-completionIcon-variable": { color: isDark ? "#4fc1ff" : "#0070c1" },
          ".cm-completionIcon-text": { color: isDark ? "#ce9178" : "#a31515" },
          ".cm-completionIcon-type": { color: isDark ? "#4ec9b0" : "#267f99" },
          ".cm-completionIcon-operator": { color: isDark ? "#d4d4d4" : "#000000" },
          ".cm-completionLabel": {
            fontSize: "13px",
          },
          ".cm-completionDetail": {
            fontSize: "11px",
            opacity: 0.7,
            marginLeft: "0.5em",
            fontStyle: "italic",
          },
          ".cm-completionInfo": {
            padding: "8px",
            fontSize: "12px",
            maxWidth: "300px",
            borderLeft: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
          },
          ".cm-placeholder": {
            color: "#737373",
            lineHeight: "1.5",
          },
        },
        { dark: isDark }
      );

    const isDarkMode = resolvedTheme === "dark";
    const editorTheme = createEditorTheme(isDarkMode);

    // Custom syntax highlighting for SQL with proper dark/light mode colors
    const createSqlHighlighting = (isDark: boolean) => {
      const sqlHighlightStyle = HighlightStyle.define([
        // Keywords (SELECT, FROM, WHERE, etc.)
        { tag: tags.keyword, color: isDark ? "#569cd6" : "#0000ff" },
        // Operators (=, <>, AND, OR, etc.)
        { tag: tags.operator, color: isDark ? "#d4d4d4" : "#000000" },
        // Strings
        { tag: tags.string, color: isDark ? "#ce9178" : "#a31515" },
        // Numbers
        { tag: tags.number, color: isDark ? "#b5cea8" : "#098658" },
        // Comments
        { tag: tags.comment, color: isDark ? "#6a9955" : "#008000", fontStyle: "italic" },
        // Function names
        { tag: tags.function(tags.variableName), color: isDark ? "#dcdcaa" : "#795e26" },
        // Types
        { tag: tags.typeName, color: isDark ? "#4ec9b0" : "#267f99" },
        // Table/column names (identifiers)
        { tag: tags.variableName, color: isDark ? "#9cdcfe" : "#001080" },
        // Property names
        { tag: tags.propertyName, color: isDark ? "#9cdcfe" : "#001080" },
        // Special identifiers
        { tag: tags.special(tags.variableName), color: isDark ? "#4fc1ff" : "#0070c1" },
        // Punctuation
        { tag: tags.punctuation, color: isDark ? "#d4d4d4" : "#000000" },
        // Brackets
        { tag: tags.bracket, color: isDark ? "#ffd700" : "#795e26" },
        // NULL, TRUE, FALSE
        { tag: tags.bool, color: isDark ? "#569cd6" : "#0000ff" },
        { tag: tags.null, color: isDark ? "#569cd6" : "#0000ff" },
      ]);
      return syntaxHighlighting(sqlHighlightStyle);
    };
    const sqlHighlighting = createSqlHighlighting(isDarkMode);

    // Get the appropriate SQL dialect
    const dialect = getSqlDialect(dbType);

    // Custom keybindings
    const customKeybindings = keymap.of([
      {
        key: "Mod-Enter",
        run: (view) => {
          if (!loading && value.trim()) {
            const { from, to } = view.state.selection.main;
            let queryToRun: string | undefined;

            // If text is selected, use it
            if (from !== to) {
              queryToRun = view.state.doc.sliceString(from, to);
            } else {
              // Otherwise, find the query at cursor position
              const fullText = view.state.doc.toString();
              queryToRun = getQueryAtCursor(fullText, from);
            }

            // Pass query to parent, or undefined to use full text
            onRunQuery(queryToRun);
          }
          return true;
        },
      },
      // Snippet navigation (higher priority than default Tab behavior)
      { key: "Tab", run: nextSnippetField, shift: prevSnippetField },
      { key: "Escape", run: clearSnippet },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]);

    const startState = EditorState.create({
      doc: value,
      extensions: [
        EditorView.lineWrapping,
        history(),
        search(),
        sql({ dialect }),
        highlightCompartment.current.of(sqlHighlighting),
        autocompletion({
          override: [snippetComplete, smartSqlComplete],
          activateOnTyping: true,
          maxRenderedOptions: 20,
          defaultKeymap: true,
        }),
        customKeybindings,
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly || loading)),
        placeholderExt("Write your SQL query here... (Ctrl+Space for autocomplete)"),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onChange(newValue);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Focus on mount
    view.focus();

    return () => {
      view.destroy();
    };
  }, []); // Only mount once

  // Update readonly state when loading or readOnly prop changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly || loading)),
      });
    }
  }, [readOnly, loading]);

  // Update theme and syntax highlighting when resolvedTheme changes
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

      // Update syntax highlighting colors for the new theme
      const newHighlightStyle = HighlightStyle.define([
        { tag: tags.keyword, color: isDark ? "#569cd6" : "#0000ff" },
        { tag: tags.operator, color: isDark ? "#d4d4d4" : "#000000" },
        { tag: tags.string, color: isDark ? "#ce9178" : "#a31515" },
        { tag: tags.number, color: isDark ? "#b5cea8" : "#098658" },
        { tag: tags.comment, color: isDark ? "#6a9955" : "#008000", fontStyle: "italic" },
        { tag: tags.function(tags.variableName), color: isDark ? "#dcdcaa" : "#795e26" },
        { tag: tags.typeName, color: isDark ? "#4ec9b0" : "#267f99" },
        { tag: tags.variableName, color: isDark ? "#9cdcfe" : "#001080" },
        { tag: tags.propertyName, color: isDark ? "#9cdcfe" : "#001080" },
        { tag: tags.special(tags.variableName), color: isDark ? "#4fc1ff" : "#0070c1" },
        { tag: tags.punctuation, color: isDark ? "#d4d4d4" : "#000000" },
        { tag: tags.bracket, color: isDark ? "#ffd700" : "#795e26" },
        { tag: tags.bool, color: isDark ? "#569cd6" : "#0000ff" },
        { tag: tags.null, color: isDark ? "#569cd6" : "#0000ff" },
      ]);

      viewRef.current.dispatch({
        effects: [
          themeCompartment.current.reconfigure(newTheme),
          highlightCompartment.current.reconfigure(syntaxHighlighting(newHighlightStyle)),
        ],
      });
    }
  }, [resolvedTheme]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  return (
    <div className="relative h-full flex flex-col">
      <div ref={editorRef} className="rounded border border-border overflow-auto flex-1" style={{ minHeight: 0 }} />

      {/* Database type badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium rounded bg-bg-tertiary text-text-secondary uppercase tracking-wide">
        {dbType}
      </div>

      {/* Error indicator border */}
      {error && <div className="absolute inset-0 pointer-events-none border-2 border-error/50 rounded" />}

      {/* Loading overlay - pointer-events-none to prevent blocking other UI elements */}
      {loading && (
        <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-[1px] flex items-center justify-center rounded pointer-events-none">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Executing query...</span>
          </div>
        </div>
      )}
    </div>
  );
});

SqlEditor.displayName = "SqlEditor";
