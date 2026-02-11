import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { EditorView, keymap, placeholder as placeholderExt, lineNumbers } from "@codemirror/view";
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

/**
 * Click-anywhere extension for CodeMirror
 * Allows clicking in empty space below the document to automatically
 * insert newlines and position the cursor at that location.
 * This provides a more intuitive editing experience similar to VS Code.
 */
function createClickAnywhereExtension() {
  return EditorView.domEventHandlers({
    mousedown: (event, view) => {
      // Use scrollDOM to get the full scrollable area (includes empty space)
      const scrollDOM = view.scrollDOM;
      const scrollRect = scrollDOM.getBoundingClientRect();

      // Check if click is within the editor's scrollable area
      if (
        event.clientX < scrollRect.left ||
        event.clientX > scrollRect.right ||
        event.clientY < scrollRect.top ||
        event.clientY > scrollRect.bottom
      ) {
        return false;
      }

      // Get document info
      const docLength = view.state.doc.length;
      const lastLineBlock = view.lineBlockAt(docLength);
      const lineHeight = view.defaultLineHeight;

      // Check if click is below the last line of content
      // Account for scroll position
      const scrollTop = scrollDOM.scrollTop;
      const contentBottom = lastLineBlock.bottom - scrollTop + scrollRect.top;

      if (event.clientY > contentBottom) {
        // Calculate how many lines we need to add
        const clickY = event.clientY;
        const linesToAdd = Math.max(1, Math.ceil((clickY - contentBottom) / lineHeight));

        // Create newlines to insert
        const newlines = "\n".repeat(linesToAdd);

        // Insert newlines at the end of document and move cursor there
        view.dispatch({
          changes: { from: docLength, insert: newlines },
          selection: { anchor: docLength + linesToAdd },
          scrollIntoView: true,
        });

        // Focus the editor
        view.focus();

        // Prevent default to avoid text selection issues
        event.preventDefault();
        return true;
      }

      return false; // Let default handling proceed
    },
  });
}

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

    // Create theme based on current mode - clean, minimal design like VS Code/TablePlus
    const createEditorTheme = (isDark: boolean) =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
            color: isDark ? "#d4d4d4" : "#1e1e1e",
            minHeight: "100%",
            fontSize: "13px",
            lineHeight: "1.5",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace",
            display: "flex",
            flexDirection: "column",
          },
          ".cm-scroller": {
            overflow: "auto",
            height: "100%",
            flex: "1",
            scrollbarWidth: "thin",
            scrollbarColor: isDark ? "#404040 transparent" : "#c4c4c4 transparent",
            cursor: "text",
          },
          ".cm-content": {
            caretColor: isDark ? "#aeafad" : "#000000",
            padding: "12px 0",
            minHeight: "100%",
          },
          ".cm-line": {
            lineHeight: "1.5",
            padding: "0 16px 0 8px",
          },
          ".cm-cursor": {
            borderLeftColor: isDark ? "#aeafad" : "#000000",
            borderLeftWidth: "2px",
          },
          // Very subtle active line - barely visible, just helps track position
          ".cm-activeLine": {
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
          },
          ".cm-gutters": {
            backgroundColor: isDark ? "#1e1e1e" : "#f8f8f8",
            color: isDark ? "#858585" : "#999999",
            border: "none",
            borderRight: isDark ? "1px solid #333333" : "1px solid #e5e5e5",
            minWidth: "50px",
          },
          ".cm-lineNumbers": {
            minWidth: "46px",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            padding: "0 12px 0 8px",
            textAlign: "right",
            fontSize: "12px",
          },
          ".cm-lineNumbers .cm-gutterElement.cm-activeLineGutter": {
            color: isDark ? "#c6c6c6" : "#333333",
          },
          "&.cm-focused .cm-selectionBackground, ::selection": {
            backgroundColor: isDark ? "#264f78" : "#add6ff",
          },
          ".cm-selectionBackground": {
            backgroundColor: isDark ? "#264f78" : "#add6ff",
          },
          ".cm-tooltip": {
            backgroundColor: isDark ? "#252526" : "#ffffff",
            border: isDark ? "1px solid #454545" : "1px solid #c8c8c8",
            color: isDark ? "#cccccc" : "#1e1e1e",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
          },
          ".cm-tooltip-autocomplete": {
            backgroundColor: isDark ? "#252526" : "#ffffff",
            border: isDark ? "1px solid #454545" : "1px solid #c8c8c8",
            maxWidth: "400px",
          },
          ".cm-tooltip-autocomplete ul": {
            maxHeight: "300px",
          },
          ".cm-tooltip-autocomplete ul li": {
            padding: "4px 8px",
            borderRadius: "3px",
            margin: "2px 4px",
          },
          ".cm-tooltip-autocomplete ul li[aria-selected]": {
            backgroundColor: isDark ? "#04395e" : "#d6ebff",
            color: isDark ? "#ffffff" : "#1e1e1e",
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
            color: isDark ? "#6a6a6a" : "#999999",
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
        lineNumbers(),
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
        // Click-anywhere extension: allows clicking in empty space to position cursor
        createClickAnywhereExtension(),
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
            backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
            color: isDark ? "#d4d4d4" : "#1e1e1e",
          },
          ".cm-scroller": {
            scrollbarColor: isDark ? "#404040 transparent" : "#c4c4c4 transparent",
            cursor: "text",
          },
          ".cm-content": {
            caretColor: isDark ? "#aeafad" : "#000000",
          },
          ".cm-cursor": {
            borderLeftColor: isDark ? "#aeafad" : "#000000",
          },
          ".cm-activeLine": {
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
          },
          ".cm-gutters": {
            backgroundColor: isDark ? "#1e1e1e" : "#f8f8f8",
            color: isDark ? "#858585" : "#999999",
            borderRight: isDark ? "1px solid #333333" : "1px solid #e5e5e5",
          },
          ".cm-lineNumbers .cm-gutterElement.cm-activeLineGutter": {
            color: isDark ? "#c6c6c6" : "#333333",
          },
          "&.cm-focused .cm-selectionBackground, ::selection": {
            backgroundColor: isDark ? "#264f78" : "#add6ff",
          },
          ".cm-selectionBackground": {
            backgroundColor: isDark ? "#264f78" : "#add6ff",
          },
          ".cm-tooltip": {
            backgroundColor: isDark ? "#252526" : "#ffffff",
            border: isDark ? "1px solid #454545" : "1px solid #c8c8c8",
            color: isDark ? "#cccccc" : "#1e1e1e",
          },
          ".cm-tooltip-autocomplete": {
            backgroundColor: isDark ? "#252526" : "#ffffff",
            border: isDark ? "1px solid #454545" : "1px solid #c8c8c8",
          },
          ".cm-tooltip-autocomplete ul li[aria-selected]": {
            backgroundColor: isDark ? "#04395e" : "#d6ebff",
            color: isDark ? "#ffffff" : "#1e1e1e",
          },
          ".cm-placeholder": {
            color: isDark ? "#6a6a6a" : "#999999",
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

  // Handle clicks in empty space below the content
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const view = viewRef.current;
    if (!view || readOnly || loading) return;

    const container = editorRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Check if click is within the container
    if (
      event.clientX < containerRect.left ||
      event.clientX > containerRect.right ||
      event.clientY < containerRect.top ||
      event.clientY > containerRect.bottom
    ) {
      return;
    }

    // Get document info
    const docLength = view.state.doc.length;
    const lastLineBlock = view.lineBlockAt(docLength);
    const lineHeight = view.defaultLineHeight;

    // Calculate the content bottom position relative to the viewport
    // Account for the container's position and any scroll
    const scrollDOM = view.scrollDOM;
    const scrollTop = scrollDOM.scrollTop;
    const editorTop = containerRect.top;

    // lastLineBlock.bottom is in document coordinates, need to convert to screen
    const contentBottom = editorTop + lastLineBlock.bottom - scrollTop;

    // Check if click is below the last line of content
    if (event.clientY > contentBottom + 5) { // 5px buffer
      // Calculate how many lines we need to add
      const linesToAdd = Math.max(1, Math.ceil((event.clientY - contentBottom) / lineHeight));

      // Create newlines to insert
      const newlines = "\n".repeat(linesToAdd);

      // Insert newlines at the end of document and move cursor there
      view.dispatch({
        changes: { from: docLength, insert: newlines },
        selection: { anchor: docLength + linesToAdd },
        scrollIntoView: true,
      });

      // Focus the editor
      view.focus();
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Editor Container - clean, minimal styling */}
      <div
        ref={editorRef}
        onClick={handleContainerClick}
        className={`
          flex-1 overflow-auto cursor-text
          ${error ? 'ring-1 ring-red-500/50' : ''}
        `}
        style={{ minHeight: 0 }}
      />

      {/* Error indicator */}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-400 truncate">{error}</p>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-bg-primary/70 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded bg-bg-secondary border border-border shadow-md">
            <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-sm text-text-primary">Executing...</span>
          </div>
        </div>
      )}
    </div>
  );
});

SqlEditor.displayName = "SqlEditor";
