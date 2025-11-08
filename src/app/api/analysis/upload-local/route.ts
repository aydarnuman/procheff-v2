import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAnalysis, updateAnalysis } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds for large files

// Note: bodyParser config is deprecated in Next.js App Router
// Raw body reading works by default with req.arrayBuffer()

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const analysisId = url.searchParams.get("analysisId");
    const filename = url.searchParams.get("filename") ?? `upload-${Date.now()}.bin`;
    
    if (!analysisId) {
      console.log("❌ Upload failed: missing analysisId");
      return NextResponse.json({ code: "missing_analysisId" }, { status: 400 });
    }

    // Verify analysis exists
    const rec = getAnalysis(analysisId);
    if (!rec) {
      console.log(`❌ Upload failed: analysis ${analysisId} not found`);
      return NextResponse.json({ code: "analysis_not_found" }, { status: 404 });
    }

    // Read and validate file
    const buf = await req.arrayBuffer();
    const fileSize = buf.byteLength;
    
    // Validate size matches init
    if (rec.size && Math.abs(fileSize - rec.size) > 1024) { // Allow 1KB tolerance
      console.log(`⚠️ File size mismatch: expected ${rec.size}, got ${fileSize}`);
    }

    // Save to tmp_uploads
    const tmpDir = path.join(process.cwd(), "tmp_uploads");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const filePath = path.join(tmpDir, `${analysisId}-${sanitizedFilename}`);
    fs.writeFileSync(filePath, Buffer.from(buf));

    // Update analysis record
    updateAnalysis(analysisId, { 
      storagePath: filePath, 
      updatedAt: new Date().toISOString() 
    });

    const duration = Date.now() - startTime;
    console.log(`✅ File uploaded: ${filename} (${(fileSize / 1024).toFixed(1)}KB) | ${duration}ms`);

    return NextResponse.json({ 
      ok: true, 
      storedPath: filePath,
      size: fileSize,
      duration 
    }, { status: 200 });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Upload error (${duration}ms):`, errorMsg);
    return NextResponse.json({ 
      code: "server_error", 
      message: "File upload failed" 
    }, { status: 500 });
  }
}
