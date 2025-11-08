/**
 * İhale Robotu - Safe Migration Feature Flag
 * 
 * Bu dosya mevcut useState sistemini bozmadan yeni Zustand store'u
 * test etmeyi sağlar. Feature flag ile kontrollü geçiş yapılır.
 * 
 * SAFE MIGRATION STRATEGY:
 * 1. Feature flag ile paralel çalışma
 * 2. A/B testing desteği
 * 3. Instant rollback capability
 * 4. Metric tracking
 */

export const MIGRATION_CONFIG = {
  // 🚦 Feature Flags
  USE_NEW_STORE: process.env.NEXT_PUBLIC_USE_ZUSTAND_STORE === 'true',
  
  // 🧪 A/B Testing (user ID based)
  AB_TEST_ENABLED: false,
  AB_TEST_PERCENTAGE: 0, // 0-100, 0 = disabled
  
  // 📊 Metrics Tracking
  TRACK_PERFORMANCE: true,
  LOG_STATE_CHANGES: process.env.NODE_ENV === 'development',
  
  // ⚠️ Fallback Configuration
  AUTO_FALLBACK_ON_ERROR: true,
  MAX_ERROR_COUNT: 3, // 3 hata sonrası otomatik fallback
  
  // 🔧 Debug Mode
  DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const;

// Performance metrics tracker
export class MigrationMetrics {
  private static metrics: {
    zustandUpdateTime: number[];
    useStateUpdateTime: number[];
    zustandRenderCount: number;
    useStateRenderCount: number;
    errorCount: number;
  } = {
    zustandUpdateTime: [],
    useStateUpdateTime: [],
    zustandRenderCount: 0,
    useStateRenderCount: 0,
    errorCount: 0,
  };

  static trackZustandUpdate(duration: number) {
    this.metrics.zustandUpdateTime.push(duration);
  }

  static trackUseStateUpdate(duration: number) {
    this.metrics.useStateUpdateTime.push(duration);
  }

  static incrementZustandRender() {
    this.metrics.zustandRenderCount++;
  }

  static incrementUseStateRender() {
    this.metrics.useStateRenderCount++;
  }

  static incrementError() {
    this.metrics.errorCount++;
  }

  static getReport() {
    const avgZustand = 
      this.metrics.zustandUpdateTime.length > 0
        ? this.metrics.zustandUpdateTime.reduce((a, b) => a + b, 0) / this.metrics.zustandUpdateTime.length
        : 0;

    const avgUseState = 
      this.metrics.useStateUpdateTime.length > 0
        ? this.metrics.useStateUpdateTime.reduce((a, b) => a + b, 0) / this.metrics.useStateUpdateTime.length
        : 0;

    return {
      zustand: {
        avgUpdateTime: avgZustand.toFixed(2) + 'ms',
        renderCount: this.metrics.zustandRenderCount,
        sampleSize: this.metrics.zustandUpdateTime.length,
      },
      useState: {
        avgUpdateTime: avgUseState.toFixed(2) + 'ms',
        renderCount: this.metrics.useStateRenderCount,
        sampleSize: this.metrics.useStateUpdateTime.length,
      },
      comparison: {
        speedup: avgUseState > 0 ? ((avgUseState - avgZustand) / avgUseState * 100).toFixed(1) + '%' : 'N/A',
        renderReduction: this.metrics.useStateRenderCount > 0 
          ? ((this.metrics.useStateRenderCount - this.metrics.zustandRenderCount) / this.metrics.useStateRenderCount * 100).toFixed(1) + '%' 
          : 'N/A',
      },
      errors: this.metrics.errorCount,
    };
  }

  static reset() {
    this.metrics = {
      zustandUpdateTime: [],
      useStateUpdateTime: [],
      zustandRenderCount: 0,
      useStateRenderCount: 0,
      errorCount: 0,
    };
  }

  static shouldFallback(): boolean {
    return MIGRATION_CONFIG.AUTO_FALLBACK_ON_ERROR && 
           this.metrics.errorCount >= MIGRATION_CONFIG.MAX_ERROR_COUNT;
  }
}

// A/B Test Helper
export function shouldUseNewStore(userId?: string): boolean {
  // Feature flag override
  if (MIGRATION_CONFIG.USE_NEW_STORE) {
    return true;
  }

  // A/B Testing
  if (MIGRATION_CONFIG.AB_TEST_ENABLED && userId) {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bucket = hash % 100;
    return bucket < MIGRATION_CONFIG.AB_TEST_PERCENTAGE;
  }

  return false;
}

// Debug logger
export function debugLog(message: string, data?: any) {
  if (MIGRATION_CONFIG.DEBUG_MODE) {
    console.log(`[MIGRATION] ${message}`, data || '');
  }
}

// Error handler with fallback
export function handleMigrationError(error: Error, context: string) {
  console.error(`[MIGRATION ERROR] ${context}:`, error);
  MigrationMetrics.incrementError();

  if (MigrationMetrics.shouldFallback()) {
    console.warn('[MIGRATION] Auto-fallback triggered due to errors');
    // Trigger fallback (will be implemented in component)
    return true; // Signal fallback needed
  }

  return false;
}

// Performance wrapper
export function withPerformanceTracking<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  isZustand: boolean
): T {
  if (!MIGRATION_CONFIG.TRACK_PERFORMANCE) {
    return fn;
  }

  return ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    const duration = end - start;

    if (isZustand) {
      MigrationMetrics.trackZustandUpdate(duration);
    } else {
      MigrationMetrics.trackUseStateUpdate(duration);
    }

    debugLog(`${name} completed in ${duration.toFixed(2)}ms`, {
      isZustand,
      duration,
    });

    return result;
  }) as T;
}
