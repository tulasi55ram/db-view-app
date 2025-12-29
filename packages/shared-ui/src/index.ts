/**
 * @dbview/shared-ui - Main entry point
 *
 * Re-exports all modules for easy importing:
 * import { DataView, ThemeProvider, getAPI } from "@dbview/shared-ui";
 */

// API and platform detection
export * from "./api";

// Design system (themes, tokens)
export * from "./design-system";

// Components
export * from "./components";

// Layout components
export * from "./layout";

// Hooks
export * from "./hooks";

// Utilities
export * from "./utils";

// Electron API (for backward compatibility)
export * from "./electron";
