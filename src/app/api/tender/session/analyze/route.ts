// ============================================================================
// API: START SESSION ANALYSIS (DISABLED - Use /api/ai/full-analysis instead)
// POST /api/tender/session/analyze
// ============================================================================

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Session-based analysis is deprecated. Use /api/ai/full-analysis endpoint instead.',
      redirect: '/api/ai/full-analysis'
    },
    { status: 501 } // Not Implemented
  );
}
