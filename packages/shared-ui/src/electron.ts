/**
 * Electron API wrapper for shared-ui
 *
 * This file provides backward compatibility and Electron-specific extensions
 * to the shared API types.
 */

// Re-export everything from the shared API
export * from "./api";
export { getAPI as getElectronAPI, isElectron, isVSCode, isWeb, detectPlatform } from "./api";

// Import shared types for extension
import type { DatabaseAPI } from "./api";

// Auto-updater types (Electron-specific)
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateStatus {
  status: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  info?: UpdateInfo;
  progress?: UpdateProgress;
  error?: string;
}

/**
 * Extended Electron API interface
 * Includes all DatabaseAPI methods plus Electron-specific features
 */
export interface ElectronAPI extends DatabaseAPI {
  // Clipboard (extended)
  readFromClipboard(): Promise<string>;

  // File dialogs
  showSaveDialog(options: import("./api").SaveDialogOptions): Promise<import("./api").DialogResult>;
  showOpenDialog(options: import("./api").OpenDialogOptions): Promise<import("./api").DialogResult>;

  // Tabs persistence
  loadTabs(): Promise<import("./api").TabsState | null>;
  saveTabs(state: import("./api").TabsState): Promise<void>;

  // Menu event subscriptions (Electron-specific)
  onMenuNewQuery(callback: () => void): () => void;
  onMenuAddConnection(callback: () => void): () => void;
  onMenuOpenSqlite(callback: (filePath: string) => void): () => void;
  onMenuToggleSidebar(callback: () => void): () => void;
  onMenuRunQuery(callback: () => void): () => void;
  onMenuFormatSql(callback: () => void): () => void;
  onMenuExplainQuery(callback: () => void): () => void;

  // Auto-updater (Electron-specific)
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<boolean>;
  installUpdate(): Promise<boolean>;
  getAppVersion(): Promise<string>;
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;
}

// Note: Window.electronAPI is declared in api/index.ts with DatabaseAPI type
// The actual runtime object implements ElectronAPI which extends DatabaseAPI
// Cast window.electronAPI to ElectronAPI when needed for Electron-specific features

/**
 * Get the Electron-specific API with extended features
 * Use this when you need Electron-specific features like auto-updater
 */
export function getElectronAPIExtended(): ElectronAPI | undefined {
  if (typeof window !== "undefined" && window.electronAPI) {
    return window.electronAPI as unknown as ElectronAPI;
  }
  return undefined;
}
