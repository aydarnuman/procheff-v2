/**
 * 💾 ANALYSIS CACHE MANAGER
 *
 * Aynı dosyanın tekrar analiz edilmesini önler
 * - File hash based caching
 * - localStorage kullanır
 * - Max 10 analiz cache'lenir (LRU - Least Recently Used)
 * - Cache TTL: 7 gün
 */

interface CacheEntry {
  fileHash: string;
  fileName: string;
  fileSize: number;
  analysisResult: any;
  timestamp: number;
  ttl: number; // milliseconds
}

interface CacheStats {
  totalEntries: number;
  totalSize: number; // bytes
  oldestEntry: number; // timestamp
  newestEntry: number; // timestamp
}

export class AnalysisCache {
  private static readonly CACHE_KEY = 'procheff_analysis_cache';
  private static readonly MAX_ENTRIES = 10;
  private static readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 gün

  /**
   * Generate file hash (basit ama hızlı)
   */
  private static async generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * Get all cache entries
   */
  private static getAllEntries(): CacheEntry[] {
    if (typeof window === 'undefined') return [];

    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return [];

      const entries: CacheEntry[] = JSON.parse(cached);

      // Expire old entries
      const now = Date.now();
      const validEntries = entries.filter(entry => {
        const isExpired = (now - entry.timestamp) > entry.ttl;
        return !isExpired;
      });

      // Eğer expired entry varsa, cache'i güncelle
      if (validEntries.length !== entries.length) {
        console.log(`🗑️ ${entries.length - validEntries.length} expired cache entry silindi`);
        this.saveEntries(validEntries);
      }

      return validEntries;
    } catch (error) {
      console.error('Cache read error:', error);
      return [];
    }
  }

  /**
   * Save entries to localStorage
   */
  private static saveEntries(entries: CacheEntry[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Cache write error:', error);
      // LocalStorage full - clear old cache
      console.warn('⚠️ Cache full, clearing...');
      this.clearCache();
    }
  }

  /**
   * Get cached analysis result
   */
  static async get(file: File): Promise<any | null> {
    const fileHash = await this.generateFileHash(file);
    const entries = this.getAllEntries();

    const cached = entries.find(entry =>
      entry.fileHash === fileHash &&
      entry.fileName === file.name &&
      entry.fileSize === file.size
    );

    if (cached) {
      console.log(`\n💾 CACHE HIT - Analiz cache'den dönüyor!`);
      console.log(`   Dosya: ${file.name}`);
      console.log(`   Boyut: ${Math.round(file.size / 1024)}KB`);
      console.log(`   Cache yaşı: ${Math.round((Date.now() - cached.timestamp) / 1000 / 60)} dakika`);
      return cached.analysisResult;
    }

    console.log(`\n💾 CACHE MISS - Yeni analiz yapılacak`);
    console.log(`   Dosya: ${file.name}`);
    return null;
  }

  /**
   * Save analysis result to cache
   */
  static async set(file: File, analysisResult: any): Promise<void> {
    const fileHash = await this.generateFileHash(file);
    const entries = this.getAllEntries();

    // Aynı dosya varsa güncelle
    const existingIndex = entries.findIndex(entry => entry.fileHash === fileHash);
    if (existingIndex !== -1) {
      entries[existingIndex] = {
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        analysisResult,
        timestamp: Date.now(),
        ttl: this.DEFAULT_TTL
      };
      console.log(`💾 Cache güncellendi: ${file.name}`);
    } else {
      // Yeni entry ekle
      const newEntry: CacheEntry = {
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        analysisResult,
        timestamp: Date.now(),
        ttl: this.DEFAULT_TTL
      };

      entries.push(newEntry);
      console.log(`💾 Cache'e eklendi: ${file.name}`);

      // LRU - En eski entry'leri sil
      if (entries.length > this.MAX_ENTRIES) {
        entries.sort((a, b) => a.timestamp - b.timestamp); // En eski önce
        const removed = entries.splice(0, entries.length - this.MAX_ENTRIES);
        console.log(`🗑️ LRU: ${removed.length} eski entry silindi`);
      }
    }

    this.saveEntries(entries);
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.CACHE_KEY);
    console.log('🗑️ Tüm cache temizlendi');
  }

  /**
   * Get cache stats
   */
  static getStats(): CacheStats {
    const entries = this.getAllEntries();

    if (entries.length === 0) {
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: 0,
        newestEntry: 0
      };
    }

    const totalSize = entries.reduce((sum, entry) => sum + entry.fileSize, 0);
    const timestamps = entries.map(e => e.timestamp);

    return {
      totalEntries: entries.length,
      totalSize,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps)
    };
  }

  /**
   * Print cache stats to console
   */
  static printStats(): void {
    const stats = this.getStats();

    console.log('\n📊 CACHE İSTATİSTİKLERİ');
    console.log(`   Toplam Entry: ${stats.totalEntries}/${this.MAX_ENTRIES}`);
    console.log(`   Toplam Boyut: ${Math.round(stats.totalSize / 1024 / 1024)}MB`);

    if (stats.totalEntries > 0) {
      const oldestAge = Math.round((Date.now() - stats.oldestEntry) / 1000 / 60 / 60);
      const newestAge = Math.round((Date.now() - stats.newestEntry) / 1000 / 60);

      console.log(`   En eski: ${oldestAge} saat önce`);
      console.log(`   En yeni: ${newestAge} dakika önce`);
    }
  }
}
