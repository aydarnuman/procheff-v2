'use client';

import React, { useEffect, useState } from 'react';
import { TenderCard, type Tender } from './TenderCard';
import { useTendersStore, useTendersSelectors } from '@/lib/stores/tenders-store';
import { Search, Loader2, ChevronLeft, ChevronRight, X, Utensils, RefreshCw, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * TenderList Component
 *
 * Tek veri kaynağından beslenen ortak liste bileşeni
 * Mode: 'dashboard' (İhale Takip) veya 'select' (Yeni Analiz modal)
 */

interface TenderListProps {
  mode: 'dashboard' | 'select';
  onSelect?: (tender: Tender) => void;
  onViewDetails?: (tender: Tender) => void;
  onAnalyze?: (tender: Tender) => void;
  initialLimit?: number;
  showFilters?: boolean;
  showPagination?: boolean;
}

export const TenderList: React.FC<TenderListProps> = ({
  mode,
  onSelect,
  onViewDetails,
  onAnalyze,
  initialLimit = 500,
  showFilters = true,
  showPagination = true
}) => {
  const router = useRouter();

  // Store
  const {
    tenders,
    isLoading,
    error,
    filters,
    sortBy,
    sortOrder,
    pagination,
    fetchTenders,
    setSearchFilter,
    setCateringFilter,
    setSorting,
    nextPage,
    prevPage,
    clearFilters
  } = useTendersStore();

  const selectors = useTendersSelectors();

  // Local state
  const [searchInput, setSearchInput] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Fetch on mount only
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mounted) {
      fetchTenders({ limit: initialLimit });
      setMounted(true);
    }
  }, [mounted, fetchTenders, initialLimit]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setSearchFilter(searchInput);
        // Fetch after filter is set
        setTimeout(() => fetchTenders(), 100);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setSearchFilter, fetchTenders]);

  // Handlers
  const handleRefresh = () => {
    fetchTenders();
  };

  const handleClearFilters = () => {
    setSearchInput('');
    clearFilters();
    // Fetch immediately after clearing
    setTimeout(() => fetchTenders(), 100);
  };

  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      // Toggle order
      setSorting(newSortBy, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSorting(newSortBy, 'desc');
    }
    // Fetch immediately after sorting
    setTimeout(() => fetchTenders(), 100);
  };

  const handleCateringFilter = () => {
    setCateringFilter(filters.isCatering === true ? null : true);
    // Fetch immediately after filter change
    setTimeout(() => fetchTenders(), 100);
  };

  const handleNextPage = () => {
    nextPage();
    setTimeout(() => fetchTenders(), 100);
  };

  const handlePrevPage = () => {
    prevPage();
    setTimeout(() => fetchTenders(), 100);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        {mode === 'dashboard' ? (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-surface-primary">İhale Listesi</h2>
              <p className="text-surface-secondary text-sm mt-1">
                Toplam {pagination?.total || 0} ihale • {selectors.cateringCount} yemek ihalesi
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/ihale/yeni-analiz')}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-purple-500/30 font-medium"
              >
                <Plus className="w-4 h-4" />
                Yeni Analiz
              </button>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                title="Listeyi yenile"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-bold text-surface-primary mb-2">İhale Seç</h3>
            <p className="text-surface-secondary text-sm">
              {pagination.total} ihale içinden seçim yapın
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="İhale başlığı, kurum veya şehir ara..."
              className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-surface-primary placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Catering Filter */}
            <button
              onClick={handleCateringFilter}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                filters.isCatering === true
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-amber-500/30'
              }`}
            >
              <Utensils className="w-4 h-4" />
              Yemek İhaleleri
              {filters.isCatering === true && ` (${selectors.cateringCount})`}
            </button>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Sırala:</span>
              <button
                onClick={() => handleSortChange('announcement_date')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sortBy === 'announcement_date'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-emerald-500/30'
                }`}
              >
                İlan Tarihi {sortBy === 'announcement_date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSortChange('deadline_date')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sortBy === 'deadline_date'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-emerald-500/30'
                }`}
              >
                Son Başvuru {sortBy === 'deadline_date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSortChange('budget')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sortBy === 'budget'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-emerald-500/30'
                }`}
              >
                Bütçe {sortBy === 'budget' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>

            {/* Clear Filters */}
            {selectors.hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Filtreleri Temizle
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && tenders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
          <p className="text-surface-secondary">İhaleler yükleniyor...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium mb-2">Hata</p>
          <p className="text-surface-secondary text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && tenders.length === 0 && (
        <div className="bg-gray-800/30 rounded-xl p-12 text-center">
          <p className="text-surface-secondary mb-2">İhale bulunamadı</p>
          {selectors.hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-emerald-400 hover:text-emerald-300 text-sm"
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      )}

      {/* Tender Grid */}
      {!isLoading && !error && tenders.length > 0 && (
        <>
          <div className={`grid gap-4 ${mode === 'dashboard' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {tenders.map((tender, index) => (
              <TenderCard
                key={tender.id}
                tender={tender}
                mode={mode}
                onClick={mode === 'select' ? onSelect : undefined}
                onViewDetails={mode === 'dashboard' ? onViewDetails : undefined}
                onAnalyze={mode === 'dashboard' ? onAnalyze : undefined}
                index={index}
              />
            ))}
          </div>

          {/* Pagination */}
          {showPagination && pagination.total > pagination.limit && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-surface-secondary">
                {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} / {pagination.total} ihale
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={!selectors.hasPrevPage}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Önceki
                </button>

                <span className="px-4 py-2 bg-gray-800/50 text-surface-primary rounded-lg">
                  Sayfa {selectors.currentPage} / {selectors.totalPages}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={!selectors.hasNextPage}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Sonraki
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
