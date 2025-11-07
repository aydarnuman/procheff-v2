import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { BasicExtraction } from "@/types/ai";
import { BASIC_EXTRACTION_PROMPT } from "@/lib/ai/prompts/basic-extraction";
import { DataValidator } from "@/lib/ai/data-validator";
import { TurkishContextAnalyzer } from "@/lib/utils/turkish-context-analyzer";

export async function POST(req: NextRequest) {
  console.log("=== BASIC EXTRACTION API BAŞLADI ===");

  const startTime = Date.now();

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text field is required" },
        { status: 400 }
      );
    }

    console.log("Metin uzunluğu:", text.length, "karakter");

    // 🔍 ÖN ANALİZ: TurkishContextAnalyzer ile personel/kişi tespiti
    console.log("🔍 Türkçe dilbilgisel bağlam analizi başlatılıyor...");
    const contextAnalysis = TurkishContextAnalyzer.analyzeParagraph(text);

    console.log("Analiz sonucu:");
    console.log("  - Personel sayıları:", contextAnalysis.personnelNumbers);
    console.log("  - Hizmet alan sayıları:", contextAnalysis.recipientNumbers);
    console.log("  - Belirsiz sayılar:", contextAnalysis.ambiguousNumbers);

    // AI'ya ipucu olarak context bilgisi ekle
    let contextHint = "";
    if (contextAnalysis.personnelNumbers.length > 0) {
      contextHint += `\n\n🤖 BAĞLAM İPUCU: Metinde personel bağlamında ${contextAnalysis.personnelNumbers.join(", ")} sayıları tespit edildi.`;
    }
    if (contextAnalysis.recipientNumbers.length > 0) {
      contextHint += `\n\n🤖 BAĞLAM İPUCU: Metinde hizmet alan bağlamında ${contextAnalysis.recipientNumbers.join(", ")} sayıları tespit edildi.`;
    }

    // Anthropic Client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY bulunamadı");
    }

    const client = new Anthropic({ apiKey });

    // Claude'a istek at
    console.log("Claude'a temel bilgi çıkarımı isteği gönderiliyor...");

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: `${BASIC_EXTRACTION_PROMPT}\n\n## İHALE METNİ:\n${text}${contextHint}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Claude beklenmedik response döndü");
    }

    let jsonText = content.text.trim();

    // Remove code block if present
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
      console.log("JSON code block temizlendi");
    }

    console.log("JSON parse ediliyor...");
    const extractedData = JSON.parse(jsonText) as BasicExtraction;

    // 🔍 POST-PROCESSING: TurkishContextAnalyzer ile doğrulama
    console.log("🔍 Türkçe bağlam doğrulaması yapılıyor...");
    const aiKisiSayisi = extractedData.kisi_sayisi;

    // Eğer AI'nın bulduğu sayı belirsiz sayılar içindeyse, context analyzer'dan öneri al
    if (
      aiKisiSayisi &&
      contextAnalysis.ambiguousNumbers.includes(aiKisiSayisi)
    ) {
      console.log(
        `⚠️ AI'nın bulduğu sayı (${aiKisiSayisi}) belirsiz kategorisinde - yeniden değerlendiriliyor`
      );

      // Context analyzer'ın öncelikli tahmini: recipientNumbers > personnelNumbers
      if (contextAnalysis.recipientNumbers.length > 0) {
        const suggestedNumber = contextAnalysis.recipientNumbers[0];
        console.log(
          `  ✓ Context Analyzer önerisi: ${suggestedNumber} (hizmet alan)`
        );
        extractedData.kisi_sayisi = suggestedNumber;
        if (!extractedData.reasoning) extractedData.reasoning = {} as any;
        (extractedData.reasoning as any).context_analyzer_fix =
          `Belirsiz sayı (${aiKisiSayisi}) context analyzer tarafından ${suggestedNumber} olarak düzeltildi (hizmet alan bağlamı)`;
      } else if (contextAnalysis.personnelNumbers.length > 0) {
        const suggestedNumber = contextAnalysis.personnelNumbers[0];
        console.log(
          `  ✓ Context Analyzer önerisi: ${suggestedNumber} (personel)`
        );
        extractedData.kisi_sayisi = suggestedNumber;
        if (!extractedData.reasoning) extractedData.reasoning = {} as any;
        (extractedData.reasoning as any).context_analyzer_fix =
          `Belirsiz sayı (${aiKisiSayisi}) context analyzer tarafından ${suggestedNumber} olarak düzeltildi (personel bağlamı)`;
      }
    }

    // Validation süzgeci
    console.log("Validation süzgeci çalıştırılıyor...");
    const validationResult = DataValidator.validate({
      ...extractedData,
      registration_number: null, // BasicExtraction'da yok, null olarak ekle
      personel_sayisi: null, // BasicExtraction'da yok, null olarak ekle
      riskler: [],
      ozel_sartlar: [],
      kanitlar: {
        ...extractedData.kanitlar,
        riskler: [],
      },
    });

    const finalData = {
      kurum: validationResult.data.kurum,
      ihale_turu: validationResult.data.ihale_turu,
      kisi_sayisi: validationResult.data.kisi_sayisi,
      ogun_sayisi: validationResult.data.ogun_sayisi,
      gun_sayisi: validationResult.data.gun_sayisi,
      tahmini_butce: validationResult.data.tahmini_butce,
      teslim_suresi: validationResult.data.teslim_suresi,
      reasoning: extractedData.reasoning,
      kanitlar: extractedData.kanitlar,
      guven_skoru: extractedData.guven_skoru,
      context_analysis: {
        personnel_detected: contextAnalysis.personnelNumbers,
        recipients_detected: contextAnalysis.recipientNumbers,
        ambiguous_detected: contextAnalysis.ambiguousNumbers,
      },
    };

    if (validationResult.warnings.length > 0) {
      console.log(`⚠️ ${validationResult.warnings.length} uyarı:`);
      validationResult.warnings.forEach((w, i) => {
        console.log(`  ${i + 1}. [${w.severity}] ${w.field}: ${w.message}`);
        if (w.auto_fixed) {
          console.log(
            `     ✓ Düzeltildi: ${w.original_value} → ${w.suggested_value}`
          );
        }
      });
    }

    const processingTime = Date.now() - startTime;
    console.log("=== BASIC EXTRACTION TAMAMLANDI ===");
    console.log("İşleme süresi:", processingTime, "ms");

    return NextResponse.json({
      success: true,
      data: finalData,
      warnings: validationResult.warnings,
      processing_time_ms: processingTime,
    });
  } catch (error: any) {
    console.error("=== BASIC EXTRACTION HATASI ===");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);

    const processingTime = Date.now() - startTime;
    return NextResponse.json(
      {
        error: error.message || "Temel bilgi çıkarımı başarısız",
        processing_time_ms: processingTime,
      },
      { status: 500 }
    );
  }
}
