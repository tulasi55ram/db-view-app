import { FC } from 'react';
import type { FilterCondition as FilterConditionType, ColumnMetadata } from '@dbview/types';
import { Search as SearchIcon, Loader2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { FilterCondition } from './FilterCondition';

interface FilterBuilderProps {
  columns: ColumnMetadata[];
  conditions: FilterConditionType[];
  logicOperator: 'AND' | 'OR';
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

  return (
    <div className="border-b border-vscode-border bg-vscode-bg-light">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-vscode-border/50">
        <h3 className="text-sm font-medium text-vscode-text">Advanced Filters</h3>
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-96 overflow-y-auto px-4 py-3">
        {/* Logic Operator Toggle (only show when multiple conditions) */}
        {showLogicOperator && (
          <div className="mb-3 flex items-center gap-2 bg-vscode-bg-lighter rounded p-2 border border-vscode-border">
            <span className="text-xs text-vscode-text-muted font-medium">Match:</span>
            <div className="flex gap-1">
              <button
                onClick={() => onLogicOperatorChange('AND')}
                className={clsx(
                  "px-3 py-1 text-xs rounded font-medium transition-colors",
                  logicOperator === 'AND'
                    ? "bg-vscode-accent text-white"
                    : "bg-vscode-bg text-vscode-text-muted hover:bg-vscode-bg-hover"
                )}
                title="All conditions must match (AND)"
              >
                All conditions (AND)
              </button>
              <button
                onClick={() => onLogicOperatorChange('OR')}
                className={clsx(
                  "px-3 py-1 text-xs rounded font-medium transition-colors",
                  logicOperator === 'OR'
                    ? "bg-vscode-accent text-white"
                    : "bg-vscode-bg text-vscode-text-muted hover:bg-vscode-bg-hover"
                )}
                title="Any condition can match (OR)"
              >
                Any condition (OR)
              </button>
            </div>
          </div>
        )}

        {/* Filter Conditions */}
        {hasConditions && (
          <div className="space-y-2">
            {conditions.map((condition) => (
              <FilterCondition
                key={condition.id}
                condition={condition}
                columns={columns}
                onUpdate={(updates) => onUpdateCondition(condition.id, updates)}
                onRemove={() => onRemoveCondition(condition.id)}
                onAddAfter={() => onAddAfter(condition.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions Bar - Fixed at bottom */}
      {hasConditions && (
        <div className="px-4 py-3 border-t border-vscode-border bg-vscode-bg-light">
          {/* Result count */}
          <div className="flex items-center gap-2 mb-3">
            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-vscode-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Filtering...</span>
              </div>
            ) : totalRows !== null && totalRows !== undefined ? (
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3 w-3 text-vscode-success" />
                <span className="font-medium text-vscode-text">
                  {formatRowCount(totalRows)}
                </span>
                <span className="text-vscode-text-muted">
                  row{totalRows !== 1 ? 's' : ''} match
                </span>
              </div>
            ) : null}

            {/* Filter summary */}
            {(totalRows !== null && totalRows !== undefined) && (
              <>
                <span className="text-xs text-vscode-text-muted">•</span>
                <span className="text-xs text-vscode-text-muted">
                  {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-xs rounded bg-vscode-bg-lighter text-vscode-text hover:bg-vscode-bg-hover transition-colors"
              title="Clear all filters (Esc)"
            >
              Clear All
            </button>
            <button
              onClick={onSearch}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded bg-vscode-accent text-white hover:bg-vscode-accent-hover transition-colors font-medium"
              title="Apply filters and view results"
              disabled={loading}
            >
              <SearchIcon className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
              {loading ? "Applying..." : "Apply & View Results"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
