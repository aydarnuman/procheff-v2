# Quick Fix Checklist for Vercel Deployment

## Immediate Actions (Before Deploy)

### 1. Database - FIX IMMEDIATELY
- [ ] Set `TURSO_DATABASE_URL` in Vercel environment variables
- [ ] Set `TURSO_AUTH_TOKEN` in Vercel environment variables
- [ ] Verify in `/src/lib/ihale-scraper/database/turso-client.ts` can connect
- [ ] Test: `curl https://your-vercel-url.com/api/health`

### 2. Timeouts - REDUCE NOW
```bash
# Files to update:
# /src/app/api/upload/route.ts
# Change: export const maxDuration = 420;
# To:     export const maxDuration = 60;

# /src/app/api/ihale-scraper/route.ts
# Change: export const maxDuration = 300;
# To:     export const maxDuration = 60;

# /src/app/api/ihale-scraper/download-with-auth/route.ts
# Change: export const maxDuration = 120;
# To:     export const maxDuration = 60;
```

### 3. Disable Unavailable Features - QUICK WIN
```bash
# Option A: Add feature flag (RECOMMENDED)
# In relevant API routes:
if (process.env.VERCEL) {
  return NextResponse.json({
    success: false,
    error: 'This feature is not available on Vercel',
    message: 'Please use local deployment for OCR/scraping features'
  }, { status: 501 });
}

# Option B: Simply remove these files from routes
# - OCR endpoints
# - Puppeteer-based scraping
# - DOC conversion endpoints
```

### 4. Remove SQLite Fallback - CRITICAL
**File:** `/src/lib/ihale-scraper/database/sqlite-client.ts`

```typescript
// REMOVE or COMMENT OUT these lines:
// Line 6:  import Database from 'better-sqlite3';
// Lines 44-86: The entire SQLite initialization block

// KEEP ONLY Turso:
export function getDatabase(): Database.Database {
  if (!global.__tursoClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    if (!url || !authToken) {
      throw new Error(
        'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set'
      );
    }
    
    // Use Turso instead of SQLite
    global.__tursoClient = getTursoClient();
  }
  
  return global.__tursoClient;
}
```

---

## Testing Before Deploy

### 1. Build Test
```bash
npm run build

# Check for errors related to:
# - fs module (filesystem)
# - child_process (external commands)
# - puppeteer (browser automation)
# - better-sqlite3 (local database)
```

### 2. Production Simulation
```bash
NODE_ENV=production npm run start

# Test these endpoints:
# ✅ GET /api/health - Should work
# ✅ POST /api/ai/quick-detect-type - Should work
# ❌ POST /api/upload - Will fail (use feature flag)
# ❌ POST /api/ihale-scraper - Will fail (use feature flag)
# ❌ POST /api/ihale-scraper/download-with-auth - Will fail
```

### 3. Vercel Preview Deploy
```bash
vercel --prod  # Create preview deployment first

# Then test these endpoints on preview URL:
# GET {preview-url}/api/health
# POST {preview-url}/api/ai/quick-detect-type
# POST {preview-url}/api/upload  # Expect graceful error
```

---

## Specific File Fixes

### Fix 1: `/src/app/api/upload/route.ts`
```typescript
// Line 6: Change timeout
- export const maxDuration = 420;
+ export const maxDuration = 60;

// Add feature check at top of POST:
if (process.env.VERCEL) {
  return NextResponse.json({
    success: false,
    error: 'File session uploads not available on production'
  }, { status: 501 });
}
```

### Fix 2: `/src/app/api/ihale-scraper/route.ts`
```typescript
// Line 5: Change timeout
- export const maxDuration = 300;
+ export const maxDuration = 60;

// Add early return after line 37:
if (process.env.VERCEL) {
  return NextResponse.json({
    success: false,
    message: 'Scraping not available on Vercel. Use local deployment.'
  }, { status: 501 });
}
```

