import AdmZip from 'adm-zip';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * 🔧 ZIP Extraction Utility
 * 
 * ZIP dosyasını indirir ve içindeki dosyaları çıkarır.
 */

export interface ExtractedFile {
  filename: string;
  storagePath: string;
  size: number;
  mimeType: string;
  originalZipUrl: string;
}

export class ZipExtractor {
  /**
   * ZIP dosyasını URL'den indirir ve session klasörüne çıkarır
   */
  static async downloadAndExtractZip(
    zipUrl: string,
    sessionDir: string,
    cookies?: string
  ): Promise<ExtractedFile[]> {
    console.log('📦 ZIP indiriliyor:', zipUrl);
    
    try {
      // 1. ZIP'i indir
      const response = await fetch(zipUrl, {
        headers: {
          'Cookie': cookies || '',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`ZIP indirilemedi: ${response.status} ${response.statusText}`);
      }

      // Content-Type kontrolü
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        console.error('❌ ZIP yerine HTML döndü - login gerekli veya link hatalı');
        throw new Error('ZIP indirilemedi: HTML döndü (login gerekli?)');
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      console.log(`✅ ZIP indirildi: ${(buffer.length / 1024).toFixed(1)} KB`);

      // 2. ZIP dosyasını geçici kaydet
      const tempZipPath = path.join(sessionDir, 'temp.zip');
      await fs.writeFile(tempZipPath, buffer);

      // 3. ZIP'i aç ve içindeki dosyaları çıkar
      const zip = new AdmZip(tempZipPath);
      const zipEntries = zip.getEntries();
      
      console.log(`📂 ZIP içinde ${zipEntries.length} dosya bulundu`);

      const extractedFiles: ExtractedFile[] = [];

      for (const entry of zipEntries) {
        // Klasörleri atla
        if (entry.isDirectory) continue;

        // Dosya adı kontrolü (__MACOSX gibi meta dosyaları atla)
        if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('.')) {
          continue;
        }

        try {
          // Dosya içeriğini al
          const fileBuffer = entry.getData();
          
          // Güvenli dosya adı oluştur (path traversal önleme)
          const safeName = path.basename(entry.entryName);
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(7);
          const ext = path.extname(safeName);
          const baseName = path.basename(safeName, ext);
          const storedName = `${baseName}_${timestamp}_${randomId}${ext}`;
          
          const storagePath = path.join(sessionDir, storedName);
          
          // Dosyayı kaydet
          await fs.writeFile(storagePath, fileBuffer);
          
          // MIME type tespiti
          const mimeType = this.detectMimeType(fileBuffer, ext);
          
          extractedFiles.push({
            filename: safeName,
            storagePath: path.relative(process.cwd(), storagePath),
            size: fileBuffer.length,
            mimeType,
            originalZipUrl: zipUrl,
          });

          console.log(`  ✅ Çıkarıldı: ${safeName} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (error) {
          console.error(`  ❌ Dosya çıkarılamadı: ${entry.entryName}`, error);
        }
      }

      // 4. Geçici ZIP dosyasını sil
      await fs.unlink(tempZipPath);
      console.log('🗑️ Geçici ZIP silindi');

      return extractedFiles;

    } catch (error) {
      console.error('❌ ZIP extraction hatası:', error);
      throw error;
    }
  }

  /**
   * Magic bytes ile MIME type tespiti
   */
  private static detectMimeType(buffer: Buffer, ext: string): string {
    // Extension-based fallback
    const extMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };

    if (buffer.length < 4) {
      return extMap[ext.toLowerCase()] || 'application/octet-stream';
    }

    // Magic bytes kontrolü
    const header = buffer.slice(0, 10).toString('utf-8', 0, 10);
    
    // PDF
    if (buffer.slice(0, 4).toString() === '%PDF') {
      return 'application/pdf';
    }
    
    // ZIP (DOCX, XLSX)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      const content = buffer.toString('utf-8');
      if (content.includes('word/')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (content.includes('xl/')) {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
      return 'application/zip';
    }

    // DOC (old format)
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF) {
      return 'application/msword';
    }

    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      return 'image/jpeg';
    }

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      return 'image/png';
    }

    // Fallback to extension
    return extMap[ext.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Session klasöründeki tüm ZIP dosyalarını bul ve extract et
   */
  static async extractAllZipsInSession(
    sessionDir: string,
    documentUrls: string[],
    cookies?: string
  ): Promise<ExtractedFile[]> {
    const allExtracted: ExtractedFile[] = [];

    // 🔥 TÜM URL'leri dene - .zip olmasına gerek yok (ihalebul.com'da fileid parametresi var)
    const zipUrls = documentUrls.filter(url => 
      url && (
        url.toLowerCase().includes('.zip') || 
        url.includes('/download') ||
        url.includes('downloadfile') ||
        url.includes('fileid=')
      )
    );

    console.log(`📦 ${zipUrls.length}/${documentUrls.length} olası ZIP URL bulundu`);
    zipUrls.forEach(url => console.log(`  🔗 ${url}`));

    for (const zipUrl of zipUrls) {
      try {
        const extracted = await this.downloadAndExtractZip(zipUrl, sessionDir, cookies);
        allExtracted.push(...extracted);
      } catch (error) {
        console.error(`❌ ZIP extraction hatası: ${zipUrl}`, error);
      }
    }

    return allExtracted;
  }
}
