interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Store VS Code API globally to share across packages
const VSCODE_API_KEY = '__vscodeApi__';

export function getVsCodeApi(): VsCodeApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  // Check if API is already stored globally (may have been acquired by another package)
  if ((window as any)[VSCODE_API_KEY]) {
    return (window as any)[VSCODE_API_KEY];
  }

  // Try to acquire the API
  if (typeof acquireVsCodeApi === "function") {
    try {
      const api = acquireVsCodeApi();
      // Store globally so other packages can reuse it
      (window as any)[VSCODE_API_KEY] = api;
      return api;
    } catch (error) {
      // API was already acquired, check if it's stored globally
      if ((window as any)[VSCODE_API_KEY]) {
        return (window as any)[VSCODE_API_KEY];
      }
      console.error('VS Code API already acquired but not found globally:', error);
      return undefined;
    }
  }

  return undefined;
}
