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
  clearSnippet,
} from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import type { ColumnMetadata, TableInfo } from "@dbview/types";
import { SQL_SNIPPETS } from "@/utils/sqlSnippets";
import { useTheme } from "@/design-system";

export interface SqlEditorProps {
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

export const SqlEditor: FC<SqlEditorProps> = ({
  value,
  onChange,
  onRunQuery,
  height = "200px",
  readOnly = false,
  loading = false,
  error,
  schemas = [],
  tables = [],
  columns = {},
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  // Get current theme
  const { resolvedTheme } = useTheme();

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
      const snippetMatches = SQL_SNIPPETS.filter((snippet) =>
        snippet.label.toLowerCase().startsWith(word.text.toLowerCase())
      );
      suggestions.push(...snippetMatches);

      // SQL Keywords
      const keywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "JOIN",
        "LEFT",
        "RIGHT",
        "INNER",
        "OUTER",
        "ON",
        "AND",
        "OR",
        "NOT",
        "IN",
        "LIKE",
        "ILIKE",
        "BETWEEN",
        "ORDER",
        "BY",
        "ASC",
        "DESC",
        "GROUP",
        "HAVING",
        "LIMIT",
        "OFFSET",
        "INSERT",
        "INTO",
        "VALUES",
        "UPDATE",
        "SET",
        "DELETE",
        "CREATE",
        "TABLE",
        "DROP",
        "ALTER",
        "ADD",
        "COLUMN",
        "PRIMARY",
        "KEY",
        "FOREIGN",
        "REFERENCES",
        "CONSTRAINT",
        "INDEX",
        "UNIQUE",
        "NULL",
        "NOT NULL",
        "DEFAULT",
        "DISTINCT",
        "AS",
        "CASE",
        "WHEN",
        "THEN",
        "ELSE",
        "END",
        "UNION",
        "ALL",
        "INTERSECT",
        "EXCEPT",
        "TRUE",
        "FALSE",
      ];

      keywords.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          type: "keyword",
          boost: 0,
        });
      });

      // PostgreSQL Functions
      const functions = [
        "COUNT",
        "SUM",
        "AVG",
        "MIN",
        "MAX",
        "NOW",
        "CURRENT_DATE",
        "CURRENT_TIMESTAMP",
        "UPPER",
        "LOWER",
        "CONCAT",
        "COALESCE",
        "NULLIF",
        "CAST",
      ];

      functions.forEach((func) => {
        suggestions.push({
          label: func,
          type: "function",
          apply: `${func}()`,
          boost: 1,
        });
      });

      // Schemas
      schemas.forEach((schema) => {
        suggestions.push({
          label: schema,
          type: "namespace",
          boost: 2,
        });
      });

      // Tables
      tables.forEach((table) => {
        const detail = table.rowCount
          ? `${table.schema}.${table.name} (${formatRowCount(table.rowCount)} rows)`
          : `${table.schema}.${table.name}`;

        suggestions.push({
          label: table.name,
          detail,
          type: "class",
          boost: 3,
        });

        // Also suggest fully qualified name
        suggestions.push({
          label: `${table.schema}.${table.name}`,
          detail,
          type: "class",
          boost: 3,
        });
      });

      // Columns (show all available columns)
      Object.entries(columns).forEach(([_tableName, cols]) => {
        cols.forEach((col) => {
          const typeInfo = col.nullable ? `${col.type} (nullable)` : col.type;
          const pkInfo = col.isPrimaryKey ? ", PK" : "";

          suggestions.push({
            label: col.name,
            detail: `${typeInfo}${pkInfo}`,
            type: "property",
            boost: 4,
          });
        });
      });

      return {
        from: word.from,
        options: suggestions,
        validFor: /^\w*$/,
      };
    };

    // Create theme based on current mode
    const createEditorTheme = (isDark: boolean) => EditorView.theme(
      {
        "&": {
          backgroundColor: isDark ? "#171717" : "#ffffff",
          color: isDark ? "#fafafa" : "#171717",
          height: height,
          fontSize: "13px",
          lineHeight: "1.5",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
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
        },
        ".cm-tooltip-autocomplete": {
          backgroundColor: isDark ? "#262626" : "#ffffff",
          border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: isDark ? "#404040" : "#e5e5e5",
          color: isDark ? "#fafafa" : "#171717",
        },
        ".cm-completionIcon": {
          width: "1em",
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
        ".cm-placeholder": {
          color: "#737373",
          lineHeight: "1.5",
        },
      },
      { dark: isDark }
    );

    const editorTheme = createEditorTheme(resolvedTheme === "dark");

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
        sql({ dialect: PostgreSQL }),
        sqlHighlighting,
        autocompletion({
          override: [sqlAutocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 12,
        }),
        customKeybindings,
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly || loading)),
        placeholderExt("Write your SQL query here..."),
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
    <div className="relative">
      <div ref={editorRef} className="rounded border border-border overflow-hidden" style={{ height }} />

      {/* Error indicator border */}
      {error && <div className="absolute inset-0 pointer-events-none border-2 border-error/50 rounded" />}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-[1px] flex items-center justify-center rounded">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
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
