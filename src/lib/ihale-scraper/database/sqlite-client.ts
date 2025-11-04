// ============================================================================
// SQLITE DATABASE CLIENT
// İhale scraper için yerel database işlemleri
// ============================================================================

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { ScrapedTender, CategorizedTender, TenderInsertPayload, TenderItem } from '../types';

// Database path - proje root'unda data klasörü
const DB_PATH = path.join(process.cwd(), 'data', 'ihale-scraper.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src/lib/ihale-scraper/database/schema.sql');
const INIT_LOCK_FILE = path.join(process.cwd(), 'data', '.db-initialized'); // 🔒 Init lock file

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============================================================================
// DATABASE SINGLETON (Global scope for Next.js hot reload persistence)
// ============================================================================

// 🔒 Use global scope to persist across Next.js module reloads
declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: Database.Database | undefined;
  // eslint-disable-next-line no-var
  var __dbSchemaInitialized: boolean | undefined;
}

export function getDatabase(): Database.Database {
  // Use global instance if available (prevents re-initialization)
  if (!global.__dbInstance) {
    console.log('🔧 Opening database at:', DB_PATH);
    global.__dbInstance = new Database(DB_PATH);
    global.__dbInstance.pragma('journal_mode = WAL'); // Better concurrency
    global.__dbInstance.pragma('foreign_keys = ON');  // Enable foreign keys
  }

  // Initialize schema ONLY ONCE using file-based lock
  if (!global.__dbSchemaInitialized) {
    // Check if already initialized (file lock exists)
    if (fs.existsSync(INIT_LOCK_FILE)) {
      global.__dbSchemaInitialized = true;
      return global.__dbInstance;
    }

    // Check if tables already exist in database
    const tableCheck = global.__dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ihale_listings'").get();

    if (!tableCheck) {
      console.log('🔧 Initializing database schema for the first time...');
      initializeSchema(global.__dbInstance);

      // Create lock file to prevent re-initialization
      fs.writeFileSync(INIT_LOCK_FILE, new Date().toISOString());
    }

    global.__dbSchemaInitialized = true;
  }

  return global.__dbInstance;
}

function initializeSchema(db: Database.Database) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  console.log('✅ Database schema initialized');
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

export class TenderDatabase {
  /**
   * Insert new tender
   */
  static async insertTender(tender: TenderInsertPayload): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const db = getDatabase();

      // 🆕 UPSERT: INSERT OR UPDATE if source_id already exists
      const insertStmt = db.prepare(`
        INSERT INTO ihale_listings (
          source, source_id, source_url,
          title, organization, organization_city, registration_number,
          tender_type, procurement_type, category,
          announcement_date, tender_date, deadline_date,
          budget, currency,
          is_catering, catering_confidence, ai_categorization_reasoning,
          specification_url, announcement_text,
          total_items, total_meal_quantity, estimated_budget_from_items,
          ai_analyzed, ai_analyzed_at,
          raw_json, is_active
        ) VALUES (
          @source, @source_id, @source_url,
          @title, @organization, @organization_city, @registration_number,
          @tender_type, @procurement_type, @category,
          @announcement_date, @tender_date, @deadline_date,
          @budget, @currency,
          @is_catering, @catering_confidence, @ai_categorization_reasoning,
          @specification_url, @announcement_text,
          @total_items, @total_meal_quantity, @estimated_budget_from_items,
          @ai_analyzed, @ai_analyzed_at,
          @raw_json, @is_active
        )
        ON CONFLICT(source, source_id) DO UPDATE SET
          source_url = excluded.source_url,
          title = excluded.title,
          organization = excluded.organization,
          organization_city = excluded.organization_city,
          registration_number = COALESCE(excluded.registration_number, registration_number),
          tender_type = COALESCE(excluded.tender_type, tender_type),
          procurement_type = COALESCE(excluded.procurement_type, procurement_type),
          category = COALESCE(excluded.category, category),
          announcement_date = COALESCE(excluded.announcement_date, announcement_date),
          tender_date = COALESCE(excluded.tender_date, tender_date),
          deadline_date = COALESCE(excluded.deadline_date, deadline_date),
          budget = COALESCE(excluded.budget, budget),
          currency = excluded.currency,
          is_catering = excluded.is_catering,
          catering_confidence = COALESCE(excluded.catering_confidence, catering_confidence),
          ai_categorization_reasoning = COALESCE(excluded.ai_categorization_reasoning, ai_categorization_reasoning),
          specification_url = COALESCE(excluded.specification_url, specification_url),
          announcement_text = COALESCE(excluded.announcement_text, announcement_text),
          total_items = COALESCE(excluded.total_items, total_items),
          total_meal_quantity = COALESCE(excluded.total_meal_quantity, total_meal_quantity),
          estimated_budget_from_items = COALESCE(excluded.estimated_budget_from_items, estimated_budget_from_items),
          ai_analyzed = excluded.ai_analyzed,
          ai_analyzed_at = COALESCE(excluded.ai_analyzed_at, ai_analyzed_at),
          raw_json = excluded.raw_json,
          is_active = excluded.is_active,
          last_updated_at = CURRENT_TIMESTAMP
      `);

