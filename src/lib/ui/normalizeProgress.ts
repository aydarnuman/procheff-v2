/**
 * Progress Normalization Utility
 * 
 * Problem: undefined/null progress values spam UI with %0/100
 * Solution: Safe normalization with bounds checking
 */

export function normalizeProgress(
  value: number | null | undefined,
  options?: {
    min?: number;
    max?: number;
    fallback?: number;
  }
): number {
  const min = options?.min ?? 0;
  const max = options?.max ?? 100;
  const fallback = options?.fallback ?? 0;

  // Handle invalid input
  if (value === null || value === undefined) {
    return fallback;
  }

  // Handle non-numeric values
  if (typeof value !== "number" || !isFinite(value)) {
    return fallback;
  }

  // Clamp to bounds
  return Math.max(min, Math.min(max, value));
}

/**
 * Format progress percentage for display
 */
export function formatProgress(value: number | null | undefined): string {
  const normalized = normalizeProgress(value);
  return `${normalized.toFixed(0)}%`;
}

/**
 * Check if progress is complete
 */
export function isProgressComplete(value: number | null | undefined): boolean {
  return normalizeProgress(value) >= 100;
}
