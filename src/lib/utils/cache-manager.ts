/**
 * 🧹 Cache Manager - Kalıcı Cache Temizleme Stratejisi
 *
 * SORUN: localStorage cache'i development'ta sürekli sorun çıkarıyor
 * ÇÖZÜM: Otomatik cache invalidation + version kontrolü
 */

// ⚠️ BU VERSİYONU HER BÜYÜK DEĞİŞİKLİKTE ARTIR!
export const CACHE_VERSION = '3.0.0'; // 🔄 Reasoning field'ı eklendi
export const CACHE_VERSION_KEY = 'procheff_cache_version';

/**
 * Cache versiyonunu kontrol et, eski ise temizle
 */
export function validateCacheVersion(): boolean {
  if (typeof window === 'undefined') return true;

  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);

  if (storedVersion !== CACHE_VERSION) {
    console.log(`🔄 Cache version mismatch: ${storedVersion} → ${CACHE_VERSION}`);
    console.log('🧹 Clearing all cache...');

    // Tüm ProCheff cache'lerini temizle
    const keysToRemove = [
      'ihale-store',
      'ihale_document_text',
      'proposal-store',
      // Yeni cache key'leri buraya ekle
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    // Yeni versiyonu kaydet
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);

    console.log('✅ Cache temizlendi, sayfa yenileniyor...');

    return false; // Cache temizlendi
  }

  return true; // Cache geçerli
}

/**
 * Development mode'da her sayfa yüklenişinde cache'i temizle
 */
export function clearCacheInDevelopment(): void {
  if (typeof window === 'undefined') return;

  // Development mode kontrolü
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    const lastClear = sessionStorage.getItem('last_cache_clear');
    const now = Date.now();

    // Son temizlemeden 5 dakika geçmişse tekrar temizle
    if (!lastClear || now - parseInt(lastClear) > 5 * 60 * 1000) {
      console.log('🔧 Development mode: Clearing stale cache...');

      // Sadece 1 saattan eski cache'leri temizle
      const staleThreshold = now - 60 * 60 * 1000; // 1 saat

      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ihale-') || key.startsWith('proposal-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed.state?.timestamp && parsed.state.timestamp < staleThreshold) {
                console.log(`  🗑️  Removing stale cache: ${key}`);
                localStorage.removeItem(key);
              }
            }
          } catch {
            // JSON parse hatasında da temizle
            localStorage.removeItem(key);
          }
        }
      });

      sessionStorage.setItem('last_cache_clear', now.toString());
    }
  }
}

/**
 * Belirli bir key'in cache'ini temizle
 */
export function clearCache(key: string): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(key);
  console.log(`🧹 Cache cleared: ${key}`);
}

/**
 * Tüm ProCheff cache'lerini temizle (Emergency button)
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return;

  console.log('🚨 EMERGENCY: Clearing all ProCheff cache...');

  Object.keys(localStorage).forEach(key => {
    if (
      key.includes('ihale') ||
      key.includes('proposal') ||
      key.includes('procheff')
    ) {
      localStorage.removeItem(key);
      console.log(`  🗑️  ${key}`);
    }
  });

  sessionStorage.clear();

  console.log('✅ All cache cleared!');
}

/**
 * Cache metadata ekle (timestamp tracking için)
 */
export function setCacheWithMetadata(key: string, data: any): void {
  if (typeof window === 'undefined') return;

  const wrappedData = {
    data,
    metadata: {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      env: process.env.NODE_ENV,
    }
  };

  localStorage.setItem(key, JSON.stringify(wrappedData));
}

/**
 * Cache metadata'sını kontrol ederek oku
 */
export function getCacheWithValidation(key: string): any | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    // Metadata varsa kontrol et
    if (parsed.metadata) {
      const { version, timestamp } = parsed.metadata;

      // Version kontrolü
      if (version !== CACHE_VERSION) {
        console.log(`⚠️  Cache version mismatch for ${key}: ${version} → ${CACHE_VERSION}`);
        localStorage.removeItem(key);
        return null;
      }

      // 24 saatten eski mi?
      const ageInHours = (Date.now() - timestamp) / (1000 * 60 * 60);
      if (ageInHours > 24) {
        console.log(`⚠️  Cache expired for ${key}: ${ageInHours.toFixed(1)} hours old`);
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    }

    // Eski format (metadata yok) - direkt dön
    return parsed;

  } catch (error) {
    console.error(`❌ Failed to parse cache ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
}
