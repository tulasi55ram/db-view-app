/**
 * DocumentList
 *
 * List of documents with search and selection support.
 * Used as a sidebar in the document data view.
 */

import { useRef, useCallback, useEffect, useState, useMemo, type FC } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { DocumentPreview } from './DocumentPreview';
import type { DocumentItem, DocumentDbType } from './types';

interface DocumentListProps {
  /** List of documents to display */
  documents: DocumentItem[];
  /** Currently selected document ID */
  selectedDocId: string | null;
  /** Callback when a document is selected */
  onSelect: (docId: string) => void;
  /** Whether initially loading */
  loading: boolean;
  /** Search query value */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Placeholder text for search */
  searchPlaceholder?: string;
  /** Database type for display customization */
  dbType?: DocumentDbType;
  /** Label for items (e.g., "documents", "rows") */
  itemLabel?: string;
  /** Total count if known */
  totalCount?: number | null;
}

export const DocumentList: FC<DocumentListProps> = ({
  documents,
  selectedDocId,
  onSelect,
  loading,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  dbType = 'mongodb',
  itemLabel = 'documents',
  totalCount,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Find index of selected document
  const selectedIndex = documents.findIndex((d) => d._id === selectedDocId);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this component or its children are focused
      if (!listRef.current?.contains(document.activeElement)) return;

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

  // Update focused index when selection changes
  useEffect(() => {
    if (selectedIndex >= 0) {
      setFocusedIndex(selectedIndex);
    }
  }, [selectedIndex]);

  // Handle document selection
  const handleSelect = useCallback(
    (docId: string) => {
      onSelect(docId);
      const index = documents.findIndex((d) => d._id === docId);
      setFocusedIndex(index);
    },
    [onSelect, documents]
  );

  // Filter documents by search query (client-side)
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;

    const query = searchQuery.toLowerCase();
    return documents.filter((doc) => {
      // Search in document ID
      if (doc._id.toLowerCase().includes(query)) return true;

      // Search in document values
      const searchInValue = (value: unknown): boolean => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.toLowerCase().includes(query)) return true;
        if (typeof value === 'number' && String(value).includes(query)) return true;
        if (Array.isArray(value)) return value.some(searchInValue);
        if (typeof value === 'object') {
          return Object.values(value as Record<string, unknown>).some(searchInValue);
        }
        return false;
      };

      return searchInValue(doc._source);
    });
  }, [documents, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-vscode-bg-light">
      {/* Search header */}
      <div className="p-2 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-8 py-1.5 bg-vscode-bg border border-vscode-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-vscode-accent"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document list */}
      <div
        ref={listRef}
        className="flex-1 overflow-auto"
        tabIndex={0}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-vscode-text-muted" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-vscode-text-muted text-sm">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            {searchQuery ? (
              <>
                <p>No matching {itemLabel}</p>
                <button
                  onClick={() => onSearchChange('')}
                  className="mt-2 text-vscode-accent hover:underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p>No {itemLabel} found</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-vscode-border">
            {filteredDocuments.map((doc) => (
              <DocumentPreview
                key={doc._id}
                document={doc}
                isSelected={doc._id === selectedDocId}
                onClick={() => handleSelect(doc._id)}
                highlightText={searchQuery}
                dbType={dbType}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with counts */}
      {filteredDocuments.length > 0 && (
        <div className="px-3 py-1.5 border-t border-vscode-border text-xs text-vscode-text-muted flex items-center justify-between">
          <span>
            {searchQuery
              ? `${filteredDocuments.length} matching`
              : totalCount !== null && totalCount !== undefined
              ? `${documents.length} of ${totalCount.toLocaleString()}`
              : `${documents.length} loaded`}
          </span>
        </div>
      )}
    </div>
  );
};

export default DocumentList;
