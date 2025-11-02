import { NextRequest, NextResponse } from "next/server";
import { SmartDocumentProcessor } from "@/lib/utils/smart-document-processor";

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
  documentMetrics: {
    fileType: string;
    method: string;
    processingDuration: number;
    warnings: string[];
    characterCount: number;
  };
}

// Analiz motoru (mock implementation)
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

    // Kurum tespiti
    const institutionPatterns = [
      /belediye|municipality/gi,
      /bakanlık|ministry/gi,
      /müdürlük|directorate/gi,
      /üniversite|university/gi,
    ];

    institutionPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        content.push(`Kurum: ${matches[0]}`);
        passages.push(`Kurum bilgisi tespit edildi: ${matches[0]}`);
        confidence += 0.15;
      }
    });

    return {
      title: "Genel Bilgiler",
      content,
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
    };
  }

  static analyzeCost(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    const keyMetrics: { [key: string]: string | number } = {};
    let confidence = 0;

    // Fiyat tespiti
    const pricePatterns = [
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺|lira)/gi,
      /(\d{1,3}(?:\.\d{3})*)\s*(?:euro|€|dolar|\$)/gi,
    ];

    pricePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          content.push(`Tespit edilen fiyat: ${match}`);
          passages.push(`Fiyat bilgisi: "${match}"`);
          keyMetrics[`fiyat_${Object.keys(keyMetrics).length + 1}`] = match;
        });
        confidence += 0.3;
      }
    });

    // Ödeme şartları
    const paymentPatterns = [
      /(%\d{1,2})\s*(?:ön\s*ödeme|peşinat)/gi,
      /(\d{1,2})\s*(?:taksit|kısım)/gi,
    ];

    paymentPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          content.push(`Ödeme şartı: ${match}`);
          passages.push(`Ödeme şartı tespit edildi: "${match}"`);
        });
        confidence += 0.2;
      }
    });

    return {
      title: "Maliyet Analizi",
      content,
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
      keyMetrics,
    };
  }

  static analyzeRisks(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    let confidence = 0;

    const riskPatterns = [
      { pattern: /gecikme|delay/gi, risk: "Teslimat gecikme riski" },
      { pattern: /fiyat\s*artış|enflasyon/gi, risk: "Fiyat artış riski" },
      {
        pattern: /kalite\s*kontrol|test/gi,
        risk: "Kalite kontrol gerekliliği",
      },
      { pattern: /tedarikçi|supplier/gi, risk: "Tedarikçi bağımlılığı" },
    ];

    riskPatterns.forEach(({ pattern, risk }) => {
      const matches = text.match(pattern);
      if (matches) {
        content.push(risk);
        passages.push(`Risk tespiti: "${matches[0]}" → ${risk}`);
        confidence += 0.25;
      }
    });

    return {
      title: "Risk Analizi",
      content,
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
    };
  }

  static analyzeMenu(text: string): AnalysisCategory {
    const passages: string[] = [];
    const content: string[] = [];
    let confidence = 0;

    const menuPatterns = [
      {
        pattern: /(?:günlük\s*)?(\d+)\s*(?:porsiyon|kişi)/gi,
        item: "Porsiyon sayısı",
      },
      { pattern: /çorba|soup/gi, item: "Çorba hizmeti" },
      { pattern: /ana\s*yemek|main\s*course/gi, item: "Ana yemek" },
      { pattern: /salata|salad/gi, item: "Salata" },
      { pattern: /tatlı|dessert/gi, item: "Tatlı" },
      { pattern: /halal|helal/gi, item: "Helal sertifika" },
    ];

    menuPatterns.forEach(({ pattern, item }) => {
      const matches = text.match(pattern);
      if (matches) {
        content.push(`${item}: ${matches[0]}`);
        passages.push(`Menü öğesi tespit edildi: "${matches[0]}" → ${item}`);
        confidence += 0.15;
      }
    });

    return {
      title: "Menü Analizi",
      content,
      confidence: Math.min(confidence, 1),
      evidencePassages: passages,
    };
  }

  static generateSummary(
    generalInfo: AnalysisCategory,
    cost: AnalysisCategory,
    risks: AnalysisCategory,
    menu: AnalysisCategory
  ): string {
    const summaryParts: string[] = [];

    if (generalInfo.content.length > 0) {
      summaryParts.push(
        `Bu ihale ${generalInfo.content.join(", ")} ile ilgilidir.`
      );
    }

    if (cost.content.length > 0) {
      summaryParts.push(
        `Maliyet açısından ${cost.content.length} adet fiyat bilgisi tespit edilmiştir.`
      );
    }

    if (risks.content.length > 0) {
      summaryParts.push(
        `${risks.content.length} adet potansiyel risk faktörü bulunmuştur.`
      );
    }

    if (menu.content.length > 0) {
      summaryParts.push(
        `Menü planlaması için ${menu.content.length} önemli detay saptanmıştır.`
      );
    }

    return (
      summaryParts.join(" ") ||
      "Belge analizi tamamlandı ancak detaylı bilgi çıkarılamadı."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }

    console.log(`API: Analiz başlatılıyor - ${file.name} (${file.size} bytes)`);
    const analysisStartTime = Date.now();

    // Smart Document Processor ile dosyayı işle
    const processingResult = await SmartDocumentProcessor.extractText(file);

    if (!processingResult.success) {
      return NextResponse.json(
        {
          error: processingResult.error || "Belge işleme başarısız",
          warnings: processingResult.warnings,
        },
        { status: 400 }
      );
    }

    // İşlenmiş metni al
    const fullText = processingResult.text;

    console.log(`Toplam metin uzunluğu: ${fullText.length} karakter`);

    // AI analiz motorunu çalıştır
    const generalInfo = TenderAnalysisEngine.analyzeGeneralInfo(fullText);
    const cost = TenderAnalysisEngine.analyzeCost(fullText);
    const risks = TenderAnalysisEngine.analyzeRisks(fullText);
    const menu = TenderAnalysisEngine.analyzeMenu(fullText);

    const summary = TenderAnalysisEngine.generateSummary(
      generalInfo,
      cost,
      risks,
      menu
    );

    // Basit anahtar terim çıkarımı (SmartDocumentProcessor sadece metin döndürür)
    const words = fullText.split(/\s+/).filter((w) => w.length > 3);
    const allKeyTerms = Array.from(new Set(words.slice(0, 50))); // İlk 50 kelimeyi anahtar terim olarak al

    // Genel güven skoru hesapla
    const overallConfidence =
      (generalInfo.confidence +
        cost.confidence +
        risks.confidence +
        menu.confidence) /
      4;

    const totalProcessingTime = Date.now() - analysisStartTime;

    // Sonuç şeması
    const analysis: DetailedAnalysis = {
      generalInfo,
      cost,
      risks,
      menu,
      summary,
      overallConfidence,
      processingTime: totalProcessingTime,
      wordCount: fullText.split(/\s+/).filter((w) => w.length > 0).length,
      keyTermsFound: allKeyTerms,
      documentMetrics: {
        fileType: processingResult.fileType,
        method: processingResult.method,
        processingDuration: processingResult.processingTime,
        warnings: processingResult.warnings || [],
        characterCount: fullText.length,
      },
    };

    console.log(
      `API: Analiz tamamlandı - ${totalProcessingTime}ms, güven: ${Math.round(
        overallConfidence * 100
      )}%`
    );

    // Serialization için veriyi düzleştir
    const sanitizedAnalysis = JSON.parse(JSON.stringify(analysis));
    return NextResponse.json(sanitizedAnalysis);
  } catch (error) {
    console.error("API hatası:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 }
    );
  }
}
