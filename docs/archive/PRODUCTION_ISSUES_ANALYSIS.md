# PRODUCTION FAILURE ANALYSIS REPORT
## Procheff-v2 Codebase Critical Issues

Generated: 2025-11-08
Environment: Vercel/Production vs Local Development

---

## EXECUTIVE SUMMARY

The codebase contains **CRITICAL** incompatibilities between local development and Vercel production environments. These issues stem from:

1. **Filesystem Operations** in serverless runtime
2. **External Dependencies** (Puppeteer, LibreOffice, Tesseract, antiword)
3. **Child Process Execution** in Edge/Serverless runtime
4. **Hardcoded Paths** (hardcoded `/tmp`, `process.cwd()`)
5. **SQLite on Disk** (local database instead of serverless)
6. **Long-Running Operations** exceeding Vercel timeout limits
7. **Memory Management** issues with large file processing

---

## CRITICAL ISSUES

### 1. FILESYSTEM OPERATIONS (WILL FAIL ON VERCEL)

#### Issue: Direct filesystem read/write without abstraction
**Severity:** CRITICAL
**Impact:** File uploads, document processing, database operations will FAIL

#### Files Affected:
- `/src/app/api/tender/session/upload/route.ts` (Lines 35-43)
- `/src/lib/utils/smart-document-processor.ts` (Lines 403-408, 560-561, 600-614)
- `/src/lib/ihale-scraper/database/sqlite-client.ts` (Lines 19-26)
- `/src/lib/utils/doc-converter.ts` (Lines 17-26, 56-62)
- `/src/lib/ihale-scraper/scrapers/ihalebul-scraper.ts` (Lines 56, 70)

#### Code Examples:

**Problem 1: Session Upload Route**
```typescript
// /src/app/api/tender/session/upload/route.ts (Lines 35-43)
const sessionDir = path.join(process.cwd(), 'data', 'sessions', sessionId);
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}
const filePath = path.join(sessionDir, file.name);
const buffer = Buffer.from(await file.arrayBuffer());
fs.writeFileSync(filePath, buffer);
```
❌ **FAILS ON VERCEL:** 
- Vercel serverless uses read-only filesystem (except `/tmp`)
- `process.cwd()` returns `/var/task` which is read-only
- `fs.mkdirSync()` and `fs.writeFileSync()` will throw permission errors

**Problem 2: Database Path**
```typescript
// /src/lib/ihale-scraper/database/sqlite-client.ts (Lines 19-26)
const DB_PATH = path.join(process.cwd(), 'data', 'ihale-scraper.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
```
❌ **FAILS ON VERCEL:** 
- Cannot create `data/` directory in production
- Better-sqlite3 requires disk access which Vercel blocks
- This file already uses Turso (correct approach) but falls back to SQLite

**Problem 3: Document Processor Temp Files**
```typescript
// /src/lib/utils/smart-document-processor.ts (Lines 403-408)
const tempDir = "/tmp";
const tempFilePath = path.join(tempDir, `doc_${Date.now()}.doc`);
const buffer = Buffer.from(await file.arrayBuffer());
fs.writeFileSync(tempFilePath, buffer);
```
⚠️ **PARTIALLY WORKS:** Uses `/tmp` but:
- `/tmp` is not shared between Vercel function invocations
- Files don't persist between requests
- Requires external command execution (antiword, LibreOffice)

#### Solutions Needed:
1. Use Turso database exclusively (already integrated!)
2. Store files in `/tmp` for temporary processing ONLY
3. Return data as buffers/blobs instead of saving to disk
4. Use serverless-compatible file storage (S3, Vercel Blob Storage)

---

### 2. PUPPETEER BROWSER AUTOMATION (WILL FAIL ON VERCEL)

#### Issue: Browser automation in serverless environment
**Severity:** CRITICAL
**Impact:** Web scraping, document downloads, login automation will FAIL

#### Files Affected:
- `/src/lib/ihale-scraper/scrapers/ihalebul-scraper.ts` (lines 10-11, 38-47)
- `/src/lib/ihale-scraper/scrapers/ekap-scraper.ts` (lines 9-10, 30-33)
- `/src/app/api/ihale-scraper/download-with-auth/route.ts` (lines 2-3, 28-31)
- `/src/lib/ihale-scraper/scrapers/ilan-gov-scraper.ts` (embedded Puppeteer usage)

