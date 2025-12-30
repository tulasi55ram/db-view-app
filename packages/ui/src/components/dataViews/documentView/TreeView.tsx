/**
 * TreeView
 *
 * Hierarchical tree view for displaying JSON documents.
 * Supports expand/collapse and type indicators.
 */

import { useCallback, useMemo, type FC } from 'react';
import { FoldVertical, UnfoldVertical } from 'lucide-react';
import clsx from 'clsx';
import { TreeNode } from './TreeNode';

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
  /** Whether editing is disabled */
  isReadOnly?: boolean;
  /** Whether to show type indicators */
  showTypeIndicators?: boolean;
  /** Root path prefix */
  rootPath?: string;
  /** Optional class name */
  className?: string;
}

export const TreeView: FC<TreeViewProps> = ({
  data,
  expandedPaths,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  isReadOnly = false,
  showTypeIndicators = true,
  rootPath = 'root',
  className,
}) => {
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
    return topLevelPaths.length > 0 && topLevelPaths.every((path) => expandedPaths.has(path));
  }, [data, expandedPaths, rootPath]);

  // Render the document root
  const renderDocument = useCallback(() => {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-vscode-text-muted">
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
    isReadOnly,
    showTypeIndicators,
  ]);

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-vscode-border bg-vscode-bg-light">
        <div className="flex items-center gap-2">
          <span className="text-xs text-vscode-text-muted">
            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={allExpanded ? onCollapseAll : onExpandAll}
            className="p-1 rounded hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            {allExpanded ? (
              <FoldVertical className="w-3.5 h-3.5" />
            ) : (
              <UnfoldVertical className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto py-2">{renderDocument()}</div>
    </div>
  );
};

export default TreeView;
