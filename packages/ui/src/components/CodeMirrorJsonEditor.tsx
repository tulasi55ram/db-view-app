import { type FC, useEffect, useRef, useState } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import type { DatabaseType } from "@dbview/types";
import {
  MONGO_COMMANDS,
  MONGO_OPERATORS,
  MONGO_STAGES,
  ES_COMMANDS,
  ES_QUERY_AUTOCOMPLETE,
  ES_AGG_AUTOCOMPLETE,
} from "../constants";

// Detect theme from document
function detectTheme(): 'light' | 'dark' {
  if (document.body.classList.contains('vscode-light') ||
      document.body.classList.contains('vscode-high-contrast-light')) {
    return 'light';
  }
  if (document.body.classList.contains('vscode-dark') ||
      document.body.classList.contains('vscode-high-contrast')) {
    return 'dark';
  }
  const dataTheme = document.documentElement.getAttribute('data-theme');
  if (dataTheme === 'light' || dataTheme === 'high-contrast-light') {
    return 'light';
  }
  return 'dark';
}

export interface CodeMirrorJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  height?: string;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  dbType: DatabaseType;
  collections?: string[];
}

// Placeholder by database type
const PLACEHOLDERS: Record<string, string> = {
  mongodb: `// MongoDB Aggregation Pipeline Example
// Press Cmd/Ctrl+Enter to run

db.collection.aggregate([
  { "$match": { "status": "active" } },
  { "$group": { "_id": "$category", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } },
  { "$limit": 10 }
])

// Or simple find query:
// db.users.find({ "age": { "$gte": 18 } }).limit(20)`,
  elasticsearch: `// Elasticsearch Query DSL Example
// Press Cmd/Ctrl+Enter to run

{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "search term" } }
      ],
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "date": { "gte": "2024-01-01" } } }
      ]
    }
  },
  "size": 10,
  "sort": [{ "date": "desc" }]
}`,
  cassandra: `-- CQL Query Example
-- Press Cmd/Ctrl+Enter to run

SELECT * FROM users
WHERE user_id = 'abc123'
  AND created_at > '2024-01-01'
LIMIT 100;

-- Or with aggregation:
-- SELECT category, COUNT(*) as total
-- FROM products
-- GROUP BY category;`,
};

// Create theme based on light/dark mode with db-specific accent colors
function createEditorTheme(isDark: boolean, height: string, dbType: DatabaseType) {
  const accentColors: Record<string, string> = {
    mongodb: "#10b981", // green
    elasticsearch: "#eab308", // yellow
    cassandra: "#3b82f6", // blue
  };
  const accentColor = accentColors[dbType] || "#3b82f6";

  return EditorView.theme({
    "&": {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      color: isDark ? "#f8fafc" : "#1e293b",
      height: height,
      fontSize: "13px",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    },
    ".cm-scroller": {
      overflow: "auto",
      height: "100%"
    },
    ".cm-content": {
      caretColor: accentColor,
      padding: "8px 0",
      minHeight: "100%"
    },
    ".cm-cursor": {
      borderLeftColor: accentColor
    },
    ".cm-activeLine": {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9"
    },
    ".cm-activeLineGutter": {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9"
    },
    ".cm-gutters": {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      color: isDark ? "#64748b" : "#94a3b8",
      border: "none",
      minWidth: "36px"
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 4px"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: isDark ? "#334155" : "#bfdbfe"
    },
    ".cm-selectionBackground": {
      backgroundColor: isDark ? "#1e293b" : "#e2e8f0"
    },
    ".cm-tooltip": {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      color: isDark ? "#f8fafc" : "#1e293b"
    },
    ".cm-tooltip-autocomplete": {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0"
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: isDark ? "#334155" : "#e2e8f0",
      color: isDark ? "#f8fafc" : "#1e293b"
    },
    ".cm-completionIcon": {
      width: "1em",
      fontSize: "14px",
      lineHeight: "1",
      marginRight: "0.5em",
      textAlign: "center",
      color: isDark ? "#94a3b8" : "#64748b"
    },
    ".cm-completionIcon-keyword": { color: isDark ? "#569cd6" : "#0000ff" },
    ".cm-completionIcon-function": { color: isDark ? "#dcdcaa" : "#795e26" },
    ".cm-completionIcon-class": { color: isDark ? "#4ec9b0" : "#267f99" },
    ".cm-completionIcon-property": { color: isDark ? "#9cdcfe" : "#001080" },
    ".cm-placeholder": {
      color: isDark ? "#64748b" : "#94a3b8",
      fontStyle: "italic",
      whiteSpace: "pre-wrap",
      lineHeight: "1.5",
      display: "inline-block",
      verticalAlign: "top"
    }
  }, { dark: isDark });
}

