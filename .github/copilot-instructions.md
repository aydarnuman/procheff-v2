# Procheff-v2 GitHub Copilot Instructions

## 🎯 Project Overview

**Catering tender analysis platform** - AI-powered document processing (PDF/DOCX/CSV/XLSX/ZIP) for Turkish public tenders. Analyzes documents, calculates risk, and generates bid proposals.

**Tech Stack**: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, SQLite (better-sqlite3), Claude AI, Gemini AI, Zustand

**Core Modules**:
1. **İhale Takip** - Auto-scraping tenders from 3 sources (ihalebul, ilan.gov.tr, EKAP)
2. **İhale Workspace** (`/ihale/workspace`) - Upload + Tracking dual-mode UI (NEW Nov 8, 2025)
3. **İhale Detay** (`/ihale/[id]`) - Premium analysis detail page with EnhancedAnalysisResults (FIXED Nov 8, 2025)
4. **Menü Planlama** - Recipe management with AI suggestions (5 institution types)
5. **Fiyat Takip** - Market price tracking & supplier comparison (6 categories)
6. **Teklif Hazırlama** - Modular proposal cards (8 cards with auto-save)

---

## 🏗️ Critical Architecture (UPDATED Nov 8, 2025)

### 1. Routing System (MOST IMPORTANT!)

**Next.js Dynamic Route Priority**:
- `/ihale/[id]/page.tsx` catches **ALL** `/ihale/*` URLs
- `/ihale/analysis-[id]/` was DELETED (routing conflict, redundant)
- `/ihale/[id]/page.tsx` is THE premium detail page

**Implementation**:
```typescript
// /ihale/[id]/page.tsx
export default function IhaleDetailPage() {
  const params = useParams();
  const { analysisHistory } = useIhaleStore();

  // Parse index from "analysis-0", "analysis-1", etc.
  const { ihale } = useMemo(() => {
    const idStr = params.id as string;
    const indexMatch = idStr.match(/analysis-(\d+)/);
    if (!indexMatch) return { ihale: null };

    const index = parseInt(indexMatch[1], 10);
    return { ihale: analysisHistory[index] || null };
  }, [analysisHistory, params.id]);

  if (!ihale) {
    return <NotFoundView />;
  }

  return (
    <EnhancedAnalysisResults
      analysis={ihale}
      onReturnToView={() => router.push('/ihale/workspace')}
      onNewAnalysis={() => router.push('/ihale/workspace')}
      autoStartDeepAnalysis={false}
    />
  );
}
```

### 2. Premium UI Styling (Nov 8, 2025)

**Dark Premium Buttons** (slate-800, NOT blue/orange):
```typescript
className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl
           transition-all duration-200 shadow-lg hover:shadow-slate-700/50
           border border-slate-700"
```

**Special Tab Styling** (Derin Analiz with gradient):
```typescript
className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
  isActive
    ? "bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-lg shadow-purple-500/50 scale-105"
    : "text-surface-secondary hover:text-white hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-orange-500/20"
}`}

<TrendingUp className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
<span className="font-semibold">✨ Derin Analiz</span>
```

---

## 📝 TypeScript Rules (Strict Mode)

```typescript
// ❌ NEVER use any
const data: any = await fetch();

// ✅ ALWAYS explicit types
interface AnalysisResult {
  extracted_data: ExtractedData;
  contextual_analysis: ContextualAnalysis;
}

const data: AnalysisResult = await fetch();
```

---

## ⚛️ React Component Rules (React 19)

```typescript
// ✅ GOOD - Named export with explicit types
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const Button = ({ onClick, children }: ButtonProps) => {
  return <button onClick={onClick}>{children}</button>;
};
```

**⚠️ NEVER**:
- Use class components
- Use default exports
- Use inline styles

---

## 🗄️ Database Rules (SQLite Singleton)

```typescript
// ✅ ALWAYS use getDatabase()
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

const db = getDatabase();
const tenders = db.prepare('SELECT * FROM tenders WHERE id = ?').get(id);
```

---

## 🔒 İhale Content Validation System (Nov 9, 2025)

**CRITICAL**: NEVER cache invalid/incomplete tender content. All cache layers MUST validate.

### Validation Pattern (5 Layers)

```typescript
import { validateTenderContent } from '@/lib/ihale-scraper/validators';

const validation = validateTenderContent(data, {
  minTextLength: 100,
  minDetailsCount: 3,
  requireDocuments: false,
  strict: false,
});

