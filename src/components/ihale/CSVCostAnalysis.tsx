'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, Package, DollarSign, FileText, ChevronDown, ChevronUp, X } from 'lucide-react';
import { CSVCostAnalysis as CSVCostAnalysisType } from '@/lib/csv/csv-parser';
import { useState } from 'react';

interface CSVCostAnalysisProps {
  analysis: CSVCostAnalysisType;
  fileName: string;
  onRemove?: () => void; // Silme callback'i
}

/**
 * 📊 CSV Maliyet Analizi Görselleştirme Komponenti
 *
 * CSV'den çıkarılan maliyet verilerini tablo ve grafik ile gösterir.
 */
export function CSVCostAnalysis({ analysis, fileName, onRemove }: CSVCostAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Varsayılan olarak kapalı
  const [showAllItems, setShowAllItems] = useState(false);

  const { items, summary } = analysis;

  // İlk 10 ürünü veya tümünü göster
  const displayedItems = showAllItems ? items : items.slice(0, 10);
  const hasMoreItems = items.length > 10;

  // Kategorileri toplam maliyete göre sırala
  const sortedCategories = [...summary.categories].sort((a, b) => b.total_cost - a.total_cost);

  // En yüksek 5 kategori
  const topCategories = sortedCategories.slice(0, 5);

  // Toplam fiyat formatla
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl overflow-hidden"
    >
      {/* Header - Kompakt */}
      <div className="w-full px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:bg-emerald-500/5 transition-colors rounded-lg p-2"
        >
          <div className="p-1.5 bg-emerald-500/20 rounded-lg shrink-0">
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{fileName}</h3>
            <p className="text-xs text-emerald-300">
              {summary.total_items} ürün • {formatPrice(summary.total_cost)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-xs text-emerald-400 font-semibold">
              {Math.round(analysis.confidence * 100)}%
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-emerald-400" />
            )}
          </div>
        </button>

        {/* Delete button - Artık button'ın dışında */}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`"${fileName}" dosyasını silmek istediğinizden emin misiniz?`)) {
                onRemove();
              }
            }}
            className="p-1 hover:bg-red-500/20 rounded transition-colors ml-2"
            title="Sil"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="px-6 pb-6 space-y-6"
          >
          {/* Özet Kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Toplam Ürün */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded">
                  <Package className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Toplam Ürün</span>
              </div>
              <div className="text-2xl font-bold text-white">{summary.total_items}</div>
            </div>

            {/* Toplam Maliyet */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Toplam Maliyet</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatPrice(summary.total_cost)}</div>
            </div>

            {/* Ortalama Birim Fiyat */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Ort. Birim Fiyat</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatPrice(summary.average_unit_price)}</div>
            </div>
          </div>

          {/* Kategori Dağılımı */}
          {topCategories.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h4 className="font-semibold text-white">Kategori Dağılımı</h4>
              </div>
              <div className="space-y-3">
                {topCategories.map((category, index) => {
                  const percentage = (category.total_cost / summary.total_cost) * 100;
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{category.name}</span>
                        <span className="text-sm font-semibold text-white">
                          {formatPrice(category.total_cost)} ({Math.round(percentage)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {category.count} ürün
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ürün Tablosu */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-800/70 border-b border-gray-700">
              <h4 className="font-semibold text-white">Ürün Listesi</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Ürün Adı
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Miktar
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Birim
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Birim Fiyat
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Toplam
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {displayedItems.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{item.urun_adi}</div>
                        {item.kategori && (
                          <div className="text-xs text-gray-400 mt-0.5">{item.kategori}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">
                        {item.miktar ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">
                        {item.birim ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-white">
                        {item.birim_fiyat ? formatPrice(item.birim_fiyat) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                        {item.toplam_fiyat ? formatPrice(item.toplam_fiyat) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Show More Button */}
            {hasMoreItems && (
              <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-700">
                <button
                  onClick={() => setShowAllItems(!showAllItems)}
                  className="w-full py-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  {showAllItems ? (
                    <>Daha Az Göster</>
                  ) : (
                    <>+{items.length - 10} Ürün Daha Göster</>
                  )}
                </button>
              </div>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
