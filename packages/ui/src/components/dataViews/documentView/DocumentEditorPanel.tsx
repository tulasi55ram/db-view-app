/**
 * DocumentEditorPanel - Slide-out panel for editing/inserting NoSQL documents
 *
 * Features:
 * - CodeMirror JSON editor with syntax highlighting
 * - Template management (save/load templates per collection)
 * - Insert and Edit modes
 * - JSON validation before save
 */

import { type FC, useEffect, useRef, useState, useCallback } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { linter, lintGutter } from "@codemirror/lint";
import { search, searchKeymap } from "@codemirror/search";
import {
  X,
  Save,
  FileText,
  ChevronDown,
  Trash2,
  Plus,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { DocumentDbType } from "./types";
import { DB_LABELS } from "./types";

/**
 * Creates an empty template from a document structure.
 * Preserves keys but empties values in a type-aware manner:
 * - Strings → ""
 * - Numbers → null
 * - Booleans → false
 * - Arrays → []
 * - Objects → recursively empty
 * - Excludes _id and other internal fields
 */
export function createEmptyTemplate(doc: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    // Skip internal/system fields
    if (key.startsWith('_')) continue;

    result[key] = getEmptyValue(value);
  }

  return result;
}

/**
 * Returns an empty value based on the type of the input value
 */
function getEmptyValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return [];
  }

  if (typeof value === 'object') {
    // Check for special MongoDB/NoSQL types
    if ('$oid' in (value as object)) return null; // ObjectId
    if ('$date' in (value as object)) return null; // Date
    if ('$binary' in (value as object)) return null; // Binary

    // Recursively process nested objects
    const nested: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!k.startsWith('_')) {
        nested[k] = getEmptyValue(v);
      }
    }
    return nested;
  }

  if (typeof value === 'string') {
    return "";
  }

  if (typeof value === 'number') {
    return null;
  }

  if (typeof value === 'boolean') {
    return false;
  }

  return null;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface DocumentEditorPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Mode: 'insert' for new document, 'edit' for existing */
  mode: 'insert' | 'edit';
  /** Database type */
  dbType: DocumentDbType;
  /** Schema/Database name */
  schema: string;
  /** Collection/Table name */
  table: string;
  /** Document ID (for edit mode) */
  documentId?: string;
  /** Initial document content (for edit mode) */
  initialDocument?: Record<string, unknown>;
  /** Save handler */
  onSave: (document: Record<string, unknown>) => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Save error message */
  saveError?: string | null;
  /** Templates for this collection */
  templates?: DocumentTemplate[];
  /** Save template handler */
  onSaveTemplate?: (name: string, content: string) => void;
  /** Delete template handler */
  onDeleteTemplate?: (templateId: string) => void;
  /** Load templates handler */
  onLoadTemplates?: () => void;
}

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

// Create editor theme
function createEditorTheme(isDark: boolean, dbType: DocumentDbType) {
  const accentColors: Record<string, string> = {
    mongodb: "#10b981",
    elasticsearch: "#eab308",
    cassandra: "#3b82f6",
  };
  const accentColor = accentColors[dbType] || "#3b82f6";

  return EditorView.theme({
    "&": {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#f8fafc" : "#1e293b",
      height: "100%",
      fontSize: "13px",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    },
    ".cm-scroller": {
      overflow: "auto",
      height: "100%"
    },
    ".cm-content": {
      caretColor: accentColor,
      padding: "12px 0",
      minHeight: "100%"
    },
    ".cm-cursor": {
      borderLeftColor: accentColor
    },
    ".cm-activeLine": {
      backgroundColor: isDark ? "#334155" : "#f1f5f9"
    },
    ".cm-activeLineGutter": {
      backgroundColor: isDark ? "#334155" : "#f1f5f9"
    },
    ".cm-gutters": {
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      color: isDark ? "#64748b" : "#94a3b8",
      border: "none",
      minWidth: "40px"
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 8px"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: isDark ? "#475569" : "#bfdbfe"
    },
    ".cm-selectionBackground": {
      backgroundColor: isDark ? "#334155" : "#e2e8f0"
    },
    ".cm-lintRange-error": {
      backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l2 -2 l1 0 l2 2 l1 0' stroke='%23ef4444' fill='none' stroke-width='1.1'/></svg>")`,
    },
    ".cm-diagnostic-error": {
      borderLeft: "3px solid #ef4444",
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)",
      padding: "3px 6px 3px 8px",
      marginLeft: "-1px"
    },
    ".cm-tooltip": {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      color: isDark ? "#f8fafc" : "#1e293b"
    },
  }, { dark: isDark });
}

