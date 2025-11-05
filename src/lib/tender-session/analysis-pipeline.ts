// ============================================================================
// AI ANALYSIS PIPELINE
// Background AI analysis worker for tender sessions
// ============================================================================

import { TenderSessionManager } from './session-manager';
import { UnifiedFileStorage } from './file-storage';
import type { TenderSession, AnalysisResult, AnalysisStage } from './types';
import fs from 'fs';

// Progress callback type
type ProgressCallback = (stage: AnalysisStage, message: string, percentage: number) => void;

export class AnalysisPipeline {
  /**
   * Run full analysis pipeline for a session
   */
  static async run(
    sessionId: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; result?: AnalysisResult; error?: string }> {
    try {
      console.log(`\n🚀 Starting AI Analysis Pipeline for session: ${sessionId}`);

      // Get session
      const session = await TenderSessionManager.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.files.length === 0) {
        throw new Error('No files in session');
      }

      // Update status to analyzing
      await TenderSessionManager.updateStatus(sessionId, 'analyzing');

      // Stage 1: Load files from disk
      onProgress?.('processing_files', 'Dosyalar yükleniyor...', 10);
      console.log('📂 Stage 1: Loading files from disk...');

      const filesWithContent: Array<{
        filename: string;
        mimeType: string;
        size: number;
        buffer: Buffer;
      }> = [];

      for (const file of session.files) {
        // Skip ZIP files (only process extracted files)
        if (file.isExtractedFromZip === false && file.mimeType === 'application/zip') {
          continue;
        }

        const fileResult = await UnifiedFileStorage.get(file.id, sessionId);
        if (fileResult.success && fileResult.buffer) {
          filesWithContent.push({
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
            buffer: fileResult.buffer,
          });
        }
      }

      console.log(`✅ Loaded ${filesWithContent.length} files`);

      // Stage 2: Extract text from files
      onProgress?.('analyzing_content', 'Döküman içerikleri analiz ediliyor...', 30);
      console.log('📄 Stage 2: Extracting text from files...');

      const extractedTexts: Array<{
        filename: string;
        text: string;
        wordCount: number;
        charCount: number;
        pageCount?: number;
      }> = [];

      for (const file of filesWithContent) {
        try {
          const text = await this.extractTextFromBuffer(file.buffer, file.mimeType);
          const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
          const charCount = text.length;

          // Estimate page count (roughly 500 words per page)
          const pageCount = Math.ceil(wordCount / 500);

          extractedTexts.push({
            filename: file.filename,
            text: text.substring(0, 50000), // Limit to 50k chars per file
            wordCount,
            charCount,
            pageCount,
          });
          console.log(`   ✅ ${file.filename}: ${wordCount} words, ${pageCount} pages`);
        } catch (error: any) {
          console.warn(`   ⚠️ ${file.filename}: Text extraction failed - ${error.message}`);
        }
      }

      // Stage 3: Prepare AI prompt
      onProgress?.('analyzing_content', 'AI analizi hazırlanıyor...', 50);
      console.log('🤖 Stage 3: Preparing AI analysis...');

      const combinedText = extractedTexts
        .map((item) => `--- ${item.filename} ---\n${item.text}`)
        .join('\n\n');

      // Stage 4: Send to AI (placeholder - will integrate with existing AI module)
      onProgress?.('analyzing_content', 'AI analizi yapılıyor...', 70);
      console.log('🧠 Stage 4: Running AI analysis...');

      // TODO: Integrate with existing AI analysis module
      // For now, create a basic result structure
      const analysisResult: AnalysisResult = {
        tenderInfo: {
          title: 'AI Analysis Placeholder',
        },
        categorization: {
          isCatering: false,
          confidence: 0,
          reasoning: 'AI analysis not yet implemented',
        },
        documents: filesWithContent.map((f) => {
          const extracted = extractedTexts.find(e => e.filename === f.filename);
          return {
            filename: f.filename,
            type: f.mimeType,
            size: f.size,
            wordCount: extracted?.wordCount,
            charCount: extracted?.charCount,
            pageCount: extracted?.pageCount,
            processedSuccessfully: true,
          };
        }),
        aiMetadata: {
          analyzedAt: new Date().toISOString(),
          model: 'placeholder',
        },
      };

      // Stage 5: Save results
      onProgress?.('finalizing', 'Sonuçlar kaydediliyor...', 90);
      console.log('💾 Stage 5: Saving results...');

      await TenderSessionManager.saveResult(sessionId, analysisResult);

      onProgress?.('completed', 'Analiz tamamlandı!', 100);
      console.log('✅ Analysis pipeline completed successfully');

      return { success: true, result: analysisResult };
    } catch (error: any) {
      console.error('❌ Analysis pipeline error:', error);

      // Update session status to error
      await TenderSessionManager.updateStatus(sessionId, 'error', error.message);

      onProgress?.('error', `Hata: ${error.message}`, 0);

      return { success: false, error: error.message };
    }
  }

  /**
   * Extract text from buffer based on MIME type
   */
  private static async extractTextFromBuffer(
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    // Plain text
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      return buffer.toString('utf-8');
    }

    // JSON
    if (mimeType === 'application/json') {
      return buffer.toString('utf-8');
    }

    // PDF (basic extraction - just return placeholder for now)
    if (mimeType === 'application/pdf') {
      // TODO: Integrate with existing PDF extraction module
      return '[PDF content - extraction not yet implemented]';
    }

    // Word documents
    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // TODO: Integrate with existing Word extraction module (mammoth)
      return '[Word document - extraction not yet implemented]';
    }

    // Excel/CSV
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'text/csv'
    ) {
      // TODO: Integrate with existing Excel/CSV extraction
      return '[Spreadsheet - extraction not yet implemented]';
    }

    // Fallback: try UTF-8 decode
    try {
      return buffer.toString('utf-8').substring(0, 10000);
    } catch {
      return '[Binary file - text extraction not supported]';
    }
  }
}
