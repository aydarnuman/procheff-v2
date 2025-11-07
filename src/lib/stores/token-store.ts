// ============================================================================
// TOKEN USAGE TRACKING STORE
// AI token kullanımını izler ve localStorage'da saklar
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateTokenCost, formatTokenCost, formatTokenCount } from '@/lib/utils/token-cost';

export interface TokenUsageEntry {
  id: string;
  timestamp: string;
  provider: 'claude' | 'gemini';
  model: string; // Artık specific model isimleri: claude-sonnet-4-20250514, gemini-2.0-flash-exp
  operation: 'scraper-categorization' | 'tender-analysis' | 'document-extraction' | 'recipe-suggestion' | 'price-detection' | 'other';
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number; // Claude prompt caching - ilk kez oluşturma
  cacheReadTokens?: number;     // Claude prompt caching - cache'ten okuma (90% indirim)
  costTRY: number;
  metadata?: {
    tenderId?: string;
    tenderTitle?: string;
    analysisType?: string;
  };
}

export interface MonthlyStats {
  claude: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    costTRY: number;
    requestCount: number;
  };
  gemini: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    costTRY: number;
    requestCount: number;
  };
  total: {
    totalTokens: number;
    costTRY: number;
    requestCount: number;
  };
}

interface TokenStore {
  usage: TokenUsageEntry[];
  
  // Actions
  addUsage: (entry: Omit<TokenUsageEntry, 'id' | 'timestamp' | 'costTRY'>) => void;
  clearOldEntries: (daysToKeep: number) => void;
  getMonthlyStats: () => MonthlyStats;
  getTodayStats: () => MonthlyStats;
  getUsageByOperation: (operation: TokenUsageEntry['operation']) => TokenUsageEntry[];
}

export const useTokenStore = create<TokenStore>()(
  persist(
    (set, get) => ({
      usage: [],

      addUsage: (entry) => {
        const id = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        
        // Calculate cost - provider'ı model'dan çıkar
        const provider = entry.provider;
        const inputCost = calculateTokenCost(entry.inputTokens, provider, 'input');
        const outputCost = calculateTokenCost(entry.outputTokens, provider, 'output');
        
        // Claude prompt caching costs
        const cacheCreationCost = entry.cacheCreationTokens && provider === 'claude'
          ? calculateTokenCost(entry.cacheCreationTokens, provider, 'input') // Cache creation = normal input cost
          : 0;
        const cacheReadCost = entry.cacheReadTokens && provider === 'claude'
          ? calculateTokenCost(entry.cacheReadTokens, provider, 'cached') // 90% discount
          : 0;
        
        const costTRY = inputCost + outputCost + cacheCreationCost + cacheReadCost;

        const newEntry: TokenUsageEntry = {
          ...entry,
          id,
          timestamp,
          costTRY,
        };

        set((state) => ({
          usage: [...state.usage, newEntry],
        }));
      },

      clearOldEntries: (daysToKeep = 90) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        set((state) => ({
          usage: state.usage.filter(
            (entry) => new Date(entry.timestamp) >= cutoffDate
          ),
        }));
      },

      getMonthlyStats: () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const monthlyUsage = get().usage.filter(
          (entry) => new Date(entry.timestamp) >= startOfMonth
        );

        return calculateStats(monthlyUsage);
      },

      getTodayStats: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayUsage = get().usage.filter(
          (entry) => new Date(entry.timestamp) >= today
        );

        return calculateStats(todayUsage);
      },

      getUsageByOperation: (operation) => {
        return get().usage.filter((entry) => entry.operation === operation);
      },
    }),
    {
      name: 'token-usage-store',
      version: 1,
    }
  )
);

// Helper function to calculate stats
function calculateStats(entries: TokenUsageEntry[]): MonthlyStats {
  const claudeEntries = entries.filter((e) => e.provider === 'claude');
  const geminiEntries = entries.filter((e) => e.provider === 'gemini');

  const claudeStats = {
    totalTokens: claudeEntries.reduce((sum, e) => {
      const cached = (e.cacheCreationTokens || 0) + (e.cacheReadTokens || 0);
      return sum + e.inputTokens + e.outputTokens + cached;
    }, 0),
    inputTokens: claudeEntries.reduce((sum, e) => sum + e.inputTokens, 0),
    outputTokens: claudeEntries.reduce((sum, e) => sum + e.outputTokens, 0),
    cachedTokens: claudeEntries.reduce((sum, e) => {
      return sum + (e.cacheCreationTokens || 0) + (e.cacheReadTokens || 0);
    }, 0),
    costTRY: claudeEntries.reduce((sum, e) => sum + e.costTRY, 0),
    requestCount: claudeEntries.length,
  };

  const geminiStats = {
    totalTokens: geminiEntries.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0),
    inputTokens: geminiEntries.reduce((sum, e) => sum + e.inputTokens, 0),
    outputTokens: geminiEntries.reduce((sum, e) => sum + e.outputTokens, 0),
    costTRY: geminiEntries.reduce((sum, e) => sum + e.costTRY, 0),
    requestCount: geminiEntries.length,
  };

  return {
    claude: claudeStats,
    gemini: geminiStats,
    total: {
      totalTokens: claudeStats.totalTokens + geminiStats.totalTokens,
      costTRY: claudeStats.costTRY + geminiStats.costTRY,
      requestCount: claudeStats.requestCount + geminiStats.requestCount,
    },
  };
}
