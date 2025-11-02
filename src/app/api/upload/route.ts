import { NextRequest, NextResponse } from "next/server";
import { SmartDocumentProcessor } from "@/lib/utils/smart-document-processor";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("=== SMART UPLOAD API BAŞLADI ===");

    const formData = await request.formData();
    const fileCount = parseInt(formData.get("fileCount") as string || "1");

    console.log(`📂 ${fileCount} dosya yükleniyor...`);

    // Dosyaları topla
    const files: File[] = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File;
      if (file) files.push(file);
    }

    if (files.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Hiç dosya bulunamadı",
        code: "NO_FILES",
      });
    }

    // Her dosyayı kontrol et
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({
          success: false,
          error: `${file.name} çok büyük (Max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
          code: "FILE_TOO_LARGE",
        });
      }

      if (!SmartDocumentProcessor.isFormatSupported(file)) {
        return NextResponse.json({
          success: false,
          error: `${file.name} desteklenmeyen format`,
          code: "UNSUPPORTED_FORMAT",
        });
      }
    }

    // Her dosyayı işle ve etiketle
    const processedTexts: string[] = [];
    let totalWordCount = 0;
    let totalCharCount = 0;
    const allWarnings: string[] = [];

    for (const file of files) {
      console.log(`\n📄 İşleniyor: ${file.name}`);

      const result = await SmartDocumentProcessor.extractText(file);

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: `${file.name} işlenemedi: ${result.error}`,
          code: "PROCESSING_ERROR",
        });
      }

      const wordCount = result.text.split(/\s+/).filter((w) => w.length > 0).length;
      const charCount = result.text.length;

      totalWordCount += wordCount;
      totalCharCount += charCount;

      if (result.warnings?.length) {
        allWarnings.push(...result.warnings.map(w => `${file.name}: ${w}`));
      }

      // Dosyayı etiketle ve ekle
      const label = `=== DOSYA: ${file.name} ===`;
      processedTexts.push(`${label}\n\n${result.text}\n\n`);

      console.log(`✅ ${file.name}: ${wordCount} kelime, ${charCount} karakter`);
    }

    // Tüm metinleri birleştir
    const combinedText = processedTexts.join("\n" + "=".repeat(80) + "\n\n");

    const stats = {
      fileCount: files.length,
      wordCount: totalWordCount,
      totalWordCount,
      totalCharCount: combinedText.length,
      processingTime: Date.now() - startTime,
      files: files.map(f => ({ name: f.name, size: f.size })),
    };

    console.log("\n=== BİRLEŞTİRME TAMAMLANDI ===");
    console.log(`Toplam: ${files.length} dosya`);
    console.log(`Toplam kelime: ${totalWordCount}`);
    console.log(`Toplam karakter: ${combinedText.length}`);
    console.log(`Süre: ${stats.processingTime}ms`);

    return NextResponse.json({
      success: true,
      text: combinedText,
      stats,
      warnings: allWarnings,
      message: `${files.length} dosya başarıyla birleştirildi`,
    });
  } catch (error) {
    console.error("=== UPLOAD API HATASI ===");
    console.error(error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
      code: "UNKNOWN_ERROR",
    });
  }
}