if (!validation.valid) {
  // Delete invalid cache entry
  delete cache[tenderId];
  return null; // Fallback to next layer
}
```

**Where to Validate**:
1. ✅ localStorage (fetchFullContent.ts)
2. ✅ SQLite DB (sqlite-client.ts)
3. ✅ Turso DB (turso-adapter.ts)
4. ✅ AI Fetch API (fetch-full-content/route.ts)
5. ✅ Frontend (ihale-robotu/page.tsx)

### False Positive Prevention

```typescript
// ✅ CORRECT - Skip login check if details exist
if (fullText && data.details && Object.keys(data.details).length < 3) {
  const loginCheck = isLoginRequired(fullText);
  if (loginCheck) {
    errors.push('İçerik login mesajı içeriyor');
  }
}

// ❌ WRONG - Always checking (causes false positives)
if (isLoginRequired(fullText)) {
  errors.push('Login required');
}
```

**Reasoning**: If `details` has 18-19 items, login was successful. "Giriş Yap" button in page menu should not trigger error.

**Auto-Cleanup**:
- Invalid cache → delete from localStorage
- Invalid DB entry → delete from database
- Fallback: localStorage → DB → AI fetch

---

## 🎨 UI/UX & Notifications

### Toast Notifications (Sonner)

```typescript
import { toast } from 'sonner';

toast.success('İşlem başarılı!');
toast.error('Hata oluştu!');
toast.promise(analyzeDocument(), {
  loading: 'Analiz ediliyor...',
  success: 'Tamamlandı!',
  error: 'Başarısız'
});
```

**⚠️ NEVER** use `alert()` or `confirm()`

### AILogger for Terminal Output

```typescript
import { AILogger } from '@/lib/utils/ai-logger';

AILogger.tokenUsage('gemini', 1234, 567, 0.05, 89);
AILogger.apiKeyStatus('claude', true, 'Key valid');
AILogger.rateLimitWarning('claude', 60);
```

**⚠️ NEVER** use `console.log()` for AI operations

---

## 🔌 AI Integration Rules

```typescript
import { AIProviderFactory } from '@/lib/ai/provider-factory';

const provider = AIProviderFactory.getProvider();
const result = await provider.extractBasicData(text);
```

**Token Limits**:
- Claude Sonnet 4: 200,000 tokens
- Gemini 2.0 Flash: 1,000,000 tokens
- Always chunk large documents

---

## 🛠️ File Processing

```typescript
import { SmartDocumentProcessor } from '@/lib/utils/smart-document-processor';

if (file.size > 50 * 1024 * 1024) {
  throw new Error('File too large (max 50MB)');
}

const { extractedText, wordCount } = 
  await SmartDocumentProcessor.processFile(file);
```

**Supported**: PDF, DOCX, TXT, JSON, CSV, XLSX, ZIP

---

## 📁 Key Files

- `/src/app/ihale/[id]/page.tsx` - **Premium detail page**
- `/src/app/ihale/workspace/page.tsx` - Upload + Tracking UI
- `/src/components/ai/EnhancedAnalysisResults.tsx` - 3-tab analysis UI
- `/src/lib/stores/ihale-store.ts` - **analysisHistory** (CRITICAL)
- `/src/lib/utils/smart-document-processor.ts` - File processing
- `/src/types/ai.ts` - **AIAnalysisResult** interface

---

## 🚨 Common Pitfalls

### Pitfall 1: Wrong Page After Analysis
**Solution**: Redirect to `/ihale/analysis-${lastIndex}` (index-based)

### Pitfall 2: analysisHistory Not Persisting
**Solution**: Check Zustand persist middleware in ihale-store.ts

### Pitfall 3: AI Rate Limits
**Solution**: Exponential backoff + MD5 caching

---

## 🎯 Quick Reference

```bash
npm run dev              # Start dev
npm run build            # Build
npm run test:ai          # AI test
docker compose up -d     # Production start
```

**Git Commit Format**:
```
feat(ui): enhance premium styling

## Değişiklikler
- Premium dark buttons
- Gradient tabs

✅ Tested

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 📋 Recent Updates

### Nov 9, 2025 - Content Validation System
✅ 5-layer validation (localStorage, SQLite, Turso, API, Frontend)
✅ False positive fixes (login menu, error codes in amounts)
✅ Auto-cleanup invalid cache
✅ 3/3 real tenders tested successfully

### Nov 8, 2025 - Routing & Premium UI
✅ Fixed dynamic routing conflict
✅ Premium dark button styling
✅ Gradient tabs for special features

---

**Version**: 0.3.0
**Last Updated**: November 9, 2025
**Major Changes**: Content validation system, cache integrity, false positive prevention
