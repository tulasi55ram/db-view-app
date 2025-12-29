/**
 * TreeNode
 *
 * Recursive component for rendering a node in the document tree.
 * Handles expand/collapse, inline editing, and type visualization.
 */

import { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Pencil, Copy, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';
import { getFieldType, getFieldTypeColor, type FieldType } from '../types';
import { TypeIndicator } from './TypeIndicator';
import { ValueEditor } from './ValueEditor';

interface TreeNodeProps {
  /** Field key/name */
  fieldKey: string;
  /** Field value */
  value: unknown;
  /** JSON path to this field */
  path: string;
  /** Nesting depth (0 = root) */
  depth: number;
  /** Whether this node is expanded */
  isExpanded: boolean;
  /** Callback to toggle expansion */
  onToggleExpand: (path: string) => void;
  /** Callback when value is edited */
  onEdit?: (path: string, newValue: unknown) => void;
  /** Callback when field is deleted */
  onDelete?: (path: string) => void;
  /** Callback when field is added (for objects/arrays) */
  onAdd?: (path: string) => void;
  /** Whether editing is disabled */
  isReadOnly?: boolean;
  /** Set of all expanded paths (for children) */
  expandedPaths: Set<string>;
  /** Whether to show type indicators */
  showTypeIndicators?: boolean;
  /** Whether this is an array index */
  isArrayItem?: boolean;
}

/**
 * Format a value for display (truncated for long values)
 */
function formatValue(value: unknown, type: FieldType, maxLength = 100): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (type) {
    case 'string':
      const str = String(value);
      if (str.length > maxLength) {
        return `"${str.slice(0, maxLength)}..."`;
      }
      return `"${str}"`;
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return String(value);
    case 'date':
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Handle MongoDB date format
      if (typeof value === 'object' && value !== null && '$date' in value) {
        return String((value as { $date: string }).$date);
      }
      return String(value);
    case 'objectId':
      // Handle MongoDB ObjectId format
      if (typeof value === 'object' && value !== null && '$oid' in value) {
        return String((value as { $oid: string }).$oid);
      }
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Get child count label for arrays and objects
 */
function getChildCountLabel(value: unknown, type: FieldType): string | null {
  if (type === 'array' && Array.isArray(value)) {
    const len = value.length;
    return `${len} item${len !== 1 ? 's' : ''}`;
  }
  if (type === 'object' && typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    const len = keys.length;
    return `${len} field${len !== 1 ? 's' : ''}`;
  }
  return null;
}

export const TreeNode = memo(function TreeNode({
  fieldKey,
  value,
  path,
  depth,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAdd,
  isReadOnly = false,
  expandedPaths,
  showTypeIndicators = true,
  isArrayItem = false,
}: TreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const fieldType = getFieldType(value);
  const isExpandable = fieldType === 'object' || fieldType === 'array';
  const childCount = getChildCountLabel(value, fieldType);
  const indent = depth * 16;

  // Handle expand/collapse
  const handleToggle = useCallback(() => {
    if (isExpandable) {
      onToggleExpand(path);
    }
  }, [isExpandable, onToggleExpand, path]);

  // Handle edit
  const handleEdit = useCallback(() => {
    if (!isReadOnly && onEdit) {
      setIsEditing(true);
    }
  }, [isReadOnly, onEdit]);

  // Handle save
  const handleSave = useCallback(
    (newValue: unknown) => {
      if (onEdit) {
        onEdit(path, newValue);
      }
      setIsEditing(false);
    },
    [onEdit, path]
  );

  // Handle copy
  const handleCopy = useCallback(() => {
    const textToCopy =
      fieldType === 'object' || fieldType === 'array'
        ? JSON.stringify(value, null, 2)
        : String(value);
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copied to clipboard');
  }, [value, fieldType]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(path);
    }
  }, [onDelete, path]);

  // Render children for objects and arrays
  const renderChildren = () => {
    if (!isExpandable || !isExpanded) return null;

    if (fieldType === 'array' && Array.isArray(value)) {
      return value.map((item, index) => {
        const childPath = `${path}[${index}]`;
        return (
          <TreeNode
            key={childPath}
            fieldKey={`[${index}]`}
            value={item}
            path={childPath}
            depth={depth + 1}
            isExpanded={expandedPaths.has(childPath)}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            onAdd={onAdd}
            isReadOnly={isReadOnly}
            expandedPaths={expandedPaths}
            showTypeIndicators={showTypeIndicators}
            isArrayItem
          />
        );
      });
    }

    if (fieldType === 'object' && typeof value === 'object' && value !== null) {
      return Object.entries(value).map(([key, val]) => {
        const childPath = `${path}.${key}`;
        return (
          <TreeNode
            key={childPath}
            fieldKey={key}
            value={val}
            path={childPath}
            depth={depth + 1}
            isExpanded={expandedPaths.has(childPath)}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            onAdd={onAdd}
            isReadOnly={isReadOnly}
            expandedPaths={expandedPaths}
            showTypeIndicators={showTypeIndicators}
          />
        );
      });
    }

    return null;
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <div
        className={cn(
          'group flex items-center gap-1 py-1 px-2 rounded-sm transition-colors',
          'hover:bg-bg-hover cursor-pointer',
          isEditing && 'bg-bg-hover'
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleToggle}
      >
        {/* Expand/collapse chevron */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {isExpandable ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
            )
          ) : null}
        </span>

        {/* Field key */}
        <span
          className={cn(
            'font-mono text-sm',
            isArrayItem ? 'text-orange-400' : 'text-text-secondary'
          )}
        >
          {fieldKey}
        </span>

        <span className="text-text-tertiary">:</span>

        {/* Value or editing */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <ValueEditor
                value={value}
                type={fieldType}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          ) : isExpandable ? (
            <>
              <span className="text-text-tertiary font-mono text-sm">
                {fieldType === 'array' ? '[' : '{'}
              </span>
              {childCount && (
                <span className="text-text-tertiary text-xs">{childCount}</span>
              )}
              {!isExpanded && (
                <span className="text-text-tertiary font-mono text-sm">
                  {fieldType === 'array' ? '...]' : '...}'}
                </span>
              )}
            </>
          ) : (
            <span
              className={cn(
                'font-mono text-sm truncate',
                getFieldTypeColor(fieldType)
              )}
              title={String(value)}
            >
              {formatValue(value, fieldType)}
            </span>
          )}
        </div>

        {/* Type indicator */}
        {showTypeIndicators && !isEditing && (
          <TypeIndicator type={fieldType} className="flex-shrink-0" />
        )}

        {/* Action buttons (visible on hover) */}
        {isHovered && !isEditing && (
          <div
            className="flex items-center gap-0.5 ml-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary transition-colors"
              title="Copy value"
            >
              <Copy className="w-3 h-3" />
            </button>

            {/* Edit button (for non-expandable values) */}
            {!isReadOnly && onEdit && !isExpandable && (
              <button
                onClick={handleEdit}
                className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary transition-colors"
                title="Edit value"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {/* Add button (for objects/arrays) */}
            {!isReadOnly && onAdd && isExpandable && (
              <button
                onClick={() => onAdd(path)}
                className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-green-400 transition-colors"
                title={fieldType === 'array' ? 'Add item' : 'Add field'}
              >
                <Plus className="w-3 h-3" />
              </button>
            )}

            {/* Delete button */}
            {!isReadOnly && onDelete && (
              <button
                onClick={handleDelete}
                className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {isExpandable && isExpanded && (
        <div className="border-l border-border/50 ml-4" style={{ marginLeft: `${indent + 16}px` }}>
          {renderChildren()}

          {/* Empty state for objects/arrays */}
          {((fieldType === 'array' && Array.isArray(value) && value.length === 0) ||
            (fieldType === 'object' &&
              typeof value === 'object' &&
              value !== null &&
              Object.keys(value).length === 0)) && (
            <div
              className="py-1 px-2 text-xs text-text-tertiary italic"
              style={{ paddingLeft: `${16}px` }}
            >
              {fieldType === 'array' ? 'Empty array' : 'Empty object'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default TreeNode;
