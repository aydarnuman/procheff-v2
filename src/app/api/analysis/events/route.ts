import { NextResponse } from "next/server";
import { AnalysisStore } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const analysisId = url.searchParams.get("analysisId");
  if (!analysisId) return NextResponse.json({ code: "missing_analysisId" }, { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      function send(payload: any) {
        const s = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(s));
      }

      // initial send if exists
      const initial = AnalysisStore.get(analysisId);
      if (initial) send(initial);

      const iv = setInterval(() => {
        const rec = AnalysisStore.get(analysisId);
        if (rec) send(rec);
        if (rec && (rec.status === "completed" || rec.status === "failed")) {
          clearInterval(iv);
          controller.close();
        }
      }, 800);

      return () => clearInterval(iv);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
