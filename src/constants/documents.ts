/**
 * Döküman işlemleri için sabit değerler
 *
 * Problem: Magic numbers/strings kod boyunca saçılmış (10, 3.5, 'ZIP' vs)
 * Çözüm: Tek yerden yönetilen, type-safe constants
 *
 * Kullanım:
 * ```typescript
 * import { DOCUMENT_CONFIG } from '@/constants/documents';
 *
 * // Pagination
 * const perPage = DOCUMENT_CONFIG.PAGINATION.ITEMS_PER_PAGE; // 10
 *
 * // File type check
 * if (DOCUMENT_CONFIG.FILE_TYPES.ARCHIVE.includes(fileExt)) { ... }
 *
 * // File size calculation
 * const range = DOCUMENT_CONFIG.FILE_SIZE_RANGES.ZIP;
 * const size = range.min + seed * (range.max - range.min);
 * ```
 */

/**
 * Döküman pagination ayarları
 */
export const PAGINATION = {
  /**
   * Sayfa başına gösterilecek döküman sayısı
   */
  ITEMS_PER_PAGE: 10,

  /**
   * Gösterilecek maksimum sayfa numarası (pagination UI)
   */
  MAX_VISIBLE_PAGES: 5,
} as const;

/**
 * Döküman dosya tipleri
 */
export const FILE_TYPES = {
  /**
   * Arşiv dosyası uzantıları
   */
  ARCHIVE: ['zip', 'rar', '7z', 'tar', 'gz'] as const,

  /**
   * Teknik şartname dosya adı pattern'leri
   */
  TEKNIK_SARTNAME: [
    'Teknik Şartname',
    'Teknik_Sartname',
    'teknik_sartname',
    'TEKNIK_SARTNAME',
    'Teknik-Şartname',
  ] as const,

  /**
   * İdari şartname dosya adı pattern'leri
   */
  IDARI_SARTNAME: [
    'İdari Şartname',
    'Idari_Sartname',
    'idari_sartname',
    'IDARI_SARTNAME',
    'İdari-Şartname',
  ] as const,

  /**
   * Zeylname dosya adı pattern'leri
   */
  ZEYILNAME: [
    'Zeyilname',
    'Zeyilname',
    'zeyilname',
    'ZEYILNAME',
  ] as const,

  /**
   * Döküman dosya uzantıları
   */
  DOCUMENT: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'] as const,

  /**
   * Export format uzantıları
   */
  EXPORT: ['csv', 'txt', 'json'] as const,
} as const;

/**
 * Dosya boyutu aralıkları (MB cinsinden)
 * Mock seed hesaplaması için kullanılır
 */
export const FILE_SIZE_RANGES = {
  /**
   * ZIP arşiv dosyaları
   */
  ZIP: {
    min: 3.5,
    max: 6.5,
  },

  /**
   * Teknik şartname dosyaları
   */
  TEKNIK_SARTNAME: {
    min: 2.8,
    max: 4.3,
  },

  /**
   * İdari şartname dosyaları
   */
  IDARI_SARTNAME: {
    min: 1.5,
    max: 2.7,
  },

  /**
   * Zeyilname dosyaları
   */
  ZEYILNAME: {
    min: 0.5,
    max: 1.2,
  },

  /**
   * Genel dökümanlar (default)
   */
  DEFAULT: {
    min: 1.2,
    max: 2.7,
  },

  /**
   * Export dosyaları (CSV/TXT/JSON)
   */
  EXPORT: {
    min: 0.05,
    max: 0.5,
  },
} as const;

/**
 * Batch indirme ayarları
 */
export const BATCH_DOWNLOAD = {
  /**
   * Aynı anda indirilecek döküman sayısı
   */
  CHUNK_SIZE: 3,

  /**
   * Batch'ler arası bekleme süresi (ms)
   */
  DELAY_MS: 100,

  /**
   * Maksimum retry sayısı (hata durumunda)
   */
  MAX_RETRIES: 3,

  /**
   * Retry arası bekleme süresi (ms)
   */
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Export format ayarları
 */
export const EXPORT_FORMATS = {
  CSV: {
    mimeType: 'text/csv',
    extension: '.csv',
    name: 'CSV Dosyası',
  },
  TXT: {
    mimeType: 'text/plain',
    extension: '.txt',
    name: 'Metin Dosyası',
  },
  JSON: {
    mimeType: 'application/json',
    extension: '.json',
    name: 'JSON Dosyası',
  },
} as const;

/**
 * UI animasyon ayarları
 */
export const ANIMATIONS = {
  /**
   * Döküman seçimi feedback süresi (ms)
   */
  SELECTION_DURATION: 150,

  /**
   * Modal açılma/kapanma süresi (ms)
   */
  MODAL_DURATION: 200,

  /**
   * Toast otomatik kapanma süresi (ms)
   */
  TOAST_DURATION: 3000,

  /**
   * Hover transition süresi (ms)
   */
  HOVER_DURATION: 150,
} as const;

/**
 * Virtual URL pattern'leri
 */
export const VIRTUAL_URLS = {
  CSV: 'virtual:csv',
  TXT: 'virtual:txt',
  JSON: 'virtual:json',
} as const;

/**
 * Tüm döküman ayarlarını içeren ana config
 */
export const DOCUMENT_CONFIG = {
  PAGINATION,
  FILE_TYPES,
  FILE_SIZE_RANGES,
  BATCH_DOWNLOAD,
  EXPORT_FORMATS,
  ANIMATIONS,
  VIRTUAL_URLS,
} as const;

/**
 * Type helpers
 */
export type FileExtension = typeof FILE_TYPES.DOCUMENT[number] | typeof FILE_TYPES.ARCHIVE[number];
export type ExportFormat = keyof typeof EXPORT_FORMATS;
export type VirtualURL = typeof VIRTUAL_URLS[keyof typeof VIRTUAL_URLS];