#### Code Problems:

**Problem 1: Puppeteer Launch Without Chromium**
```typescript
// /src/lib/ihale-scraper/scrapers/ihalebul-scraper.ts
import puppeteer from 'puppeteer';

browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```
❌ **FAILS ON VERCEL:**
- Puppeteer requires Chromium binary (~300MB)
- Vercel deployment package limit is 250MB
- Chromium not available in Vercel runtime
- Browser launch will timeout (60000ms timeout configured)

**Problem 2: Download-With-Auth Route**
```typescript
// /src/app/api/ihale-scraper/download-with-auth/route.ts
export const maxDuration = 120; // 2 minutes

browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
// ... 120+ seconds of login + download
```
❌ **FAILS ON VERCEL:**
- Vercel Pro plan max timeout: 60 seconds
- Puppeteer login + navigation takes 30-60 seconds alone
- PDF optimization script takes additional 120 seconds (line 578)
- Route will timeout before completion

**Problem 3: Memory Usage**
```typescript
// /src/lib/utils/smart-document-processor.ts (Line 611)
const ocrProcess = spawn('bash', [scriptPath, pdfToProcess, tempTxtPath, ...]);
// Creates pdf_ocr_tesseract.sh process
```
❌ **FAILS ON VERCEL:**
- Tesseract OCR requires system dependencies
- Bash script execution not available in Vercel runtime
- Memory limits on Vercel: 3GB max (often 512MB default)
- Large PDF processing can exceed memory limits

#### Impact:
- All scraping endpoints fail on Vercel
- Document downloads with authentication fail
- Tender data can't be retrieved from ihalebul.com, EKAP, etc.
- User can't download tenders in production

#### Solutions Needed:
1. Use Puppeteer Cloud (BrightData, ScraperAPI) instead of local browser
2. Or use HTTP-only approaches (cheerio for HTML parsing)
3. For authenticated downloads, use REST API directly if available
4. Cache scraped data to avoid re-processing

---

### 3. EXTERNAL COMMAND EXECUTION (WILL FAIL ON VERCEL)

#### Issue: Spawning child processes for external tools
**Severity:** CRITICAL
**Impact:** PDF optimization, OCR, document conversion will FAIL

#### Files Affected:
- `/src/lib/utils/smart-document-processor.ts` (lines 393-395, 547-551, 573-578, 611-614)
- `/src/lib/utils/doc-converter.ts` (lines 1, 24-26, 63-65)

#### External Dependencies Required:
1. **Tesseract OCR** - For PDF text extraction
2. **LibreOffice** - For DOC/DOCX conversion  
3. **pdftoppm** - For PDF to image conversion
4. **antiword** - For legacy DOC format handling
5. **bash scripts** - Custom PDF optimization

#### Code Problems:

**Problem 1: Tesseract OCR**
```typescript
// /src/lib/utils/smart-document-processor.ts (Lines 547-551)
const { exec, spawn } = await import("child_process");
const { promisify } = await import("util");
const execAsync = promisify(exec);

const ocrProcess = spawn('bash', [scriptPath, pdfToProcess, tempTxtPath, ...], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
});
```
❌ **FAILS ON VERCEL:**
- Tesseract not installed in Vercel runtime
- Bash script execution blocked in serverless
- Python environment not configured
- Process spawning limited in Vercel

**Problem 2: LibreOffice Conversion**
```typescript
// /src/lib/utils/doc-converter.ts (Lines 24-26)
await execAsync(
  `libreoffice --headless --convert-to docx --outdir "${outputDir}" "${docPath}"`
);
```
❌ **FAILS ON VERCEL:**
- LibreOffice not installed
- Headless mode requires display server
- 500MB+ installation size

**Problem 3: Legacy DOC Processing**
```typescript
// /src/lib/utils/smart-document-processor.ts (Line 415)
const { stdout } = await execAsync(
  `antiword "${tempFilePath}" 2>/dev/null || echo ""`
);
```
❌ **FAILS ON VERCEL:**
- antiword not installed

