// ============================================================================
// TENDER SESSION MANAGER (TURSO ASYNC VERSION)
// Session CRUD ve lifecycle yönetimi - Full async/await for Turso
// ============================================================================

import { executeQuery, executeQuerySingle, executeWrite } from '@/lib/ihale-scraper/database';
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
      if (!executeWrite) {
        throw new Error('Turso database not available. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      }

      // Generate session ID: tender_20251107_123456
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const sessionId = `tender_${dateStr}_${timeStr}_${Math.random().toString(36).slice(2, 7)}`;

      // Insert session
      await executeWrite(
        `INSERT INTO tender_sessions (
          id, user_id, source, tender_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [sessionId, params.userId || null, params.source, params.tenderId || null, 'created']
      );

      console.log(`✅ Session created: ${sessionId}`);
      return { success: true, sessionId };
    } catch (error: any) {
      console.error('❌ Session creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session by ID
   */
  static async get(sessionId: string): Promise<TenderSession | null> {
    try {
      if (!executeQuerySingle || !executeQuery) {
        throw new Error('Turso database not available');
      }

      // Get session
      const sessionRow: any = await executeQuerySingle(
        'SELECT * FROM tender_sessions WHERE id = ?',
        [sessionId]
      );

      if (!sessionRow) {
        return null;
      }

      // Get files
      const filesRows = await executeQuery(
        'SELECT * FROM tender_files WHERE session_id = ? ORDER BY uploaded_at ASC',
        [sessionId]
      );

      // Map to TenderFile[]
      const files: TenderFile[] = (filesRows || []).map((row: any) => ({
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
          console.error('Failed to parse result_json:', e);
        }
      }

      // Build TenderSession object
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
      console.error('❌ Session get error:', error);
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
      if (!executeWrite) {
        throw new Error('Turso database not available');
      }

      await executeWrite(
        `UPDATE tender_sessions 
         SET status = ?, error_message = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [status, errorMessage || null, sessionId]
      );

      console.log(`✅ Session ${sessionId} status updated to: ${status}`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Session status update error:', error);
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
      if (!executeWrite) {
        throw new Error('Turso database not available');
      }

      const resultJson = JSON.stringify(result);

      await executeWrite(
        `UPDATE tender_sessions 
         SET result_json = ?, status = 'completed', updated_at = datetime('now')
         WHERE id = ?`,
        [resultJson, sessionId]
      );

      console.log(`✅ Session ${sessionId} analysis result saved`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Session result save error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add file to session
   */
  static async addFile(params: {
    sessionId: string;
    fileId: string;
    filename: string;
    originalFilename?: string;
    mimeType: string;
    size: number;
    storagePath: string;
    isExtractedFromZip?: boolean;
    parentZipId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      if (!executeWrite) {
        throw new Error('Turso database not available');
      }

      await executeWrite(
        `INSERT INTO tender_files (
          id, session_id, filename, original_filename, mime_type, size, storage_path,
          is_extracted_from_zip, parent_zip_id, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          params.fileId,
          params.sessionId,
          params.filename,
          params.originalFilename || null,
          params.mimeType,
          params.size,
          params.storagePath,
          params.isExtractedFromZip ? 1 : 0,
          params.parentZipId || null,
        ]
      );

      console.log(`✅ File added to session ${params.sessionId}: ${params.filename}`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ File add error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file by ID
   */
  static async getFile(fileId: string): Promise<TenderFile | null> {
    try {
      if (!executeQuerySingle) {
        throw new Error('Turso database not available');
      }

      const row: any = await executeQuerySingle('SELECT * FROM tender_files WHERE id = ?', [fileId]);

      if (!row) {
        return null;
      }

      const file: TenderFile = {
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
      };

      return file;
    } catch (error: any) {
      console.error('❌ File get error:', error);
      return null;
    }
  }

  /**
   * Delete session and all files
   */
  static async delete(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!executeWrite) {
        throw new Error('Turso database not available');
      }

      // Delete files first
      await executeWrite('DELETE FROM tender_files WHERE session_id = ?', [sessionId]);

      // Delete session
      await executeWrite('DELETE FROM tender_sessions WHERE id = ?', [sessionId]);

      console.log(`✅ Session ${sessionId} deleted`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Session delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List sessions (with pagination)
   */
  static async list(params: {
    userId?: string;
    limit?: number;
    offset?: number;
    status?: TenderSessionStatus;
  }): Promise<TenderSession[]> {
    try {
      if (!executeQuery) {
        throw new Error('Turso database not available');
      }

      const limit = params.limit || 50;
      const offset = params.offset || 0;

      let query = 'SELECT * FROM tender_sessions WHERE 1=1';
      const queryParams: any[] = [];

      if (params.userId) {
        query += ' AND user_id = ?';
        queryParams.push(params.userId);
      }

      if (params.status) {
        query += ' AND status = ?';
        queryParams.push(params.status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      const rows = await executeQuery(query, queryParams);

      // For each session, fetch files
      const sessions: TenderSession[] = [];
      for (const row of rows || []) {
        const rowData = row as any; // Type assertion for Turso rows
        
        const filesRows = await executeQuery(
          'SELECT * FROM tender_files WHERE session_id = ? ORDER BY uploaded_at ASC',
          [rowData.id]
        );

        const files: TenderFile[] = (filesRows || []).map((fileRow: any) => ({
          id: fileRow.id,
          sessionId: fileRow.session_id,
          filename: fileRow.filename,
          originalFilename: fileRow.original_filename || undefined,
          mimeType: fileRow.mime_type,
          size: fileRow.size,
          storagePath: fileRow.storage_path,
          isExtractedFromZip: fileRow.is_extracted_from_zip === 1,
          parentZipId: fileRow.parent_zip_id || undefined,
          uploadedAt: fileRow.uploaded_at,
        }));

        let result: AnalysisResult | undefined;
        if (rowData.result_json) {
          try {
            result = JSON.parse(rowData.result_json);
          } catch (e) {
            console.error('Failed to parse result_json:', e);
          }
        }

        const session: TenderSession = {
          id: rowData.id,
          userId: rowData.user_id || undefined,
          source: rowData.source as TenderSessionSource,
          tenderId: rowData.tender_id || undefined,
          status: rowData.status as TenderSessionStatus,
          files,
          result,
          errorMessage: rowData.error_message || undefined,
          createdAt: rowData.created_at,
          updatedAt: rowData.updated_at,
        };

        sessions.push(session);
      }

      return sessions;
    } catch (error: any) {
      console.error('❌ Session list error:', error);
      return [];
    }
  }
}
