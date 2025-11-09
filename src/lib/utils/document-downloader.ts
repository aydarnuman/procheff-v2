/**
 * 📥 Document Downloader Utility
 * 
 * İhalebul.com ve diğer kaynaklardan döküman indirmek için merkezi utility.
 * Authentication gereken kaynaklar için otomatik Puppeteer login yapar.
 * ZIP dosyalarını otomatik extract eder.
 * 
 * @module document-downloader
 */

interface DownloadedFile {
  title: string;
  url: string;
  mimeType: string;
  blob: Blob;
  size: number;
  type: string;
  isFromZip?: boolean;
  originalFilename?: string;
}

interface DownloadProgress {
  current: number;
  total: number;
  filename: string;
  elapsed?: string;
}

interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  timeout?: number;
  retries?: number;
}

/**
 * 🔐 URL'ye göre doğru download endpoint'ini seçer
 */
function getDownloadEndpoint(url: string): { endpoint: string; method: 'GET' | 'POST'; requiresAuth: boolean } {
  const isIhalebul = url.includes('ihalebul.com');
  
  if (isIhalebul) {
    return {
      endpoint: '/api/ihale-scraper/download-with-auth',
      method: 'POST',
      requiresAuth: true
    };
  }
  
  return {
    endpoint: `/api/ihale-scraper/download-document?url=${encodeURIComponent(url)}`,
    method: 'GET',
    requiresAuth: false
  };
}

/**
 * 📥 Tek bir dökümanı indir
 * 
 * @param url - İndirilecek dökümanın URL'i
 * @param options - İndirme seçenekleri
 * @returns İndirilen dosya(lar) - ZIP ise içindeki tüm dosyalar
 */
