# 🔄 İhale Robotu Migration Guide

## Phase 1: useState → Zustand Migration

### Step-by-Step Implementation

---

## STEP 1: Import New Store (5 dakika)

```typescript
// src/app/ihale-robotu/page.tsx

// ❌ KALDIR
import { useState, useEffect, useCallback, Suspense } from 'react';

// ✅ EKLE
import { useState, useEffect, useCallback, Suspense } from 'react';
import { 
  useIhaleRobotuStore, 
  selectFilteredTenders,
  selectPaginatedDocuments 
} from '@/lib/stores/ihale-robotu-store';
```

---

## STEP 2: Replace useState with Zustand (1 saat)

### 2.1. UI State

```typescript
// ❌ ÖNCE (30+ satır)
const [loading, setLoading] = useState(true);
const [scraping, setScraping] = useState(false);
const [deleting, setDeleting] = useState(false);
const [cleaning, setCleaning] = useState(false);
const [batchFixing, setBatchFixing] = useState(false);
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [loadingContent, setLoadingContent] = useState(false);
const [documentsExpanded, setDocumentsExpanded] = useState(true);
const [showPreviewModal, setShowPreviewModal] = useState(false);
const [showZipContents, setShowZipContents] = useState(false);
const [isScrapingActive, setIsScrapingActive] = useState(false);

// ✅ SONRA (1 satır)
const { ui, setUI } = useIhaleRobotuStore();
```

**Usage Update:**
```typescript
// ❌ ÖNCE
setLoading(true);
setScraping(true);

// ✅ SONRA (Bulk update - tek re-render)
setUI({ loading: true, scraping: true });
```

---

### 2.2. Data State

```typescript
// ❌ ÖNCE
const [tenders, setTenders] = useState<Tender[]>([]);
const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
const [fullContent, setFullContent] = useState<any | null>(null);
const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);
const [preparedDocuments, setPreparedDocuments] = useState<any[]>([]);
const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
const [zipFileInfo, setZipFileInfo] = useState<...>(null);

// ✅ SONRA
const { data, setData, setTenders, setSelectedTender } = useIhaleRobotuStore();
```

**Usage Update:**
```typescript
// ❌ ÖNCE
setTenders(result.tenders);
setSelectedTender(tender);

// ✅ SONRA
setTenders(result.tenders);
setSelectedTender(tender);
// Aynı API, internal olarak Zustand
```

---

### 2.3. Filter & Sort State

```typescript
// ❌ ÖNCE
const [sortField, setSortField] = useState<SortField>('deadline_date');
const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
const [searchQuery, setSearchQuery] = useState('');
const [filterStatus, setFilterStatus] = useState<'all' | ...>('all');

// ✅ SONRA
const { filters, setFilters } = useIhaleRobotuStore();
```

**Usage Update:**
```typescript
// ❌ ÖNCE
setSortField('title');
setSortOrder('desc');

// ✅ SONRA (Bulk update)
setFilters({ sortField: 'title', sortOrder: 'desc' });
```

---

### 2.4. Progress State

```typescript
// ❌ ÖNCE
const [downloadProgress, setDownloadProgress] = useState<number>(0);
const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
const [scrapingProgress, setScrapingProgress] = useState<any>(null);
const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
const [elapsedTime, setElapsedTime] = useState<number>(0);

// ✅ SONRA
const { progress, setProgress, startLoading, stopLoading } = useIhaleRobotuStore();
```

**Usage Update:**
```typescript
// ❌ ÖNCE
setLoadingStartTime(Date.now());
// ... timer useEffect

// ✅ SONRA
startLoading(); // Otomatik timer başlatır
```

---

### 2.5. User Preferences (localStorage)

```typescript
// ❌ ÖNCE (useState + useEffect sync)
const [favorites, setFavorites] = useState<Set<string>>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ihale-favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  }
  return new Set();
});

useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ihale-favorites', JSON.stringify(Array.from(favorites)));
  }
}, [favorites]);

// ✅ SONRA (Zustand persist - otomatik)
const { toggleFavorite, isFavorite } = useIhaleRobotuStore();
```

**Usage Update:**
```typescript
// ❌ ÖNCE
const toggleFavorite = (id: string) => {
  setFavorites(prev => {
    const newSet = new Set(prev);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return newSet;
  });
};

// ✅ SONRA
toggleFavorite(tenderId); // Zustand action - otomatik persist
```

---

### 2.6. Content Cache