// Get placeholder text based on database type
function getPlaceholder(dbType: DocumentDbType): string {
  const labels = DB_LABELS[dbType];
  return `// Enter your ${labels.itemLabel.toLowerCase()} JSON here
// Example:
{
  "field": "value",
  "number": 123,
  "nested": {
    "array": [1, 2, 3]
  }
}`;
}

export const DocumentEditorPanel: FC<DocumentEditorPanelProps> = ({
  isOpen,
  onClose,
  mode,
  dbType,
  schema,
  table,
  documentId,
  initialDocument,
  onSave,
  isSaving = false,
  saveError,
  templates = [],
  onSaveTemplate,
  onDeleteTemplate,
  onLoadTemplates,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(detectTheme);
  const [editorContent, setEditorContent] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSaveTemplateInput, setShowSaveTemplateInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [copied, setCopied] = useState(false);

  const labels = DB_LABELS[dbType];

  // Initialize editor content when opening
  useEffect(() => {
    if (isOpen) {
      if (initialDocument && Object.keys(initialDocument).length > 0) {
        // Use initialDocument for both edit mode (full doc) and insert mode (template structure)
        const formatted = JSON.stringify(initialDocument, null, 2);
        setEditorContent(formatted);
      } else {
        // Empty document
        setEditorContent("{\n  \n}");
      }
      setJsonError(null);
      onLoadTemplates?.();
    }
  }, [isOpen, mode, initialDocument, onLoadTemplates]);

  // Setup CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || !isOpen) return;

    const isDark = currentTheme === 'dark';
    const editorTheme = createEditorTheme(isDark, dbType);

    const startState = EditorState.create({
      doc: editorContent,
      extensions: [
        EditorView.lineWrapping,
        history(),
        search(),
        json(),
        linter(jsonParseLinter()),
        lintGutter(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(isSaving)),
        placeholderExt(getPlaceholder(dbType)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            setEditorContent(newValue);

            // Validate JSON on change
            try {
              if (newValue.trim()) {
                JSON.parse(newValue);
                setJsonError(null);
              }
            } catch (e) {
              if (e instanceof Error) {
                setJsonError(e.message);
              }
            }
          }
        }),
      ]
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current
    });

    viewRef.current = view;

    // Focus the editor
    setTimeout(() => view.focus(), 100);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isOpen, dbType]); // Recreate when panel opens or dbType changes

  // Sync content with editor when it changes externally
  useEffect(() => {
    if (viewRef.current && isOpen) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== editorContent) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: editorContent
          }
        });
      }
    }
  }, [editorContent, isOpen]);

  // Update readOnly state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(
          EditorState.readOnly.of(isSaving)
        )
      });
    }
  }, [isSaving]);

  // Theme observer
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

    return () => observer.disconnect();
  }, [currentTheme]);

  // Update theme when it changes
  useEffect(() => {
    if (viewRef.current) {
      const isDark = currentTheme === 'dark';
      const newTheme = createEditorTheme(isDark, dbType);
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(newTheme)
      });
    }
  }, [currentTheme, dbType]);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(editorContent);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError("Document must be a JSON object");
        return;
      }
      onSave(parsed);
    } catch (e) {
      if (e instanceof Error) {
        setJsonError(e.message);
      }
      toast.error("Invalid JSON: Please fix the errors before saving");
    }
  }, [editorContent, onSave]);

  const handleLoadTemplate = useCallback((template: DocumentTemplate) => {
    setEditorContent(template.content);
    setShowTemplateDropdown(false);
    toast.success(`Loaded template: ${template.name}`);
  }, []);

  const handleSaveAsTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    // Validate JSON before saving as template
    let parsedDoc: Record<string, unknown>;
    try {
      parsedDoc = JSON.parse(editorContent);
    } catch {
      toast.error("Cannot save invalid JSON as template");
      return;
    }

    // Create empty template (keys preserved, values emptied type-aware)
    const emptyTemplate = createEmptyTemplate(parsedDoc);
    const templateContent = JSON.stringify(emptyTemplate, null, 2);

    onSaveTemplate?.(newTemplateName.trim(), templateContent);
    setNewTemplateName("");
    setShowSaveTemplateInput(false);
    toast.success(`Template "${newTemplateName}" saved (structure only)`);
  }, [newTemplateName, editorContent, onSaveTemplate]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editorContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [editorContent]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(editorContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditorContent(formatted);
      toast.success("JSON formatted");
    } catch (e) {
      toast.error("Cannot format invalid JSON");
    }
  }, [editorContent]);

  if (!isOpen) return null;

  return (
    <div
      className={clsx(
        "fixed inset-y-0 right-0 w-[480px] bg-vscode-bg border-l border-vscode-border shadow-2xl z-50",
        "transform transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-vscode-border bg-vscode-bg-light">
        <div className="flex items-center gap-3">
          <div className={clsx(
            "w-2 h-2 rounded-full",
            mode === 'insert' ? "bg-green-500" : "bg-blue-500"
          )} />
          <div>
            <h2 className="text-sm font-semibold text-vscode-text">
              {mode === 'insert' ? `New ${labels.itemLabel}` : `Edit ${labels.itemLabel}`}
            </h2>
            <p className="text-xs text-vscode-text-muted">
              {schema}.{table}
              {mode === 'edit' && documentId && (
                <span className="ml-2 font-mono">ID: {documentId.slice(0, 12)}...</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-vscode-border bg-vscode-bg">
        <div className="flex items-center gap-2">
          {/* Template Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vscode-bg-light hover:bg-vscode-bg-hover text-vscode-text transition-colors border border-vscode-border"
            >
              <FileText className="w-3.5 h-3.5" />
              Templates
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showTemplateDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-vscode-bg-light border border-vscode-border rounded-lg shadow-lg z-10">
                <div className="p-2 border-b border-vscode-border">
                  <p className="text-xs text-vscode-text-muted">
                    {templates.length === 0
                      ? "No templates saved"
                      : `${templates.length} template${templates.length > 1 ? 's' : ''}`}
                  </p>
                </div>

                {templates.length > 0 && (
                  <div className="max-h-48 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-vscode-bg-hover group"
                      >
                        <button
                          onClick={() => handleLoadTemplate(template)}
                          className="flex-1 text-left text-sm text-vscode-text hover:text-vscode-accent"
                        >
                          {template.name}
                        </button>
                        <button
                          onClick={() => {
                            onDeleteTemplate?.(template.id);
                            toast.success(`Deleted template: ${template.name}`);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-vscode-error/10 text-vscode-text-muted hover:text-vscode-error transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2 border-t border-vscode-border">
                  {showSaveTemplateInput ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Template name"
                        className="flex-1 px-2 py-1 text-xs bg-vscode-bg border border-vscode-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-accent"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveAsTemplate();
                          if (e.key === 'Escape') setShowSaveTemplateInput(false);
                        }}
                      />
                      <button
                        onClick={handleSaveAsTemplate}
                        className="p-1 rounded bg-vscode-accent text-white"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveTemplateInput(true)}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-vscode-text-muted hover:text-vscode-text rounded hover:bg-vscode-bg-hover transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Save as Template
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Format Button */}
          <button
            onClick={handleFormat}
            className="px-2.5 py-1.5 text-xs font-medium rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Format JSON"
          >
            Format
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {saveError && (
        <div className="px-4 py-3 bg-vscode-error/10 border-b border-vscode-error/30">
          <div className="flex items-start gap-2 text-vscode-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Failed to save {labels.itemLabel.toLowerCase()}</p>
              <p className="text-xs mt-0.5 opacity-80">{saveError}</p>
            </div>
          </div>
        </div>
      )}

      {/* JSON Validation Error */}
      {jsonError && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">{jsonError}</p>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 180px)' }}>
        <div
          ref={editorRef}
          className="h-full"
        />
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 right-0 h-16 px-4 flex items-center justify-between border-t border-vscode-border bg-vscode-bg-light">
        <div className="text-xs text-vscode-text-muted">
          {editorContent.split('\n').length} lines
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !!jsonError}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors",
              "bg-vscode-accent hover:bg-vscode-accent/90 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {mode === 'insert' ? `Insert ${labels.itemLabel}` : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Click outside to close template dropdown */}
      {showTemplateDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowTemplateDropdown(false)}
        />
      )}
    </div>
  );
};
