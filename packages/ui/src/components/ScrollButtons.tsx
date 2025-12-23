import { memo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface ScrollButtonsProps {
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  showTopButton: boolean;
  showBottomButton: boolean;
}

export const ScrollButtons = memo(function ScrollButtons({
  onScrollToTop,
  onScrollToBottom,
  showTopButton,
  showBottomButton,
}: ScrollButtonsProps) {
  // Don't render if neither button should show
  if (!showTopButton && !showBottomButton) {
    return null;
  }

  return (
    <div className="absolute bottom-16 right-4 flex flex-col gap-2 z-30">
      {/* Scroll to Top Button */}
      <button
        onClick={onScrollToTop}
        className={clsx(
          'w-10 h-10 rounded-full bg-vscode-bg-lighter border border-vscode-border',
          'flex items-center justify-center',
          'text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-bg-hover',
          'shadow-lg hover:shadow-xl',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-vscode-accent focus:ring-offset-1 focus:ring-offset-vscode-bg',
          showTopButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        )}
        title="Scroll to top (Home)"
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      {/* Scroll to Bottom Button */}
      <button
        onClick={onScrollToBottom}
        className={clsx(
          'w-10 h-10 rounded-full bg-vscode-bg-lighter border border-vscode-border',
          'flex items-center justify-center',
          'text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-bg-hover',
          'shadow-lg hover:shadow-xl',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-vscode-accent focus:ring-offset-1 focus:ring-offset-vscode-bg',
          showBottomButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        )}
        title="Scroll to bottom (End)"
        aria-label="Scroll to bottom"
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
});
