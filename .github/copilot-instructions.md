# Procheff-v2 AI Coding Agent Instructions

## 🎯 Project Overview

**Catering tender analysis platform** - AI-powered document processing (PDF/DOCX/CSV) for Turkish public tenders. Analyzes documents, calculates risk, and generates bid proposals.

**Tech Stack**: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, SQLite (better-sqlite3), Claude AI, Gemini AI

**4 Core Modules**:
1. **İhale Takip** - Auto-scraping tenders from 3 sources (ihalebul, ilan.gov.tr, EKAP)
2. **İhale Robotu** - Document upload & AI analysis (3-layer analysis pipeline)
3. **Menü Planlama** - Recipe management with AI suggestions (5 institution types)
4. **Fiyat Takip** - Market price tracking & supplier comparison (6 categories)
5. **Teklif Hazırlama** - Modular proposal cards (8 cards with auto-save)

---

## 🏗️ Architecture & Key Components

### 1. Database: SQLite Singleton Pattern (Critical!)

**Location**: `src/lib/ihale-scraper/database/sqlite-client.ts`

```typescript
// GLOBAL singleton - persists across Next.js hot reloads
declare global {
  var __dbInstance: Database.Database | undefined;
  var __dbSchemaInitialized: boolean | undefined;
}
```

**Why**: Prevents database re-initialization on every file save in dev mode. Always use `getDatabase()` to access DB.

**Schema**: `src/lib/ihale-scraper/database/schema.sql` (FTS5 triggers are commented out due to "unsafe use of virtual table" issue - resolved in production)

### 2. Scraper System (3 Active Sources)

**Orchestrator**: `src/lib/ihale-scraper/orchestrator.ts`
- Runs scrapers sequentially: ihalebul → ilan.gov.tr → EKAP
- **Duplicate detection**: Levenshtein similarity + organization matching
  - Algorithm: Title similarity + organization name comparison
  - Threshold: 85% similarity = duplicate
  - Pre-existence check before marking duplicates
- **AI categorization**: Claude identifies catering tenders (85%+ accuracy)
- **Session logging**: `logs/orchestrator/session_*.log`
- **Orchestration flow**:
  1. Scrape → 2. Categorize (AI) → 3. Deduplicate → 4. Save to SQLite → 5. Log metrics

**Scraper Priority Order** (configured in `src/lib/ihale-scraper/config.ts`):
1. **ihalebul** (highest quality) - Login-based, full metadata cache
2. **ilan.gov.tr** (government source) - Public tenders
3. **EKAP** - E-procurement platform

⚠️ **Note**: `ihaletakip` is configured but not implemented yet (reserved for future)

**Critical Constraint**: 
⚠️ **DO NOT manually test scrapers frequently!** Gemini API has **1500 requests/day limit** (free tier). Use cron schedule (09:00, 13:00, 18:00).

**Field Extraction Accuracy** (production metrics):
- City: 98%+ (3-method fallback: HTML regex → icon div → metadata)
- Deadline: 87.8% (regex from "2.1. Tarih ve Saati")
- Registration Number: 98.6% (multi-pattern ILN/2025/xxxx)

**Two-Phase Metadata Cache** (ihalebul only):
- Phase 1: List page scraping (title, organization, city, deadline)
- Phase 2: Detail page extraction (full content)
- **Why**: List page has 100% reliable metadata vs detail page parsing

### 3. AI Analysis Pipeline (3 Layers)

**Provider Factory**: `src/lib/ai/provider-factory.ts` - Switches between Claude/Gemini based on ENV

**Layer 1: Data Extraction** (`src/lib/ai/prompts/basic-extraction.ts`)
- Institution info, tender type, person/meal/day counts
- Budget estimation (VAT included/excluded)
- Confidence score (0-1)
- Evidence passages (source citation for each data point)
- **Critical Logic**: PERSONEL vs KİŞİ distinction
  - ⚠️ "8 personel çalıştırılacak" → NOT kisi_sayisi (worker count ≠ served people)
  - Pattern detection: "tarafından", "istihdam edilecek" → PERSONEL
  - Pattern detection: "kişiye hizmet", "öğrenciye yemek" → KİŞİ SAYISI
  - Formula validation: kisi_sayisi × ogun_sayisi × gun_sayisi
  - Example: "260,000 öğün ÷ 365 gün ÷ 3 öğün = 237 kişi"

**Layer 2: Contextual Analysis**
- Budget feasibility with market price comparison
- Risk factors (8-12 categories)
- Participation recommendation

**Layer 3: Deep Analysis**
- Opportunity analysis, risk matrix
- Cost strategy, operational plan
- Final decision: PARTICIPATE / CAREFUL / SKIP