### Fix 3: `/src/app/api/ihale-scraper/download-with-auth/route.ts`
```typescript
// Line 7: Change timeout
- export const maxDuration = 120;
+ export const maxDuration = 60;

// Add at start of POST function:
if (process.env.VERCEL) {
  return NextResponse.json({
    success: false,
    error: 'Authenticated downloads not available on Vercel'
  }, { status: 501 });
}
```

### Fix 4: `/src/lib/utils/smart-document-processor.ts`
```typescript
// At top of extractText method, add:
if (process.env.VERCEL) {
  // Skip OCR, use basic text extraction only
  // Return early with limited functionality
}

// OR: Comment out OCR functions:
// private static async extractTextWithTesseractOCR(...) { }

// OR: Make OCR return error
if (fullText.trim().length < 100) {
  return {
    success: false,
    error: 'PDF text extraction not available on Vercel'
  };
}
```

### Fix 5: `/src/lib/ihale-scraper/database/sqlite-client.ts`
```typescript
// OPTION 1: Remove SQLite entirely
// Delete or comment out:
// - Line 6: import Database from 'better-sqlite3'
// - Lines 41-81: entire getDatabase() function

// OPTION 2: Make Turso mandatory
// Change line 24-26:
if (!url || !authToken) {
  // Don't fallback to SQLite
  throw new Error(
    'Production requires TURSO. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN'
  );
}
// Remove all fs operations below
```

---

## Environment Variables to Set in Vercel

Go to: https://vercel.com/[project]/settings/environment-variables

```
ANTHROPIC_API_KEY = [your-key]
GEMINI_API_KEY = [your-key]
TURSO_DATABASE_URL = [your-turso-url]
TURSO_AUTH_TOKEN = [your-turso-token]
NODE_ENV = production
VERCEL = true (automatically set by Vercel)
```

DO NOT SET (or Vercel will use SQLite):
```
❌ Don't set IHALEBUL_USERNAME
❌ Don't set IHALEBUL_PASSWORD
❌ Don't set EKAP_USERNAME
❌ Don't set EKAP_PASSWORD
```

---

## Monitoring After Deploy

### Check Logs
```bash
# Real-time logs
vercel logs --follow

# Check for:
# ❌ "ERR_MODULE_NOT_FOUND" - Missing dependencies
# ❌ "EACCES" - Filesystem permission errors
# ❌ "ENOENT" - Missing files
# ❌ "Timeout" - Operations taking too long
# ✅ "TURSO" - Database connections working
```

### Set Up Alerts
- [ ] Sentry error tracking
- [ ] Vercel analytics
- [ ] Monitor timeout errors
- [ ] Alert on API 500 errors

---

## Rollback Plan

If production breaks:

```bash
# 1. Revert to last working commit
git revert HEAD
git push

# 2. Or deploy from specific commit
vercel --build-env NODE_ENV=production

# 3. Check what broke
vercel logs

# 4. Fix locally
# - Disable feature
# - Reduce timeout
# - Fix environment
```

---

## Success Criteria

Your deployment is successful if:

- [ ] App loads on Vercel without 500 errors
- [ ] `/api/health` returns 200
- [ ] AI analysis endpoints work (`/api/ai/*`)
- [ ] Database queries work (if Turso configured)
- [ ] Unavailable features return 501 with clear message
- [ ] No "ERR_MODULE_NOT_FOUND" errors
- [ ] No "EACCES" permission errors
- [ ] Timeout errors don't occur on quick operations

---

## Time Estimates

- Just disable features: **15 minutes**
- Add feature flags: **30 minutes**
- Full proper fix: **2-3 hours**
- Testing everything: **1 hour**

---

## Support

If you need help:
1. Check full analysis: `PRODUCTION_ISSUES_ANALYSIS.md`
2. See summary: `PRODUCTION_ISSUES_SUMMARY.md`
3. Review affected files listed above
4. Test locally first before deploying

