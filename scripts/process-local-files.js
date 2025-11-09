#!/usr/bin/env node

/**
 * High-quality local document processing (no server required).
 *
 * Supports: PDF (OCR), DOCX (mammoth), DOC (antiword → optional soffice→DOCX→mammoth),
 *           TXT, CSV, JSON. Outputs plain text to local_outputs/<name>.txt
 *
 * Usage:
 *   OCR_DPI=300 TESS_PSM=6 OCR_MAX_PARALLEL=8 node scripts/process-local-files.js <file1> [file2 ...]
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Optional mammoth for DOCX
let mammoth;
try { mammoth = require('mammoth'); } catch { mammoth = null; }

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/process-local-files.js <file1> [file2 ...]');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'local_outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const input of args) {
    const filePath = path.resolve(input);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath, ext);
    const outPath = path.join(outDir, `${base}.txt`);

    try {
      let text = '';
      if (ext === '.pdf') {
        text = await processPDF(filePath);
      } else if (ext === '.docx') {
        text = await processDOCX(filePath);
      } else if (ext === '.doc') {
        text = await processDOC(filePath);
      } else if (ext === '.json') {
        const raw = fs.readFileSync(filePath, 'utf-8');
        try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch { text = raw; }
      } else if (ext === '.csv' || ext === '.txt' || ext === '.rtf' || ext === '.html') {
        text = fs.readFileSync(filePath, 'utf-8');
      } else {
        console.warn(`⚠️ Unsupported file type: ${ext}. Skipping.`);
        continue;
      }

      fs.writeFileSync(outPath, normalizeText(text), 'utf-8');
      const chars = text.length;
      const words = (text.match(/\S+/g) || []).length;
      console.log(`✅ ${path.basename(filePath)} → ${outPath} (${words.toLocaleString('tr-TR')} kelime, ${chars.toLocaleString('tr-TR')} karakter)`);
      results.push({ file: filePath, out: outPath, chars, words });
    } catch (err) {
      console.error(`❌ Processing failed for ${filePath}:`, err.message || String(err));
    }
  }

  // Summary
  const totalChars = results.reduce((a, r) => a + r.chars, 0);
  const totalWords = results.reduce((a, r) => a + r.words, 0);
  console.log(`\n🎯 Completed ${results.length} file(s). Total: ${totalWords.toLocaleString('tr-TR')} kelime, ${totalChars.toLocaleString('tr-TR')} karakter.`);
}

function normalizeText(t) {
  // Minimal normalization similar to TurkishNormalizer
  return t.replace(/\r\n?|\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
}

async function processPDF(filePath) {
  // Route to OCR script directly; rely on env controls
  const tmpOut = path.join('/tmp', `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  const script = path.join(process.cwd(), 'scripts/pdf_ocr_tesseract.sh');
  if (!fs.existsSync(script)) throw new Error('OCR script not found: ' + script);

  await runCmd('bash', [script, filePath, tmpOut, String(process.env.MAX_OCR_PAGES || 999)], {
    env: process.env,
  });
  if (!fs.existsSync(tmpOut)) throw new Error('OCR output missing');
  const text = fs.readFileSync(tmpOut, 'utf-8');
  try { fs.unlinkSync(tmpOut); } catch {}
  if (!text.trim()) throw new Error('OCR returned empty text');
  return text;
}

async function processDOCX(filePath) {
  if (!mammoth) throw new Error('mammoth not installed');
  const buffer = fs.readFileSync(filePath);
  const res = await mammoth.extractRawText({ buffer });
  if (!res.value || !res.value.trim()) throw new Error('DOCX yielded empty text');
  return res.value;
}

async function processDOC(filePath) {
  // Try antiword first
  try {
    const out = execSync(`antiword "${filePath}" 2>/dev/null || true`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (out && out.trim()) return out;
  } catch {}

  // Try soffice conversion if available
  try {
    const soffice = execSync('command -v soffice || which soffice || true', { encoding: 'utf-8' }).trim();
    if (soffice) {
      const tmpDir = '/tmp';
      const tmpDocx = path.join(tmpDir, `doc_${Date.now()}_${Math.random().toString(36).slice(2)}.docx`);
      execSync(`soffice --headless --convert-to docx --outdir "${tmpDir}" "${filePath}"`, { stdio: 'ignore' });
      if (fs.existsSync(tmpDocx)) {
        try {
          const text = await processDOCX(tmpDocx);
          return text;
        } finally {
          try { fs.unlinkSync(tmpDocx); } catch {}
        }
      }
    }
  } catch {}

  // Fallback: crude binary text extraction
  const buf = fs.readFileSync(filePath);
  const raw = buf.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ').replace(/\s+/g, ' ').trim();
  if (raw.length < 50) throw new Error('DOC fallback produced too little text');
  return raw;
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    p.stdout.on('data', (d) => process.stdout.write(d.toString()));
    p.stderr.on('data', (d) => process.stderr.write(d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

main();

