// ============================================================================
// POST /api/tender/session/upload
// Upload files to a session (supports multipart/form-data)
// Auto-detects MIME type and extracts ZIP files
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import { UnifiedFileStorage } from '@/lib/tender-session/file-storage';
import type { UploadFileResponse } from '@/lib/tender-session/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' } as UploadFileResponse,
        { status: 400 }
      );
    }

    // Check if session exists
    const session = await TenderSessionManager.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' } as UploadFileResponse,
        { status: 404 }
      );
    }

    // Update session status to 'uploading'
    await TenderSessionManager.updateStatus(sessionId, 'uploading');

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' } as UploadFileResponse,
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`\n📤 Uploading file to session ${sessionId}: ${file.name} (${buffer.byteLength} bytes)`);

    // Store file (with auto MIME detection and ZIP extraction)
    const storeResult = await UnifiedFileStorage.store({
      sessionId,
      file: buffer,
      filename: file.name,
    });

    if (!storeResult.success) {
      // Update session status to 'error'
      await TenderSessionManager.updateStatus(sessionId, 'error', storeResult.error);

      return NextResponse.json(
        { success: false, error: storeResult.error } as UploadFileResponse,
        { status: 500 }
      );
    }

    // Update session status to 'uploaded' (if this was the last file)
    await TenderSessionManager.updateStatus(sessionId, 'uploaded');

    // Prepare response
    const files = storeResult.files || [];
    const primaryFile = files[0];

    // If ZIP was extracted, return extracted files info
    if (files.length > 1) {
      return NextResponse.json({
        success: true,
        fileId: primaryFile.id,
        filename: primaryFile.filename,
        mimeType: primaryFile.mimeType,
        size: primaryFile.size,
        extractedFiles: files.slice(1).map((f) => ({
          fileId: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          size: f.size,
        })),
      } as UploadFileResponse);
    }

    // Single file upload
    return NextResponse.json({
      success: true,
      fileId: primaryFile.id,
      filename: primaryFile.filename,
      mimeType: primaryFile.mimeType,
      size: primaryFile.size,
    } as UploadFileResponse);
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message } as UploadFileResponse,
      { status: 500 }
    );
  }
}
