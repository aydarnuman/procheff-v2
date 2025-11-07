// ============================================================================
// API: GET SESSION ANALYSIS PROGRESS
// GET /api/tender/session/[id]/progress
// ⚠️ SIMPLIFIED VERSION - Progress tracking not fully implemented yet
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    const session = await TenderSessionManager.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Return basic status info
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      status: session.status,
      filesCount: session.files.length,
      hasResult: !!session.result,
      errorMessage: session.errorMessage,
    });
  } catch (error: any) {
    console.error('Progress get error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
