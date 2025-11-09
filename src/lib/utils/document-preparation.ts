/**
 * Document Preparation Utilities
 *
 * Problem: prepareDocuments() fonksiyonu 150+ satır → anlaşılması zor
 * Çözüm: Virtual file creation, download, duplicate check logic'i ayır
 *
 * Kullanım:
 * ```typescript
 * const virtualDocs = createVirtualExports(tender, content, ['csv', 'json']);
 * const realDocs = await downloadRealDocuments(urls, onProgress);
 * const uniqueDocs = filterDuplicateDocuments(newDocs, existingDocs);
 * ```
 */

import { DOCUMENT_CONFIG } from '@/constants/documents';

/**
 * Prepared document interface (hazır indirilecek döküman)
 */
export interface PreparedDocument {
  title: string;
  url: string;
  mimeType: string;
  blob: Blob;
  size: number;
  type: 'export' | 'document' | 'archive';
  isFromZip: boolean;
  originalFilename?: string;
}

/**
 * Export type (virtual dosya türü)
 */
export type ExportType = 'json' | 'txt' | 'csv';

/**
 * Minimal tender interface for virtual exports
 */
export interface TenderInfo {
  title: string;
  organization: string;
}

/**
 * Full tender content interface
 */
export interface TenderContent {
  details?: Record<string, any>;
  fullText: string;
  documents?: any[];
}

/**
 * Virtual export dosyası oluştur (JSON, TXT, CSV)
 *
 * @param tender - İhale tender bilgisi
 * @param content - İhale full content (details, fullText, documents)
 * @param exportTypes - Oluşturulacak export türleri
 * @returns Prepared document array
 */
