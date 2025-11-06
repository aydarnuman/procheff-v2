// ============================================================================
// GET /api/tender/session/[id]/file/[fileId]
// Download a file from a session
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await context.params;

    if (!id || !fileId) {
      return NextResponse.json(
        { success: false, error: 'Session ID and File ID are required' },
        { status: 400 }
      );
    }

    // Get session
    const session = await TenderSessionManager.get(id);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Find the file in session
    const file = session.files.find(f => f.id === fileId);
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found in session' },
        { status: 404 }
      );
    }

    // Check if file exists on disk
    if (!file.storagePath || !fs.existsSync(file.storagePath)) {
      return NextResponse.json(
        { success: false, error: 'File not found on disk' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = fs.readFileSync(file.storagePath);

    // Return file with appropriate headers
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="${file.filename}"`,
      },
    });

    return response;
  } catch (error: any) {
    console.error('Download file error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}