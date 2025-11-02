/**
 * Table Detector - Belgede tablo var mı tespit eder
 */
export class TableDetector {
  /**
   * Metinde tablo olup olmadığını tespit et
   */
  static detectTables(text: string): {
    hasTables: boolean;
    tableCount: number;
    tableIndicators: string[];
    confidence: number;
  } {
    const indicators: string[] = [];
    let score = 0;

    // 1. Tablo başlık kelimeleri (Türkçe)
    const tableHeaders = [
      /\btoplam\b/gi,
      /\bkahvalt[ıi]\b/gi,
      /\b[öo]ğle\b/gi,
      /\bakşam\b/gi,
      /\bkuruluş\b/gi,
      /\bbirim\b/gi,
      /\bkişi say[ıi]s[ıi]\b/gi,
      /\bmiktar\b/gi,
      /\bfiyat\b/gi,
      /\btutar\b/gi,
    ];

    tableHeaders.forEach((regex) => {
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        score += matches.length * 2;
        indicators.push(`Tablo başlığı: "${matches[0]}"`);
      }
    });

    // 2. Sayı dizileri (tablo içeriği)
    const numberSequences = text.match(/(\d+[\s\t]+){3,}/g);
    if (numberSequences) {
      score += numberSequences.length * 5;
      indicators.push(`${numberSequences.length} sayı dizisi bulundu`);
    }

    // 3. Tablo çizgileri veya ayraçlar
    const tableBorders = text.match(/[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬]/g);
    if (tableBorders && tableBorders.length > 10) {
      score += 20;
      indicators.push("Tablo çizgileri bulundu");
    }

    // 4. Tab karakterleri (tablo hücreleri arası)
    const tabCount = (text.match(/\t/g) || []).length;
    if (tabCount > 10) {
      score += Math.min(tabCount, 30);
      indicators.push(`${tabCount} tab karakteri (tablo hücreleri)`);
    }

    // 5. Çoklu boşluklar (tablo formatı)
    const multiSpaces = text.match(/\s{3,}/g);
    if (multiSpaces && multiSpaces.length > 20) {
      score += 10;
      indicators.push("Tablo formatı tespit edildi");
    }

    // 6. Satır sayısı kontrolü (tablolar çok satırlı)
    const lines = text.split('\n');
    const linesWithMultipleNumbers = lines.filter(
      (line) => (line.match(/\b\d+\b/g) || []).length >= 3
    );
    if (linesWithMultipleNumbers.length > 5) {
      score += linesWithMultipleNumbers.length;
      indicators.push(`${linesWithMultipleNumbers.length} satırda 3+ sayı var`);
    }

    // 7. "Tablo" kelimesi geçiyor mu?
    if (/tablo/gi.test(text)) {
      score += 15;
      indicators.push('"Tablo" kelimesi bulundu');
    }

    // Confidence hesapla
    const confidence = Math.min(score / 100, 1.0);
    const hasTables = confidence > 0.3;

    // Tablo sayısı tahmini
    const tableCount = Math.max(
      Math.floor(score / 30),
      (text.match(/tablo\s*\d+/gi) || []).length
    );

