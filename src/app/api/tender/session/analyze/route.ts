// ============================================================================
// API: START SESSION ANALYSIS
// POST /api/tender/session/analyze
// ⚠️ SIMPLIFIED VERSION - Analysis pipeline not fully implemented yet
// ============================================================================

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // TODO: Implement analysis pipeline
    // For now, return not implemented
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Session analysis feature is being migrated. Use direct analysis endpoint instead.' 
      },
      { status: 501 } // Not Implemented
    );
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
