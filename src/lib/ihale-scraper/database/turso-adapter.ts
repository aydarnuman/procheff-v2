// ============================================================================
// TURSO TENDER DATABASE ADAPTER
// Wraps turso-client to match sqlite-client API
// ============================================================================

import { getTursoClient, executeQuery, executeQuerySingle, executeWrite } from './turso-client';
import type { ScrapedTender, CategorizedTender, TenderItem } from '../types';
import type { InValue } from '@libsql/client';

// ============================================================================
// TYPE DEFINITIONS (Match sqlite-client)
// ============================================================================

type TenderInsertPayload = CategorizedTender & {
  ai_analyzed?: boolean;
  ai_analyzed_at?: string;
  is_active?: boolean;
  ai_categorization_reasoning?: string;
};

// ============================================================================
// TURSO DATABASE ADAPTER CLASS
// ============================================================================

export class TursoTenderDatabase {
  /**
   * Insert new tender (with UPSERT)
   */
  static async insertTender(tender: TenderInsertPayload): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Helper: Convert date to ISO string
      const dateToString = (date: any): string | null => {
        if (!date) return null;
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toISOString();
        return null;
      };

      // Helper: Clean raw_json (remove Date objects)
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

      // Helper: Safe number conversion
      const toSafeNumber = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        return isNaN(num) ? null : num;
      };

      // Helper: Safe string conversion
      const toSafeString = (val: any): string | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string') return val;
        return String(val);
      };

      // Extract registration number
      let registrationNumber = tender.registration_number || null;
      if (!registrationNumber && tender.raw_json && tender.raw_json['Kayıt no']) {
        registrationNumber = tender.raw_json['Kayıt no'];
      }

      // Check if tender exists
      const existing = await executeQuerySingle<{ id: number }>(
        'SELECT id FROM ihale_listings WHERE source = ? AND source_id = ?',
        [tender.source, tender.source_id || '']
      );

      const params: InValue[] = [
        tender.source,
        tender.source_id || null,
        tender.source_url || null,
        tender.title,
        tender.organization || '',
        tender.organization_city || null,
        toSafeString(registrationNumber),
        tender.tender_type || null,
        tender.procurement_type || null,
        tender.category || null,
        dateToString(tender.announcement_date),
        dateToString(tender.tender_date),
        dateToString(tender.deadline_date),
        toSafeNumber(tender.budget),
        tender.currency || 'TRY',
        tender.is_catering ? 1 : 0,
        toSafeNumber(tender.catering_confidence),
        tender.ai_categorization_reasoning || null,
        tender.specification_url || null,
        tender.announcement_text || null,
        toSafeNumber(tender.total_items) || 0,
        toSafeNumber(tender.total_meal_quantity),
        toSafeNumber(tender.estimated_budget_from_items),
        tender.ai_analyzed ? 1 : 0,
        dateToString(tender.ai_analyzed_at),
        JSON.stringify(cleanRawJson(tender.raw_json)),
        tender.is_active !== undefined ? (tender.is_active ? 1 : 0) : 1,
      ];

      if (existing) {
        // UPDATE existing tender
        await executeWrite(`
          UPDATE ihale_listings SET
            source_url = ?,
            title = ?,
            organization = ?,
            organization_city = ?,
            registration_number = COALESCE(?, registration_number),
            tender_type = COALESCE(?, tender_type),
            procurement_type = COALESCE(?, procurement_type),
            category = COALESCE(?, category),
            announcement_date = COALESCE(?, announcement_date),
            tender_date = COALESCE(?, tender_date),
            deadline_date = COALESCE(?, deadline_date),
            budget = COALESCE(?, budget),
            currency = ?,
            is_catering = ?,
            catering_confidence = COALESCE(?, catering_confidence),
            ai_categorization_reasoning = COALESCE(?, ai_categorization_reasoning),
            specification_url = COALESCE(?, specification_url),
            announcement_text = COALESCE(?, announcement_text),
            total_items = COALESCE(?, total_items),
            total_meal_quantity = COALESCE(?, total_meal_quantity),
            estimated_budget_from_items = COALESCE(?, estimated_budget_from_items),
            ai_analyzed = ?,
            ai_analyzed_at = COALESCE(?, ai_analyzed_at),
            raw_json = ?,
            is_active = ?,
            last_updated_at = CURRENT_TIMESTAMP
          WHERE source = ? AND source_id = ?
        `, [
          ...params.slice(2), // Skip source and source_id
          tender.source,
          tender.source_id || ''
        ]);

        return { success: true, id: String(existing.id) };
      } else {
        // INSERT new tender
        const result = await executeWrite(`
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, params);

        return { success: true, id: String(result.lastInsertRowid) };
      }
    } catch (error: any) {
      console.error('❌ Turso insertTender error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all tenders with filters
   */
  static async getTenders(filters: {
    source?: string;
    is_catering?: boolean;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    try {
      let sql = 'SELECT * FROM ihale_listings WHERE 1=1';
      const params: InValue[] = [];

      if (filters.source) {
        sql += ' AND source = ?';
        params.push(filters.source);
      }

      if (filters.is_catering !== undefined) {
        sql += ' AND is_catering = ?';
        params.push(filters.is_catering ? 1 : 0);
      }

      if (filters.is_active !== undefined) {
        sql += ' AND is_active = ?';
        params.push(filters.is_active ? 1 : 0);
      }

      sql += ' ORDER BY created_at DESC';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }

      const rows = await executeQuery(sql, params);
      
      // Parse raw_json strings back to objects
      return rows.map((row: any) => ({
        ...row,
        raw_json: row.raw_json ? JSON.parse(row.raw_json as string) : null,
        is_catering: Boolean(row.is_catering),
        is_active: Boolean(row.is_active),
        ai_analyzed: Boolean(row.ai_analyzed),
      }));
    } catch (error) {
      console.error('❌ Turso getTenders error:', error);
      return [];
    }
  }

  /**
   * Get tender by ID
   */
  static async getTenderById(id: number): Promise<any | null> {
    try {
      const row = await executeQuerySingle(
        'SELECT * FROM ihale_listings WHERE id = ?',
        [id]
      );

      if (!row) return null;

      return {
        ...(row as any),
        raw_json: (row as any).raw_json ? JSON.parse((row as any).raw_json) : null,
        is_catering: Boolean((row as any).is_catering),
        is_active: Boolean((row as any).is_active),
        ai_analyzed: Boolean((row as any).ai_analyzed),
      };
    } catch (error) {
      console.error('❌ Turso getTenderById error:', error);
      return null;
    }
  }

  /**
   * Get tender by source and source_id
   */
  static async getTenderBySourceId(source: string, sourceId: string): Promise<any | null> {
    try {
      const row = await executeQuerySingle(
        'SELECT * FROM ihale_listings WHERE source = ? AND source_id = ?',
        [source, sourceId]
      );

      if (!row) return null;

      return {
        ...(row as any),
        raw_json: (row as any).raw_json ? JSON.parse((row as any).raw_json) : null,
        is_catering: Boolean((row as any).is_catering),
        is_active: Boolean((row as any).is_active),
        ai_analyzed: Boolean((row as any).ai_analyzed),
      };
    } catch (error) {
      console.error('❌ Turso getTenderBySourceId error:', error);
      return null;
    }
  }

  /**
   * Update tender
   */
  static async updateTender(id: number, updates: Partial<TenderInsertPayload>): Promise<{ success: boolean }> {
    try {
      const setClauses: string[] = [];
      const params: InValue[] = [];

      // Build dynamic UPDATE query
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          
          // Handle special conversions
          if (key === 'raw_json') {
            params.push(JSON.stringify(value));
          } else if (typeof value === 'boolean') {
            params.push(value ? 1 : 0);
          } else if (value instanceof Date) {
            params.push(value.toISOString());
          } else if (Array.isArray(value)) {
            params.push(JSON.stringify(value));
          } else if (typeof value === 'object' && value !== null) {
            params.push(JSON.stringify(value));
          } else {
            params.push(value as InValue);
          }
        }
      }

      setClauses.push('last_updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await executeWrite(
        `UPDATE ihale_listings SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );

      return { success: true };
    } catch (error) {
      console.error('❌ Turso updateTender error:', error);
      return { success: false };
    }
  }

  /**
   * Delete tender(s)
   */
  static async deleteTenders(ids: number[]): Promise<{ success: boolean; deletedCount: number }> {
    try {
      if (ids.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      const placeholders = ids.map(() => '?').join(',');
      const result = await executeWrite(
        `DELETE FROM ihale_listings WHERE id IN (${placeholders})`,
        ids
      );

      return { success: true, deletedCount: result.changes };
    } catch (error) {
      console.error('❌ Turso deleteTenders error:', error);
      return { success: false, deletedCount: 0 };
    }
  }

  /**
   * Get statistics
   */
  static async getStats(): Promise<{
    total: number;
    catering: number;
    cateringPercentage: number;
    bySource: Record<string, number>;
  }> {
    try {
      const totalResult = await executeQuerySingle<{ count: number }>(
        'SELECT COUNT(*) as count FROM ihale_listings WHERE is_active = 1'
      );
      const total = totalResult?.count || 0;

      const cateringResult = await executeQuerySingle<{ count: number }>(
        'SELECT COUNT(*) as count FROM ihale_listings WHERE is_active = 1 AND is_catering = 1'
      );
      const catering = cateringResult?.count || 0;

      const bySourceRows = await executeQuery<{ source: string; count: number }>(
        'SELECT source, COUNT(*) as count FROM ihale_listings WHERE is_active = 1 GROUP BY source'
      );

      const bySource: Record<string, number> = {};
      for (const row of bySourceRows) {
        bySource[row.source] = row.count;
      }

      return {
        total,
        catering,
        cateringPercentage: total > 0 ? (catering / total) * 100 : 0,
        bySource,
      };
    } catch (error) {
      console.error('❌ Turso getStats error:', error);
      return { total: 0, catering: 0, cateringPercentage: 0, bySource: {} };
    }
  }

  /**
   * Check if tender exists
   */
  static async tenderExists(source: string, sourceId: string): Promise<boolean> {
    try {
      const result = await executeQuerySingle<{ count: number }>(
        'SELECT COUNT(*) as count FROM ihale_listings WHERE source = ? AND source_id = ?',
        [source, sourceId]
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      console.error('❌ Turso tenderExists error:', error);
      return false;
    }
  }

  /**
   * Get scraping statistics
   */
  static async getScrapingStats(): Promise<any> {
    try {
      // Recent runs
      const recentRuns = await executeQuery(
        'SELECT * FROM scraping_logs ORDER BY created_at DESC LIMIT 10'
      );

      // Total tenders
      const totalResult = await executeQuerySingle<{ count: number }>(
        'SELECT COUNT(*) as count FROM ihale_listings'
      );

      // Catering tenders
      const cateringResult = await executeQuerySingle<{ count: number }>(
        'SELECT COUNT(*) as count FROM ihale_listings WHERE is_catering = 1'
      );

      return {
        recent_runs: recentRuns,
        total_tenders: totalResult?.count || 0,
        catering_tenders: cateringResult?.count || 0,
      };
    } catch (error) {
      console.error('❌ Turso getScrapingStats error:', error);
      return {
        recent_runs: [],
        total_tenders: 0,
        catering_tenders: 0,
      };
    }
  }

  /**
   * Search tenders (simple text search - no FTS in Turso yet)
   */
  static async searchTenders(query: string, limit: number = 20): Promise<any[]> {
    try {
      const searchPattern = `%${query}%`;
      const rows = await executeQuery(
        `SELECT * FROM ihale_listings 
         WHERE (title LIKE ? OR organization LIKE ?) 
         AND is_catering = 1
         LIMIT ?`,
        [searchPattern, searchPattern, limit]
      );

      return rows.map((row: any) => ({
        ...row,
        raw_json: row.raw_json ? JSON.parse(row.raw_json) : null,
        is_catering: Boolean(row.is_catering),
        is_active: Boolean(row.is_active),
      }));
    } catch (error) {
      console.error('❌ Turso searchTenders error:', error);
      return [];
    }
  }

  /**
   * Bulk insert tenders (async version)
   */
  static async bulkInsertTenders(tenders: TenderInsertPayload[]): Promise<{ inserted: number; duplicates: number; errors: number }> {
    let inserted = 0;
    let duplicates = 0;
    let errors = 0;

    console.log(`\n💾 Bulk insert: ${tenders.length} tenders`);

    // Insert one by one with error handling
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
   * Log scraping activity
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
      await executeWrite(
        `INSERT INTO scraping_logs (
          source, started_at, completed_at, status,
          total_scraped, new_listings_count, updated_listings_count,
          error_count, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logData.source,
          logData.startedAt.toISOString(),
          logData.completedAt.toISOString(),
          logData.status,
          logData.totalScraped,
          logData.newListings,
          logData.updatedListings,
          logData.errorMessage ? 1 : 0,
          logData.errorMessage || null,
        ]
      );
    } catch (error) {
      console.error('Log scraping error:', error);
    }
  }

  /**
   * Get tenders with filters (async version)
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
    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.isCatering !== undefined) {
      conditions.push('is_catering = ?');
      params.push(filters.isCatering ? 1 : 0);
    }

    if (filters.minBudget) {
      conditions.push('budget >= ?');
      params.push(filters.minBudget);
    }

    if (filters.maxBudget) {
      conditions.push('budget <= ?');
      params.push(filters.maxBudget);
    }

    if (filters.city) {
      conditions.push('organization_city = ?');
      params.push(filters.city);
    }

    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await executeQuerySingle(
      `SELECT COUNT(*) as total FROM ihale_listings ${whereClause}`,
      params
    );
    const total = (countResult as any)?.total || 0;

    // Get data with pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const data = await executeQuery(
      `SELECT * FROM ihale_listings
       ${whereClause}
       ORDER BY deadline_date ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total };
  }

  /**
   * Update tender with AI analysis (async version)
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
      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];

      if (analysisData.budget !== undefined) {
        updates.push('budget = ?');
        params.push(analysisData.budget);
      }
      if (analysisData.announcement_date !== undefined) {
        updates.push('announcement_date = ?');
        params.push(analysisData.announcement_date);
      }
      if (analysisData.tender_date !== undefined) {
        updates.push('tender_date = ?');
        params.push(analysisData.tender_date);
      }
      if (analysisData.deadline_date !== undefined) {
        updates.push('deadline_date = ?');
        params.push(analysisData.deadline_date);
      }
      if (analysisData.tender_type !== undefined) {
        updates.push('tender_type = ?');
        params.push(analysisData.tender_type);
      }
      if (analysisData.procurement_type !== undefined) {
        updates.push('procurement_type = ?');
        params.push(analysisData.procurement_type);
      }
      if (analysisData.category !== undefined) {
        updates.push('category = ?');
        params.push(analysisData.category);
      }
      if (analysisData.specification_url !== undefined) {
        updates.push('specification_url = ?');
        params.push(analysisData.specification_url);
      }
      if (analysisData.announcement_text !== undefined) {
        updates.push('announcement_text = ?');
        params.push(analysisData.announcement_text);
      }
      if (analysisData.is_catering !== undefined) {
        updates.push('is_catering = ?');
        params.push(analysisData.is_catering ? 1 : 0);
      }
      if (analysisData.catering_confidence !== undefined) {
        updates.push('catering_confidence = ?');
        params.push(analysisData.catering_confidence);
      }
      if (analysisData.ai_categorization_reasoning !== undefined) {
        updates.push('ai_categorization_reasoning = ?');
        params.push(analysisData.ai_categorization_reasoning);
      }
      if (analysisData.total_items !== undefined) {
        updates.push('total_items = ?');
        params.push(analysisData.total_items);
      }
      if (analysisData.total_meal_quantity !== undefined) {
        updates.push('total_meal_quantity = ?');
        params.push(analysisData.total_meal_quantity);
      }
      if (analysisData.estimated_budget_from_items !== undefined) {
        updates.push('estimated_budget_from_items = ?');
        params.push(analysisData.estimated_budget_from_items);
      }
      if (analysisData.ai_analyzed !== undefined) {
        updates.push('ai_analyzed = ?');
        params.push(analysisData.ai_analyzed ? 1 : 0);
      }
      if (analysisData.ai_analyzed_at !== undefined) {
        updates.push('ai_analyzed_at = ?');
        params.push(analysisData.ai_analyzed_at);
      }
      if (analysisData.raw_json !== undefined) {
        updates.push('raw_json = ?');
        params.push(JSON.stringify(analysisData.raw_json));
      }

      if (updates.length === 0) {
        return { success: true }; // Nothing to update
      }

      params.push(id); // Add id at the end for WHERE clause

      await executeWrite(
        `UPDATE ihale_listings
         SET ${updates.join(', ')}, last_updated_at = datetime('now')
         WHERE id = ?`,
        params
      );

      return { success: true };
    } catch (error: any) {
      console.error('Update tender with AI analysis error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save tender analysis result
   */
  static async saveTenderAnalysis(tenderId: string, analysisResult: any, fullContent: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`💾 [DB] saveTenderAnalysis called for: ${tenderId}`);
      
      const analysisJson = JSON.stringify(analysisResult);
      const fullContentJson = JSON.stringify(fullContent);

      console.log(`💾 [DB] Saving data sizes - analysis: ${analysisJson.length} bytes, content: ${fullContentJson.length} bytes`);

      await executeWrite(
        `INSERT INTO tender_analysis (tender_id, analysis_result, full_content, analyzed_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(tender_id) DO UPDATE SET
           analysis_result = excluded.analysis_result,
           full_content = excluded.full_content,
           updated_at = datetime('now')`,
        [tenderId, analysisJson, fullContentJson]
      );

      console.log(`✅ [DB] saveTenderAnalysis successful`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ [DB] saveTenderAnalysis error:', error);
      console.error('❌ [DB] Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tender analysis result
   */
  static async getTenderAnalysis(tenderId: string): Promise<{ analysisResult: any; fullContent: any } | null> {
    try {
      console.log(`📊 [DB] getTenderAnalysis(${tenderId})`);
      
      const result = await executeQuerySingle(
        `SELECT analysis_result, full_content FROM tender_analysis WHERE tender_id = ?`,
        [tenderId]
      );

      if (!result) {
        console.log(`❌ [DB] No analysis found for tender_id: ${tenderId}`);
        return null;
      }

      const row = result as any;
      console.log(`✅ [DB] Analysis found for tender_id: ${tenderId}`);
      return {
        analysisResult: row.analysis_result ? JSON.parse(row.analysis_result) : null,
        fullContent: row.full_content ? JSON.parse(row.full_content) : null
      };
    } catch (error: any) {
      console.error('getTenderAnalysis error:', error);
      return null;
    }
  }
}

// Export as TenderDatabase for compatibility
export { TursoTenderDatabase as TenderDatabase };
export { getTursoClient as getDatabase };
