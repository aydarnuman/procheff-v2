# Procheff-v2

AI-powered tender document analysis platform built with Next.js 16, React 19, and TypeScript.

**Analyze PDF/DOCX/CSV tender documents with Claude AI and Gemini**

---

## Features

### Document Processing
- Upload PDF, DOC, DOCX files (max 50MB)
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

### Analysis Workflow

```
📁 Select File → 📤 Upload → 🔄 Process → 🧠 AI Analyze → 📊 Results → 💼 Create Proposal
```

**Steps:**

1. Navigate to `/ihale`
2. Click "Select File" (PDF/DOC/DOCX)
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

### File Upload

```typescript
POST /api/upload
Content-Type: multipart/form-data

Body: {
  file: File  // PDF, DOC, DOCX
}

Response: {
  success: boolean
  text: string
  metadata: {
    format: "pdf" | "docx" | "doc"
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

### Accuracy
- **Average confidence score**: 0.72
- **Person count accuracy**: 85%+
- **Budget detection**: 75%+ (if in document)
- **Risk detection**: 8-12 factors

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
