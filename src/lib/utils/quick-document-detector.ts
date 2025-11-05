/**
 * Hızlı Belge Türü Tespiti
 * Dosya ismi ve basit metin analizinden belge türünü tahmin eder
 */

import { BelgeTuru } from '@/types/ai';

/**
 * Dosya isminden belge türünü tahmin et
 */
export function detectDocumentTypeFromFileName(fileName: string): BelgeTuru {
  const nameLower = fileName.toLowerCase();

  // ⚠️ PDF/DOCX dosyaları ÖNCELİKLİ - bu dosyalar asla CSV/TXT olarak algılanmamalı
  const isPdfOrDocx = nameLower.endsWith('.pdf') || nameLower.endsWith('.docx') || nameLower.endsWith('.doc');

  if (isPdfOrDocx) {
    // PDF/DOCX dosyaları için normal tespit akışına devam et (aşağıdaki kurallara uysun)
    // Şartname kontrolü aşağıda yapılacak
  }

  // CSV, TXT, JSON dosyaları için özel kontrol
  // NOT: Sadece gerçekten text/csv/json uzantılı dosyalar için geçerli
  const isDataFile = !isPdfOrDocx && (nameLower.endsWith('.csv') || nameLower.endsWith('.txt') || nameLower.endsWith('.json'));

  if (isDataFile) {
    // Eğer "İhale Detayları" gibi kelimeler varsa → ihale_ilani
    if (
      nameLower.includes('ihale detay') ||
      nameLower.includes('tender detail') ||
      nameLower.includes('ihale bilgi') ||
      nameLower.includes('ilan')
    ) {
      return 'ihale_ilani';
    }
    // Eğer teknik şartname içeriyor → teknik_sartname
    if (nameLower.includes('teknik') && (nameLower.includes('şartname') || nameLower.includes('sartname'))) {
      return 'teknik_sartname';
    }
    // Eğer idari şartname içeriyor → idari_sartname
    if (nameLower.includes('idari') && (nameLower.includes('şartname') || nameLower.includes('sartname'))) {
      return 'idari_sartname';
    }
    // Varsayılan: belirsiz (AI'ya bırak - content-based detection yapılacak)
    return 'belirsiz';
  }

  // İhale İlanı
  if (
    nameLower.includes('ilan') ||
    nameLower.includes('ihale') && nameLower.includes('duyuru') ||
    nameLower.includes('tender')
  ) {
    return 'ihale_ilani';
  }

  // Teknik Şartname
  if (
    nameLower.includes('teknik') && nameLower.includes('şartname') ||
    nameLower.includes('teknik') && nameLower.includes('sartname') ||
    nameLower.includes('technical') && nameLower.includes('spec')
  ) {
    return 'teknik_sartname';
  }

  // İdari Şartname
  if (
    nameLower.includes('idari') && nameLower.includes('şartname') ||
    nameLower.includes('idari') && nameLower.includes('sartname') ||
    nameLower.includes('administrative')
  ) {
    return 'idari_sartname';
  }

  // Sözleşme Taslağı
  if (
    nameLower.includes('sözleşme') ||
    nameLower.includes('sozlesme') ||
    nameLower.includes('contract')
  ) {
    return 'sozlesme_tasarisi';
  }

  // Fiyat Teklif Mektubu
  if (
    nameLower.includes('fiyat') && nameLower.includes('teklif') ||
    nameLower.includes('price') && nameLower.includes('offer') ||
    nameLower.includes('teklif') && nameLower.includes('mektup')
  ) {
    return 'fiyat_teklif_mektubu';
  }

  // Varsayılan - belirsiz
  return 'belirsiz';
}

/**
 * Metin içeriğinden belge türünü tahmin et (geliştirilmiş)
 */
export function detectDocumentTypeFromContent(text: string, fileName: string): BelgeTuru {
  // Önce dosya isminden tahmin et
  const fileNameGuess = detectDocumentTypeFromFileName(fileName);
  if (fileNameGuess !== 'belirsiz') {
    return fileNameGuess;
  }

  // Metin çok kısa ise tahmin yapamayız
  if (!text || text.length < 100) {
    return 'belirsiz';
  }

  const textLower = text.toLowerCase();
  const first500 = textLower.slice(0, 500);

  // İhale İlanı - başlıkta veya ilk 500 karakterde
  if (
    first500.includes('ihale ilanı') ||
    first500.includes('ihale ilani') ||
    first500.includes('açık ihale') ||
    first500.includes('acik ihale') ||
    first500.includes('pazarlık usulü') ||
    first500.includes('pazarlik usulu')
  ) {
    return 'ihale_ilani';
  }

  // Teknik Şartname - içinde menü, gramaj, malzeme vs var
  if (
    (textLower.includes('teknik şartname') || textLower.includes('teknik sartname')) &&
    (textLower.includes('menü') || textLower.includes('menu') ||
     textLower.includes('gramaj') || textLower.includes('malzeme') ||
     textLower.includes('personel'))
  ) {
    return 'teknik_sartname';
  }

  // İdari Şartname - idari kurallar
  if (
    (textLower.includes('idari şartname') || textLower.includes('idari sartname')) &&
    (textLower.includes('genel hükümler') || textLower.includes('genel hukumler') ||
     textLower.includes('ödeme') || textLower.includes('odeme'))
  ) {
    return 'idari_sartname';
  }

  // Sözleşme
  if (
    first500.includes('sözleşme') ||
    first500.includes('sozlesme') ||
    (textLower.includes('taraf') && textLower.includes('madde'))
  ) {
    return 'sozlesme_tasarisi';
  }

  // Fiyat Teklif Mektubu
  if (
    textLower.includes('fiyat teklif') ||
    textLower.includes('teklif mektubu') ||
    (textLower.includes('teklif') && textLower.includes('₺'))
  ) {
    return 'fiyat_teklif_mektubu';
  }

  return 'belirsiz';
}

/**
 * Güven skoru hesapla (0-1 arası)
 */
export function getConfidenceScore(detectedType: BelgeTuru, fileName: string): number {
  if (detectedType === 'belirsiz') return 0.1;

  const fileNameGuess = detectDocumentTypeFromFileName(fileName);

  // Dosya ismi ile tahmin eşleşiyorsa yüksek güven
  if (fileNameGuess === detectedType) return 0.95;

  // Sadece içerikten tahmin edildiyse orta güven
  return 0.7;
}