      // Extract registration number from raw_json if exists
      let registrationNumber = null;
      if (tender.raw_json && tender.raw_json['Kayıt no']) {
        registrationNumber = tender.raw_json['Kayıt no'];
      }

      // Helper: Convert date to SQLite-compatible string
      const dateToString = (date: any): string | null => {
        if (!date) return null;
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toISOString();
        return null; // Skip invalid date types
      };

      // 🔥 CLEAN raw_json: Remove all Date objects and convert to plain JSON
      const cleanRawJson = (obj: any): any => {
        if (!obj) return null;
        if (obj instanceof Date) return obj.toISOString();
        if (Array.isArray(obj)) return obj.map(cleanRawJson);
        if (typeof obj === 'object') {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            cleaned[key] = cleanRawJson(value);
          }
          return cleaned;
        }
        return obj;
      };

      // 🔥 SAFE NUMBER: Ensure field is a valid number or null
      const toSafeNumber = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        return isNaN(num) ? null : num;
      };

      // 🔥 SAFE STRING: Ensure field is a string or null
      const toSafeString = (val: any): string | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string') return val;
        return String(val);
      };

      const result = insertStmt.run({
        source: toSafeString(tender.source) || 'unknown',
        source_id: toSafeString(tender.source_id)?.substring(0, 200) || null,
        source_url: toSafeString(tender.source_url),
        title: toSafeString(tender.title) || 'Belirtilmemiş',
        organization: toSafeString(tender.organization) || 'Belirtilmemiş',
        organization_city: toSafeString(tender.organization_city),
        registration_number: toSafeString(registrationNumber),
        tender_type: toSafeString(tender.tender_type),
        procurement_type: toSafeString(tender.procurement_type),
        category: toSafeString(tender.category),
        // ✅ TARİH DÜZELTMESİ: Date objelerini ISO string'e çevir
        announcement_date: dateToString(tender.announcement_date),
        tender_date: dateToString(tender.tender_date),
        deadline_date: dateToString(tender.deadline_date),
        budget: toSafeNumber(tender.budget),
        currency: toSafeString(tender.currency) || 'TRY',
        is_catering: tender.is_catering ? 1 : 0,
        catering_confidence: toSafeNumber(tender.catering_confidence),
        ai_categorization_reasoning: toSafeString(tender.ai_categorization_reasoning),
        specification_url: toSafeString(tender.specification_url),
        announcement_text: toSafeString(tender.announcement_text),
        total_items: toSafeNumber(tender.total_items) || 0,
        total_meal_quantity: toSafeNumber(tender.total_meal_quantity),
        estimated_budget_from_items: toSafeNumber(tender.estimated_budget_from_items),
        ai_analyzed: tender.ai_analyzed ? 1 : 0,
        ai_analyzed_at: toSafeString(tender.ai_analyzed_at),
        raw_json: tender.raw_json ? JSON.stringify(cleanRawJson(tender.raw_json)) : null,
        is_active: tender.is_active !== false ? 1 : 0,
      });

      const insertedId = result.lastInsertRowid.toString();
      console.log(`✅ Tender inserted: ${insertedId}`);

      // Insert tender items if exists
      if (tender.raw_json?.items && Array.isArray(tender.raw_json.items)) {
        await this.bulkInsertTenderItems([{ id: insertedId }], [tender]);
      }

      return { success: true, id: insertedId };
    } catch (error: any) {
      // Check for duplicate (UNIQUE constraint)
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        console.log(`⚠️ Duplicate tender (source_id: ${tender.source_id})`);
        return { success: false, error: 'DUPLICATE' };
      }

      console.error('Insert error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk insert tenders (optimized with transaction)
   */
  static async bulkInsertTenders(tenders: TenderInsertPayload[]): Promise<{ inserted: number; duplicates: number; errors: number }> {
    let inserted = 0;
    let duplicates = 0;
    let errors = 0;

    console.log(`\n💾 Bulk insert: ${tenders.length} tenders`);

    const db = getDatabase();

    // Use transaction for better performance
    const insertMany = db.transaction((tenderList: TenderInsertPayload[]) => {
      for (const tender of tenderList) {
        const result = this.insertTender(tender);
        // Note: We need to await this, but transactions are synchronous in better-sqlite3
      }
    });

    // For better error handling, insert one by one
    for (const tender of tenders) {
      const result = await this.insertTender(tender);
      if (result.success) inserted++;
      else if (result.error === 'DUPLICATE') duplicates++;
      else errors++;
    }

    console.log(`\n📊 Bulk insert sonuçları:`);
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   ⚠️  Duplicates: ${duplicates}`);
    console.log(`   ❌ Errors: ${errors}`);

    return { inserted, duplicates, errors };
  }

  /**
   * Check if tender exists
   */
  static async tenderExists(source: string, sourceId: string): Promise<boolean> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id FROM ihale_listings
      WHERE source = ? AND source_id = ?
    `);
    const result = stmt.get(source, sourceId);
    return !!result;
  }

  /**
   * Get tender by ID
   */
  static async getTenderById(id: string): Promise<any> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM ihale_listings WHERE id = ?');
    const result = stmt.get(id);

    if (result && (result as any).raw_json) {
      (result as any).raw_json = JSON.parse((result as any).raw_json);
    }

    return result || null;
  }

  /**
   * Get recent tenders
   */
  static async getRecentTenders(limit: number = 50): Promise<any[]> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM ihale_listings
      WHERE is_catering = 1 AND is_active = 1
      ORDER BY first_seen_at DESC
      LIMIT ?
    `);
    const results = stmt.all(limit);

    return results.map((r: any) => ({
      ...r,
      raw_json: r.raw_json ? JSON.parse(r.raw_json) : null,
    }));
  }

  /**
   * Get tenders with filters
   */
  static async getTendersFiltered(filters: {
    isCatering?: boolean;
    minBudget?: number;
    maxBudget?: number;
    city?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const db = getDatabase();

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any = {};

    if (filters.isCatering !== undefined) {
      conditions.push('is_catering = @isCatering');
      params.isCatering = filters.isCatering ? 1 : 0;
    }

    // 🆕 REMOVED DATE FILTER - Show all tenders (past and active)
    // Previously filtered by: deadline_date >= today OR tender_date >= today
    // Now showing all 214 tenders, not just the 72 active ones
    // Future: Add UI toggle for "Show expired tenders"

    if (filters.minBudget) {
      conditions.push('budget >= @minBudget');
      params.minBudget = filters.minBudget;
    }

    if (filters.maxBudget) {
      conditions.push('budget <= @maxBudget');
      params.maxBudget = filters.maxBudget;
    }

    if (filters.city) {
      conditions.push('organization_city = @city');
      params.city = filters.city;
    }

    if (filters.source) {
      conditions.push('source = @source');
      params.source = filters.source;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM ihale_listings ${whereClause}`);
    const countResult = countStmt.get(params) as { total: number };
    const total = countResult.total;

    // Get data with pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const dataStmt = db.prepare(`
      SELECT * FROM ihale_listings
      ${whereClause}
      ORDER BY deadline_date ASC
      LIMIT @limit OFFSET @offset
    `);

    const results = dataStmt.all({
      ...params,
      limit,
      offset,
    });

    const data = results.map((r: any) => ({
      ...r,
      raw_json: r.raw_json ? JSON.parse(r.raw_json) : null,
    }));

    return { data, total };
  }

  /**
   * Update tender with AI analysis results
   */
  static async updateTenderWithAIAnalysis(
    id: string,
    analysisData: {
      budget?: number;
      announcement_date?: string;
      tender_date?: string;
      deadline_date?: string;
      tender_type?: string;
      procurement_type?: string;
      category?: string;
      specification_url?: string;
      announcement_text?: string;
      is_catering?: boolean;
      catering_confidence?: number;
      ai_categorization_reasoning?: string;
      total_items?: number;
      total_meal_quantity?: number;
      estimated_budget_from_items?: number;
      ai_analyzed?: boolean;
      ai_analyzed_at?: string;
      raw_json?: any;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      // Build update query dynamically
      const updates: string[] = [];
      const params: any = { id };

      if (analysisData.budget !== undefined) {
        updates.push('budget = @budget');
        params.budget = analysisData.budget;
      }
      if (analysisData.announcement_date !== undefined) {
        updates.push('announcement_date = @announcement_date');
        params.announcement_date = analysisData.announcement_date;
      }
      if (analysisData.tender_date !== undefined) {
        updates.push('tender_date = @tender_date');
        params.tender_date = analysisData.tender_date;
      }
      if (analysisData.deadline_date !== undefined) {
        updates.push('deadline_date = @deadline_date');
        params.deadline_date = analysisData.deadline_date;
      }
      if (analysisData.tender_type !== undefined) {
        updates.push('tender_type = @tender_type');
        params.tender_type = analysisData.tender_type;
      }
      if (analysisData.procurement_type !== undefined) {
        updates.push('procurement_type = @procurement_type');
        params.procurement_type = analysisData.procurement_type;
      }
      if (analysisData.category !== undefined) {
        updates.push('category = @category');
        params.category = analysisData.category;
      }
      if (analysisData.specification_url !== undefined) {
        updates.push('specification_url = @specification_url');
        params.specification_url = analysisData.specification_url;
      }
      if (analysisData.announcement_text !== undefined) {
        updates.push('announcement_text = @announcement_text');
        params.announcement_text = analysisData.announcement_text;
      }
      if (analysisData.is_catering !== undefined) {
        updates.push('is_catering = @is_catering');
        params.is_catering = analysisData.is_catering ? 1 : 0;
      }
      if (analysisData.catering_confidence !== undefined) {
        updates.push('catering_confidence = @catering_confidence');
        params.catering_confidence = analysisData.catering_confidence;
      }
      if (analysisData.ai_categorization_reasoning !== undefined) {
        updates.push('ai_categorization_reasoning = @ai_categorization_reasoning');
        params.ai_categorization_reasoning = analysisData.ai_categorization_reasoning;
      }
      if (analysisData.total_items !== undefined) {
        updates.push('total_items = @total_items');
        params.total_items = analysisData.total_items;
      }
      if (analysisData.total_meal_quantity !== undefined) {
        updates.push('total_meal_quantity = @total_meal_quantity');
        params.total_meal_quantity = analysisData.total_meal_quantity;
      }
      if (analysisData.estimated_budget_from_items !== undefined) {
        updates.push('estimated_budget_from_items = @estimated_budget_from_items');
        params.estimated_budget_from_items = analysisData.estimated_budget_from_items;
      }
      if (analysisData.ai_analyzed !== undefined) {
        updates.push('ai_analyzed = @ai_analyzed');
        params.ai_analyzed = analysisData.ai_analyzed ? 1 : 0;
      }
      if (analysisData.ai_analyzed_at !== undefined) {
        updates.push('ai_analyzed_at = @ai_analyzed_at');
        params.ai_analyzed_at = analysisData.ai_analyzed_at;
      }
      if (analysisData.raw_json !== undefined) {
        updates.push('raw_json = @raw_json');
        params.raw_json = JSON.stringify(analysisData.raw_json);
      }

      if (updates.length === 0) {
        return { success: true }; // Nothing to update
      }

      const stmt = db.prepare(`
        UPDATE ihale_listings
        SET ${updates.join(', ')}, last_updated_at = datetime('now')
        WHERE id = @id
      `);

      stmt.run(params);

      return { success: true };
    } catch (error: any) {
      console.error('Update tender with AI analysis error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log scraping run
   */
  static async logScraping(logData: {
    source: string;
    startedAt: Date;
    completedAt: Date;
    status: 'success' | 'failed' | 'partial';
    totalScraped: number;
    newListings: number;
    updatedListings: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO scraping_logs (
          source, started_at, completed_at, status,
          total_scraped, new_listings_count, updated_listings_count,
          error_count, error_message
        ) VALUES (
          @source, @started_at, @completed_at, @status,
          @total_scraped, @new_listings_count, @updated_listings_count,
          @error_count, @error_message
        )
      `);

      stmt.run({
        source: logData.source,
        started_at: logData.startedAt.toISOString(),
        completed_at: logData.completedAt.toISOString(),
        status: logData.status,
        total_scraped: logData.totalScraped,
        new_listings_count: logData.newListings,
        updated_listings_count: logData.updatedListings,
        error_count: logData.errorMessage ? 1 : 0,
        error_message: logData.errorMessage || null,
      });
    } catch (error) {
      console.error('Log scraping error:', error);
    }
  }

  /**
   * Get scraping statistics
   */
  static async getScrapingStats(): Promise<any> {
    const db = getDatabase();

    // Recent runs
    const recentStmt = db.prepare(`
      SELECT * FROM scraping_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recent_runs = recentStmt.all();

    // Total tenders
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM ihale_listings');
    const totalResult = totalStmt.get() as { count: number };

    // Catering tenders
    const cateringStmt = db.prepare('SELECT COUNT(*) as count FROM ihale_listings WHERE is_catering = 1');
    const cateringResult = cateringStmt.get() as { count: number };

    return {
      recent_runs,
      total_tenders: totalResult.count,
      catering_tenders: cateringResult.count,
    };
  }

  /**
   * Search tenders by text (using FTS)
   */
  static async searchTenders(query: string, limit: number = 20): Promise<any[]> {
    const db = getDatabase();

    // Use FTS for better search
    const stmt = db.prepare(`
      SELECT il.* FROM ihale_listings il
      INNER JOIN ihale_listings_fts fts ON il.id = fts.rowid
      WHERE ihale_listings_fts MATCH @query
        AND il.is_catering = 1
      LIMIT @limit
    `);

    const results = stmt.all({ query, limit });

    return results.map((r: any) => ({
      ...r,
      raw_json: r.raw_json ? JSON.parse(r.raw_json) : null,
    }));
  }

  /**
   * Bulk insert tender items
   */
  static async bulkInsertTenderItems(
    insertedTenders: { id: string }[],
    originalPayloads: TenderInsertPayload[]
  ): Promise<void> {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO tender_items (
        tender_id, item_number, item_name, quantity, unit,
        unit_price, total_price
      ) VALUES (
        @tender_id, @item_number, @item_name, @quantity, @unit,
        @unit_price, @total_price
      )
    `);

    let totalItems = 0;

    for (let i = 0; i < insertedTenders.length; i++) {
      const tender = insertedTenders[i];
      const payload = originalPayloads[i];

      if (payload.raw_json?.items && Array.isArray(payload.raw_json.items)) {
        const items = payload.raw_json.items as TenderItem[];

        for (const [index, item] of items.entries()) {
          stmt.run({
            tender_id: tender.id,
            item_number: item.item_number ?? index + 1,
            item_name: item.item_name,
            quantity: item.quantity || null,
            unit: item.unit || null,
            unit_price: item.unit_price || null,
            total_price: item.total_price || null,
          });
          totalItems++;
        }
      }
    }

    if (totalItems > 0) {
      console.log(`   ✅ Inserted ${totalItems} tender items`);
    }
  }

  /**
   * Get tender items for a specific tender
   */
  static async getTenderItems(tenderId: string): Promise<TenderItem[]> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM tender_items
      WHERE tender_id = ?
      ORDER BY item_number ASC
    `);
    return stmt.all(tenderId) as TenderItem[];
  }
}

// Export database instance getter
export { getDatabase };
