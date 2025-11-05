// ============================================================================
// GET /api/tender/session/[id]
// Get session details by ID
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import type { GetSessionResponse } from '@/lib/tender-session/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' } as GetSessionResponse,
        { status: 400 }
      );
    }

    // Get session
    const session = await TenderSessionManager.get(id);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' } as GetSessionResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    } as GetSessionResponse);
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { success: false, error: error.message } as GetSessionResponse,
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/tender/session/[id]
// Delete a session and all associated files
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Delete session from database
    const result = await TenderSessionManager.delete(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Delete session files from disk
    const { UnifiedFileStorage } = await import('@/lib/tender-session/file-storage');
    await UnifiedFileStorage.deleteSession(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
