// ============================================================================
// AI OPERATIONS LOGGER
// Detaylı, renkli, actionable log mesajları
// ============================================================================

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

interface LogOptions {
  provider?: 'claude' | 'gemini';
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * AI-specific enhanced logger
 * Terminal'de renkli ve emojili çıktılar verir
 */
export class AILogger {
  private static colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
  };

  private static emojis = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🔍',
    ai: '🤖',
    token: '💰',
    key: '🔑',
    limit: '⏱️',
    cache: '📦',
  };

  /**
   * Format timestamp
   */
  private static timestamp(): string {
    return new Date().toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  /**
   * Log with color and emoji
   */
  private static log(
    level: LogLevel, 
    message: string, 
    options?: LogOptions
  ): void {
    const { provider, operation, metadata } = options || {};
    
    let color = this.colors.white;
    let emoji = this.emojis[level];
    
    switch (level) {
      case 'success':
        color = this.colors.green;
        break;
      case 'warning':
        color = this.colors.yellow;
        break;
      case 'error':
        color = this.colors.red;
        break;
      case 'info':
        color = this.colors.cyan;
        break;
      case 'debug':
        color = this.colors.dim;
        break;
    }

    const providerEmoji = provider === 'claude' ? '🧠' : provider === 'gemini' ? '💎' : '';
    const providerText = provider ? `[${provider.toUpperCase()}]` : '';
    const operationText = operation ? `{${operation}}` : '';
    
    console.log(
      `${this.colors.dim}${this.timestamp()}${this.colors.reset} ` +
      `${emoji} ${color}${message}${this.colors.reset} ` +
      `${providerEmoji} ${this.colors.bright}${providerText}${this.colors.reset} ` +
      `${this.colors.cyan}${operationText}${this.colors.reset}`
    );

    if (metadata && Object.keys(metadata).length > 0) {
      console.log(`   ${this.colors.dim}${JSON.stringify(metadata, null, 2)}${this.colors.reset}`);
    }
  }

  /**
   * Info log
   */
  static info(message: string, options?: LogOptions): void {
    this.log('info', message, options);
  }

  /**
   * Success log
   */
  static success(message: string, options?: LogOptions): void {
    this.log('success', message, options);
  }

  /**
   * Warning log
   */
  static warning(message: string, options?: LogOptions): void {
    this.log('warning', message, options);
  }

  /**
   * Error log
   */
  static error(message: string, options?: LogOptions): void {
    this.log('error', message, options);
  }

  /**
   * Debug log (only in development)
   */
  static debug(message: string, options?: LogOptions): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, options);
    }
  }

  /**
   * API Key validation log
   */
  static apiKeyStatus(
    provider: 'claude' | 'gemini', 
    isValid: boolean, 
    details?: string
  ): void {
    const status = isValid ? '✅ AKTİF' : '❌ GEÇERSİZ';
    const color = isValid ? this.colors.green : this.colors.red;
    
    console.log(
      `${this.emojis.key} ${color}API Anahtar Durumu:${this.colors.reset} ` +
      `${provider.toUpperCase()} ${status}`
    );
    
    if (details) {
      console.log(`   ${this.colors.dim}${details}${this.colors.reset}`);
    }
  }

  /**
   * Token usage log
   */
  static tokenUsage(
    provider: 'claude' | 'gemini',
    inputTokens: number,
    outputTokens: number,
    cost?: number,
    cachedTokens?: number
  ): void {
    const emoji = this.emojis.token;
    const cached = cachedTokens ? ` (${this.emojis.cache} ${cachedTokens.toLocaleString()} önbellekli)` : '';
    
    console.log(
      `${emoji} ${this.colors.cyan}Token Kullanımı:${this.colors.reset} ` +
      `${provider.toUpperCase()} - ` +
      `${this.colors.green}↓${inputTokens.toLocaleString()}${this.colors.reset} / ` +
      `${this.colors.yellow}↑${outputTokens.toLocaleString()}${this.colors.reset}` +
      `${cached}`
    );
    
    if (cost) {
      console.log(`   ${this.colors.dim}Maliyet: ₺${cost.toFixed(4)}${this.colors.reset}`);
    }
  }

  /**
   * Rate limit warning
   */
  static rateLimitWarning(
    provider: 'claude' | 'gemini',
    retryAfter?: number
  ): void {
    const retryText = retryAfter 
      ? ` ${retryAfter} saniye sonra tekrar deneyin` 
      : '';
    
    console.log(
      `${this.emojis.limit} ${this.colors.yellow}İSTEK LİMİTİ AŞILDI:${this.colors.reset} ` +
      `${provider.toUpperCase()}${retryText}`
    );
    console.log(`   ${this.colors.dim}💡 İpucu: İstek sıklığını azaltın veya planınızı yükseltin${this.colors.reset}`);
  }

  /**
   * Quota exceeded error
   */
  static quotaExceeded(
    provider: 'claude' | 'gemini',
    limit: string,
    resetTime?: string
  ): void {
    console.log(
      `${this.emojis.error} ${this.colors.red}${this.colors.bright}KOTA AŞILDI:${this.colors.reset} ` +
      `${provider.toUpperCase()} - ${limit}`
    );
    
    if (resetTime) {
      console.log(`   ${this.colors.dim}Sıfırlanma zamanı: ${resetTime}${this.colors.reset}`);
    }
    
    console.log(`   ${this.colors.dim}💡 İpucu: Kota sıfırlanmasını bekleyin veya planınızı yükseltin${this.colors.reset}`);
  }

  /**
   * API error with actionable suggestions
   */
  static apiError(
    provider: 'claude' | 'gemini',
    errorCode: string | number,
    message: string,
    suggestion?: string
  ): void {
    console.log(
      `${this.emojis.error} ${this.colors.red}API HATASI:${this.colors.reset} ` +
      `${provider.toUpperCase()} [${errorCode}] ${message}`
    );
    
    if (suggestion) {
      console.log(`   ${this.colors.yellow}💡 ${suggestion}${this.colors.reset}`);
    }
  }

  /**
   * Scraper progress log
   */
  static scraperProgress(
    source: string,
    currentPage: number,
    totalPages: number,
    newTenders: number
  ): void {
    const percentage = Math.round((currentPage / totalPages) * 100);
    const progress = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    console.log(
      `${this.emojis.info} ${this.colors.cyan}Scraper İlerlemesi:${this.colors.reset} ` +
      `${source.toUpperCase()} - Sayfa ${currentPage}/${totalPages} ` +
      `[${progress}] %${percentage} - ${this.colors.green}${newTenders} yeni${this.colors.reset}`
    );
  }

  /**
   * Analysis stage log
   */
  static analysisStage(
    stage: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number
  ): void {
    let emoji = this.emojis.info;
    let color = this.colors.cyan;
    let statusText = 'başladı';
    
    if (status === 'completed') {
      emoji = this.emojis.success;
      color = this.colors.green;
      statusText = 'tamamlandı';
    } else if (status === 'failed') {
      emoji = this.emojis.error;
      color = this.colors.red;
      statusText = 'başarısız';
    }
    
    const durationText = duration ? ` (${(duration / 1000).toFixed(2)}s)` : '';
    
    console.log(
      `${emoji} ${color}Analiz ${statusText}:${this.colors.reset} ` +
      `${stage}${durationText}`
    );
  }
}
