/**
 * QueryFilterBuilder
 *
 * Visual query builder for MongoDB/Elasticsearch queries.
 * Allows users to build filter conditions without writing JSON.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  Filter,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/primitives/Popover';
import { IconButton } from '@/primitives';
import { Tooltip } from '@/primitives/Tooltip';
import { cn } from '@/utils/cn';
import type { DocumentDbType } from '../types';

// Operator types for different value types
type StringOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
type NumberOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'gte' | 'lte' | 'between';
type BooleanOperator = 'equals' | 'not_equals';
type ArrayOperator = 'contains' | 'not_contains' | 'is_empty' | 'not_empty' | 'size_equals';
type ExistsOperator = 'exists' | 'not_exists';

type Operator = StringOperator | NumberOperator | BooleanOperator | ArrayOperator | ExistsOperator;

export interface FilterCondition {
  id: string;
  field: string;
  operator: Operator;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'date';
}

interface QueryFilterBuilderProps {
  /** Whether the builder panel is open */
  open: boolean;
  /** Callback when panel opens/closes */
  onOpenChange: (open: boolean) => void;
  /** Database type for customization */
  dbType: DocumentDbType;
  /** Known fields from documents (for autocomplete) */
  knownFields?: string[];
  /** Current filter conditions */
  conditions: FilterCondition[];
  /** Callback when conditions change */
  onConditionsChange: (conditions: FilterCondition[]) => void;
  /** Callback when filter is applied */
  onApply: (query: Record<string, unknown>) => void;
  /** Whether filter is being applied */
  isApplying?: boolean;
  /** Whether a filter is currently active */
  hasActiveFilter?: boolean;
  /** Callback to clear filter */
  onClearFilter?: () => void;
}

// Operators for each value type
const OPERATORS: Record<string, { value: Operator; label: string }[]> = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'regex', label: 'matches regex' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'gte', label: '>= (gte)' },
    { value: 'lte', label: '<= (lte)' },
  ],
  boolean: [
    { value: 'equals', label: 'equals' },
  ],
  date: [
    { value: 'equals', label: 'equals' },
    { value: 'greater_than', label: 'after' },
    { value: 'less_than', label: 'before' },
    { value: 'gte', label: 'on or after' },
    { value: 'lte', label: 'on or before' },
  ],
  exists: [
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
};

/**
 * Generate a unique ID for conditions
 */
function generateId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse a value string to the appropriate type
 */
function parseValue(value: string, valueType: FilterCondition['valueType']): unknown {
  switch (valueType) {
    case 'number':
      return parseFloat(value);
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'null':
      return null;
    case 'date':
      return new Date(value).toISOString();
    default:
      return value;
  }
}

/**
 * Build MongoDB query from conditions
 */
function buildMongoQuery(conditions: FilterCondition[]): Record<string, unknown> {
  if (conditions.length === 0) return {};

  const query: Record<string, unknown> = {};

  for (const condition of conditions) {
    if (!condition.field) continue;

    const parsedValue = parseValue(condition.value, condition.valueType);

    switch (condition.operator) {
      case 'equals':
        query[condition.field] = parsedValue;
        break;
      case 'not_equals':
        query[condition.field] = { $ne: parsedValue };
        break;
      case 'contains':
        query[condition.field] = { $regex: condition.value, $options: 'i' };
        break;
      case 'starts_with':
        query[condition.field] = { $regex: `^${condition.value}`, $options: 'i' };
        break;
      case 'ends_with':
        query[condition.field] = { $regex: `${condition.value}$`, $options: 'i' };
        break;
      case 'regex':
        query[condition.field] = { $regex: condition.value };
        break;
      case 'greater_than':
        query[condition.field] = { $gt: parsedValue };
        break;
      case 'less_than':
        query[condition.field] = { $lt: parsedValue };
        break;
      case 'gte':
        query[condition.field] = { $gte: parsedValue };
        break;
      case 'lte':
        query[condition.field] = { $lte: parsedValue };
        break;
      case 'exists':
        query[condition.field] = { $exists: true };
        break;
      case 'not_exists':
        query[condition.field] = { $exists: false };
        break;
    }
  }

  return query;
}

/**
 * Build Elasticsearch query from conditions
 */
