/**
 * VS Code API wrapper
 *
 * This module provides access to the VS Code webview API.
 * For the full DatabaseAPI interface, use getAPI() from @dbview/shared-ui.
 */

import { isVSCode, getAPI } from "@dbview/shared-ui";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let vscodeApi: VsCodeApi | undefined;

/**
 * Get the raw VS Code webview API
 * For Promise-based API, use getAPI() from @dbview/shared-ui instead.
 */
export function getVsCodeApi(): VsCodeApi | undefined {
  if (typeof acquireVsCodeApi === "function") {
    vscodeApi = vscodeApi ?? acquireVsCodeApi();
  }
  return vscodeApi;
}

/**
 * Initialize the VS Code API bridge.
 * This sets up window.vscodeAPI so that @dbview/shared-ui can detect VS Code platform.
 */
export function initVSCodeAPI(): void {
  const api = getVsCodeApi();
  if (api && typeof window !== "undefined") {
    // Expose the VS Code API on window for shared-ui platform detection
    (window as unknown as { vscodeAPI: VsCodeApi }).vscodeAPI = api;
  }
}

// Auto-initialize when this module is loaded in VS Code context
if (typeof window !== "undefined" && typeof acquireVsCodeApi === "function") {
  initVSCodeAPI();
}

// Re-export utilities from shared-ui
export { isVSCode, getAPI };
