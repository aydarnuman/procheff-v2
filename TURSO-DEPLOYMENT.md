# 🚀 Turso Migration - Production Deployment Guide

**Date**: 7 Kasım 2025  
**Status**: ✅ Ready for Production Deploy  
**Migration Type**: SQLite → Turso (Serverless Database)

---

## 📋 Pre-Deployment Checklist

### ✅ Completed Tasks

- [x] Turso client implementation (`turso-client.ts`)
- [x] Database adapter with full API compatibility (`turso-adapter.ts`)
- [x] All 25+ API routes migrated to async/await
- [x] TypeScript build successful (0 errors)
- [x] Environment variables template updated
- [x] Session module temporarily disabled (will restore later)

### 🎯 Deployment Steps

#### 1. Turso Database Setup

```bash
# Install Turso CLI (if not already installed)
brew install tursodatabase/tap/turso

# Login to Turso
turso auth login

# Create production database
turso db create procheff-production --location fra

# Get database URL
turso db show procheff-production --url

# Create authentication token
turso db tokens create procheff-production
```

#### 2. Database Schema Migration

```bash
# Apply schema to Turso database
turso db shell procheff-production < src/lib/ihale-scraper/database/schema.sql

# Verify tables created
turso db shell procheff-production "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected tables:
- `tenders`
- `organizations`
- `scraping_logs`
- `scraping_sessions`
- `tender_analyses`
- `tenders_fts` (FTS5 virtual table)

#### 3. Data Migration (Optional)

If you have existing SQLite data to migrate:

```bash
# Export from local SQLite
sqlite3 data/ihale-scraper.db ".dump tenders" > tenders.sql
sqlite3 data/ihale-scraper.db ".dump organizations" > organizations.sql

# Import to Turso
turso db shell procheff-production < tenders.sql
turso db shell procheff-production < organizations.sql
```

#### 4. Vercel Environment Variables

Add to Vercel project settings (Project > Settings > Environment Variables):

**Required:**
```bash
# AI Providers
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
GOOGLE_API_KEY=xxxxx

# Scraper Credentials
IHALEBUL_USERNAME=your_username
IHALEBUL_PASSWORD=your_password

# Turso Database (NEW)
TURSO_DATABASE_URL=libsql://procheff-production-xxx.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token_here

# Cron Security
SCRAPER_CRON_SECRET=your_random_secret_here
```

**Optional:**
```bash
DEFAULT_AI_MODEL=claude-sonnet-4-20250514
AI_MODEL_TEMPERATURE=0.7
AI_MAX_TOKENS=16000
```

#### 5. Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or use Vercel dashboard
# Git push to main branch (auto-deploy if connected)
```

---

## 🧪 Post-Deployment Testing

### 1. Health Check

```bash
# Check API health
curl https://your-domain.vercel.app/api/health

# Check scraper stats
curl https://your-domain.vercel.app/api/ihale-scraper/stats
```

### 2. Database Connection Test

```bash
# Test Turso connection
curl https://your-domain.vercel.app/api/ihale-scraper/list?limit=10
```

Expected response:
```json
{
  "success": true,
  "tenders": [...],
  "total": 213,
  "page": 1,
  "limit": 10
}
```

### 3. Scraper Test (Manual)

Visit: `https://your-domain.vercel.app/ihale-robotu`

1. Click "🟢 Yeni İhaleler Çek"
2. Check console for Turso operations
3. Verify new tenders appear in list

### 4. AI Analysis Test

1. Upload a tender document in `/ihale-robotu`
2. Click "Analiz Et"
3. Check all 3 layers complete successfully
4. Verify analysis saved to Turso (`tender_analyses` table)

---

## 📊 Monitoring & Metrics

### Turso Dashboard

Monitor at: https://turso.tech/app

**Key Metrics:**
- Database size (max 10 GB free tier)
- Total rows written
- Query latency
- Monthly usage (500M rows written/month free)

### Application Metrics

**Check `/analytics` page:**
- AI token usage
- Scraper statistics
- Error rates

---

## 🚨 Rollback Plan

If production issues occur:

### Option 1: Quick Rollback

```bash
# Revert to previous Vercel deployment
vercel rollback
```

### Option 2: Database Rollback

```bash
# Switch back to SQLite (emergency)
# In Vercel: Remove TURSO_* env vars
# System will auto-fallback to SQLite mode (if configured)
```

---

## 🔄 Future Tasks

### Session Module Restoration (Priority: Medium)

**Status**: ⚠️ Temporarily disabled during migration

**Files to Restore:**
- `src/lib/tender-session/session-manager.ts` (304 lines)
- `src/lib/tender-session/types.ts`
- `src/app/api/tender/session/*` (6 routes)

**Migration Steps:**
1. Create new `turso-session-manager.ts`
2. Convert all sync DB operations to async
3. Replace `db.prepare()` with `executeQuery()`
4. Test file upload/analysis flow
5. Re-enable session API routes

**Estimated Time**: 3-4 hours

---

## 📝 Known Issues & Limitations

### 1. FTS5 Triggers (Non-Critical)

**Issue**: Full-text search triggers cause "unsafe use of virtual table" warnings  
**Status**: Triggers commented out in `schema.sql`  
**Impact**: FTS5 still works, manual index refresh may be needed  
**Workaround**: Re-index periodically:

```sql
INSERT INTO tenders_fts(tenders_fts) VALUES('rebuild');
```

### 2. Session-Based Uploads (Temporary)

**Issue**: Session module disabled during migration  
**Status**: Will be restored in follow-up task  
**Impact**: Multi-file upload sessions not available  
**Workaround**: Use single-file analysis via `/ihale-robotu`

### 3. Gemini Rate Limits

**Warning**: Free tier = 1500 requests/day  
**Mitigation**: Use scheduled cron jobs only (3x daily)  
**Monitoring**: Check `/analytics` for token usage

---

## 🎯 Success Criteria

- [ ] Vercel deployment completes without errors
- [ ] `/api/ihale-scraper/stats` returns valid data
- [ ] Scraper can write new tenders to Turso
- [ ] AI analysis pipeline works end-to-end
- [ ] No TypeScript errors in production logs
- [ ] Database latency < 200ms (Turso dashboard)

---

## 📚 References

- **Turso Docs**: https://docs.turso.tech/
- **libSQL Client**: https://github.com/tursodatabase/libsql-client-ts
- **Project Copilot Instructions**: `.github/copilot-instructions.md`
- **Migration Summary**: `MIGRATION-SUMMARY.md`

---

**Last Updated**: 7 Kasım 2025 21:45 TST  
**Migration Lead**: AI Assistant  
**Status**: ✅ Production Ready
