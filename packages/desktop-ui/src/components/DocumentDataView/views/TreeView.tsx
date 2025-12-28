/**
 * TreeView
 *
 * Hierarchical tree view for displaying and editing JSON documents.
 * Supports expand/collapse, inline editing, and keyboard navigation.
 */

import { useCallback, useMemo } from 'react';
import { FoldVertical, UnfoldVertical } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TreeNode } from '../components/TreeNode';
import { IconButton } from '@/primitives';
import { Tooltip } from '@/primitives/Tooltip';

interface TreeViewProps {
  /** Document data to display */
  data: Record<string, unknown>;
  /** Set of expanded paths */
  expandedPaths: Set<string>;
  /** Callback to toggle path expansion */
  onToggleExpand: (path: string) => void;
  /** Callback to expand all paths */
  onExpandAll: () => void;
  /** Callback to collapse all paths */
  onCollapseAll: () => void;
  /** Callback when a value is edited */
  onEdit?: (path: string, newValue: unknown) => void;
  /** Callback when a field is deleted */
  onDelete?: (path: string) => void;
  /** Callback when a field is added */
  onAdd?: (path: string) => void;
  /** Whether editing is disabled */
  isReadOnly?: boolean;
  /** Whether to show type indicators */
  showTypeIndicators?: boolean;
  /** Root path prefix */
  rootPath?: string;
  /** Optional class name */
  className?: string;
}

export function TreeView({
  data,
  expandedPaths,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  onEdit,
  onDelete,
  onAdd,
  isReadOnly = false,
  showTypeIndicators = true,
  rootPath = 'root',
  className,
}: TreeViewProps) {
  // Calculate total field count for the document
  const fieldCount = useMemo(() => {
    const countFields = (obj: unknown, depth = 0): number => {
      if (depth > 10) return 0; // Prevent infinite recursion
      if (Array.isArray(obj)) {
        return obj.reduce((sum, item) => sum + 1 + countFields(item, depth + 1), 0);
      }
      if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj).reduce(
          (sum, [, value]) => sum + 1 + countFields(value, depth + 1),
          0
        );
      }
      return 0;
    };
    return countFields(data);
  }, [data]);

  // Check if all top-level fields are expanded
  const allExpanded = useMemo(() => {
    const topLevelPaths = Object.keys(data).map((key) => `${rootPath}.${key}`);
    return topLevelPaths.every((path) => expandedPaths.has(path));
  }, [data, expandedPaths, rootPath]);

  // Render the document root
  const renderDocument = useCallback(() => {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-text-tertiary">
          <p className="text-sm italic">Empty document</p>
        </div>
      );
    }

    return entries.map(([key, value]) => {
      const path = `${rootPath}.${key}`;
      return (
        <TreeNode
          key={path}
          fieldKey={key}
          value={value}
          path={path}
          depth={0}
          isExpanded={expandedPaths.has(path)}
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
  }, [
    data,
    rootPath,
    expandedPaths,
    onToggleExpand,
    onEdit,
    onDelete,
    onAdd,
    isReadOnly,
    showTypeIndicators,
  ]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">
            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content={allExpanded ? 'Collapse all' : 'Expand all'}>
            <IconButton
              icon={
                allExpanded ? (
                  <FoldVertical className="w-3.5 h-3.5" />
                ) : (
                  <UnfoldVertical className="w-3.5 h-3.5" />
                )
              }
              size="sm"
              onClick={allExpanded ? onCollapseAll : onExpandAll}
              aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
            />
          </Tooltip>
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto py-2">{renderDocument()}</div>
    </div>
  );
}

export default TreeView;