**AI Categorization** (`src/lib/ihale-scraper/ai/`)
- **Claude Haiku** (primary): 6x faster categorization
- **Gemini** (fallback): 200x cheaper, 1500 req/day limit
- **Keyword filter**: Final fallback if both AI fail
- Detects catering tenders with 85%+ accuracy

### 4. File Processing

**Formats**: PDF (pdf-lib, pdf2json), DOCX (mammoth), CSV
**OCR**: Tesseract support (`scripts/pdf_ocr_tesseract.sh`)
**Max Size**: 50MB (configured in `next.config.ts` - serverActions.bodySizeLimit)
**Smart Chunking**: Large documents split for AI processing

### 5. Application Modules (4 Core Features)

#### **A. İhale Robotu (Document Analysis)** 📂 `/ihale-robotu`
**Purpose**: Upload tender documents, AI analysis, auto-generate proposals
**File**: `src/app/ihale-robotu/page.tsx` (2275 lines - largest page)

**Features**:
- Multi-file upload (PDF/DOCX/CSV)
- Tender selection from scraper database
- Auto-download documents from tender URLs
- 3-layer AI analysis (basic → contextual → deep)
- Material list extraction (AI detects tables)
- Proposal generation with 8 modular cards

**Flow**:
1. Select tender from `/ihale-takip` OR upload files
2. AI extracts: institution, budget, people/meals/days
3. Generate proposal cards (cost, personnel, timeline, etc.)
4. Export to PDF/Excel

#### **B. Menü Planlama (Menu Planning)** 📋 `/menu-planner`
**Purpose**: Recipe management and menu creation with AI suggestions
**Store**: `src/lib/stores/menu-store.ts`

**Features**:
- **AI Recipe Search**: Query dish name → Claude suggests recipe with ingredients/portions
- **Institution-based Menus**: 5 institution types (hastane, okul, fabrika, belediye, askeri)
- **Recipe Pool**: General pool + institution-specific recipes
- **Gramaj Editing**: Adjust ingredient quantities per serving
- **Bulk Import**: Text/file upload for multiple recipes

**Institution Types** (defined in `src/types/menu.ts`):
```typescript
type InstitutionType = "hastane" | "okul" | "fabrika" | "belediye" | "askeri";
```

**Key Pattern**:
- Recipes with empty `institutions` array = general pool
- Recipes with specific institutions = filtered view
- localStorage persistence via Zustand

#### **C. Fiyat Takip (Price Feed)** 💰 `/price-feed`
**Purpose**: Market price tracking and supplier comparison
**Store**: `src/lib/stores/price-store.ts`

**Features**:
- **Product Cards**: Track products across suppliers
- **Price Comparison**: Find cheapest supplier automatically
- **AI Price Search**: Ask "domates fiyatı" → searches market data
- **6 Categories**: sebze, et-tavuk, bakliyat, süt-peynir, temel-gıda, baharat
- **Price Levels**: cheapest, cheap, normal, expensive, very-expensive

**Data Structure** (from `src/types/price.ts`):
```typescript
interface ProductCard {
  id: string;
  category: PriceCategory;
  name: string;
}

interface PriceEntry {
  productCardId: string;
  supplier: string;
  price: number;
  unit: string;
  date: string;
}
```

**Key Pattern**:
- One ProductCard → Multiple PriceEntries (historical + multi-supplier)
- `getCheapestPriceForProduct()` returns lowest current price

#### **D. Teklif Hazırlama (Proposal System)** 📝 `/ihale/teklif-olustur`
**Purpose**: Modular proposal card system with auto-save
**Components**: `src/components/proposal/ProposalCards.tsx`
**Store**: `src/lib/stores/proposal-store.ts`

**8 Modular Cards**:
1. **Maliyet Hesaplama** - Dynamic pricing calculator
2. **Personel Planlama** - Staff organization chart
3. **Doküman Yönetimi** - Required documents checklist
4. **Zaman Çizelgesi** - Tender calendar/timeline
5. **Risk Yönetimi** - Identified risks with mitigation
6. **Ödeme Planı** - Payment schedule
7. **Malzeme Listesi** - Supply planning
8. **Menü Programı** - Daily menu design

**Auto-save Pattern**:
- localStorage persistence via Zustand
- 2-second debounce on input changes
- No manual save button needed

**Integration**:
- Pulls data from AI analysis (from `/ihale-robotu`)
- Uses menu data (from `/menu-planner`)
- Uses price data (from `/price-feed`)

---

## 🛠️ Developer Workflows

### Clean Restart
```bash
./scripts/clean-restart.sh
# OR
npm run fresh  # clean + install + dev
```

### Testing
```bash
npm run test:ai      # AI extraction test (tests/ai-extraction-test.ts)
npm run test:smoke   # Smoke test
```

