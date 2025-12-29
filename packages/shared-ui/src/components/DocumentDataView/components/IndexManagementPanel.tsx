/**
 * IndexManagementPanel
 *
 * Panel for viewing and managing database indexes.
 * Supports MongoDB, Elasticsearch, and Cassandra index operations.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  AlertCircle,
  Zap,
  Key,
  Hash,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/primitives';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/primitives/Dialog';
import { toast } from 'sonner';
import type { DocumentDbType } from '../types';

interface IndexInfo {
  name: string;
  keys: Record<string, number | string>;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
  type?: string; // For Elasticsearch: 'text', 'keyword', etc.
}

interface IndexManagementPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when panel closes */
  onClose: () => void;
  /** Database type */
  dbType: DocumentDbType;
  /** Collection/table name */
  tableName: string;
  /** List of existing indexes */
  indexes: IndexInfo[];
  /** Whether indexes are loading */
  loading: boolean;
  /** Callback to refresh indexes */
  onRefresh: () => void;
  /** Callback to create an index */
  onCreate?: (index: { keys: Record<string, number>; options: Record<string, unknown> }) => Promise<boolean>;
  /** Callback to drop an index */
  onDrop?: (indexName: string) => Promise<boolean>;
  /** Whether in read-only mode */
  isReadOnly?: boolean;
}

interface NewIndexField {
  id: string;
  field: string;
  direction: 1 | -1;
}

