/**
 * Platform abstraction layer
 *
 * Re-exports from @dbview/shared-ui for backward compatibility.
 * The shared-ui package provides a unified API for both VS Code webview and Electron.
 */

import {
  detectPlatform,
  isElectron,
  isVSCode,
  isWeb,
  getAPI,
} from "@dbview/shared-ui";

import type { Platform, DatabaseAPI } from "@dbview/shared-ui";

// Re-export platform detection
export { detectPlatform, isElectron, isVSCode, isWeb };
export type { Platform };

// Backward compatibility: getPlatform is an alias for detectPlatform
export const getPlatform = detectPlatform;

/**
 * Platform-specific messaging abstraction
 *
 * This class provides a unified interface that wraps the shared-ui getAPI().
 * It maintains backward compatibility with the old PlatformMessenger API
 * while using the new shared DatabaseAPI under the hood.
 */
export class PlatformMessenger {
  private platform: Platform;
  private api: DatabaseAPI | undefined;
  private messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();

  constructor() {
    this.platform = detectPlatform();
    this.api = getAPI();

    // Set up VS Code message listener for event handling
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
   * For most operations, prefer using getAPI() directly from @dbview/shared-ui
   * which provides a Promise-based interface for all platforms.
   */
  async send<T = void>(type: string, payload?: Record<string, unknown>): Promise<T> {
    if (!this.api) {
      throw new Error(`Platform ${this.platform} not supported for messaging`);
    }

    // Map message types to API methods
    return this.invokeAPI<T>(type, payload);
  }

  /**
   * Register a handler for incoming messages (VS Code pattern)
   */
  onMessage(type: string, handler: (data: unknown) => void): () => void {
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
   * Map message types to API methods
   */
  private async invokeAPI<T>(type: string, payload?: Record<string, unknown>): Promise<T> {
    if (!this.api) {
      throw new Error("API not available");
    }

    const p = payload || {};

    // Map message types to DatabaseAPI methods
    switch (type) {
      // Connection management
      case "GET_CONNECTIONS":
        return this.api.getConnections() as Promise<T>;
      case "SAVE_CONNECTION":
        return this.api.saveConnection(p.config as Parameters<DatabaseAPI['saveConnection']>[0]) as Promise<T>;
      case "DELETE_CONNECTION":
        return this.api.deleteConnection(p.name as string) as Promise<T>;
      case "TEST_CONNECTION":
        return this.api.testConnection(p.config as Parameters<DatabaseAPI['testConnection']>[0]) as Promise<T>;
      case "CONNECT":
        return this.api.connectToDatabase(p.connectionKey as string) as Promise<T>;
      case "DISCONNECT":
        return this.api.disconnectFromDatabase(p.connectionKey as string) as Promise<T>;

      // Schema operations
      case "LIST_SCHEMAS":
        return this.api.listSchemas(p.connectionKey as string) as Promise<T>;
      case "LIST_TABLES":
        return this.api.listTables(p.connectionKey as string, p.schema as string) as Promise<T>;
      case "GET_HIERARCHY":
        return this.api.getHierarchy(p.connectionKey as string) as Promise<T>;

      // Table operations
      case "LOAD_TABLE_ROWS":
        return this.api.loadTableRows(p as Parameters<DatabaseAPI['loadTableRows']>[0]) as Promise<T>;
      case "GET_ROW_COUNT":
        return this.api.getRowCount(p as Parameters<DatabaseAPI['getRowCount']>[0]) as Promise<T>;
      case "GET_TABLE_METADATA":
        return this.api.getTableMetadata(p as Parameters<DatabaseAPI['getTableMetadata']>[0]) as Promise<T>;
      case "UPDATE_CELL":
        return this.api.updateCell(p as Parameters<DatabaseAPI['updateCell']>[0]) as Promise<T>;
      case "INSERT_ROW":
        return this.api.insertRow(p as Parameters<DatabaseAPI['insertRow']>[0]) as Promise<T>;
      case "DELETE_ROWS":
        return this.api.deleteRows(p as Parameters<DatabaseAPI['deleteRows']>[0]) as Promise<T>;

      // Query operations
      case "RUN_QUERY":
        return this.api.runQuery(p as Parameters<DatabaseAPI['runQuery']>[0]) as Promise<T>;
      case "FORMAT_SQL":
        return this.api.formatSql(p.sql as string) as Promise<T>;
      case "EXPLAIN_QUERY":
        return this.api.explainQuery(p as Parameters<DatabaseAPI['explainQuery']>[0]) as Promise<T>;

      // Views
      case "GET_VIEWS":
        return this.api.getViews(p as Parameters<DatabaseAPI['getViews']>[0]) as Promise<T>;
      case "SAVE_VIEW":
        return this.api.saveView(p as Parameters<DatabaseAPI['saveView']>[0]) as Promise<T>;
      case "DELETE_VIEW":
        return this.api.deleteView(p as Parameters<DatabaseAPI['deleteView']>[0]) as Promise<T>;

      // ER Diagram
      case "GET_ER_DIAGRAM":
        return this.api.getERDiagram(p.connectionKey as string, p.schemas as string[]) as Promise<T>;

      // Autocomplete
      case "GET_AUTOCOMPLETE_DATA":
        return this.api.getAutocompleteData(p.connectionKey as string) as Promise<T>;

      // Export/Import
      case "EXPORT_DATA":
        return this.api.exportData(p as Parameters<DatabaseAPI['exportData']>[0]) as Promise<T>;
      case "IMPORT_DATA":
        return this.api.importData(p as Parameters<DatabaseAPI['importData']>[0]) as Promise<T>;

      // Clipboard
      case "COPY_TO_CLIPBOARD":
        return this.api.copyToClipboard(p.text as string) as Promise<T>;

      // Theme
      case "GET_THEME":
        return this.api.getTheme() as Promise<T>;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  /**
   * Get the DatabaseAPI directly
   */
  getAPI(): DatabaseAPI | undefined {
    return this.api;
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
