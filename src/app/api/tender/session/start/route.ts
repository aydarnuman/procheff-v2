// ============================================================================
// API: CREATE TENDER SESSION
// POST /api/tender/session/start
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import type { CreateSessionRequest } from '@/lib/tender-session/types';

export async function POST(request: Request) {
  try {
    const body: CreateSessionRequest = await request.json();

    const { source, tenderId, userId } = body;

    if (!source || !['ihalebul', 'manual'].includes(source)) {
      return NextResponse.json(
        { success: false, error: 'Invalid source. Must be "ihalebul" or "manual"' },
        { status: 400 }
      );
    }

    const result = await TenderSessionManager.create({
      source,
      tenderId,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
    });
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
