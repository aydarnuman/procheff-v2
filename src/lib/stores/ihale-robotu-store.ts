// src/lib/stores/ihale-robotu-store.ts
/**
 * İhale Robotu - Unified State Management
 * 
 * PROBLEM: 38+ useState hook, 3 storage system, 9 useEffect
 * SOLUTION: Tek Zustand store, localStorage persist, bulk updates
 * 
 * Migration: Phase 1 - Immediate fix for state chaos
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage, isIDBAvailable } from '@/lib/storage/idb-adapter';

// ========================================
// TYPES
// ========================================

export interface Tender {
  id: string;
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  organization: string;
  organization_city: string | null;
  budget: number | null;
  currency: string;
  announcement_date: string | null;
  deadline_date: string | null;
  tender_date: string | null;
  tender_type: string | null;
  procurement_type: string | null;
  category: string | null;
  is_catering: boolean;
  catering_confidence: number;
  specification_url?: string | null;
  announcement_text?: string | null;
  ai_analyzed: boolean;
  ai_analyzed_at: string | null;
  registration_number?: string | null;
  raw_json?: any;
  total_items?: number;
  total_meal_quantity?: number;
  estimated_budget_from_items?: number;
  first_seen_at: string;
  last_updated_at: string;
}

export type SortField = 
  | 'title' 
  | 'organization' 
  | 'organization_city' 
  | 'budget' 
  | 'announcement_date' 
  | 'tender_date' 
  | 'deadline_date' 
  | 'tender_type' 
  | 'procurement_type';

export type SortOrder = 'asc' | 'desc';
export type FilterStatus = 'all' | 'active' | 'upcoming' | 'closed' | 'favorites';

export interface CachedContent {
  fullText: string;
  documents: any[];
  metadata: any;
  timestamp: number;
  expiresAt: number; // TTL için
}

export interface PreparedDocument {
  title: string;
  url: string;
  type: string;
  size: number;
  blob?: Blob;
  file?: File;
}

// ========================================
// STORE INTERFACE
// ========================================

export interface IhaleRobotuStore {
  // ========== UI STATE ==========
  ui: {
    loading: boolean;
    scraping: boolean;
    isScrapingActive: boolean;
    deleting: boolean;
    cleaning: boolean;
    batchFixing: boolean;
    isAnalyzing: boolean;
    loadingContent: boolean;
    documentsExpanded: boolean;
    showPreviewModal: boolean;
    showZipContents: boolean;
  };

  // ========== PAGINATION ==========
  pagination: {
    docPage: number;
    itemsPerPage: number;
  };

  // ========== FILTERING & SORTING ==========
  filters: {
    searchQuery: string;
    sortField: SortField;
    sortOrder: SortOrder;
    filterStatus: FilterStatus;
    selectedCity?: string;
    startDate?: string;
    endDate?: string;
  };

  // ========== DATA ==========
  data: {
    tenders: Tender[];
    selectedTender: Tender | null;
    fullContent: any | null;
    aiAnalysisResult: any | null;
    preparedDocuments: PreparedDocument[];
    selectedDocuments: string[];
    zipFileInfo: {
      fileName: string;
      size: number;
      extractedFiles?: string[];
    } | null;
  };

  // ========== PROGRESS ==========
  progress: {
    download: number;
    batchProgress: { current: number; total: number };
    scrapingProgress: any | null;
    elapsedTime: number;
    loadingStartTime: number | null;
  };

  // ========== USER PREFERENCES (PERSISTED) ==========
  preferences: {
    favorites: string[]; // Set → Array (JSON serializable)
    notifications: string[];
  };

  // ========== CONTENT CACHE (PERSISTED) ==========
  contentCache: Record<string, CachedContent>;

  // ========== COPIED STATE (TEMPORARY) ==========
  copiedId: string | null;
  analyzingId: string | null;

  // ========================================
  // ACTIONS - Bulk Updates (Single Re-render)
  // ========================================

  // UI Actions
  setUI: (updates: Partial<IhaleRobotuStore['ui']>) => void;
  resetUI: () => void;

  // Pagination Actions
  setDocPage: (page: number) => void;
  nextDocPage: () => void;
  prevDocPage: () => void;

  // Filter Actions
  setFilters: (updates: Partial<IhaleRobotuStore['filters']>) => void;
  resetFilters: () => void;

  // Data Actions
  setData: (updates: Partial<IhaleRobotuStore['data']>) => void;
  setTenders: (tenders: Tender[]) => void;
  setSelectedTender: (tender: Tender | null) => void;
  clearSelectedTender: () => void;
  addPreparedDocument: (doc: PreparedDocument) => void;
  removePreparedDocument: (title: string) => void;
  clearPreparedDocuments: () => void;

  // Progress Actions
  setProgress: (updates: Partial<IhaleRobotuStore['progress']>) => void;
  startLoading: () => void;
  stopLoading: () => void;

  // Favorites & Notifications
  toggleFavorite: (id: string) => void;
  toggleNotification: (id: string) => void;
  isFavorite: (id: string) => boolean;
  hasNotification: (id: string) => boolean;

  // Content Cache Actions
  setCachedContent: (tenderId: string, content: Omit<CachedContent, 'timestamp' | 'expiresAt'>) => void;
  getCachedContent: (tenderId: string) => CachedContent | null;
  clearExpiredCache: () => void;
  clearAllCache: () => void;

  // Temporary State
  setCopiedId: (id: string | null) => void;
  setAnalyzingId: (id: string | null) => void;

  // Reset All
  reset: () => void;
}

// ========================================
// INITIAL STATE
// ========================================

const initialUIState: IhaleRobotuStore['ui'] = {
  loading: false,
  scraping: false,
  isScrapingActive: false,
  deleting: false,
  cleaning: false,
  batchFixing: false,
  isAnalyzing: false,
  loadingContent: false,
  documentsExpanded: true,
  showPreviewModal: false,
  showZipContents: false,
};

const initialDataState: IhaleRobotuStore['data'] = {
  tenders: [],
  selectedTender: null,
  fullContent: null,
  aiAnalysisResult: null,
  preparedDocuments: [],
  selectedDocuments: [],
  zipFileInfo: null,
};

const initialProgressState: IhaleRobotuStore['progress'] = {
  download: 0,
  batchProgress: { current: 0, total: 0 },
  scrapingProgress: null,
  elapsedTime: 0,
  loadingStartTime: null,
};

// ========================================
// STORE IMPLEMENTATION
// ========================================

export const useIhaleRobotuStore = create<IhaleRobotuStore>()(
  persist(
    (set, get) => ({
      // ========== STATE ==========
      ui: initialUIState,
      pagination: { docPage: 1, itemsPerPage: 10 },
      filters: {
        searchQuery: '',
        sortField: 'deadline_date',
        sortOrder: 'asc',
        filterStatus: 'all',
      },
      data: initialDataState,
      progress: initialProgressState,
      preferences: {
        favorites: [],
        notifications: [],
      },
      contentCache: {},
      copiedId: null,
      analyzingId: null,

      // ========== ACTIONS ==========

      // UI Actions
      setUI: (updates) => set((state) => ({
        ui: { ...state.ui, ...updates }
      })),

      resetUI: () => set({ ui: initialUIState }),

      // Pagination Actions
      setDocPage: (page) => set((state) => ({
        pagination: { ...state.pagination, docPage: page }
      })),

      nextDocPage: () => set((state) => ({
        pagination: { ...state.pagination, docPage: state.pagination.docPage + 1 }
      })),

      prevDocPage: () => set((state) => ({
        pagination: {
          ...state.pagination,
          docPage: Math.max(1, state.pagination.docPage - 1)
        }
      })),

      // Filter Actions
      setFilters: (updates) => set((state) => ({
        filters: { ...state.filters, ...updates }
      })),

      resetFilters: () => set({
        filters: {
          searchQuery: '',
          sortField: 'deadline_date',
          sortOrder: 'asc',
          filterStatus: 'all',
        }
      }),

      // Data Actions
      setData: (updates) => set((state) => ({
        data: { ...state.data, ...updates }
      })),

      setTenders: (tenders) => set((state) => ({
        data: { ...state.data, tenders }
      })),

      setSelectedTender: (tender) => set((state) => ({
        data: { ...state.data, selectedTender: tender }
      })),

      clearSelectedTender: () => set((state) => ({
        data: {
          ...state.data,
          selectedTender: null,
          fullContent: null,
          aiAnalysisResult: null,
          preparedDocuments: [],
          zipFileInfo: null,
        }
      })),

      addPreparedDocument: (doc) => set((state) => ({
        data: {
          ...state.data,
          preparedDocuments: [...state.data.preparedDocuments, doc]
        }
      })),

      removePreparedDocument: (title) => set((state) => ({
        data: {
          ...state.data,
          preparedDocuments: state.data.preparedDocuments.filter(d => d.title !== title)
        }
      })),

      clearPreparedDocuments: () => set((state) => ({
        data: { ...state.data, preparedDocuments: [] }
      })),

      // Progress Actions
      setProgress: (updates) => set((state) => ({
        progress: { ...state.progress, ...updates }
      })),

      startLoading: () => set((state) => ({
        progress: {
          ...state.progress,
          loadingStartTime: Date.now(),
          elapsedTime: 0,
        }
      })),

      stopLoading: () => set((state) => ({
        progress: {
          ...state.progress,
          loadingStartTime: null,
          elapsedTime: 0,
        }
      })),

      // Favorites & Notifications
      toggleFavorite: (id) => set((state) => {
        const favorites = state.preferences.favorites.includes(id)
          ? state.preferences.favorites.filter(fav => fav !== id)
          : [...state.preferences.favorites, id];
        return {
          preferences: { ...state.preferences, favorites }
        };
      }),

      toggleNotification: (id) => set((state) => {
        const notifications = state.preferences.notifications.includes(id)
          ? state.preferences.notifications.filter(notif => notif !== id)
          : [...state.preferences.notifications, id];
        return {
          preferences: { ...state.preferences, notifications }
        };
      }),

      isFavorite: (id) => get().preferences.favorites.includes(id),

      hasNotification: (id) => get().preferences.notifications.includes(id),

      // Content Cache Actions
      setCachedContent: (tenderId, content) => {
        const now = Date.now();
        const TTL = 30 * 60 * 1000; // 30 dakika
        
        set((state) => ({
          contentCache: {
            ...state.contentCache,
            [tenderId]: {
              ...content,
              timestamp: now,
              expiresAt: now + TTL,
            }
          }
        }));
        
        // LRU eviction: Max 50 items
        const cache = get().contentCache;
        if (Object.keys(cache).length > 50) {
          get().clearExpiredCache();
        }
      },

      getCachedContent: (tenderId) => {
        const cache = get().contentCache[tenderId];
        if (!cache) return null;
        
        // TTL check
        if (Date.now() > cache.expiresAt) {
          // Expired, remove
          set((state) => {
            const newCache = { ...state.contentCache };
            delete newCache[tenderId];
            return { contentCache: newCache };
          });
          return null;
        }
        
        return cache;
      },

      clearExpiredCache: () => set((state) => {
        const now = Date.now();
        const newCache = Object.fromEntries(
          Object.entries(state.contentCache).filter(
            ([_, content]) => content.expiresAt > now
          )
        );
        return { contentCache: newCache };
      }),

      clearAllCache: () => set({ contentCache: {} }),

      // Temporary State
      setCopiedId: (id) => set({ copiedId: id }),
      setAnalyzingId: (id) => set({ analyzingId: id }),

      // Reset All
      reset: () => set({
        ui: initialUIState,
        data: initialDataState,
        progress: initialProgressState,
        copiedId: null,
        analyzingId: null,
        // NOT reset: filters, preferences, contentCache (user data)
      }),
    }),
    {
      name: 'ihale-robotu-storage',
      // ✨ Use IndexedDB if available, fallback to localStorage
      storage: createJSONStorage(() => 
        isIDBAvailable() ? idbStorage : localStorage
      ),
      // Persist only user preferences & cache (not UI state)
      partialize: (state) => ({
        preferences: state.preferences,
        contentCache: state.contentCache,
        filters: state.filters, // Son kullanılan filtreler
      }),
    }
  )
);

// ========================================
// SELECTORS (Memoized)
// ========================================

export const selectFilteredTenders = (state: IhaleRobotuStore): Tender[] => {
  const { data, filters, preferences } = state;
  let result = data.tenders;

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.organization.toLowerCase().includes(query) ||
      t.organization_city?.toLowerCase().includes(query)
    );
  }

  // Filter by status
  if (filters.filterStatus === 'favorites') {
    result = result.filter(t => preferences.favorites.includes(t.id));
  } else if (filters.filterStatus === 'active') {
    const now = new Date();
    result = result.filter(t => {
      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
      return deadline && deadline > now;
    });
  } else if (filters.filterStatus === 'closed') {
    const now = new Date();
    result = result.filter(t => {
      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
      return deadline && deadline < now;
    });
  }

  // Sort
  result.sort((a, b) => {
    const field = filters.sortField;
    const order = filters.sortOrder;
    
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (typeof aVal === 'string') {
      return order === 'asc' 
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    }
    
    return order === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  return result;
};

export const selectPaginatedDocuments = (state: IhaleRobotuStore) => {
  const { data, pagination } = state;
  const { preparedDocuments } = data;
  const { docPage, itemsPerPage } = pagination;
  
  const start = (docPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  
  return {
    documents: preparedDocuments.slice(start, end),
    totalPages: Math.ceil(preparedDocuments.length / itemsPerPage),
    currentPage: docPage,
    hasNext: end < preparedDocuments.length,
    hasPrev: docPage > 1,
  };
};
