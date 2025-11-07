// ============================================================================
// API: UPLOAD FILE TO SESSION
// POST /api/tender/session/upload
// Simple file storage with ZIP detection
// ============================================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }

    // FormData'dan dosyayı al
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Session klasörünü oluştur
    const sessionDir = path.join(process.cwd(), 'data', 'sessions', sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Dosyayı kaydet
    const filePath = path.join(sessionDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log(`✅ Dosya kaydedildi: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    // ZIP/RAR ise bildir (backend'de extract edilecek)
    const isArchive = file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.rar');
    
    if (isArchive) {
      // ZIP extraction'ı simüle et (gerçek extraction analyze endpoint'inde olacak)
      return NextResponse.json({
        success: true,
        filename: file.name,
        size: file.size,
        isArchive: true,
        extractedFiles: [], // Şimdilik boş, analyze'de dolacak
        message: `ZIP file uploaded: ${file.name}`
      });
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      isArchive: false,
      message: 'File uploaded successfully'
    });

  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
