/**
 * Document Type Guesser
 * 
 * Dosya adı ve içerik bazlı belge türü tahmin sistemi
 * Türkçe devlet ihaleleri için optimize edilmiş
 */

import type { BelgeTuru } from '@/types/ai';

// --- PATTERN MATCHING ---

interface FilePatterns {
  keywords: string[];
  priority: number; // Yüksek priority = daha güvenilir
}

const FILENAME_PATTERNS: Record<BelgeTuru, FilePatterns> = {
  teknik_sartname: {
    keywords: [
      'teknik',
      'şartname',
      'sartname',
      'teknik-şartname',
      'teknikşartname',
      't.s.',
      'ts-',
      'technical',
      'spec'
    ],
    priority: 9
  },
  ihale_ilani: {
    keywords: [
      'ilan',
      'ilani',
      'duyuru',
      'announcement',
      'notice',
      'tender-notice',
      'ihaleilani',
      'ihale-ilani'
    ],
    priority: 9
  },
  sozlesme_tasarisi: {
    keywords: [
      'sözleşme',
      'sozlesme',
      'taslak',
      'tasarı',
      'contract',
      'draft',
      'sozlesme-tasarisi',
      's.t.'
    ],
    priority: 8
  },
  idari_sartname: {
    keywords: [
      'idari',
      'idari-şartname',
      'idarisartname',
      'administrative',
      'i.s.',
      'is-',
      'admin-spec'
    ],
    priority: 9
  },
  fiyat_teklif_mektubu: {
    keywords: [
      'fiyat',
      'teklif',
      'mektup',
      'price',
      'offer',
      'proposal',
      'fiyat-teklif',
      'teklif-mektubu',
      'f.t.m.'
    ],
    priority: 8
  },
  diger: {
    keywords: [
      'ek',
      'attachment',
      'appendix',
      'annex',
      'belge',
      'document',
      'dosya',
      'file'
    ],
    priority: 3
  },
  belirsiz: {
    keywords: [],
    priority: 0
  }
};

// --- CONTENT KEYWORD ANALYSIS ---

const CONTENT_KEYWORDS: Record<BelgeTuru, string[]> = {
  teknik_sartname: [
    'teknik şartname',
    'teknik özellikler',
    'malzeme cinsi',
    'gramaj',
    'ürün özellikleri',
    'menü çeşitleri',
    'yemek gramajları',
    'hijyen standartları',
    'haccp',
    'iso 22000',
    'marka tescil belgesi',
    'gıda kodeksi'
  ],
  ihale_ilani: [
    'ihale ilanı',
    'kamu ihale',
    'ekap',
    'ihale kayıt numarası',
    'son teklif verme',
    'ihale tarihi',
    'ihalenin türü',
    'açık ihale',
    'bütçe',
    'yaklaşık maliyet',
    'teklif alma',
    'ilan tarihi'
  ],
  sozlesme_tasarisi: [
    'sözleşme tasarısı',
    'madde 1',
    'taraflar',
    'yüklenici',
    'işveren',
    'sözleşmenin konusu',
    'sözleşme bedeli',
    'ödeme şartları',
    'ceza şartları',
    'fesih',
    'uyuşmazlık'
  ],
  idari_sartname: [
    'idari şartname',
    'genel şartlar',
    'özel şartlar',
    'ihalenin konusu',
    'ihalenin niteliği',
    'isteklilerde aranan şartlar',
    'teklif sunma',
    'belgeler',
    'şekli şartlar',
    'yeterlilik',
    'geçici teminat',
    'kesin teminat'
  ],
  fiyat_teklif_mektubu: [
    'fiyat teklifi',
    'teklif mektubu',
    'toplam tutar',
    'birim fiyat',
    'kdv',
    'indirim',
    'net tutar',
    'brüt tutar',
    'ödeme koşulları',
    'geçerlilik süresi'
  ],
  diger: [],
  belirsiz: []
};

/**
 * Dosya adından belge türü tahmin et
 */