#### Workarounds Used (and why they fail):
- `process.cwd()` + bash scripts (line 600-602)
- Fallback to raw text extraction (lines 467-470)
- Manual byte manipulation (no actual parsing)

#### Impact:
- PDF OCR processing fails completely
- DOC/DOCX conversion fails
- Large PDF files can't be processed
- Users can't upload scanned documents

#### Solutions Needed:
1. Use cloud-based OCR service (Google Cloud Vision, Azure Computer Vision)
2. Use online conversion API (CloudConvert, Zamzar)
3. Remove OCR feature for Vercel or offer it as async background job
4. Pre-process files on client-side using JavaScript libraries

---

### 4. HARDCODED PATHS & ENVIRONMENT ISSUES

#### Issue: Hardcoded paths that don't exist in Vercel
**Severity:** HIGH
**Impact:** Configuration errors, missing resources

#### Files & Paths:

| File | Line | Path | Issue |
|------|------|------|-------|
| smart-document-processor.ts | 403 | `/tmp` | OK for temp, but not persistent |
| smart-document-processor.ts | 573 | `process.cwd()/scripts/pdf_optimizer.sh` | Script missing in production |
| smart-document-processor.ts | 600 | `process.cwd()/scripts/pdf_ocr_tesseract.sh` | Script missing in production |
| sqlite-client.ts | 19-20 | `process.cwd()/data/` | Directory doesn't exist in Vercel |
| doc-converter.ts | 56 | `/tmp/ihalebul-session.json` | Temporary files not persisted |
| ihalebul-scraper.ts | 56 | `/tmp/ihalebul-session.json` | Browser not available |
| ilan-gov-scraper.ts | 68 | `/tmp/ilan-gov-scraperapi.html` | Debug files in /tmp |

**Vercel Environment Facts:**
```
Root directory: /var/task (READ-ONLY)
Writable directory: /tmp (ephemeral, not shared)
Max package size: 250MB
Max memory: 3GB (often 512MB)
Max timeout: 60s (Pro: 60s, Hobby: 10s)
```

#### Solutions:
1. Use environment variables for all paths
2. Store configuration in environment, not files
3. Use `/tmp` ONLY for temporary processing
4. Move scripts to CI/CD or separate service

---

### 5. TIMEOUT CONFIGURATION ISSUES

#### Issue: maxDuration settings exceed Vercel limits
**Severity:** HIGH
**Impact:** Long-running operations will be force-terminated

#### Files & Timeouts:

| File | Route | maxDuration | Issue |
|------|-------|------------|-------|
| upload/route.ts | `/api/upload` | 420s (7 min) | ⚠️ Vercel free: 10s, Pro: 60s |
| download-with-auth/route.ts | `/api/ihale-scraper/download-with-auth` | 120s (2 min) | ❌ Exceeds Pro limit |
| quick-detect-type/route.ts | `/api/ai/quick-detect-type` | Not set | ✅ Default 60s |
| ihale-scraper/route.ts | `/api/ihale-scraper` | 300s (5 min) | ⚠️ Exceeds Vercel limit |

**Current Configuration:**
```typescript
// /src/app/api/upload/route.ts
export const maxDuration = 420; // 7 minutes

// /src/app/api/ihale-scraper/download-with-auth/route.ts  
export const maxDuration = 120; // 2 minutes

// /src/app/api/ihale-scraper/route.ts
export const maxDuration = 300; // 5 minutes
```

❌ **FAILS ON VERCEL:**
```
Vercel Hobby Plan: 10 second timeout (hardcoded)
Vercel Pro Plan: 60 second timeout maximum
Vercel Enterprise: Custom (can be higher)

Current routes configured for: 420s, 300s, 120s
```

#### Operations Taking Too Long:
1. **PDF OCR**: 30-120 seconds per PDF
2. **Puppeteer Login**: 20-40 seconds
3. **Browser Download**: 30+ seconds
4. **Multiple Document Processing**: Cumulative delays

#### Impact:
- Upload route times out with large files
- Scraper orchestration times out
- Downloads with auth timeout

#### Solutions:
1. Implement background jobs (Bull Queue, Vercel Cron)
2. Break operations into smaller chunks
3. Implement webhooks for async processing
4. Use Vercel Edge Functions for lightweight operations
5. Store results in database/cache for polling

