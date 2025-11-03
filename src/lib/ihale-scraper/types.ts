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

  // Mali bilgiler
  budget?: number;
  currency?: string;

  // Tarihler
  announcement_date?: Date | string;
  deadline_date?: Date | string;
  tender_date?: Date | string;

  // İhale detayları
  tender_type?: string; // "Açık İhale", "Belli İstekliler"
  procurement_type?: string; // "Hizmet Alımı", "Mal Alımı"
  category?: string;

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
 */
export interface AICategorization {
  is_catering: boolean;
  confidence: number;
  reasoning: string;
  keywords_found: string[];
  suggested_category?: string;
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
  budget?: number;
  currency?: string;
  announcement_date?: Date;
  deadline_date?: Date;
  tender_date?: Date;
  tender_type?: string;
  procurement_type?: string;
  category?: string;
  is_catering: boolean;
  catering_confidence: number;
  ai_categorization_reasoning?: string;
  raw_html?: string;
  raw_json?: Record<string, any>;
}
