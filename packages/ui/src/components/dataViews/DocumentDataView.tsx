/**
 * DocumentDataView - Data view component for document-based NoSQL databases
 * Supports: MongoDB, Elasticsearch, Cassandra
 *
 * Features:
 * - Three view modes: Tree, Table, JSON
 * - Document list sidebar with search
 * - Hierarchical tree view with type indicators
 * - Table view for flat data
 * - JSON view for raw document viewing
 * - Document CRUD operations with slide-out editor panel
 * - Template management for quick document insertion
 */

import type { FC } from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import type { ColumnMetadata } from "@dbview/types";
import type { DocumentDataViewProps } from "./types";
import { getRowLabel, getDocumentIdField } from "./types";
import { DataViewToolbar, ToolbarButton, DataViewStatusBar } from "./shared";
import { VirtualDataGrid } from "../VirtualDataGrid";
import { Pagination } from "../Pagination";
import { getVsCodeApi } from "../../vscode";
import {
  TreeView,
  DocumentList,
  DocumentEditorPanel,
  createEmptyTemplate,
  type DocumentItem,
  type ViewMode,
  type DocumentTemplate,
  DB_LABELS,
  VIEW_MODE_LABELS,
} from "./documentView";
import {
  Plus,
  Trash2,
  Save,
  X,
  Copy,
  Download,
  Table2,
  FileJson,
  TreeDeciduous,
  RefreshCw,
  Braces,
  Edit3,
  Files,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

/**
 * View mode icons
 */
const VIEW_MODE_ICONS = {
  tree: TreeDeciduous,
  table: Table2,
  json: Braces,
};

export const DocumentDataView: FC<DocumentDataViewProps> = ({
  schema,
  table,
  columns,
  rows,
  loading,
  totalRows,
  limit,
  offset,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  dbType,
  readOnly = false,
  viewMode: externalViewMode = 'tree',
  onViewModeChange,
  expandedDocuments = new Set(),
  onToggleExpand,
  onUpdateDocument,
  onInsertDocument,
  onDeleteDocuments,
}) => {
  const vscode = getVsCodeApi();
  const rowCount = rows.length;
  const columnCount = columns.length;

  // Get the document ID field from column metadata
  const docIdField = getDocumentIdField(columns, dbType);

  // Get DB labels
  const labels = DB_LABELS[dbType as keyof typeof DB_LABELS] || DB_LABELS.mongodb;

  // Local view mode state - now supports three modes (default: tree)
  const [localViewMode, setLocalViewMode] = useState<ViewMode>(
    externalViewMode as ViewMode
  );
  const currentViewMode = onViewModeChange ? (externalViewMode as ViewMode) : localViewMode;
  const handleViewModeChange = (mode: ViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    }
    setLocalViewMode(mode);
  };

  // Selected document for viewing
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Search query for document list
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded paths for tree view
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Selected rows for table operations
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const hasSelectedRows = selectedRows.size > 0;

  // Editor panel state
  const [editorPanelOpen, setEditorPanelOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'insert' | 'edit'>('insert');
  const [editingDocument, setEditingDocument] = useState<Record<string, unknown> | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  // Helper function to safely call refresh with error handling
  const safeRefresh = useCallback(() => {
    if (onRefresh) {
      try {
        onRefresh();
      } catch (error) {
        console.error('[DocumentDataView] Error calling onRefresh:', error);
        // Fallback: directly request data refresh via vscode message
        vscode?.postMessage({
          type: "LOAD_TABLE_ROWS",
          schema,
          table,
          limit,
          offset: 0
        });
      }
    } else {
      // Fallback: directly request data refresh via vscode message
      vscode?.postMessage({
        type: "LOAD_TABLE_ROWS",
        schema,
        table,
        limit,
        offset: 0
      });
    }
  }, [onRefresh, vscode, schema, table, limit]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message?.type) {
        case 'INSERT_SUCCESS':
          setIsSaving(false);
          setEditorPanelOpen(false);
          toast.success(`${labels.itemLabel} inserted successfully`);
          // Use setTimeout to ensure state updates are processed first
          setTimeout(() => {
            safeRefresh();
          }, 100);
          break;

        case 'INSERT_ERROR':
          setIsSaving(false);
          setSaveError(message.error || 'Failed to insert document');
          toast.error(`Failed to insert ${labels.itemLabel.toLowerCase()}`);
          break;

        case 'UPDATE_SUCCESS':
          setIsSaving(false);
          setEditorPanelOpen(false);
          toast.success(`${labels.itemLabel} updated successfully`);
          // Use setTimeout to ensure state updates are processed first
          setTimeout(() => {
            safeRefresh();
          }, 100);
          break;

        case 'UPDATE_ERROR':
          setIsSaving(false);
          setSaveError(message.error || 'Failed to update document');
          toast.error(`Failed to update ${labels.itemLabel.toLowerCase()}`);
          break;

        case 'DELETE_SUCCESS':
          toast.success(`${labels.itemLabel}(s) deleted successfully`);
          // Clear selection since deleted document no longer exists
          setSelectedDocId(null);
          // Use setTimeout to ensure state updates are processed first
          setTimeout(() => {
            safeRefresh();
          }, 100);
          break;

        case 'DELETE_ERROR':
          toast.error(`Failed to delete ${labels.itemLabel.toLowerCase()}: ${message.error}`);
          break;

        case 'DOCUMENT_TEMPLATES':
          if (message.schema === schema && message.table === table) {
            setTemplates(message.templates || []);
          }
          break;

        case 'TEMPLATE_SAVED':
          if (message.schema === schema && message.table === table) {
            setTemplates(prev => [...prev, message.template]);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [labels.itemLabel, schema, table, safeRefresh]);

  // Convert rows to DocumentItem format
  const documents: DocumentItem[] = useMemo(() => {
    return rows.map((row, index) => ({
      _id: (row[docIdField] as string) || `doc-${index}`,
      _source: row,
    }));
  }, [rows, docIdField]);

  // Get selected document
  const selectedDocument = useMemo(() => {
    if (!selectedDocId) {
      // Auto-select first document if available
      if (documents.length > 0 && !loading) {
        return documents[0];
      }
      return null;
    }
    return documents.find((d) => d._id === selectedDocId) || null;
  }, [documents, selectedDocId, loading]);

  // Auto-select first document when documents change (use useEffect for side effects)
  useEffect(() => {
    if (!selectedDocId && documents.length > 0 && !loading) {
      setSelectedDocId(documents[0]._id);
    }
  }, [documents, selectedDocId, loading]);

  // Column visibility
  const visibleColumns = useMemo(() => {
    return new Set(columns.map((col) => col.name));
  }, [columns]);

  // Pagination
  const currentPage = Math.floor(offset / limit) + 1;
  const pageSize = limit;

  // Tree view handlers
  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!selectedDocument) return;

    const paths = new Set<string>();
    const collectPaths = (obj: unknown, currentPath: string) => {
      if (typeof obj === 'object' && obj !== null) {
        paths.add(currentPath);
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            collectPaths(item, `${currentPath}[${index}]`);
          });
        } else {
          Object.entries(obj).forEach(([key, value]) => {
            collectPaths(value, `${currentPath}.${key}`);
          });
        }
      }
    };

    Object.keys(selectedDocument._source).forEach((key) => {
      collectPaths(selectedDocument._source[key], `root.${key}`);
    });

    setExpandedPaths(paths);
  }, [selectedDocument]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // CRUD handlers
  const handleDeleteDocuments = useCallback(() => {
    if (selectedRows.size === 0) return;

    const selectedIndices = Array.from(selectedRows);
    const documentIds = selectedIndices.map(idx => rows[idx][docIdField] as string);
    const count = documentIds.length;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${count} ${count === 1 ? labels.itemLabel.toLowerCase() : labels.itemLabelPlural.toLowerCase()}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    if (onDeleteDocuments) {
      onDeleteDocuments(documentIds);
    } else {
      vscode?.postMessage({
        type: "DELETE_DOCUMENTS",
        schema,
        table,
        documentIds
      });
    }

    setSelectedRows(new Set());
    // Toast and refresh will be handled by DELETE_SUCCESS handler
  }, [selectedRows, rows, docIdField, labels, onDeleteDocuments, vscode, schema, table]);

  // Delete a single document with confirmation
  const handleDeleteSingleDocument = useCallback((docId: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${labels.itemLabel.toLowerCase()}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    if (onDeleteDocuments) {
      onDeleteDocuments([docId]);
    } else {
      vscode?.postMessage({
        type: "DELETE_DOCUMENTS",
        schema,
        table,
        documentIds: [docId]
      });
    }
  }, [labels, onDeleteDocuments, vscode, schema, table]);

  // Open editor panel for inserting new document
  // If a document is selected, use its structure as a template with empty values
  const handleInsertDocument = () => {
    setEditorMode('insert');

    // Use selected document's structure as template, or empty object
    if (selectedDocument) {
      const emptyTemplate = createEmptyTemplate(selectedDocument._source);
      setEditingDocument(emptyTemplate);
    } else {
      setEditingDocument(null);
    }

    setEditingDocumentId(null);
    setSaveError(null);
    setEditorPanelOpen(true);
  };

  // Open editor panel for editing existing document (double-click)
  const handleEditDocument = useCallback((doc: DocumentItem) => {
    if (readOnly) return;
    setEditorMode('edit');
    setEditingDocument(doc._source);
    setEditingDocumentId(doc._id);
    setSaveError(null);
    setEditorPanelOpen(true);
  }, [readOnly]);

  // Duplicate document - opens insert mode with full values (except _id)
  const handleDuplicateDocument = useCallback((doc: DocumentItem) => {
    if (readOnly) return;
    setEditorMode('insert');

    // Copy all values except internal fields like _id
    const duplicatedDoc: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc._source)) {
      if (!key.startsWith('_')) {
        duplicatedDoc[key] = value;
      }
    }

    setEditingDocument(duplicatedDoc);
    setEditingDocumentId(null);
    setSaveError(null);
    setEditorPanelOpen(true);
    toast.info('Duplicating document - modify and save as new');
  }, [readOnly]);

  // Close editor panel
  const handleCloseEditor = useCallback(() => {
    setEditorPanelOpen(false);
    setEditingDocument(null);
    setEditingDocumentId(null);
    setSaveError(null);
    setIsSaving(false);
  }, []);

  // Save document (insert or update)
  const handleSaveDocument = useCallback((document: Record<string, unknown>) => {
    setIsSaving(true);
    setSaveError(null);

    if (editorMode === 'insert') {
      if (onInsertDocument) {
        onInsertDocument(document);
      } else {
        vscode?.postMessage({
          type: "INSERT_DOCUMENT",
          schema,
          table,
          document
        });
      }
    } else {
      // Update mode
      if (onUpdateDocument && editingDocumentId) {
        onUpdateDocument(editingDocumentId, document);
      } else {
        vscode?.postMessage({
          type: "UPDATE_DOCUMENT",
          schema,
          table,
          documentId: editingDocumentId,
          updates: document
        });
      }
    }
  }, [editorMode, schema, table, editingDocumentId, onInsertDocument, onUpdateDocument, vscode]);

  // Template handlers
  const handleLoadTemplates = useCallback(() => {
    vscode?.postMessage({
      type: "GET_DOCUMENT_TEMPLATES",
      schema,
      table
    });
  }, [schema, table, vscode]);

  const handleSaveTemplate = useCallback((name: string, content: string) => {
    vscode?.postMessage({
      type: "SAVE_DOCUMENT_TEMPLATE",
      schema,
      table,
      templateName: name,
      templateContent: content
    });
  }, [schema, table, vscode]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    vscode?.postMessage({
      type: "DELETE_DOCUMENT_TEMPLATE",
      schema,
      table,
      templateId
    });
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  }, [schema, table, vscode]);

  const handleCopyAsJson = () => {
    if (!selectedDocument) {
      toast.error('No document selected');
      return;
    }

    navigator.clipboard.writeText(JSON.stringify(selectedDocument._source, null, 2)).then(() => {
      toast.success('Copied document as JSON');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const handleExport = () => {
    const json = JSON.stringify(rows, null, 2);
    vscode?.postMessage({
      type: 'EXPORT_DATA',
      schema,
      table,
      content: json,
      extension: 'json',
      mimeType: 'application/json'
    });
  };

  // Render document viewer based on view mode
  const renderDocumentViewer = () => {
    if (!selectedDocument) {
      return (
        <div className="flex-1 flex items-center justify-center text-vscode-text-muted">
          <div className="text-center">
            <FileJson className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg mb-2">No {labels.itemLabel} Selected</p>
            <p className="text-sm">
              Select a {labels.itemLabel.toLowerCase()} from the list to view its data
            </p>
          </div>
        </div>
      );
    }

    switch (currentViewMode) {
      case 'tree':
        return (
          <TreeView
            data={selectedDocument._source}
            expandedPaths={expandedPaths}
            onToggleExpand={handleToggleExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            isReadOnly={readOnly}
            showTypeIndicators
            rootPath="root"
            className="flex-1"
          />
        );

      case 'json':
        return (
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs font-mono text-vscode-text whitespace-pre-wrap bg-vscode-bg-light p-4 rounded border border-vscode-border">
              {JSON.stringify(selectedDocument._source, null, 2)}
            </pre>
          </div>
        );

      case 'table':
      default:
        return (
          <div className="flex-1 overflow-hidden">
            {columns && columns.length > 0 ? (
              <VirtualDataGrid
                columns={columns}
                rows={rows}
                loading={loading}
                selectable={!readOnly}
                selectedRows={selectedRows}
                onRowSelectionChange={setSelectedRows}
                visibleColumns={visibleColumns}
                totalRows={totalRows}
                currentPage={currentPage}
                pageSize={pageSize}
                offset={offset}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-vscode-text-muted">
                <p>No columns available</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex h-full flex-col bg-vscode-bg">
      {/* Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-vscode-border bg-vscode-bg-light">
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-vscode-bg rounded-md p-0.5">
            {(['tree', 'table', 'json'] as ViewMode[]).map((mode) => {
              const Icon = VIEW_MODE_ICONS[mode];
              return (
                <button
                  key={mode}
                  onClick={() => handleViewModeChange(mode)}
                  className={clsx(
                    'p-1.5 rounded transition-colors',
                    currentViewMode === mode
                      ? 'bg-vscode-bg-hover text-vscode-text'
                      : 'text-vscode-text-muted hover:text-vscode-text'
                  )}
                  title={VIEW_MODE_LABELS[mode]}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Container info */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-vscode-text-muted">
              {labels.containerLabel}:
            </span>
            <span className="text-sm font-medium text-vscode-text">{table}</span>
          </div>

          {/* Document count */}
          <span className="text-sm text-vscode-text-muted">
            {loading
              ? 'Loading...'
              : totalRows !== null
              ? `${totalRows.toLocaleString()} ${labels.itemLabelPlural.toLowerCase()}`
              : `${documents.length} ${labels.itemLabelPlural.toLowerCase()}`}
          </span>

          {readOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-xs font-medium">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Insert button */}
          {!readOnly && (
            <button
              onClick={handleInsertDocument}
              className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
              title={`Add ${labels.itemLabel}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Export"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Copy button (when document selected) */}
          {selectedDocument && (
            <button
              onClick={handleCopyAsJson}
              className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
              title="Copy as JSON"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Main content - Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document list sidebar */}
        <div className="w-72 border-r border-vscode-border flex-shrink-0">
          <DocumentList
            documents={documents}
            selectedDocId={selectedDocId}
            onSelect={setSelectedDocId}
            onDoubleClick={!readOnly ? handleEditDocument : undefined}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={`Filter ${labels.itemLabelPlural.toLowerCase()}...`}
            dbType={dbType as 'mongodb' | 'elasticsearch' | 'cassandra'}
            itemLabel={labels.itemLabelPlural.toLowerCase()}
            totalCount={totalRows}
          />
        </div>

        {/* Document viewer */}
        <div className="flex-1 flex flex-col overflow-hidden bg-vscode-bg">
          {/* Document header */}
          {selectedDocument && (
            <div className="px-4 py-2 border-b border-vscode-border bg-vscode-bg-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-vscode-text-muted">ID:</span>
                <span className="text-sm font-mono text-vscode-accent">
                  {selectedDocument._id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <>
                    <button
                      onClick={() => handleEditDocument(selectedDocument)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-vscode-accent/10 text-vscode-text-muted hover:text-vscode-accent transition-colors"
                      title="Edit document"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicateDocument(selectedDocument)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-vscode-accent/10 text-vscode-text-muted hover:text-vscode-accent transition-colors"
                      title="Duplicate document (create copy)"
                    >
                      <Files className="w-3 h-3" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDeleteSingleDocument(selectedDocument._id)}
                      className="text-xs px-2 py-1 rounded hover:bg-vscode-error/10 text-vscode-text-muted hover:text-vscode-error transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Document content */}
          {renderDocumentViewer()}
        </div>
      </div>

      {/* Status Bar */}
      <DataViewStatusBar
        dbType={dbType}
        loading={loading}
        hasSelectedRows={hasSelectedRows}
        selectedRowsCount={selectedRows.size}
        readOnly={readOnly}
        customStatus={currentViewMode === 'tree' ? `${expandedPaths.size} expanded` : undefined}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
      />

      {/* Document Editor Panel (Slide-out) */}
      <DocumentEditorPanel
        isOpen={editorPanelOpen}
        onClose={handleCloseEditor}
        mode={editorMode}
        dbType={dbType as 'mongodb' | 'elasticsearch' | 'cassandra'}
        schema={schema}
        table={table}
        documentId={editingDocumentId || undefined}
        initialDocument={editingDocument || undefined}
        onSave={handleSaveDocument}
        isSaving={isSaving}
        saveError={saveError}
        templates={templates}
        onSaveTemplate={handleSaveTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onLoadTemplates={handleLoadTemplates}
      />
    </div>
  );
};
