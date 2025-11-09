/**
 * Content Validator Logger
 * 
 * Production-safe logging utility.
 * Procheff-v2 coding instructions uyumlu (AILogger pattern).
 * 
 * ⚠️ NEVER use console.log() - Instructions compliance
 * ✅ ALWAYS use AILogger for AI operations
 * 
 * @version 1.0.0
 * @since Nov 9, 2025
 */

import { AILogger } from '@/lib/utils/ai-logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  /** Metadata ekle */
  meta?: Record<string, unknown>;
}

/**
 * ValidationLogger sınıfı
 * AILogger pattern'i takip eder (Instructions uyumlu)
 */
class ValidationLogger {
  private readonly prefix = '[ContentValidator]';
  private readonly isDev = process.env.NODE_ENV !== 'production';

  /**
   * Debug seviyesi log (sadece development'ta)
   * ✅ AILogger.info kullanır (console.log yerine)
   */
  debug(message: string, options?: LogOptions): void {
    if (!this.isDev) return;
    
    const formatted = this.formatMessage(message, options);
    AILogger.info(`🔍 ${this.prefix} ${formatted}`);
  }

  /**
   * Info seviyesi log
   * ✅ AILogger.info kullanır
   */
  info(message: string, options?: LogOptions): void {
    const formatted = this.formatMessage(message, options);
    AILogger.info(`ℹ️ ${this.prefix} ${formatted}`);
  }

  /**
   * Warning seviyesi log
   * ✅ AILogger.warning kullanır (console.warn yerine)
   */
  warn(message: string, options?: LogOptions): void {
    const formatted = this.formatMessage(message, options);
    AILogger.warning(`⚠️ ${this.prefix} ${formatted}`);
  }

  /**
   * Error seviyesi log
   * ✅ AILogger.error kullanır (console.error yerine)
   */
  error(message: string, error?: Error, options?: LogOptions): void {
    const formatted = this.formatMessage(message, options);
    const errorMsg = error ? `${formatted}\nError: ${error.message}` : formatted;
    AILogger.error(`❌ ${this.prefix} ${errorMsg}`);
  }

  /**
   * Validasyon başlangıç log'u
   */
  validationStart(dataKeys: string[]): void {
    this.debug(`Validasyon başladı. Alanlar: ${dataKeys.join(', ')}`);
  }

  /**
   * Validasyon bitiş log'u
   */
  validationEnd(warningCount: number, duration: number): void {
    const emoji = warningCount === 0 ? '✅' : warningCount < 3 ? '⚠️' : '❌';
    this.info(`${emoji} Validasyon tamamlandı. ${warningCount} uyarı, ${duration}ms`, {
      meta: { warningCount, duration },
    });
  }

  /**
   * Kaynak analiz log'u
   */
  sourceAnalysis(field: string, value: unknown, source?: string): void {
    this.debug(`Kaynak analizi: ${field} = ${value}`, {
      meta: { 
        field, 
        value, 
        sourcePreview: source?.slice(0, 100),
        sourceLength: source?.length 
      },
    });
  }

  /**
   * Auto-fix log'u
   */
  autoFix(field: string, oldValue: unknown, newValue: unknown): void {
    this.info(`🔧 Auto-fix: ${field} ${oldValue} → ${newValue}`, {
      meta: { field, oldValue, newValue },
    });
  }

  /**
   * Pattern match log'u
   */
  patternMatch(field: string, pattern: string, matched: boolean): void {
    this.debug(`Pattern ${matched ? '✓' : '✗'}: ${pattern}`, {
      meta: { field, pattern, matched },
    });
  }

  /**
   * Confidence score log'u
   */
  confidenceScore(field: string, score: number, level: string): void {
    const emoji = score >= 0.8 ? '🟢' : score >= 0.5 ? '🟡' : '🔴';
    this.debug(`${emoji} Confidence: ${field} = ${score.toFixed(2)} (${level})`, {
      meta: { field, score, level },
    });
  }

  /**
   * Message formatla
   */
  private formatMessage(message: string, options?: LogOptions): string {
    if (!options?.meta) return message;

    if (this.isDev) {
      const metaStr = JSON.stringify(options.meta, null, 2);
      return `${message}\n${metaStr}`;
    }

    return message;
  }
}

/**
 * Singleton logger instance
 */
export const validationLogger = new ValidationLogger();
