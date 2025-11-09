import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * 🆕 DB'ye bakMADAN direkt filesystem'den dosyaları oku
 * 
 * Kullanım: GET /api/tender/session/files-from-fs?sessionId=tender_20251107_184035_2g8az
 * 
 * NOT: Bu PLAN B - normalde tender_files tablosundan gelmeli ama şimdi orada kayıt yok
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId parametresi gerekli' },
        { status: 400 }
      );
    }

    // Session klasörü yolu
    const sessionDir = path.join(process.cwd(), 'data', 'sessions', sessionId);

    // Klasör var mı kontrol et
    try {
      await fs.access(sessionDir);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Session klasörü bulunamadı' },
        { status: 404 }
      );
    }

    // Klasördeki dosyaları oku
    const entries = await fs.readdir(sessionDir, { withFileTypes: true });
    
    // Sadece dosyaları al (klasörleri değil)
    const files = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(sessionDir, entry.name);
        const stats = await fs.stat(filePath);
        
        // MIME type tespiti (basit extension-based)
        const ext = path.extname(entry.name).toLowerCase();
        let mimeType = 'application/octet-stream';
        const mimeMap: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.zip': 'application/zip',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain',
          '.csv': 'text/csv',
          '.json': 'application/json',
        };
        
        if (mimeMap[ext]) {
          mimeType = mimeMap[ext];
        }
        
        // .bin dosyaları için özel kontrol (ilk birkaç byte'ı oku)
        if (entry.name.endsWith('.bin')) {
          try {
            const buffer = await fs.readFile(filePath);
            if (buffer.length > 10) {
              const header = buffer.slice(0, 10).toString('utf-8');
              // HTML check (en yaygın)
              if (header.includes('<!DOCTYPE') || header.includes('<html')) {
                mimeType = 'text/html';
              }
              // PDF magic bytes: %PDF
              else if (buffer.slice(0, 4).toString() === '%PDF') {
                mimeType = 'application/pdf';
              }
              // ZIP magic bytes: PK
              else if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
                // DOCX/XLSX (ZIP based with specific structure)
                const zipHeader = buffer.slice(0, 4).toString('hex');
                if (zipHeader === '504b0304') {
                  // Check for word/xl folder in ZIP
                  const content = buffer.toString('utf-8');
                  if (content.includes('word/')) {
                    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                  } else if (content.includes('xl/')) {
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                  } else {
                    mimeType = 'application/zip';
                  }
                }
              }
            }
          } catch {
            // Binary okuma hatası, default MIME type kullan
          }
        }

        files.push({
          name: entry.name,
          path: path.join('sessions', sessionId, entry.name), // Relative path for download API
          size: stats.size,
          type: mimeType,
          lastModified: stats.mtime.toISOString(),
        });
      }
    }

    console.log(`📂 Filesystem'den ${files.length} dosya bulundu: ${sessionId}`);
    
    return NextResponse.json({
      success: true,
      sessionId,
      files,
      count: files.length,
      source: 'filesystem', // DB değil, direkt dosya sistemi
    });

  } catch (error: unknown) {
    console.error('❌ Filesystem dosya okuma hatası:', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
