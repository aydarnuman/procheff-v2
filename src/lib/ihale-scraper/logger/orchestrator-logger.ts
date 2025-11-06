// ============================================================================
// ORCHESTRATOR LOGGER
// Structured logging for scraper operations with file output
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  data?: any;
  duration?: number;
}

export class OrchestratorLogger {
  private logDir: string;
  private sessionId: string;
  private logFile: string;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.logDir = path.join(process.cwd(), 'logs', 'orchestrator');
    
    // Create logs directory
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Create session log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logDir, `${this.sessionId}_${timestamp}.log`);

    // Auto-flush buffer every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);

    this.info('orchestrator', 'Logger initialized', { sessionId: this.sessionId });
  }

  private createEntry(level: LogLevel, source: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      data,
    };
  }

  private formatEntry(entry: LogEntry): string {
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅',
    }[entry.level];

    let line = `[${entry.timestamp}] ${emoji} [${entry.source}] ${entry.message}`;
    
    if (entry.duration) {
      line += ` (${entry.duration}ms)`;
    }

    if (entry.data) {
      line += `\n   Data: ${JSON.stringify(entry.data, null, 2).split('\n').join('\n   ')}`;
    }

    return line;
  }

  private write(entry: LogEntry): void {
    // Console output
    const formatted = this.formatEntry(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }

    // Buffer for file write
    this.buffer.push(entry);
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    try {
      const lines = this.buffer.map(e => this.formatEntry(e)).join('\n') + '\n';
      fs.appendFileSync(this.logFile, lines, 'utf-8');
      this.buffer = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  debug(source: string, message: string, data?: any): void {
    this.write(this.createEntry('debug', source, message, data));
  }

  info(source: string, message: string, data?: any): void {
    this.write(this.createEntry('info', source, message, data));
  }

  warn(source: string, message: string, data?: any): void {
    this.write(this.createEntry('warn', source, message, data));
  }

  error(source: string, message: string, data?: any): void {
    this.write(this.createEntry('error', source, message, data));
  }

  success(source: string, message: string, data?: any): void {
    this.write(this.createEntry('success', source, message, data));
  }

  /**
   * Log with duration measurement
   */
  timed(source: string, message: string, startTime: number, data?: any): void {
    const duration = Date.now() - startTime;
    const entry = this.createEntry('info', source, message, data);
    entry.duration = duration;
    this.write(entry);
  }

  /**
   * Get log file path for tail monitoring
   */
  getLogPath(): string {
    return this.logFile;
  }

  /**
   * Cleanup and close logger
   */
  close(): void {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.info('orchestrator', 'Logger closed');
  }

  /**
   * Generate summary report
   */
  generateSummary(): string {
    const entries = this.buffer;
    const errorCount = entries.filter(e => e.level === 'error').length;
    const warnCount = entries.filter(e => e.level === 'warn').length;
    const successCount = entries.filter(e => e.level === 'success').length;

    return `
📊 Session Summary: ${this.sessionId}
   Errors: ${errorCount}
   Warnings: ${warnCount}
   Success: ${successCount}
   Total Logs: ${entries.length}
   Log File: ${this.logFile}
    `.trim();
  }
}

/**
 * Helper: Clean old log files (keep last 30 days)
 */
export function cleanOldLogs(daysToKeep: number = 30): void {
  const logDir = path.join(process.cwd(), 'logs', 'orchestrator');
  if (!fs.existsSync(logDir)) return;

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(logDir);
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 Cleaned ${deletedCount} old log files`);
  }
}
