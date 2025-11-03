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
  ilan_gov: {
    id: 'ilan_gov',
    name: 'İlan.gov.tr (Resmi Basın İlan Kurumu)',
    enabled: false, // TOO COMPLEX - Angular SPA renders too slow
    priority: 1,
    baseUrl: 'https://www.ilan.gov.tr',
    categoryUrl: '/ilan/kategori/437/yemek-hazirlama-dagitim-catering-hizmet-alimi',
    method: 'json-embedded',
    frequency: '0 9,13,18 * * *', // 09:00, 13:00, 18:00
    rateLimit: 1000,
    timeout: 30000,
    features: {
      directCategory: true,
      jsonData: true,
      loginRequired: false,
      totalTenders: 172,
    },
  },

  ihale_takip: {
    id: 'ihale_takip',
    name: 'İhaleTakip.com.tr',
    enabled: true,
    priority: 2,
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
      totalTenders: 180,
    },
  },

  ihalebul: {
    id: 'ihalebul',
    name: 'İhalebul.com',
    enabled: true,
    priority: 3,
    baseUrl: 'https://www.ihalebul.com',
    categoryUrl: '/tenders/search?workcategory_in=15', // Category 15: Hazır Yemek - Lokantacılık (Güncel ihaleler)
    method: 'html-parsing',
    frequency: '0 10,14,19 * * *', // 10:00, 14:00, 19:00
    rateLimit: 3000,
    timeout: 45000,
    features: {
      pagination: true,
      loginRequired: false,
      totalTenders: 212,
    },
    filters: {
      kategori: 'Hazır Yemek - Lokantacılık',
      ihale_turu: 'Hizmet Alımı',
    },
  },

  ekap: {
    id: 'ekap',
    name: 'EKAP (KIK Resmi)',
    enabled: false, // Başlangıçta kapalı
    priority: 4,
    baseUrl: 'https://ekap.kik.gov.tr',
    categoryUrl: '/EKAP/Ortak/IhaleArama/index.html',
    method: 'puppeteer-heavy',
    frequency: '0 3 * * 0', // Pazar 03:00
    rateLimit: 5000,
    timeout: 120000, // 2 dakika
    features: {
      captchaRisk: true,
      loginRequired: false,
      totalTenders: 'unlimited',
    },
  },
};

// ============================================================================
// CITY FILTERING (Doğu Bölgesi Filtresi)
// ============================================================================

/**
 * Doğu ve Güneydoğu Anadolu şehirleri - Bu şehirler elenir
 */
export const BLOCKED_CITIES = [
  // Doğu Anadolu
  'Ağrı', 'Ardahan', 'Bingöl', 'Bitlis', 'Elazığ', 'Erzincan', 'Erzurum',
  'Hakkâri', 'Iğdır', 'Kars', 'Malatya', 'Muş', 'Tunceli', 'Van',

  // Güneydoğu Anadolu (opsiyonel - isteğe göre)
  'Adıyaman', 'Batman', 'Diyarbakır', 'Mardin', 'Siirt', 'Şanlıurfa', 'Şırnak',
];

// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================

export const GLOBAL_CONFIG = {
  // User Agent rotation
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ],

  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // ms
    maxDelay: 10000, // ms
    backoffMultiplier: 2, // Exponential backoff
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    defaultDelay: 1000, // ms between requests
    burstLimit: 5, // Max concurrent requests
  },

  // Caching
  cache: {
    enabled: true,
    ttl: 3600, // seconds (1 hour)
  },

  // Monitoring
  monitoring: {
    enabled: true,
    logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
    alertOnFailure: true,
    alertEmail: process.env.SCRAPER_ALERT_EMAIL || 'admin@procheff.com',
  },

  // AI Categorization
  aiCategorization: {
    enabled: true,
    confidenceThreshold: 0.7, // Minimum confidence to mark as catering
    batchSize: 10, // Kaç ihale aynı anda kategorize edilecek
  },
};

// ============================================================================
// NOTIFICATION CONFIGURATION
// ============================================================================

export const NOTIFICATION_CONFIG = {
  // Email
  email: {
    enabled: true,
    provider: 'resend', // 'resend' | 'sendgrid' | 'ses'
    from: 'ihaleler@procheff.com',
    replyTo: 'destek@procheff.com',
    templates: {
      newTender: 'new-tender-alert',
      deadlineApproaching: 'deadline-approaching',
      dailyDigest: 'daily-digest',
    },
  },

  // Push Notifications
  push: {
    enabled: false, // İleride eklenecek
    provider: 'onesignal',
  },

  // In-App Notifications
  inApp: {
    enabled: true,
    maxUnreadCount: 50,
    autoMarkReadAfter: 7, // days
  },

  // SMS (Opsiyonel)
  sms: {
    enabled: false,
    provider: 'twilio',
  },

  // Notification Rules
  rules: {
    newTenderImmediate: true, // Yeni ihale bulununca hemen bildir
    deadlineThreshold: 7, // days (7 gün kala bildir)
    budgetThreshold: 500000, // TL (Bu tutarın üzerinde bildir)
    minKisiSayisi: 100, // Minimum kişi sayısı
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Enabled scrapers listesi
 */
export function getEnabledScrapers(): ScraperSourceConfig[] {
  return Object.values(SCRAPER_CONFIG).filter(config => config.enabled);
}

/**
 * Priority sırasına göre scrapers
 */
export function getScrapersByPriority(): ScraperSourceConfig[] {
  return getEnabledScrapers().sort((a, b) => a.priority - b.priority);
}

/**
 * Belirli bir source için config
 */
export function getScraperConfig(source: ScraperSource): ScraperSourceConfig {
  return SCRAPER_CONFIG[source];
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
