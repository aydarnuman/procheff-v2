// Server-Sent Events endpoint for real-time scraping progress
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Global progress store (in-memory for now)
export interface ScraperProgress {
  source: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentPage?: number;
  totalPages?: number;
  tendersFound?: number;
  message?: string;
  timestamp: number;
}

const progressStore = new Map<string, ScraperProgress>();

export function updateProgress(source: string, progress: Partial<ScraperProgress>) {
  const current = progressStore.get(source) || {
    source,
    status: 'idle',
    timestamp: Date.now(),
  };

  progressStore.set(source, {
    ...current,
    ...progress,
    timestamp: Date.now(),
  });
}

export function getProgress(source: string): ScraperProgress | undefined {
  return progressStore.get(source);
}

export function clearProgress(source: string) {
  progressStore.delete(source);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'all';

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial progress
      const sendProgress = () => {
        if (source === 'all') {
          const allProgress = Array.from(progressStore.entries()).map(([key, value]) => value);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(allProgress)}\n\n`));
        } else {
          const progress = getProgress(source);
          if (progress) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
          }
        }
      };

      // Send progress every 500ms
      const interval = setInterval(sendProgress, 500);

      // Send initial data
      sendProgress();

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
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
