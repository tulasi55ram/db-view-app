import { memo } from "react";

interface ScrollProgressBarProps {
  progress: number; // 0-100
}

export const ScrollProgressBar = memo(function ScrollProgressBar({ progress }: ScrollProgressBarProps) {
  return (
    <div className="h-[3px] bg-bg-tertiary w-full relative overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full bg-accent transition-[width] duration-75 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
      {/* Subtle glow effect */}
      <div
        className="absolute top-0 h-full bg-gradient-to-r from-transparent via-accent/30 to-transparent w-16 transition-[left] duration-75 ease-out"
        style={{ left: `calc(${Math.max(0, Math.min(100, progress))}% - 32px)` }}
      />
    </div>
  );
});