export function guessDocumentTypeFromFilename(filename: string): {
  type: BelgeTuru;
  confidence: number; // 0-1
} {
  if (!filename) {
    return { type: 'belirsiz', confidence: 0 };
  }

  const normalizedFilename = filename
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics

  const matches: Array<{ type: BelgeTuru; priority: number; matchCount: number }> = [];

  for (const [type, patterns] of Object.entries(FILENAME_PATTERNS)) {
    const belgeTuru = type as BelgeTuru;
    let matchCount = 0;

    for (const keyword of patterns.keywords) {
      const normalizedKeyword = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (normalizedFilename.includes(normalizedKeyword)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      matches.push({
        type: belgeTuru,
        priority: patterns.priority,
        matchCount
      });
    }
  }

  if (matches.length === 0) {
    return { type: 'belirsiz', confidence: 0 };
  }

  // En yüksek priority ve match count'a göre sırala
  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.matchCount - a.matchCount;
  });

  const bestMatch = matches[0];
  
  // Confidence calculation
  let confidence = 0.5; // Base confidence for filename match
  
  if (bestMatch.priority >= 9) confidence = 0.85;
  else if (bestMatch.priority >= 8) confidence = 0.75;
  else if (bestMatch.priority >= 5) confidence = 0.6;
  
  // Bonus for multiple keyword matches
  if (bestMatch.matchCount > 1) {
    confidence = Math.min(confidence + (bestMatch.matchCount - 1) * 0.05, 0.95);
  }

  return {
    type: bestMatch.type,
    confidence
  };
}

/**
 * İçerikten belge türü tahmin et (ilk 5000 karakter)
 */
export function guessDocumentTypeFromContent(content: string): {
  type: BelgeTuru;
  confidence: number; // 0-1
} {
  if (!content || content.length < 100) {
    return { type: 'belirsiz', confidence: 0 };
  }

  // Sadece ilk 5000 karakteri analiz et (performance)
  const textSample = content.slice(0, 5000).toLowerCase();

  const scores: Array<{ type: BelgeTuru; score: number; matchCount: number }> = [];

  for (const [type, keywords] of Object.entries(CONTENT_KEYWORDS)) {
    const belgeTuru = type as BelgeTuru;
    let score = 0;
    let matchCount = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      
      // Count occurrences (max 3 per keyword to avoid skewing)
      const regex = new RegExp(normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const occurrences = Math.min((textSample.match(regex) || []).length, 3);
      
      if (occurrences > 0) {
        matchCount++;
        score += occurrences;
      }
    }

    if (matchCount > 0) {
      scores.push({
        type: belgeTuru,
        score,
        matchCount
      });
    }
  }

  if (scores.length === 0) {
    return { type: 'belirsiz', confidence: 0 };
  }

  // En yüksek score'a göre sırala
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.matchCount - a.matchCount;
  });

  const bestMatch = scores[0];
  
  // Confidence calculation based on keyword density
  let confidence = 0.4; // Base confidence for content match
  
  if (bestMatch.matchCount >= 5) confidence = 0.8;
  else if (bestMatch.matchCount >= 3) confidence = 0.65;
  else if (bestMatch.matchCount >= 2) confidence = 0.5;
  
  // Normalize confidence based on score strength
  const secondBestScore = scores[1]?.score || 0;
  if (bestMatch.score > secondBestScore * 2) {
    confidence = Math.min(confidence + 0.1, 0.9); // Clear winner bonus
  }

  return {
    type: bestMatch.type,
    confidence
  };
}

/**
 * Hibrit tahmin - dosya adı + içerik birleştir
 */
export function guessDocumentType(
  filename: string,
  content: string
): {
  type: BelgeTuru;
  confidence: number;
  filenameGuess: BelgeTuru;
  contentGuess: BelgeTuru;
} {
  const filenameResult = guessDocumentTypeFromFilename(filename);
  const contentResult = guessDocumentTypeFromContent(content);

  // Eğer ikisi de aynı sonuca varırsa yüksek güven
  if (filenameResult.type === contentResult.type && filenameResult.type !== 'belirsiz') {
    return {
      type: filenameResult.type,
      confidence: Math.min((filenameResult.confidence + contentResult.confidence) / 1.5, 0.95),
      filenameGuess: filenameResult.type,
      contentGuess: contentResult.type
    };
  }

  // Eğer biri belirsiz ise diğerini kullan
  if (filenameResult.type === 'belirsiz') {
    return {
      type: contentResult.type,
      confidence: contentResult.confidence * 0.9, // Slight penalty
      filenameGuess: filenameResult.type,
      contentGuess: contentResult.type
    };
  }

  if (contentResult.type === 'belirsiz') {
    return {
      type: filenameResult.type,
      confidence: filenameResult.confidence * 0.9, // Slight penalty
      filenameGuess: filenameResult.type,
      contentGuess: contentResult.type
    };
  }

  // Çakışma durumu - yüksek confidence'a sahip olanı al
  const winner =
    filenameResult.confidence > contentResult.confidence
      ? filenameResult
      : contentResult;

  return {
    type: winner.type,
    confidence: winner.confidence * 0.85, // Conflict penalty
    filenameGuess: filenameResult.type,
    contentGuess: contentResult.type
  };
}
