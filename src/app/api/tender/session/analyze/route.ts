// ============================================================================
// POST /api/tender/session/analyze
// Start AI analysis for a session
// Returns immediately and runs analysis in background
// Client should poll /api/tender/session/[id]/progress for updates
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import { AnalysisPipeline } from '@/lib/tender-session/analysis-pipeline';
import type { StartAnalysisRequest, StartAnalysisResponse } from '@/lib/tender-session/types';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body: StartAnalysisRequest = await request.json();

    // Validate request
    if (!body.sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' } as StartAnalysisResponse,
        { status: 400 }
      );
    }

    // Check if session exists
    const session = await TenderSessionManager.get(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' } as StartAnalysisResponse,
        { status: 404 }
      );
    }

    // Check if session has files
    if (session.files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files uploaded to session' } as StartAnalysisResponse,
        { status: 400 }
      );
    }

    console.log(`🚀 Starting AI Analysis Pipeline for session: ${body.sessionId}`);

    // Run analysis pipeline in background (don't await - let it run async)
    AnalysisPipeline.run(body.sessionId, (stage, message, percentage) => {
      // Progress callback - could emit to event bus/queue for SSE
      console.log(`📊 [${body.sessionId}] ${stage}: ${message} (${percentage}%)`);
    }).catch((error) => {
      console.error(`❌ Analysis pipeline failed for ${body.sessionId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Analysis started. Poll /api/tender/session/[id]/progress for updates.',
    } as StartAnalysisResponse);
  } catch (error: any) {
    console.error('Start analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message } as StartAnalysisResponse,
      { status: 500 }
    );
  }
}
