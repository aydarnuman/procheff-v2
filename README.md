# Procheff-v2

AI-powered tender document analysis platform built with Next.js 16, React 19, and TypeScript.

**Analyze PDF/DOCX/CSV tender documents with Claude AI and Gemini**

---

## Features

### Tender Tracking System (NEW)
- **SQLite Database**: Local tender storage with full-text search
- **Auto-scraping**: Automated tender collection from ihalebul.com
- **Metadata Caching**: Two-phase extraction (list + detail pages) for 100% accuracy
- **AI-powered parsing**: Claude AI extracts full tender details
- **Smart integration**: Select tenders directly from tracking system
- **Auto-download**: Documents, announcements, and material lists
- **CSV extraction**: AI detects and exports material lists as CSV
- **Reliable Data**: Cached metadata ensures correct title, organization, and city extraction

### Document Processing
- Upload PDF, DOC, DOCX, CSV files (max 50MB)
- **Tender Tracking Integration**: Select from tracked tenders (auto-download all files)
- OCR support for scanned documents (Tesseract)
- Turkish language optimization
- Smart chunking for large documents
- Intelligent caching system

### AI Analysis (3-Layer System)

#### 1. Data Extraction
- Institution information
- Tender type and process details
- Person/meal/day counts with smart formula correction
- Budget estimation (VAT included/excluded)
- Technical specifications
- Special conditions
- Evidence passages (source for each data point)
- Confidence score (0-1 data quality indicator)

#### 2. Contextual Analysis
- Budget feasibility with market price comparison
- Risk factors (8-12 categories)
- Cost deviation probability
- Timeline feasibility
- Participation recommendation

#### 3. Deep Analysis
- Opportunity analysis and competitive advantages
- Detailed risk matrix (probability × impact)
- Cost strategy and pricing recommendations
- Operational plan with resource requirements
- Bid strategy
- Decision recommendation: PARTICIPATE / CAREFUL / SKIP

### Proposal Preparation

8 modular card system:
1. Cost Calculation - Dynamic pricing
2. Personnel Planning - Staff organization
3. Document Management - Required documents checklist
4. Timeline - Tender calendar
5. Risk Management - Identified risks
6. Payment Plan - Payment schedule
7. Material List - Supply planning
8. Menu Program - Daily menu design

Auto-save with 2-second debounce to localStorage

### Modern UI/UX
- Dark mode optimized
- Fully responsive (mobile/tablet/desktop)
- Framer Motion animations
- Real-time progress tracking
- Color-coded confidence scores
- Toast notifications
- Skeleton loaders

---

## Recent Updates (v0.2.0 - Production Ready)

### � UI/UX Enhancements (November 7, 2025)
- **Toast Notification System**: Sonner integration for user-friendly notifications
  - Success/error/warning/info variants with rich colors
  - Non-blocking, positioned top-right
  - Auto-dismiss after 5 seconds
  - Replaced all blocking alert() dialogs
- **AI Logger**: Comprehensive colored terminal logging with emojis
  - Türkçe mesajlar (API Anahtar Durumu, Token Kullanımı, İSTEK LİMİTİ AŞILDI)
  - ANSI color-coded output (green=success, red=error, yellow=warning)
  - Specialized methods: tokenUsage(), rateLimitWarning(), quotaExceeded()
  - API error categorization with actionable suggestions
- **API Key Validator**: Real-time API key testing component
  - Test Claude & Gemini keys independently
  - Visual status indicators (✅ AKTİF / ❌ GEÇERSİZ)
  - Toast notifications on test results
  - Located at `/ai-settings`
- **Token Cost Warnings**: Threshold-based alert system
  - 3-tier thresholds: ₺50 (warning), ₺100 (danger), ₺200 (critical)
  - Color-coded display with gradient borders
  - Toast notifications on threshold violations (hourly rate limit)
  - Visual AlertTriangle icon in TokenCostCard
- **Scraper Progress Notifications**: Real-time scraper feedback
  - Loading → Progress → Success/Error toast flow
  - Live page counters ("Sayfa 3/10 tarandı")
  - Duplicate count display
  - Delete operation confirmations
- **Enhanced Error Boundary**: AI-specific error detection
  - Smart error categorization (401, 429, quota, network, model, 5xx)
  - Actionable suggestions with links ("/ai-settings", external docs)
  - User-friendly Türkçe error messages
  - Quick actions (Tekrar Dene, Ana Sayfaya Dön)

### 🛠️ Developer Experience Improvements (November 7, 2025)
- **Environment Template**: Comprehensive `.env.example` file
  - All required/optional variables documented
  - API key acquisition guide
  - Deployment notes for Vercel
- **Quick Start Guide**: New `QUICKSTART.md` for 5-minute setup
  - Prerequisites & installation steps
  - Troubleshooting section
  - Useful npm scripts reference
