/**
 * Platform abstraction layer
 *
 * Provides a unified API for both VS Code webview and Electron renderer contexts.
 * The UI components can use this abstraction to work in both environments.
 */

import { getVsCodeApi } from "./vscode";
import { getElectronAPI, isElectron } from "./electron";
import type { ElectronAPI } from "./electron";

export type Platform = "vscode" | "electron" | "web";

/**
 * Detect the current platform
 */
export function getPlatform(): Platform {
  if (isElectron()) {
    return "electron";
  }
  if (typeof window !== "undefined" && typeof (window as any).acquireVsCodeApi === "function") {
    return "vscode";
  }
  return "web";
}

/**
 * Check if running in VS Code
 */
export function isVSCode(): boolean {
  return getPlatform() === "vscode";
}

/**
 * Platform-specific messaging abstraction
 *
 * In VS Code: Uses postMessage/onMessage pattern
 * In Electron: Uses direct IPC invoke pattern (Promise-based)
 */
export class PlatformMessenger {
  private platform: Platform;
  private vscodeApi: ReturnType<typeof getVsCodeApi>;
  private electronApi: ElectronAPI | undefined;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor() {
    this.platform = getPlatform();
    this.vscodeApi = getVsCodeApi();
    this.electronApi = getElectronAPI();

    // Set up VS Code message listener
    if (this.platform === "vscode") {
      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message && message.type) {
          const handlers = this.messageHandlers.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message));
          }

          // Also notify generic handlers
          const genericHandlers = this.messageHandlers.get("*");
          if (genericHandlers) {
            genericHandlers.forEach((handler) => handler(message));
          }
        }
      });
    }
  }

  /**
   * Send a message and optionally wait for response
   *
   * In VS Code: Posts message, response comes via message event
   * In Electron: Invokes IPC handler, returns Promise directly
   */
  async send<T = void>(type: string, payload?: any): Promise<T> {
    if (this.platform === "electron" && this.electronApi) {
      return this.invokeElectronAPI<T>(type, payload);
    }

    if (this.platform === "vscode" && this.vscodeApi) {
      // VS Code uses fire-and-forget postMessage
      this.vscodeApi.postMessage({ type, ...payload });

      // Return immediately for commands that don't expect a response
      return undefined as T;
    }

    throw new Error(`Platform ${this.platform} not supported for messaging`);
  }

  /**
   * Register a handler for incoming messages (VS Code pattern)
   */
  onMessage(type: string, handler: (data: any) => void): () => void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);

    // Return cleanup function
    return () => {
      const currentHandlers = this.messageHandlers.get(type) || [];
      const index = currentHandlers.indexOf(handler);
      if (index >= 0) {
        currentHandlers.splice(index, 1);
        this.messageHandlers.set(type, currentHandlers);
      }
    };
  }

  /**
   * Map VS Code message types to Electron API calls
   */
  private async invokeElectronAPI<T>(type: string, payload: any): Promise<T> {
    if (!this.electronApi) {
      throw new Error("Electron API not available");
    }

    // Map message types to Electron API methods
    switch (type) {
      // Connection management
      case "GET_CONNECTIONS":
        return this.electronApi.getConnections() as Promise<T>;
      case "SAVE_CONNECTION":
        return this.electronApi.saveConnection(payload.config) as Promise<T>;
      case "DELETE_CONNECTION":
        return this.electronApi.deleteConnection(payload.name) as Promise<T>;
      case "TEST_CONNECTION":
        return this.electronApi.testConnection(payload.config) as Promise<T>;

      // Table operations
      case "LOAD_TABLE_ROWS":
        return this.electronApi.loadTableRows(payload) as Promise<T>;
      case "GET_ROW_COUNT":
        return this.electronApi.getRowCount(payload) as Promise<T>;
      case "GET_TABLE_METADATA":
        return this.electronApi.getTableMetadata(payload) as Promise<T>;
      case "UPDATE_CELL":
        return this.electronApi.updateCell(payload) as Promise<T>;
      case "INSERT_ROW":
        return this.electronApi.insertRow(payload) as Promise<T>;
      case "DELETE_ROWS":
        return this.electronApi.deleteRows(payload) as Promise<T>;

      // Query operations
      case "RUN_QUERY":
        return this.electronApi.runQuery(payload) as Promise<T>;
      case "FORMAT_SQL":
        return this.electronApi.formatSql(payload.sql) as Promise<T>;
      case "EXPLAIN_QUERY":
        return this.electronApi.explainQuery(payload) as Promise<T>;

      // Views
      case "GET_VIEWS":
        return this.electronApi.getViews(payload) as Promise<T>;
      case "SAVE_VIEW":
        return this.electronApi.saveView(payload) as Promise<T>;
      case "DELETE_VIEW":
        return this.electronApi.deleteView(payload) as Promise<T>;

      // ER Diagram
      case "GET_ER_DIAGRAM":
        return this.electronApi.getERDiagram(payload.connectionKey, payload.schemas) as Promise<T>;

      // Autocomplete
      case "GET_AUTOCOMPLETE_DATA":
        return this.electronApi.getAutocompleteData(payload.connectionKey) as Promise<T>;

      // Export/Import
      case "EXPORT_DATA":
        return this.electronApi.exportData(payload) as Promise<T>;
      case "IMPORT_DATA":
        return this.electronApi.importData(payload) as Promise<T>;

      // Clipboard
      case "COPY_TO_CLIPBOARD":
        return this.electronApi.copyToClipboard(payload.content) as Promise<T>;

      // Schema
      case "LIST_SCHEMAS":
        return this.electronApi.listSchemas(payload.connectionKey) as Promise<T>;
      case "LIST_TABLES":
        return this.electronApi.listTables(payload.connectionKey, payload.schema) as Promise<T>;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  /**
   * Get the Electron API directly (for Electron-specific features)
   */
  getElectronAPI(): ElectronAPI | undefined {
    return this.electronApi;
  }

  /**
   * Get the current platform
   */
  getPlatform(): Platform {
    return this.platform;
  }
}

// Export singleton instance
export const platformMessenger = new PlatformMessenger();
