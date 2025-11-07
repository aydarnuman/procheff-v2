// ============================================================================
// API: GET SESSION FILE
// GET /api/tender/session/[id]/file/[fileId]
// ⚠️ SIMPLIFIED VERSION - File download not fully implemented yet
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: sessionId, fileId } = await params;

    // Get file metadata
    const file = await TenderSessionManager.getFile(fileId);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Verify file belongs to session
    if (file.sessionId !== sessionId) {
      return NextResponse.json(
        { success: false, error: 'File does not belong to this session' },
        { status: 403 }
      );
    }

    // TODO: Implement file download from storage
    // For now, return file metadata only
    
    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        uploadedAt: file.uploadedAt,
      },
      message: 'File download feature is being migrated',
    });
  } catch (error: any) {
    console.error('File get error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
