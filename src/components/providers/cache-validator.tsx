"use client";

import { useEffect, useState } from 'react';
import { validateCacheVersion, clearCacheInDevelopment } from '@/lib/utils/cache-manager';

/**
 * 🧹 Cache Validator Component
 *
 * Her sayfa yüklenişinde otomatik olarak:
 * 1. Cache versiyonunu kontrol eder
 * 2. Development mode'da stale cache'leri temizler
 * 3. Gerekirse sayfayı yeniler
 */
export function CacheValidator() {
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    // Sadece bir kez çalıştır (strict mode double-run'dan kaçın)
    if (hasRun) return;
    setHasRun(true);

    // Küçük bir gecikme ekle - hydration tamamlansın
    const timer = setTimeout(() => {
      try {
        // 1. Version kontrolü
        const isValid = validateCacheVersion();

        // 2. Development mode cache temizliği
        clearCacheInDevelopment();

        // 3. Eğer cache temizlendiyse sayfa yenile
        if (!isValid) {
          console.log('🔄 Cache invalidated - reloading page in 1 second...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (error) {
        console.error('Cache validation error:', error);
        // Hata olsa bile devam et
      }
    }, 100); // 100ms gecikme

    return () => clearTimeout(timer);
  }, [hasRun]);

  // Bu component UI render etmez
  return null;
}
