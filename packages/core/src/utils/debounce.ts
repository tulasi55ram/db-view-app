/**
 * Debounce utilities
 *
 * Provides debounce and throttle functions for rate-limiting.
 */

/**
 * Debounced function type
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  /** Cancels any pending invocation */
  cancel: () => void;
  /** Immediately invokes the pending function */
  flush: () => void;
  /** Returns true if there's a pending invocation */
  pending: () => boolean;
}

/**
 * Creates a debounced version of a function.
 *
 * The debounced function delays invoking the provided function
 * until after the specified wait time has elapsed since the last
 * time it was invoked.
 *
 * @param fn - Function to debounce
 * @param wait - Wait time in milliseconds
 * @param options - Options for debouncing
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((term: string) => {
 *   console.log('Searching for:', term);
 * }, 300);
 *
 * // Rapid calls
 * debouncedSearch('h');
 * debouncedSearch('he');
 * debouncedSearch('hel');
 * debouncedSearch('hello');
 * // Only logs: 'Searching for: hello' (after 300ms)
 *
 * // Cancel pending call
 * debouncedSearch.cancel();
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
  options?: {
    /** Call on the leading edge instead of trailing */
    leading?: boolean;
    /** Call on the trailing edge (default: true) */
    trailing?: boolean;
    /** Maximum time to wait before invoking */
    maxWait?: number;
  }
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options || {};

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  let lastInvokeTime = 0;

  function invoke(): void {
    if (lastArgs === null) return;

    const args = lastArgs;
    lastArgs = null;
    lastInvokeTime = Date.now();

    fn(...args);
  }

  function leadingEdge(time: number): void {
    lastInvokeTime = time;

    if (leading) {
      invoke();
    }

    if (maxWait !== undefined) {
      maxTimeoutId = setTimeout(() => {
        if (trailing && lastArgs !== null) {
          invoke();
        }
        timeoutId = null;
        maxTimeoutId = null;
      }, maxWait);
    }
  }

  function trailingEdge(): void {
    timeoutId = null;

    if (trailing && lastArgs !== null) {
      invoke();
    }

    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
  }

  function debounced(...args: Parameters<T>): void {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        leadingEdge(time);
      }
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(trailingEdge, wait);
  }

  function shouldInvoke(time: number): boolean {
    if (lastCallTime === null) return true;

    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      timeSinceLastCall >= wait ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    lastArgs = null;
    lastCallTime = null;
  };

  debounced.flush = (): void => {
    if (timeoutId !== null) {
      trailingEdge();
    }
  };

  debounced.pending = (): boolean => {
    return timeoutId !== null;
  };

  return debounced;
}

/**
 * Creates a throttled version of a function.
 *
 * The throttled function only invokes the provided function
 * at most once per wait period.
 *
 * @param fn - Function to throttle
 * @param wait - Minimum wait time between invocations
 * @param options - Options for throttling
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll position:', window.scrollY);
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 * // Logs at most once per 100ms while scrolling
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
  options?: {
    /** Call on the leading edge (default: true) */
    leading?: boolean;
    /** Call on the trailing edge (default: true) */
    trailing?: boolean;
  }
): DebouncedFunction<T> {
  const { leading = true, trailing = true } = options || {};

  return debounce(fn, wait, {
    leading,
    trailing,
    maxWait: wait,
  });
}

/**
 * Creates a function that only runs once.
 *
 * @param fn - Function to run once
 * @returns Function that only executes on first call
 *
 * @example
 * ```typescript
 * const initialize = once(() => {
 *   console.log('Initializing...');
 *   return { ready: true };
 * });
 *
 * initialize(); // Logs 'Initializing...' and returns { ready: true }
 * initialize(); // Returns { ready: true } without logging
 * ```
 */
export function once<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  let called = false;
  let result: ReturnType<T>;

  return (...args: Parameters<T>): ReturnType<T> => {
    if (!called) {
      called = true;
      result = fn(...args) as ReturnType<T>;
    }
    return result;
  };
}
