import { FC } from 'react';
import type { FilterCondition } from '@dbview/core';
import { X, Filter, ChevronRight, Edit } from 'lucide-react';
import { OPERATOR_LABELS } from '../utils/filterOperators';
import clsx from 'clsx';

interface QuickFilterBarProps {
  conditions: FilterCondition[];
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
  onOpenFilters: () => void;
  totalRows?: number | null;
  filteredRows?: number | null;
}

export const QuickFilterBar: FC<QuickFilterBarProps> = ({
  conditions,
  onRemoveFilter,
  onClearAll,
  onOpenFilters,
  totalRows,
  filteredRows,
}) => {
  const hasFilters = conditions.length > 0;

  return (
    <div className="flex items-center gap-2 border-b border-vscode-border bg-vscode-bg-light/30 px-4 py-2">
      {/* Filter Chips */}
      {hasFilters && (
        <>
          <div className="flex items-center gap-1 text-xs text-vscode-text-muted">
            <Filter className="h-3 w-3" />
            <span className="font-medium">Active filters:</span>
          </div>

          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {conditions.map((condition) => (
              <FilterChip
                key={condition.id}
                condition={condition}
                onRemove={() => onRemoveFilter(condition.id)}
              />
            ))}
          </div>

          <button
            onClick={onOpenFilters}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text-muted hover:text-vscode-accent transition-colors"
            title="Edit filters"
          >
            <Edit className="h-3 w-3" />
            <span>Edit</span>
          </button>

          <button
            onClick={onClearAll}
            className="flex-shrink-0 text-xs text-vscode-text-muted hover:text-vscode-error transition-colors"
          >
            Clear all
          </button>
        </>
      )}

      {/* Add Filter Button (when no filters) */}
      {!hasFilters && (
        <button
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 text-xs text-vscode-text-muted hover:text-vscode-accent transition-colors"
        >
          <Filter className="h-3 w-3" />
          <span>Add filter</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Results Count */}
      {totalRows !== null && totalRows !== undefined && (
        <div className="flex-shrink-0 ml-auto flex items-center gap-2 text-xs">
          {filteredRows !== null && filteredRows !== undefined && filteredRows !== totalRows ? (
            <span className="text-vscode-accent font-medium">
              {filteredRows.toLocaleString()} of {totalRows.toLocaleString()} rows
            </span>
          ) : (
            <span className="text-vscode-text-muted">
              {totalRows.toLocaleString()} rows
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Filter Chip Component
interface FilterChipProps {
  condition: FilterCondition;
  onRemove: () => void;
}

const FilterChip: FC<FilterChipProps> = ({ condition, onRemove }) => {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string' && value.length > 20) return value.substring(0, 20) + '...';
    return String(value);
  };

  const operatorLabel = OPERATOR_LABELS[condition.operator] || condition.operator;
  const needsValue = condition.operator !== 'is_null' && condition.operator !== 'is_not_null';

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 rounded-full border border-vscode-accent/50 bg-vscode-accent/10 px-2.5 py-1',
        'text-xs text-vscode-accent group hover:border-vscode-accent transition-colors'
      )}
    >
      <span className="font-medium">{condition.columnName}</span>
      <span className="opacity-75">{operatorLabel.toLowerCase()}</span>
      {needsValue && <span className="font-semibold">"{formatValue(condition.value)}"</span>}
      {condition.operator === 'between' && condition.value2 !== undefined && (
        <>
          <span className="opacity-75">and</span>
          <span className="font-semibold">"{formatValue(condition.value2)}"</span>
        </>
      )}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-vscode-accent/20 transition-colors"
        title="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};
