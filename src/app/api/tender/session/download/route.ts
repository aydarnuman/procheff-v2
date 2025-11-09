import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Session'dan dosya indir
 * GET /api/tender/session/download?path=...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'path parametresi gerekli' },
        { status: 400 }
      );
    }

    // Güvenlik: path traversal önleme
    const normalizedPath = path.normalize(filePath);
    const dataDir = path.join(process.cwd(), 'data');
    // Path zaten data/sessions/... şeklinde geliyorsa direkt kullan
    const absolutePath = normalizedPath.startsWith('data/')
      ? path.join(process.cwd(), normalizedPath)
      : path.join(process.cwd(), 'data', normalizedPath);

    // Path must be inside data directory
    if (!absolutePath.startsWith(dataDir)) {
      console.error('❌ Path traversal attempt blocked:', filePath);
      return NextResponse.json(
        { success: false, error: 'Geçersiz dosya yolu' },
        { status: 403 }
      );
    }

    // Dosya var mı kontrol et
    if (!fs.existsSync(absolutePath)) {
      console.error('❌ Dosya bulunamadı:', absolutePath);
      return NextResponse.json(
        { success: false, error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    // Dosyayı oku
    const fileBuffer = fs.readFileSync(absolutePath);
    const fileName = path.basename(absolutePath);

    // MIME type belirleme
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.bin': 'application/octet-stream', // Binary fallback
    };

    let mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    // .bin dosyaları için magic bytes kontrolü
    if (ext === '.bin' && fileBuffer.length > 10) {
      const header = fileBuffer.slice(0, 10).toString('utf-8');
      // HTML check
      if (header.includes('<!DOCTYPE') || header.includes('<html')) {
        mimeType = 'text/html';
      }
      // PDF check
      else if (fileBuffer.slice(0, 4).toString() === '%PDF') {
        mimeType = 'application/pdf';
      }
      // ZIP check
      else if (fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B) {
        mimeType = 'application/zip';
      }
    }

    console.log(`✅ Dosya indiriliyor: ${fileName} (${fileBuffer.length} bytes)`);

    // Response headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('❌ Dosya indirme hatası:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Dosya indirilemedi' },
      { status: 500 }
    );
  }
}
