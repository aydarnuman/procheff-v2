// ============================================================================
// İHALE SCRAPER CONFIGURATION
// 4 farklı kaynak için merkezi yapılandırma
// ============================================================================

export type ScraperSource = 'ilan_gov' | 'ihale_takip' | 'ihalebul' | 'ekap';

export type ScraperMethod =
  | 'json-embedded'     // JSON data HTML içinde
  | 'api-direct'        // Direkt API endpoint
  | 'html-parsing'      // Cheerio ile HTML parse
  | 'puppeteer-heavy';  // Puppeteer (ağır)

export interface ScraperSourceConfig {
  id: ScraperSource;
  name: string;
  enabled: boolean;
  priority: number; // 1 = en yüksek

  // URLs
  baseUrl: string;
  categoryUrl: string;

  // Scraping method
  method: ScraperMethod;

  // Timing
  frequency: string; // Cron expression
  rateLimit: number; // ms
  timeout: number; // ms

  // Features
  features: {
    directCategory?: boolean;
    keywordSearch?: boolean;
    jsonData?: boolean;
    pagination?: boolean;
    loginRequired?: boolean;
    captchaRisk?: boolean;
    totalTenders?: number | string;
  };

  // Filters (opsiyonel)
  filters?: Record<string, any>;
}

export const SCRAPER_CONFIG: Record<ScraperSource, ScraperSourceConfig> = {
  ihalebul: {
    id: 'ihalebul',
    name: 'İhalebul.com',
    enabled: true,
    priority: 1,
    baseUrl: 'https://www.ihalebul.com',
    categoryUrl: '/tenders/search?workcategory_in=15',
    method: 'html-parsing',
    frequency: '0 10,14,19 * * *',
    rateLimit: 3000,
    timeout: 45000,
    features: {
      pagination: true,
      loginRequired: false
    }
  },
  ilan_gov: {
    id: 'ilan_gov',
    name: 'İlan.gov.tr (Resmi Basın İlan Kurumu)',
    enabled: true,
    priority: 2,
    baseUrl: 'https://www.ilan.gov.tr',
    categoryUrl: '/ilan/kategori/437/yemek-hazirlama-dagitim-catering-hizmet-alimi',
    method: 'json-embedded',
    frequency: '0 9,13,18 * * *',
    rateLimit: 1000,
    timeout: 30000,
    features: {
      directCategory: true,
      jsonData: true,
      loginRequired: false,
      totalTenders: 172
    }
  },
  ihale_takip: {
    id: 'ihale_takip',
    name: 'İhaleTakip.com.tr',
    enabled: true,
    priority: 3,
    baseUrl: 'https://ihaletakip.com.tr',
    categoryUrl: '/ihale-ilanlari/yemek+catering/',
    method: 'json-embedded',
    frequency: '0 9,13,18 * * *',
    rateLimit: 2000,
    timeout: 30000,
    features: {
      keywordSearch: true,
      jsonData: true,
      pagination: true,
      loginRequired: false,
      totalTenders: 180
    }
  },
  ekap: {
    id: 'ekap',
    name: 'EKAP (Elektronik Kamu Alımları Platformu)',
    enabled: false,
    priority: 4,
    baseUrl: 'https://ekap.kik.gov.tr',
    categoryUrl: '/EKAP/Ortak/IhaleArama/index.html',
    method: 'puppeteer-heavy',
    frequency: '0 8,12,17 * * *',
    rateLimit: 5000,
    timeout: 60000,
    features: {
      loginRequired: true,
      captchaRisk: true,
      totalTenders: 'N/A'
    }
  }
};
/**
 * Doğu ve Güneydoğu Anadolu şehirleri - Bu şehirler elenir
 */
export const BLOCKED_CITIES = [
  'Ağrı', 'Ardahan', 'Bingöl', 'Bitlis', 'Elazığ', 'Erzincan', 'Erzurum',
  'Hakkâri', 'Iğdır', 'Kars', 'Malatya', 'Muş', 'Tunceli', 'Van',
  'Adıyaman', 'Batman', 'Diyarbakır', 'Mardin', 'Siirt', 'Şanlıurfa', 'Şırnak'
];

// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================

export const GLOBAL_CONFIG = {
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ],
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  },
  rateLimiting: {
    enabled: true,
    defaultDelay: 1000,
    burstLimit: 5
  },
  cache: {
    enabled: true,
    ttl: 3600
  },
  monitoring: {
    enabled: true,
    logLevel: 'info',
    alertOnFailure: true,
    alertEmail: process.env.SCRAPER_ALERT_EMAIL || 'admin@procheff.com'
  },
  aiCategorization: {
    enabled: true,
    confidenceThreshold: 0.7,
    batchSize: 10
  }
};

// ============================================================================
// NOTIFICATION CONFIGURATION
// ============================================================================

export const NOTIFICATION_CONFIG = {
  email: {
    enabled: true,
    provider: 'resend',
    from: 'ihaleler@procheff.com',
    replyTo: 'destek@procheff.com',
    templates: {
      newTender: 'new-tender-alert',
      deadlineApproaching: 'deadline-approaching',
      dailyDigest: 'daily-digest'
    }
  },
  push: {
    enabled: true,
    provider: 'onesignal'
  },
  inApp: {
    enabled: true,
    maxUnreadCount: 50,
    autoMarkReadAfter: 7
  },
  sms: {
    enabled: false,
    provider: 'twilio'
  },
  rules: {
    newTenderImmediate: true,
    deadlineThreshold: 7,
    budgetThreshold: 500000,
    minKisiSayisi: 100
  }
};
/**
 * Belirli bir source için config
 */
export function getScraperConfig(source: ScraperSource): ScraperSourceConfig {
  return SCRAPER_CONFIG[source];
}

/**
 * Priority'ye göre sıralanmış aktif scraper'ları döndür
 */
export function getScrapersByPriority(): ScraperSourceConfig[] {
  return Object.values(SCRAPER_CONFIG)
    .filter(config => config.enabled)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Random user agent seç
 */
export function getRandomUserAgent(): string {
  const agents = GLOBAL_CONFIG.userAgents;
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Retry delay hesapla (exponential backoff)
 */
export function calculateRetryDelay(attemptNumber: number): number {
  const { initialDelay, maxDelay, backoffMultiplier } = GLOBAL_CONFIG.retry;
  const delay = initialDelay * Math.pow(backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, maxDelay);
}
