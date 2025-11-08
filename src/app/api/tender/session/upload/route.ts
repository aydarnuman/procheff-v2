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
    // FormData'dan dosyaları ve sessionId'yi al
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const fileCount = parseInt(formData.get('fileCount') as string || '0');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }

    if (fileCount === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // Session klasörünü oluştur
    const sessionDir = path.join(process.cwd(), 'data', 'sessions', sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const uploadedFiles: any[] = [];

    // Her dosyayı kaydet
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File;

      if (!file) {
        console.warn(`⚠️ file${i} bulunamadı, atlanıyor`);
        continue;
      }

      // Dosyayı kaydet
      const filePath = path.join(sessionDir, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      console.log(`✅ Dosya kaydedildi: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

      // ZIP/RAR ise bildir
      const isArchive = file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.rar');

      uploadedFiles.push({
        filename: file.name,
        size: file.size,
        isArchive,
      });
    }

    return NextResponse.json({
      success: true,
      filesUploaded: uploadedFiles.length,
      files: uploadedFiles,
      message: `${uploadedFiles.length} dosya başarıyla yüklendi`
    });

  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