export const createVirtualExports = (
  tender: TenderInfo,
  content: TenderContent,
  exportTypes: ExportType[]
): PreparedDocument[] => {
  console.log(`🔧 createVirtualExports başlatıldı:`, {
    exportTypes,
    tenderTitle: tender.title.substring(0, 30),
    hasDetails: !!content.details,
    fullTextLength: content.fullText?.length || 0
  });

  const results: PreparedDocument[] = [];

  for (const exportType of exportTypes) {
    try {
      let fileContent = '';
      let mimeType = '';
      let filename = '';

      // Title'ı dosya adı için temizle (max 30 karakter)
      const safeTitle = tender.title.substring(0, 30).replace(/[^a-zA-Z0-9-_]/g, '_');

      switch (exportType) {
        case 'json':
          fileContent = JSON.stringify(
            {
              title: tender.title,
              organization: tender.organization,
              details: content.details,
              fullText: content.fullText,
              documents: content.documents,
            },
            null,
            2
          );
          mimeType = DOCUMENT_CONFIG.EXPORT_FORMATS.JSON.mimeType;
          filename = `${safeTitle}${DOCUMENT_CONFIG.EXPORT_FORMATS.JSON.extension}`;
          break;

        case 'txt':
          fileContent = `İHALE DETAYI\n\n`;
          fileContent += `Başlık: ${tender.title}\n`;
          fileContent += `Kurum: ${tender.organization}\n\n`;
          fileContent += `DETAYLAR:\n`;
          Object.entries(content.details || {}).forEach(([key, value]) => {
            fileContent += `${key}: ${value}\n`;
          });
          fileContent += `\n\nİÇERİK:\n${content.fullText}`;
          mimeType = DOCUMENT_CONFIG.EXPORT_FORMATS.TXT.mimeType;
          filename = `${safeTitle}${DOCUMENT_CONFIG.EXPORT_FORMATS.TXT.extension}`;
          break;

        case 'csv':
          fileContent = 'Alan,Değer\n';
          fileContent += `Başlık,"${tender.title.replace(/"/g, '""')}"\n`;
          fileContent += `Kurum,"${tender.organization.replace(/"/g, '""')}"\n`;
          Object.entries(content.details || {}).forEach(([key, value]) => {
            const escapedKey = String(key).replace(/"/g, '""');
            const escapedValue = String(value).replace(/"/g, '""');
            fileContent += `"${escapedKey}","${escapedValue}"\n`;
          });
          mimeType = DOCUMENT_CONFIG.EXPORT_FORMATS.CSV.mimeType;
          filename = `${safeTitle}${DOCUMENT_CONFIG.EXPORT_FORMATS.CSV.extension}`;
          break;

        default:
          console.warn(`⚠️ Bilinmeyen export type: ${exportType}, atlanıyor`);
          continue;
      }

      const blob = new Blob([fileContent], { type: mimeType });

      console.log(`✅ Virtual export oluşturuldu: ${filename} (${blob.size} bytes)`);

      results.push({
        title: filename,
        url: `virtual:${exportType}`,
        mimeType,
        blob,
        size: blob.size,
        type: 'export',
        isFromZip: false,
      });
    } catch (error) {
      console.error(`❌ Virtual export oluşturma hatası (${exportType}):`, error);
      // Hata olsa bile diğer export'ları dene
      continue;
    }
  }

  console.log(`🔧 createVirtualExports tamamlandı: ${results.length}/${exportTypes.length} dosya oluşturuldu`);
  return results;
};

/**
 * Virtual URL'leri parse et (virtual:csv → ['csv'])
 *
 * @param urls - Seçilen URL listesi
 * @returns Virtual export types
 */
export const parseVirtualUrls = (urls: string[]): ExportType[] => {
  const virtualPrefix = 'virtual:';
  return urls
    .filter(url => url.startsWith(virtualPrefix))
    .map(url => url.replace(virtualPrefix, '') as ExportType);
};

/**
 * Real URL'leri filtrele (virtual olmayan)
 *
 * @param urls - Seçilen URL listesi
 * @returns Real document URLs
 */
export const parseRealUrls = (urls: string[]): string[] => {
  const virtualPrefix = 'virtual:';
  return urls.filter(url => !url.startsWith(virtualPrefix));
};

/**
 * 🆕 CONTENT-BASED HASH GENERATOR (Nov 9, 2025)
 * 
 * SHA-256 hash ile dosya içeriği bazlı duplicate detection
 * Farklı isimde aynı içerik tespit edilir
 * 
 * @param blob - Dosya Blob'u
 * @returns SHA-256 hash string
 */
export const generateContentHash = async (blob: Blob): Promise<string> => {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Hash generation error:', error);
    // Fallback: Simple hash based on size and first bytes
    return `fallback_${blob.size}_${Date.now()}`;
  }
};

/**
 * Duplicate dökümanları filtrele (ENHANCED - Nov 9, 2025)
 *
 * ⚠️ BACKWARD COMPATIBLE: Sync signature korundu, async logic opt-in
 * 
 * İki katmanlı duplicate detection:
 * 1. Title + URL (hızlı, senkron, her zaman çalışır)
 * 2. Content Hash (SHA-256, async, opt-in via enableContentHash)
 *
 * @param newDocs - Yeni eklenen dökümanlar
 * @param existingDocs - Mevcut dökümanlar
 * @param options - Opsiyonel: { enableContentHash: boolean }
 * @returns Sadece unique dökümanlar (sync ise Promise wrap'li)
 */
export const filterDuplicateDocuments = (
  newDocs: PreparedDocument[],
  existingDocs: PreparedDocument[],
  options?: { enableContentHash?: boolean }
): PreparedDocument[] | Promise<PreparedDocument[]> => {
  console.log(`🔍 Duplicate kontrolü başlatıldı:`, {
    yeniDosyaSayisi: newDocs.length,
    mevcutDosyaSayisi: existingDocs.length,
    contentHashEnabled: options?.enableContentHash || false
  });

  // Layer 1: Title + URL (ALWAYS - SYNC)
  const existingKeys = new Set(
    existingDocs.map(doc => `${doc.title}|||${doc.url}`)
  );

  const duplicates: string[] = [];
  const uniqueDocs = newDocs.filter(doc => {
    const fileKey = `${doc.title}|||${doc.url}`;
    const isUnique = !existingKeys.has(fileKey);

    if (!isUnique) {
      duplicates.push(doc.title);
    }

    return isUnique;
  });

  if (duplicates.length > 0) {
    console.warn(`⚠️ ${duplicates.length} duplicate dosya atlandı (title+url):`, duplicates.slice(0, 5));
  }

  console.log(`✅ Layer 1 duplicate kontrolü tamamlandı: ${uniqueDocs.length} unique dosya`);

  // Layer 2: Content Hash (OPTIONAL - ASYNC)
  if (options?.enableContentHash) {
    return filterDuplicateDocumentsWithContentHash(uniqueDocs, existingDocs);
  }

  return uniqueDocs;
};

/**
 * Content-hash based duplicate detection (ASYNC)
 * 
 * @param newDocs - Title+URL unique docs
 * @param existingDocs - Existing docs for hash comparison
 * @returns Unique docs (no content duplicates)
 */
async function filterDuplicateDocumentsWithContentHash(
  newDocs: PreparedDocument[],
  existingDocs: PreparedDocument[]
): Promise<PreparedDocument[]> {
  console.log('   📝 Layer 2: Content hash hesaplanıyor...');
  
  const existingHashes = new Set<string>();
  
  // Mevcut dosyaların hash'lerini hesapla (paralel)
  await Promise.all(
    existingDocs.map(async (doc) => {
      const hash = await generateContentHash(doc.blob);
      existingHashes.add(hash);
    })
  );

  // Duplicate tracking
  const contentDuplicates: string[] = [];
  const uniqueDocs: PreparedDocument[] = [];

  // Yeni dosyaları kontrol et (sequential - race condition önlemek için)
  for (const doc of newDocs) {
    const contentHash = await generateContentHash(doc.blob);

    if (existingHashes.has(contentHash)) {
      contentDuplicates.push(doc.title);
    } else {
      uniqueDocs.push(doc);
      existingHashes.add(contentHash); // Sonraki iterasyonlar için
    }
  }

  // Duplicate report
  if (contentDuplicates.length > 0) {
    console.warn(`⚠️ ${contentDuplicates.length} content-hash duplicate atlandı:`, contentDuplicates.slice(0, 5));
  }

  console.log(`✅ Layer 2 duplicate kontrolü tamamlandı: ${uniqueDocs.length} unique dosya`);

  return uniqueDocs;
}

/**
 * Type guard: PreparedDocument validation
 *
 * @param doc - Unknown object
 * @returns Type guard result
 */
export const isPreparedDocument = (doc: any): doc is PreparedDocument => {
  return (
    typeof doc === 'object' &&
    doc !== null &&
    typeof doc.title === 'string' &&
    typeof doc.url === 'string' &&
    typeof doc.mimeType === 'string' &&
    doc.blob instanceof Blob &&
    typeof doc.size === 'number' &&
    ['export', 'document', 'archive'].includes(doc.type) &&
    typeof doc.isFromZip === 'boolean'
  );
};