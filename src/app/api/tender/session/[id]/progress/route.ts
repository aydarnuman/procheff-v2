// ============================================================================
// GET /api/tender/session/[id]/progress
// Server-Sent Events (SSE) endpoint for real-time analysis progress
// ============================================================================

import { NextRequest } from 'next/server';
import { TenderSessionManager } from '@/lib/tender-session/session-manager';
import type { AnalysisProgress } from '@/lib/tender-session/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await context.params;

  if (!sessionId) {
    return new Response('Session ID is required', { status: 400 });
  }

  // Check if session exists
  const session = await TenderSessionManager.get(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper function to send SSE message
      const sendEvent = (data: AnalysisProgress) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        // Poll session status every 1 second
        const intervalId = setInterval(async () => {
          const currentSession = await TenderSessionManager.get(sessionId);

          if (!currentSession) {
            clearInterval(intervalId);
            controller.close();
            return;
          }

          // Send progress update
          const progress: AnalysisProgress = {
            sessionId,
            stage: mapStatusToStage(currentSession.status),
            filesProcessed: currentSession.files.length,
            totalFiles: currentSession.files.length,
            percentage: calculatePercentage(currentSession.status),
            message: getStatusMessage(currentSession.status),
            error: currentSession.errorMessage,
          };

          sendEvent(progress);

          // Close stream if completed or error
          if (currentSession.status === 'completed' || currentSession.status === 'error') {
            clearInterval(intervalId);
            controller.close();
          }
        }, 1000); // Poll every 1 second

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          controller.close();
        });
      } catch (error) {
        console.error('SSE stream error:', error);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Helper functions
function mapStatusToStage(status: string): AnalysisProgress['stage'] {
  const mapping: Record<string, AnalysisProgress['stage']> = {
    'created': 'starting',
    'uploading': 'extracting_files',
    'uploaded': 'processing_files',
    'analyzing': 'analyzing_content',
    'completed': 'completed',
    'error': 'error',
  };
  return mapping[status] || 'starting';
}

function calculatePercentage(status: string): number {
  const percentages: Record<string, number> = {
    'created': 0,
    'uploading': 20,
    'uploaded': 40,
    'analyzing': 70,
    'completed': 100,
    'error': 0,
  };
  return percentages[status] || 0;
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    'created': 'Session oluşturuldu',
    'uploading': 'Dosyalar yükleniyor...',
    'uploaded': 'Dosyalar yüklendi, analiz bekliyor',
    'analyzing': 'AI analizi yapılıyor...',
    'completed': 'Analiz tamamlandı',
    'error': 'Hata oluştu',
  };
  return messages[status] || 'İşlem devam ediyor...';
}