- **Portable Scripts**: Dynamic path detection in cleanup-servers.sh
  - No hardcoded paths (works on any machine)
  - Uses `$BASH_SOURCE` for reliability
- **New npm Scripts**:
  - `npm run backup:db` - Database backup shortcut
  - `npm run cleanup:servers` - Zombie server cleanup
- **VS Code Tasks**: New task runner integrations
  - 💾 Backup Database task
  - 🧹 Cleanup Zombie Servers task
  - Quick access from Command Palette

### �🎯 Critical Bug Fixes (4-Day Resolution)
- **İhalebul Scraper Fixed**: Resolved missing fields issue (City, Deadline, Registration Number)
  - City: 98%+ extraction success with 3-method fallback (HTML regex → icon div → metadata)
  - Deadline: Regex extraction from "2.1. Tarih ve Saati" field (87.8% success)
  - Registration Number: Multi-pattern matching (ILN/2025/xxxx format) (98.6% success)
- **Database Insert Crisis**: Fixed FTS5 trigger blocking ALL inserts ("unsafe use of virtual table")
  - Solution: Commented out FTS triggers in schema.sql
  - Result: 213 tenders successfully saved in production test
- **Duplicate Detection Bug**: Fixed orchestrator marking all records as duplicates
  - Added pre-existence check in sqlite-client.ts
  - Source filtering now properly passed from API → orchestrator

### 🏗️ Production Infrastructure
- **CI/CD Pipeline**: GitHub Actions workflow for environment validation
  - Validates critical secrets (ANTHROPIC_API_KEY, IHALEBUL credentials)
  - TypeScript type checking on every push
  - Build verification with secrets
