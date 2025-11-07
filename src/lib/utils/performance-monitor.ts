/**
 * 📊 Performance Monitor Utility
 * 
 * Browser'da performance metriklerini izlemek için utility
 * React scheduler violation'ları ve main thread bloke süresini ölçer
 * 
 * @module performance-monitor
 */

interface PerformanceMetrics {
  longTaskCount: number;
  averageLongTaskDuration: number;
  maxLongTaskDuration: number;
  totalBlockingTime: number;
  violations: {
    messageHandler: number;
    inputHandler: number;
    idleCallback: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    longTaskCount: 0,
    averageLongTaskDuration: 0,
    maxLongTaskDuration: 0,
    totalBlockingTime: 0,
    violations: {
      messageHandler: 0,
      inputHandler: 0,
      idleCallback: 0
    }
  };

  private longTasks: number[] = [];
  private observer: PerformanceObserver | null = null;
  private violationCount = 0;
  private originalConsoleWarn: typeof console.warn;

  constructor() {
    this.originalConsoleWarn = console.warn;
    this.startMonitoring();
  }

  /**
   * 🚀 Monitoring başlat
   */
  private startMonitoring() {
    if (typeof window === 'undefined') return;

    // 1. Long Task API (main thread >50ms bloke)
    if ('PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = entry.duration;
            
            // Long task threshold: 50ms
            if (duration > 50) {
              this.longTasks.push(duration);
              this.metrics.longTaskCount++;
              this.metrics.totalBlockingTime += duration;
              this.metrics.maxLongTaskDuration = Math.max(
                this.metrics.maxLongTaskDuration,
                duration
              );
              
              // Ortalama hesapla
              this.metrics.averageLongTaskDuration = 
                this.longTasks.reduce((a, b) => a + b, 0) / this.longTasks.length;
            }
          }
        });

        this.observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.log('⚠️ Long Task API desteklenmiyor');
      }
    }

    // 2. Violation message'larını yakala
    this.interceptViolations();
  }

  /**
   * 🎯 Console.warn'ı intercept et (violation mesajlarını say)
   */
  private interceptViolations() {
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      
      if (message.includes('[Violation]')) {
        this.violationCount++;
        
        // Violation tipini tespit et
        if (message.includes('message')) {
          this.metrics.violations.messageHandler++;
        } else if (message.includes('input')) {
          this.metrics.violations.inputHandler++;
        } else if (message.includes('idle')) {
          this.metrics.violations.idleCallback++;
        }
      }
      
      // Orijinal console.warn'ı çağır
      this.originalConsoleWarn.apply(console, args);
    };
  }

  /**
   * 📊 Metrikleri al
   */
  getMetrics(): PerformanceMetrics & { violationCount: number } {
    return {
      ...this.metrics,
      violationCount: this.violationCount
    };
  }

  /**
   * 🧹 Metrikleri sıfırla
   */
  reset() {
    this.longTasks = [];
    this.violationCount = 0;
    this.metrics = {
      longTaskCount: 0,
      averageLongTaskDuration: 0,
      maxLongTaskDuration: 0,
      totalBlockingTime: 0,
      violations: {
        messageHandler: 0,
        inputHandler: 0,
        idleCallback: 0
      }
    };
  }

  /**
   * 📈 Rapor oluştur
   */
  generateReport(): string {
    const m = this.metrics;
    
    return `
📊 PERFORMANCE REPORT
=====================
⏱️  Long Tasks: ${m.longTaskCount}
⌛ Avg Duration: ${m.averageLongTaskDuration.toFixed(0)}ms
🔥 Max Duration: ${m.maxLongTaskDuration.toFixed(0)}ms
🚫 Total Blocking Time: ${m.totalBlockingTime.toFixed(0)}ms

⚠️  VIOLATIONS
-------------
📬 Message Handler: ${m.violations.messageHandler}
⌨️  Input Handler: ${m.violations.inputHandler}
⏰ Idle Callback: ${m.violations.idleCallback}
📊 Total Violations: ${this.violationCount}

${this.violationCount === 0 ? '✅ NO VIOLATIONS - OPTIMIZED!' : '⚠️ Violations detected'}
${m.longTaskCount === 0 ? '✅ NO LONG TASKS - SMOOTH!' : `⚠️ ${m.longTaskCount} long tasks detected`}
`;
  }

  /**
   * 🛑 Monitoring durdur
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Console.warn'ı geri yükle
    console.warn = this.originalConsoleWarn;
  }
}

// Global singleton instance
let monitorInstance: PerformanceMonitor | null = null;

/**
 * 🎯 Performance monitor'ı başlat
 */
export function startPerformanceMonitoring(): PerformanceMonitor {
  if (typeof window === 'undefined') {
    throw new Error('Performance monitoring only works in browser');
  }
  
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
    console.log('📊 Performance monitoring started');
  }
  
  return monitorInstance;
}

/**
 * 📊 Metrikleri al
 */
export function getPerformanceMetrics() {
  if (!monitorInstance) {
    throw new Error('Performance monitoring not started. Call startPerformanceMonitoring() first');
  }
  
  return monitorInstance.getMetrics();
}

/**
 * 📈 Rapor yazdır
 */
export function printPerformanceReport() {
  if (!monitorInstance) {
    throw new Error('Performance monitoring not started');
  }
  
  console.log(monitorInstance.generateReport());
}

/**
 * 🧹 Metrikleri sıfırla
 */
export function resetPerformanceMetrics() {
  if (monitorInstance) {
    monitorInstance.reset();
    console.log('🧹 Performance metrics reset');
  }
}

/**
 * 🛑 Monitoring durdur
 */
export function stopPerformanceMonitoring() {
  if (monitorInstance) {
    monitorInstance.stop();
    monitorInstance = null;
    console.log('🛑 Performance monitoring stopped');
  }
}

// Browser console'dan kullanım için global expose et
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = {
    start: startPerformanceMonitoring,
    getMetrics: getPerformanceMetrics,
    printReport: printPerformanceReport,
    reset: resetPerformanceMetrics,
    stop: stopPerformanceMonitoring
  };
  
  console.log(`
🎯 Performance Monitor kullanımı:
- performanceMonitor.start()       → Monitoring başlat
- performanceMonitor.getMetrics()  → Metrikleri gör
- performanceMonitor.printReport() → Rapor yazdır
- performanceMonitor.reset()       → Sıfırla
- performanceMonitor.stop()        → Durdur
  `);
}
