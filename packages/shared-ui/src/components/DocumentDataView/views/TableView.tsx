/**
 * TableView
 *
 * Flattened table view for displaying document data in a spreadsheet-like format.
 * Supports nested field flattening with dot notation, type indicators,
 * sorting, and filtering.
 */

import { useMemo, useState, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Copy, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TypeIndicator } from '../components/TypeIndicator';
import { getFieldType, getFieldTypeColor } from '../types';
import type { FieldType } from '../types';

interface TableViewProps {
  /** Document data to display */
  data: Record<string, unknown>;
  /** Whether editing is disabled */
  isReadOnly?: boolean;
  /** Callback when a value is edited */
  onEdit?: (path: string, newValue: unknown) => void;
  /** Optional class name */
  className?: string;
}

interface FlattenedField {
  key: string;
  value: unknown;
  type: FieldType;
  depth: number;
}

type SortDirection = 'asc' | 'desc' | null;
type SortField = 'key' | 'value' | 'type';

/**
 * Flatten a nested object into dot-notation paths
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
  depth = 0,
  maxDepth = 10
): FlattenedField[] {
  if (depth > maxDepth) return [];

  const result: FlattenedField[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const fieldType = getFieldType(value);

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      // Recursively flatten nested objects
      result.push(...flattenObject(value as Record<string, unknown>, fullKey, depth + 1, maxDepth));
    } else {
      // Add leaf value
      result.push({
        key: fullKey,
        value,
        type: fieldType,
        depth,
      });
    }
  }

  return result;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown, type: FieldType): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (type) {
    case 'array':
      if (Array.isArray(value)) {
        return `[${value.length} item${value.length !== 1 ? 's' : ''}]`;
      }
      return String(value);

    case 'object':
      return '{...}';

    case 'string':
      const str = String(value);
      if (str.length > 100) {
        return `"${str.slice(0, 100)}..."`;
      }
      return `"${str}"`;

    case 'date':
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case 'boolean':
      return value ? 'true' : 'false';

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);

    case 'objectId':
      return String(value);

    case 'binary':
      return '[Binary Data]';

    default:
      return String(value);
  }
}

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

export function TableView({
  data,
  isReadOnly: _isReadOnly = false,
  onEdit: _onEdit,
  className,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // Flatten the document
  const flatFields = useMemo(() => flattenObject(data), [data]);

  // Filter fields
  const filteredFields = useMemo(() => {
    if (!filter) return flatFields;
    const lower = filter.toLowerCase();
    return flatFields.filter(
      (field) =>
        field.key.toLowerCase().includes(lower) ||
        formatValue(field.value, field.type).toLowerCase().includes(lower)
    );
  }, [flatFields, filter]);

  // Sort fields
  const sortedFields = useMemo(() => {
    if (!sortField || !sortDirection) return filteredFields;

    return [...filteredFields].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'key':
          comparison = a.key.localeCompare(b.key);
          break;
        case 'value':
          comparison = formatValue(a.value, a.type).localeCompare(
            formatValue(b.value, b.type)
          );
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredFields, sortField, sortDirection]);

  // Handle sort toggle
  const handleSort = useCallback((field: SortField) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDirection((currentDir) => {
          if (currentDir === 'asc') return 'desc';
          if (currentDir === 'desc') return null;
          return 'asc';
        });
        return sortDirection === 'desc' ? null : field;
      }
      setSortDirection('asc');
      return field;
    });
  }, [sortDirection]);

  // Handle copy
  const handleCopy = useCallback(async (key: string, value: unknown) => {
    const textToCopy =
      typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  }, []);

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-text-tertiary" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3.5 h-3.5 text-accent" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-3.5 h-3.5 text-accent" />;
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-text-tertiary" />;
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">
            {sortedFields.length} field{sortedFields.length !== 1 ? 's' : ''}
            {filter && ` (filtered from ${flatFields.length})`}
          </span>
        </div>

        {/* Quick filter */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter fields..."
            className="w-48 px-2 py-1 text-xs bg-bg-primary border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bg-secondary border-b border-border z-10">
            <tr>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('key')}
                  className="flex items-center gap-1.5 font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Field
                  {renderSortIcon('key')}
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('value')}
                  className="flex items-center gap-1.5 font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Value
                  {renderSortIcon('value')}
                </button>
              </th>
              <th className="text-left px-4 py-2 w-24">
                <button
                  onClick={() => handleSort('type')}
                  className="flex items-center gap-1.5 font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Type
                  {renderSortIcon('type')}
                </button>
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sortedFields.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-tertiary">
                  {filter ? 'No matching fields' : 'No fields to display'}
                </td>
              </tr>
            ) : (
              sortedFields.map(({ key, value, type, depth }) => (
                <tr
                  key={key}
                  className={cn(
                    'border-b border-border/50 hover:bg-bg-hover group transition-colors',
                    depth > 0 && 'bg-bg-secondary/30'
                  )}
                >
                  <td className="px-4 py-2">
                    <span
                      className="font-mono text-text-secondary"
                      style={{ paddingLeft: depth * 8 }}
                    >
                      {key}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 font-mono max-w-md truncate',
                      getFieldTypeColor(type)
                    )}
                    title={formatValue(value, type)}
                  >
                    {formatValue(value, type)}
                  </td>
                  <td className="px-4 py-2">
                    <TypeIndicator type={type} />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleCopy(key, value)}
                      className={cn(
                        'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                        copiedKey === key
                          ? 'text-green-500'
                          : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary'
                      )}
                      title="Copy value"
                    >
                      {copiedKey === key ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TableView;
