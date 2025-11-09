/**
 * İhale detay içerik validasyon fonksiyonları
 *
 * Bu modül, ihale detay verilerinin kalitesini kontrol eder ve
 * eksik/geçersiz verilerin cache'e kaydedilmesini engeller.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TenderContentData {
  fullText?: string;
  details?: Record<string, any>;
  documents?: Array<any>;
  title?: string;
  organization?: string;
  announcementText?: string; // AI response'da bu isimle gelebilir
  [key: string]: any;
}

/**
 * Login gerekli mi kontrol et
 * NOT: Sayfa menüsünde "Giriş Yap" butonu olabilir, bu false positive vermemeli
 */
function isLoginRequired(text: string): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // Daha spesifik login mesajları (false positive'i azaltmak için)
  const strictLoginKeywords = [
    'lütfen giriş yapın',
    'please sign in',
    'authentication required',
    'giriş yapmanız gerekiyor',
    'you must sign in',
    'login required',
    'şifrenizi girin',
    'enter your password'
  ];

  // Strict keyword varsa kesin login gerekiyor
  if (strictLoginKeywords.some(keyword => lowerText.includes(keyword))) {
    return true;
  }

  // İhale içeriği var mı kontrol et (varsa login gerekmiyor demektir)
  const hasTenderContent = lowerText.includes('ihale bilgileri') ||
                           lowerText.includes('kayıt no') ||
                           lowerText.includes('yaklaşık maliyet') ||
                           lowerText.includes('yayın tarihi') ||
                           lowerText.includes('teklif tarihi');

  // İhale içeriği varsa login gerekmiyor
  if (hasTenderContent) {
    return false;
  }

  // İhale içeriği yoksa ve genel login kelimeleri varsa login gerekiyor olabilir
  const generalLoginKeywords = [
    'kullanıcı adı',
    'şifre',
    'oturum aç'
  ];

  return generalLoginKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * İçerik sadece hata mesajı mı kontrol et
 */
function isErrorContent(text: string): boolean {
  if (!text) return false;

  const errorKeywords = [
    'sayfa bulunamadı',
    'page not found',
    'hata oluştu',
    'error occurred',
    'erişim reddedildi',
    'access denied',
    '404',
    '403',
    '500',
  ];

  const lowerText = text.toLowerCase();
  return errorKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * İhale detay içeriğini validate et
 *
 * @param data - Validate edilecek ihale detay verisi
 * @param options - Validasyon seçenekleri
 * @returns ValidationResult - Validasyon sonucu
 */
export function validateTenderContent(
  data: TenderContentData,
  options: {
    minTextLength?: number;
    minDetailsCount?: number;
    requireDocuments?: boolean;
    strict?: boolean;
  } = {}
): ValidationResult {
  const {
    minTextLength = 100,
    minDetailsCount = 3,
    requireDocuments = false, // Bazı ihalelerde doküman olmayabilir
    strict = false,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Temel varlık kontrolü
  if (!data || typeof data !== 'object') {
    errors.push('Veri objesi geçersiz veya null');
    return { valid: false, errors, warnings };
  }

  // 2. fullText kontrolü (announcementText fallback)
  const fullText = data.fullText || data.announcementText || '';

  if (!fullText) {
    errors.push('fullText alanı boş');
  } else if (fullText.length < minTextLength) {
    errors.push(`fullText çok kısa (${fullText.length} karakter, minimum ${minTextLength})`);
  }

  // 3. Login gerekli mi kontrolü
  // NOT: Eğer details ve documents varsa zaten login başarılı demektir
  // Login kontrolü gereksiz çünkü Puppeteer zaten login oluyor
  if (fullText && data.details && Object.keys(data.details).length < 3) {
    // Sadece details yoksa kontrol et
    const loginCheck = isLoginRequired(fullText);
    if (loginCheck) {
      console.log('🔍 Login check failed for text:', fullText.slice(0, 500));
      errors.push('İçerik login mesajı içeriyor, gerçek veri alınamadı');
    }
  }

  // 4. Hata mesajı kontrolü
  // NOT: Eğer details varsa zaten geçerli veri demektir, hata kontrolü skip
  if (fullText && (!data.details || Object.keys(data.details).length < 3)) {
    if (isErrorContent(fullText)) {
      errors.push('İçerik hata mesajı içeriyor');
    }
  }

  // 5. details kontrolü
  if (!data.details || typeof data.details !== 'object') {
    if (strict) {
      errors.push('details alanı yok veya geçersiz');
    } else {
      warnings.push('details alanı yok veya geçersiz');
    }
  } else {
    const detailsCount = Object.keys(data.details).length;
    if (detailsCount < minDetailsCount) {
      if (strict) {
        errors.push(`details yetersiz (${detailsCount} alan, minimum ${minDetailsCount})`);
      } else {
        warnings.push(`details az bilgi içeriyor (${detailsCount} alan)`);
      }
    }
  }

  // 6. documents kontrolü
  if (requireDocuments) {
    if (!Array.isArray(data.documents)) {
      errors.push('documents dizisi yok veya geçersiz');
    } else if (data.documents.length === 0) {
      if (strict) {
        errors.push('Hiç doküman bulunamadı');
      } else {
        warnings.push('Doküman listesi boş');
      }
    }
  } else {
    // Zorunlu değilse sadece uyarı
    if (!Array.isArray(data.documents) || data.documents.length === 0) {
      warnings.push('Doküman bulunamadı');
    }
  }

  // 7. title kontrolü
  if (!data.title || data.title.trim().length === 0) {
    if (strict) {
      errors.push('title alanı boş');
    } else {
      warnings.push('title alanı boş');
    }
  }

  // 8. organization kontrolü
  if (!data.organization || data.organization.trim().length === 0) {
    warnings.push('organization alanı boş');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validasyon sonucunu loglayan yardımcı fonksiyon
 */
export function logValidationResult(
  context: string,
  result: ValidationResult,
  data?: TenderContentData
): void {
  if (result.valid) {
    console.log(`✅ [${context}] Validasyon başarılı`);
    if (result.warnings.length > 0) {
      console.warn(`⚠️ [${context}] Uyarılar:`, result.warnings);
    }
  } else {
    console.error(`❌ [${context}] Validasyon başarısız:`, result.errors);
    if (result.warnings.length > 0) {
      console.warn(`⚠️ [${context}] Uyarılar:`, result.warnings);
    }
    if (data) {
      console.debug(`[${context}] Veri özeti:`, {
        fullTextLength: data.fullText?.length || 0,
        detailsCount: data.details ? Object.keys(data.details).length : 0,
        documentsCount: Array.isArray(data.documents) ? data.documents.length : 0,
        hasTitle: !!data.title,
        hasOrganization: !!data.organization,
      });
    }
  }
}

/**
 * Cache entry için timestamp ekleyici
 */
export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Cache entry oluştur
 */
export function createCacheEntry<T>(data: T, ttlHours: number = 24): CacheEntry<T> {
  const now = Date.now();
  return {
    data,
    cachedAt: now,
    expiresAt: now + (ttlHours * 60 * 60 * 1000),
  };
}

/**
 * Cache entry expire olmuş mu kontrol et
 */
export function isCacheExpired<T>(entry: CacheEntry<T>): boolean {
  return Date.now() > entry.expiresAt;
}
