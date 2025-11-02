'use client';

import { useEffect } from 'react';
import { validateCacheVersion, clearCacheInDevelopment } from '@/lib/utils/cache-manager';

/**
 * 🧹 Cache Provider - Sayfa yüklendiğinde cache'i kontrol eder
 */
export function CacheProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // AGRESIF TEMİZLİK: Sadece ilk yüklemede cache kontrol et
    if (typeof window !== 'undefined') {
      const currentVersion = localStorage.getItem('procheff_cache_version');
      const isReloading = sessionStorage.getItem('procheff_is_reloading');

      // Eğer reload işlemi devam ediyorsa, bir daha reload yapma
      if (isReloading === 'true') {
        sessionStorage.removeItem('procheff_is_reloading');
        return;
      }

      // Version 5.0.0 değilse veya hiç yoksa, HER ŞEYİ TEMİZLE
      if (currentVersion !== '5.0.0') {
        console.log('🚨 ESKİ CACHE TESPİT EDİLDİ - ZORLA TEMİZLENİYOR...');

        // Reload flag'i set et
        sessionStorage.setItem('procheff_is_reloading', 'true');

        // Tüm localStorage'ı temizle
        localStorage.clear();

        console.log('  🗑️  localStorage temizlendi');

        // Yeni versiyonu set et
        localStorage.setItem('procheff_cache_version', '5.0.0');

        console.log('✅ CACHE TEMİZLENDİ - SAYFA YENİLENİYOR...');

        // Normal reload
        window.location.reload();
        return;
      }
    }

    // Cache versiyonunu kontrol et
    const isValid = validateCacheVersion();

    if (!isValid) {
      console.log('🔄 Cache temizlendi, sayfa yenileniyor...');
      window.location.reload();
    }

    // Development mode'da eski cache'leri temizle
    clearCacheInDevelopment();
  }, []);

  return <>{children}</>;
}