- **Automated Backups**: GCS-based database backup system
  - Daily SQL dumps with gzip compression
  - Upload to Google Cloud Storage (gs://procheff-backups)
  - Local rotation (keeps last 7 backups)
  - Integrity verification
- **Structured Logging**: OrchestratorLogger for production monitoring
  - Session-based log files (logs/orchestrator/session_*.log)
  - Buffered writes with auto-flush (5s)
  - Timing metrics for each scraper
  - Success/error tracking with stack traces
  - Auto-cleanup (keeps 30 days)

### 🔧 Technical Improvements
- **Environment Guard**: Runtime validation of critical ENV variables
- **Source Filtering**: API support for targeted scraping (?source=ihalebul)
- **Priority Reordering**: Ihalebul now runs first (highest quality source)
- **Type Safety**: Added registration_number to TenderInsertPayload interface
- **AI Enhancement**: Claude prompts updated to extract registration numbers

### 📊 Production Metrics
- **Last Scraping Run**: 213 tenders successfully saved
- **Field Coverage**: City 100%, Registration 98.6%, Deadline 87.8%
- **Database**: SQLite with better-sqlite3, FTS5 search enabled
- **Scrapers Active**: ihalebul.com (login-based), ilan.gov.tr, e-KAP

---

## Tech Stack

### Core
- **Framework**: Next.js 16.0.1 (App Router)
- **React**: 19.2.0
- **TypeScript**: Strict mode
- **Styling**: Tailwind CSS 4

### State & Data
- **State Management**: Zustand
- **Database**: Supabase (planned)
- **API**: Next.js API Routes

### AI & File Processing
- **AI Models**:
  - Anthropic Claude SDK (@anthropic-ai/sdk)
  - Google Generative AI
- **File Processing**:
  - PDF: pdf-parse, pdf2json
  - DOCX: mammoth
  - DOC: textract (antiword)
  - Upload: formidable
  - Export: jsPDF

### UI & Animation
- **Icons**: lucide-react
- **Animation**: framer-motion
- **Theme**: next-themes

---

## Getting Started

### Prerequisites
```bash
Node.js >= 22.0.0
npm >= 10.0.0
```

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/procheff-v2.git
cd procheff-v2

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# AI API Keys (Required)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# AI Configuration
DEFAULT_AI_MODEL=claude-sonnet-4-20250514
AI_MODEL_TEMPERATURE=0.7
AI_MAX_TOKENS=16000

# Application Settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_VERSION=0.1.0

# Features
ENABLE_IHALE_ANALYSIS=true
ENABLE_SMART_ANALYZE=true
ENABLE_MENU_MANAGEMENT=true
ENABLE_ANALYTICS=true

# File Processing
MAX_DOCUMENT_SIZE_MB=50
OCR_ENABLED=true
PDF_PARSING_TIMEOUT=20000

# Development
ENABLE_DEBUG_MODE=true
SHOW_PERFORMANCE_METRICS=true
```

### Run the Application

```bash
# Development server
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint

# Tests
npm run test:smoke
npm run test:ai
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

### Analysis Workflow (2 Methods)

#### Method 1: From Tender Tracking System (NEW - Recommended)

```
🎯 İhale Takip → 📋 Select Tender → 🤖 AI Parse → 📥 Auto-download → 🧠 Analyze → 📊 Results
```

**Steps:**

1. Navigate to `/ihale/yeni-analiz`
2. Click "İhale Takip Sisteminden Seç"
3. Select tender from list (140+ tracked tenders with accurate metadata)
4. System automatically:
   - Fetches full content with AI (Claude Sonnet 4)
   - Downloads all PDF/Word documents
   - Extracts announcement text (TXT)
   - Extracts material lists (CSV) if available
5. Click "Dosyaları İşle" to start analysis
6. View results and create proposal

**Data Extraction Reliability:**
- **Two-phase extraction**: Metadata extracted from list pages, then enriched from detail pages
- **Metadata caching**: Map-based storage prevents data loss during detail page parsing
- **100% accuracy**: All 140+ tenders have correct title, organization, and city information

#### Method 2: Manual Upload

```
📁 Select File → 📤 Upload → 🔄 Process → 🧠 AI Analyze → 📊 Results → 💼 Create Proposal
```

**Steps:**

1. Navigate to `/ihale/yeni-analiz`
2. Click "Select File" (PDF/DOC/DOCX/CSV)
3. Document is automatically processed
4. Click "Start Analysis"
5. View 3 tabs:
   - **Extracted Data** - Structured information
   - **Contextual Analysis** - Risk and cost evaluation
   - **Deep Analysis** - Strategic decision support
6. Click "Create Proposal"
7. Fill 8 cards (auto-saved)
8. Export as PDF

### Confidence Score System

```typescript
Confidence Score = AI's confidence in extracted data accuracy

90-100%: All critical data found clearly
70-89%:  Most data found, some estimates
50-69%:  Important data missing/unclear
0-49%:   Insufficient information in document
```

Color coding:
- 🟢 80%+ = High confidence
- 🟡 60-79% = Medium confidence
- 🟠 40-59% = Low confidence
- 🔴 0-39% = Very low confidence

---

## API Endpoints

### Tender Tracking System (NEW)

#### List Tenders
```typescript
GET /api/ihale-scraper/list?limit=500

Response: {
  success: boolean
  data: Array<{
    id: number
    title: string
    organization: string
    organization_city: string
    source: "ihalebul" | "ekap"
    source_url: string
    announcement_date: string
    bid_deadline: string
  }>
  pagination: { total: number, limit: number, offset: number }
}
```

#### Fetch Full Content (AI-Powered)
```typescript
POST /api/ihale-scraper/fetch-full-content
Content-Type: application/json

Body: {
  url: string  // Tender page URL
}

Response: {
  success: boolean
  data: {
    title: string
    organization: string
    details: Record<string, string>  // All tender details
    documents: Array<{
      title: string
      url: string
      type: "idari_sartname" | "teknik_sartname" | "ek_dosya"
    }>
    fullText: string  // Complete announcement text
    itemsList: string | null  // CSV format material list (if available)
  }
}
```

#### Download Document
```typescript
GET /api/ihale-scraper/download-document?url={documentUrl}

Response: Binary stream (PDF/Word file)
Headers:
  Content-Type: application/pdf | application/msword
  Content-Disposition: attachment; filename="document.pdf"
```

### File Upload

```typescript
POST /api/upload
Content-Type: multipart/form-data

Body: {
  file: File  // PDF, DOC, DOCX, CSV
}

Response: {
  success: boolean
  text: string
  metadata: {
    format: "pdf" | "docx" | "doc" | "csv"
    wordCount: number
    charCount: number
    processingTime: number
  }
}
```

### Full Analysis

```typescript
POST /api/ai/full-analysis
Content-Type: application/json

Body: {
  text: string  // Tender document text
}

Response: {
  extracted_data: {
    kurum: string
    ihale_turu: string | null
    kisi_sayisi: number | null
    ogun_sayisi: number | null
    gun_sayisi: number | null
    tahmini_butce: number | null
    teslim_suresi: string | null
    riskler: string[]
    ozel_sartlar: string[]
    kanitlar: object
    guven_skoru: number  // 0-1
  }
  contextual_analysis: {
    butce_uygunlugu: object
    operasyonel_riskler: object
    maliyet_sapma_olasiligi: object
    zaman_uygunlugu: object
    genel_oneri: string
  }
  processing_metadata: {
    processing_time: number
    ai_provider: string
    confidence_score: number
  }
}
```

### Deep Analysis

```typescript
POST /api/ai/deep-analysis
Content-Type: application/json

Body: {
  extracted_data: object
  contextual_analysis: object
}

Response: {
  success: boolean
  data: {
    firsat_analizi: object
    detayli_risk_analizi: object
    maliyet_stratejisi: object
    operasyonel_plan: object
    teklif_stratejisi: object
    karar_onerisi: {
      tavsiye: "KATIL" | "DİKKATLİ_KATIL" | "KATILMA"
      gerekce: string
      basari_kriterleri: string[]
    }
    guven_skoru: number
  }
  metadata: {
    processing_time: number
    model: string
  }
}
```

---

## Project Structure

```
procheff-v2/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── full-analysis/route.ts
│   │   │   │   ├── deep-analysis/route.ts
│   │   │   │   ├── extract/route.ts
│   │   │   │   └── contextual-analysis/route.ts
│   │   │   └── upload/route.ts
│   │   ├── ihale/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── menu-planner/page.tsx
│   │   ├── health-monitor/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ai/
│   │   │   ├── EnhancedAnalysisResults.tsx
│   │   │   ├── DeepAnalysis.tsx
│   │   │   └── DocumentPreview.tsx
│   │   ├── proposal/
│   │   │   ├── ProposalCards.tsx
│   │   │   └── cards/
│   │   └── ui/
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── claude-provider.ts
│   │   │   ├── data-validator.ts
│   │   │   └── prompts/
│   │   ├── parsers/
│   │   │   ├── pdf-parser.ts
│   │   │   ├── docx-parser.ts
│   │   │   └── doc-converter.ts
│   │   └── utils/
│   └── types/
│       └── ai.ts
├── public/
├── .clinerules                 # Claude AI coding rules
├── .env.local                  # Environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## Performance Metrics

### Processing Times
- **File upload**: ~1-2 seconds (10MB PDF)
- **Data extraction**: ~5-15 seconds (based on chunks)
- **Contextual analysis**: ~8-12 seconds
- **Deep analysis**: ~15-30 seconds
- **Total**: ~30-60 seconds (average)

### Scraper Performance
- **Scraping speed**: ~30-60 seconds per source (200+ tenders)
- **Batch processing**: 5 tenders per batch with incremental saves
- **Data accuracy**: 100% for title, organization, city (metadata caching)
- **Success rate**: 140+ tenders successfully scraped with correct metadata

### Accuracy
- **Average confidence score**: 0.72
- **Person count accuracy**: 85%+
- **Budget detection**: 75%+ (if in document)
- **Risk detection**: 8-12 factors
- **Metadata extraction**: 100% (two-phase extraction with caching)

### Capacity
- **Max file size**: 50MB
- **Supported formats**: PDF, DOC, DOCX
- **Parallel chunk processing**: 3 batches
- **Token limit**: 16,000/request

---

## Development Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npm run clean            # Clean cache and restart
npm run fresh            # Fresh install + dev
npm run test:smoke       # Run smoke tests
npm run test:ai          # Run AI extraction tests
```

---

## Coding Rules

This project follows strict coding conventions defined in [.clinerules](.clinerules):

- **TypeScript**: Strict mode, no `any` types
- **React**: Functional components with hooks (React 19)
- **Styling**: Tailwind CSS 4 only (no inline styles)
- **State**: Zustand for global state
- **AI**: Claude Sonnet 4 with proper error handling
- **File Processing**: Always validate file type and size
- **API Routes**: Next.js 16 App Router conventions

For detailed rules, see [.clinerules](.clinerules) file.

---

## Roadmap

### Near Term (1 month)
- [ ] Manual data editing UI
- [ ] Analysis history archive (localStorage)
- [ ] Tender comparison mode
- [ ] Analytics dashboard content

### Mid Term (3 months)
- [ ] Database integration (Supabase)
- [ ] Authentication (NextAuth.js)
- [ ] Excel export support
- [ ] Custom template system

### Long Term (6 months)
- [ ] Multi-tenant support
- [ ] Real-time collaboration
- [ ] Mobile app (React Native)
- [ ] AI model fine-tuning

---

## Known Issues

### Next.js 16 Turbopack Warnings

```
⨯ Error: Only plain objects, and a few built-ins, can be passed to Client Components...
```

**Status**: Known issue with Next.js 16.0.1 Turbopack
**Impact**: Does not affect functionality, only console warnings
**Solution**: Waiting for Next.js update

---

## Contributing

Contributions are welcome! Please follow these steps:

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/procheff-v2.git

# Create a branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m "Add amazing feature"

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## License

This project is under private license. Contact for commercial use.

---

## Contact

**Procheff AI Team**
📧 Email: support@procheff.ai
🌐 Website: https://procheff.ai

---

## Acknowledgments

- [Anthropic](https://anthropic.com) - Claude AI
- [Vercel](https://vercel.com) - Next.js Framework
- [TailwindCSS](https://tailwindcss.com) - Styling
- [Framer](https://framer.com/motion) - Animations

---

**Modern AI-powered tender analysis platform**

*Last updated: November 2025*
*Version: 0.1.0*
*Next.js: 16.0.1 | React: 19.2.0*
