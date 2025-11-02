import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { ExtractedData } from "@/types/ai";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("=== AI EXTRACT API BAŞLADI ===");

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Analiz edilecek metin verisi bulunamadı.",
          code: "NO_TEXT_DATA",
        },
        { status: 400 }
      );
    }

    if (text.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Metin çok kısa. En az 100 karakter olmalı.",
          code: "TEXT_TOO_SHORT",
        },
        { status: 400 }
      );
    }

    // Claude provider'ı başlat
    const claude = new ClaudeProvider();

    console.log(`Metin uzunluğu: ${text.length} karakter`);
    console.log("Claude AI ile veri çıkarımı başlıyor...");

    // Structured data extraction
    const extractedData: ExtractedData = await claude.extractStructuredData(
      text
    );

    const processingTime = Date.now() - startTime;

    console.log("=== VERİ ÇIKARIMI TAMAMLANDI ===");
    console.log(`İşleme süresi: ${processingTime}ms`);
    console.log(`Güven skoru: ${Math.round(extractedData.guven_skoru * 100)}%`);
    console.log(`Kurum: ${extractedData.kurum}`);
    console.log(`İhale türü: ${extractedData.ihale_turu}`);
    console.log(`Kişi sayısı: ${extractedData.kisi_sayisi}`);
    console.log(`Tahmini bütçe: ${extractedData.tahmini_butce}`);

    // Serialization için veriyi düzleştir
    const sanitizedData = JSON.parse(JSON.stringify(extractedData));

    return NextResponse.json({
      success: true,
      data: sanitizedData,
      metadata: {
        processing_time: processingTime,
        ai_provider: "claude-3.5-sonnet",
        text_length: text.length,
        extraction_timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error("=== AI EXTRACT HATASI ===");
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
            error: "AI yanıtı işlenemedi. Metin formatını kontrol edin.",
            code: "AI_RESPONSE_ERROR",
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Veri çıkarımı sırasında beklenmeyen hata oluştu.",
        code: "EXTRACTION_ERROR",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}
