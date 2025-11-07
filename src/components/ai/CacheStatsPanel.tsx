"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Trash2, Clock, HardDrive, TrendingUp } from "lucide-react";
import { AnalysisCache } from "@/lib/utils/analysis-cache";

export function CacheStatsPanel() {
  const [stats, setStats] = useState({
    totalEntries: 0,
    totalSize: 0,
    oldestEntry: 0,
    newestEntry: 0,
  });
  const [isClearing, setIsClearing] = useState(false);

  // Cache stats'ı yükle
  const loadStats = () => {
    const cacheStats = AnalysisCache.getStats();
    setStats(cacheStats);
  };

  // Component mount olunca stats yükle
  useEffect(() => {
    loadStats();

    // 🎯 Optimize: 30 saniyeye çıkarıldı (5sn → 30sn)
    // Scheduler violation'ı önlemek için interval artırıldı
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    if (!confirm("Tüm cache'i temizlemek istediğinizden emin misiniz?")) {
      return;
    }

    setIsClearing(true);
    AnalysisCache.clearCache();
    loadStats();
    setTimeout(() => setIsClearing(false), 1000);
  };

  // Zaman hesaplaması
  const getTimeAgo = (timestamp: number) => {
    if (!timestamp) return "-";
    const minutes = Math.round((Date.now() - timestamp) / 1000 / 60);
    if (minutes < 60) return `${minutes} dakika`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} saat`;
    const days = Math.round(hours / 24);
    return `${days} gün`;
  };

  const cacheUsagePercent = (stats.totalEntries / 10) * 100; // Max 10 entries
  const storageMB = (stats.totalSize / 1024 / 1024).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Database className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Cache İstatistikleri</h3>
            <p className="text-sm text-gray-400">Analiz sonuçları hafızada</p>
          </div>
        </div>

        <button
          onClick={handleClearCache}
          disabled={isClearing || stats.totalEntries === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isClearing ? "Temizleniyor..." : "Cache Temizle"}
          </span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cache Entries */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Kayıtlı Analiz</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.totalEntries}</span>
            <span className="text-sm text-gray-500">/ 10</span>
          </div>
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${cacheUsagePercent}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
            />
          </div>
        </div>

        {/* Storage Size */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">Toplam Boyut</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{storageMB}</span>
            <span className="text-sm text-gray-500">MB</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalEntries > 0
              ? `~${(parseFloat(storageMB) / stats.totalEntries).toFixed(2)} MB/analiz`
              : "Henüz cache yok"
            }
          </p>
        </div>

        {/* Oldest Entry */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-gray-400">En Eski</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {getTimeAgo(stats.oldestEntry)}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {stats.oldestEntry ? "önce cache'lendi" : "Henüz cache yok"}
          </p>
        </div>

        {/* Newest Entry */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-400">En Yeni</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {getTimeAgo(stats.newestEntry)}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {stats.newestEntry ? "önce eklendi" : "Henüz cache yok"}
          </p>
        </div>
      </div>

      {/* Cache Explanation */}
      {stats.totalEntries > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20"
        >
          <p className="text-sm text-blue-200">
            💡 <strong>Cache Faydası:</strong> Aynı dosyayı tekrar yüklediğinizde analiz{" "}
            <span className="font-semibold text-blue-100">anında</span> gelir!
            Her cache hit ortalama <span className="font-semibold">30-60 saniye</span> kazandırır.
          </p>
        </motion.div>
      )}

      {/* Empty State */}
      {stats.totalEntries === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-6 bg-gray-800/30 rounded-lg border border-dashed border-gray-700 text-center"
        >
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            Henüz cache'de analiz yok. İlk analizinizi yaptığınızda buraya kaydedilecek.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
