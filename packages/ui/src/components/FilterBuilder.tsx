import { FC, useEffect, useCallback } from 'react';
import type { FilterCondition as FilterConditionType, ColumnMetadata } from '@dbview/types';
import { Search as SearchIcon, Loader2, CheckCircle2, Filter, Plus } from 'lucide-react';
import clsx from 'clsx';
import { FilterCondition } from './FilterCondition';

interface FilterBuilderProps {
  columns: ColumnMetadata[];
  conditions: FilterConditionType[];
  logicOperator: 'AND' | 'OR';
  onAddCondition?: () => void;
  onAddAfter: (id: string) => void;
  onRemoveCondition: (id: string) => void;
  onUpdateCondition: (id: string, updates: Partial<FilterConditionType>) => void;
  onClearAll: () => void;
  onLogicOperatorChange: (op: 'AND' | 'OR') => void;
  onSearch: () => void;
  totalRows?: number | null;
  loading?: boolean;
}

export const FilterBuilder: FC<FilterBuilderProps> = ({
  columns,
  conditions,
  logicOperator,
  onAddCondition,
  onAddAfter,
  onRemoveCondition,
  onUpdateCondition,
  onClearAll,
  onLogicOperatorChange,
  onSearch,
  totalRows,
  loading = false
}) => {
  const hasConditions = conditions.length > 0;
  const showLogicOperator = hasConditions && conditions.length > 1;

  // Format row count for display
  const formatRowCount = (count: number | null | undefined): string => {
    if (count === null || count === undefined) return '—';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Enter to apply filters
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && hasConditions) {
      e.preventDefault();
      onSearch();
    }
    // Escape to clear all
    if (e.key === 'Escape' && hasConditions) {
      e.preventDefault();
      onClearAll();
    }
  }, [hasConditions, onSearch, onClearAll]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="border-b border-vscode-border bg-vscode-bg-light">
      {/* Header with Add button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-vscode-accent" />
          <h3 className="text-sm font-medium text-vscode-text">Advanced Filters</h3>
          {hasConditions && (
            <span className="px-1.5 py-0.5 text-2xs rounded bg-vscode-accent/20 text-vscode-accent">
              {conditions.length}
            </span>
          )}
        </div>
        {onAddCondition && (
          <button
            onClick={onAddCondition}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-text transition-colors"
            title="Add filter condition"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-80 overflow-y-auto">
        {/* Empty state */}
        {!hasConditions && (
          <div className="px-4 py-8 text-center">
            <Filter className="h-8 w-8 text-vscode-text-muted/50 mx-auto mb-3" />
            <p className="text-sm text-vscode-text-muted mb-1">No filters applied</p>
            <p className="text-xs text-vscode-text-muted/70">
              Click "Add" or use the column headers to filter data
            </p>
          </div>
        )}

        {hasConditions && (
          <div className="p-3 space-y-2">
            {/* Logic Operator Toggle */}
            {showLogicOperator && (
              <div className="flex items-center gap-2 p-2 rounded bg-vscode-bg border border-vscode-border/50">
                <span className="text-2xs text-vscode-text-muted uppercase tracking-wide font-medium">Match</span>
                <div className="flex rounded overflow-hidden border border-vscode-border">
                  <button
                    onClick={() => onLogicOperatorChange('AND')}
                    className={clsx(
                      "px-2.5 py-1 text-2xs font-medium transition-colors",
                      logicOperator === 'AND'
                        ? "bg-vscode-accent text-white"
                        : "bg-vscode-bg text-vscode-text-muted hover:bg-vscode-bg-hover"
                    )}
                    title="All conditions must match"
                  >
                    ALL (AND)
                  </button>
                  <button
                    onClick={() => onLogicOperatorChange('OR')}
                    className={clsx(
                      "px-2.5 py-1 text-2xs font-medium transition-colors border-l border-vscode-border",
                      logicOperator === 'OR'
                        ? "bg-vscode-accent text-white"
                        : "bg-vscode-bg text-vscode-text-muted hover:bg-vscode-bg-hover"
                    )}
                    title="Any condition can match"
                  >
                    ANY (OR)
                  </button>
                </div>
              </div>
            )}

            {/* Filter Conditions */}
            {conditions.map((condition, index) => (
              <div key={condition.id}>
                {index > 0 && showLogicOperator && (
                  <div className="flex items-center gap-2 py-1 px-2">
                    <div className="flex-1 h-px bg-vscode-border/50" />
                    <span className="text-2xs text-vscode-text-muted font-medium">
                      {logicOperator}
                    </span>
                    <div className="flex-1 h-px bg-vscode-border/50" />
                  </div>
                )}
                <FilterCondition
                  condition={condition}
                  columns={columns}
                  onUpdate={(updates) => onUpdateCondition(condition.id, updates)}
                  onRemove={() => onRemoveCondition(condition.id)}
                  onAddAfter={() => onAddAfter(condition.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions Bar - Fixed at bottom */}
      {hasConditions && (
        <div className="px-4 py-3 border-t border-vscode-border bg-vscode-bg-lighter/50">
          {/* Result count and summary */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="flex items-center gap-1.5 text-xs text-vscode-text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Filtering...</span>
                </div>
              ) : totalRows !== null && totalRows !== undefined ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-vscode-success" />
                  <span className="font-semibold text-vscode-text">
                    {formatRowCount(totalRows)}
                  </span>
                  <span className="text-vscode-text-muted">
                    row{totalRows !== 1 ? 's' : ''} match
                  </span>
                </div>
              ) : null}
            </div>
            <span className="text-2xs text-vscode-text-muted">
              {conditions.length} filter{conditions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-xs rounded bg-vscode-bg border border-vscode-border text-vscode-text hover:bg-vscode-bg-hover transition-colors"
              title="Clear all filters (Esc)"
            >
              Clear All
            </button>
            <button
              onClick={onSearch}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs rounded font-medium transition-colors",
                "bg-vscode-accent text-white hover:bg-vscode-accent/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Apply filters (Ctrl+Enter)"
              disabled={loading}
            >
              <SearchIcon className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
              {loading ? "Applying..." : "Apply Filters"}
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="mt-2 text-center">
            <span className="text-2xs text-vscode-text-muted">
              <kbd className="px-1 py-0.5 bg-vscode-bg rounded border border-vscode-border text-2xs">Ctrl+Enter</kbd>
              {' '}to apply • {' '}
              <kbd className="px-1 py-0.5 bg-vscode-bg rounded border border-vscode-border text-2xs">Esc</kbd>
              {' '}to clear
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
