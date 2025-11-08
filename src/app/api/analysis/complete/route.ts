import { NextResponse } from "next/server";
import fs from "fs";
import { getAnalysis, updateAnalysis } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.analysisId) return NextResponse.json({ code: "invalid_payload" }, { status: 400 });
    const { analysisId, storagePath } = body;
    const rec = getAnalysis(analysisId);
    if (!rec) return NextResponse.json({ code: "not_found", message: "analysis not found" }, { status: 404 });

    // For local fallback, expect storagePath is file path in tmp_uploads
    if (storagePath && !fs.existsSync(storagePath)) {
      return NextResponse.json({ code: "missing_object", message: "uploaded object not found" }, { status: 400 });
    }

    updateAnalysis(analysisId, { storagePath: storagePath ?? rec.storagePath ?? null, status: "queued", progress: 1 });
    return NextResponse.json({ status: "queued", analysisId }, { status: 202 });
  } catch (err) {
    console.error("complete error", err);
    return NextResponse.json({ code: "server_error", message: "complete failed" }, { status: 500 });
  }
}
