// ============================================================================
// API: LIST TENDER SESSIONS
// GET /api/tender/session/list
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';

export async function GET() {
  try {
    const sessions = await TenderSessionManager.list({ limit: 100 });

    return NextResponse.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    console.error('Session list error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
