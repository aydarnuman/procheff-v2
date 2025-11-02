import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { ExtractedData, ContextualAnalysis } from "@/types/ai";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("=== AI CONTEXTUAL ANALYSIS BAŞLADI ===");

    const { extractedData } = await request.json();

    if (!extractedData || typeof extractedData !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Analiz edilecek çıkarılmış veri bulunamadı.",
          code: "NO_EXTRACTED_DATA",
        },
        { status: 400 }
      );
    }

    // Validate required fields for meaningful analysis
    const data = extractedData as ExtractedData;

    if (!data.kurum || !data.ihale_turu) {
      return NextResponse.json(
        {
          success: false,
          error: "Temel ihale bilgileri eksik. Önce veri çıkarımı yapın.",
          code: "INSUFFICIENT_DATA",
        },
        { status: 400 }
      );
    }

    // Claude provider'ı başlat
    const claude = new ClaudeProvider();

    console.log(`Kurum: ${data.kurum}`);
    console.log(`İhale türü: ${data.ihale_turu}`);
    console.log(`Kişi sayısı: ${data.kisi_sayisi}`);
    console.log(`Bütçe: ${data.tahmini_butce}`);
    console.log("Bağlamsal analiz başlıyor...");

    // Contextual analysis
    const analysis: ContextualAnalysis = await claude.analyzeContext(data);

    const processingTime = Date.now() - startTime;

    console.log("=== BAĞLAMSAL ANALİZ TAMAMLANDI ===");
    console.log(`İşleme süresi: ${processingTime}ms`);
    console.log(`Risk seviyesi: ${analysis.operasyonel_riskler.seviye}`);
    console.log(
      `Maliyet sapma oranı: %${analysis.maliyet_sapma_olasiligi.oran}`
    );

    // Serialization için veriyi düzleştir
    const sanitizedAnalysis = JSON.parse(JSON.stringify(analysis));

    return NextResponse.json({
      success: true,
      data: sanitizedAnalysis,
      metadata: {
        processing_time: processingTime,
        ai_provider: "claude-3.5-sonnet",
        analysis_timestamp: new Date().toISOString(),
        input_confidence: data.guven_skoru,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error("=== AI CONTEXTUAL ANALYSIS HATASI ===");
    console.error("Error:", error);
    console.error(`İşleme süresi: ${processingTime}ms`);

    // Hata türüne göre response
    if (error instanceof Error) {
      if (error.message.includes("CLAUDE_API_KEY")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "AI servis yapılandırması eksik. Sistem yöneticisi ile iletişime geçin.",
            code: "AI_CONFIG_ERROR",
          },
          { status: 500 }
        );
      }

      if (error.message.includes("Claude API error")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "AI servisi geçici olarak kullanılamıyor. Lütfen tekrar deneyin.",
            code: "AI_SERVICE_ERROR",
          },
          { status: 503 }
        );
      }

      if (error.message.includes("JSON")) {
        return NextResponse.json(
          {
            success: false,
            error: "AI analiz yanıtı işlenemedi. Lütfen tekrar deneyin.",
            code: "AI_RESPONSE_ERROR",
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Bağlamsal analiz sırasında beklenmeyen hata oluştu.",
        code: "ANALYSIS_ERROR",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}
