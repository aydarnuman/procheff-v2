/**
 * Türkçe metin normalizeasyonu için utility fonksiyonları
 */

export class TurkishNormalizer {
  private static turkishCharMap: { [key: string]: string } = {
    Ç: "C",
    ç: "c",
    Ğ: "G",
    ğ: "g",
    İ: "I",
    ı: "i",
    Ö: "O",
    ö: "o",
    Ş: "S",
    ş: "s",
    Ü: "U",
    ü: "u",
  };

  /**
   * Türkçe karakterleri İngilizce karakterlere dönüştürür
   */
  static toAscii(text: string): string {
    return text.replace(/[ÇçĞğİıÖöŞşÜü]/g, (char) => {
      return this.turkishCharMap[char] || char;
    });
  }

  /**
   * Metni temizler ve normalize eder
   */
  static normalize(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, " ") // Çoklu boşlukları tek boşluğa dönüştür
      .replace(/[^\w\sğüşıöçİĞÜŞIÖÇ.,;:!?()-]/g, "") // Özel karakterleri temizle
      .replace(/([.!?])\s*\n/g, "$1 ") // Satır sonlarını düzenle
      .replace(/\n+/g, "\n"); // Çoklu satır atlamalarını tek satır atlamasına dönüştür
  }

  /**
   * Boş veya anlamsız içeriği tespit eder
   */
  static isEmpty(text: string): boolean {
    const cleaned = text.trim().replace(/[\s\n\r\t]/g, "");
    return cleaned.length < 10 || /^[^a-zA-ZğüşıöçİĞÜŞIÖÇ]*$/.test(cleaned);
  }

  /**
   * Sayfa içeriğinin kalitesini değerlendirir (0-1 arası)
   */
  static getContentQuality(text: string): number {
    if (this.isEmpty(text)) return 0;

    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;
    const alphaRatio =
      (text.match(/[a-zA-ZğüşıöçİĞÜŞIÖÇ]/g) || []).length / charCount;

    let quality = 0;

    // Kelime sayısı kontrolü
    if (wordCount >= 10) quality += 0.3;
    else quality += (wordCount / 10) * 0.3;

    // Alfabe karakteri oranı
    quality += alphaRatio * 0.4;

    // Cümle yapısı kontrolü
    const sentenceCount = (text.match(/[.!?]+/g) || []).length;
    if (sentenceCount > 0) quality += 0.3;

    return Math.min(quality, 1);
  }

  /**
   * İhale belgelerinde önemli anahtar kelimeleri tespit eder
   */
  static extractKeyTerms(text: string): string[] {
    const keyTermPatterns = [
      /ihale|tender/gi,
      /şartname|specification/gi,
      /başvuru|application/gi,
      /teklif|offer|bid/gi,
      /maliyet|cost|fiyat|price/gi,
      /teslim|delivery/gi,
      /garanti|warranty/gi,
      /kalite|quality/gi,
      /standart|standard/gi,
      /belgele[rn]|document/gi,
      /değerlendirme|evaluation/gi,
      /kriter|criteria/gi,
    ];

    const foundTerms: string[] = [];

    keyTermPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        foundTerms.push(...matches.map((m) => m.toLowerCase()));
      }
    });

    // Unique terms döndür
    return [...new Set(foundTerms)];
  }
}