```typescript
// ❌ ÖNCE (useState + useEffect + QuotaExceededError handling)
const [contentCache, setContentCache] = useState<Record<string, any>>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ihale-content-cache');
    return saved ? JSON.parse(saved) : {};
  }
  return {};
});

useEffect(() => {
  if (typeof window !== 'undefined' && Object.keys(contentCache).length > 0) {
    try {
      localStorage.setItem('ihale-content-cache', JSON.stringify(contentCache));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        const keys = Object.keys(contentCache);
        const oldestKey = keys[0];
        const newCache = { ...contentCache };
        delete newCache[oldestKey];
        setContentCache(newCache);
      }
    }
  }
}, [contentCache]);

// ✅ SONRA
const { setCachedContent, getCachedContent, clearExpiredCache } = useIhaleRobotuStore();
```

**Usage Update:**
```typescript
// ❌ ÖNCE
setContentCache(prev => ({ ...prev, [tenderId]: fullContent }));

// ✅ SONRA
setCachedContent(tenderId, {
  fullText: fullContent.fullText,
  documents: fullContent.documents,
  metadata: fullContent.metadata,
});
// TTL + LRU eviction otomatik
```

---

## STEP 3: Remove useEffect Hooks (30 dakika)

### 3.1. Remove localStorage Sync Effects

```typescript
// ❌ KALDIR (Zustand persist otomatik yapıyor)
useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ihale-favorites', JSON.stringify(Array.from(favorites)));
  }
}, [favorites]);

useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ihale-notifications', JSON.stringify(Array.from(notifications)));
  }
}, [notifications]);

useEffect(() => {
  if (typeof window !== 'undefined' && Object.keys(contentCache).length > 0) {
    try {
      localStorage.setItem('ihale-content-cache', JSON.stringify(contentCache));
    } catch (e: any) {
      // ...
    }
  }
}, [contentCache]);
```

---

### 3.2. Optimize Timer useEffect

```typescript
// ❌ ÖNCE (Her 2 saniyede re-render)
useEffect(() => {
  let interval: NodeJS.Timeout | null = null;
  
  if (loadingStartTime) {
    interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
      setElapsedTime(elapsed);
    }, 2000);
  } else {
    setElapsedTime(0);
  }
  
  return () => {
    if (interval) clearInterval(interval);
  };
}, [loadingStartTime]);

// ✅ SONRA (Store içinde, UI'dan ayrı)
// Zustand store'da timer logic (optional - sadece gerekirse göster)
```

---

## STEP 4: Use Selectors for Computed Values (15 dakika)

```typescript
// ❌ ÖNCE (Her render'da yeniden hesaplama)
const filteredTenders = tenders
  .filter(t => {
    if (searchQuery) {
      return t.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  })
  .filter(t => {
    if (filterStatus === 'favorites') {
      return favorites.has(t.id);
    }
    return true;
  })
  .sort((a, b) => {
    // ...
  });

// ✅ SONRA (Memoized selector)
const filteredTenders = useIhaleRobotuStore(selectFilteredTenders);
```

---

## STEP 5: Update Function Calls (1 saat)

### Example: fetchTenders

```typescript
// ❌ ÖNCE
const fetchTenders = async () => {
  setLoading(true);
  try {
    const response = await fetch('/api/ihale-scraper/list');
    const result = await response.json();
    setTenders(result.tenders);
  } catch (error) {
    console.error('❌ Fetch error:', error);
    toast.error('İhaleler yüklenemedi');
  } finally {
    setLoading(false);
  }
};

// ✅ SONRA
const fetchTenders = async () => {
  setUI({ loading: true });
  try {
    const response = await fetch('/api/ihale-scraper/list');
    const result = await response.json();
    setTenders(result.tenders);
  } catch (error) {
    console.error('❌ Fetch error:', error);
    toast.error('İhaleler yüklenemedi');
  } finally {
    setUI({ loading: false });
  }
};
```

### Example: handleSelectTender

```typescript
// ❌ ÖNCE
const handleSelectTender = async (tender: Tender) => {
  setSelectedTender(tender);
  setLoadingContent(true);
  
  // Check cache
  if (contentCache[tender.id]) {
    setFullContent(contentCache[tender.id]);
    setLoadingContent(false);
    return;
  }
  
  // ... fetch logic
};

// ✅ SONRA
const handleSelectTender = async (tender: Tender) => {
  setSelectedTender(tender);
  setUI({ loadingContent: true });
  
  // Check cache
  const cached = getCachedContent(tender.id);
  if (cached) {
    setData({ fullContent: cached });
    setUI({ loadingContent: false });
    return;
  }
  
  // ... fetch logic
};
```

---

## STEP 6: Testing (1 saat)

### 6.1. Unit Test Store

