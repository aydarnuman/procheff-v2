#!/usr/bin/env node

/**
 * Upload one or more local files to the running dev server /api/upload endpoint.
 * Usage:
 *   node scripts/upload-files.js <file1> [file2 ...]
 *
 * Notes:
 * - Requires `npm run dev` to be running on http://localhost:3000
 * - Streams SSE progress logs to the console
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/upload-files.js <file1> [file2 ...]');
    process.exit(1);
  }

  // Verify files
  const files = args.map((p) => path.resolve(p));
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`❌ File not found: ${f}`);
      process.exit(1);
    }
  }

  // Prepare form
  const form = new FormData();
  files.forEach((f, i) => {
    const buf = fs.readFileSync(f);
    const filename = path.basename(f);
    const contentType = guessContentType(filename);
    form.append(`file${i}`, buf, { filename, contentType });
  });
  form.append('fileCount', String(files.length));

  const endpoint = 'http://localhost:3000/api/upload';
  console.log(`🚀 Uploading ${files.length} file(s) → ${endpoint}`);
  files.forEach((f) => console.log(`  • ${f}`));
  console.log('');

  try {
    const res = await fetch(endpoint, { method: 'POST', body: form, headers: form.getHeaders() });
    if (!res.ok) {
      const body = await res.text();
      console.error(`❌ Upload failed: ${res.status} ${res.statusText}\n${body}`);
      process.exit(1);
    }

    console.log('📡 Streaming server-sent events...');
    const reader = res.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      frames.forEach((frame) => {
        const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) return;
        try {
          const data = JSON.parse(dataLine.slice(6));
          if (data.type === 'progress') {
            const p = data.progress != null ? `${data.progress}%` : '';
            console.log(`📊 ${p} ${data.message}`);
          } else if (data.type === 'success') {
            console.log('\n✅ Completed');
            console.log(`📄 Total chars: ${data.stats?.totalCharCount}`);
            console.log(`🧾 Files: ${data.stats?.fileCount}`);
            if (Array.isArray(data.warnings) && data.warnings.length) {
              console.log('\n⚠️ Warnings:');
              data.warnings.forEach((w) => console.log(` - ${w}`));
            }
          } else if (data.type === 'error') {
            console.error(`❌ Error: ${data.error} (${data.code})`);
          }
        } catch (_) {
          // ignore parse errors
        }
      });
    });

    reader.on('end', () => {
      console.log('\n📡 Stream ended');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Request error:', err.message || String(err));
    process.exit(1);
  }
}

function guessContentType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

main();

