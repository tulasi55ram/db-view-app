import { type FC, useEffect, useRef } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import {
  autocompletion,
  CompletionContext,
  nextSnippetField,
  prevSnippetField,
  clearSnippet
} from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import type { ColumnMetadata, TableInfo } from "@dbview/core";
import { SQL_SNIPPETS } from "../utils/sqlSnippets";

export interface CodeMirrorSqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  height?: string;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  // Autocomplete data
  schemas?: string[];
  tables?: TableInfo[];
  columns?: Record<string, ColumnMetadata[]>;
}

export const CodeMirrorSqlEditor: FC<CodeMirrorSqlEditorProps> = ({
  value,
  onChange,
  onRunQuery,
  height = "144px",
  readOnly = false,
  loading = false,
  error,
  schemas = [],
  tables = [],
  columns = {}
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());

  // Store autocomplete data in a ref so it can be updated without recreating the editor
  const autocompleteDataRef = useRef({ schemas, tables, columns });

  // Update the ref whenever autocomplete data changes
  useEffect(() => {
    autocompleteDataRef.current = { schemas, tables, columns };
  }, [schemas, tables, columns]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Custom SQL autocomplete - uses ref to always get latest data
    const sqlAutocomplete = (context: CompletionContext) => {
      const word = context.matchBefore(/\w*/);
      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      const suggestions: any[] = [];

      // Get latest autocomplete data from ref
      const { schemas, tables, columns } = autocompleteDataRef.current;

      // SQL Snippets (match by prefix for discoverability)
      const snippetMatches = SQL_SNIPPETS.filter(snippet =>
        snippet.label.toLowerCase().startsWith(word.text.toLowerCase())
      );
      suggestions.push(...snippetMatches);

      // SQL Keywords
      const keywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
        'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN',
        'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
        'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN',
        'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
        'INDEX', 'UNIQUE', 'NULL', 'NOT NULL', 'DEFAULT',
        'DISTINCT', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'TRUE', 'FALSE'
      ];

      keywords.forEach(keyword => {
        suggestions.push({
          label: keyword,
          type: 'keyword',
          boost: 0
        });
      });

      // PostgreSQL Functions
      const functions = [
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
        'NOW', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
        'UPPER', 'LOWER', 'CONCAT', 'COALESCE', 'NULLIF', 'CAST'
      ];

      functions.forEach(func => {
        suggestions.push({
          label: func,
          type: 'function',
          apply: `${func}()`,
          boost: 1
        });
      });

      // Schemas
      schemas.forEach(schema => {
        suggestions.push({
          label: schema,
          type: 'namespace',
          boost: 2
        });
      });

      // Tables
      tables.forEach(table => {
        const detail = table.rowCount
          ? `${table.schema}.${table.name} (${formatRowCount(table.rowCount)} rows)`
          : `${table.schema}.${table.name}`;

        suggestions.push({
          label: table.name,
          detail,
          type: 'class',
          boost: 3
        });

        // Also suggest fully qualified name
        suggestions.push({
          label: `${table.schema}.${table.name}`,
          detail,
          type: 'class',
          boost: 3
        });
      });

      // Columns (show all available columns)
      Object.entries(columns).forEach(([tableName, cols]) => {
        cols.forEach(col => {
          const typeInfo = col.nullable ? `${col.type} (nullable)` : col.type;
          const pkInfo = col.isPrimaryKey ? ', PK' : '';

          suggestions.push({
            label: col.name,
            detail: `${typeInfo}${pkInfo}`,
            type: 'property',
            boost: 4
          });
        });
      });

      return {
        from: word.from,
        options: suggestions,
        validFor: /^\w*$/
      };
    };

    // VSCode-style dark theme
    const darkTheme = EditorView.theme({
      "&": {
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        height: height,
        fontSize: "13px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
      },
      ".cm-content": {
        caretColor: "#3b82f6",
        padding: "8px 0"
      },
      ".cm-cursor": {
        borderLeftColor: "#3b82f6"
      },
      ".cm-activeLine": {
        backgroundColor: "#1e293b"
      },
      ".cm-activeLineGutter": {
        backgroundColor: "#1e293b"
      },
      ".cm-gutters": {
        backgroundColor: "#0f172a",
        color: "#64748b",
        border: "none",
        minWidth: "36px"
      },
      ".cm-lineNumbers .cm-gutterElement": {
        padding: "0 8px 0 4px"
      },
      "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "#334155"
      },
      ".cm-selectionBackground": {
        backgroundColor: "#1e293b"
      },
      ".cm-tooltip": {
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        color: "#f8fafc"
      },
      ".cm-tooltip-autocomplete": {
        backgroundColor: "#1e293b",
        border: "1px solid #334155"
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "#334155",
        color: "#f8fafc"
      },
      ".cm-completionIcon": {
        width: "1em",
        fontSize: "14px",
        lineHeight: "1",
        marginRight: "0.5em",
        textAlign: "center",
        color: "#94a3b8"
      },
      ".cm-completionIcon-keyword": { color: "#569cd6" },
      ".cm-completionIcon-function": { color: "#dcdcaa" },
      ".cm-completionIcon-class": { color: "#4ec9b0" },
      ".cm-completionIcon-property": { color: "#9cdcfe" },
      ".cm-completionIcon-namespace": { color: "#c586c0" },
      ".cm-completionIcon-snippet": { color: "#c586c0", fontWeight: "500" }
    }, { dark: true });

    // Custom syntax highlighting for SQL
    const sqlHighlighting = syntaxHighlighting(defaultHighlightStyle);

    // Custom keybindings
    const customKeybindings = keymap.of([
      {
        key: "Mod-Enter",
        run: () => {
          if (!loading && value.trim()) {
            onRunQuery();
          }
          return true;
        }
      },
      // Snippet navigation (higher priority than default Tab behavior)
      { key: "Tab", run: nextSnippetField, shift: prevSnippetField },
      { key: "Escape", run: clearSnippet },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab
    ]);

    const startState = EditorState.create({
      doc: value,
      extensions: [
        EditorView.lineWrapping,
        history(),
        search(),
        sql({ dialect: PostgreSQL }),
        sqlHighlighting,
        autocompletion({
          override: [sqlAutocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 12
        }),
        customKeybindings,
        darkTheme,
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly || loading)),
        placeholderExt("Write your SQL query here..."),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onChange(newValue);
          }
        })
      ]
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current
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
        effects: readOnlyCompartment.current.reconfigure(
          EditorState.readOnly.of(readOnly || loading)
        )
      });
    }
  }, [readOnly, loading]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value
          }
        });
      }
    }
  }, [value]);

  return (
    <div className="relative">
      <div
        ref={editorRef}
        className="rounded border border-vscode-border overflow-hidden"
        style={{ height }}
      />

      {/* Error indicator border */}
      {error && (
        <div className="absolute inset-0 pointer-events-none border-2 border-vscode-error/50 rounded" />
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-vscode-bg/50 backdrop-blur-[1px] flex items-center justify-center rounded">
          <div className="flex items-center gap-2 text-sm text-vscode-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-vscode-accent border-t-transparent" />
            <span>Executing query...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format row count
function formatRowCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}
