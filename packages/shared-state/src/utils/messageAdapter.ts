/**
 * Message Adapter - Abstracts communication between webview and host (VS Code/Electron)
 *
 * This allows the same code to work in:
 * - VS Code extension webview (uses acquireVsCodeApi)
 * - Electron app (uses electron IPC)
 * - Development mode (logs to console)
 */
import type { MessageAdapter } from '../types/index.js';

// Type augmentation for window object
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
    electronAPI?: {
      send: (channel: string, data: unknown) => void;
      invoke: (channel: string, data: unknown) => Promise<unknown>;
      onMessage: (callback: (message: unknown) => void) => () => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

// Store VS Code API globally to share across packages
const VSCODE_API_KEY = '__vscodeApi__';

/**
 * Get VS Code API instance (singleton, shared globally)
 */
function getVSCodeApi() {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if API is already stored globally (may have been acquired by another package)
  if ((window as any)[VSCODE_API_KEY]) {
    return (window as any)[VSCODE_API_KEY];
  }

  // Try to acquire the API
  if (window.acquireVsCodeApi) {
    try {
      const api = window.acquireVsCodeApi();
      // Store globally so other packages can reuse it
      (window as any)[VSCODE_API_KEY] = api;
      return api;
    } catch (error) {
      // API was already acquired, check if it's stored globally
      if ((window as any)[VSCODE_API_KEY]) {
        return (window as any)[VSCODE_API_KEY];
      }
      console.error('VS Code API already acquired but not found globally:', error);
      return null;
    }
  }

  return null;
}

/**
 * Create VS Code message adapter
 */
export function createVSCodeAdapter(): MessageAdapter {
  const vscode = getVSCodeApi();

  return {
    postMessage: (message) => {
      vscode?.postMessage(message);
    },
    onMessage: (handler) => {
      const listener = (event: MessageEvent) => {
        handler(event.data);
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },
  };
}

/**
 * Create Electron message adapter
 */
export function createElectronAdapter(): MessageAdapter {
  const api = window.electronAPI;

  return {
    postMessage: (message) => {
      api?.send('message', message);
    },
    onMessage: (handler) => {
      return api?.onMessage(handler) ?? (() => {});
    },
  };
}

/**
 * Create development/fallback message adapter
 * Useful for testing or when running outside VS Code/Electron
 */
export function createDevAdapter(): MessageAdapter {
  const handlers: Set<(message: unknown) => void> = new Set();

  return {
    postMessage: (message) => {
      console.log('[MessageAdapter:dev] postMessage:', message);
      // In dev mode, simulate some responses for testing
      if (typeof message === 'object' && message !== null && 'type' in message) {
        // Could add mock responses here for development
      }
    },
    onMessage: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

/**
 * Detect environment and create appropriate message adapter
 */
export function createMessageAdapter(): MessageAdapter {
  if (typeof window === 'undefined') {
    // Server-side or Node.js environment
    return createDevAdapter();
  }

  // VS Code webview
  if (typeof window.acquireVsCodeApi === 'function') {
    return createVSCodeAdapter();
  }

  // Electron app
  if (window.electronAPI) {
    return createElectronAdapter();
  }

  // Fallback for development/testing
  return createDevAdapter();
}

// Singleton adapter instance
let messageAdapter: MessageAdapter | null = null;

/**
 * Get singleton message adapter instance
 */
export function getMessageAdapter(): MessageAdapter {
  if (!messageAdapter) {
    messageAdapter = createMessageAdapter();
  }
  return messageAdapter;
}

/**
 * Reset message adapter (useful for testing)
 */
export function resetMessageAdapter(): void {
  messageAdapter = null;
}

/**
 * Helper to send a typed message and wait for a typed response
 */
export function sendMessage<TResponse>(
  adapter: MessageAdapter,
  message: unknown,
  responseType: string,
  timeout = 30000
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Message timeout waiting for ${responseType}`));
    }, timeout);

    const unsubscribe = adapter.onMessage((response: unknown) => {
      if (
        typeof response === 'object' &&
        response !== null &&
        'type' in response &&
        (response as { type: string }).type === responseType
      ) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(response as TResponse);
      }
    });

    adapter.postMessage(message);
  });
}

/**
 * Helper to send a message and wait for one of multiple response types
 */
export function sendMessageMulti<TResponse>(
  adapter: MessageAdapter,
  message: unknown,
  responseTypes: string[],
  timeout = 30000
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Message timeout waiting for ${responseTypes.join(' or ')}`));
    }, timeout);

    const unsubscribe = adapter.onMessage((response: unknown) => {
      if (
        typeof response === 'object' &&
        response !== null &&
        'type' in response &&
        responseTypes.includes((response as { type: string }).type)
      ) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(response as TResponse);
      }
    });

    adapter.postMessage(message);
  });
}
