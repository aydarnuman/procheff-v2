"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginatedTextViewerProps {
  text: string;
  linesPerPage?: number;
}

/**
 * 📄 PAGINATED TEXT VIEWER
 *
 * Büyük metinleri sayfalara böler ve navigasyon sağlar
 * - Satır bazlı sayfalama
 * - Sayfa navigasyonu (ilk, önceki, sonraki, son)
 * - Sayfa numarası gösterimi
 * - Smooth transitions
 */
export function PaginatedTextViewer({
  text,
  linesPerPage = 50
}: PaginatedTextViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Metni satırlara böl
  const lines = useMemo(() => {
    return text.split('\n');
  }, [text]);

  // Toplam sayfa sayısı
  const totalPages = Math.ceil(lines.length / linesPerPage);

  // Mevcut sayfadaki satırları al
  const currentLines = useMemo(() => {
    const startIndex = (currentPage - 1) * linesPerPage;
    const endIndex = startIndex + linesPerPage;
    return lines.slice(startIndex, endIndex);
  }, [lines, currentPage, linesPerPage]);

  // Navigasyon fonksiyonları
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToLastPage = () => setCurrentPage(totalPages);

  // Akıllı metin formatlama (orjinal fonksiyondan)
  const formatSmartText = (text: string) => {
    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();

      // Başlık tespit (büyük harf + kısa satır)
      if (trimmedLine.length > 0 && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length < 100) {
        return (
          <div key={index} className="text-cyan-400 font-bold text-base mt-4 mb-2">
            {trimmedLine}
          </div>
        );
      }

      // Madde işaretli liste
      if (trimmedLine.match(/^[•\-\*]\s/)) {
        return (
          <div key={index} className="text-surface-secondary ml-4 my-1 flex items-start space-x-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>{trimmedLine.replace(/^[•\-\*]\s/, '')}</span>
          </div>
        );
      }

      // Numaralı liste
      if (trimmedLine.match(/^\d+[\.\)]\s/)) {
        return (
          <div key={index} className="text-surface-secondary ml-4 my-1">
            <span className="text-cyan-400 font-semibold">{trimmedLine.match(/^\d+[\.\)]/)?.[0]}</span>
            {' '}
            {trimmedLine.replace(/^\d+[\.\)]\s/, '')}
          </div>
        );
      }

      // Normal paragraf
      if (trimmedLine.length > 0) {
        return (
          <p key={index} className="text-surface-secondary leading-relaxed my-2">
            {trimmedLine}
          </p>
        );
      }

      // Boş satır
      return <div key={index} className="h-2" />;
    });
  };

  return (
    <div className="space-y-4">
      {/* Sayfa İçeriği */}
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="bg-platinum-900/60 rounded-lg p-6 border border-platinum-700/20 min-h-[600px]"
      >
        <div className="text-sm">
          {formatSmartText(currentLines.join('\n'))}
        </div>
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
              <span className="font-semibold text-cyan-400">{currentPage}</span>
              {' / '}
              <span className="font-semibold text-surface-primary">{totalPages}</span>
            </span>
            <span className="text-xs text-surface-secondary/60">
              ({lines.length.toLocaleString()} satır)
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
          💡 İpucu: Her sayfa {linesPerPage} satır içerir
        </div>
      )}
    </div>
  );
}
