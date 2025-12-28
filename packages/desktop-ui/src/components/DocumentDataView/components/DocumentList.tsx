/**
 * DocumentList
 *
 * Virtualized list of documents with search, keyboard navigation,
 * multi-select support, and infinite scroll.
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X, RefreshCw, ChevronsDown, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DocumentPreview } from './DocumentPreview';
import type { DocumentItem } from '../types';

interface DocumentListProps {
  /** List of documents to display */
  documents: DocumentItem[];
  /** Currently selected document ID (for viewing) */
  selectedDocId: string | null;
  /** Callback when a document is selected for viewing */
  onSelect: (docId: string) => void;
  /** Set of selected document IDs (for multi-select/bulk operations) */
  selectedIds?: Set<string>;
  /** Callback when multi-selection changes */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Whether multi-select mode is enabled */
  multiSelectEnabled?: boolean;
  /** Whether more documents are available */
  hasMore: boolean;
  /** Whether currently loading more */
  loadingMore: boolean;
  /** Callback to load more documents */
  onLoadMore: () => void;
  /** Whether initial loading is in progress */
  loading: boolean;
  /** Search query value */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Placeholder text for search */
  searchPlaceholder?: string;
  /** Database type for display customization */
  dbType?: 'mongodb' | 'elasticsearch' | 'cassandra';
  /** Label for items (e.g., "Documents", "Rows") */
  itemLabel?: string;
  /** Total count if known */
  totalCount?: number | null;
}

// Estimated item height for virtualization
const ESTIMATED_ITEM_HEIGHT = 72;

export function DocumentList({
  documents,
  selectedDocId,
  onSelect,
  selectedIds = new Set(),
  onSelectionChange,
  multiSelectEnabled = false,
  hasMore,
  loadingMore,
  onLoadMore,
  loading,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  dbType = 'mongodb',
  itemLabel = 'documents',
  totalCount,
}: DocumentListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);

  // Multi-select handlers
  const handleToggleSelect = useCallback(
    (docId: string, index: number, shiftKey: boolean) => {
      if (!onSelectionChange) return;

      const newSelection = new Set(selectedIds);

      if (shiftKey && lastClickedIndex >= 0) {
        // Shift+click: select range
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        for (let i = start; i <= end; i++) {
          if (documents[i]) {
            newSelection.add(documents[i]._id);
          }
        }
      } else {
        // Regular click: toggle selection
        if (newSelection.has(docId)) {
          newSelection.delete(docId);
        } else {
          newSelection.add(docId);
        }
      }

      setLastClickedIndex(index);
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange, lastClickedIndex, documents]
  );

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    const allIds = new Set(documents.map((d) => d._id));
    onSelectionChange(allIds);
  }, [documents, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  // Selection state: none, some, or all
  const selectionState = useMemo(() => {
    if (selectedIds.size === 0) return 'none';
    if (selectedIds.size === documents.length) return 'all';
    return 'some';
  }, [selectedIds.size, documents.length]);

  // Find index of selected document
  const selectedIndex = documents.findIndex((d) => d._id === selectedDocId);

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: documents.length + (hasMore && !searchQuery ? 1 : 0), // +1 for load more button
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5,
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this component or its children are focused
      if (!parentRef.current?.contains(document.activeElement)) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.min(prev + 1, documents.length - 1);
            if (documents[next]) {
              onSelect(documents[next]._id);
            }
            return next;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            if (documents[next]) {
              onSelect(documents[next]._id);
            }
            return next;
          });
          break;

        case 'Enter':
          if (focusedIndex >= 0 && documents[focusedIndex]) {
            onSelect(documents[focusedIndex]._id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documents, focusedIndex, onSelect]);

  // Scroll to selected item when selection changes
  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
      setFocusedIndex(selectedIndex);
    }
  }, [selectedIndex, virtualizer]);

  // Handle document selection
  const handleSelect = useCallback(
    (docId: string) => {
      onSelect(docId);
      const index = documents.findIndex((d) => d._id === docId);
      setFocusedIndex(index);
    },
    [onSelect, documents]
  );

  // Load more when scrolling near bottom
  const handleScroll = useCallback(() => {
    if (!hasMore || loadingMore || searchQuery) return;

    const container = parentRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Load more when within 200px of bottom
    if (distanceFromBottom < 200) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, searchQuery, onLoadMore]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Search header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Select all checkbox (when multi-select enabled) */}
          {multiSelectEnabled && documents.length > 0 && (
            <button
              onClick={() => {
                if (selectionState === 'all') {
                  handleDeselectAll();
                } else {
                  handleSelectAll();
                }
              }}
              className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors"
              title={selectionState === 'all' ? 'Deselect all' : 'Select all'}
            >
              {selectionState === 'none' && <Square className="w-4 h-4" />}
              {selectionState === 'some' && <MinusSquare className="w-4 h-4 text-accent" />}
              {selectionState === 'all' && <CheckSquare className="w-4 h-4 text-accent" />}
            </button>
          )}

          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-8 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selection count (when items selected) */}
        {multiSelectEnabled && selectedIds.size > 0 && (
          <div className="mt-1.5 text-xs text-accent">
            {selectedIds.size} selected
          </div>
        )}
      </div>

      {/* Document list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        tabIndex={0}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-text-tertiary" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            {searchQuery ? (
              <>
                <p>No matching {itemLabel}</p>
                <button
                  onClick={() => onSearchChange('')}
                  className="mt-2 text-accent hover:underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p>No {itemLabel} found</p>
            )}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              // Check if this is the "load more" row
              if (virtualRow.index === documents.length) {
                return (
                  <div
                    key="load-more"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="px-3 py-2"
                  >
                    {loadingMore ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-text-tertiary text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading more...
                      </div>
                    ) : (
                      <button
                        onClick={onLoadMore}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary text-sm transition-colors"
                      >
                        <ChevronsDown className="w-4 h-4" />
                        Load more
                      </button>
                    )}
                  </div>
                );
              }

              const doc = documents[virtualRow.index];
              if (!doc) return null;

              const isChecked = selectedIds.has(doc._id);

              return (
                <div
                  key={doc._id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  data-index={virtualRow.index}
                  className="flex items-stretch overflow-hidden border-b border-border"
                >
                  {/* Checkbox for multi-select */}
                  {multiSelectEnabled && (
                    <button
                      onClick={(e) => handleToggleSelect(doc._id, virtualRow.index, e.shiftKey)}
                      className={cn(
                        'flex items-center justify-center w-8 flex-shrink-0 transition-colors',
                        isChecked
                          ? 'bg-accent/10 text-accent'
                          : 'bg-bg-secondary text-text-tertiary hover:text-text-secondary'
                      )}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Document preview */}
                  <div className="flex-1 min-w-0">
                    <DocumentPreview
                      document={doc}
                      isSelected={doc._id === selectedDocId}
                      onClick={() => handleSelect(doc._id)}
                      highlightText={searchQuery}
                      dbType={dbType}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with counts */}
      {documents.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border text-xs text-text-tertiary flex items-center justify-between">
          <span>
            {searchQuery
              ? `${documents.length} matching`
              : totalCount !== null && totalCount !== undefined
              ? `${documents.length} of ${totalCount.toLocaleString()}`
              : `${documents.length} loaded`}
          </span>
          {hasMore && !searchQuery && (
            <span className="text-accent">More available</span>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentList;
