"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BarChart3 } from "lucide-react";
import { ExtractedTable } from "@/types/ai";

interface PaginatedTablesViewerProps {
  tables: ExtractedTable[];
  tablesPerPage?: number;
  onTableClick: (index: number, table: ExtractedTable) => void;
}

/**
 * 📊 PAGINATED TABLES VIEWER
 *
 * Çok sayıda tabloyu sayfalara böler
 * - Market kart görünümü korunur
 * - Sayfa navigasyonu
 * - Smooth transitions
 */
export function PaginatedTablesViewer({
  tables,
  tablesPerPage = 6,
  onTableClick
}: PaginatedTablesViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Toplam sayfa sayısı
  const totalPages = Math.ceil(tables.length / tablesPerPage);

  // Mevcut sayfadaki tabloları al
  const startIndex = (currentPage - 1) * tablesPerPage;
  const endIndex = startIndex + tablesPerPage;
  const currentTables = tables.slice(startIndex, endIndex);

  // Navigasyon fonksiyonları
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToLastPage = () => setCurrentPage(totalPages);

  // Eğer toplam tablo sayısı tablesPerPage'den az ise sayfalama gösterme
  if (tables.length <= tablesPerPage) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((tablo, index) => (
          <TableCard
            key={index}
            table={tablo}
            index={index}
            onClick={() => onTableClick(index, tablo)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tablolar Grid */}
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {currentTables.map((tablo, idx) => {
          const globalIndex = startIndex + idx;
          return (
            <TableCard
              key={globalIndex}
              table={tablo}
              index={globalIndex}
              onClick={() => onTableClick(globalIndex, tablo)}
            />
          );
        })}
      </motion.div>

      {/* Sayfa Navigasyonu */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-platinum-800/60 rounded-lg p-4 border border-platinum-700/30">
          {/* Sol: Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToFirstPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="İlk Sayfa"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Önceki Sayfa"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Orta: Sayfa Bilgisi */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-surface-secondary">
              Sayfa{' '}
              <span className="font-semibold text-emerald-400">{currentPage}</span>
              {' / '}
              <span className="font-semibold text-surface-primary">{totalPages}</span>
            </span>
            <span className="text-xs text-surface-secondary/60">
              ({tables.length} tablo)
            </span>
          </div>

          {/* Sağ: Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Sonraki Sayfa"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToLastPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Son Sayfa"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bilgi Mesajı */}
      {totalPages > 1 && (
        <div className="text-xs text-surface-secondary/60 text-center">
          💡 İpucu: Her sayfa {tablesPerPage} tablo gösterir
        </div>
      )}
    </div>
  );
}

/**
 * Table Card Component (Market kart görünümü)
 */
function TableCard({
  table,
  index,
  onClick
}: {
  table: ExtractedTable;
  index: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-emerald-500/50 transition-all cursor-pointer group"
    >
      {/* Icon & Stats */}
      <div className="flex items-center justify-between mb-4">
        <BarChart3 className="w-8 h-8 text-emerald-400" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-300 bg-green-500/20 px-2 py-1 rounded-full">
            {table.satir_sayisi} satır
          </span>
          <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded-full">
            {Math.round(table.guven * 100)}%
          </span>
        </div>
      </div>

      {/* Tablo Başlığı */}
      <h3 className="text-base font-semibold text-white mb-3 group-hover:text-emerald-400 transition-colors line-clamp-2 min-h-[48px]">
        {table.baslik}
      </h3>

      {/* Preview - HTML Tablo */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs text-gray-400 mb-2">Önizleme:</div>
        <div className="bg-slate-900/50 rounded-lg p-3 max-h-[120px] overflow-hidden relative">
          {table.headers && table.rows && table.rows.length > 0 ? (
            <div className="overflow-hidden">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr>
                    {table.headers.slice(0, 3).map((header, i) => (
                      <th key={i} className="text-left text-emerald-300 pb-1 pr-2 font-semibold border-b border-white/10">
                        {header.length > 15 ? header.substring(0, 15) + '...' : header}
                      </th>
                    ))}
                    {table.headers.length > 3 && (
                      <th className="text-left text-gray-400 pb-1">...</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {row.slice(0, 3).map((cell, j) => (
                        <td key={j} className="py-1 pr-2 text-gray-300">
                          {String(cell).length > 15 ? String(cell).substring(0, 15) + '...' : String(cell)}
                        </td>
                      ))}
                      {row.length > 3 && (
                        <td className="py-1 text-gray-500">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.rows.length > 3 && (
                <div className="text-center text-gray-500 text-[9px] mt-1">
                  +{table.rows.length - 3} satır daha
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-2">Önizleme yok</div>
          )}

          {/* Gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Click hint */}
      <div className="mt-3 text-center text-[10px] text-gray-500 group-hover:text-emerald-400 transition-colors">
        Tam ekran için tıkla
      </div>
    </div>
  );
}