```typescript
// tests/stores/ihale-robotu-store.test.ts
import { renderHook, act } from '@testing-library/react';
import { useIhaleRobotuStore } from '@/lib/stores/ihale-robotu-store';

describe('IhaleRobotuStore', () => {
  beforeEach(() => {
    // Reset store
    const { result } = renderHook(() => useIhaleRobotuStore());
    act(() => {
      result.current.reset();
    });
  });

  it('should toggle favorite', () => {
    const { result } = renderHook(() => useIhaleRobotuStore());
    
    act(() => {
      result.current.toggleFavorite('tender-1');
    });
    
    expect(result.current.isFavorite('tender-1')).toBe(true);
    
    act(() => {
      result.current.toggleFavorite('tender-1');
    });
    
    expect(result.current.isFavorite('tender-1')).toBe(false);
  });

  it('should set cached content with TTL', () => {
    const { result } = renderHook(() => useIhaleRobotuStore());
    
    act(() => {
      result.current.setCachedContent('tender-1', {
        fullText: 'test',
        documents: [],
        metadata: {},
      });
    });
    
    const cached = result.current.getCachedContent('tender-1');
    expect(cached).not.toBeNull();
    expect(cached!.fullText).toBe('test');
    expect(cached!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should bulk update UI state', () => {
    const { result } = renderHook(() => useIhaleRobotuStore());
    
    act(() => {
      result.current.setUI({
        loading: true,
        scraping: true,
        deleting: false,
      });
    });
    
    expect(result.current.ui.loading).toBe(true);
    expect(result.current.ui.scraping).toBe(true);
    expect(result.current.ui.deleting).toBe(false);
  });
});
```

### 6.2. Integration Test Component

```typescript
// tests/components/ihale-robotu.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IhaleRobotuPage from '@/app/ihale-robotu/page';

describe('IhaleRobotuPage', () => {
  it('should fetch and display tenders', async () => {
    render(<IhaleRobotuPage />);
    
    // Wait for fetch
    await waitFor(() => {
      expect(screen.getByText(/toplam ihale/i)).toBeInTheDocument();
    });
    
    // Check if tenders loaded
    const tenders = screen.getAllByRole('row');
    expect(tenders.length).toBeGreaterThan(0);
  });

  it('should filter tenders by search', async () => {
    render(<IhaleRobotuPage />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ara/i)).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/ara/i);
    fireEvent.change(searchInput, { target: { value: 'yemek' } });
    
    // Check filtered results
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      rows.forEach(row => {
        expect(row.textContent?.toLowerCase()).toContain('yemek');
      });
    });
  });
});
```

---

## STEP 7: Performance Validation (30 dakika)

### Before/After Metrics

```typescript
// tests/performance/ihale-robotu.perf.ts
import { renderHook } from '@testing-library/react';
import { useIhaleRobotuStore } from '@/lib/stores/ihale-robotu-store';

describe('Performance Tests', () => {
  it('should update state in <10ms', () => {
    const { result } = renderHook(() => useIhaleRobotuStore());
    
    const start = performance.now();
    result.current.setUI({ loading: true });
    const end = performance.now();
    
    expect(end - start).toBeLessThan(10); // <10ms
  });

  it('should handle 1000 favorites without lag', () => {
    const { result } = renderHook(() => useIhaleRobotuStore());
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      result.current.toggleFavorite(`tender-${i}`);
    }
    const end = performance.now();
    
    expect(end - start).toBeLessThan(1000); // <1s for 1000 ops
  });
});
```

---

## 🎯 MIGRATION CHECKLIST

- [ ] **Step 1:** Import new store (5 min)
- [ ] **Step 2:** Replace useState hooks (1 hour)
  - [ ] UI state
  - [ ] Data state
  - [ ] Filters
  - [ ] Progress
  - [ ] Preferences
  - [ ] Content cache
- [ ] **Step 3:** Remove useEffect hooks (30 min)
- [ ] **Step 4:** Use selectors (15 min)
- [ ] **Step 5:** Update function calls (1 hour)
- [ ] **Step 6:** Write tests (1 hour)
- [ ] **Step 7:** Performance validation (30 min)

**Total Time:** ~4-5 hours

---

## 🚨 ROLLBACK PLAN

Eğer sorun olursa:

1. Git revert
```bash
git revert HEAD
```

2. Feature flag ile gradual rollout
```typescript
const USE_NEW_STORE = process.env.NEXT_PUBLIC_USE_NEW_STORE === 'true';

function IhaleRobotuPage() {
  if (USE_NEW_STORE) {
    return <IhaleRobotuPageNew />;
  }
  return <IhaleRobotuPageOld />;
}
```

---

## 📊 EXPECTED RESULTS

### Before (useState)
- **Re-renders/action:** ~50+
- **State updates:** 3-5ms each
- **Total update time:** 150-250ms
- **Memory:** ~50MB (state duplicates)

### After (Zustand)
- **Re-renders/action:** ~5-10
- **State updates:** <1ms (bulk)
- **Total update time:** <10ms
- **Memory:** ~10MB (single source)

**Improvement:** 🚀 **80-90% faster, 80% less memory**

---

**Next Phase:** Component splitting (Week 2)
