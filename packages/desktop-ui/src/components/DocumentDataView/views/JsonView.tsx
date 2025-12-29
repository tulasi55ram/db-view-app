/**
 * JsonView
 *
 * Raw JSON view with syntax highlighting using CodeMirror.
 * Supports read-only and edit modes with validation.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  WrapText,
  Expand,
  Minimize2,
  AlertCircle,
  Save,
  Wand2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { IconButton } from '@/primitives';
import { Tooltip } from '@/primitives/Tooltip';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

interface JsonViewProps {
  /** Document data to display */
  data: Record<string, unknown>;
  /** Whether editing is disabled */
  isReadOnly?: boolean;
  /** Callback when the document is saved */
  onSave?: (newData: Record<string, unknown>) => void;
  /** Optional class name */
  className?: string;
}

// Theme for CodeMirror using CSS variables for automatic light/dark support
const editorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-primary)',
      fontSize: '13px',
      fontFamily: "'JetBrains Mono', monospace",
    },
    '.cm-content': {
      caretColor: 'var(--accent)',
      padding: '8px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
      },
    '.cm-activeLine': {
      backgroundColor: 'var(--bg-hover)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-tertiary)',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--bg-hover)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-tertiary)',
    },
    '.cm-lintRange-error': {
      backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l2 -2 l1 0 l2 2 l1 0' stroke='%23ef4444' fill='none' stroke-width='1.2'/></svg>")`,
    },
  },
  { dark: false }
);

// Syntax highlighting for JSON
const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.string, color: '#a5d6a7' },
  { tag: tags.number, color: '#ffcc80' },
  { tag: tags.bool, color: '#ce93d8' },
  { tag: tags.null, color: '#90a4ae' },
  { tag: tags.propertyName, color: '#81d4fa' },
  { tag: tags.punctuation, color: '#b0bec5' },
  { tag: tags.brace, color: '#b0bec5' },
  { tag: tags.squareBracket, color: '#b0bec5' },
]);

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download text as a file
 */
function downloadAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function JsonView({
  data,
  isReadOnly = false,
  onSave,
  className,
}: JsonViewProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Format JSON with indentation
  const formattedJson = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const [hasChanges, setHasChanges] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState({ lines: 0, bytes: '0 B' });

  // Update stats
  const updateStats = useCallback((content: string) => {
    const lines = content.split('\n').length;
    const bytes = new Blob([content]).size;
    setStats({
      lines,
      bytes: bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`,
    });
  }, []);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Clear any existing editor
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    editorContainerRef.current.innerHTML = '';

    const extensions = [
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
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
      editorTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          setHasChanges(content !== formattedJson);
          updateStats(content);

          try {
            JSON.parse(content);
            setParseError(null);
          } catch (e) {
            setParseError((e as Error).message);
          }
        }
      }),
    ];

    if (wordWrap) {
      extensions.push(EditorView.lineWrapping);
    }

    if (isReadOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: formattedJson,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;
    updateStats(formattedJson);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [formattedJson, wordWrap, isReadOnly, updateStats]);

  // Handle save
  const handleSave = useCallback(() => {
    if (parseError || isReadOnly || !onSave || !viewRef.current) return;

    try {
      const content = viewRef.current.state.doc.toString();
      const parsed = JSON.parse(content);
      onSave(parsed);
      setHasChanges(false);
    } catch {
      // Error should already be set
    }
  }, [parseError, isReadOnly, onSave]);

  // Handle copy
  const handleCopy = useCallback(async () => {
    if (!viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, []);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    const id = data._id || data.id || 'document';
    downloadAsFile(content, `${id}.json`);
  }, [data]);

  // Handle format
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
      setParseError(null);
    } catch {
      // Can't format invalid JSON
    }
  }, []);

  // Handle revert
  const handleRevert = useCallback(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: viewRef.current.state.doc.length,
        insert: formattedJson,
      },
    });
    setHasChanges(false);
    setParseError(null);
  }, [formattedJson]);

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        isExpanded && 'fixed inset-0 z-50 bg-bg-primary',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">
            {stats.lines} lines • {stats.bytes}
          </span>

          {hasChanges && (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              Unsaved changes
            </span>
          )}

          {parseError && (
            <span className="text-xs text-error flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Invalid JSON
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Format button */}
          {!isReadOnly && (
            <Tooltip content="Format JSON">
              <IconButton
                icon={<Wand2 className="w-3.5 h-3.5" />}
                size="sm"
                onClick={handleFormat}
                aria-label="Format JSON"
              />
            </Tooltip>
          )}

          {/* Save button (only when editing) */}
          {!isReadOnly && hasChanges && (
            <Tooltip content={parseError ? 'Fix errors to save' : 'Save changes'}>
              <IconButton
                icon={<Save className="w-3.5 h-3.5" />}
                size="sm"
                onClick={handleSave}
                disabled={!!parseError}
                className={cn(!parseError && 'text-accent')}
                aria-label="Save changes"
              />
            </Tooltip>
          )}

          {/* Revert button */}
          {hasChanges && (
            <Tooltip content="Revert changes">
              <IconButton
                icon={<AlertCircle className="w-3.5 h-3.5" />}
                size="sm"
                onClick={handleRevert}
                aria-label="Revert changes"
              />
            </Tooltip>
          )}

          {/* Word wrap toggle */}
          <Tooltip content={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}>
            <IconButton
              icon={<WrapText className="w-3.5 h-3.5" />}
              size="sm"
              onClick={() => setWordWrap(!wordWrap)}
              className={cn(wordWrap && 'text-accent')}
              aria-label={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
            />
          </Tooltip>

          {/* Expand/minimize toggle */}
          <Tooltip content={isExpanded ? 'Exit fullscreen' : 'Fullscreen'}>
            <IconButton
              icon={
                isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Expand className="w-3.5 h-3.5" />
                )
              }
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Exit fullscreen' : 'Fullscreen'}
            />
          </Tooltip>

          {/* Copy button */}
          <Tooltip content={copied ? 'Copied!' : 'Copy JSON'}>
            <IconButton
              icon={
                copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              size="sm"
              onClick={handleCopy}
              aria-label="Copy JSON"
            />
          </Tooltip>

          {/* Download button */}
          <Tooltip content="Download JSON">
            <IconButton
              icon={<Download className="w-3.5 h-3.5" />}
              size="sm"
              onClick={handleDownload}
              aria-label="Download JSON"
            />
          </Tooltip>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-auto"
      />

      {/* Keyboard shortcuts hint */}
      {!isReadOnly && (
        <div className="px-3 py-1 border-t border-border bg-bg-secondary text-xs text-text-tertiary">
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-[10px]">Ctrl+Z</kbd>{' '}
            Undo
          </span>
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-[10px]">Ctrl+F</kbd>{' '}
            Find
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-[10px]">Ctrl+G</kbd>{' '}
            Go to line
          </span>
        </div>
      )}
    </div>
  );
}

export default JsonView;
