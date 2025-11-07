'use client';

// ============================================================================
// TOKEN COST CARD COMPONENT
// Aylık token kullanımını ve maliyetini gösterir
// ============================================================================

import { DollarSign, TrendingUp, Zap, Database as DatabaseIcon } from 'lucide-react';
import { useTokenStore } from '@/lib/stores/token-store';
import { formatTokenCount, formatTokenCost } from '@/lib/utils/token-cost';

export const TokenCostCard = () => {
  const { getMonthlyStats } = useTokenStore();
  const monthly = getMonthlyStats();

  const hasUsage = monthly.total.requestCount > 0;

  return (
    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-purple-300">Token Maliyeti</h3>
            <p className="text-xs text-gray-500">Bu Ay</p>
          </div>
        </div>
        
        {hasUsage && (
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>{monthly.total.requestCount} istek</span>
          </div>
        )}
      </div>

      {!hasUsage ? (
        /* Empty State */
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-2">
            <Zap className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">Henüz AI kullanımı yok</p>
          <p className="text-xs text-gray-600 mt-1">İlk analiz sonrası maliyet görünecek</p>
        </div>
      ) : (
        /* Stats */
        <div className="space-y-2.5">
          {/* Claude Stats */}
          {monthly.claude.requestCount > 0 && (
            <div className="bg-black/20 rounded-lg p-3 border border-purple-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  <span className="text-xs font-medium text-gray-300">Claude Sonnet 4</span>
                </div>
                <span className="text-xs text-gray-500">{monthly.claude.requestCount} istek</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-xs text-gray-500">Input</p>
                  <p className="text-sm font-mono text-gray-300">{formatTokenCount(monthly.claude.inputTokens)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Output</p>
                  <p className="text-sm font-mono text-gray-300">{formatTokenCount(monthly.claude.outputTokens)}</p>
                </div>
              </div>
              
              {monthly.claude.cachedTokens > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500">Cached (90% tasarruf)</p>
                  <p className="text-sm font-mono text-emerald-400">{formatTokenCount(monthly.claude.cachedTokens)}</p>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                <span className="text-xs text-gray-400">Maliyet</span>
                <span className="text-base font-bold text-purple-400 font-mono">{formatTokenCost(monthly.claude.costTRY)}</span>
              </div>
            </div>
          )}

          {/* Gemini Stats */}
          {monthly.gemini.requestCount > 0 && (
            <div className="bg-black/20 rounded-lg p-3 border border-emerald-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-xs font-medium text-gray-300">Gemini 2.0 Flash</span>
                </div>
                <span className="text-xs text-gray-500">{monthly.gemini.requestCount} istek</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-xs text-gray-500">Input</p>
                  <p className="text-sm font-mono text-gray-300">{formatTokenCount(monthly.gemini.inputTokens)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Output</p>
                  <p className="text-sm font-mono text-gray-300">{formatTokenCount(monthly.gemini.outputTokens)}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                <span className="text-xs text-gray-400">Maliyet</span>
                <span className="text-base font-bold text-emerald-400 font-mono">{formatTokenCost(monthly.gemini.costTRY)}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Toplam Maliyet</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-400 font-mono">{formatTokenCost(monthly.total.costTRY)}</p>
                <p className="text-xs text-gray-500">{formatTokenCount(monthly.total.totalTokens)} token</p>
              </div>
            </div>
          </div>

          {/* Cost Comparison */}
          {monthly.claude.requestCount > 0 && monthly.gemini.requestCount > 0 && (
            <div className="text-center pt-2">
              <p className="text-xs text-gray-500">
                💡 Gemini, Claude'dan{' '}
                <span className="text-emerald-400 font-semibold">
                  {((monthly.claude.costTRY / monthly.gemini.costTRY)).toFixed(0)}x daha ucuz
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