function buildElasticsearchQuery(conditions: FilterCondition[]): Record<string, unknown> {
  if (conditions.length === 0) return { match_all: {} };

  const must: unknown[] = [];
  const mustNot: unknown[] = [];

  for (const condition of conditions) {
    if (!condition.field) continue;

    const parsedValue = parseValue(condition.value, condition.valueType);

    switch (condition.operator) {
      case 'equals':
        must.push({ term: { [condition.field]: parsedValue } });
        break;
      case 'not_equals':
        mustNot.push({ term: { [condition.field]: parsedValue } });
        break;
      case 'contains':
        must.push({ match: { [condition.field]: condition.value } });
        break;
      case 'starts_with':
        must.push({ prefix: { [condition.field]: condition.value.toLowerCase() } });
        break;
      case 'regex':
        must.push({ regexp: { [condition.field]: condition.value } });
        break;
      case 'greater_than':
        must.push({ range: { [condition.field]: { gt: parsedValue } } });
        break;
      case 'less_than':
        must.push({ range: { [condition.field]: { lt: parsedValue } } });
        break;
      case 'gte':
        must.push({ range: { [condition.field]: { gte: parsedValue } } });
        break;
      case 'lte':
        must.push({ range: { [condition.field]: { lte: parsedValue } } });
        break;
      case 'exists':
        must.push({ exists: { field: condition.field } });
        break;
      case 'not_exists':
        mustNot.push({ exists: { field: condition.field } });
        break;
    }
  }

  if (must.length === 0 && mustNot.length === 0) {
    return { match_all: {} };
  }

  return {
    bool: {
      ...(must.length > 0 && { must }),
      ...(mustNot.length > 0 && { must_not: mustNot }),
    },
  };
}

