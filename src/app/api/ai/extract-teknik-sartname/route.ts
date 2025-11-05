import { NextRequest, NextResponse } from "next/server";
import { DualAPIOrchestrator } from "@/lib/ai/dual-api-orchestrator";
import { logger, LogKategori } from "@/lib/logger";
import { ExtractedData } from "@/types/ai";

export const runtime = "nodejs";

/**
 * TEKNİK ŞARTNAME EXPERT API
 *
 * DualAPIOrchestrator Kullanır:
 * - Text API (Claude): Genel şartlar, menü anlatımı, personel gereksinimleri
 * - Table API (Gemini): Menü tabloları, gramaj cetvelleri, ekipman listeleri
 *
 * Özelleşmiş Prompt - Teknik Şartnamelere Odaklanır:
 * - Menü programı ve gramajlar (TABLO!)
 * - Personel sayısı ve nitelikleri (TABLO!)
 * - Ekipman/Araç-Gereç listeleri (TABLO!)
 * - Özel standartlar (ISO, HACCP, vb.)
 * - Üretim yöntemi (Yerinde / Taşeron / Kap taşıma)
 *
 * DİĞER BELGE TÜRLERİ İÇİN KULLANMA!
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `teknik_sartname_${Date.now()}`;

  try {
    logger.sessionBaslat(sessionId);
    logger.info(LogKategori.AI_ANALYSIS, '📄 Teknik Şartname Expert API başladı');

    const { text, fileName } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Teknik şartname metni bulunamadı" },
        { status: 400 }
      );
    }

    if (text.length < 500) {
      return NextResponse.json(
        { success: false, error: "Teknik şartname metni çok kısa (min 500 karakter)" },
        { status: 400 }
      );
    }

    // DualAPIOrchestrator - TEXT + TABLE
    const orchestrator = new DualAPIOrchestrator();

    logger.info(LogKategori.AI_ANALYSIS, 'Teknik şartname analizi başlıyor (DualAPI)', {
      karakterSayisi: text.length,
      dosyaAdi: fileName,
    });

    // PROMPT ENHANCEMENTeknik Şartname için özel talimatlar ekle
    const enhancedText = enhanceTeknikSartnameText(text, fileName);

    // Extract with DualAPIOrchestrator
    const extractedData = await orchestrator.extract(enhancedText);

    const processingTime = Date.now() - startTime;

    logger.basarili(LogKategori.EXTRACTION, 'Teknik Şartname başarıyla analiz edildi', {
      ek: {
        guvenSkoru: Math.round(extractedData.guven_skoru * 100),
        tabloSayisi: extractedData.tablolar?.length || 0,
        veriHavuzuKarakterSayisi: extractedData.veri_havuzu?.ham_metin?.length || 0,
        menuVarMi: extractedData.tablolar?.some(t => t.baslik.toLowerCase().includes('menu')) ? 'EVET' : 'HAYIR',
        personelVarMi: extractedData.tablolar?.some(t => t.baslik.toLowerCase().includes('personel')) ? 'EVET' : 'HAYIR',
      },
    });

    logger.sessionBitir(sessionId);

    return NextResponse.json({
      success: true,
      data: extractedData,
      metadata: {
        processing_time: processingTime,
        ai_provider: "dual-api-orchestrator",
        text_api: "claude-sonnet-4",
        table_api: "gemini-2.0-flash",
        document_type: "teknik_sartname",
        extraction_timestamp: new Date().toISOString(),
        stats: {
          total_tables: extractedData.tablolar?.length || 0,
          data_pool_size: extractedData.veri_havuzu?.ham_metin?.length || 0,
          sources_count: Object.keys(extractedData.veri_havuzu?.kaynaklar || {}).length,
        },
      },
    });
  } catch (error) {
    console.error("Teknik Şartname extraction error:", error);
    logger.hata(LogKategori.AI_ANALYSIS, 'Teknik Şartname analizi başarısız', {
      kod: 'TEKNIK_SARTNAME_ERROR',
      mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Teknik şartname analizi başarısız",
      },
      { status: 500 }
    );
  }
}

/**
 * Teknik Şartname için metin enhance et
 * DualAPIOrchestrator'a göndermeden önce özel talimatlar ekle
 */
function enhanceTeknikSartnameText(text: string, fileName?: string): string {
  // Teknik Şartname için özel başlık ekle
  const header = `
=== TEKNİK ŞARTNAME BELGESİ ===
${fileName ? `Dosya: ${fileName}` : ''}

⚠️ DİKKAT: Bu belge TEKNİK ŞARTNAME'dir. Şu bilgilere ÖZEL DİKKAT ET:

🔴 KRİTİK BİLGİLER (MUTLAKA BUL):
1. **MENÜ PROGRAMI** - Günlük/haftalık menü tablosu (yemek adları, gramajlar)
2. **PERSONEL GEREKSİNİMLERİ** - Kaç personel, hangi pozisyonlar, nitelikler
3. **EKİPMAN/ARAÇ-GEREÇ** - Yüklenicinin temin edeceği malzemeler
4. **ÜRETİM YÖNTEMİ** - Yerinde üretim mi? Taşeron mu? Kap taşıma mı?
5. **SERTİFİKASYON** - ISO 22000, HACCP, vb. standartlar
6. **ÖZEL ŞARTLAR** - Kısıtlamalar, yasaklar, zorunluluklar

🎯 TABLO TESPİTİ:
- Menü tabloları → Yemek adları + gramajlar
- Personel tabloları → Pozisyon + sayı + nitelik + maaş
- Ekipman tabloları → Malzeme + miktar + özellik
- Kuruluş tabloları → Lokasyon + kişi sayısı + öğün dağılımı

📊 TABLO ÖRNEKLERİ:
- "Gün | Çorba | Ana Yemek | Yan Yemek | Gramaj"
- "Pozisyon | Sayı | Nitelik | Ücret"
- "Ekipman | Miktar | Özellik"

===================================

`;

  return header + text;
}
