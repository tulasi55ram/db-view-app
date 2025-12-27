import { X, Plus } from "lucide-react";
import type { FilterCondition } from "@dbview/types";

interface FilterChipsProps {
  filters: FilterCondition[];
  logic: "AND" | "OR";
  onRemove: (index: number) => void;
  onEdit: () => void;
  onAddFilter: () => void;
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  greater_or_equal: "≥",
  less_than: "<",
  less_or_equal: "≤",
  contains: "contains",
  starts_with: "starts with",
  ends_with: "ends with",
  in: "in",
  between: "between",
  is_null: "is null",
  is_not_null: "is not null",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && value.length > 20) {
    return `${value.substring(0, 20)}...`;
  }
  return String(value);
}

export function FilterChips({ filters, logic, onRemove, onEdit, onAddFilter }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.length > 0 && (
        <>
          <span className="text-xs text-text-tertiary font-medium">Active filters:</span>

          {filters.map((filter, index) => (
            <div key={filter.id} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-2.5 py-1 text-xs text-text-primary">
                <span className="font-medium">{filter.columnName}</span>
                <span className="text-text-tertiary">{OPERATOR_LABELS[filter.operator]}</span>
                {filter.operator !== "is_null" && filter.operator !== "is_not_null" && (
                  <span className="font-mono">"{formatValue(filter.value)}"</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-accent/20 transition-colors"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Show logic operator between filters */}
              {index < filters.length - 1 && (
                <span className="text-xs text-text-tertiary font-medium px-1">{logic}</span>
              )}
            </div>
          ))}

          <button
            onClick={onEdit}
            className="text-xs text-accent hover:text-accent/80 font-medium transition-colors px-2"
          >
            Edit All
          </button>
        </>
      )}

      {/* Always show Add Filter button */}
      <button
        onClick={onAddFilter}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors border border-dashed border-border hover:border-accent"
      >
        <Plus className="w-3 h-3" />
        <span>Add Filter</span>
      </button>
    </div>
  );
}
