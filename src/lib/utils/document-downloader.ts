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
  
  console.log(`📥 İndiriliyor: ${url.substring(url.lastIndexOf('/') + 1)}`);
  console.log(`${requiresAuth ? '🔐 Auth' : '⚡ Simple'}: ${endpoint}`);

  try {
    let response: Response;
    
    if (method === 'POST') {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
    } else {
      response = await fetch(endpoint);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'İndirme başarısız');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 📦 ZIP dosyası mı?
    if (data.isZip && data.files && Array.isArray(data.files)) {
      console.log(`📦 ZIP extract: ${data.files.length} dosya (${elapsed}s)`);
      
      return data.files.map((file: any) => {
        const blob = new Blob(
          [Uint8Array.from(atob(file.content), c => c.charCodeAt(0))],
          { type: file.type || 'application/octet-stream' }
        );

        return {
          title: file.name,
          url: url,
          mimeType: file.type || 'application/octet-stream',
          blob,
          size: file.size || blob.size,
          type: file.type || 'application/octet-stream',
          isFromZip: true,
          originalFilename: file.name
        };
      });
    }

    // 📄 Tek dosya
    if (data.data) {
      console.log(`✅ İndirildi: ${data.filename} (${elapsed}s)`);
      
      const blob = new Blob(
        [Uint8Array.from(atob(data.data), c => c.charCodeAt(0))],
        { type: data.mimeType || 'application/octet-stream' }
      );

      return [{
        title: data.filename,
        url: url,
        mimeType: data.mimeType || 'application/octet-stream',
        blob,
        size: blob.size,
        type: data.mimeType || 'application/octet-stream',
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
  
  console.log(`📥 Download başlatıldı: ${validUrls.length} dosya`);
  
  // 🎯 OPTIMIZATION: 3'er 3'er batch processing (paralel değil - seri)
  const BATCH_SIZE = 3;
  const allFiles: DownloadedFile[] = [];
  
  for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
    const batch = validUrls.slice(i, i + BATCH_SIZE);
    
    // Batch içi paralel, batch'ler arası seri
    const batchPromises = batch.map(async (url, batchIndex) => {
      try {
        const globalIndex = i + batchIndex;
        if (options.onProgress) {
          options.onProgress({
            current: globalIndex + 1,
            total: validUrls.length,
            filename: url.substring(url.lastIndexOf('/') + 1)
          });
        }
        
        return await downloadDocument(url, options);
      } catch (error) {
        console.error(`❌ Download failed for ${url}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Flatten ve filtrele
    const batchFiles = batchResults
      .filter((result): result is DownloadedFile[] => result !== null)
      .flat();
    
    allFiles.push(...batchFiles);
    
    // 🎯 Batch'ler arası 100ms bekle (main thread'e nefes aldır)
    if (i + BATCH_SIZE < validUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Toplam ${allFiles.length} dosya indirildi`);
  
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
