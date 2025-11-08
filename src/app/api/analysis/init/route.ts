import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAnalysisRecord, getAnalysisByHash } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";

type InitBody = {
  filename: string;
  size: number;
  mimeType?: string;
  fileHash?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as InitBody | null;
    if (!body || !body.filename || !body.size) {
      return NextResponse.json({ code: "invalid_payload", message: "filename and size required" }, { status: 400 });
    }

    const userId = req.headers.get("x-user-id") ?? undefined;

    // idempotency by fileHash if provided
    if (body.fileHash) {
      const existing = getAnalysisByHash(userId, body.fileHash);
      if (existing) {
        return NextResponse.json({ analysisId: existing.analysisId, status: existing.status }, { status: 200 });
      }
    }

    const analysisId = randomUUID();
    createAnalysisRecord({
      analysisId,
      userId,
      filename: body.filename,
      size: body.size,
      mimeType: body.mimeType,
      fileHash: body.fileHash ?? null,
      status: "created",
      progress: 0,
      createdAt: new Date().toISOString(),
      storagePath: null,
      error: null,
    });

    // For dev fallback, we return a local-upload URL in PR2. For now just return analysisId.
    return NextResponse.json({ analysisId, status: "created" }, { status: 201 });
  } catch (err) {
    console.error("init error", err);
    return NextResponse.json({ code: "server_error", message: "init failed" }, { status: 500 });
  }
}
