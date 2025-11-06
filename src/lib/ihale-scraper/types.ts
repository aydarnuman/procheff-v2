// ============================================================================
// İHALE SCRAPER TYPE DEFINITIONS
// Tüm scraper'lar için ortak type'lar
// ============================================================================

import { ScraperSource } from './config';

/**
 * Scrape edilmiş ham ihale verisi
 */
export interface ScrapedTender {
  // Kaynak bilgileri
  source: ScraperSource;
  source_id: string; // Kaynaktaki unique ID
  source_url: string;

  // Temel bilgiler
  title: string;
  organization?: string;
  organization_city?: string;
  registration_number?: string; // İhale kayıt numarası

  // Mali bilgiler
  budget?: number | null;
  currency?: string;

  // Tarihler
  announcement_date?: Date | string;
  deadline_date?: Date | string;
  tender_date?: Date | string;

  // İhale detayları
  tender_type?: string; // "Açık İhale", "Belli İstekliler"
  procurement_type?: string; // "Hizmet Alımı", "Mal Alımı"
  category?: string;

  // Dökümanlar
  specification_url?: string; // Şartname dökümanı indirme linki
  announcement_text?: string; // İhale ilan metni (temiz text)

  // 🆕 Mal/Hizmet listesi özet bilgileri
  total_items?: number; // Toplam kalem sayısı
  total_meal_quantity?: number; // Toplam öğün sayısı (catering için)
  estimated_budget_from_items?: number; // Kalemlerden hesaplanan bütçe

  // Ham veri
  raw_html?: string;
  raw_json?: Record<string, any>;

  // Metadata
  scraped_at?: Date;
}

/**
 * AI ile kategorize edilmiş ihale
 */
export interface CategorizedTender extends ScrapedTender {
  is_catering: boolean;
  catering_confidence: number; // 0-1 arası
  ai_reasoning?: string;
  keywords_found?: string[];
}

/**
 * Scraping sonucu
 */
export interface ScrapeResult {
  source: ScraperSource;
  success: boolean;
  tenders: ScrapedTender[];
  totalScraped: number;
  newTenders: number;
  updatedTenders: number;
  errors: ScrapeError[];
  duration: number; // ms
  startedAt: Date;
  completedAt: Date;
}

/**
 * Scraping hatası
 */
export interface ScrapeError {
  message: string;
  stack?: string;
  url?: string;
  statusCode?: number;
  timestamp: Date;
}

/**
 * Duplicate detection sonucu
 */
export interface DuplicateMatch {
  tender1Id: string;
  tender2Id: string;
  similarityScore: number; // 0-1 arası
  matchingAlgorithm: 'levenshtein' | 'org_date_budget' | 'hybrid';
  matchingFields: string[]; // Hangi alanlar eşleşti
}

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: 'new_tender' | 'deadline_approaching' | 'budget_match' | 'custom';
  tenderId: string;
  tenderTitle: string;
  tenderOrganization?: string;
  tenderBudget?: number;
  tenderDeadline?: Date;
  recipientEmail: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

/**
 * Scraper metrics
 */
export interface ScraperMetrics {
  source: ScraperSource;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  avgDuration: number; // ms
  totalTendersScraped: number;
  newTendersFound: number;
  lastRunAt?: Date;
  nextRunAt?: Date;
  errorRate: number; // 0-1 arası
}

/**
 * AI Categorization result
 * 🆕 Artık hem kategorilendirme HEM veri temizleme bilgilerini içerir!
 */
export interface AICategorization {
  is_catering: boolean;
  confidence: number;
  reasoning: string;
  keywords_found: string[];
  suggested_category?: string;
  // 🆕 Temizlenmiş veri alanları
  cleaned_city?: string | null;
  cleaned_deadline_date?: string | null;
  cleaned_announcement_date?: string | null;
  cleaned_tender_date?: string | null;
}

/**
 * Database insert payload
 */
export interface TenderInsertPayload {
  source: ScraperSource;
  source_id: string;
  source_url: string;
  title: string;
  organization?: string;
  organization_city?: string;
  registration_number?: string; // İhale kayıt numarası
  budget?: number | null;
  currency?: string;
  announcement_date?: Date;
  deadline_date?: Date;
  tender_date?: Date;
  tender_type?: string;
  procurement_type?: string;
  category?: string;
  specification_url?: string; // Şartname dökümanı indirme linki
  announcement_text?: string; // İhale ilan metni (temiz text)
  is_catering: boolean;
  catering_confidence: number;
  ai_categorization_reasoning?: string;
  // 🆕 Mal/Hizmet listesi özet
  total_items?: number;
  total_meal_quantity?: number;
  estimated_budget_from_items?: number;
  raw_html?: string;
  raw_json?: Record<string, any>;
}

/**
 * 🆕 Tender Item (Mal/Hizmet Kalemi)
 * Re-export from item-parser for convenience
 */
export type { TenderItem } from './parsers/item-parser';
