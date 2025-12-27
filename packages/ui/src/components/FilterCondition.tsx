import { FC, useMemo, useState } from 'react';
import type { FilterCondition as FilterConditionType, ColumnMetadata, FilterOperator } from '@dbview/types';
import { X, Search, ChevronDown, AlertCircle, Plus } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import clsx from 'clsx';
import {
  getOperatorsForType,
  OPERATOR_LABELS,
  operatorNeedsValue,
  operatorNeedsTwoValues,
  operatorNeedsCommaSeparated
} from '../utils/filterOperators';

interface FilterConditionProps {
  condition: FilterConditionType;
  columns: ColumnMetadata[];
  onUpdate: (updates: Partial<FilterConditionType>) => void;
  onRemove: () => void;
  onAddAfter: () => void;
}

export const FilterCondition: FC<FilterConditionProps> = ({
  condition,
  columns,
  onUpdate,
  onRemove,
  onAddAfter
}) => {
  const [columnSearch, setColumnSearch] = useState('');
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validation2Error, setValidation2Error] = useState<string | null>(null);

  // Get the selected column's metadata
  const selectedColumn = useMemo(() => {
    return columns.find(col => col.name === condition.columnName);
  }, [columns, condition.columnName]);

  // Filter columns by search
  const filteredColumns = useMemo(() => {
    if (!columnSearch) return columns;
    const search = columnSearch.toLowerCase();
    return columns.filter(col =>
      col.name.toLowerCase().includes(search) ||
      col.type.toLowerCase().includes(search)
    );
  }, [columns, columnSearch]);

  // Get available operators for the selected column type
  const availableOperators = useMemo(() => {
    if (!selectedColumn) return [];
    return getOperatorsForType(selectedColumn.type);
  }, [selectedColumn]);

  // Determine if value inputs should be shown
  const needsValue = operatorNeedsValue(condition.operator);
  const needsTwoValues = operatorNeedsTwoValues(condition.operator);
  const needsCommaSeparated = operatorNeedsCommaSeparated(condition.operator);

  // Validate value based on column type
  const validateValue = (value: unknown, columnType: string): string | null => {
    if (!value || value === '') return null;

    const type = columnType.toLowerCase();
    const strValue = String(value);

    if (type.includes('int') || type.includes('numeric') || type.includes('decimal') || type.includes('real')) {
      if (isNaN(Number(strValue))) {
        return 'Must be a number';
      }
    }

    if (type.includes('date') || type.includes('timestamp')) {
      if (isNaN(Date.parse(strValue))) {
        return 'Invalid date format';
      }
    }

    return null;
  };

  // Get input type based on column type
  const getInputType = (): string => {
    if (!selectedColumn) return 'text';

    // IN operator always needs text input for comma-separated values
    if (needsCommaSeparated) return 'text';

    const type = selectedColumn.type.toLowerCase();

    if (type.includes('int') || type.includes('numeric') || type.includes('decimal') || type.includes('real')) {
      return 'number';
    }

    if (type.includes('date') && !type.includes('time')) {
      return 'date';
    }

    if (type.includes('time') && !type.includes('stamp')) {
      return 'time';
    }

    if (type.includes('timestamp')) {
      return 'datetime-local';
    }

    return 'text';
  };

  const inputType = getInputType();

  // Handle column selection
  const handleColumnSelect = (columnName: string) => {
    const newColumn = columns.find(col => col.name === columnName);
    if (!newColumn) return;

    // Reset operator to first available for new column type
    const newOperators = getOperatorsForType(newColumn.type);
    const newOperator = newOperators[0] || 'equals';

    onUpdate({
      columnName,
      operator: newOperator,
      value: '',
      value2: undefined
    });
    setColumnPopoverOpen(false);
    setColumnSearch('');
    setValidationError(null);
    setValidation2Error(null);
  };

  // Handle operator change - PRESERVE VALUES if compatible
  const handleOperatorChange = (newOperator: FilterOperator) => {
    const oldNeedsValue = operatorNeedsValue(condition.operator);
    const newNeedsValue = operatorNeedsValue(newOperator);
    const oldNeedsTwoValues = operatorNeedsTwoValues(condition.operator);
    const newNeedsTwoValues = operatorNeedsTwoValues(newOperator);

    // Only reset values if value requirements fundamentally change
    if (oldNeedsValue === newNeedsValue && oldNeedsTwoValues === newNeedsTwoValues) {
      // Keep existing values
      onUpdate({ operator: newOperator });
    } else if (newNeedsValue && !newNeedsTwoValues && oldNeedsValue) {
      // Going from two values to one - keep first value
      onUpdate({ operator: newOperator, value2: undefined });
    } else {
      // Reset values
      onUpdate({ operator: newOperator, value: '', value2: undefined });
      setValidationError(null);
      setValidation2Error(null);
    }
  };

  // Handle value change with validation
  const handleValueChange = (value: string, isSecondValue = false) => {
    if (selectedColumn) {
      const error = validateValue(value, selectedColumn.type);
      if (isSecondValue) {
        setValidation2Error(error);
      } else {
        setValidationError(error);
      }
    }

    if (isSecondValue) {
      onUpdate({ value2: value });
    } else {
      onUpdate({ value });
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded border border-vscode-border bg-vscode-bg-lighter">
      {/* Column Selector with Search */}
      <Popover.Root open={columnPopoverOpen} onOpenChange={setColumnPopoverOpen}>
        <Popover.Trigger asChild>
          <button
            className={clsx(
              "flex-1 flex items-center justify-between gap-2 bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text hover:bg-vscode-bg-hover transition-colors",
              !condition.columnName && "text-vscode-text-muted"
            )}
            aria-label="Select column to filter"
          >
            <span className="truncate">
              {selectedColumn
                ? `${selectedColumn.name} (${selectedColumn.type})`
                : 'Select column...'}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-50 w-[280px] rounded-md border border-vscode-border bg-vscode-bg-light shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            sideOffset={5}
            align="start"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-vscode-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-vscode-text-muted" />
                <input
                  type="text"
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  placeholder="Search columns..."
                  className="w-full bg-vscode-bg border border-vscode-border rounded pl-7 pr-2 py-1 text-xs text-vscode-text placeholder:text-vscode-text-muted focus:outline-none focus:border-vscode-accent"
                  autoFocus
                />
              </div>
            </div>

            {/* Column List */}
            <div className="max-h-[240px] overflow-y-auto p-1">
              {filteredColumns.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-vscode-text-muted">
                  No columns found
                </div>
              ) : (
                filteredColumns.map(col => (
                  <button
                    key={col.name}
                    onClick={() => handleColumnSelect(col.name)}
                    className={clsx(
                      "w-full flex items-start gap-2 px-2 py-1.5 rounded text-left hover:bg-vscode-bg-hover transition-colors",
                      col.name === condition.columnName && "bg-vscode-accent/10"
                    )}
                  >
                    <span className="flex-1 text-xs text-vscode-text font-medium">
                      {col.name}
                    </span>
                    <span className="text-xs text-vscode-text-muted shrink-0">
                      {col.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Operator Selector */}
      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        className={clsx(
          "flex-1 bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs cursor-pointer",
          !condition.columnName
            ? "text-vscode-text-muted cursor-not-allowed"
            : "text-vscode-text hover:bg-vscode-bg-hover"
        )}
        aria-label="Select filter operator"
        disabled={!condition.columnName}
      >
        {condition.columnName ? (
          availableOperators.map(op => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))
        ) : (
          <option value="">Select operator...</option>
        )}
      </select>

      {/* Value Input(s) with Validation */}
      <>
        <div className="flex-1 flex flex-col gap-1">
          <input
            type={inputType}
            value={String(condition.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value, false)}
            placeholder={
              !condition.columnName
                ? "Value..."
                : !needsValue
                  ? "N/A"
                  : needsCommaSeparated
                    ? "value1, value2, value3..."
                    : "Value..."
            }
            aria-label="Filter value"
            disabled={!condition.columnName || !needsValue}
            className={clsx(
              "w-full bg-vscode-bg border rounded px-2 py-1 text-xs placeholder:text-vscode-text-muted focus:outline-none",
              !condition.columnName || !needsValue
                ? "text-vscode-text-muted cursor-not-allowed"
                : "text-vscode-text",
              validationError
                ? "border-vscode-error focus:border-vscode-error"
                : "border-vscode-border focus:border-vscode-accent"
            )}
          />
          {validationError && (
            <div className="flex items-center gap-1 text-xs text-vscode-error">
              <AlertCircle className="h-3 w-3" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {needsTwoValues && (
          <>
            <span className="text-xs text-vscode-text-muted">and</span>
            <div className="flex-1 flex flex-col gap-1">
              <input
                type={inputType}
                value={String(condition.value2 ?? '')}
                onChange={(e) => handleValueChange(e.target.value, true)}
                placeholder="Value 2..."
                aria-label="Filter second value"
                disabled={!condition.columnName}
                className={clsx(
                  "w-full bg-vscode-bg border rounded px-2 py-1 text-xs placeholder:text-vscode-text-muted focus:outline-none",
                  !condition.columnName
                    ? "text-vscode-text-muted cursor-not-allowed"
                    : "text-vscode-text",
                  validation2Error
                    ? "border-vscode-error focus:border-vscode-error"
                    : "border-vscode-border focus:border-vscode-accent"
                )}
              />
              {validation2Error && (
                <div className="flex items-center gap-1 text-xs text-vscode-error">
                  <AlertCircle className="h-3 w-3" />
                  <span>{validation2Error}</span>
                </div>
              )}
            </div>
          </>
        )}
      </>

      {/* Add After Button */}
      <button
        onClick={onAddAfter}
        className="p-1 rounded text-vscode-text-muted hover:text-vscode-accent hover:bg-vscode-bg-hover transition-colors"
        title="Add condition below"
        aria-label="Add filter condition below this one"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="p-1 rounded text-vscode-text-muted hover:text-vscode-error hover:bg-vscode-bg-hover transition-colors"
        title="Remove condition"
        aria-label="Remove filter condition"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
