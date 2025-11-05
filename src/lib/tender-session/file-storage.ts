// ============================================================================
// UNIFIED FILE STORAGE (UFS)
// Tek kaynak dosya storage sistemi: MIME detection + ZIP extraction + DB kayıt
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import JSZip from 'jszip';
import { randomUUID } from 'crypto';
import { TenderSessionManager } from './session-manager';
import type { TenderFile } from './types';

// Storage root directory
const STORAGE_ROOT = path.join(process.cwd(), 'data', 'sessions');

export class UnifiedFileStorage {
  /**
   * Store a file for a session
   * - Detects MIME type using file-type
   * - Auto-extracts ZIP files
   * - Saves to disk: data/sessions/{sessionId}/{filename}
   * - Registers in database
   */
  static async store(params: {
    sessionId: string;
    file: Buffer;
    filename: string;
    parentZipId?: string;
  }): Promise<{ success: boolean; files?: TenderFile[]; error?: string }> {
    try {
      const { sessionId, file, filename, parentZipId } = params;

      // 1. Detect MIME type using file-type
      const detected = await fileTypeFromBuffer(file);
      const mimeType = detected?.mime || this.getMimeTypeFromExtension(filename);

      console.log(`📂 Storing file: ${filename} (${mimeType})`);

      // 2. Check if ZIP file
      if (mimeType === 'application/zip' || filename.toLowerCase().endsWith('.zip')) {
        console.log('📦 ZIP file detected, extracting...');
        return await this.extractAndStore({ sessionId, file, filename });
      }

      // 3. Save file to disk
      const fileId = randomUUID();
      const sessionDir = path.join(STORAGE_ROOT, sessionId);

      // Create session directory if not exists
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const storagePath = path.join(sessionDir, `${fileId}_${filename}`);
      fs.writeFileSync(storagePath, file);

      // 4. Register file in database
      const tenderFile: Omit<TenderFile, 'uploadedAt'> = {
        id: fileId,
        sessionId,
        filename,
        mimeType,
        size: file.byteLength,
        storagePath,
        isExtractedFromZip: !!parentZipId,
        parentZipId,
      };

      const addResult = await TenderSessionManager.addFile(tenderFile);
      if (!addResult.success) {
        throw new Error(`Database insert failed: ${addResult.error}`);
      }

      console.log(`✅ File stored: ${filename} (${fileId})`);

      return {
        success: true,
        files: [{ ...tenderFile, uploadedAt: new Date().toISOString() }],
      };
    } catch (error: any) {
      console.error('File storage error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract ZIP file and store all contents
   */
  static async extractAndStore(params: {
    sessionId: string;
    file: Buffer;
    filename: string;
  }): Promise<{ success: boolean; files?: TenderFile[]; error?: string }> {
    try {
      const { sessionId, file, filename } = params;

      // 1. First, save the ZIP file itself
      const zipFileId = randomUUID();
      const sessionDir = path.join(STORAGE_ROOT, sessionId);

      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const zipStoragePath = path.join(sessionDir, `${zipFileId}_${filename}`);
      fs.writeFileSync(zipStoragePath, file);

      // Register ZIP file in database
      const zipFile: Omit<TenderFile, 'uploadedAt'> = {
        id: zipFileId,
        sessionId,
        filename,
        mimeType: 'application/zip',
        size: file.byteLength,
        storagePath: zipStoragePath,
        isExtractedFromZip: false,
      };

      await TenderSessionManager.addFile(zipFile);
      console.log(`✅ ZIP file stored: ${filename} (${zipFileId})`);

      // 2. Load ZIP and extract files
      const zip = await JSZip.loadAsync(file);
      const extractedFiles: TenderFile[] = [];

      for (const [entryPath, zipEntry] of Object.entries(zip.files)) {
        // Skip directories and hidden files
        if (zipEntry.dir || path.basename(entryPath).startsWith('.')) {
          continue;
        }

        try {
          // Get file content
          const entryBuffer = await zipEntry.async('nodebuffer');

          // Detect MIME type
          const detected = await fileTypeFromBuffer(entryBuffer);
          const entryFilename = path.basename(entryPath);
          const entryMimeType = detected?.mime || this.getMimeTypeFromExtension(entryFilename);

          // Save extracted file
          const entryFileId = randomUUID();
          const entryStoragePath = path.join(sessionDir, `${entryFileId}_${entryFilename}`);
          fs.writeFileSync(entryStoragePath, entryBuffer);

          // Register extracted file in database
          const extractedFile: Omit<TenderFile, 'uploadedAt'> = {
            id: entryFileId,
            sessionId,
            filename: entryFilename,
            originalFilename: entryPath, // Full path in ZIP
            mimeType: entryMimeType,
            size: entryBuffer.byteLength,
            storagePath: entryStoragePath,
            isExtractedFromZip: true,
            parentZipId: zipFileId,
          };

          await TenderSessionManager.addFile(extractedFile);
          extractedFiles.push({ ...extractedFile, uploadedAt: new Date().toISOString() });

          console.log(`   ✅ Extracted: ${entryFilename} (${entryMimeType})`);
        } catch (entryError: any) {
          console.error(`   ❌ Failed to extract ${entryPath}:`, entryError.message);
        }
      }

      console.log(`📦 ZIP extraction complete: ${extractedFiles.length} files extracted`);

      return {
        success: true,
        files: [
          { ...zipFile, uploadedAt: new Date().toISOString() },
          ...extractedFiles,
        ],
      };
    } catch (error: any) {
      console.error('ZIP extraction error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file from storage
   */
  static async get(fileId: string, sessionId: string): Promise<{ success: boolean; buffer?: Buffer; file?: TenderFile; error?: string }> {
    try {
      // Get file metadata from database
      const session = await TenderSessionManager.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const file = session.files.find((f) => f.id === fileId);
      if (!file) {
        return { success: false, error: 'File not found in session' };
      }

      // Read file from disk
      if (!fs.existsSync(file.storagePath)) {
        return { success: false, error: 'File not found on disk' };
      }

      const buffer = fs.readFileSync(file.storagePath);

      return {
        success: true,
        buffer,
        file,
      };
    } catch (error: any) {
      console.error('Get file error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete all files for a session
   */
  static async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sessionDir = path.join(STORAGE_ROOT, sessionId);

      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`✅ Session directory deleted: ${sessionDir}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Delete session files error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get MIME type from file extension (fallback)
   */
  private static getMimeTypeFromExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.json': 'application/json',
      '.xml': 'application/xml',
    };

    return mimeMap[ext] || 'application/octet-stream';
  }
}
