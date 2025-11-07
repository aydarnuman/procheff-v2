# ✅ Turso Migration - Deployment Checklist

**Date**: 7 Kasım 2025 21:50 TST  
**Commit**: 7f5ed7e  
**Status**: Ready for Production

---

## 📋 Pre-Deployment Checklist

### Local Development ✅
- [x] TypeScript build successful (0 errors)
- [x] All API routes migrated to async/await
- [x] TenderDatabase interface compatibility maintained
- [x] Git commit created with detailed message
- [x] .env.example updated with Turso variables
- [x] TURSO-DEPLOYMENT.md guide created

### Code Quality ✅
- [x] No `db.prepare()` calls in API routes
- [x] Proper error handling in turso-adapter
- [x] TypeScript strict mode passing
- [x] Async/await pattern consistent throughout
- [x] Prepared statement caching implemented

### Documentation ✅
- [x] Deployment guide (TURSO-DEPLOYMENT.md)
- [x] Environment template (.env.example)
- [x] Git commit message with migration details
- [x] Known issues documented (session module)

---

## 🎯 Deployment Tasks

### 1. Turso Setup (DO FIRST)

```bash
# Install Turso CLI
brew install tursodatabase/tap/turso

# Login
turso auth login

# Create production database
turso db create procheff-production --location fra

# Get credentials
turso db show procheff-production --url
# Output: libsql://procheff-production-xxx.turso.io

turso db tokens create procheff-production
# Output: eyJhbGc... (auth token)
```

**Save these values!** You'll need them for Vercel.

---

### 2. Apply Database Schema

```bash
# Apply schema to Turso
turso db shell procheff-production < src/lib/ihale-scraper/database/schema.sql

# Verify tables
turso db shell procheff-production "SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected output:**
```
tenders
organizations
scraping_logs
scraping_sessions
tender_analyses
tenders_fts
```

---

### 3. Configure Vercel Environment

**Go to:** https://vercel.com/your-team/procheff-v2/settings/environment-variables

**Add these variables:**

```bash
# ⚠️ CRITICAL - Add these BEFORE deploying
TURSO_DATABASE_URL=libsql://procheff-production-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...

# Verify existing vars are set
ANTHROPIC_API_KEY=sk-ant-api03-xxx
GOOGLE_API_KEY=xxx
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx
SCRAPER_CRON_SECRET=xxx
```

**Environment scope:** Production ✅

---

### 4. Deploy to Production

**Option A: Git Push (Recommended)**
```bash
git push origin main
# Vercel will auto-deploy if Git integration enabled
```

**Option B: Manual Deploy**
```bash
vercel --prod
```

**Wait for deployment:** ~3-5 minutes

---

### 5. Post-Deployment Verification

#### Test 1: Health Check
```bash
curl https://procheff-v2.vercel.app/api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

#### Test 2: Database Connection
```bash
curl https://procheff-v2.vercel.app/api/ihale-scraper/stats
```
Expected:
```json
{
  "totalTenders": 0,  // Fresh database
  "categories": {},
  "sources": {}
}
```

#### Test 3: Scraper Write Test
1. Visit: `https://procheff-v2.vercel.app/ihale-robotu`
2. Click "🟢 Yeni İhaleler Çek"
3. Wait 2-3 minutes
4. Check if tenders appear in list

#### Test 4: AI Analysis
1. Upload a tender document
2. Click "Analiz Et"
3. Verify 3 layers complete
4. Check Turso dashboard for `tender_analyses` row

---

## 🚨 Rollback Plan (If Issues)

### Quick Rollback
```bash
# Option 1: Vercel Dashboard
# Deployments → Previous → Promote to Production

# Option 2: CLI
vercel rollback
```

### Emergency SQLite Fallback
If Turso has issues, temporarily revert:

1. **Remove Turso env vars** from Vercel
2. **Keep SQLite code** (still in codebase as fallback)
3. System will auto-use sqlite-client.ts

---

## 📊 Success Criteria

- [ ] Deployment completes without build errors
- [ ] `/api/health` responds with 200 OK
- [ ] `/api/ihale-scraper/stats` returns valid JSON
- [ ] Scraper can write tenders to Turso
- [ ] AI analysis saves to `tender_analyses` table
- [ ] Turso dashboard shows active connections
- [ ] No critical errors in Vercel logs

---

## ⏱️ Estimated Timeline

| Task | Duration | Status |
|------|----------|--------|
| Turso database setup | 5 min | ⏳ Pending |
| Schema migration | 2 min | ⏳ Pending |
| Vercel env config | 3 min | ⏳ Pending |
| Production deploy | 5 min | ⏳ Pending |
| Post-deploy testing | 10 min | ⏳ Pending |
| **TOTAL** | **~25 min** | |

---

## 🔔 Known Limitations

### 1. Session Upload Feature ⚠️
**Status:** Temporarily disabled  
**Impact:** Multi-file session uploads not available  
**Workaround:** Use single-file upload in `/ihale-robotu`  
**ETA for restore:** Next sprint (3-4 hours work)

### 2. FTS5 Triggers
**Status:** Commented out in schema  
**Impact:** Minimal - FTS5 still works  
**Workaround:** Periodic manual reindex if needed

### 3. Initial Empty Database
**Status:** Fresh Turso database has no data  
**Impact:** Scraper needs to run 1-2 times to populate  
**Timeline:** First scrape completes in ~10 minutes

---

## 📚 Next Steps (After Deployment)

1. **Monitor Turso Dashboard** (first 24 hours)
   - Check query latency < 200ms
   - Verify row writes increasing
   - Monitor storage usage

2. **Schedule Scraper Cron** (Vercel)
   - Add cron triggers: 09:00, 13:00, 18:00 TST
   - Use `/api/cron/scrape-tenders` endpoint
   - Secure with `SCRAPER_CRON_SECRET`

3. **Restore Session Module** (follow-up task)
   - Migrate `session-manager.ts` to async
   - Re-enable 6 session API routes
   - Test multi-file upload flow

4. **Performance Optimization**
   - Add indexes if queries slow
   - Monitor Gemini API quota (1500/day limit)
   - Review Turso usage patterns

---

## 📞 Support Resources

- **Turso Docs:** https://docs.turso.tech/
- **Vercel Logs:** https://vercel.com/your-team/procheff-v2/logs
- **Project Issues:** GitHub Issues tab
- **AI Assistant:** Available for troubleshooting

---

**Ready to deploy?** ✅  
**Command:** `git push origin main` or `vercel --prod`

---

**Last Updated:** 7 Kasım 2025 21:50 TST  
**Checklist Version:** 1.0  
**Migration Lead:** AI Assistant + Developer
