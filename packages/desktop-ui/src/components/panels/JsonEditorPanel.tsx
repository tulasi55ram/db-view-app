import { useState, useCallback, useEffect, useRef, memo } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { Check, X, Wand2, Copy, ClipboardPaste, AlertCircle, CheckCircle2, Braces } from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { getElectronAPI } from "@/electron";
import { SidePanel, SidePanelFooter } from "./SidePanel";

interface JsonEditorPanelProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  columnName: string;
  columnType: string;
  /** Panel variant - "inline" for resizable side panel, "overlay" for legacy behavior */
  variant?: "inline" | "overlay";
}

// Editor theme using CSS variables for theme support
const editorTheme = EditorView.theme({
  "&": {
    color: "var(--text-primary)",
    backgroundColor: "var(--bg-primary)",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    padding: "8px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "rgba(59, 130, 246, 0.3)",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--border)",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--border)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(59, 130, 246, 0.35)",
    outline: "1px solid var(--accent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--bg-hover)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "rgba(59, 130, 246, 0.3)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-tertiary)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--bg-hover)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-tertiary)",
  },
  ".cm-tooltip": {
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg-tertiary)",
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: "var(--bg-tertiary)",
    borderBottomColor: "var(--bg-tertiary)",
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "white",
    },
  },
  ".cm-lintRange-error": {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l2 -2 l1 0 l2 2 l1 0' stroke='%23ef4444' fill='none' stroke-width='1.2'/></svg>")`,
  },
  ".cm-lintRange-warning": {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l2 -2 l1 0 l2 2 l1 0' stroke='%23f59e0b' fill='none' stroke-width='1.2'/></svg>")`,
  },
  ".cm-diagnostic": {
    padding: "3px 6px 3px 8px",
    marginLeft: "-1px",
    display: "block",
    whiteSpace: "pre-wrap",
  },
  ".cm-diagnostic-error": {
    borderLeft: "3px solid #ef4444",
    background: "rgba(239, 68, 68, 0.1)",
    color: "#fca5a5",
  },
  ".cm-diagnostic-warning": {
    borderLeft: "3px solid #f59e0b",
    background: "rgba(245, 158, 11, 0.1)",
    color: "#fcd34d",
  },
});

// Custom syntax highlighting for JSON
const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.string, color: "#a5d6a7" }, // Green for strings
  { tag: tags.number, color: "#ffcc80" }, // Orange for numbers
  { tag: tags.bool, color: "#ce93d8" }, // Purple for true/false
  { tag: tags.null, color: "#90a4ae" }, // Gray for null
  { tag: tags.propertyName, color: "#81d4fa" }, // Cyan for property names (keys)
  { tag: tags.punctuation, color: "#b0bec5" }, // Light gray for brackets, commas
  { tag: tags.brace, color: "#b0bec5" }, // Light gray for { }
  { tag: tags.squareBracket, color: "#b0bec5" }, // Light gray for [ ]
]);