---

### 6. BETTER-SQLITE3 IN SERVERLESS

#### Issue: SQLite local database in serverless environment
**Severity:** MEDIUM-HIGH
**Impact:** Database connections fail, data not persisted

#### Problem:
```typescript
// /src/lib/ihale-scraper/database/sqlite-client.ts (Line 6)
import Database from 'better-sqlite3';

// Lines 19-26
const DB_PATH = path.join(process.cwd(), 'data', 'ihale-scraper.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true }); // ❌ FAILS ON VERCEL
}
global.__dbInstance = new Database(DB_PATH);
```

❌ **FAILS ON VERCEL:**
- better-sqlite3 is synchronous and requires native compilation
- Cannot write to `/var/task` (read-only)
- Database file not persisted across deployments
- Multiple concurrent Vercel functions can't access same database

#### Status: PARTIALLY MITIGATED
- Codebase has Turso integration (`turso-client.ts`, `turso-adapter.ts`)
- But falls back to SQLite if Turso not available
- Need to enforce Turso in production

#### Solutions (Already Partially Implemented):
1. ✅ Use Turso database (already in code)
2. ✅ Enforce environment variables check
3. ❌ Remove better-sqlite3 from production build
4. ❌ Configure Turso as required in Vercel

---

### 7. MEMORY & BUFFER ISSUES

#### Issue: Large buffer allocations without limits
**Severity:** MEDIUM
**Impact:** Out-of-memory errors with large files

#### Files:
- `/src/app/ihale-robotu/page.tsx` (Lines 612, 1388)
- `/tmp/yeni-analiz-3c322c3.tsx` (Line 230)
- `/src/lib/utils/file-session-storage.ts` (Line 66)

#### Code:
```typescript
// /src/lib/utils/file-session-storage.ts (Line 66)
const ab = new ArrayBuffer(byteString.length);
// No size limit check

// /src/lib/utils/smart-document-processor.ts (Line 120)
const buffer = Buffer.from(await file.arrayBuffer());
// Entire file loaded into memory
```

❌ **FAILS ON VERCEL:**
- Vercel memory limit: ~3GB total, often 512MB per function
- Processing 50MB+ files can exceed limits
- Multiple concurrent requests compound the issue

#### Solutions:
1. Stream processing instead of loading entire file
2. Add file size limits
3. Process chunks instead of whole file
4. Implement request size validation

---

## ENVIRONMENT-SPECIFIC BEHAVIORS

### Code That Works Locally But Fails on Vercel:

| Feature | Local | Vercel |
|---------|-------|--------|
| Filesystem writes (`/data/`) | ✅ Works | ❌ Fails (read-only) |
| Puppeteer browser | ✅ Works | ❌ Fails (no Chromium) |
| Bash script execution | ✅ Works | ❌ Fails (not available) |
| SQLite database | ✅ Works | ⚠️ Partial (no persistence) |
| OCR (Tesseract) | ✅ Works | ❌ Fails (not installed) |
| `process.cwd()` | ✅ Works | ⚠️ Limited (read-only) |
| `/tmp` directory | ✅ Works | ⚠️ Ephemeral (lost between calls) |
| External CLI tools | ✅ Works | ❌ Fails (not in runtime) |

---

## CONFIGURATION ISSUES

### 1. Missing Environment Variables in Vercel
```
TURSO_DATABASE_URL - ❌ Needed for production DB
TURSO_AUTH_TOKEN - ❌ Needed for production DB
IHALEBUL_USERNAME - ⚠️ For scraping
IHALEBUL_PASSWORD - ⚠️ For scraping
EKAP_USERNAME - ⚠️ For scraping
EKAP_PASSWORD - ⚠️ For scraping
MAX_OCR_PAGES - ⚠️ Not set, defaults to 999
```

### 2. Runtime Configuration
```typescript
// next.config.ts
export const runtime = "nodejs"; // ✅ Good, allows Node.js APIs

// But NOT available on Edge Runtime:
// - fs module
// - child_process
// - better-sqlite3
```

---

## RECOMMENDED FIXES (PRIORITY ORDER)

