/**
 * DocumentDataView
 *
 * Main component for viewing and editing document-based databases:
 * - MongoDB (Collections)
 * - Elasticsearch (Indices)
 * - Cassandra (Tables with wide columns)
 *
 * Features three view modes:
 * - Tree: Hierarchical JSON tree with expand/collapse
 * - Table: Flattened spreadsheet-like view
 * - JSON: Raw JSON editor
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Plus,
  Download,
  Upload,
  Lock,
  TreeDeciduous,
  Table2,
  Braces,
  FileJson,
  Trash2,
  CheckSquare,
  X,
  Database,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getElectronAPI } from '@/electron';
import { toast } from 'sonner';
import { IconButton, Button } from '@/primitives';
import { Tooltip } from '@/primitives/Tooltip';
import { useViewModePreference } from '@/hooks';
import { TreeView, TableView, JsonView } from './views';
import {
  DocumentList,
  DeleteDocumentDialog,
  AddFieldModal,
  ExportModal,
  QueryFilterBuilder,
  ImportModal,
  IndexManagementPanel,
  AggregationPipelineBuilder,
  type FilterCondition as UIFilterCondition,
} from './components';
import type { FilterCondition } from '@dbview/types';
import { useDocumentOperations } from './hooks';
import type { DocumentDataViewProps, ViewMode, DocumentItem } from './types';
import { DB_LABELS } from './types';

// View mode icons
const VIEW_MODE_ICONS: Record<ViewMode, typeof TreeDeciduous> = {
  tree: TreeDeciduous,
  table: Table2,
  json: Braces,
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  tree: 'Tree View',
  table: 'Table View',
  json: 'JSON View',
};

// Page size for document loading
const PAGE_SIZE = 50;

export function DocumentDataView({
  connectionKey,
  schema,
  table,
  dbType,
}: DocumentDataViewProps) {
  // View state with localStorage persistence
  const { viewMode, setViewMode } = useViewModePreference({
    dbType,
    containerName: table,
  });
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Filter state
  const [filterQuery, setFilterQuery] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  // Connection state
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [addFieldPath, setAddFieldPath] = useState('root');
  const [showExportModal, setShowExportModal] = useState(false);

  // Multi-select state
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Query filter builder state
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [filterConditions, setFilterConditions] = useState<UIFilterCondition[]>([]);
  const [appliedFilterConditions, setAppliedFilterConditions] = useState<UIFilterCondition[]>([]);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Index management state
  const [showIndexPanel, setShowIndexPanel] = useState(false);
  const [indexes, setIndexes] = useState<Array<{ name: string; keys: Record<string, number | string>; unique?: boolean; sparse?: boolean }>>([]);
  const [loadingIndexes, setLoadingIndexes] = useState(false);

  // Aggregation pipeline state
  const [showAggregationBuilder, setShowAggregationBuilder] = useState(false);
  const [isExecutingPipeline, setIsExecutingPipeline] = useState(false);

  const api = getElectronAPI();
  const labels = DB_LABELS[dbType];

  // Convert UI filter conditions to API filter conditions
  const convertToApiFilters = useCallback((uiConditions: UIFilterCondition[]): FilterCondition[] => {
    return uiConditions
      .filter(c => c.field) // Only include conditions with a field set
      .map(c => {
        // Map UI operators to API operators
        let apiOperator: FilterCondition['operator'] = 'equals';
        switch (c.operator) {
          case 'equals': apiOperator = 'equals'; break;
          case 'not_equals': apiOperator = 'not_equals'; break;
          case 'contains': apiOperator = 'contains'; break;
          case 'starts_with': apiOperator = 'starts_with'; break;
          case 'ends_with': apiOperator = 'ends_with'; break;
          case 'greater_than': apiOperator = 'greater_than'; break;
          case 'less_than': apiOperator = 'less_than'; break;
          case 'gte': apiOperator = 'greater_or_equal'; break;
          case 'lte': apiOperator = 'less_or_equal'; break;
          case 'exists': apiOperator = 'is_not_null'; break;
          case 'not_exists': apiOperator = 'is_null'; break;
          case 'regex': apiOperator = 'contains'; break; // Fallback
        }

        // Parse value based on valueType
        let parsedValue: unknown = c.value;
        switch (c.valueType) {
          case 'number':
            parsedValue = parseFloat(c.value);
            break;
          case 'boolean':
            parsedValue = c.value.toLowerCase() === 'true';
            break;
          case 'null':
            parsedValue = null;
            break;
          case 'date':
            parsedValue = new Date(c.value).toISOString();
            break;
        }

        return {
          id: c.id,
          columnName: c.field,
          operator: apiOperator,
          value: parsedValue,
        };
      });
  }, []);

  // Document operations hook
  const {
    isLoading: isOperationLoading,
    updateField,
    deleteField,
    addField,
    updateDocument,
    deleteDocument,
  } = useDocumentOperations({
    connectionKey,
    schema,
    table,
    dbType,
    isReadOnly,
    onRefresh: () => loadDocuments(),
  });

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filterQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterQuery]);

  // Check read-only status
  useEffect(() => {
    const fetchConnectionConfig = async () => {
      if (!api) return;
      try {
        const connections = await api.getConnections();
        const connection = connections.find((c) => {
          const cfg = c.config as Record<string, unknown>;
          const key = cfg.name
            ? `${cfg.dbType}:${cfg.name}`
            : `${cfg.dbType}:${JSON.stringify(cfg)}`;
          return key === connectionKey;
        });
        if (connection?.config && 'readOnly' in connection.config) {
          setIsReadOnly(Boolean(connection.config.readOnly));
        }
      } catch (error) {
        console.error('Failed to fetch connection config:', error);
      }
    };
    fetchConnectionConfig();
  }, [api, connectionKey]);

  // Load documents
  const loadDocuments = useCallback(async (append = false, filtersToApply?: UIFilterCondition[]) => {
    if (!api) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setDocuments([]);
      }

      const currentOffset = append ? documents.length : 0;

      // Use provided filters, or current applied filters
      const activeFilters = filtersToApply ?? appliedFilterConditions;
      const apiFilters = convertToApiFilters(activeFilters);

      const result = await api.loadTableRows({
        connectionKey,
        schema,
        table,
        limit: PAGE_SIZE + 1,
        offset: currentOffset,
        filters: apiFilters.length > 0 ? apiFilters : undefined,
        filterLogic: 'AND',
      });

      // Transform rows to documents
      const newDocs: DocumentItem[] = result.rows.map((row, index) => {
        // Extract _id from the row
        const id = row._id
          ? String(row._id)
          : row.id
          ? String(row.id)
          : `doc-${currentOffset + index}`;

        return {
          _id: id,
          _source: row as Record<string, unknown>,
        };
      });

      // Check if there are more
      const fetchedMore = newDocs.length > PAGE_SIZE;
      setHasMore(fetchedMore);

      const docsToAdd = fetchedMore ? newDocs.slice(0, PAGE_SIZE) : newDocs;

      if (append) {
        setDocuments((prev) => [...prev, ...docsToAdd]);
      } else {
        setDocuments(docsToAdd);
        // Select first document if none selected
        if (docsToAdd.length > 0 && !selectedDocId) {
          setSelectedDocId(docsToAdd[0]._id);
          // Auto-expand top-level fields of first document
          const firstDoc = docsToAdd[0];
          const topLevelPaths = Object.keys(firstDoc._source).map(
            (key) => `root.${key}`
          );
          setExpandedPaths(new Set(topLevelPaths));
        }
        // Set total count from result if available
        const resultWithTotal = result as { columns: string[]; rows: Record<string, unknown>[]; totalRows?: number };
        if (resultWithTotal.totalRows !== undefined) {
          setTotalCount(resultWithTotal.totalRows);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [api, connectionKey, schema, table, documents.length, selectedDocId, appliedFilterConditions, convertToApiFilters]);

  // Load more documents
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadDocuments(true);
    }
  }, [loadDocuments, loadingMore, hasMore]);

  // Initial load
  useEffect(() => {
    loadDocuments();
  }, [connectionKey, schema, table]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset expanded paths when document changes
  useEffect(() => {
    if (selectedDocId) {
      const doc = documents.find((d) => d._id === selectedDocId);
      if (doc) {
        // Auto-expand top-level fields
        const topLevelPaths = Object.keys(doc._source).map((key) => `root.${key}`);
        setExpandedPaths(new Set(topLevelPaths));
      }
    }
  }, [selectedDocId, documents]);

  // Filter documents locally
  const filteredDocuments = useMemo(() => {
    if (!debouncedFilter) return documents;
    const lower = debouncedFilter.toLowerCase();
    return documents.filter((doc) => {
      // Search in _id
      if (doc._id.toLowerCase().includes(lower)) return true;
      // Search in stringified source
      return JSON.stringify(doc._source).toLowerCase().includes(lower);
    });
  }, [documents, debouncedFilter]);

  // Selected document
  const selectedDocument = useMemo(() => {
    return documents.find((d) => d._id === selectedDocId) || null;
  }, [documents, selectedDocId]);

  // Toggle path expansion
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

  // Expand all paths
  const handleExpandAll = useCallback(() => {
    if (!selectedDocument) return;

    const collectAllPaths = (
      obj: unknown,
      prefix: string
    ): string[] => {
      const paths: string[] = [prefix];
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          paths.push(...collectAllPaths(item, `${prefix}[${index}]`));
        });
      } else if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          paths.push(...collectAllPaths(value, `${prefix}.${key}`));
        });
      }
      return paths;
    };

    const allPaths = collectAllPaths(selectedDocument._source, 'root');
    setExpandedPaths(new Set(allPaths));
  }, [selectedDocument]);

  // Collapse all paths
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // Handle inline field edit
  const handleEdit = useCallback(
    async (path: string, newValue: unknown) => {
      if (isReadOnly || !selectedDocId) return;
      await updateField(selectedDocId, path, newValue);
    },
    [isReadOnly, selectedDocId, updateField]
  );

  // Handle field delete
  const handleFieldDelete = useCallback(
    async (path: string) => {
      if (isReadOnly || !selectedDocId) return;
      await deleteField(selectedDocId, path);
    },
    [isReadOnly, selectedDocId, deleteField]
  );

  // Handle add field - opens modal
  const handleAddFieldClick = useCallback(
    (path: string) => {
      if (isReadOnly) return;
      setAddFieldPath(path);
      setShowAddFieldModal(true);
    },
    [isReadOnly]
  );

  // Handle add field - actual add
  const handleAddField = useCallback(
    async (key: string, value: unknown) => {
      if (isReadOnly || !selectedDocId) return;
      const success = await addField(selectedDocId, addFieldPath, key, value);
      if (success) {
        setShowAddFieldModal(false);
      }
    },
    [isReadOnly, selectedDocId, addFieldPath, addField]
  );

  // Handle JSON save from JsonView
  const handleJsonSave = useCallback(
    async (newData: Record<string, unknown>) => {
      if (isReadOnly || !selectedDocId) return;
      await updateDocument(selectedDocId, newData);
    },
    [isReadOnly, selectedDocId, updateDocument]
  );

  // Handle document delete
  const handleDeleteDocument = useCallback(async () => {
    if (isReadOnly || !selectedDocId) return;
    const success = await deleteDocument(selectedDocId);
    if (success) {
      setShowDeleteDialog(false);
      // Select next document or clear selection
      const currentIndex = documents.findIndex((d) => d._id === selectedDocId);
      const nextDoc = documents[currentIndex + 1] || documents[currentIndex - 1];
      setSelectedDocId(nextDoc?._id || null);
    }
  }, [isReadOnly, selectedDocId, deleteDocument, documents]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (isReadOnly || selectedIds.size === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const docId of selectedIds) {
      const success = await deleteDocument(docId);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setShowBulkDeleteConfirm(false);
    setSelectedIds(new Set());

    if (failCount === 0) {
      toast.success(`Deleted ${successCount} ${labels.itemLabelPlural.toLowerCase()}`);
    } else {
      toast.error(`Deleted ${successCount}, failed ${failCount}`);
    }

    // If current selected doc was deleted, clear selection
    if (selectedDocId && selectedIds.has(selectedDocId)) {
      setSelectedDocId(null);
    }
  }, [isReadOnly, selectedIds, deleteDocument, labels, selectedDocId]);

  // Toggle multi-select mode
  const handleToggleMultiSelect = useCallback(() => {
    setMultiSelectEnabled((prev) => {
      if (prev) {
        // Exiting multi-select, clear selection
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  // Extract known fields from documents for autocomplete
  const knownFields = useMemo(() => {
    const fields = new Set<string>();
    const extractFields = (obj: unknown, prefix = ''): void => {
      if (typeof obj !== 'object' || obj === null) return;
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        fields.add(path);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractFields(value, path);
        }
      }
    };
    // Sample first 10 documents for field extraction
    documents.slice(0, 10).forEach((doc) => extractFields(doc._source));
    return Array.from(fields).sort();
  }, [documents]);

  // Handle applying query filter
  const handleApplyFilter = useCallback(
    async (_query: Record<string, unknown>) => {
      // Save the current conditions as applied filters
      const validConditions = filterConditions.filter(c => c.field);
      setAppliedFilterConditions(validConditions);
      setShowQueryBuilder(false);

      // Reload documents with the new filters
      loadDocuments(false, validConditions);

      if (validConditions.length > 0) {
        toast.success(`Filter applied (${validConditions.length} condition${validConditions.length > 1 ? 's' : ''})`);
      }
    },
    [filterConditions, loadDocuments]
  );

  // Clear applied filter
  const handleClearFilter = useCallback(() => {
    setAppliedFilterConditions([]);
    setFilterConditions([]);
    loadDocuments(false, []);
  }, [loadDocuments]);

  // Handle document import
  const handleImport = useCallback(
    async (documentsToImport: Record<string, unknown>[]): Promise<{ success: number; failed: number }> => {
      if (!api) return { success: 0, failed: documentsToImport.length };

      try {
        const result = await api.importData({
          connectionKey,
          schema,
          table,
          rows: documentsToImport,
        });

        // Refresh the document list after import
        loadDocuments();

        return {
          success: result.insertedCount,
          failed: documentsToImport.length - result.insertedCount,
        };
      } catch (err) {
        console.error('Failed to import documents:', err);
        return { success: 0, failed: documentsToImport.length };
      }
    },
    [api, connectionKey, schema, table, loadDocuments]
  );

  // Load indexes for the collection
  const loadIndexes = useCallback(async () => {
    if (!api) return;
    setLoadingIndexes(true);

    try {
      const tableIndexes = await api.getTableIndexes({
        connectionKey,
        schema,
        table,
      });

      // Map table indexes to the format expected by IndexManagementPanel
      const mappedIndexes = tableIndexes.map((idx) => ({
        name: idx.name,
        keys: idx.columns.reduce(
          (acc, col) => {
            acc[col] = 1; // Default to ascending
            return acc;
          },
          {} as Record<string, number | string>
        ),
        unique: idx.isUnique,
      }));

      setIndexes(mappedIndexes);
    } catch (err) {
      console.error('Failed to load indexes:', err);
      toast.error('Failed to load indexes');
    } finally {
      setLoadingIndexes(false);
    }
  }, [api, connectionKey, schema, table]);

  // Create a new index
  const handleCreateIndex = useCallback(
    async (indexDef: { keys: Record<string, number>; options: Record<string, unknown> }): Promise<boolean> => {
      if (!api || !api.createIndex) return false;

      try {
        const indexName = await api.createIndex({
          connectionKey,
          schema,
          table,
          keys: indexDef.keys as Record<string, 1 | -1>,
          options: {
            unique: indexDef.options.unique as boolean | undefined,
            sparse: indexDef.options.sparse as boolean | undefined,
            background: indexDef.options.background as boolean | undefined,
            name: indexDef.options.name as string | undefined,
          },
        });
        toast.success(`Index "${indexName}" created`);
        loadIndexes();
        return true;
      } catch (err) {
        console.error('Failed to create index:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to create index');
        return false;
      }
    },
    [api, connectionKey, schema, table, loadIndexes]
  );

  // Drop an index
  const handleDropIndex = useCallback(
    async (indexName: string): Promise<boolean> => {
      if (!api || !api.dropIndex) return false;

      try {
        await api.dropIndex({
          connectionKey,
          schema,
          table,
          indexName,
        });
        toast.success(`Index "${indexName}" dropped`);
        loadIndexes();
        return true;
      } catch (err) {
        console.error('Failed to drop index:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to drop index');
        return false;
      }
    },
    [api, connectionKey, schema, table, loadIndexes]
  );

  // Execute aggregation pipeline
  const handleExecuteAggregation = useCallback(
    async (pipeline: Record<string, unknown>[]) => {
      if (!api || !api.runAggregation) return;
      setIsExecutingPipeline(true);

      try {
        const result = await api.runAggregation({
          connectionKey,
          schema,
          table,
          pipeline,
        });

        // Update the documents with aggregation results
        const aggregatedDocs: DocumentItem[] = result.rows.map((row, index) => ({
          _id: `agg-${index}`,
          _source: row,
        }));

        setDocuments(aggregatedDocs);
        setTotalCount(aggregatedDocs.length);
        setHasMore(false);

        if (aggregatedDocs.length > 0) {
          setSelectedDocId(aggregatedDocs[0]._id);
        } else {
          setSelectedDocId(null);
        }

        toast.success(`Aggregation returned ${aggregatedDocs.length} results`);
        setShowAggregationBuilder(false);
      } catch (err) {
        console.error('Failed to execute aggregation:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to execute aggregation');
      } finally {
        setIsExecutingPipeline(false);
      }
    },
    [api, connectionKey, schema, table]
  );

  // Open index panel and load indexes
  const handleOpenIndexPanel = useCallback(() => {
    setShowIndexPanel(true);
    loadIndexes();
  }, [loadIndexes]);

  // Render document viewer based on view mode
  const renderDocumentViewer = () => {
    if (!selectedDocument) {
      return (
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          <div className="text-center">
            <FileJson className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg mb-2">No {labels.itemLabel} Selected</p>
            <p className="text-sm text-text-tertiary">
              Select a {labels.itemLabel.toLowerCase()} from the list to view its data
            </p>
          </div>
        </div>
      );
    }

    switch (viewMode) {
      case 'tree':
        return (
          <TreeView
            data={selectedDocument._source}
            expandedPaths={expandedPaths}
            onToggleExpand={handleToggleExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onEdit={!isReadOnly ? handleEdit : undefined}
            onDelete={!isReadOnly ? handleFieldDelete : undefined}
            onAdd={!isReadOnly ? handleAddFieldClick : undefined}
            isReadOnly={isReadOnly}
            showTypeIndicators
            rootPath="root"
            className="flex-1"
          />
        );

      case 'json':
        return (
          <JsonView
            data={selectedDocument._source}
            isReadOnly={isReadOnly}
            onSave={!isReadOnly ? handleJsonSave : undefined}
            className="flex-1"
          />
        );

      case 'table':
        return (
          <TableView
            data={selectedDocument._source}
            isReadOnly={isReadOnly}
            onEdit={!isReadOnly ? handleEdit : undefined}
            className="flex-1"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-bg-tertiary rounded-md p-0.5">
            {(['tree', 'table', 'json'] as ViewMode[]).map((mode) => {
              const Icon = VIEW_MODE_ICONS[mode];
              return (
                <Tooltip key={mode} content={VIEW_MODE_LABELS[mode]}>
                  <button
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      viewMode === mode
                        ? 'bg-bg-primary text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-secondary'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {/* Container info */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              {labels.containerLabel}:
            </span>
            <span className="text-sm font-medium text-text-primary">{table}</span>
          </div>

          {/* Document count */}
          <span className="text-sm text-text-tertiary">
            {loading
              ? 'Loading...'
              : totalCount !== null
              ? `${totalCount.toLocaleString()} ${labels.itemLabelPlural.toLowerCase()}`
              : `${documents.length}${hasMore ? '+' : ''} ${labels.itemLabelPlural.toLowerCase()}`}
          </span>

          {isReadOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-xs font-medium">
              <Lock className="w-3 h-3" />
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Multi-select toggle */}
          <Tooltip content={multiSelectEnabled ? 'Exit multi-select' : 'Multi-select'}>
            <IconButton
              icon={<CheckSquare className="w-4 h-4" />}
              size="sm"
              aria-label="Toggle multi-select"
              onClick={handleToggleMultiSelect}
              className={cn(multiSelectEnabled && 'bg-accent/15 text-accent')}
            />
          </Tooltip>

          {/* Filter button with popover */}
          <QueryFilterBuilder
            open={showQueryBuilder}
            onOpenChange={setShowQueryBuilder}
            dbType={dbType}
            knownFields={knownFields}
            conditions={filterConditions}
            onConditionsChange={setFilterConditions}
            onApply={handleApplyFilter}
            hasActiveFilter={appliedFilterConditions.length > 0}
            onClearFilter={handleClearFilter}
          />

          {/* Add document button */}
          {!isReadOnly && (
            <Tooltip content={`Add ${labels.itemLabel}`}>
              <IconButton
                icon={<Plus className="w-4 h-4" />}
                size="sm"
                aria-label={`Add ${labels.itemLabel.toLowerCase()}`}
              />
            </Tooltip>
          )}

          {/* Import button */}
          {!isReadOnly && (
            <Tooltip content="Import">
              <IconButton
                icon={<Upload className="w-4 h-4" />}
                size="sm"
                aria-label="Import documents"
                onClick={() => setShowImportModal(true)}
              />
            </Tooltip>
          )}

          {/* Export button */}
          <Tooltip content="Export">
            <IconButton
              icon={<Download className="w-4 h-4" />}
              size="sm"
              aria-label="Export documents"
              onClick={() => setShowExportModal(true)}
            />
          </Tooltip>

          {/* Index management button (MongoDB only) */}
          {dbType === 'mongodb' && (
            <Tooltip content="Manage Indexes">
              <IconButton
                icon={<Database className="w-4 h-4" />}
                size="sm"
                aria-label="Manage indexes"
                onClick={handleOpenIndexPanel}
              />
            </Tooltip>
          )}

          {/* Aggregation pipeline button (MongoDB only) */}
          {dbType === 'mongodb' && (
            <Tooltip content="Aggregation Pipeline">
              <IconButton
                icon={<GitBranch className="w-4 h-4" />}
                size="sm"
                aria-label="Aggregation pipeline"
                onClick={() => setShowAggregationBuilder(true)}
              />
            </Tooltip>
          )}

          {/* Refresh button */}
          <Tooltip content="Refresh">
            <IconButton
              icon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
              size="sm"
              aria-label="Refresh"
              onClick={() => loadDocuments()}
            />
          </Tooltip>
        </div>
      </div>

      {/* Bulk action bar (shown when items selected) */}
      {multiSelectEnabled && selectedIds.size > 0 && (
        <div className="h-10 px-4 flex items-center justify-between bg-accent/10 border-b border-accent/30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-accent">
              {selectedIds.size} {selectedIds.size === 1 ? labels.itemLabel : labels.itemLabelPlural} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Export selected */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>

            {/* Delete selected */}
            {!isReadOnly && (
              <Button
                size="sm"
                variant="ghost"
                className="text-error hover:bg-error/10"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document list sidebar */}
        <div className="w-80 border-r border-border">
          <DocumentList
            documents={filteredDocuments}
            selectedDocId={selectedDocId}
            onSelect={setSelectedDocId}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            multiSelectEnabled={multiSelectEnabled}
            hasMore={hasMore && !debouncedFilter}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            loading={loading}
            searchQuery={filterQuery}
            onSearchChange={setFilterQuery}
            searchPlaceholder={`Search ${labels.itemLabelPlural.toLowerCase()}...`}
            dbType={dbType}
            itemLabel={labels.itemLabelPlural.toLowerCase()}
            totalCount={totalCount}
          />
        </div>

        {/* Document viewer */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
          {/* Document header */}
          {selectedDocument && (
            <div className="px-4 py-2 border-b border-border bg-bg-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">ID:</span>
                <span className="text-sm font-mono text-text-primary">
                  {selectedDocument._id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddFieldClick('root')}
                    >
                      Add Field
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-error"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isOperationLoading}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Document content */}
          {renderDocumentViewer()}
        </div>
      </div>

      {/* Delete Document Dialog */}
      {selectedDocument && (
        <DeleteDocumentDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          documentId={selectedDocument._id}
          dbType={dbType}
          onConfirm={handleDeleteDocument}
          isDeleting={isOperationLoading}
        />
      )}

      {/* Add Field Modal */}
      <AddFieldModal
        open={showAddFieldModal}
        onClose={() => setShowAddFieldModal(false)}
        parentPath={addFieldPath}
        onAdd={handleAddField}
        isAdding={isOperationLoading}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        documents={filteredDocuments}
        selectedIds={selectedIds.size > 0 ? selectedIds : undefined}
        dbType={dbType}
        tableName={table}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <DeleteDocumentDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        documentId={`${selectedIds.size} ${selectedIds.size === 1 ? labels.itemLabel : labels.itemLabelPlural}`}
        dbType={dbType}
        onConfirm={handleBulkDelete}
        isDeleting={isOperationLoading}
        isBulkDelete
      />


      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        dbType={dbType}
        tableName={table}
        onImport={handleImport}
      />

      {/* Index Management Panel (MongoDB) */}
      <IndexManagementPanel
        open={showIndexPanel}
        onClose={() => setShowIndexPanel(false)}
        dbType={dbType}
        tableName={table}
        indexes={indexes}
        loading={loadingIndexes}
        onRefresh={loadIndexes}
        onCreate={handleCreateIndex}
        onDrop={handleDropIndex}
        isReadOnly={isReadOnly}
      />

      {/* Aggregation Pipeline Builder (MongoDB) */}
      <AggregationPipelineBuilder
        open={showAggregationBuilder}
        onClose={() => setShowAggregationBuilder(false)}
        dbType={dbType}
        knownFields={knownFields}
        onExecute={handleExecuteAggregation}
        isExecuting={isExecutingPipeline}
      />
    </div>
  );
}

export default DocumentDataView;
