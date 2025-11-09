/**
 * Content Validator Configuration
 * 
 * Tüm validasyon eşikleri ve sabitler burada merkezi olarak yönetilir.
 * Procheff-v2 GitHub Copilot Instructions uyumlu.
 * 
 * @version 1.0.0
 * @since Nov 9, 2025
 */

/**
 * Öğün maliyet eşikleri (TL)
 */
export const OGUN_MALIYET = {
  /** Minimum makul öğün maliyeti */
  MIN: 5,
  /** Ortalama öğün maliyeti */
  ORTALAMA: 12,
  /** Maximum öğün maliyeti */
  MAX: 300,
  /** Lüks ihale eşiği */
  LUXURY_THRESHOLD: 200,
} as const;

/**
 * Kişi sayısı eşikleri
 */
export const KISI_SAYISI = {
  /** Şüpheli minimum değer */
  SUSPICIOUS_MIN: 1,
  /** Şüpheli maximum değer (madde numarası olabilir) */
  SUSPICIOUS_MAX: 30,
  /** Küçük ölçekli ihale eşiği */
  SMALL_SCALE: 10,
  /** Anomali eşiği */
  ANOMALY_THRESHOLD: 5000,
  /** Kritik anomali eşiği */
  CRITICAL_THRESHOLD: 10000,
} as const;

/**
 * Gün sayısı eşikleri
 */
export const GUN_SAYISI = {
  /** Minimum uyarı eşiği */
  MIN_WARNING: 7,
  /** Normal maximum (1 yıl) */
  MAX_NORMAL: 365,
  /** Uyarı eşiği (2 yıl) */
  MAX_WARNING: 730,
  /** Kritik eşik (3 yıl) */
  MAX_CRITICAL: 1095,
} as const;

/**
 * Bütçe oran eşikleri (TL)
 */
export const BUDGET_RATIO = {
  /** Maximum kişi başına günlük bütçe */
  MAX_PER_KISI_PER_GUN: 100,
  /** Uyarı eşiği */
  WARNING_THRESHOLD: 75,
} as const;

/**
 * Öğün sayısı eşikleri
 */
export const OGUN_SAYISI = {
  /** Minimum öğün sayısı */
  MIN: 1,
  /** Maximum öğün sayısı (günlük) */
  MAX: 5,
  /** Standart öğün sayısı */
  STANDARD: 3,
} as const;

/**
 * Madde numarası tespiti için regex pattern'leri
 * False positive prevention için güçlendirildi
 */
export const MADDE_PATTERNS = [
  /(\d+)\s*[-–]\s*(yüklenici|madde|fıkra|bent|şartname)/i,
  /madde\s*(\d+)/i,
  /(\d+)\s*nolu\s*madde/i,
  /(\d+)\.\s*madde/i,
  /(\d+)\s*inci\s*madde/i,
  /m\.\s*(\d+)/i, // Kısa format
  /(\d+)\s*(üncü|ıncı|nci|ncı)\s*madde/i, // Türkçe sıra sayıları
] as const;

/**
 * Toplam öğün kontrolü için eşikler
 */
export const TOPLAM_OGUN = {
  /** Kritik minimum */
  MIN_CRITICAL: 1000,
  /** Maximum makul değer */
  MAX_REASONABLE: 50_000_000,
} as const;

/**
 * Merkezi validasyon konfigürasyonu
 * @readonly
 */
export const CONTENT_VALIDATION_CONFIG = {
  OGUN_MALIYET,
  KISI_SAYISI,
  GUN_SAYISI,
  BUDGET_RATIO,
  OGUN_SAYISI,
  MADDE_PATTERNS,
  TOPLAM_OGUN,
} as const;

/**
 * Config versiyonu (değişiklik takibi için)
 */
export const CONFIG_VERSION = '1.0.0';

/**
 * Type export (TypeScript strict mode için)
 */
export type ContentValidationConfigType = typeof CONTENT_VALIDATION_CONFIG;