export function QueryFilterBuilder({
  open,
  onOpenChange,
  dbType,
  knownFields = [],
  conditions,
  onConditionsChange,
  onApply,
  isApplying = false,
  hasActiveFilter = false,
  onClearFilter,
}: QueryFilterBuilderProps) {
  const [showFieldSuggestions, setShowFieldSuggestions] = useState<string | null>(null);
  const [queryPreview, setQueryPreview] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Add a default condition when popover opens with no conditions
  useEffect(() => {
    if (open && conditions.length === 0) {
      const defaultCondition: FilterCondition = {
        id: generateId(),
        field: knownFields[0] || '',
        operator: 'equals',
        value: '',
        valueType: 'string',
      };
      onConditionsChange([defaultCondition]);
    }
  }, [open]); // Only run when open changes

  // Focus the first field input when popover opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        firstFieldRef.current?.focus();
        firstFieldRef.current?.select();
      }, 100);
    }
  }, [open]);

  // Add new condition
  const handleAddCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: generateId(),
      field: '',
      operator: 'equals',
      value: '',
      valueType: 'string',
    };
    onConditionsChange([...conditions, newCondition]);
  }, [conditions, onConditionsChange]);

  // Remove condition
  const handleRemoveCondition = useCallback(
    (id: string) => {
      onConditionsChange(conditions.filter((c) => c.id !== id));
    },
    [conditions, onConditionsChange]
  );

  // Update condition
  const handleUpdateCondition = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      onConditionsChange(
        conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    [conditions, onConditionsChange]
  );

  // Filter known fields based on input
  const getFieldSuggestions = useCallback(
    (input: string) => {
      if (!input) return knownFields.slice(0, 10);
      const lower = input.toLowerCase();
      return knownFields.filter((f) => f.toLowerCase().includes(lower)).slice(0, 10);
    },
    [knownFields]
  );

  // Build query
  const buildQuery = useCallback(() => {
    try {
      setPreviewError(null);
      const query =
        dbType === 'elasticsearch'
          ? buildElasticsearchQuery(conditions)
          : buildMongoQuery(conditions);
      setQueryPreview(JSON.stringify(query, null, 2));
      return query;
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Invalid query');
      return null;
    }
  }, [dbType, conditions]);

  // Generate preview when conditions change
  useMemo(() => {
    buildQuery();
  }, [buildQuery]);

  // Apply filter
  const handleApply = useCallback(() => {
    const query = buildQuery();
    if (query) {
      onApply(query);
      onOpenChange(false);
    }
  }, [buildQuery, onApply, onOpenChange]);

  // Clear all conditions
  const handleClear = useCallback(() => {
    onConditionsChange([]);
  }, [onConditionsChange]);

  return (
    <div className="flex items-center gap-1">
      {/* Filter Popover */}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <div>
            <Tooltip content={hasActiveFilter ? 'Edit filter' : 'Add filter'}>
              <IconButton
                icon={<Filter className="w-4 h-4" />}
                size="sm"
                aria-label="Filter documents"
                className={cn(hasActiveFilter && 'bg-accent/15 text-accent')}
              />
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-[600px] max-h-[70vh] flex flex-col p-0"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-text-primary">Query Builder</h3>
              <span className="text-xs text-text-tertiary">
                ({dbType === 'mongodb' ? 'MongoDB' : dbType === 'elasticsearch' ? 'Elasticsearch' : 'Cassandra'})
              </span>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conditions */}
          <div className="flex-1 overflow-auto p-4 space-y-2 max-h-[40vh]">
        {conditions.map((condition, index) => (
            <div
              key={condition.id}
              className="flex items-center gap-2 p-2 rounded bg-bg-secondary border border-border"
            >
              {/* AND label for subsequent conditions */}
              {index > 0 && (
                <span className="text-xs text-text-tertiary font-medium px-1">AND</span>
              )}

              {/* Field input */}
              <div className="relative flex-1">
                <input
                  ref={index === 0 ? firstFieldRef : undefined}
                  type="text"
                  value={condition.field}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, { field: e.target.value })
                  }
                  onFocus={() => setShowFieldSuggestions(condition.id)}
                  onBlur={() => setTimeout(() => setShowFieldSuggestions(null), 200)}
                  placeholder="Field name"
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {/* Field suggestions dropdown */}
                {showFieldSuggestions === condition.id && knownFields.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border rounded shadow-lg z-10 max-h-40 overflow-auto">
                    {getFieldSuggestions(condition.field).map((field) => (
                      <button
                        key={field}
                        onClick={() => {
                          handleUpdateCondition(condition.id, { field });
                          setShowFieldSuggestions(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm font-mono hover:bg-bg-hover text-text-primary"
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Operator select */}
              <div className="relative w-32">
                <select
                  value={condition.operator}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, { operator: e.target.value as Operator })
                  }
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-accent pr-8"
                >
                  {OPERATORS[condition.valueType || 'string']?.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                  <optgroup label="Exists">
                    {OPERATORS.exists.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              </div>

              {/* Value type select */}
              <div className="relative w-24">
                <select
                  value={condition.valueType}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, {
                      valueType: e.target.value as FilterCondition['valueType'],
                    })
                  }
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-accent pr-8"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="date">date</option>
                  <option value="null">null</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              </div>

              {/* Value input */}
              {!['exists', 'not_exists'].includes(condition.operator) && (
                <input
                  type={
                    condition.valueType === 'number'
                      ? 'number'
                      : condition.valueType === 'date'
                      ? 'date'
                      : 'text'
                  }
                  value={condition.value}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, { value: e.target.value })
                  }
                  placeholder={
                    condition.valueType === 'boolean' ? 'true or false' : 'value'
                  }
                  className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              )}

              {/* Remove button - only show if more than one condition */}
              {conditions.length > 1 && (
                <button
                  onClick={() => handleRemoveCondition(condition.id)}
                  className="p-1.5 rounded hover:bg-error/10 text-text-tertiary hover:text-error transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

        {/* Add condition button */}
        <button
          onClick={handleAddCondition}
          className="w-full flex items-center justify-center gap-2 py-2 rounded border border-dashed border-border hover:border-accent hover:bg-accent/5 text-text-secondary hover:text-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add condition
        </button>
      </div>

          {/* Query preview */}
          {conditions.length > 0 && (
            <div className="mx-4 mb-2 p-2 bg-bg-tertiary rounded border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-tertiary">Query Preview</span>
                {previewError && (
                  <span className="text-xs text-error flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {previewError}
                  </span>
                )}
              </div>
              <pre className="text-xs font-mono text-text-secondary bg-bg-primary p-2 rounded overflow-x-auto max-h-20">
                {queryPreview}
              </pre>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-bg-secondary">
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={conditions.length === 0}>
              Clear all
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApply}
                disabled={isApplying || conditions.length === 0 || !!previewError}
              >
                {isApplying ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5" />
                    Apply Filter
                  </span>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear filter button (shown when filter is active) */}
      {hasActiveFilter && onClearFilter && (
        <Tooltip content="Clear filter">
          <button
            onClick={onClearFilter}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
          >
            <X className="w-3 h-3" />
            Filtered
          </button>
        </Tooltip>
      )}
    </div>
  );
}

export default QueryFilterBuilder;
