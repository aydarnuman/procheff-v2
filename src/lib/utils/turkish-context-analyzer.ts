/**
 * Türkçe Dilbilgisel Bağlam Analizi
 *
 * Özne-nesne-fiil ilişkilerini anlayarak personel vs kişi sayısı ayrımı yapar.
 */

export interface ContextAnalysisResult {
  type: 'personnel' | 'meal_recipient' | 'ambiguous';
  confidence: number;
  reasoning: string;
  extractedNumber?: number;
}

export class TurkishContextAnalyzer {

  /**
   * PERSONEL BAĞLAMI - Çalışan/İstihdam Edilen
   */
  private static personnelPatterns = {
    // Pasif fiil kalıpları (personel NESNE olur)
    passiveVerbs: [
      /(\d+)\s*personel\s+(çalıştırılacak|görevlendirilecek|istihdam\s+edilecek)/gi,
      /(\d+)\s*(aşçı|garson|hizmetli|işçi|çalışan)\s+(çalıştırılacak|istihdam)/gi,
      /çalıştırılacak\s+(\d+)\s*personel/gi, // "çalıştırılacak 8 personel"
    ],

    // Araç-fail pattern'i (tarafından)
    instrumentalCase: [
      /(\d+)\s*personel.*tarafından/gi,
      /(\d+)\s*(aşçı|garson|işçi|çalışan).*tarafından/gi,
    ],

    // Kadro detayı (1 aşçıbaşı, 3 aşçı...)
    detailedStaff: /(\d+)\s+(aşçıbaşı|aşçı|kebap\s+ustası|yardımcı|garson)/gi,

    // Başlık pattern'leri
    headers: [
      /İşçi\s+Sayısı\s+ve\s+İşçilerde\s+Aranan/gi,
      /Personel\s+(Kadrosu|Yapısı|İhtiyacı)/gi,
    ],
  };

  /**
   * KİŞİ BAĞLAMI - Hizmet Alan/Yemek Yiyen
   */
  private static recipientPatterns = {
    // Yönelme hali (-e/-a ile biten) - Daha geniş pattern'ler
    dativeCase: [
      /(\d+)\s*kişiye/gi,
      /(\d+)\s*öğrenciye/gi,
      /(\d+)\s*hastaya/gi,
      /(\d+)\s*refakatçiye/gi,
      /(\d+)\s*personele\s+(yemek|hizmet)/gi, // "personele yemek" = hizmet alan
      /(\d+)\s*çalışana\s+(yemek|hizmet)/gi,  // "çalışana yemek" = hizmet alan
    ],

    // Kapasite ifadeleri
    capacity: [
      /(\d+)\s*kişilik\s+(yemekhane|kafeterya|mutfak)/gi,
      /günlük\s+(\d+)\s+kişi/gi,
      /günde\s+(\d+)\s+kişi/gi,
      /(\d+)\s+kişi.*yemek/gi, // "700 kişilik yemek servisi"
      /toplam.*?(\d+)/gi, // "Toplam 17" veya "Toplam: 17"
      /Toplam\s*[\|:]\s*(\d+)/gi, // "Toplam | 17" veya "Toplam: 17"
    ],

    // Tablo başlıkları
    tableHeaders: [
      /toplam\s+kişi/gi,
      /hizmet\s+alacak\s+kişi/gi,
    ],
  };

  /**
   * Cümle içinde personel mi yoksa kişi mi olduğunu tespit et
   */
  static analyzeContext(sentence: string): ContextAnalysisResult {
    const normalized = sentence.toLowerCase().trim();

    // 1. PERSONEL KONTROLÜ
    const personnelScore = this.scorePersonnelContext(normalized);

    // 2. KİŞİ KONTROLÜ
    const recipientScore = this.scoreRecipientContext(normalized);

    // 3. KARŞILAŞTIR
    if (personnelScore.score > recipientScore.score) {
      return {
        type: 'personnel',
        confidence: personnelScore.score,
        reasoning: personnelScore.reasoning,
        extractedNumber: personnelScore.number,
      };
    } else if (recipientScore.score > personnelScore.score) {
      return {
        type: 'meal_recipient',
        confidence: recipientScore.score,
        reasoning: recipientScore.reasoning,
        extractedNumber: recipientScore.number,
      };
    } else {
      return {
        type: 'ambiguous',
        confidence: 0.5,
        reasoning: 'Bağlam belirsiz - hem personel hem kişi pattern\'leri var',
      };
    }
  }

