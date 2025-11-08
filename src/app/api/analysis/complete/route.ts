import { NextResponse } from "next/server";
import fs from "fs";
import { getAnalysis, updateAnalysis } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";
export const maxDuration = 15; // 15 seconds timeout

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => null);
    
    if (!body || !body.analysisId) {
      console.log("❌ Complete failed: invalid payload");
      return NextResponse.json({ code: "invalid_payload" }, { status: 400 });
    }
    
    const { analysisId, storagePath } = body;
    const rec = getAnalysis(analysisId);
    
    if (!rec) {
      console.log(`❌ Complete failed: analysis ${analysisId} not found`);
      return NextResponse.json({ code: "not_found", message: "analysis not found" }, { status: 404 });
    }

    // Verify file exists
    const finalStoragePath = storagePath ?? rec.storagePath;
    if (!finalStoragePath) {
      console.log(`❌ Complete failed: no storage path for ${analysisId}`);
      return NextResponse.json({ code: "missing_storage_path", message: "file not uploaded" }, { status: 400 });
    }

    if (!fs.existsSync(finalStoragePath)) {
      console.log(`❌ Complete failed: file not found at ${finalStoragePath}`);
      return NextResponse.json({ code: "missing_object", message: "uploaded file not found" }, { status: 400 });
    }

    // Get file stats
    const stats = fs.statSync(finalStoragePath);
    const fileSize = stats.size;

    // Mark as queued for worker
    updateAnalysis(analysisId, { 
      storagePath: finalStoragePath, 
      status: "queued", 
      progress: 1,
      updatedAt: new Date().toISOString()
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Analysis queued: ${analysisId} | ${rec.filename} (${(fileSize / 1024).toFixed(1)}KB) | ${duration}ms`);

    return NextResponse.json({ 
      status: "queued", 
      analysisId,
      message: "Analysis queued for processing"
    }, { status: 202 });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Complete error (${duration}ms):`, errorMsg);
    return NextResponse.json({ 
      code: "server_error", 
      message: "Failed to complete analysis" 
    }, { status: 500 });
  }
}
