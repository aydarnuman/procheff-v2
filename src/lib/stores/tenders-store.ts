import { create } from 'zustand';
import type { Tender } from '@/components/ihale/TenderCard';

/**
 * Tenders Store - Global İhale Listesi Yönetimi
 *
 * İki sayfa tek kaynaktan besleniyor:
 * 1. İhale Takip (/ihale-takip) - Dashboard view
 * 2. Yeni Analiz (/ihale/yeni-analiz) - Select view
 *
 * Veri kaynağı: /api/ihale-scraper/list
 */

export interface TendersState {
  // Data
  tenders: Tender[];
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: {
    search: string;
    isCatering: boolean | null;
    source: string | null;
    minBudget: number | null;
    maxBudget: number | null;
    dateFrom: string | null;
    dateTo: string | null;
  };

  // Sorting
  sortBy: 'announcement_date' | 'deadline_date' | 'budget' | 'organization';
  sortOrder: 'asc' | 'desc';

  // Pagination
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };

  // Actions
  setTenders: (tenders: Tender[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchTenders: (params?: FetchTendersParams) => Promise<void>;

  // Filter Actions
  setSearchFilter: (search: string) => void;
  setCateringFilter: (isCatering: boolean | null) => void;
  setSourceFilter: (source: string | null) => void;
  setBudgetFilter: (min: number | null, max: number | null) => void;
  setDateFilter: (from: string | null, to: string | null) => void;
  clearFilters: () => void;

  // Sort Actions
  setSorting: (sortBy: TendersState['sortBy'], sortOrder: 'asc' | 'desc') => void;

  // Pagination Actions
  setPagination: (pagination: Partial<TendersState['pagination']>) => void;
  nextPage: () => void;
  prevPage: () => void;

  // Utility
  getTenderById: (id: string) => Tender | undefined;
  reset: () => void;
}

export interface FetchTendersParams {
  limit?: number;
  offset?: number;
  search?: string;
  is_catering?: boolean;
  source?: string;
  min_budget?: number;
  max_budget?: number;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

const initialState = {
  tenders: [],
  isLoading: false,
  error: null,
  filters: {
    search: '',
    isCatering: null,
    source: null,
    minBudget: null,
    maxBudget: null,
    dateFrom: null,
    dateTo: null,
  },
  sortBy: 'announcement_date' as const,
  sortOrder: 'desc' as const,
  pagination: {
    total: 0,
    limit: 500,
    offset: 0,
  },
};

export const useTendersStore = create<TendersState>()((set, get) => ({
  ...initialState,

  // Data Actions
  setTenders: (tenders) => set({ tenders }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  fetchTenders: async (params) => {
    const state = get();
    set({ isLoading: true, error: null });

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Pagination
      const limit = params?.limit ?? state.pagination.limit;
      const offset = params?.offset ?? state.pagination.offset;
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());

      // Filters
      const search = params?.search ?? state.filters.search;
      if (search) queryParams.append('search', search);

      const isCatering = params?.is_catering ?? state.filters.isCatering;
      if (isCatering !== null && isCatering !== undefined) {
        queryParams.append('is_catering', isCatering.toString());
      }

      const source = params?.source ?? state.filters.source;
      if (source) queryParams.append('source', source);

      const minBudget = params?.min_budget ?? state.filters.minBudget;
      if (minBudget !== null && minBudget !== undefined) {
        queryParams.append('min_budget', minBudget.toString());
      }

      const maxBudget = params?.max_budget ?? state.filters.maxBudget;
      if (maxBudget !== null && maxBudget !== undefined) {
        queryParams.append('max_budget', maxBudget.toString());
      }

      const dateFrom = params?.date_from ?? state.filters.dateFrom;
      if (dateFrom) queryParams.append('date_from', dateFrom);

      const dateTo = params?.date_to ?? state.filters.dateTo;
      if (dateTo) queryParams.append('date_to', dateTo);

      // Sorting
      const sortBy = params?.sort_by ?? state.sortBy;
      const sortOrder = params?.sort_order ?? state.sortOrder;
      queryParams.append('sort_by', sortBy);
      queryParams.append('sort_order', sortOrder);

      // Fetch
      const response = await fetch(`/api/ihale-scraper/list?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        set({
          tenders: result.data || [],
          pagination: {
            // API returns { total, page, pageSize, totalPages } at root level
            total: result.total || result.data?.length || 0,
            limit: result.pageSize || limit,
            offset: result.page ? (result.page - 1) * (result.pageSize || limit) : offset,
          },
          isLoading: false,
        });
      } else {
        throw new Error(result.error || 'Failed to fetch tenders');
      }
    } catch (error) {
      console.error('❌ Tenders fetch error:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  // Filter Actions
  setSearchFilter: (search) => {
    set((state) => ({
      filters: { ...state.filters, search },
      pagination: { ...state.pagination, offset: 0 }, // Reset to first page
    }));
  },

  setCateringFilter: (isCatering) => {
    set((state) => ({
      filters: { ...state.filters, isCatering },
      pagination: { ...state.pagination, offset: 0 },
    }));
  },

  setSourceFilter: (source) => {
    set((state) => ({
      filters: { ...state.filters, source },
      pagination: { ...state.pagination, offset: 0 },
    }));
  },

  setBudgetFilter: (minBudget, maxBudget) => {
    set((state) => ({
      filters: { ...state.filters, minBudget, maxBudget },
      pagination: { ...state.pagination, offset: 0 },
    }));
  },

  setDateFilter: (dateFrom, dateTo) => {
    set((state) => ({
      filters: { ...state.filters, dateFrom, dateTo },
      pagination: { ...state.pagination, offset: 0 },
    }));
  },

  clearFilters: () => {
    set((state) => ({
      filters: initialState.filters,
      pagination: { ...state.pagination, offset: 0 },
    }));
  },

  // Sort Actions
  setSorting: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
  },

  // Pagination Actions
  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  nextPage: () => {
    const state = get();
    const newOffset = state.pagination.offset + state.pagination.limit;
    if (newOffset < state.pagination.total) {
      set((state) => ({
        pagination: { ...state.pagination, offset: newOffset },
      }));
    }
  },

  prevPage: () => {
    const state = get();
    const newOffset = Math.max(0, state.pagination.offset - state.pagination.limit);
    set((state) => ({
      pagination: { ...state.pagination, offset: newOffset },
    }));
  },

  // Utility
  getTenderById: (id) => {
    return get().tenders.find((t) => t.id === id);
  },

  reset: () => set(initialState),
}));

/**
 * Computed Selectors (derived state)
 */
export const useTendersSelectors = () => {
  const store = useTendersStore();

  return {
    // Filtered tenders count
    filteredCount: store.tenders.length,

    // Has active filters
    hasActiveFilters:
      store.filters.search !== '' ||
      store.filters.isCatering !== null ||
      store.filters.source !== null ||
      store.filters.minBudget !== null ||
      store.filters.maxBudget !== null ||
      store.filters.dateFrom !== null ||
      store.filters.dateTo !== null,

    // Catering tenders count
    cateringCount: store.tenders.filter((t) => t.is_catering).length,

    // Total budget (excluding null)
    totalBudget: store.tenders
      .filter((t) => t.budget !== null)
      .reduce((sum, t) => sum + (t.budget || 0), 0),

    // Has more pages
    hasNextPage: store.pagination.offset + store.pagination.limit < store.pagination.total,
    hasPrevPage: store.pagination.offset > 0,

    // Current page number
    currentPage: Math.floor(store.pagination.offset / store.pagination.limit) + 1,
    totalPages: Math.ceil(store.pagination.total / store.pagination.limit),
  };
};