  /**
   * Personel bağlamı puanla
   */
  private static scorePersonnelContext(text: string): { score: number; reasoning: string; number?: number } {
    let score = 0;
    let reasoning: string[] = [];
    let extractedNumber: number | undefined;

    // Pasif fiil kontrolü (en güçlü sinyal!)
    for (const pattern of this.personnelPatterns.passiveVerbs) {
      const match = pattern.exec(text);
      if (match) {
        score += 0.8;
        reasoning.push(`Pasif fiil tespit edildi: "${match[0]}"`);
        // Sayı ilk veya ikinci grupta olabilir (pattern'e göre)
        const foundNumber = parseInt(match[1]) || parseInt(match[2]);
        // İlk bulunan sayıyı sakla (daha güvenilir)
        if (!extractedNumber && foundNumber) {
          extractedNumber = foundNumber;
        }
        pattern.lastIndex = 0; // Reset regex
      }
    }

    // Araç-fail kontrolü (tarafından)
    for (const pattern of this.personnelPatterns.instrumentalCase) {
      const match = pattern.exec(text);
      if (match) {
        score += 0.9;
        reasoning.push(`Araç-fail tespit edildi: "${match[0]}"`);
        const foundNumber = parseInt(match[1]);
        // İlk bulunan sayıyı sakla (daha güvenilir)
        if (!extractedNumber && foundNumber) {
          extractedNumber = foundNumber;
        }
        pattern.lastIndex = 0;
      }
    }

    // Detaylı kadro kontrolü
    const staffMatches = [...text.matchAll(this.personnelPatterns.detailedStaff)];
    if (staffMatches.length >= 2) {
      score += 0.7;
      reasoning.push(`Detaylı kadro listesi: ${staffMatches.length} pozisyon`);

      // Detaylı kadroda toplam personel sayısını hesapla
      // SADECE eğer yukarıdaki pattern'ler bir sayı yakalamamışsa
      if (!extractedNumber) {
        const totalStaff = staffMatches.reduce((sum, match) => sum + parseInt(match[1]), 0);
        if (totalStaff > 0) {
          extractedNumber = totalStaff;
          reasoning.push(`Toplam kadro: ${totalStaff} personel`);
        }
      }
    }

    // Başlık kontrolü
    for (const headerPattern of this.personnelPatterns.headers) {
      if (headerPattern.test(text)) {
        score += 0.6;
        reasoning.push('Personel başlığı tespit edildi');
        headerPattern.lastIndex = 0;
      }
    }

    // Küçük sayı uyarısı (5-50 arası personel normaldir)
    if (extractedNumber && extractedNumber >= 3 && extractedNumber <= 50) {
      score += 0.3;
      reasoning.push(`Sayı aralığı personel için mantıklı (${extractedNumber})`);
    }

    return {
      score: Math.min(score, 1),
      reasoning: reasoning.join('; '),
      number: extractedNumber,
    };
  }

  /**
   * Kişi (hizmet alan) bağlamı puanla
   */
  private static scoreRecipientContext(text: string): { score: number; reasoning: string; number?: number } {
    let score = 0;
    let reasoning: string[] = [];
    let extractedNumber: number | undefined;

    // Yönelme hali kontrolü (-e/-a)
    for (const pattern of this.recipientPatterns.dativeCase) {
      const match = pattern.exec(text);
      if (match) {
        score += 0.9;
        reasoning.push(`Yönelme hali tespit edildi: "${match[0]}"`);
        extractedNumber = parseInt(match[1]);
        pattern.lastIndex = 0;
      }
    }

    // Kapasite ifadeleri
    for (const pattern of this.recipientPatterns.capacity) {
      const match = pattern.exec(text);
      if (match) {
        score += 0.7;
        reasoning.push(`Kapasite ifadesi: "${match[0]}"`);
        extractedNumber = parseInt(match[1]);
        pattern.lastIndex = 0;
      }
    }

    // Büyük sayı uyarısı (100+ kişi genelde hizmet alandır)
    if (extractedNumber && extractedNumber >= 100) {
      score += 0.4;
      reasoning.push(`Sayı hizmet kapasitesi için mantıklı (${extractedNumber})`);
    }

    return {
      score: Math.min(score, 1),
      reasoning: reasoning.join('; '),
      number: extractedNumber,
    };
  }

  /**
   * Paragraf içindeki tüm sayıları bağlamıyla analiz et
   */
  static analyzeParagraph(paragraph: string): {
    personnelNumbers: number[];
    recipientNumbers: number[];
    ambiguousNumbers: number[];
  } {
    // Hem cümle hem satır bazlı analiz yap (tablolar için)
    const sentences = paragraph.split(/[.!?;]/);
    const lines = paragraph.split(/\n/);

    // Tüm segment'leri birleştir (cümleler + satırlar)
    const segments = [...sentences, ...lines].filter(s => s.trim().length > 0);

    const personnelNumbers: number[] = [];
    const recipientNumbers: number[] = [];
    const ambiguousNumbers: number[] = [];

    segments.forEach(segment => {
      const result = this.analyzeContext(segment);

      if (result.extractedNumber) {
        if (result.type === 'personnel' && result.confidence > 0.6) {
          personnelNumbers.push(result.extractedNumber);
        } else if (result.type === 'meal_recipient' && result.confidence > 0.6) {
          recipientNumbers.push(result.extractedNumber);
        } else {
          ambiguousNumbers.push(result.extractedNumber);
        }
      }
    });

    // Deduplicate (aynı sayıyı 2 kez saymayalım)
    return {
      personnelNumbers: [...new Set(personnelNumbers)],
      recipientNumbers: [...new Set(recipientNumbers)],
      ambiguousNumbers: [...new Set(ambiguousNumbers)],
    };
  }
}