export const JsonEditorPanel = memo(function JsonEditorPanel({
  open,
  onClose,
  value,
  onChange,
  columnName,
  columnType,
  variant = "inline",
}: JsonEditorPanelProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isNull, setIsNull] = useState(value?.toUpperCase() === "NULL");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);

  // Parse and format initial value
  const getInitialValue = useCallback((): string => {
    if (!value || value.toUpperCase() === "NULL") {
      return "{}";
    }

    try {
      // Try to parse and pretty-print
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if not valid JSON
      return value;
    }
  }, [value]);

  // Callback ref to detect when editor container is mounted
  const editorRef = useCallback((node: HTMLDivElement | null) => {
    editorContainerRef.current = node;
    if (node) {
      setEditorMounted(true);
    } else {
      setEditorMounted(false);
    }
  }, []);

  // Initialize CodeMirror when container is mounted
  useEffect(() => {
    if (!open || !editorMounted || !editorContainerRef.current || isNull) return;

    // Clear any existing editor
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Clear the container
    editorContainerRef.current.innerHTML = "";

    const initialValue = getInitialValue();

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        syntaxHighlighting(jsonHighlightStyle),
        json(),
        linter(jsonParseLinter()),
        lintGutter(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            try {
              JSON.parse(content);
              setJsonError(null);
            } catch (e) {
              setJsonError((e as Error).message);
            }
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;

    // Add custom keyboard handlers for clipboard in Electron
    const api = getElectronAPI();
    if (api) {
      const handleKeyDown = async (e: KeyboardEvent) => {
        const isMod = e.metaKey || e.ctrlKey;

        if (isMod && e.key === "c") {
          e.preventDefault();
          const { from, to } = view.state.selection.main;
          const content = from !== to
            ? view.state.sliceDoc(from, to)
            : view.state.doc.toString();
          await api.copyToClipboard(content);
        } else if (isMod && e.key === "v") {
          e.preventDefault();
          const text = await api.readFromClipboard();
          if (text) {
            const { from, to } = view.state.selection.main;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length },
            });
          }
        } else if (isMod && e.key === "x") {
          e.preventDefault();
          const { from, to } = view.state.selection.main;
          if (from !== to) {
            const content = view.state.sliceDoc(from, to);
            await api.copyToClipboard(content);
            view.dispatch({
              changes: { from, to, insert: "" },
            });
          }
        }
      };

      view.dom.addEventListener("keydown", handleKeyDown);
      (view as any)._keydownCleanup = () => {
        view.dom.removeEventListener("keydown", handleKeyDown);
      };
    }

    // Initial validation
    try {
      JSON.parse(initialValue);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }

    // Focus the editor
    setTimeout(() => view.focus(), 50);

    return () => {
      // Clean up keydown listener
      if ((view as any)._keydownCleanup) {
        (view as any)._keydownCleanup();
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [open, isNull, editorMounted, getInitialValue]);

  // Reset editorMounted when panel closes
  useEffect(() => {
    if (!open) {
      setEditorMounted(false);
    }
  }, [open]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleFormat = useCallback(() => {
    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);

      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: formatted,
        },
      });

      setJsonError(null);
      toast.success("JSON formatted");
    } catch {
      toast.error("Cannot format: Invalid JSON");
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    const content = from !== to
      ? view.state.sliceDoc(from, to)
      : view.state.doc.toString();

    try {
      const api = getElectronAPI();
      if (api) {
        await api.copyToClipboard(content);
      } else {
        await navigator.clipboard.writeText(content);
      }
      toast.success(from !== to ? "Selection copied" : "Copied to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Failed to copy to clipboard");
    }
  }, []);

  const handlePaste = useCallback(async () => {
    if (!viewRef.current) return;

    try {
      const api = getElectronAPI();
      let clipboardText = "";

      if (api) {
        clipboardText = await api.readFromClipboard();
      } else {
        clipboardText = await navigator.clipboard.readText();
      }

      if (clipboardText) {
        const view = viewRef.current;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: clipboardText },
          selection: { anchor: from + clipboardText.length },
        });
        toast.success("Pasted from clipboard");
      }
    } catch (err) {
      console.error("Paste failed:", err);
      toast.error("Failed to paste from clipboard");
    }
  }, []);

  const handleSave = useCallback(() => {
    if (isNull) {
      onChange("NULL");
      onClose();
      return;
    }

    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();

    // Validate before saving
    try {
      JSON.parse(content);
      onChange(content);
      onClose();
    } catch {
      toast.error("Cannot save: Invalid JSON");
    }
  }, [isNull, onChange, onClose]);

  if (!open) return null;

  // Shared editor content
  const editorContent = (
    <>
      {/* NULL Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-tertiary/50">
        <span className="text-xs text-text-secondary">Set as NULL</span>
        <button
          onClick={() => setIsNull(!isNull)}
          className={cn(
            "relative w-10 h-5 rounded-full transition-colors",
            isNull ? "bg-accent" : "bg-bg-hover border border-border"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
              isNull ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {!isNull && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <button
              onClick={handleFormat}
              className="px-2.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5 border border-border"
              title="Format JSON (pretty print)"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Format
            </button>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5 border border-border"
              title="Copy to clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            <button
              onClick={handlePaste}
              className="px-2.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5 border border-border"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste
            </button>
          </div>

          {/* Editor Container */}
          <div
            className={cn(
              "flex-1 overflow-hidden border-b",
              jsonError ? "border-error" : "border-border"
            )}
          >
            <div
              ref={editorRef}
              className="h-full overflow-auto bg-bg-primary"
            />
          </div>

          {/* Validation Status */}
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-2",
              jsonError
                ? "bg-error/10 text-error"
                : "bg-success/10 text-success"
            )}
          >
            {jsonError ? (
              <>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs truncate">{jsonError}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">Valid JSON</span>
              </>
            )}
          </div>
        </>
      )}

      {isNull && (
        <div className="flex-1 flex items-center justify-center text-text-tertiary">
          <span className="text-sm italic">Value will be set to NULL</span>
        </div>
      )}
    </>
  );

  // Shared footer content
  const footerContent = (
    <SidePanelFooter className="justify-between w-full">
      <span className="text-[10px] text-text-tertiary">
        Esc to cancel
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isNull && !!jsonError}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5",
            !isNull && jsonError
              ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
              : "bg-accent hover:bg-accent/90 text-white"
          )}
        >
          <Check className="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </SidePanelFooter>
  );

  // Inline mode - uses SidePanel wrapper (for use inside PanelGroup)
  if (variant === "inline") {
    return (
      <SidePanel
        title={`Edit ${columnName}`}
        subtitle={`Type: ${columnType}`}
        icon={<Braces className="w-4 h-4" />}
        onClose={onClose}
        footer={footerContent}
      >
        {editorContent}
      </SidePanel>
    );
  }

  // Overlay mode - legacy fixed positioning with backdrop
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-[600px] h-full bg-bg-primary border-l border-border shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Edit {columnName}
            </h3>
            <p className="text-[10px] text-text-tertiary mt-0.5">Type: {columnType}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {editorContent}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-secondary">
          <span className="text-[10px] text-text-tertiary">
            Esc to cancel
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isNull && !!jsonError}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5",
                !isNull && jsonError
                  ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                  : "bg-accent hover:bg-accent/90 text-white"
              )}
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
