/**
 * Message Adapter - Abstracts communication between webview and host (VS Code/Electron)
 *
 * This allows the same code to work in:
 * - VS Code extension webview (uses acquireVsCodeApi)
 * - Electron app (uses electron IPC)
 * - Development mode (logs to console)
 */
import type { MessageAdapter, CorrelatedMessage, SendMessageOptions } from '../types/index.js';

/**
 * Generate a unique correlation ID for request/response matching.
 * Uses a combination of timestamp and cryptographically random string for uniqueness.
 *
 * This prevents responses from being misrouted when multiple concurrent
 * requests are made with the same message type.
 *
 * @returns A unique correlation ID string
 *
 * @example
 * ```typescript
 * const id = generateCorrelationId();
 * // Returns something like "lx1abc123-def456gh789"
 * ```
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);

  // Use crypto API if available for better entropy
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return `${timestamp}-${array[0].toString(36)}${array[1].toString(36)}`;
  }

  // Fallback to Math.random (less entropy but functional)
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}

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
 *
 * In dev mode, messages posted via postMessage are dispatched to all
 * registered handlers asynchronously, simulating real message passing.
 * This allows sendMessage/sendMessageMulti to work in dev environments.
 */
export function createDevAdapter(): MessageAdapter {
  const handlers: Set<(message: unknown) => void> = new Set();

  return {
    postMessage: (message) => {
      console.log('[MessageAdapter:dev] postMessage:', message);

      // Dispatch to all registered handlers asynchronously
      // Use queueMicrotask to simulate the async nature of real message passing
      // while maintaining predictable ordering within the same execution context
      queueMicrotask(() => {
        handlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error('[MessageAdapter:dev] Handler error:', error);
          }
        });
      });
    },
    onMessage: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    // Expose a method to simulate incoming messages (useful for testing)
    simulateIncoming: (message: unknown) => {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('[MessageAdapter:dev] Handler error:', error);
        }
      });
    },
  } as MessageAdapter & { simulateIncoming: (message: unknown) => void };
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
 * Helper to send a typed message and wait for a typed response.
 *
 * Uses correlation IDs to match requests with responses, preventing
 * misrouting when multiple concurrent requests are made.
 *
 * @param adapter - The message adapter to use
 * @param message - The message to send (will have correlationId added)
 * @param responseType - The expected response type
 * @param options - Optional settings (timeout, useCorrelation)
 * @returns Promise resolving to the response
 *
 * @example
 * ```typescript
 * const response = await sendMessage<QueryResult>(
 *   adapter,
 *   { type: 'RUN_QUERY', sql: 'SELECT * FROM users' },
 *   'QUERY_RESULT'
 * );
 * ```
 */
export function sendMessage<TResponse>(
  adapter: MessageAdapter,
  message: unknown,
  responseType: string,
  options: SendMessageOptions | number = {}
): Promise<TResponse> {
  // Support legacy timeout-only parameter
  const opts: SendMessageOptions = typeof options === 'number'
    ? { timeout: options }
    : options;
  const { timeout = 30000, useCorrelation = true } = opts;

  return new Promise((resolve, reject) => {
    let resolved = false;
    let unsubscribe: (() => void) | null = null;

    // Generate correlation ID for request/response matching
    const correlationId = useCorrelation ? generateCorrelationId() : undefined;

    // Warn about potential misrouting when correlation is disabled (dev only)
    if (!useCorrelation && typeof window !== 'undefined' && (window as any).__DEV__) {
      console.warn(
        '[MessageAdapter] Correlation IDs disabled - responses may be misrouted in concurrent scenarios. ' +
        'Consider using useCorrelation: true for reliable message matching.'
      );
    }

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      unsubscribe?.();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Message timeout waiting for ${responseType}${correlationId ? ` (correlationId: ${correlationId})` : ''}`));
    }, timeout);

    unsubscribe = adapter.onMessage((response: unknown) => {
      if (
        typeof response === 'object' &&
        response !== null &&
        'type' in response
      ) {
        const resp = response as CorrelatedMessage;

        // Check type matches
        if (resp.type !== responseType) {
          return;
        }

        // If we sent a correlationId, only accept responses with matching ID
        // If response has a correlationId but we didn't send one, accept it (backward compat for broadcasts)
        // If neither has correlationId, accept it (full backward compatibility)
        if (correlationId) {
          // We sent a correlation ID - require exact match
          if (resp.correlationId !== correlationId) {
            return;
          }
        }

        cleanup();
        resolve(response as TResponse);
      }
    });

    // Add correlation ID to outgoing message
    const messageWithCorrelation = useCorrelation && typeof message === 'object' && message !== null
      ? { ...message, correlationId }
      : message;

    adapter.postMessage(messageWithCorrelation);
  });
}

/**
 * Helper to send a message and wait for one of multiple response types.
 *
 * Uses correlation IDs to match requests with responses, preventing
 * misrouting when multiple concurrent requests are made.
 *
 * @param adapter - The message adapter to use
 * @param message - The message to send (will have correlationId added)
 * @param responseTypes - Array of possible response types
 * @param options - Optional settings (timeout, useCorrelation)
 * @returns Promise resolving to the response
 *
 * @example
 * ```typescript
 * const response = await sendMessageMulti<QueryResult | QueryError>(
 *   adapter,
 *   { type: 'RUN_QUERY', sql: 'SELECT * FROM users' },
 *   ['QUERY_RESULT', 'QUERY_ERROR']
 * );
 * ```
 */
export function sendMessageMulti<TResponse>(
  adapter: MessageAdapter,
  message: unknown,
  responseTypes: string[],
  options: SendMessageOptions | number = {}
): Promise<TResponse> {
  // Support legacy timeout-only parameter
  const opts: SendMessageOptions = typeof options === 'number'
    ? { timeout: options }
    : options;
  const { timeout = 30000, useCorrelation = true } = opts;

  return new Promise((resolve, reject) => {
    let resolved = false;
    let unsubscribe: (() => void) | null = null;

    // Generate correlation ID for request/response matching
    const correlationId = useCorrelation ? generateCorrelationId() : undefined;

    // Warn about potential misrouting when correlation is disabled (dev only)
    if (!useCorrelation && typeof window !== 'undefined' && (window as any).__DEV__) {
      console.warn(
        '[MessageAdapter] Correlation IDs disabled - responses may be misrouted in concurrent scenarios. ' +
        'Consider using useCorrelation: true for reliable message matching.'
      );
    }

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      unsubscribe?.();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Message timeout waiting for ${responseTypes.join(' or ')}${correlationId ? ` (correlationId: ${correlationId})` : ''}`));
    }, timeout);

    unsubscribe = adapter.onMessage((response: unknown) => {
      if (
        typeof response === 'object' &&
        response !== null &&
        'type' in response
      ) {
        const resp = response as CorrelatedMessage;

        // Check type matches one of the expected types
        if (!responseTypes.includes(resp.type)) {
          return;
        }

        // If we sent a correlationId, only accept responses with matching ID
        if (correlationId) {
          if (resp.correlationId !== correlationId) {
            return;
          }
        }

        cleanup();
        resolve(response as TResponse);
      }
    });

    // Add correlation ID to outgoing message
    const messageWithCorrelation = useCorrelation && typeof message === 'object' && message !== null
      ? { ...message, correlationId }
      : message;

    adapter.postMessage(messageWithCorrelation);
  });
}