### Database Backup
```bash
./scripts/backup-database.sh
# Uploads to Google Cloud Storage (gs://procheff-backups)
# Keeps last 7 local backups
```

### Build & Deploy
```bash
npm run build  # Validates ENV secrets via env-guard.ts
```

---

## 📝 Code Style Rules (Non-Negotiable)

### TypeScript
✅ **Always use strict mode** - No `any`, use `unknown` or proper types
✅ **Explicit typing** - Define interfaces for all data structures
✅ **Type guards** over type assertions
❌ **Never use** `@ts-ignore` or `// @ts-expect-error`

```typescript
// ✅ GOOD
interface AnalysisResult {
  success: boolean;
  data: TenderData;
  error?: string;
}

// ❌ BAD
const result: any = await analyze();
```

### React Components
✅ **Functional components only** (React 19)
✅ **Arrow function syntax**: `const Component = () => {}`
✅ **Named exports** (NO default exports)
✅ **TypeScript prop typing**
❌ **No class components**
❌ **No inline styles** (use Tailwind)

```typescript
// ✅ GOOD
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const Button = ({ onClick, children }: ButtonProps) => (
  <button onClick={onClick} className="px-4 py-2 bg-blue-500">
    {children}
  </button>
);

// ❌ BAD
export default function Button(props: any) {
  return <button style={{ color: "red" }}>{props.children}</button>;
}
```

### Async/Await
✅ **Always use async/await** (never `.then().catch()` chains)
✅ **Try-catch error handling**
✅ **Manage loading and error states**

```typescript
// ✅ GOOD
const analyzeDocument = async (file: File): Promise<AnalysisResult> => {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) throw new Error("Analysis failed");
    return await response.json();
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
};
```

---

## 🔒 Environment Variables

