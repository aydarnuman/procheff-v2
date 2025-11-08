import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAnalysisRecord, getAnalysisByHash } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 30 seconds timeout

type InitBody = {
  filename: string;
  size: number;
  mimeType?: string;
  fileHash?: string;
};

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => null) as InitBody | null;
    if (!body || !body.filename || !body.size) {
      console.log("❌ Invalid init payload:", { hasBody: !!body, hasFilename: !!body?.filename, hasSize: !!body?.size });
      return NextResponse.json({ 
        code: "invalid_payload", 
        message: "filename and size required" 
      }, { status: 400 });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (body.size > maxSize) {
      console.log(`❌ File too large: ${body.filename} (${(body.size / 1024 / 1024).toFixed(2)}MB)`);
      return NextResponse.json({ 
        code: "file_too_large", 
        message: `File size ${(body.size / 1024 / 1024).toFixed(2)}MB exceeds limit of 50MB` 
      }, { status: 413 });
    }

    const userId = req.headers.get("x-user-id") ?? undefined;

    // idempotency by fileHash if provided
    if (body.fileHash) {
      const existing = getAnalysisByHash(userId, body.fileHash);
      if (existing) {
        console.log(`♻️ Returning existing analysis: ${existing.analysisId} (${existing.status})`);
        return NextResponse.json({ 
          analysisId: existing.analysisId, 
          status: existing.status,
          cached: true 
        }, { status: 200 });
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

    const duration = Date.now() - startTime;
    console.log(`✅ Analysis initialized: ${analysisId} | ${body.filename} (${(body.size / 1024).toFixed(1)}KB) | ${duration}ms`);

    return NextResponse.json({ 
      analysisId, 
      status: "created",
      uploadUrl: `/api/analysis/upload-local?analysisId=${analysisId}&filename=${encodeURIComponent(body.filename)}`
    }, { status: 201 });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Init error (${duration}ms):`, errorMsg);
    return NextResponse.json({ 
      code: "server_error", 
      message: "Analysis initialization failed" 
    }, { status: 500 });
  }
}
