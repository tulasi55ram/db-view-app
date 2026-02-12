import { useState, useCallback, useEffect, useRef } from "react";
import { X, Plus, Filter } from "lucide-react";
import type { FilterCondition, ColumnMetadata, FilterOperator } from "@dbview/types";
import { generateUniqueId } from "@/utils/generateId";

interface FilterBuilderProps {
  columns: ColumnMetadata[];
  onApply: (filters: FilterCondition[], logic: "AND" | "OR") => void;
  initialFilters?: FilterCondition[];
  initialLogic?: "AND" | "OR";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "Equals (=)" },
  { value: "not_equals", label: "Not Equals (!=)" },
  { value: "greater_than", label: "Greater Than (>)" },
  { value: "greater_or_equal", label: "Greater or Equal (>=)" },
  { value: "less_than", label: "Less Than (<)" },
  { value: "less_or_equal", label: "Less or Equal (<=)" },
  { value: "contains", label: "Contains (LIKE)" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "in", label: "In List (IN)" },
  { value: "between", label: "Between" },
  { value: "is_null", label: "Is NULL" },
  { value: "is_not_null", label: "Is Not NULL" },
];

export function FilterBuilder({ columns, onApply, initialFilters = [], initialLogic = "AND", open, onOpenChange }: FilterBuilderProps) {
  const [filters, setFilters] = useState<FilterCondition[]>(
    initialFilters.length > 0
      ? initialFilters
      : [{ id: generateUniqueId('filter'), columnName: columns[0]?.name || "", operator: "equals", value: "" }]
  );
  const [logic, setLogic] = useState<"AND" | "OR">(initialLogic);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Track the last applied initialFilters to prevent unnecessary updates
  const lastInitialFiltersRef = useRef<FilterCondition[]>(initialFilters);
  const lastInitialLogicRef = useRef<"AND" | "OR">(initialLogic);

  // Sync internal state when props change (e.g., when filters are removed via chips or loaded from preset)
  // Only update if the content actually changed (not just reference)
  useEffect(() => {
    const filtersChanged =
      lastInitialFiltersRef.current.length !== initialFilters.length ||
      lastInitialFiltersRef.current.some((filter, index) => {
        const newFilter = initialFilters[index];
        return !newFilter ||
          filter.id !== newFilter.id ||
          filter.columnName !== newFilter.columnName ||
          filter.operator !== newFilter.operator ||
          filter.value !== newFilter.value ||
          filter.value2 !== newFilter.value2;
      });

    const logicChanged = lastInitialLogicRef.current !== initialLogic;

    if (filtersChanged) {
      lastInitialFiltersRef.current = initialFilters;
      if (initialFilters.length > 0) {
        setFilters(initialFilters);
      } else {
        setFilters([{ id: generateUniqueId('filter'), columnName: columns[0]?.name || "", operator: "equals", value: "" }]);
      }
    }

    if (logicChanged) {
      lastInitialLogicRef.current = initialLogic;
      setLogic(initialLogic);
    }
  }, [initialFilters, initialLogic, columns]);

  // Fix filters with empty columnName when columns become available
  useEffect(() => {
    if (columns.length > 0) {
      setFilters(prev => {
        const needsUpdate = prev.some(f => !f.columnName || f.columnName === "");
        if (needsUpdate) {
          return prev.map(f =>
            (!f.columnName || f.columnName === "")
              ? { ...f, columnName: columns[0].name }
              : f
          );
        }
        return prev;
      });
    }
  }, [columns]);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalIsOpen(value);
    }
  };

  const addFilterAfter = useCallback((index: number) => {
    const newFilter = { id: generateUniqueId('filter'), columnName: columns[0]?.name || "", operator: "equals" as FilterOperator, value: "" };
    const newFilters = [...filters];
    newFilters.splice(index + 1, 0, newFilter);
    setFilters(newFilters);
  }, [filters, columns]);

  const removeFilter = useCallback(
    (index: number) => {
      if (filters.length > 1) {
        setFilters(filters.filter((_, i) => i !== index));
      }
    },
    [filters]
  );

  const updateFilter = useCallback(
    (index: number, field: keyof FilterCondition, value: unknown) => {
      const newFilters = [...filters];
      newFilters[index] = { ...newFilters[index], [field]: value };
      setFilters(newFilters);
    },
    [filters]
  );

  const handleApply = useCallback(() => {
    /**
     * Check if a filter value is considered "set" (has a meaningful value).
     * Allows 0, false, and other falsy values that are valid filter inputs.
     * Only treats empty string, null, and undefined as "no value".
     */
    const hasValue = (value: unknown): boolean => {
      return value !== '' && value !== null && value !== undefined;
    };

    // Filter out incomplete filters
    const validFilters = filters.filter((f) => {
      if (!f.columnName || f.columnName === "") {
        return false;
      }
      if (f.operator === "is_null" || f.operator === "is_not_null") {
        return true;
      }
      if (f.operator === "between") {
        // BETWEEN requires both value and value2
        return hasValue(f.value) && hasValue(f.value2);
      }
      return hasValue(f.value);
    });

    onApply(validFilters, logic);
    setIsOpen(false);
  }, [filters, logic, onApply]);

  const handleClear = useCallback(() => {
    setFilters([{ id: generateUniqueId('filter'), columnName: columns[0]?.name || "", operator: "equals", value: "" }]);
    setLogic("AND");
    onApply([], "AND");
  }, [columns, onApply]);

  return (
    <div className="border-b border-border bg-bg-secondary">
      {/* Expandable Panel Content */}
      {isOpen && (
        <div className="animate-slideDown max-h-[50vh] overflow-y-auto">
          {/* Compact Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Filters
              </h3>
              {/* Inline Logic Toggle - Only show when multiple filters */}
              {filters.length > 1 && (
                <div className="flex items-center bg-bg-secondary rounded border border-border">
                  <button
                    onClick={() => setLogic("AND")}
                    className={`px-2 py-0.5 text-[10px] font-medium transition-colors rounded-l ${
                      logic === "AND"
                        ? "bg-accent text-white"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                    title="All conditions must match"
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setLogic("OR")}
                    className={`px-2 py-0.5 text-[10px] font-medium transition-colors rounded-r ${
                      logic === "OR"
                        ? "bg-accent text-white"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                    title="Any condition can match"
                  >
                    OR
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                className="px-2 py-1 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="px-2.5 py-1 rounded bg-accent hover:bg-accent/90 text-white text-[10px] font-medium transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-bg-hover transition-colors ml-1"
                title="Collapse"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compact Filters List */}
          <div className="px-3 py-2 space-y-1.5">
            {filters.map((filter, index) => (
              <div key={filter.id} className="flex items-center gap-1.5">
                {/* Logic badge for rows after first */}
                {index > 0 && filters.length > 1 ? (
                  <span className="w-8 text-[10px] text-text-tertiary font-medium text-center flex-shrink-0">
                    {logic}
                  </span>
                ) : (
                  <span className="w-8 flex-shrink-0" />
                )}

                {/* Column */}
                <select
                  value={filter.columnName}
                  onChange={(e) => updateFilter(index, "columnName", e.target.value)}
                  className="w-32 flex-shrink-0 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {columns.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, "operator", e.target.value as FilterOperator)}
                  className="w-36 flex-shrink-0 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value (hide for is_null / is_not_null) */}
                {filter.operator !== "is_null" && filter.operator !== "is_not_null" ? (
                  filter.operator === "between" ? (
                    <div className="flex-1 flex items-center gap-1 min-w-0">
                      <input
                        type="text"
                        value={String(filter.value || "")}
                        onChange={(e) => updateFilter(index, "value", e.target.value)}
                        placeholder="min"
                        className="flex-1 min-w-0 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <span className="text-[10px] text-text-tertiary">–</span>
                      <input
                        type="text"
                        value={String(filter.value2 || "")}
                        onChange={(e) => updateFilter(index, "value2", e.target.value)}
                        placeholder="max"
                        className="flex-1 min-w-0 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={String(filter.value || "")}
                      onChange={(e) => updateFilter(index, "value", e.target.value)}
                      placeholder={
                        filter.operator === "in"
                          ? "val1, val2, ..."
                          : "value"
                      }
                      className="flex-1 min-w-0 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  )
                ) : (
                  <div className="flex-1" />
                )}

                {/* Compact action buttons */}
                <div className="flex items-center flex-shrink-0">
                  <button
                    onClick={() => addFilterAfter(index)}
                    className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors"
                    title="Add condition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {filters.length > 1 && (
                    <button
                      onClick={() => removeFilter(index)}
                      className="p-1 rounded text-text-tertiary hover:text-error hover:bg-bg-hover transition-colors"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