### Required
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx        # Claude AI
IHALEBUL_USERNAME=xxx                        # Scraper auth
IHALEBUL_PASSWORD=xxx                        # Scraper auth
```

### Optional
```bash
DEFAULT_AI_MODEL=claude-sonnet-4-20250514
AI_MODEL_TEMPERATURE=0.7
AI_MAX_TOKENS=16000
SCRAPER_CRON_SECRET=xxx                      # Cron job security
```

**Validation**: `src/lib/env-guard.ts` validates critical vars at runtime

---

## 📁 Key File Locations

### Types & Interfaces
- `src/types/ai.ts` - AI model interfaces (BasicExtraction, MenuExtraction, etc.)
- `src/types/menu.ts` - Menu planning types
- `src/types/price.ts` - Price feed types
- `src/types/proposal.ts` - Proposal module types

### State Management (Zustand)
- `src/lib/stores/menu-store.ts` - Recipe and menu state
- `src/lib/stores/price-store.ts` - Market price tracking
- `src/lib/stores/proposal-store.ts` - Proposal cards state
- `src/lib/stores/ihale-store.ts` - Tender listings state
- `src/lib/stores/tenders-store.ts` - Active tender selection

**Zustand Pattern**:
```typescript
// All stores use persist middleware for localStorage
export const useMenuStore = create<MenuStore>()(
  persist(
    (set, get) => ({
      // State and actions
    }),
    { name: 'menu-store' } // localStorage key
  )
);
```

### AI Prompts
- `src/lib/ai/prompts/basic-extraction.ts` - Layer 1 extraction logic
- `src/lib/ai/prompts/*.ts` - Stage-specific prompts

### API Routes
- `/api/ai/*` - AI analysis endpoints
- `/api/ihale-scraper/*` - Scraper management
  - `list` - Get tenders from SQLite
  - `stats` - Scraping statistics
  - `analyze-on-demand` - Trigger AI analysis for specific tender
  - `delete` - Remove tenders
  - `update` - Update tender data
- `/api/cron/*` - Cron jobs (protected by SCRAPER_CRON_SECRET)
  - `scrape-tenders` - Trigger orchestrator
  - `delete-tenders` - Cleanup old tenders

### Components
- `/components/ai/` - AI-specific components
- `/components/ihale/` - Tender module components
- `/components/nav/` - Sidebar, Topbar
- `/components/ui/` - Reusable UI components
- `/components/providers/` - Context providers (theme, cache, error)

### Scripts
- `scripts/clean-restart.sh` - Clean .next, node_modules cache, restart dev
- `scripts/backup-database.sh` - GCS backup + local rotation
- `scripts/pdf_ocr_tesseract.sh` - OCR for scanned PDFs
- `scripts/pdf_optimizer.sh` - Compress large PDFs

---

## 🎨 UI/UX Patterns

### Theme
- **next-themes**: Dark/light mode toggle
- **Tailwind CSS 4**: Utility-first styling
- **framer-motion**: Animations
- **lucide-react**: Icon library

### State Persistence
- **Zustand**: Global state (no Redux)
- **localStorage**: Auto-save with 2s debounce (proposal cards)

### Component Layout
```tsx
// Root layout structure
<ThemeProvider>
  <div className="flex h-screen">
    <Sidebar />
    <div className="flex-1 flex flex-col">
      <Topbar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  </div>
</ThemeProvider>
```

---

## 🚨 Critical Gotchas

### 1. SQLite FTS5 Triggers
**Issue**: Full-text search triggers caused "unsafe use of virtual table" errors
**Solution**: Triggers commented out in `schema.sql` - FTS works without them
**Impact**: 213 tenders successfully saved in production

### 2. Gemini Rate Limits
**Free Tier**: 1500 requests/day, 8 requests/minute (safe margin)
**Risk**: Manual scraper testing exhausts quota
**Solution**: Only test via scheduled cron jobs

### 3. Next.js 16 Metadata
**Issue**: `authors` field in metadata causes serialize error
**Solution**: Removed from `src/app/layout.tsx` metadata object

### 4. File Upload Size
**Config**: `next.config.ts` → `experimental.serverActions.bodySizeLimit: '30mb'`
**User-facing limit**: 50MB (documented in UI)

### 5. Notification Service
**Status**: Currently disabled (see `src/lib/ihale-scraper/notifications/notification-service.ts`)
**Why**: SQLite migration - notifications deferred to future release
**Package**: `resend` is installed but not actively used

### 6. Scraper Optimization Opportunity
**Current Behavior**: Scraper fetches ALL pages (up to 10) even if tenders are duplicates
**Issue**: Duplicate check happens AFTER full detail scraping
**Impact**: ~50% wasted bandwidth and API calls on repeat runs

**Planned Improvement** (UI-first approach):
- Add 2 buttons to UI (`/ihale-robotu`):
  1. **"Yeni İhaleler Çek"** (default) - Stop on first duplicate page
  2. **"Tüm Aktif İhaleleri Yenile"** - Full scrape (current behavior)
- Implementation: Pass `mode` parameter to `/api/ihale-scraper/test?mode=new|full`
- Benefits: User control, no code risk, flexible for different use cases

**Technical Details**:
- Extract `source_id` from list page URLs (regex: `/tender/(\d+)`)
- Check duplicates BEFORE detail scraping
- Stop pagination when entire page is duplicates
- Maintains existing duplicate detection as safety net

---

## 🔄 Recent Migration Context

**Date**: January 2025
**Change**: Supabase → SQLite migration (see `MIGRATION-SUMMARY.md`)
**Reason**: Simplified local development, reduced external dependencies
**Impact**: All database operations now use `better-sqlite3`
**Files Affected**: All `/api/ihale-scraper/*` routes, orchestrator, scrapers
**Deferred Features**: Notification system temporarily disabled (will use email/webhook in future)

---

## 🧪 Testing Strategy

### AI Extraction Tests
- Location: `tests/ai-extraction-test.ts`
- Fixtures: `tests/fixtures/ihale_test_*.txt`
- Results: `tests/results/ai-extraction-test-*.json`
- Run: `npm run test:ai`

### Smoke Tests
- Location: `tests/smoke-test.ts`
- Run: `npm run test:smoke`

---

## 📊 Production Monitoring

### Logging
- **Orchestrator**: Session-based logs (`logs/orchestrator/session_*.log`)
- **Buffered writes**: Auto-flush every 5s
- **Timing metrics**: Per-scraper performance tracking
- **Retention**: 30 days

### Database Sessions
- **Tender sessions**: `data/sessions/tender_YYYYMMDD_HHMMSS/`
- **Contains**: Scraped HTML, metadata, AI responses

---

## 🎯 When Adding Features

1. **Check types first**: `src/types/*.ts` - extend existing interfaces
2. **Follow singleton pattern**: For any global resources (DB, cache)
3. **Use Zustand for state**: Create new store in `src/lib/stores/`
4. **Add API route**: `/api/[feature]/route.ts` with proper error handling
5. **Test with fixtures**: Add test case to `tests/` directory
6. **Update ENV guard**: If new secrets required, add to `env-guard.ts`

---

## 📚 Reference Documentation

- **Project README**: `/README.md` - Feature overview, setup, tech stack
- **Scraper README**: `/src/lib/ihale-scraper/README.md` - Detailed scraper architecture
- **Migration Summary**: `/MIGRATION-SUMMARY.md` - Supabase → SQLite context
- **Cron Setup**: `/CRON_SETUP.md` - Scheduled job configuration

---

**Last Updated**: November 7, 2025
**Version**: 0.2.0 (Production Ready)
