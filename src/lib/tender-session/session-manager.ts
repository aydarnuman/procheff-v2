// ============================================================================
// TENDER SESSION MANAGER
// Session CRUD ve lifecycle yönetimi
// ============================================================================

import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';
import type {
  TenderSession,
  TenderFile,
  TenderSessionStatus,
  TenderSessionSource,
  AnalysisResult,
} from './types';

export class TenderSessionManager {
  /**
   * Create a new tender session
   */
  static async create(params: {
    source: TenderSessionSource;
    tenderId?: number;
    userId?: string;
  }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      const db = getDatabase();

      // Generate session ID: tender_20251105_123456
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const sessionId = `tender_${dateStr}_${timeStr}`;

      // Insert session
      const stmt = db.prepare(`
        INSERT INTO tender_sessions (
          id, user_id, source, tender_id, status, created_at, updated_at
        ) VALUES (
          @id, @user_id, @source, @tender_id, @status, datetime('now'), datetime('now')
        )
      `);

      stmt.run({
        id: sessionId,
        user_id: params.userId || null,
        source: params.source,
        tender_id: params.tenderId || null,
        status: 'created',
      });

      console.log(`✅ Session created: ${sessionId}`);
      return { success: true, sessionId };
    } catch (error: any) {
      console.error('Session creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session by ID
   */
  static async get(sessionId: string): Promise<TenderSession | null> {
    try {
      const db = getDatabase();

      // Get session
      const sessionStmt = db.prepare(`
        SELECT * FROM tender_sessions WHERE id = ?
      `);
      const sessionRow: any = sessionStmt.get(sessionId);

      if (!sessionRow) {
        return null;
      }

      // Get files
      const filesStmt = db.prepare(`
        SELECT * FROM tender_files WHERE session_id = ? ORDER BY uploaded_at ASC
      `);
      const filesRows: any[] = filesStmt.all(sessionId);

      // Map to TenderFile[]
      const files: TenderFile[] = filesRows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        filename: row.filename,
        originalFilename: row.original_filename || undefined,
        mimeType: row.mime_type,
        size: row.size,
        storagePath: row.storage_path,
        isExtractedFromZip: row.is_extracted_from_zip === 1,
        parentZipId: row.parent_zip_id || undefined,
        uploadedAt: row.uploaded_at,
      }));

      // Parse result_json
      let result: AnalysisResult | undefined;
      if (sessionRow.result_json) {
        try {
          result = JSON.parse(sessionRow.result_json);
        } catch (e) {
          console.warn('Failed to parse result_json:', e);
        }
      }

      // Map to TenderSession
      const session: TenderSession = {
        id: sessionRow.id,
        userId: sessionRow.user_id || undefined,
        source: sessionRow.source as TenderSessionSource,
        tenderId: sessionRow.tender_id || undefined,
        status: sessionRow.status as TenderSessionStatus,
        files,
        result,
        errorMessage: sessionRow.error_message || undefined,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
      };

      return session;
    } catch (error: any) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Update session status
   */
  static async updateStatus(
    sessionId: string,
    status: TenderSessionStatus,
    errorMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const stmt = db.prepare(`
        UPDATE tender_sessions
        SET status = @status, error_message = @error_message, updated_at = datetime('now')
        WHERE id = @id
      `);

      stmt.run({
        id: sessionId,
        status,
        error_message: errorMessage || null,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Update status error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save analysis result
   */
  static async saveResult(
    sessionId: string,
    result: AnalysisResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const stmt = db.prepare(`
        UPDATE tender_sessions
        SET result_json = @result_json, status = 'completed', updated_at = datetime('now')
        WHERE id = @id
      `);

      stmt.run({
        id: sessionId,
        result_json: JSON.stringify(result),
      });

      console.log(`✅ Analysis result saved for session: ${sessionId}`);
      return { success: true };
    } catch (error: any) {
      console.error('Save result error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add file to session
   */
  static async addFile(file: Omit<TenderFile, 'uploadedAt'>): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const stmt = db.prepare(`
        INSERT INTO tender_files (
          id, session_id, filename, original_filename, mime_type, size,
          storage_path, is_extracted_from_zip, parent_zip_id, uploaded_at
        ) VALUES (
          @id, @session_id, @filename, @original_filename, @mime_type, @size,
          @storage_path, @is_extracted_from_zip, @parent_zip_id, datetime('now')
        )
      `);

      stmt.run({
        id: file.id,
        session_id: file.sessionId,
        filename: file.filename,
        original_filename: file.originalFilename || null,
        mime_type: file.mimeType,
        size: file.size,
        storage_path: file.storagePath,
        is_extracted_from_zip: file.isExtractedFromZip ? 1 : 0,
        parent_zip_id: file.parentZipId || null,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Add file error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all sessions (with pagination)
   */
  static async list(params: {
    limit?: number;
    offset?: number;
    status?: TenderSessionStatus;
  }): Promise<TenderSession[]> {
    try {
      const db = getDatabase();

      const { limit = 50, offset = 0, status } = params;

      // Build WHERE clause
      const whereClause = status ? `WHERE status = @status` : '';

      const stmt = db.prepare(`
        SELECT * FROM tender_sessions
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT @limit OFFSET @offset
      `);

      const rows: any[] = stmt.all({
        status: status || null,
        limit,
        offset,
      });

      // Map each row to TenderSession (without files for list view)
      const sessions: TenderSession[] = rows.map((row) => {
        let result: AnalysisResult | undefined;
        if (row.result_json) {
          try {
            result = JSON.parse(row.result_json);
          } catch (e) {
            console.warn('Failed to parse result_json:', e);
          }
        }

        return {
          id: row.id,
          userId: row.user_id || undefined,
          source: row.source as TenderSessionSource,
          tenderId: row.tender_id || undefined,
          status: row.status as TenderSessionStatus,
          files: [], // Empty for list view (performance)
          result,
          errorMessage: row.error_message || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return sessions;
    } catch (error: any) {
      console.error('List sessions error:', error);
      return [];
    }
  }

  /**
   * Delete session and all associated files
   */
  static async delete(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      // Delete files (CASCADE will handle this, but we do it explicitly for logging)
      const deleteFilesStmt = db.prepare(`DELETE FROM tender_files WHERE session_id = ?`);
      const filesResult = deleteFilesStmt.run(sessionId);

      // Delete session
      const deleteSessionStmt = db.prepare(`DELETE FROM tender_sessions WHERE id = ?`);
      const sessionResult = deleteSessionStmt.run(sessionId);

      console.log(`✅ Session deleted: ${sessionId} (${filesResult.changes} files removed)`);
      return { success: true };
    } catch (error: any) {
      console.error('Delete session error:', error);
      return { success: false, error: error.message };
    }
  }
}
