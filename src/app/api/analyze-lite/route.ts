import { NextRequest, NextResponse } from "next/server";
import { TurkishNormalizer } from "@/lib/utils/turkish-normalizer";

// Analiz kategorileri
interface AnalysisCategory {
  title: string;
  content: string[];
  confidence: number;
  evidencePassages: string[];
  keyMetrics?: { [key: string]: string | number };
}

interface DetailedAnalysis {
  generalInfo: AnalysisCategory;
  cost: AnalysisCategory;
  risks: AnalysisCategory;
  menu: AnalysisCategory;
  summary: string;
  overallConfidence: number;
  processingTime: number;
  wordCount: number;
  keyTermsFound: string[];
}

// Mock AI analiz motoru - gerçek uygulamada OpenAI/Claude kullanılacak
class TenderAnalysisEngine {
  static analyzeGeneralInfo(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    let confidence = 0;

    // İhale türü tespiti
    const tenderTypePatterns = [
      {
        pattern: /mal\s+alımı|malzeme\s+temini|ekipman\s+alımı/gi,
        term: "Mal Alımı",
      },
      { pattern: /hizmet\s+alımı|hizmet\s+temini/gi, term: "Hizmet Alımı" },
      { pattern: /yapım\s+işi|inşaat\s+işi/gi, term: "Yapım İşi" },
      { pattern: /danışmanlık\s+hizmet/gi, term: "Danışmanlık" },
    ];

    tenderTypePatterns.forEach(({ pattern, term }) => {
      const matches = text.match(pattern);
      if (matches) {
        content.push(`İhale Türü: ${term}`);
        passages.push(
          `"${matches[0]}" - İhale türü olarak ${term} tespit edildi`
        );
        confidence += 0.2;
      }
    });

    // İhale konusu çıkarma
    const subjectPatterns = [
      /ihale\s+konusu[:\s]+(.*?)(?=\n|\.|;)/gi,
      /konu[:\s]+(.*?)(?=\n|\.|;)/gi,
      /temini?[:\s]+(.*?)(?=\n|\.|;)/gi,
    ];

    subjectPatterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((match) => {
        if (match[1] && match[1].trim().length > 10) {
          content.push(`Konu: ${match[1].trim()}`);
          passages.push(`"${match[0]}" - İhale konusu belirlendi`);
          confidence += 0.15;
        }
      });
    });

    // İdarenin adı
    const authorityPatterns = [
      /(\w+\s+belediyesi?)/gi,
      /(\w+\s+müdürlüğü)/gi,
      /(\w+\s+bakanlığı)/gi,
      /(\w+\s+üniversitesi)/gi,
    ];

    authorityPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        content.push(`İdare: ${matches[0]}`);
        passages.push(`"${matches[0]}" - İdarenin adı tespit edildi`);
        confidence += 0.1;
      }
    });

    return {
      title: "Genel Bilgiler",
      content:
        content.length > 0 ? content : ["İhale genel bilgileri çıkarılamadı"],
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
    };
  }

  static analyzeCost(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    const keyMetrics: { [key: string]: string | number } = {};
    let confidence = 0;

    // Bütçe/Fiyat bilgileri
    const costPatterns = [
      {
        pattern:
          /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:tl|türk\s+lirası|lira)/gi,
        type: "TL",
      },
      {
        pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:usd|dolar|\$)/gi,
        type: "USD",
      },
      {
        pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:eur|euro|€)/gi,
        type: "EUR",
      },
    ];

    const foundAmounts: string[] = [];
    costPatterns.forEach(({ pattern, type }) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((match) => {
        foundAmounts.push(`${match[1]} ${type}`);
        passages.push(`"${match[0]}" - Maliyet bilgisi tespit edildi`);
        confidence += 0.2;
      });
    });

    if (foundAmounts.length > 0) {
      content.push(`Tespit Edilen Tutarlar: ${foundAmounts.join(", ")}`);
      keyMetrics.estimatedBudget = foundAmounts[0]; // İlk bulunan tutar
    }

    // Teminat bilgileri
    const guaranteePatterns = [
      /geçici\s+teminat[:\s]+(.*?)(?=\n|\.|;)/gi,
      /kesin\s+teminat[:\s]+(.*?)(?=\n|\.|;)/gi,
      /teminat\s+mektubu[:\s]+(.*?)(?=\n|\.|;)/gi,
    ];

    guaranteePatterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((match) => {
        content.push(`Teminat: ${match[1].trim()}`);
        passages.push(`"${match[0]}" - Teminat bilgisi bulundu`);
        confidence += 0.15;
      });
    });

    // KDV bilgisi
    if (/kdv|katma\s+değer\s+vergisi/gi.test(text)) {
      content.push("KDV durumu belirtilmiş");
      passages.push("KDV ile ilgili bilgi tespit edildi");
      confidence += 0.1;
    }

    return {
      title: "Maliyet Analizi",
      content:
        content.length > 0 ? content : ["Maliyet bilgileri çıkarılamadı"],
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
      keyMetrics,
    };
  }

  static analyzeRisks(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    let confidence = 0;

    // Risk faktörleri tespit etme
    const riskPatterns = [
      {
        pattern: /teslim\s+süresi[:\s]+(\d+)\s*gün/gi,
        risk: "Teslim Süresi",
        severity: "orta",
      },
      {
        pattern: /garanti\s+süresi[:\s]+(\d+)\s*(?:yıl|ay)/gi,
        risk: "Garanti Süresi",
        severity: "düşük",
      },
      {
        pattern: /ceza|para\s+cezası|gecikme\s+cezası/gi,
        risk: "Ceza Maddeleri",
        severity: "yüksek",
      },
      {
        pattern: /test|muayene|kontrol/gi,
        risk: "Kalite Kontrol",
        severity: "orta",
      },
      {
        pattern: /sigorta|ferdi\s+kaza/gi,
        risk: "Sigorta Gereksinimleri",
        severity: "orta",
      },
      {
        pattern: /ihale\s+iptal/gi,
        risk: "İhale İptal Riski",
        severity: "yüksek",
      },
    ];

    riskPatterns.forEach(({ pattern, risk, severity }) => {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        content.push(`${severity.toUpperCase()} RİSK: ${risk}`);
        matches.forEach((match) => {
          passages.push(`"${match[0]}" - ${risk} riski tespit edildi`);
        });
        confidence +=
          severity === "yüksek" ? 0.3 : severity === "orta" ? 0.2 : 0.1;
      }
    });

    // Teknik zorluk değerlendirmesi
    const technicalPatterns = [
      /özel\s+üretim|özelleştirilmiş/gi,
      /ithalat|yurtdışı/gi,
      /lisans|patent/gi,
      /standart|tse|iso/gi,
    ];

    technicalPatterns.forEach((pattern) => {
      if (pattern.test(text)) {
        content.push("ORTA RİSK: Teknik gereksinimler");
        passages.push("Teknik karmaşıklık riski tespit edildi");
        confidence += 0.15;
      }
    });

    return {
      title: "Risk Analizi",
      content: content.length > 0 ? content : ["Risk faktörleri belirlenemedi"],
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
    };
  }

  static analyzeMenu(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    let confidence = 0;

    // Yemek/menü ile ilgili terimler
    const menuPatterns = [
      { pattern: /yemek|beslenme|gıda/gi, term: "Yemek Hizmetleri" },
      {
        pattern: /kahvaltı|öğle\s+yemeği|akşam\s+yemeği/gi,
        term: "Öğün Bilgileri",
      },
      { pattern: /menü|yemek\s+listesi/gi, term: "Menü Planlaması" },
      { pattern: /mutfak|aşçı|aşhane/gi, term: "Mutfak Ekipmanları" },
      { pattern: /catering|yemek\s+servisi/gi, term: "Catering Hizmetleri" },
      {
        pattern: /hijyen|gıda\s+güvenliği|haccp/gi,
        term: "Hijyen Standartları",
      },
    ];

    menuPatterns.forEach(({ pattern, term }) => {
      const matches = text.match(pattern);
      if (matches) {
        content.push(`${term}: Tespit edildi`);
        passages.push(`"${matches[0]}" - ${term} ile ilgili bilgi bulundu`);
        confidence += 0.2;
      }
    });

    // Kişi sayısı tespiti
    const capacityPattern = /(\d+)\s*kişilik?/gi;
    const capacityMatches = [...text.matchAll(capacityPattern)];
    capacityMatches.forEach((match) => {
      content.push(`Kapasite: ${match[1]} kişi`);
      passages.push(`"${match[0]}" - Hizmet kapasitesi belirlendi`);
      confidence += 0.25;
    });

    // Beslenme standartları
    if (/beslenme\s+standart|diyet|kalori/gi.test(text)) {
      content.push("Beslenme Standartları: Belirtilmiş");
      passages.push(
        "Beslenme standartları ile ilgili gereksinimler tespit edildi"
      );
      confidence += 0.2;
    }

    return {
      title: "Menü ve Beslenme",
      content:
        content.length > 0 ? content : ["Menü/beslenme bilgileri bulunamadı"],
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
    };
  }

  static generateSummary(
    generalInfo: AnalysisCategory,
    cost: AnalysisCategory,
    risks: AnalysisCategory,
    menu: AnalysisCategory,
    wordCount: number
  ): string {
    const summaryParts: string[] = [];

    // Genel bilgi özeti
    if (generalInfo.confidence > 0.3) {
      const infoItems = generalInfo.content.filter(
        (item) => !item.includes("çıkarılamadı")
      );
      if (infoItems.length > 0) {
        summaryParts.push(
          `Bu ihale ${infoItems.join(", ").toLowerCase()} kapsamındadır.`
        );
      }
    }

    // Maliyet özeti
    if (cost.confidence > 0.3 && cost.keyMetrics?.estimatedBudget) {
      summaryParts.push(
        `Tahmini bütçe ${cost.keyMetrics.estimatedBudget} olarak belirlenmiştir.`
      );
    }

    // Risk özeti
    if (risks.confidence > 0.2) {
      const riskCount = risks.content.filter((item) =>
        item.includes("RİSK:")
      ).length;
      if (riskCount > 0) {
        summaryParts.push(
          `${riskCount} adet potansiyel risk faktörü tespit edilmiştir.`
        );
      }
    }

    // Menü özeti
    if (menu.confidence > 0.3) {
      const menuItems = menu.content.filter(
        (item) => !item.includes("bulunamadı")
      );
      if (menuItems.length > 0) {
        summaryParts.push(
          `Yemek/beslenme hizmetleri kapsamında ${menuItems.length} önemli gereksinim belirlenmiştir.`
        );
      }
    }

    // Genel değerlendirme
    summaryParts.push(
      `Belge ${wordCount} kelime içermektedir ve detaylı analiz için uygun görülmektedir.`
    );

    return summaryParts.join(" ");
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("=== ANALİZ API BAŞLADI ===");

    const { pages, useStreamProcessing = false } = await request.json();

    if (!pages || !Array.isArray(pages)) {
      return NextResponse.json({
        success: false,
        error:
          "Analiz edilecek sayfa verisi bulunamadı. Lütfen önce belgeyi yükleyin.",
        code: "NO_PAGES_DATA",
      });
    }

    // Boş sayfaları filtrele ve metni birleştir
    const validPages = pages.filter(
      (page: { content?: string; isEmpty?: boolean }) =>
        page && typeof page.content === "string" && !page.isEmpty
    );

    if (validPages.length === 0) {
      return NextResponse.json({
        success: false,
        error:
          "Analiz edilebilir içerik bulunamadı. Belge tamamen boş veya okunamadı.",
        code: "NO_VALID_CONTENT",
      });
    }

    console.log(
      `Analiz başlatılıyor: ${validPages.length} sayfa, ${pages.length} toplam sayfa`
    );

    // Tüm metni birleştir
    const fullText = validPages
      .map((page: { content: string }) => page.content)
      .join("\n\n");
    const wordCount = fullText
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const keyTermsFound = TurkishNormalizer.extractKeyTerms(fullText);

    console.log(
      `Analiz metni hazırlandı: ${wordCount} kelime, ${keyTermsFound.length} anahtar terim`
    );

    // Stream processing simülasyonu (büyük belgeler için)
    if (useStreamProcessing && validPages.length > 10) {
      console.log("Stream processing modu aktif - büyük belge tespit edildi");

      // Her 10 sayfada bir progress güncelleme simülasyonu
      const chunkSize = 10;
      for (let i = 0; i < validPages.length; i += chunkSize) {
        const progress = Math.round((i / validPages.length) * 100);
        console.log(`İşleme progress: %${progress}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Simulated processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // AI analiz işlemi - 4 kategoriye ayır
    const generalInfo = TenderAnalysisEngine.analyzeGeneralInfo(fullText);
    const cost = TenderAnalysisEngine.analyzeCost(fullText);
    const risks = TenderAnalysisEngine.analyzeRisks(fullText);
    const menu = TenderAnalysisEngine.analyzeMenu(fullText);

    // Genel özet oluştur
    const summary = TenderAnalysisEngine.generateSummary(
      generalInfo,
      cost,
      risks,
      menu,
      wordCount
    );

    // Genel güven skoru hesapla
    const overallConfidence =
      (generalInfo.confidence +
        cost.confidence +
        risks.confidence +
        menu.confidence) /
      4;

    const processingTime = Date.now() - startTime;

    const analysis: DetailedAnalysis = {
      generalInfo,
      cost,
      risks,
      menu,
      summary,
      overallConfidence,
      processingTime,
      wordCount,
      keyTermsFound,
    };

    console.log("=== ANALİZ TAMAMLANDI ===");
    console.log(
      `Genel bilgi güveni: ${Math.round(generalInfo.confidence * 100)}%`
    );
    console.log(`Maliyet güveni: ${Math.round(cost.confidence * 100)}%`);
    console.log(`Risk güveni: ${Math.round(risks.confidence * 100)}%`);
    console.log(`Menü güveni: ${Math.round(menu.confidence * 100)}%`);
    console.log(`Genel güven: ${Math.round(overallConfidence * 100)}%`);
    console.log(`İşleme süresi: ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      analysis,
      message: `Analiz başarıyla tamamlandı - ${validPages.length} sayfa işlendi`,
      metadata: {
        pagesAnalyzed: validPages.length,
        totalPages: pages.length,
        wordCount,
        keyTermsCount: keyTermsFound.length,
        processingTime,
        confidenceScore: Math.round(overallConfidence * 100),
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("Analysis API Kritik Hata:", error);

    return NextResponse.json({
      success: false,
      error:
        "Analiz sırasında beklenmedik bir hata oluştu. Lütfen belgeyi kontrol edip tekrar deneyin.",
      code: "ANALYSIS_ERROR",
      processingTime,
      details:
        error instanceof Error ? error.message : "Bilinmeyen analiz hatası",
    });
  }
}
