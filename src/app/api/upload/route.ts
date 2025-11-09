import { NextRequest, NextResponse } from "next/server";
import { SmartDocumentProcessor } from "@/lib/utils/smart-document-processor";
import { logger, LogKategori, IslemDurumu } from "@/lib/logger";
import { guessDocumentType } from "@/lib/utils/document-type-guesser";
import type { BelgeTuru } from "@/types/ai";

export const runtime = "nodejs";
export const maxDuration = 420; // 7 dakika timeout (büyük PDF'ler için)

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `upload_${Date.now()}`;

  // Streaming için encoder
  const encoder = new TextEncoder();

  // Helper function: Progress mesajı gönder
  const sendProgress = (controller: ReadableStreamDefaultController, message: string, progress?: number) => {
    try {
      const data = JSON.stringify({ type: 'progress', message, progress, timestamp: Date.now() });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (error) {
      // Controller kapalıysa sessizce ignore et (OCR gibi uzun işlemlerde olabilir)
      if ((error as any)?.code !== 'ERR_INVALID_STATE') {
        console.error('sendProgress error:', error);
      }
    }
  };

  // Helper function: Hata mesajı gönder
  const sendError = (controller: ReadableStreamDefaultController, error: string, code: string) => {
    try {
      const data = JSON.stringify({ type: 'error', error, code, timestamp: Date.now() });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (err) {
      console.error('sendError failed (controller closed):', err);
    }
  };

  // Helper function: Başarı mesajı gönder
  const sendSuccess = (controller: ReadableStreamDefaultController, result: any) => {
    try {
      const data = JSON.stringify({ type: 'success', ...result, timestamp: Date.now() });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (error) {
      console.error('sendSuccess failed (controller closed):', error);
    }
  };

  // ReadableStream oluştur
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Session başlat
        logger.sessionBaslat(sessionId);
        sendProgress(controller, '🚀 İşlem başladı');

        sendProgress(controller, '📤 Form data alınıyor...');
        logger.info(LogKategori.UPLOAD, 'Form data alınıyor...');
        const formData = await request.formData();
        const fileCount = parseInt(formData.get("fileCount") as string || "1");

        logger.info(LogKategori.UPLOAD, `${fileCount} dosya upload başladı`, {
          ek: { fileCount },
        });
        sendProgress(controller, `📦 ${fileCount} dosya alındı`);

        // Dosyaları topla
        logger.debug(LogKategori.UPLOAD, 'Dosyalar toplanıyor...');
        const files: File[] = [];
        for (let i = 0; i < fileCount; i++) {
          const file = formData.get(`file${i}`) as File;
          if (file) {
            files.push(file);
            logger.debug(LogKategori.UPLOAD, `Dosya ${i + 1} alındı: ${file.name}`, {
              dosyaAdi: file.name,
              dosyaBoyutu: file.size,
              dosyaTipi: file.type,
            });
          }
        }

        if (files.length === 0) {
          logger.hata(LogKategori.VALIDATION, 'Hiç dosya bulunamadı', {
            kod: 'NO_FILES',
            mesaj: 'FormData içinde dosya bulunamadı',
          });
          sendError(controller, 'Hiç dosya bulunamadı', 'NO_FILES');
          controller.close();
          return;
        }

        logger.basarili(LogKategori.UPLOAD, `${files.length} dosya başarıyla alındı`);
        sendProgress(controller, `✅ ${files.length} dosya başarıyla alındı`);

        // Her dosyayı kontrol et
        logger.info(LogKategori.VALIDATION, 'Dosyalar doğrulanıyor...');
        sendProgress(controller, '🔍 Dosyalar doğrulanıyor...');

        for (const file of files) {
          logger.debug(LogKategori.VALIDATION, `${file.name} kontrol ediliyor`);
          console.log(`🔍 [FILE DEBUG] ${file.name}`, {
            size: file.size,
            type: file.type,
            name: file.name,
            lastModified: file.lastModified
          });

          if (file.size > MAX_FILE_SIZE) {
            logger.hata(LogKategori.VALIDATION, `${file.name} çok büyük`, {
              kod: 'FILE_TOO_LARGE',
              mesaj: `Dosya boyutu: ${(file.size / 1024 / 1024).toFixed(2)}MB, Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            });
            sendError(controller, `${file.name} çok büyük (Max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`, 'FILE_TOO_LARGE');
            controller.close();
            return;
          }

          if (!SmartDocumentProcessor.isFormatSupported(file)) {
            const extension = file.name.substring(file.name.lastIndexOf("."));
            const supportedFormats = SmartDocumentProcessor.getSupportedFormats().join(', ');
            
            logger.hata(LogKategori.VALIDATION, `${file.name} desteklenmeyen format`, {
              kod: 'UNSUPPORTED_FORMAT',
              mesaj: `MIME: ${file.type || 'boş'}, Extension: ${extension}, Size: ${file.size}`,
            });
            
            const errorMsg = `Desteklenmeyen dosya formatı: ${file.name}. Desteklenen formatlar: ${supportedFormats}`;
            sendError(controller, errorMsg, 'UNSUPPORTED_FORMAT');
            controller.close();
            return;
          }

          logger.debug(LogKategori.VALIDATION, `${file.name} ✓ geçti`);
        }

        logger.basarili(LogKategori.VALIDATION, 'Tüm dosyalar doğrulandı');
        sendProgress(controller, '✅ Tüm dosyalar doğrulandı');

        // Her dosyayı işle ve etiketle
        logger.info(LogKategori.PROCESSING, `${files.length} dosya işlenmeye başlandı`);
        sendProgress(controller, `⚙️ ${files.length} dosya işleniyor...`);

        const processedTexts: string[] = [];
        let totalWordCount = 0;
        let totalCharCount = 0;
        const allWarnings: string[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const adimId = `process_${i}`;
          const fileProgress = Math.round(((i + 1) / files.length) * 100);

          // Dosya işleme başladı (sadece başta dosya adı göster)
          sendProgress(controller, `📄 ${file.name}`, fileProgress);

          logger.progressGuncelle(
            LogKategori.PROCESSING,
            `${file.name} işleniyor...`,
            fileProgress,
            { dosyaAdi: file.name }
          );

          logger.adimBaslat(adimId);

          // Progress callback oluştur (dosya adı olmadan, sadece işlem adımları)
          const onProgress = (message: string, subProgress?: number) => {
            sendProgress(controller, message, subProgress || fileProgress);
          };

          const result = await SmartDocumentProcessor.extractText(file, onProgress);

          if (!result.success) {
            logger.hata(LogKategori.PROCESSING, `${file.name} işlenemedi`, {
              kod: 'PROCESSING_ERROR',
              mesaj: result.error || 'Bilinmeyen hata',
            });
            sendError(controller, `${file.name} işlenemedi: ${result.error}`, 'PROCESSING_ERROR');
            controller.close();
            return;
          }

          const wordCount = result.text.split(/\s+/).filter((w) => w.length > 0).length;
          const charCount = result.text.length;

          totalWordCount += wordCount;
          totalCharCount += charCount;

          if (result.warnings?.length) {
            allWarnings.push(...result.warnings.map(w => `${file.name}: ${w}`));
            result.warnings.forEach(w => {
              logger.uyari(LogKategori.PROCESSING, w, { dosyaAdi: file.name });
            });
          }

          // 🎯 BELGE TÜRÜ TESPİTİ (Hibrit: Filename + Content)
          const documentTypeGuess = guessDocumentType(file.name, result.text);
          logger.info(LogKategori.PROCESSING, `Belge türü: ${documentTypeGuess.type} (${Math.round(documentTypeGuess.confidence * 100)}%)`, {
            dosyaAdi: file.name
          });

          // Dosyayı etiketle ve ekle (belge türü bilgisi ile)
          const label = `=== DOSYA: ${file.name} [TÜR: ${documentTypeGuess.type}, GÜVEN: ${Math.round(documentTypeGuess.confidence * 100)}%] ===`;
          processedTexts.push(`${label}\n\n${result.text}\n\n`);

          logger.adimBitir(adimId, LogKategori.PROCESSING, `${file.name} başarıyla işlendi`, {
            dosyaAdi: file.name,
            kelimeSayisi: wordCount,
            karakterSayisi: charCount,
          });

          sendProgress(controller, `✅ Tamamlandı (${wordCount.toLocaleString()} kelime)`, fileProgress);
        }

        logger.basarili(LogKategori.PROCESSING, `${files.length} dosya başarıyla işlendi`, {
          kelimeSayisi: totalWordCount,
          karakterSayisi: totalCharCount,
        });

        // Tüm metinleri birleştir
        logger.info(LogKategori.COMPLETION, 'Dosyalar birleştiriliyor...');
        sendProgress(controller, '🔗 Dosyalar birleştiriliyor...', 100);

        const combinedText = processedTexts.join("\n" + "=".repeat(80) + "\n\n");

        const processingTime = Date.now() - startTime;
        
        // 🎯 Her dosya için belge türü bilgisini hesapla
        const filesWithTypes = await Promise.all(
          files.map(async (f, index) => {
            const fileText = processedTexts[index];
            const typeGuess = guessDocumentType(f.name, fileText);
            return {
              name: f.name,
              size: f.size,
              detectedType: typeGuess.type,
              detectedTypeConfidence: typeGuess.confidence
            };
          })
        );

        const stats = {
          fileCount: files.length,
          wordCount: totalWordCount,
          totalWordCount,
          totalCharCount: combinedText.length,
          processingTime,
          files: filesWithTypes,
        };

        // Session'ı bitir
        logger.sessionBitir(sessionId, IslemDurumu.COMPLETED);

        logger.basarili(LogKategori.COMPLETION, 'İşlem tamamlandı', {
          kelimeSayisi: totalWordCount,
          karakterSayisi: combinedText.length,
        });

        // Final success message
        sendSuccess(controller, {
          text: combinedText,
          stats,
          warnings: allWarnings,
          message: `${files.length} dosya başarıyla birleştirildi`,
        });

        controller.close();
      } catch (error) {
        logger.hata(LogKategori.UPLOAD, 'Upload işlemi başarısız', {
          kod: 'UNKNOWN_ERROR',
          mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
          stack: error instanceof Error ? error.stack : undefined,
        });

        logger.sessionBitir(sessionId, IslemDurumu.FAILED);

        sendError(controller, error instanceof Error ? error.message : "Bilinmeyen hata", 'UNKNOWN_ERROR');
        controller.close();
      }
    },
  });

  // Return streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
