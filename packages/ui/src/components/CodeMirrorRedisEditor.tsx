import { type FC, useEffect, useRef, useState } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import { ALL_REDIS_COMMANDS } from "../constants";

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

export interface CodeMirrorRedisEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunCommand: () => void;
  height?: string;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
}

const PLACEHOLDER_TEXT = `# Redis Command Examples
# Press Cmd/Ctrl+Enter to run

# String operations
GET user:1001:name
SET user:1001:name "John Doe" EX 3600

# Hash operations
HGETALL user:1001
HSET user:1001 name "John" age 30

# List operations
LRANGE messages:inbox 0 -1

# Key scanning
KEYS user:*
SCAN 0 MATCH session:* COUNT 100

# Server info
INFO server`;

// Create Redis-themed editor (red accent)
function createEditorTheme(isDark: boolean, height: string) {
  const accentColor = "#ef4444"; // red for Redis

  return EditorView.theme({
    "&": {
      backgroundColor: isDark ? "#171717" : "#ffffff",
      color: isDark ? "#fafafa" : "#171717",
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
      borderLeftColor: accentColor,
      borderLeftWidth: "2px"
    },
    ".cm-activeLine": {
      backgroundColor: isDark ? "#262626" : "#f5f5f5"
    },
    ".cm-activeLineGutter": {
      backgroundColor: isDark ? "#262626" : "#f5f5f5"
    },
    ".cm-gutters": {
      backgroundColor: isDark ? "#171717" : "#fafafa",
      color: isDark ? "#737373" : "#a3a3a3",
      border: "none",
      minWidth: "36px"
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 4px"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: accentColor,
      color: "#ffffff"
    },
    ".cm-selectionBackground": {
      backgroundColor: isDark ? "#262626" : "#e5e5e5"
    },
    ".cm-tooltip": {
      backgroundColor: isDark ? "#262626" : "#ffffff",
      border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
      color: isDark ? "#fafafa" : "#171717"
    },
    ".cm-tooltip-autocomplete": {
      backgroundColor: isDark ? "#262626" : "#ffffff",
      border: isDark ? "1px solid #404040" : "1px solid #e5e5e5"
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: isDark ? "#404040" : "#e5e5e5",
      color: isDark ? "#fafafa" : "#171717"
    },
    ".cm-completionIcon": {
      width: "1em",
      fontSize: "14px",
      lineHeight: "1",
      marginRight: "0.5em",
      textAlign: "center",
      color: isDark ? "#a3a3a3" : "#737373"
    },
    ".cm-completionIcon-keyword": { color: accentColor },
    ".cm-placeholder": {
      color: isDark ? "#737373" : "#a3a3a3",
      fontStyle: "italic",
      whiteSpace: "pre-wrap",
      lineHeight: "1.5",
      display: "inline-block",
      verticalAlign: "top"
    }
  }, { dark: isDark });
}

export const CodeMirrorRedisEditor: FC<CodeMirrorRedisEditorProps> = ({
  value,
  onChange,
  onRunCommand,
  height = "144px",
  readOnly = false,
  loading = false,
  error
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(detectTheme);

  useEffect(() => {
    if (!editorRef.current) return;

    // Redis command autocomplete
    const redisAutocomplete = (context: CompletionContext) => {
      const word = context.matchBefore(/[\w\s]*/);
      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      const input = word.text.toUpperCase().trim();
      const suggestions: any[] = [];

      // Match commands
      ALL_REDIS_COMMANDS.forEach(({ cmd, args, desc }) => {
        if (cmd.startsWith(input) || input === "") {
          suggestions.push({
            label: cmd,
            detail: args,
            info: desc,
            type: "keyword",
            boost: cmd.startsWith(input) ? 2 : 1,
          });
        }
      });

      return {
        from: word.from,
        options: suggestions,
        validFor: /^[\w\s]*$/,
      };
    };

    const isDark = currentTheme === 'dark';
    const editorTheme = createEditorTheme(isDark, height);

    const customKeybindings = keymap.of([
      {
        key: "Mod-Enter",
        run: () => {
          if (!loading && value.trim()) {
            onRunCommand();
          }
          return true;
        }
      },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap
    ]);

    const startState = EditorState.create({
      doc: value,
      extensions: [
        EditorView.lineWrapping,
        history(),
        search(),
        autocompletion({
          override: [redisAutocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 15
        }),
        customKeybindings,
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly || loading)),
        placeholderExt(PLACEHOLDER_TEXT),
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
  }, []);

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
      const newTheme = createEditorTheme(isDark, height);
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(newTheme)
      });
    }
  }, [currentTheme, height]);

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
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            <span>Executing command...</span>
          </div>
        </div>
      )}
    </div>
  );
};