function generateId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function IndexManagementPanel({
  open,
  onClose,
  dbType: _dbType,
  tableName,
  indexes,
  loading,
  onRefresh,
  onCreate,
  onDrop,
  isReadOnly = false,
}: IndexManagementPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDropDialog, setShowDropDialog] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDropping, setIsDropping] = useState(false);

  // New index form state
  const [newIndexFields, setNewIndexFields] = useState<NewIndexField[]>([
    { id: generateId(), field: '', direction: 1 },
  ]);
  const [indexOptions, setIndexOptions] = useState({
    unique: false,
    sparse: false,
    background: true,
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!showCreateDialog) {
      setNewIndexFields([{ id: generateId(), field: '', direction: 1 }]);
      setIndexOptions({ unique: false, sparse: false, background: true });
    }
  }, [showCreateDialog]);

  // Add field to new index
  const handleAddField = useCallback(() => {
    setNewIndexFields((prev) => [
      ...prev,
      { id: generateId(), field: '', direction: 1 },
    ]);
  }, []);

  // Remove field from new index
  const handleRemoveField = useCallback((id: string) => {
    setNewIndexFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Update field in new index
  const handleUpdateField = useCallback((id: string, updates: Partial<NewIndexField>) => {
    setNewIndexFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  // Create new index
  const handleCreate = useCallback(async () => {
    if (!onCreate) return;

    const validFields = newIndexFields.filter((f) => f.field.trim());
    if (validFields.length === 0) {
      toast.error('At least one field is required');
      return;
    }

    const keys: Record<string, number> = {};
    validFields.forEach((f) => {
      keys[f.field.trim()] = f.direction;
    });

    setIsCreating(true);
    try {
      const success = await onCreate({ keys, options: indexOptions });
      if (success) {
        toast.success('Index created successfully');
        setShowCreateDialog(false);
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create index');
    } finally {
      setIsCreating(false);
    }
  }, [onCreate, newIndexFields, indexOptions, onRefresh]);

  // Drop index
  const handleDrop = useCallback(async () => {
    if (!onDrop || !showDropDialog) return;

    setIsDropping(true);
    try {
      const success = await onDrop(showDropDialog);
      if (success) {
        toast.success('Index dropped successfully');
        setShowDropDialog(null);
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to drop index');
    } finally {
      setIsDropping(false);
    }
  }, [onDrop, showDropDialog, onRefresh]);

  // Format index keys for display
  const formatKeys = (keys: Record<string, number | string>): string => {
    return Object.entries(keys)
      .map(([field, dir]) => {
        if (typeof dir === 'number') {
          return `${field}: ${dir === 1 ? 'ASC' : 'DESC'}`;
        }
        return `${field}: ${dir}`;
      })
      .join(', ');
  };

  // Get index icon based on type
  const getIndexIcon = (index: IndexInfo) => {
    if (index.unique) return Key;
    if (index.name === '_id_') return Hash;
    return Database;
  };

  if (!open) return null;

  return (
    <>
      {/* Main Panel */}
      <div className="absolute top-full left-0 right-0 z-50 mt-1 mx-4 bg-bg-primary border border-border rounded-lg shadow-xl max-h-[60vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-text-primary">Index Management</h3>
            <span className="text-xs text-text-tertiary">
              {tableName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Index List */}
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-text-tertiary" />
            </div>
          ) : indexes.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No indexes found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {indexes.map((index) => {
                const Icon = getIndexIcon(index);
                const isExpanded = expandedIndex === index.name;
                const isSystemIndex = index.name === '_id_';

                return (
                  <div
                    key={index.name}
                    className="rounded border border-border bg-bg-secondary"
                  >
                    {/* Index header */}
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : index.name)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-bg-hover transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-tertiary" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-tertiary" />
                      )}
                      <Icon className={cn('w-4 h-4', index.unique ? 'text-yellow-500' : 'text-text-tertiary')} />
                      <span className="flex-1 text-sm font-mono text-text-primary truncate">
                        {index.name}
                      </span>
                      {index.unique && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-500">
                          Unique
                        </span>
                      )}
                      {index.sparse && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/15 text-blue-500">
                          Sparse
                        </span>
                      )}
                      {!isReadOnly && !isSystemIndex && onDrop && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDropDialog(index.name);
                          }}
                          className="p-1 rounded hover:bg-error/10 text-text-tertiary hover:text-error transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </button>

                    {/* Index details */}
                    {isExpanded && (
                      <div className="px-8 pb-3 space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-text-tertiary w-16">Keys:</span>
                          <span className="font-mono text-text-secondary">
                            {formatKeys(index.keys)}
                          </span>
                        </div>
                        {index.expireAfterSeconds !== undefined && (
                          <div className="flex items-start gap-2">
                            <span className="text-text-tertiary w-16">TTL:</span>
                            <span className="text-text-secondary">
                              {index.expireAfterSeconds}s
                            </span>
                          </div>
                        )}
                        {index.partialFilterExpression && (
                          <div className="flex items-start gap-2">
                            <span className="text-text-tertiary w-16">Filter:</span>
                            <span className="font-mono text-text-secondary">
                              {JSON.stringify(index.partialFilterExpression)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isReadOnly && onCreate && (
          <div className="px-4 py-3 border-t border-border bg-bg-secondary">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="w-full"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Index
            </Button>
          </div>
        )}
      </div>

      {/* Create Index Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent title="Create Index" className="max-w-md">
          <div className="space-y-4">
            {/* Fields */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Index Fields
              </label>
              {newIndexFields.map((field) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={field.field}
                    onChange={(e) => handleUpdateField(field.id, { field: e.target.value })}
                    placeholder="Field name"
                    className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    onClick={() => handleUpdateField(field.id, { direction: field.direction === 1 ? -1 : 1 })}
                    className="p-1.5 rounded border border-border hover:bg-bg-hover text-text-secondary"
                    title={field.direction === 1 ? 'Ascending' : 'Descending'}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="sr-only">{field.direction === 1 ? 'ASC' : 'DESC'}</span>
                  </button>
                  <span className="text-xs text-text-tertiary w-8">
                    {field.direction === 1 ? 'ASC' : 'DESC'}
                  </span>
                  {newIndexFields.length > 1 && (
                    <button
                      onClick={() => handleRemoveField(field.id)}
                      className="p-1.5 rounded hover:bg-error/10 text-text-tertiary hover:text-error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddField}
                className="text-xs text-accent hover:underline"
              >
                + Add field
              </button>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Options
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={indexOptions.unique}
                    onChange={(e) => setIndexOptions((prev) => ({ ...prev, unique: e.target.checked }))}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Unique</span>
                  <span className="text-xs text-text-tertiary">- Reject duplicate values</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={indexOptions.sparse}
                    onChange={(e) => setIndexOptions((prev) => ({ ...prev, sparse: e.target.checked }))}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Sparse</span>
                  <span className="text-xs text-text-tertiary">- Only index documents with this field</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={indexOptions.background}
                    onChange={(e) => setIndexOptions((prev) => ({ ...prev, background: e.target.checked }))}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Background</span>
                  <span className="text-xs text-text-tertiary">- Build in background</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={isCreating}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={isCreating || newIndexFields.every((f) => !f.field.trim())}
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Create Index
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drop Index Confirmation Dialog */}
      <Dialog open={!!showDropDialog} onOpenChange={(open) => !open && setShowDropDialog(null)}>
        <DialogContent title="Drop Index?" className="max-w-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/20">
              <AlertCircle className="h-5 w-5 text-error" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">
                This action cannot be undone. This will permanently drop the index:
              </p>
              <p className="mt-2 font-mono text-sm text-text-primary bg-bg-tertiary px-2 py-1 rounded">
                {showDropDialog}
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={isDropping}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDrop}
              disabled={isDropping}
              className="bg-error hover:bg-error/90"
            >
              {isDropping ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Dropping...
                </span>
              ) : (
                'Drop Index'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default IndexManagementPanel;
