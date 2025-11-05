// ============================================================================
// POST /api/tender/session/start
// Create a new tender analysis session
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import type { CreateSessionRequest, CreateSessionResponse } from '@/lib/tender-session/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();

    // Validate request
    if (!body.source) {
      return NextResponse.json(
        { success: false, error: 'Source is required' } as CreateSessionResponse,
        { status: 400 }
      );
    }

    // Create session
    const result = await TenderSessionManager.create({
      source: body.source,
      tenderId: body.tenderId,
      userId: body.userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error } as CreateSessionResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
    } as CreateSessionResponse);
  } catch (error: any) {
    console.error('Session start error:', error);
    return NextResponse.json(
      { success: false, error: error.message } as CreateSessionResponse,
      { status: 500 }
    );
  }
}
