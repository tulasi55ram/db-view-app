/**
 * Electron API wrapper
 *
 * Re-exports from @dbview/shared-ui for backward compatibility.
 * The shared-ui package provides the unified API that works across platforms.
 */

// Re-export everything from shared-ui
export {
  // Platform detection
  detectPlatform,
  isElectron,
  isVSCode,
  isWeb,
  // API access
  getAPI,
  getAPI as getElectronAPI,
} from "@dbview/shared-ui";

// Re-export types
export type {
  Platform,
  DatabaseAPI,
  ConnectionInfo,
  LoadTableRowsParams,
  GetRowCountParams,
  GetTableMetadataParams,
  UpdateCellParams,
  InsertRowParams,
  DeleteRowsParams,
  RunQueryParams,
  QueryResult,
  ExplainQueryParams,
  GetViewsParams,
  SaveViewParams,
  DeleteViewParams,
  ExportDataParams,
  ImportDataParams,
  AutocompleteData,
  ImportResult,
  SaveDialogOptions,
  OpenDialogOptions,
  DialogResult,
  QueryHistoryEntry,
  SavedQuery,
  FilterPreset,
  PersistedTab,
  TabsState,
} from "@dbview/shared-ui";

// Re-export Electron-specific extensions
export { getElectronAPIExtended } from "@dbview/shared-ui/electron";
export type { ElectronAPI, UpdateInfo, UpdateProgress, UpdateStatus } from "@dbview/shared-ui/electron";
