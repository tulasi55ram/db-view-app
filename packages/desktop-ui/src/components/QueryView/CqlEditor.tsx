import { type FC, useEffect, useRef } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import {
  autocompletion,
  nextSnippetField,
  prevSnippetField,
  clearSnippet,
} from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import { useTheme } from "@/design-system";
import { createSmartCqlCompletion, type CqlAutocompleteData, type CqlTableInfo, type CqlColumnMetadata } from "@/utils/cqlAutocomplete";

// Simple CQL syntax highlighting using StreamParser
const cqlLanguage = StreamLanguage.define({
  name: "cql",
  token(stream) {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Single-line comments
    if (stream.match("--") || stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    // Block comments
    if (stream.match("/*")) {
      while (!stream.eol()) {
        if (stream.match("*/")) break;
        stream.next();
      }
      return "comment";
    }

    // Strings (single quotes)
    if (stream.match("'")) {
      while (!stream.eol()) {
        if (stream.match("''")) continue; // Escaped quote
        if (stream.match("'")) break;
        stream.next();
      }
      return "string";
    }

    // Strings (double quotes for identifiers)
    if (stream.match('"')) {
      while (!stream.eol()) {
        if (stream.match('""')) continue;
        if (stream.match('"')) break;
        stream.next();
      }
      return "string-2";
    }

    // Numbers (including hex)
    if (stream.match(/^0x[0-9a-fA-F]+/) || stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) {
      return "number";
    }

    // UUID pattern
    if (stream.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)) {
      return "string";
    }

    // Operators
    if (stream.match(/^[+\-*/%=<>!&|^~]+/) || stream.match(/^[(),;.\[\]{}:]/)) {
      return "operator";
    }

    // Keywords and identifiers
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      const word = stream.current().toUpperCase();

      // CQL Keywords
      const keywords = [
        "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "INSERT", "INTO",
        "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "ALTER", "DROP", "TABLE",
        "KEYSPACE", "INDEX", "TYPE", "FUNCTION", "AGGREGATE", "TRIGGER", "MATERIALIZED",
        "VIEW", "IF", "EXISTS", "PRIMARY", "KEY", "PARTITION", "CLUSTERING", "ORDER",
        "BY", "ASC", "DESC", "LIMIT", "ALLOW", "FILTERING", "USING", "TTL", "TIMESTAMP",
        "BATCH", "BEGIN", "APPLY", "UNLOGGED", "LOGGED", "COUNTER", "GRANT", "REVOKE",
        "ON", "TO", "ALL", "PERMISSIONS", "OF", "WITH", "CONTAINS", "TOKEN", "AS",
        "COMPACT", "STORAGE", "STATIC", "FROZEN", "TUPLE", "LIST", "SET", "MAP",
        "NULL", "TRUE", "FALSE", "JSON", "DISTINCT", "CAST", "GROUP", "PER", "PARTITION",
        "TRUNCATE", "DESCRIBE", "USE", "CONSISTENCY", "LEVEL", "WRITETIME", "ONLY",
        "RETURNS", "CALLED", "INPUT", "LANGUAGE", "DETERMINISTIC", "MONOTONIC",
        "SFUNC", "STYPE", "FINALFUNC", "INITCOND", "CUSTOM", "OPTIONS", "REPLICATION",
        "DURABLE_WRITES", "CLASS", "SIMPLE", "NETWORK_TOPOLOGY",
      ];

      if (keywords.includes(word)) {
        return "keyword";
      }

      // CQL Data Types
      const types = [
        "ASCII", "BIGINT", "BLOB", "BOOLEAN", "COUNTER", "DATE", "DECIMAL", "DOUBLE",
        "DURATION", "FLOAT", "INET", "INT", "SMALLINT", "TEXT", "TIME", "TIMESTAMP",
        "TIMEUUID", "TINYINT", "UUID", "VARCHAR", "VARINT",
      ];

      if (types.includes(word)) {
        return "type";
      }

      // CQL Functions
      const functions = [
        "NOW", "UUID", "TIMEUUID", "MINUUID", "MAXUUID", "TODATE", "TOTIMESTAMP",
        "TOUNIXTIME", "DATEOF", "UNIXTIMESTAMPOF", "MINTIMEUUID", "MAXTIMEUUID",
        "TOKEN", "TTL", "WRITETIME", "BLOBTOTEXT", "TEXTTOBLOB", "BLOBTOASCII",
        "ASCIITOBLOB", "BLOBTOBIGINT", "BIGINTTOBLOB", "BLOBTOINT", "INTTOBLOB",
        "COUNT", "SUM", "AVG", "MIN", "MAX", "CAST", "TYPEOF",
      ];

      if (functions.includes(word)) {
        return "builtin";
      }

      return "variable";
    }

    stream.next();
    return null;
  },
});

export interface CqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  height?: string;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  // Autocomplete data for Cassandra
  keyspaces?: string[];
  tables?: CqlTableInfo[];
  columns?: Record<string, CqlColumnMetadata[]>;
}

export const CqlEditor: FC<CqlEditorProps> = ({
  value,
  onChange,
  onRunQuery,
  height = "200px",
  readOnly = false,
  loading = false,
  error,
  keyspaces = [],
  tables = [],
  columns = {},
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  const { resolvedTheme } = useTheme();

  // Store autocomplete data in a ref so it can be updated without recreating the editor
  const autocompleteDataRef = useRef<CqlAutocompleteData>({
    keyspaces,
    tables,
    columns,
  });

  // Update the ref whenever autocomplete data changes
  useEffect(() => {
    autocompleteDataRef.current = {
      keyspaces,
      tables,
      columns,
    };
  }, [keyspaces, tables, columns]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Create smart CQL autocomplete
    const smartCqlComplete = createSmartCqlCompletion(() => autocompleteDataRef.current);

    // Create theme based on current mode
    const createEditorTheme = (isDark: boolean) =>
      EditorView.theme(
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

    const editorTheme = createEditorTheme(resolvedTheme === "dark");

    // Custom syntax highlighting
    const cqlHighlighting = syntaxHighlighting(defaultHighlightStyle);

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
      // Snippet navigation
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
        cqlLanguage,
        cqlHighlighting,
        autocompletion({
          override: [smartCqlComplete],
          activateOnTyping: true,
          maxRenderedOptions: 20,
          defaultKeymap: true,
        }),
        customKeybindings,
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly || loading)),
        placeholderExt("Write your CQL query here... (Ctrl+Space for autocomplete)"),
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
    view.focus();

    return () => {
      view.destroy();
    };
  }, []);

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

      {/* Database type badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium rounded bg-orange-600/20 text-orange-500 uppercase tracking-wide">
        CQL
      </div>

      {/* Error indicator border */}
      {error && <div className="absolute inset-0 pointer-events-none border-2 border-error/50 rounded" />}

      {/* Loading overlay */}
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
};
