/**
 * DocumentPreview
 *
 * Compact preview of a document for display in the document list.
 * Shows document ID and a smart preview of key fields.
 */

import { useMemo } from 'react';
import { FileJson } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { DocumentItem } from '../types';

interface DocumentPreviewProps {
  /** The document to preview */
  document: DocumentItem;
  /** Whether this document is selected */
  isSelected: boolean;
  /** Callback when document is clicked */
  onClick: () => void;
  /** Optional highlight text for search matches */
  highlightText?: string;
  /** Database type for customizing display */
  dbType?: 'mongodb' | 'elasticsearch' | 'cassandra';
}

/**
 * Extract the most meaningful preview fields from a document
 */
function extractPreviewFields(
  source: Record<string, unknown>,
  maxFields = 3
): Array<{ key: string; value: string }> {
  const fields: Array<{ key: string; value: string }> = [];

  // Priority fields to show first (common field names)
  const priorityKeys = ['name', 'title', 'email', 'username', 'type', 'status', 'description'];

  // First, try to find priority fields
  for (const key of priorityKeys) {
    if (key in source && fields.length < maxFields) {
      const value = source[key];
      if (value !== null && value !== undefined && typeof value !== 'object') {
        fields.push({ key, value: String(value).slice(0, 50) });
      }
    }
  }

  // Then add other scalar fields
  for (const [key, value] of Object.entries(source)) {
    if (fields.length >= maxFields) break;
    if (priorityKeys.includes(key)) continue;
    if (key.startsWith('_')) continue; // Skip internal fields

    if (value !== null && value !== undefined && typeof value !== 'object') {
      fields.push({ key, value: String(value).slice(0, 50) });
    }
  }

  return fields;
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(text: string, highlight?: string): React.ReactNode {
  if (!highlight || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerHighlight = highlight.toLowerCase();
  const index = lowerText.indexOf(lowerHighlight);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-accent/30 text-text-primary rounded px-0.5">
        {text.slice(index, index + highlight.length)}
      </mark>
      {text.slice(index + highlight.length)}
    </>
  );
}

/**
 * Format document ID for display
 */
function formatDocId(id: string): string {
  // Truncate long IDs (like MongoDB ObjectIds)
  if (id.length > 24) {
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  }
  return id;
}

export function DocumentPreview({
  document,
  isSelected,
  onClick,
  highlightText,
  dbType: _dbType = 'mongodb',
}: DocumentPreviewProps) {
  const previewFields = useMemo(
    () => extractPreviewFields(document._source, 2),
    [document._source]
  );

  const fieldCount = useMemo(
    () => Object.keys(document._source).filter((k) => !k.startsWith('_')).length,
    [document._source]
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full h-full px-3 py-2 text-left transition-colors group overflow-hidden',
        isSelected
          ? 'bg-accent/10 border-l-2 border-accent'
          : 'hover:bg-bg-hover border-l-2 border-transparent'
      )}
    >
      {/* Document ID row */}
      <div className="flex items-center gap-2 mb-1">
        <FileJson
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0',
            isSelected ? 'text-accent' : 'text-text-tertiary'
          )}
        />
        <span
          className={cn(
            'text-sm font-mono truncate',
            isSelected ? 'text-accent' : 'text-text-primary'
          )}
          title={document._id}
        >
          {highlightMatch(formatDocId(document._id), highlightText)}
        </span>
        <span className="text-xs text-text-tertiary ml-auto flex-shrink-0">
          {fieldCount} fields
        </span>
      </div>

      {/* Preview fields */}
      <div className="space-y-0.5 ml-5">
        {previewFields.map(({ key, value }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs truncate">
            <span className="text-text-tertiary">{key}:</span>
            <span className="text-text-secondary truncate">
              {highlightMatch(value, highlightText)}
            </span>
          </div>
        ))}

        {/* Show "..." if there are more fields */}
        {fieldCount > 2 && (
          <div className="text-xs text-text-tertiary">
            +{fieldCount - 2} more field{fieldCount - 2 !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </button>
  );
}

export default DocumentPreview;