    return {
      hasTables,
      tableCount: hasTables ? Math.max(tableCount, 1) : 0,
      tableIndicators: indicators,
      confidence,
    };
  }

  /**
   * Tablolar içeren bölümleri çıkar
   */
  static extractTableSections(text: string): string[] {
    const sections: string[] = [];
    const lines = text.split('\n');
    const tableLineIndices: number[] = [];

    // Önce tablo göstergesi olan satırları bul
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const score = this.scoreTableLine(line);

      // YENİ: 0.7 threshold - SADECE ÇOK güçlü kanıtı olanlar
      // Border karakteri (0.7) veya 3+ tab (0.5) + keyword + sayı olması gerek
      if (score >= 0.7) {
        tableLineIndices.push(i);
      }
    }

    if (tableLineIndices.length === 0) {
      return [];
    }

    // Context window ile tablo bölümlerini genişlet
    const CONTEXT_BEFORE = 2; // Önce 2 satır (başlık için)
    const CONTEXT_AFTER = 3;  // Sonra 3 satır (toplam için)
    const MAX_GAP = 2; // Tablo satırları arası max 2 satır boşluk tolere et

    let currentSection: number[] = [];

    for (let i = 0; i < tableLineIndices.length; i++) {
      const idx = tableLineIndices[i];

      if (currentSection.length === 0) {
        // Yeni section başlat - context ekle
        const start = Math.max(0, idx - CONTEXT_BEFORE);
        for (let j = start; j <= idx; j++) {
          currentSection.push(j);
        }
      } else {
        const lastIdx = currentSection[currentSection.length - 1];
        const gap = idx - lastIdx;

        if (gap <= MAX_GAP) {
          // Ara satırları da ekle
          for (let j = lastIdx + 1; j <= idx; j++) {
            currentSection.push(j);
          }
        } else {
          // Çok büyük gap - section'ı bitir, context ekle
          const end = Math.min(lines.length - 1, lastIdx + CONTEXT_AFTER);
          for (let j = lastIdx + 1; j <= end; j++) {
            currentSection.push(j);
          }

          // Section'ı kaydet
          if (currentSection.length >= 2) { // Min 2 satır
            const sectionText = currentSection.map(i => lines[i]).join('\n');
            sections.push(sectionText);
          }

          // Yeni section başlat
          currentSection = [];
          const start = Math.max(0, idx - CONTEXT_BEFORE);
          for (let j = start; j <= idx; j++) {
            currentSection.push(j);
          }
        }
      }
    }

    // Son section'ı kaydet - context ekle
    if (currentSection.length > 0) {
      const lastIdx = currentSection[currentSection.length - 1];
      const end = Math.min(lines.length - 1, lastIdx + CONTEXT_AFTER);
      for (let j = lastIdx + 1; j <= end; j++) {
        currentSection.push(j);
      }

      if (currentSection.length >= 2) {
        const sectionText = currentSection.map(i => lines[i]).join('\n');
        sections.push(sectionText);
      }
    }

    return sections;
  }

  /**
   * Bir satırın tablo satırı olma skorunu hesapla (0-1 arası)
   */
  private static scoreTableLine(line: string): number {
    let score = 0;

    // ÖNCE: Eğer satır çok kısa (<10 karakter) veya boşsa, tablo değil
    if (line.trim().length < 10) return 0;

    // GÜÇLÜ İNDİKATÖRLER - Kesinlikle tablo
    // Tablo border karakterleri - en güçlü kanıt
    if (/[│┌┐└┘├┤─┬┴┼═║╔╗╚╝╠╣╦╩╬]/.test(line)) {
      score += 0.7; // Çok yüksek - kesinlikle tablo
    }

    // Tab karakterleri - güçlü kanıt
    const tabs = (line.match(/\t/g) || []).length;
    if (tabs >= 3) score += 0.5; // 3+ tab varsa kesinlikle tablo
    else if (tabs >= 2) score += 0.3;

    // ORTA GÜÇLÜKTE İNDİKATÖRLER
    // Sayı yoğunluğu - tablolarda çok sayı olur
    const numbers = line.match(/\b\d+\b/g) || [];
    if (numbers.length >= 4) score += 0.4; // 4+ sayı → tablo olabilir
    else if (numbers.length === 3) score += 0.2; // 3 sayı → belki tablo

    // Çoklu boşluklar (4+ boşluk) - tablo formatı
    const multiSpaces = (line.match(/\s{4,}/g) || []).length;
    if (multiSpaces >= 3) score += 0.3; // 3+ çoklu boşluk → tablo
    else if (multiSpaces >= 2) score += 0.15;

    // ZAYIF İNDİKATÖRLER - Sadece destek
    // Tablo kelimeleri - TEK BAŞINA YETMİYOR
    let hasTableKeyword = false;
    if (/\b(kahvalt[ıi]|[öo]ğle|akşam)\b/gi.test(line)) {
      hasTableKeyword = true;
      score += 0.15; // Azaltıldı - tek başına yetmez
    }
    if (/\btoplam\b/gi.test(line)) {
      hasTableKeyword = true;
      score += 0.2;
    }
    if (/\b(kuruluş|birim|miktar|fiyat|tutar)\b/gi.test(line)) {
      hasTableKeyword = true;
      score += 0.1;
    }

    // ⚠️ CEZA - Tablo OLMAYAN satırlar için
    // Uzun cümle varsa (50+ karakter noktalama ile), muhtemelen paragraf
    if (line.length > 50 && /[.,;:!?]/.test(line) && !hasTableKeyword) {
      score -= 0.3; // Ceza ver
    }

    // Madde numarası varsa (örn: "17-Yüklenici"), tablo değil
    if (/^\d{1,2}-[A-ZÇĞİÖŞÜ]/.test(line.trim())) {
      score -= 0.4; // Büyük ceza
    }

    return Math.max(0, Math.min(score, 1.0)); // 0-1 arası sınırla
  }

  /**
   * Tablo öncelik skoru - hangi kısmı Vision'a gönderelim?
   */
  static prioritizeSections(text: string): {
    highPriority: string; // En önemli tablolar
    lowPriority: string; // Diğer metin
  } {
    const lines = text.split('\n');
    const tableLineIndices = new Set<number>();

    // YENİ: SADECE yüksek skorlu satırları tablo olarak işaretle (context değil!)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const score = this.scoreTableLine(line);

      // 0.7+ skoru olanlar gerçek tablo satırı
      if (score >= 0.7) {
        tableLineIndices.add(i);
      }
    }

    // Eğer çok fazla tablo varsa, detector hatalı - tablo yok say
    const tableRatio = tableLineIndices.size / lines.length;
    if (tableRatio > 0.5) {
      // %50'den fazlası tablo olamaz - hata var, tablo yok kabul et
      console.warn(`⚠️ Table detector çok agresif: %${Math.round(tableRatio * 100)} tablo! Tablo YOK kabul ediliyor.`);
      return {
        highPriority: '',
        lowPriority: text,
      };
    }

    const high: string[] = [];
    const low: string[] = [];

    lines.forEach((line, i) => {
      if (tableLineIndices.has(i)) {
        high.push(line);
      } else {
        low.push(line);
      }
    });

    return {
      highPriority: high.join('\n'),
      lowPriority: low.join('\n'),
    };
  }
}
