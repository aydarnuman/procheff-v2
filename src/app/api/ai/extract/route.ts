import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { ExtractedData } from "@/types/ai";
import { logger, LogKategori, IslemDurumu } from "@/lib/logger";
import { hesaplaClaudeMaliyeti } from "@/lib/ai/cost-calculator";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `ai_extract_${Date.now()}`;

  try {
    logger.sessionBaslat(sessionId);
    logger.info(LogKategori.AI_ANALYSIS, 'AI veri çıkarımı başladı');

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
    logger.info(LogKategori.AI_ANALYSIS, 'Claude provider başlatılıyor');
    const claude = new ClaudeProvider();

    logger.info(LogKategori.AI_ANALYSIS, 'AI analizi başlıyor', {
      karakterSayisi: text.length,
      aiModel: 'claude-sonnet-4',
    });

    // Structured data extraction
    logger.adimBaslat('ai_extraction');
    const extractedData: ExtractedData = await claude.extractStructuredData(text);
    logger.adimBitir('ai_extraction', LogKategori.AI_ANALYSIS, 'Veri çıkarımı tamamlandı');

    const processingTime = Date.now() - startTime;

    // Token kullanımını ve maliyeti hesapla (tahmini)
    const estimatedInputTokens = Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 chars
    const estimatedOutputTokens = 1000; // Structured output tahmini
    const maliyet = hesaplaClaudeMaliyeti('claude-3-5-sonnet-20241022', estimatedInputTokens, estimatedOutputTokens);

    logger.basarili(LogKategori.EXTRACTION, 'Veri başarıyla çıkarıldı', {
      kelimeSayisi: extractedData.kisi_sayisi ?? undefined,
      tokenKullanimi: maliyet.toplamTokens,
      maliyetTL: maliyet.toplamMaliyetTRY,
      aiModel: 'claude-sonnet-4',
      ek: {
        guvenSkoru: Math.round(extractedData.guven_skoru * 100),
        kurum: extractedData.kurum,
        ihaleTuru: extractedData.ihale_turu,
      },
    });

    // Serialization için veriyi düzleştir
    const sanitizedData = JSON.parse(JSON.stringify(extractedData));

    logger.sessionBitir(sessionId, IslemDurumu.COMPLETED);

    return NextResponse.json({
      success: true,
      data: sanitizedData,
      metadata: {
        processing_time: processingTime,
        ai_provider: "claude-sonnet-4",
        text_length: text.length,
        extraction_timestamp: new Date().toISOString(),
        cost: {
          tokens: maliyet.toplamTokens,
          cost_usd: maliyet.toplamMaliyetUSD,
          cost_try: maliyet.toplamMaliyetTRY,
        },
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.hata(LogKategori.AI_ANALYSIS, 'AI analizi başarısız', {
      kod: 'AI_EXTRACT_ERROR',
      mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    logger.sessionBitir(sessionId, IslemDurumu.FAILED);

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
