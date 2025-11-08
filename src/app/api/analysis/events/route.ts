import { NextResponse } from "next/server";
import { AnalysisStore } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max SSE connection

export async function GET(req: Request) {
  const url = new URL(req.url);
  const analysisId = url.searchParams.get("analysisId");
  
  if (!analysisId) {
    console.log("❌ SSE failed: missing analysisId");
    return NextResponse.json({ code: "missing_analysisId" }, { status: 400 });
  }

  // Verify analysis exists
  const initial = AnalysisStore.get(analysisId);
  if (!initial) {
    console.log(`❌ SSE failed: analysis ${analysisId} not found`);
    return NextResponse.json({ code: "not_found" }, { status: 404 });
  }

  console.log(`📡 SSE started for: ${analysisId} (${initial.status})`);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let eventCount = 0;
      
      function send(payload: any) {
        const s = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(s));
        eventCount++;
      }

      // Send initial state
      send(initial);

      // Poll for updates every 800ms
      const iv = setInterval(() => {
        const rec = AnalysisStore.get(analysisId);
        if (!rec) {
          console.log(`⚠️ SSE: analysis ${analysisId} disappeared`);
          clearInterval(iv);
          controller.close();
          return;
        }
        
        send(rec);
        
        // Close stream on terminal states
        if (rec.status === "completed" || rec.status === "failed") {
          console.log(`✅ SSE completed for ${analysisId}: ${rec.status} (${eventCount} events sent)`);
          clearInterval(iv);
          setTimeout(() => controller.close(), 1000); // Give client time to receive final event
        }
      }, 800);

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        console.log(`🔌 SSE connection aborted for ${analysisId}`);
        clearInterval(iv);
        controller.close();
      });

      return () => {
        clearInterval(iv);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
