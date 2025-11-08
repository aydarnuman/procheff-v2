/**
 * İhale Robotu - Safe Migration Wrapper Hook
 * 
 * Bu hook mevcut useState sistemini bozmadan yeni Zustand store'u
 * kullanmayı sağlar. Her iki sistem de paralel çalışır.
 * 
 * USAGE:
 * const state = useIhaleRobotuState(); // Otomatik fallback
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useIhaleRobotuStore } from '@/lib/stores/ihale-robotu-store';
import { 
  MIGRATION_CONFIG, 
  shouldUseNewStore, 
  debugLog, 
  handleMigrationError,
  MigrationMetrics 
} from './safe-migration';

interface UseIhaleRobotuStateResult {
  // State
  ui: any;
  data: any;
  filters: any;
  progress: any;
  preferences: any;
  
  // Actions
  setUI: (updates: any) => void;
  setData: (updates: any) => void;
  setFilters: (updates: any) => void;
  setProgress: (updates: any) => void;
  toggleFavorite: (id: string) => void;
  toggleNotification: (id: string) => void;
  
  // Meta
  isUsingZustand: boolean;
  metrics: any;
}

export function useIhaleRobotuState(): UseIhaleRobotuStateResult {
  const [useZustand, setUseZustand] = useState(() => shouldUseNewStore());
  const [fallbackTriggered, setFallbackTriggered] = useState(false);

  // Zustand store (conditionally used)
  const zustandStore = useIhaleRobotuStore();

  // Fallback: useState (always ready)
  const [fallbackState, setFallbackState] = useState({
    ui: {
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
    },
    data: {
      tenders: [],
      selectedTender: null,
      fullContent: null,
      aiAnalysisResult: null,
      preparedDocuments: [],
      selectedDocuments: [],
      zipFileInfo: null,
    },
    filters: {
      searchQuery: '',
      sortField: 'deadline_date' as const,
      sortOrder: 'asc' as const,
      filterStatus: 'all' as const,
    },
    progress: {
      download: 0,
      batchProgress: { current: 0, total: 0 },
      scrapingProgress: null,
      elapsedTime: 0,
      loadingStartTime: null,
    },
    preferences: {
      favorites: [] as string[],
      notifications: [] as string[],
    },
  });

  // Error boundary for Zustand
  useEffect(() => {
    const errorHandler = (error: Error) => {
      const shouldFallback = handleMigrationError(error, 'Zustand Store');
      if (shouldFallback && !fallbackTriggered) {
        debugLog('Falling back to useState', { error: error.message });
        setUseZustand(false);
        setFallbackTriggered(true);
      }
    };

    if (useZustand) {
      window.addEventListener('error', errorHandler as any);
      return () => window.removeEventListener('error', errorHandler as any);
    }
  }, [useZustand, fallbackTriggered]);

  // Track renders
  useEffect(() => {
    if (useZustand) {
      MigrationMetrics.incrementZustandRender();
    } else {
      MigrationMetrics.incrementUseStateRender();
    }
  });

  // Actions factory
  const createActions = useCallback(() => {
    if (useZustand && !fallbackTriggered) {
      // Use Zustand
      return {
        setUI: zustandStore.setUI,
        setData: zustandStore.setData,
        setFilters: zustandStore.setFilters,
        setProgress: zustandStore.setProgress,
        toggleFavorite: zustandStore.toggleFavorite,
        toggleNotification: zustandStore.toggleNotification,
      };
    } else {
      // Use useState (fallback)
      return {
        setUI: (updates: any) => {
          setFallbackState(prev => ({
            ...prev,
            ui: { ...prev.ui, ...updates },
          }));
        },
        setData: (updates: any) => {
          setFallbackState(prev => ({
            ...prev,
            data: { ...prev.data, ...updates },
          }));
        },
        setFilters: (updates: any) => {
          setFallbackState(prev => ({
            ...prev,
            filters: { ...prev.filters, ...updates },
          }));
        },
        setProgress: (updates: any) => {
          setFallbackState(prev => ({
            ...prev,
            progress: { ...prev.progress, ...updates },
          }));
        },
        toggleFavorite: (id: string) => {
          setFallbackState(prev => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              favorites: prev.preferences.favorites.includes(id)
                ? prev.preferences.favorites.filter(f => f !== id)
                : [...prev.preferences.favorites, id],
            },
          }));
        },
        toggleNotification: (id: string) => {
          setFallbackState(prev => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              notifications: prev.preferences.notifications.includes(id)
                ? prev.preferences.notifications.filter(n => n !== id)
                : [...prev.preferences.notifications, id],
            },
          }));
        },
      };
    }
  }, [useZustand, fallbackTriggered, zustandStore]);

  const actions = createActions();

  // State selection
  const state = useZustand && !fallbackTriggered ? zustandStore : fallbackState;

  return {
    ui: state.ui,
    data: state.data,
    filters: state.filters,
    progress: state.progress,
    preferences: state.preferences,
    ...actions,
    isUsingZustand: useZustand && !fallbackTriggered,
    metrics: MIGRATION_CONFIG.TRACK_PERFORMANCE ? MigrationMetrics.getReport() : null,
  };
}

// Metrics reporter (for debugging)
export function useMigrationMetrics() {
  const [metrics, setMetrics] = useState(MigrationMetrics.getReport());

  useEffect(() => {
    if (!MIGRATION_CONFIG.DEBUG_MODE) return;

    const interval = setInterval(() => {
      setMetrics(MigrationMetrics.getReport());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return metrics;
}
