import { type FC, useEffect, useRef } from "react";
import * as Switch from "@radix-ui/react-switch";

export interface BooleanToggleProps {
  value: boolean | null;
  onSave: (value: boolean) => void;
  onCancel: () => void;
}

export const BooleanToggle: FC<BooleanToggleProps> = ({
  value,
  onSave,
  onCancel
}) => {
  const switchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    switchRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // Save current state (already changed by toggle)
      onCancel(); // Close without additional action since onChange already updated
    }
  };

  const handleCheckedChange = (checked: boolean) => {
    onSave(checked);
  };

  return (
    <div className="flex items-center justify-center h-full px-3 py-1">
      <Switch.Root
        ref={switchRef}
        checked={value === true}
        onCheckedChange={handleCheckedChange}
        onKeyDown={handleKeyDown}
        className="w-11 h-6 bg-vscode-bg-lighter rounded-full relative data-[state=checked]:bg-vscode-accent outline-none focus:ring-2 focus:ring-vscode-accent transition-colors"
      >
        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
      <span className="ml-2 text-xs text-vscode-text-muted">
        {value ? "true" : "false"}
      </span>
    </div>
  );
};