export const CodeMirrorJsonEditor: FC<CodeMirrorJsonEditorProps> = ({
  value,
  onChange,
  onRunQuery,
  height = "144px",
  readOnly = false,
  loading = false,
  error,
  dbType,
  collections = []
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(detectTheme);

  const autocompleteDataRef = useRef({ collections });

  useEffect(() => {
    autocompleteDataRef.current = { collections };
  }, [collections]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Create autocomplete based on dbType
    const createAutocomplete = (context: CompletionContext) => {
      const word = context.matchBefore(/[\w$]*/);
      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      const suggestions: any[] = [];
      const { collections } = autocompleteDataRef.current;

      if (dbType === 'mongodb') {
        // MongoDB operators
        MONGO_OPERATORS.forEach(op => {
          suggestions.push({
            label: op.op,
            detail: op.desc,
            type: 'keyword',
            boost: 2
          });
        });

        // MongoDB stages
        MONGO_STAGES.forEach(stage => {
          suggestions.push({
            label: stage.stage,
            detail: stage.desc,
            type: 'function',
            boost: 1
          });
        });

        // Collections
        collections.forEach(col => {
          suggestions.push({
            label: col,
            detail: 'Collection',
            type: 'class',
            boost: 3
          });
        });
      } else if (dbType === 'elasticsearch') {
        // ES Query types
        ES_QUERY_AUTOCOMPLETE.forEach(q => {
          suggestions.push({
            label: q.type,
            detail: q.desc,
            type: 'keyword',
            boost: 2
          });
        });

        // ES Aggregations
        ES_AGG_AUTOCOMPLETE.forEach(agg => {
          suggestions.push({
            label: agg.type,
            detail: agg.desc,
            type: 'function',
            boost: 1
          });
        });

        // Indices as collections
        collections.forEach(idx => {
          suggestions.push({
            label: idx,
            detail: 'Index',
            type: 'class',
            boost: 3
          });
        });
      }

      // JSON structure keywords
      const jsonKeywords = ['true', 'false', 'null'];
      jsonKeywords.forEach(kw => {
        suggestions.push({
          label: kw,
          type: 'keyword',
          boost: 0
        });
      });

      return {
        from: word.from,
        options: suggestions,
        validFor: /^[\w$]*$/
      };
    };

    const isDark = currentTheme === 'dark';
    const editorTheme = createEditorTheme(isDark, height, dbType);
    const jsonHighlighting = syntaxHighlighting(defaultHighlightStyle);

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
        json(),
        jsonHighlighting,
        autocompletion({
          override: [createAutocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 12
        }),
        customKeybindings,
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly || loading)),
        placeholderExt(PLACEHOLDERS[dbType] || PLACEHOLDERS.mongodb),
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
    view.focus();

    return () => {
      view.destroy();
    };
  }, [dbType]); // Recreate when dbType changes

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(
          EditorState.readOnly.of(readOnly || loading)
        )
      });
    }
  }, [readOnly, loading]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = detectTheme();
      if (newTheme !== currentTheme) {
        setCurrentTheme(newTheme);
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, [currentTheme]);

  useEffect(() => {
    if (viewRef.current) {
      const isDark = currentTheme === 'dark';
      const newTheme = createEditorTheme(isDark, height, dbType);
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(newTheme)
      });
    }
  }, [currentTheme, height, dbType]);

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
    <div className="relative h-full">
      <div
        ref={editorRef}
        className="h-full rounded border border-vscode-border overflow-hidden"
        style={{ height: height === "100%" ? "100%" : height }}
      />

      {error && (
        <div className="absolute inset-0 pointer-events-none border-2 border-vscode-error/50 rounded" />
      )}

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
