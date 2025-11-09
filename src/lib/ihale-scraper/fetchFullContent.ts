// fetchFullContent.ts
// Tek akış: tryCache → tryDB → fetchAI

import { validateTenderContent, logValidationResult } from './validators';

export async function fetchFullContent(tenderId: string): Promise<any> {
  // Validation: tenderId string ve yeterince uzun olmalı
  if (!tenderId || typeof tenderId !== 'string' || tenderId.length < 8) {
    console.error('❌ Invalid tenderId:', tenderId);
    return null;
  }

  console.groupCollapsed(`🔍 fetchFullContent(${tenderId})`);
  console.time('fetchFullContent');

  // 1. Önce cache'den dene
  const cached = tryCache(tenderId);
  console.log('💚 Cache check:', !!cached);
  if (cached) {
    console.timeEnd('fetchFullContent');
    console.groupEnd();
    return cached;
  }

  // 2. Sonra DB'den dene
  const dbResult = await tryDB(tenderId);
  console.log('🗄️ DB check:', !!dbResult);
  if (dbResult) {
    console.timeEnd('fetchFullContent');
    console.groupEnd();
    return dbResult;
  }

  // 3. En son AI'dan getir
  console.log('🤖 Falling back to AI fetch...');
  const aiResult = await fetchAI(tenderId);
  console.timeEnd('fetchFullContent');
  console.groupEnd();
  return aiResult;
}

function tryCache(tenderId: string): any {
  if (typeof window !== 'undefined') {
    const cache = localStorage.getItem('ihale-content-cache');
    if (cache) {
      try {
        const parsed = JSON.parse(cache);
        if (parsed[tenderId]) {
          const cachedData = parsed[tenderId];

          // ✅ Cache validasyonu ekle
          try {
            const validation = validateTenderContent(cachedData, {
              minTextLength: 100,
              minDetailsCount: 3,
              requireDocuments: false,
              strict: false,
            });

            if (!validation.valid) {
              console.error(`❌ localStorage cache'deki veri geçersiz, siliniyor:`, validation.errors);
              logValidationResult('tryCache (localStorage - invalid)', validation, cachedData);

              // Geçersiz cache'i sil
              delete parsed[tenderId];
              localStorage.setItem('ihale-content-cache', JSON.stringify(parsed));

              return null;
            }

            console.log('💚 Cache bulundu ve geçerli:', tenderId);
            return cachedData;
          } catch (validationError) {
            console.error('❌ Validasyon hatası:', validationError);
            // Validasyon hatası olursa cache'i kullanma
            return null;
          }
        }
      } catch (e) {
        console.error('❌ Cache parse hatası:', e);
        return null;
      }
    }
  }
  return null;
}

async function tryDB(tenderId: string): Promise<any> {
  try {
    const res = await fetch(`/api/ihale-scraper/analysis/${tenderId}`);
    const data = await res.json();
    if (data.success && data.data) {
      console.log('🗄️ DB bulundu:', tenderId);
      return data.data;
    }
  } catch (e) {
    console.warn('DB fetch hatası:', e);
  }
  return null;
}

async function fetchAI(tenderId: string): Promise<any> {
  try {
    // İlk önce tender bilgilerini al (URL gerekli)
    // tenderId burada source_id olarak geliyor, source parametresini de ekle
    const tenderRes = await fetch(`/api/ihale-scraper/list?source_id=${tenderId}&source=ihalebul`);
    const tenderData = await tenderRes.json();

    if (!tenderData.success || !tenderData.data || tenderData.data.length === 0) {
      console.error('❌ Tender bulunamadı:', tenderId);
      return null;
    }

    const tender = tenderData.data[0];
    const url = tender.source_url;

    if (!url) {
      console.error('❌ Tender URL eksik:', tenderId);
      return null;
    }

    console.log('🌐 Fetching full content from:', url);

    const res = await fetch(`/api/ihale-scraper/fetch-full-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenderId, url })
    });
    const data = await res.json();
    if (data.success && data.data) {
      console.log('🤖 AI ile getirildi:', tenderId);
      return data.data;
    } else {
      console.error('❌ AI fetch başarısız:', data.error || 'Bilinmeyen hata');
    }
  } catch (e) {
    console.error('❌ AI fetch hatası:', e);
  }
  return null;
}