### Priority 1: CRITICAL - Cannot Deploy
1. **Remove better-sqlite3 fallback** - Force Turso in production
   - File: `/src/lib/ihale-scraper/database/sqlite-client.ts`
   - Remove lines 6, 44-86 (SQLite initialization)
   - Enforce Turso environment variables

2. **Remove Puppeteer from server-side**
   - Files: ihalebul-scraper.ts, ekap-scraper.ts, download-with-auth/route.ts
   - Switch to REST API or HTTP client only
   - Use ScraperAPI for authentication if needed

3. **Remove child_process execution**
   - Remove OCR functionality for serverless
   - Disable PDF optimization scripts
   - Remove LibreOffice/antiword dependencies

### Priority 2: HIGH - Features Won't Work
4. **Fix filesystem operations**
   - Use `/tmp` only for temporary processing
   - Implement proper cleanup
   - Store results in database, not files

5. **Reduce timeout requirements**
   - Implement background jobs for scraping
   - Use Vercel Cron + database queues
   - Break long operations into chunks

6. **Add file size limits**
   - Check `MAX_FILE_SIZE` before processing
   - Implement streaming where possible
   - Add memory monitoring

### Priority 3: MEDIUM - Optimize Reliability
7. **Environment variable validation**
   - Run checks on startup (env-guard.ts exists!)
   - Fail fast if critical vars missing
   - Log configuration state

8. **Error handling improvements**
   - Graceful degradation when features unavailable
   - Clear error messages to users
   - Fallback to simpler approaches

9. **Implement request queuing**
   - Background job processor for heavy operations
   - Database-backed job queue
   - Status tracking endpoints

---

## TESTING RECOMMENDATIONS

### 1. Test Deployment
```bash
# Simulate Vercel environment
NODE_ENV=production npm run build
npm run start

# All of these should fail gracefully or not run:
# - PDF OCR features
# - Puppeteer-based scraping
# - Filesystem write operations
# - External command execution
```

### 2. Add Vercel-Specific Tests
```typescript
// Verify read-only filesystem
if (process.env.VERCEL) {
  try {
    fs.writeFileSync('/var/task/test.txt', 'test');
    throw new Error('DANGER: Filesystem is writable!');
  } catch (e) {
    if (e.code === 'EACCES') console.log('✅ Read-only filesystem');
  }
}
```

### 3. Monitor Production
- Set up error tracking (Sentry)
- Monitor timeout errors
- Alert on critical operations failing
- Track memory usage patterns

---

## QUICK WINS (Easy Fixes)

1. **Update maxDuration values** (5 min fix)
   - Change 420s to 60s in upload/route.ts
   - Change 300s to 60s in ihale-scraper/route.ts
   - Document Vercel's actual limits

2. **Add environment variable checks** (10 min fix)
   - Make TURSO variables required for production
   - Skip SQLite initialization if Turso available
   - Use env-guard.ts pattern

3. **Disable unavailable features** (30 min fix)
   - Remove OCR from Vercel deployment
   - Disable Puppeteer-based features
   - Provide clear user feedback

4. **Add /tmp cleanup** (15 min fix)
   - Ensure temp files cleaned after use
   - Set retention limits
   - Monitor /tmp usage

---

## DEPLOYMENT CHECKLIST

- [ ] Remove better-sqlite3 or make Turso mandatory
- [ ] Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel
- [ ] Disable or replace Puppeteer features
- [ ] Update timeout values to Vercel limits
- [ ] Add file size limits to upload routes
- [ ] Test all API routes in production
- [ ] Monitor for filesystem errors
- [ ] Set up error tracking
- [ ] Document feature availability in Vercel
- [ ] Create fallback UX for unavailable features

---

## SUMMARY

**Works in Local:** Document upload → Processing → PDF OCR → Scraping → Database
**Fails in Vercel:** ❌ → ✅ Partial → ❌ → ❌ → ✅ (if configured)

**Main Blockers:**
1. Filesystem operations (blocks uploads, session management)
2. Browser automation (blocks scraping)
3. External tools (blocks OCR, conversion)
4. Timeout configuration (long operations fail)

**Status:** 
- **Development:** Fully functional
- **Production (Vercel):** 40% functional (AI analysis works, most scraping/processing fails)

