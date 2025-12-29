import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
}

// Predefined color palette with environment-based colors
export const COLOR_PALETTE = [
  { name: "Red", value: "#EF4444", description: "Production" },
  { name: "Orange", value: "#F97316", description: "Warning" },
  { name: "Amber", value: "#F59E0B", description: "Staging" },
  { name: "Yellow", value: "#EAB308", description: "Testing" },
  { name: "Lime", value: "#84CC16", description: "QA" },
  { name: "Green", value: "#22C55E", description: "Development" },
  { name: "Emerald", value: "#10B981", description: "Success" },
  { name: "Teal", value: "#14B8A6", description: "Info" },
  { name: "Cyan", value: "#06B6D4", description: "Analytics" },
  { name: "Sky", value: "#0EA5E9", description: "Cloud" },
  { name: "Blue", value: "#3B82F6", description: "Default" },
  { name: "Indigo", value: "#6366F1", description: "Premium" },
  { name: "Violet", value: "#8B5CF6", description: "Special" },
  { name: "Purple", value: "#A855F7", description: "Custom" },
  { name: "Fuchsia", value: "#D946EF", description: "Feature" },
  { name: "Pink", value: "#EC4899", description: "Beta" },
  { name: "Rose", value: "#F43F5E", description: "Critical" },
  { name: "Gray", value: "#6B7280", description: "Archive" },
];

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-text-primary">{label}</label>
      )}
      <div className="grid grid-cols-9 gap-2">
        {COLOR_PALETTE.map((color) => {
          const isSelected = value === color.value;
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onChange(color.value)}
              className={cn(
                "relative w-8 h-8 rounded-lg transition-all duration-150",
                "hover:scale-110 hover:shadow-lg",
                isSelected && "ring-2 ring-offset-2 ring-offset-bg-primary scale-110"
              )}
              style={
                {
                  backgroundColor: color.value,
                  ...(isSelected && { "--tw-ring-color": color.value } as any),
                }
              }
              title={`${color.name} - ${color.description}`}
              aria-label={`${color.name} - ${color.description}`}
            >
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {value && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: value }}
          />
          <span>
            {COLOR_PALETTE.find((c) => c.value === value)?.name || "Custom"} -{" "}
            {COLOR_PALETTE.find((c) => c.value === value)?.description || value}
          </span>
        </div>
      )}
    </div>
  );
}
