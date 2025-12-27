import { useState, useCallback, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { Check, X, Wand2, Copy, ClipboardPaste, AlertCircle, CheckCircle2, Minimize2, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/primitives/Dialog";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { getElectronAPI } from "@/electron";

interface JSONEditorProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  columnName: string;
  columnType: string;
}

// Custom dark theme for CodeMirror
const darkTheme = EditorView.theme(
  {
    "&": {
      color: "#e0e0e0",
      backgroundColor: "var(--bg-primary)",
      fontSize: "13px",
      fontFamily: "'JetBrains Mono', monospace",
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
      backgroundColor: "#72a1ff59",
      outline: "1px solid #457dff",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "#6199ff2f",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "#aafe661a",
    },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "#bad0f847",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-tertiary)",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "#ddd",
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
  },
  { dark: true }
);

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

export function JSONEditor({
  open,
  onClose,
  value,
  onChange,
  columnName,
  columnType,
}: JSONEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isNull, setIsNull] = useState(value?.toUpperCase() === "NULL");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
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
        darkTheme,
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

    // Handle clipboard events for Electron
    // For copy/cut: use e.clipboardData.setData() synchronously (required by browser)
    // For paste: use Electron's async clipboard API
    const api = getElectronAPI();
    if (api) {
      const handleClipboardCopy = (e: ClipboardEvent) => {
        const { from, to } = view.state.selection.main;
        // Get the text to copy - selection if exists, otherwise whole document
        const textToCopy = from !== to
          ? view.state.sliceDoc(from, to)
          : view.state.doc.toString();

        // Use the synchronous clipboardData API (required for copy events)
        if (e.clipboardData) {
          e.preventDefault();
          e.clipboardData.setData("text/plain", textToCopy);
          // Also write to Electron clipboard for cross-app compatibility
          api.copyToClipboard(textToCopy);
        }
      };

      const handleClipboardPaste = async (e: ClipboardEvent) => {
        e.preventDefault();
        // Read from Electron clipboard (async)
        const clipboardText = await api.readFromClipboard();
        if (clipboardText) {
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: clipboardText },
            selection: { anchor: from + clipboardText.length },
          });
        }
      };

      const handleClipboardCut = (e: ClipboardEvent) => {
        const { from, to } = view.state.selection.main;
        // Only cut if there's a selection
        if (from !== to) {
          const selection = view.state.sliceDoc(from, to);
          if (e.clipboardData) {
            e.preventDefault();
            e.clipboardData.setData("text/plain", selection);
            // Also write to Electron clipboard
            api.copyToClipboard(selection);
            // Remove the selected text
            view.dispatch({
              changes: { from, to, insert: "" },
            });
          }
        }
      };

      const editorDom = view.dom;
      editorDom.addEventListener("copy", handleClipboardCopy);
      editorDom.addEventListener("paste", handleClipboardPaste);
      editorDom.addEventListener("cut", handleClipboardCut);

      // Store cleanup function
      (view as any)._clipboardCleanup = () => {
        editorDom.removeEventListener("copy", handleClipboardCopy);
        editorDom.removeEventListener("paste", handleClipboardPaste);
        editorDom.removeEventListener("cut", handleClipboardCut);
      };
    }

    // Initial validation
    try {
      JSON.parse(initialValue);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }

    return () => {
      // Clean up clipboard event listeners
      if ((view as any)._clipboardCleanup) {
        (view as any)._clipboardCleanup();
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [open, isNull, editorMounted, getInitialValue]);

  // Reset editorMounted when dialog closes
  useEffect(() => {
    if (!open) {
      setEditorMounted(false);
    }
  }, [open]);

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
    } catch (e) {
      toast.error("Cannot format: Invalid JSON");
    }
  }, []);

  const handleMinify = useCallback(() => {
    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();
    try {
      const parsed = JSON.parse(content);
      const minified = JSON.stringify(parsed);

      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: minified,
        },
      });

      setJsonError(null);
      toast.success("JSON minified");
    } catch (e) {
      toast.error("Cannot minify: Invalid JSON");
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    // Copy selection if there is one, otherwise copy the whole document
    const content = from !== to
      ? view.state.sliceDoc(from, to)
      : view.state.doc.toString();

    const api = getElectronAPI();
    if (api) {
      await api.copyToClipboard(content);
    } else {
      await navigator.clipboard.writeText(content);
    }
    toast.success(from !== to ? "Selection copied" : "Copied to clipboard");
  }, []);

  const handlePaste = useCallback(async () => {
    if (!viewRef.current) return;

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
    } catch (e) {
      toast.error("Cannot save: Invalid JSON");
    }
  }, [isNull, onChange, onClose]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`Edit ${columnName}`}
        description={`Type: ${columnType}`}
        className={cn(
          "transition-all duration-200 flex flex-col",
          isExpanded
            ? "!max-w-[calc(100vw-48px)] !max-h-[calc(100vh-48px)] !w-[calc(100vw-48px)] !h-[calc(100vh-48px)]"
            : "max-w-2xl"
        )}
      >
        <div className={cn("space-y-4", isExpanded && "flex-1 flex flex-col min-h-0")}>
          {/* NULL Toggle */}
          <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-primary">Set as NULL</span>
            </div>
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
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFormat}
                    className="px-2.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5 border border-border"
                    title="Format JSON (pretty print)"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Format
                  </button>
                  <button
                    onClick={handleMinify}
                    className="px-2.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5 border border-border"
                    title="Minify JSON"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    Minify
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="px-2.5 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5 border border-border"
                    title={isExpanded ? "Shrink editor" : "Expand editor"}
                  >
                    {isExpanded ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Editor Container */}
              <div
                className={cn(
                  "rounded-lg border overflow-hidden transition-all duration-200",
                  jsonError ? "border-error" : "border-border",
                  isExpanded && "flex-1 flex flex-col min-h-0"
                )}
              >
                <div
                  ref={editorRef}
                  className={cn(
                    "overflow-auto bg-bg-primary",
                    isExpanded ? "flex-1 min-h-0" : "h-[300px]"
                  )}
                />
              </div>

              {/* Validation Status */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-shrink-0",
                  jsonError
                    ? "bg-error/10 border border-error/30 text-error"
                    : "bg-success/10 border border-success/30 text-success"
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
            <div className="flex items-center justify-center py-8 text-text-tertiary">
              <span className="text-sm italic">Value will be set to NULL</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <button className="px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </DialogClose>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
