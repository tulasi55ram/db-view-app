/**
 * SidePanelContainer - Manages panel content switching with smooth animations
 *
 * This component wraps the panel content area and handles:
 * - AnimatePresence for smooth entry/exit animations
 * - Content switching between different panel types
 * - Keyboard navigation and accessibility
 */

import { type FC, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanelType } from "./types";

interface SidePanelContainerProps {
  /** The currently active panel type, or null if no panel is open */
  activePanel: PanelType | null;
  /** The content to render for the active panel */
  children: ReactNode;
  /** Additional class names for the container */
  className?: string;
}

/**
 * Animation variants for panel content transitions
 */
const contentVariants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.15,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: {
      duration: 0.1,
      ease: "easeIn",
    },
  },
};

export const SidePanelContainer: FC<SidePanelContainerProps> = ({
  activePanel,
  children,
  className,
}) => {
  return (
    <div className={`h-full flex flex-col overflow-hidden ${className || ""}`}>
      <AnimatePresence mode="wait">
        {activePanel && (
          <motion.div
            key={activePanel}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full flex flex-col"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Hook for managing unified panel state
 * Provides a single state object and handlers for all panel types
 */
import { useState, useCallback } from "react";
import type { PanelState, PanelData } from "./types";

export function usePanelState() {
  const [state, setState] = useState<PanelState>({
    activePanel: null,
    data: {},
  });

  const openPanel = useCallback(<T extends PanelType>(
    type: T,
    data?: PanelData[T]
  ) => {
    setState({
      activePanel: type,
      data: data ? { [type]: data } : {},
    });
  }, []);

  const closePanel = useCallback(() => {
    setState({ activePanel: null, data: {} });
  }, []);

  const updatePanelData = useCallback(<T extends PanelType>(
    type: T,
    data: Partial<PanelData[T]>
  ) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        [type]: { ...prev.data[type], ...data },
      },
    }));
  }, []);

  const isPanelOpen = useCallback((type: PanelType) => {
    return state.activePanel === type;
  }, [state.activePanel]);

  return {
    state,
    activePanel: state.activePanel,
    panelData: state.data,
    openPanel,
    closePanel,
    updatePanelData,
    isPanelOpen,
  };
}
