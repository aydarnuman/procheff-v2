import JSZip from 'jszip';
import { logger, LogKategori } from '@/lib/logger';

export interface ExtractedFile {
  name: string;
  content: ArrayBuffer;
  size: number;
  type: string; // MIME type (inferred from extension)
}

export interface ZipExtractionResult {
  success: boolean;
  files: ExtractedFile[];
  error?: string;
  totalFiles: number;
  totalSize: number;
}

/**
 * ZIP Extractor Utility
 * Extracts all files from a ZIP archive
 */
export class ZipExtractor {
  private static readonly MIME_MAP: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    rtf: 'text/rtf',
    html: 'text/html',
    htm: 'text/html',
    csv: 'text/csv',
    json: 'application/json',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.document',
    xls: 'application/vnd.ms-excel',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };

  /**
   * Infer MIME type from file extension
   */
  private static inferMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() || '';
    return this.MIME_MAP[ext] || 'application/octet-stream';
  }

  /**
   * Check if file should be processed (skip directories and system files)
   */
  private static shouldProcessFile(filename: string): boolean {
    // Skip macOS system files
    if (filename.startsWith('__MACOSX/')) return false;
    if (filename.includes('.DS_Store')) return false;

    // Skip directories (ending with /)
    if (filename.endsWith('/')) return false;

    // Skip hidden files
    if (filename.split('/').some(part => part.startsWith('.'))) return false;

    return true;
  }

  /**
   * Extract all files from ZIP archive
   */
  static async extract(zipFile: File, onProgress?: (message: string) => void): Promise<ZipExtractionResult> {
    const sessionId = `zip_extract_${Date.now()}`;

    try {
      logger.info(LogKategori.PROCESSING, `ZIP extraction başladı: ${zipFile.name}`, {
        dosyaAdi: zipFile.name,
        dosyaBoyutu: zipFile.size,
      });

      onProgress?.(`📦 ZIP dosyası açılıyor: ${zipFile.name}`);

      // Read ZIP file as ArrayBuffer
      const arrayBuffer = await zipFile.arrayBuffer();

      // Load ZIP
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Get all file entries
      const fileEntries = Object.keys(zip.files)
        .filter(filename => this.shouldProcessFile(filename))
        .map(filename => zip.files[filename]);

      logger.info(LogKategori.PROCESSING, `ZIP içinde ${fileEntries.length} dosya bulundu`);
      onProgress?.(`📋 ${fileEntries.length} dosya bulundu`);

      const extractedFiles: ExtractedFile[] = [];
      let totalSize = 0;

      // Extract each file
      for (let i = 0; i < fileEntries.length; i++) {
        const fileEntry = fileEntries[i];
        const progress = Math.round(((i + 1) / fileEntries.length) * 100);

        try {
          logger.debug(LogKategori.PROCESSING, `Extracting: ${fileEntry.name}`, {
            dosyaAdi: fileEntry.name,
          });

          onProgress?.(`⚙️ ${fileEntry.name} çıkarılıyor... (${progress}%)`);

          // Extract file content as ArrayBuffer
          const content = await fileEntry.async('arraybuffer');
          const size = content.byteLength;
          const type = this.inferMimeType(fileEntry.name);

          extractedFiles.push({
            name: fileEntry.name,
            content,
            size,
            type,
          });

          totalSize += size;

          logger.debug(LogKategori.PROCESSING, `✓ ${fileEntry.name} çıkarıldı`, {
            dosyaAdi: fileEntry.name,
            dosyaBoyutu: size,
            dosyaTipi: type,
          });
        } catch (fileError: any) {
          logger.uyari(LogKategori.PROCESSING, `${fileEntry.name} çıkarılamadı: ${fileError.message}`, {
            ek: { dosyaAdi: fileEntry.name, hata: fileError.message },
          });
          // Continue with other files
        }
      }

      logger.basarili(LogKategori.PROCESSING, `ZIP extraction tamamlandı: ${extractedFiles.length}/${fileEntries.length} dosya`, {
        ek: {
          toplamDosya: fileEntries.length,
          basariliDosya: extractedFiles.length,
          toplamBoyut: totalSize,
        },
      });

      onProgress?.(`✅ ${extractedFiles.length} dosya çıkarıldı`);

      return {
        success: true,
        files: extractedFiles,
        totalFiles: extractedFiles.length,
        totalSize,
      };
    } catch (error: any) {
      logger.hata(LogKategori.PROCESSING, `ZIP extraction hatası: ${zipFile.name}`, {
        kod: 'ZIP_EXTRACTION_ERROR',
        mesaj: error.message,
      });

      return {
        success: false,
        files: [],
        error: error.message || 'ZIP dosyası açılamadı',
        totalFiles: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * Convert ArrayBuffer to File object
   */
  static arrayBufferToFile(buffer: ArrayBuffer, filename: string, mimeType: string): File {
    const blob = new Blob([buffer], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
  }
}
