import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { ZipExtractor } from '@/lib/tender-session/zip-extractor';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';

/**
 * 🔧 ZIP Download & Extract API
 * 
 * POST /api/tender/session/extract-zips
 * Body: { sessionId, documentUrls, cookies? }
 * 
 * ZIP URL'lerini indirir, extract eder ve tender_files tablosuna kaydeder.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, documentUrls, cookies } = body;

    if (!sessionId || !documentUrls || !Array.isArray(documentUrls)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'sessionId ve documentUrls (array) gerekli' 
        },
        { status: 400 }
      );
    }

    console.log(`📦 ZIP extraction başlatılıyor: ${sessionId}`);
    console.log(`   ${documentUrls.length} URL kontrol edilecek`);

    // Session'ı bul
    const session = await TenderSessionManager.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session bulunamadı' },
        { status: 404 }
      );
    }

    // Session klasörü
    const sessionDir = path.join(process.cwd(), 'data', 'sessions', sessionId);

    // ZIP'leri extract et
    const extractedFiles = await ZipExtractor.extractAllZipsInSession(
      sessionDir,
      documentUrls,
      cookies
    );

    console.log(`✅ ${extractedFiles.length} dosya extract edildi`);

    // DB'ye kaydet (tender_files tablosuna INSERT)
    const savedFiles = [];
    for (const file of extractedFiles) {
      try {
        // UUID oluştur
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        const fileRecord = await TenderSessionManager.addFile({
          sessionId: session.id,
          fileId,
          filename: file.filename,
          originalFilename: file.filename,
          storagePath: file.storagePath,
          size: file.size,
          mimeType: file.mimeType,
          isExtractedFromZip: true, // 🔥 CRITICAL: ZIP'ten çıkarıldı
          parentZipId: undefined, // TODO: ZIP file record ID buraya eklenebilir
        });
        savedFiles.push({ id: fileId, ...file });
        console.log(`  💾 DB'ye kaydedildi: ${file.filename}`);
      } catch (error) {
        console.error(`  ❌ DB kayıt hatası: ${file.filename}`, error);
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      extractedCount: extractedFiles.length,
      savedCount: savedFiles.length,
      files: savedFiles,
    });

  } catch (error: unknown) {
    console.error('❌ ZIP extraction API hatası:', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