export async function downloadDocument(
  url: string,
  options: DownloadOptions = {}
): Promise<DownloadedFile[]> {
  const startTime = Date.now();
  const { endpoint, method, requiresAuth } = getDownloadEndpoint(url);
  const filename = url.substring(url.lastIndexOf('/') + 1);

  console.log(`📥 İndirme başlatıldı:`, {
    dosya: filename,
    url: url.substring(0, 80) + '...',
    authGerekli: requiresAuth,
    endpoint: endpoint.substring(0, 60)
  });

  try {
    let response: Response;

    if (method === 'POST') {
      console.log(`🔐 POST isteği gönderiliyor: ${endpoint}`);
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
    } else {
      console.log(`⚡ GET isteği gönderiliyor: ${endpoint}`);
      response = await fetch(endpoint);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Yanıt okunamadı');
      console.error(`❌ HTTP hatası:`, {
        status: response.status,
        statusText: response.statusText,
        url: filename,
        errorPreview: errorText.substring(0, 200)
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      console.error(`❌ API hatası:`, {
        url: filename,
        hata: data.error || 'Bilinmeyen hata',
        detay: data.details || 'Detay yok'
      });
      throw new Error(data.error || 'İndirme başarısız');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 📦 ZIP dosyası mı?
    if (data.isZip && data.files && Array.isArray(data.files)) {
      console.log(`📦 ZIP extract: ${data.files.length} dosya (${elapsed}s)`);
      
      return data.files.map((file: any) => {
        // 🎯 MIME TYPE FIX: ZIP'ten çıkan dosyalarda da düzelt
        let mimeType = file.type || 'application/octet-stream';
        
        if (mimeType === "" || mimeType === "application/octet-stream") {
          const ext = (file.name || '').toLowerCase().split('.').pop();
          if (ext === "pdf") mimeType = "application/pdf";
          else if (ext === "docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          else if (ext === "txt") mimeType = "text/plain";
          else if (ext === "json") mimeType = "text/plain";
          else if (ext === "csv") mimeType = "text/csv";
          else if (ext === "html" || ext === "htm") mimeType = "text/html";
          
          console.log(`🔧 ZIP dosya MIME düzeltildi: ${file.name} → "${mimeType}"`);
        }
        
        const blob = new Blob(
          [Uint8Array.from(atob(file.content), c => c.charCodeAt(0))],
          { type: mimeType }
        );

        // 📦 ZIP'ten extract edilen dosyalara prefix ekle
        const displayTitle = `[ZIP] ${file.name}`;

        return {
          title: displayTitle,
          url: url,
          mimeType: mimeType,
          blob,
          size: file.size || blob.size,
          type: mimeType,
          isFromZip: true,
          originalFilename: file.name
        };
      });
    }

    // 📄 Tek dosya
    if (data.data) {
      console.log(`✅ İndirildi: ${data.filename} (${elapsed}s)`);
      
      // 🎯 MIME TYPE FIX: Tek dosyada da düzelt
      let mimeType = data.mimeType || 'application/octet-stream';
      
      if (mimeType === "" || mimeType === "application/octet-stream") {
        const ext = (data.filename || '').toLowerCase().split('.').pop();
        if (ext === "pdf") mimeType = "application/pdf";
        else if (ext === "docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (ext === "txt") mimeType = "text/plain";
        else if (ext === "json") mimeType = "text/plain";
        else if (ext === "csv") mimeType = "text/csv";
        else if (ext === "html" || ext === "htm") mimeType = "text/html";
        
        console.log(`🔧 Download MIME düzeltildi: ${data.filename} → "${mimeType}"`);
      }
      
      const blob = new Blob(
        [Uint8Array.from(atob(data.data), c => c.charCodeAt(0))],
        { type: mimeType }
      );

      return [{
        title: data.filename,
        url: url,
        mimeType: mimeType,
        blob,
        size: blob.size,
        type: mimeType,
        isFromZip: false,
        originalFilename: data.filename
      }];
    }

    throw new Error('Invalid response format');

  } catch (error) {
    console.error(`❌ Download error:`, error);
    throw error;
  }
}

/**
 * 📥 Birden fazla dökümanı paralel indir
 * 🎯 OPTIMIZED: Batch processing ile main thread bloking önlendi
 * 
 * @param urls - İndirilecek dökümanların URL'leri
 * @param options - İndirme seçenekleri
 * @returns Tüm indirilen dosyalar (ZIP'ler extract edilmiş)
 */
export async function downloadDocuments(
  urls: string[],
  options: DownloadOptions = {}
): Promise<DownloadedFile[]> {
  const validUrls = urls.filter(url => !url.startsWith('virtual://'));

  console.log(`📥 Batch download başlatıldı:`, {
    toplamUrl: urls.length,
    gecerliUrl: validUrls.length,
    virtualUrl: urls.length - validUrls.length
  });

  // 🎯 OPTIMIZATION: 3'er 3'er batch processing (paralel değil - seri)
  const BATCH_SIZE = 3;
  const allFiles: DownloadedFile[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
    const batch = validUrls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(validUrls.length / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} işleniyor (${batch.length} dosya)`);

    // Batch içi paralel, batch'ler arası seri
    const batchPromises = batch.map(async (url, batchIndex) => {
      try {
        const globalIndex = i + batchIndex;
        const filename = url.substring(url.lastIndexOf('/') + 1);

        if (options.onProgress) {
          options.onProgress({
            current: globalIndex + 1,
            total: validUrls.length,
            filename
          });
        }

        return await downloadDocument(url, options);
      } catch (error: any) {
        const filename = url.substring(url.lastIndexOf('/') + 1);
        const errorMsg = error?.message || String(error);

        console.error(`❌ İndirme başarısız:`, {
          dosya: filename,
          hata: errorMsg,
          batch: batchNum
        });

        errors.push({ url: filename, error: errorMsg });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Flatten ve filtrele
    const batchFiles = batchResults
      .filter((result): result is DownloadedFile[] => result !== null)
      .flat();

    allFiles.push(...batchFiles);

    console.log(`✅ Batch ${batchNum}/${totalBatches} tamamlandı: ${batchFiles.length} dosya`);

    // 🎯 Batch'ler arası 100ms bekle (main thread'e nefes aldır)
    if (i + BATCH_SIZE < validUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`🎉 Batch download tamamlandı:`, {
    basarili: allFiles.length,
    basarisiz: errors.length,
    toplam: validUrls.length
  });

  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} dosya indirilemedi:`, errors.slice(0, 3));
  }

  return allFiles;
}

/**
 * 🔄 File objelerine dönüştür (upload için)
 */
export function convertToFiles(downloadedFiles: DownloadedFile[]): File[] {
  return downloadedFiles.map(df =>
    new File([df.blob], df.title, { type: df.mimeType })
  );
}

/**
 * 🎯 ZIP dosyalarını otomatik extract et (sadece URL listesi için)
 *
 * Döküman listesinden ZIP dosyalarını bulur, indirir ve extract eder.
 * ZIP dosyasının kendisini listeden kaldırır, içindeki dosyaları ekler.
 *
 * @param documents - Döküman listesi [{title, url, type}]
 * @returns Extract edilmiş döküman listesi (ZIP'ler expand edilmiş)
 */
export async function autoExtractZipsInDocumentList(
  documents: Array<{title: string; url: string; type: string}>
): Promise<Array<{title: string; url: string; type: string; isFromZip?: boolean; originalFilename?: string}>> {
  const zipUrls: string[] = [];
  const nonZipDocs: Array<{title: string; url: string; type: string}> = [];

  // ZIP ve non-ZIP dosyaları ayır
  documents.forEach(doc => {
    const isZip = doc.url.toLowerCase().endsWith('.zip') ||
                  doc.title.toLowerCase().endsWith('.zip') ||
                  doc.title.toLowerCase().includes('şartname') && doc.url.toLowerCase().includes('.zip');

    if (isZip) {
      zipUrls.push(doc.url);
      console.log(`📦 ZIP tespit edildi: ${doc.title} → ${doc.url.substring(0, 80)}`);
    } else {
      nonZipDocs.push(doc);
    }
  });

  // ZIP yoksa direkt geri dön
  if (zipUrls.length === 0) {
    console.log('✅ ZIP dosyası yok, dökümanlar olduğu gibi döndürülüyor');
    return documents;
  }

  console.log(`🎯 ${zipUrls.length} ZIP dosyası otomatik extract edilecek...`);

  try {
    // ZIP'leri indir ve extract et
    const extractedFiles = await downloadDocuments(zipUrls);

    console.log(`📦 ZIP extraction tamamlandı: ${extractedFiles.length} dosya extract edildi`);

    // Extract edilen dosyaları URL formatına dönüştür (virtual URL ile)
    const extractedDocs = extractedFiles.map(file => {
      // Virtual URL oluştur (browser memory'de blob URL olarak)
      const blobUrl = URL.createObjectURL(file.blob);

      return {
        title: file.originalFilename || file.title,
        url: blobUrl, // ⚠️ DIKKAT: Virtual blob URL - indirilebilir
        type: file.type || 'diger',
        isFromZip: true,
        originalFilename: file.originalFilename
      };
    });

    // Non-ZIP + Extract edilmiş dosyalar
    const finalDocuments = [...nonZipDocs, ...extractedDocs];

    console.log(`✅ Döküman listesi hazır:`, {
      toplamOnce: documents.length,
      zipSayisi: zipUrls.length,
      extractEdilen: extractedDocs.length,
      nonZip: nonZipDocs.length,
      toplamSonra: finalDocuments.length
    });

    return finalDocuments;
  } catch (error: any) {
    console.error('❌ ZIP auto-extract hatası:', error);
    // Hata durumunda orijinal listeyi geri dön
    console.warn('⚠️ ZIP extract edilemedi, orijinal liste döndürülüyor');
    return documents;
  }
}
