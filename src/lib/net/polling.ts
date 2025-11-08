/**
 * Network Polling Utilities
 * 
 * PROBLEM: Agresif setInterval (1-2s) causes scheduler violations
 * SOLUTION: SWR-style "revalidate on focus + background refresh"
 * 
 * Benefits:
 * - Respectful polling (60s default)
 * - Auto-cleanup on unmount
 * - Focus-based refresh
 */

export interface PollingOptions {
  interval?: number; // milliseconds (default: 60000 = 1 min)
  onError?: (error: Error) => void;
  enabled?: boolean;
  revalidateOnFocus?: boolean;
}

/**
 * Schedule background refresh with cleanup
 * 
 * @example
 * useEffect(() => {
 *   const cleanup = scheduleRefresh(
 *     () => fetchTenders({ q }),
 *     { interval: 60_000, revalidateOnFocus: true }
 *   );
 *   return cleanup;
 * }, [q, fetchTenders]);
 */
export function scheduleRefresh(
  fn: () => Promise<void>,
  options: PollingOptions = {}
): () => void {
  const {
    interval = 60_000, // 60 seconds
    onError,
    enabled = true,
    revalidateOnFocus = true,
  } = options;

  if (!enabled) {
    return () => {}; // No-op cleanup
  }

  let aborted = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Recursive polling function
  const tick = async () => {
    if (aborted) return;

    try {
      await fn();
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      } else {
        console.error('[Polling] Refresh error:', error);
      }
    }

    // Schedule next tick
    if (!aborted) {
      timeoutId = setTimeout(tick, interval);
    }
  };

  // Focus listener
  const handleFocus = () => {
    if (!aborted && revalidateOnFocus) {
      fn().catch((error) => {
        console.error('[Polling] Focus refresh error:', error);
        if (onError && error instanceof Error) onError(error);
      });
    }
  };

  // Start polling
  timeoutId = setTimeout(tick, interval);

  // Add focus listener
  if (revalidateOnFocus && typeof window !== 'undefined') {
    window.addEventListener('focus', handleFocus);
  }

  // Cleanup function
  return () => {
    aborted = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (revalidateOnFocus && typeof window !== 'undefined') {
      window.removeEventListener('focus', handleFocus);
    }
  };
}

/**
 * Exponential backoff for failed requests
 */
export function exponentialBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = exponentialBackoff(attempt, baseDelay, maxDelay);
        if (onRetry) onRetry(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
