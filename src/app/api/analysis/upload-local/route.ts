import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAnalysis, updateAnalysis } from "@/lib/analysis/records";

export const dynamic = "force-dynamic";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: Request) {
  try {
    // Quick dev-friendly approach: read body as arrayBuffer and write to /tmp
    const url = new URL(req.url);
    const analysisId = url.searchParams.get("analysisId");
    const filename = url.searchParams.get("filename") ?? `upload-${Date.now()}.bin`;
    if (!analysisId) return NextResponse.json({ code: "missing_analysisId" }, { status: 400 });

    // Attempt raw body save
    const buf = await req.arrayBuffer();
    const tmpDir = path.join(process.cwd(), "tmp_uploads");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `${analysisId}-${filename}`);
    fs.writeFileSync(filePath, Buffer.from(buf));

    const rec = getAnalysis(analysisId);
    if (rec) {
      updateAnalysis(analysisId, { storagePath: filePath, updatedAt: new Date().toISOString() });
    }

    return NextResponse.json({ ok: true, storedPath: filePath }, { status: 200 });
  } catch (err) {
    console.error("upload-local error", err);
    return NextResponse.json({ code: "server_error", message: "upload failed" }, { status: 500 });
  }
}
