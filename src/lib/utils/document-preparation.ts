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
 * Duplicate dökümanları filtrele
 *
 * Problem: Aynı döküman 2 kere ekleniyor → setState'de duplicate check yap
 * Çözüm: Title + URL kombinasyonunu unique key olarak kullan
 *
 * @param newDocs - Yeni eklenen dökümanlar
 * @param existingDocs - Mevcut dökümanlar
 * @returns Sadece unique dökümanlar
 */
export const filterDuplicateDocuments = (
  newDocs: PreparedDocument[],
  existingDocs: PreparedDocument[]
): PreparedDocument[] => {
  console.log(`🔍 Duplicate kontrolü başlatıldı:`, {
    yeniDosyaSayisi: newDocs.length,
    mevcutDosyaSayisi: existingDocs.length
  });

  // Mevcut döküman key'leri (title|||url)
  const existingKeys = new Set(
    existingDocs.map(doc => `${doc.title}|||${doc.url}`)
  );

  // Duplicate olanları logla
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
    console.warn(`⚠️ ${duplicates.length} duplicate dosya atlandı:`, duplicates.slice(0, 5));
  }

  console.log(`✅ Duplicate kontrolü tamamlandı: ${uniqueDocs.length} unique dosya`);

  return uniqueDocs;
};

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