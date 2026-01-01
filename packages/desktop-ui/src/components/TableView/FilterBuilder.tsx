import { useState, useCallback, useEffect } from "react";
import { X, Plus, Filter } from "lucide-react";
import type { FilterCondition, ColumnMetadata, FilterOperator } from "@dbview/types";

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
      : [{ id: Date.now().toString(), columnName: columns[0]?.name || "", operator: "equals", value: "" }]
  );
  const [logic, setLogic] = useState<"AND" | "OR">(initialLogic);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Sync internal state when props change (e.g., when filters are removed via chips or loaded from preset)
  useEffect(() => {
    if (initialFilters.length > 0) {
      setFilters(initialFilters);
    } else {
      setFilters([{ id: Date.now().toString(), columnName: columns[0]?.name || "", operator: "equals", value: "" }]);
    }
    setLogic(initialLogic);
  }, [initialFilters, initialLogic, columns]);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalIsOpen(value);
    }
  };

  const addFilter = useCallback(() => {
    setFilters([...filters, { id: Date.now().toString(), columnName: columns[0]?.name || "", operator: "equals", value: "" }]);
  }, [filters, columns]);

  const addFilterAfter = useCallback((index: number) => {
    const newFilter = { id: Date.now().toString(), columnName: columns[0]?.name || "", operator: "equals" as FilterOperator, value: "" };
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
    // Filter out incomplete filters
    const validFilters = filters.filter((f) => {
      if (f.operator === "is_null" || f.operator === "is_not_null") {
        return f.columnName !== "";
      }
      return f.columnName !== "" && f.value !== "";
    });

    onApply(validFilters, logic);
    setIsOpen(false);
  }, [filters, logic, onApply]);

  const handleClear = useCallback(() => {
    setFilters([{ id: Date.now().toString(), columnName: columns[0]?.name || "", operator: "equals", value: "" }]);
    setLogic("AND");
    onApply([], "AND");
  }, [columns, onApply]);

  return (
    <div className="border-b border-border bg-bg-secondary">
      {/* Expandable Panel Content */}
      {isOpen && (
        <div className="animate-slideDown max-h-[60vh] overflow-y-auto flex flex-col">
          {/* Header with close button - Sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-tertiary">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter Conditions
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-bg-hover transition-colors"
              title="Collapse filter panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Logic - Only show when multiple filters */}
          {filters.length > 1 && (
            <div className="px-4 py-3 border-b border-border bg-bg-primary">
              <label className="text-xs text-text-secondary mb-2 block">Match conditions</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogic("AND")}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    logic === "AND"
                      ? "bg-accent text-white"
                      : "bg-bg-tertiary text-text-primary hover:bg-bg-hover"
                  }`}
                  title="All conditions must be true"
                >
                  All (AND)
                </button>
                <button
                  onClick={() => setLogic("OR")}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    logic === "OR" ? "bg-accent text-white" : "bg-bg-tertiary text-text-primary hover:bg-bg-hover"
                  }`}
                  title="At least one condition must be true"
                >
                  Any (OR)
                </button>
              </div>
            </div>
          )}

          {/* Filters List */}
          <div className="px-4 py-3 space-y-3">
            {filters.map((filter, index) => (
              <div key={filter.id}>
                {/* AND/OR separator between conditions */}
                {index > 0 && filters.length > 1 && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-text-tertiary font-medium">
                      {logic}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 border border-border rounded bg-bg-primary">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Column */}
                      <select
                        value={filter.columnName}
                        onChange={(e) => updateFilter(index, "columnName", e.target.value)}
                        className="col-span-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent"
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
                        className="col-span-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      {/* Value (hide for is_null / is_not_null) */}
                      {filter.operator !== "is_null" && filter.operator !== "is_not_null" ? (
                        <input
                          type="text"
                          value={String(filter.value || "")}
                          onChange={(e) => updateFilter(index, "value", e.target.value)}
                          placeholder={
                            filter.operator === "in"
                              ? "value1, value2, value3"
                              : filter.operator === "between"
                              ? "min, max"
                              : filter.operator === "contains" || filter.operator === "starts_with" || filter.operator === "ends_with"
                              ? "pattern"
                              : "value"
                          }
                          className="col-span-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      ) : (
                        <div className="col-span-1" />
                      )}
                    </div>
                  </div>

                  {/* Inline action buttons */}
                  <div className="flex items-center gap-1">
                    {/* Add After Button */}
                    <button
                      onClick={() => addFilterAfter(index)}
                      className="p-1.5 rounded text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors"
                      title="Add condition below"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* Remove Button - Only show if more than 1 filter */}
                    {filters.length > 1 && (
                      <button
                        onClick={() => removeFilter(index)}
                        className="p-1.5 rounded text-text-secondary hover:text-error hover:bg-bg-hover transition-colors"
                        title="Remove condition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer - Sticky */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-bg-tertiary">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded bg-bg-secondary hover:bg-bg-hover text-text-primary text-xs transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
