"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Search,
  BarChart3,
  Clock,
} from "lucide-react";

interface DocumentPage {
  pageNumber: number;
  content: string;
  quality: number;
  isEmpty: boolean;
  keyTerms: string[];
  wordCount: number;
  processingTime: number;
}

interface DocumentStats {
  totalPages: number;
  emptyPages: number;
  lowQualityPages: number;
  totalWords: number;
  averageQuality: number;
  ocrPagesProcessed: number;
  processingTime: number;
  fileType: string;
}

interface DocumentPreviewProps {
  pages: DocumentPage[];
  stats: DocumentStats;
  warnings: string[];
  onAnalyze: () => void;
  isAnalyzing: boolean;
  detectedDocTypes?: string[]; // Detected document types from files
  aiProvider?: string; // Which AI will be used
}

export function DocumentPreview({
  pages,
  stats,
  warnings,
  onAnalyze,
  isAnalyzing,
  detectedDocTypes = [],
  aiProvider = 'Claude Sonnet 4',
}: DocumentPreviewProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [showEmptyPages, setShowEmptyPages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterQuality, setFilterQuality] = useState<"all" | "high" | "low">(
    "all"
  );

  // Filtreleme
  const filteredPages = pages.filter((page) => {
    // Boş sayfa filtresi
    if (!showEmptyPages && page.isEmpty) return false;

    // Kalite filtresi
    if (filterQuality === "high" && page.quality < 0.7) return false;
    if (filterQuality === "low" && page.quality >= 0.7) return false;

    // Arama filtresi
    if (
      searchTerm &&
      !page.content.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const getQualityColor = (quality: number) => {
    if (quality >= 0.8) return "text-green-400";
    if (quality >= 0.5) return "text-yellow-400";
    return "text-red-400";
  };

  const getQualityBg = (quality: number) => {
    if (quality >= 0.8) return "bg-green-500/20 border-green-500/40";
    if (quality >= 0.5) return "bg-yellow-500/20 border-yellow-500/40";
    return "bg-red-500/20 border-red-500/40";
  };

  return (
    <div className="space-y-6">
      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-platinum-800/60 rounded-xl p-4 border border-platinum-600">
          <div className="text-2xl font-bold text-accent-400">
            {stats.totalPages}
          </div>
          <div className="text-sm text-surface-secondary">Toplam Sayfa</div>
        </div>
        <div className="bg-platinum-800/60 rounded-xl p-4 border border-platinum-600">
          <div className="text-2xl font-bold text-green-400">
            {stats.totalWords}
          </div>
          <div className="text-sm text-surface-secondary">Toplam Kelime</div>
        </div>
        <div className="bg-platinum-800/60 rounded-xl p-4 border border-platinum-600">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-blue-400">
              {Math.round(stats.averageQuality * 100)}%
            </div>
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-sm text-surface-secondary">Ortalama Kalite</div>
        </div>
        <div className="bg-platinum-800/60 rounded-xl p-4 border border-platinum-600">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-purple-400">
              {Math.round(stats.processingTime / 1000)}s
            </div>
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-sm text-surface-secondary">İşleme Süresi</div>
        </div>
      </div>

      {/* Uyarılar */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-yellow-400">
              Dikkat Edilmesi Gerekenler
            </h3>
          </div>
          <ul className="space-y-1 text-sm text-yellow-200">
            {warnings.slice(0, 5).map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
            {warnings.length > 5 && (
              <li className="text-yellow-400">
                ... ve {warnings.length - 5} uyarı daha
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-platinum-400" />
          <input
            type="text"
            placeholder="Sayfa içeriğinde ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-platinum-800/60 border border-platinum-600 rounded-lg text-surface-primary placeholder-platinum-400 focus:border-accent-400 focus:outline-none"
          />
        </div>

        <select
          value={filterQuality}
          onChange={(e) =>
            setFilterQuality(e.target.value as "all" | "high" | "low")
          }
          title="Sayfa kalitesi filtresi"
          className="px-3 py-2 bg-platinum-800/60 border border-platinum-600 rounded-lg text-surface-primary focus:border-accent-400 focus:outline-none"
        >
          <option value="all">Tüm Sayfalar</option>
          <option value="high">Yüksek Kalite (70%+)</option>
          <option value="low">Düşük Kalite (70%-)</option>
        </select>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showEmptyPages}
            onChange={(e) => setShowEmptyPages(e.target.checked)}
            className="rounded border-platinum-600 bg-platinum-800 text-accent-400 focus:ring-accent-400 focus:ring-offset-0"
          />
          <span className="text-sm text-surface-secondary">
            Boş sayfaları göster
          </span>
        </label>
      </div>

      {/* Sayfa Listesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPages.map((page) => (
          <motion.div
            key={page.pageNumber}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedPage === page.pageNumber
                ? "border-accent-400 bg-accent-500/10"
                : `border-platinum-600 bg-platinum-800/40 hover:border-platinum-500 ${getQualityBg(
                    page.quality
                  )}`
            }`}
            onClick={() =>
              setSelectedPage(
                selectedPage === page.pageNumber ? null : page.pageNumber
              )
            }
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-platinum-400" />
                <span className="font-semibold text-surface-primary">
                  Sayfa {page.pageNumber}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {page.isEmpty ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                <span
                  className={`text-sm font-medium ${getQualityColor(
                    page.quality
                  )}`}
                >
                  {Math.round(page.quality * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-surface-secondary">
                <span>Kelime sayısı:</span>
                <span className="font-medium">{page.wordCount}</span>
              </div>

              {page.keyTerms.length > 0 && (
                <div>
                  <div className="text-surface-secondary mb-1">
                    Anahtar terimler:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {page.keyTerms.slice(0, 3).map((term, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-accent-500/20 text-accent-400 rounded text-xs"
                      >
                        {term}
                      </span>
                    ))}
                    {page.keyTerms.length > 3 && (
                      <span className="text-xs text-surface-secondary">
                        +{page.keyTerms.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {page.isEmpty && (
                <div className="text-red-400 text-xs font-medium">
                  ⚠ Bu sayfa boş veya okunamadı
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPage(
                      selectedPage === page.pageNumber ? null : page.pageNumber
                    );
                  }}
                  className="flex items-center space-x-1 text-accent-400 hover:text-accent-300 transition-colors"
                >
                  {selectedPage === page.pageNumber ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span className="text-xs">Gizle</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span className="text-xs">Önizle</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Seçilen Sayfa İçeriği */}
      <AnimatePresence>
        {selectedPage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-platinum-800/60 rounded-xl border border-platinum-600 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-primary">
                Sayfa {selectedPage} İçeriği
              </h3>
              <button
                onClick={() => setSelectedPage(null)}
                title="Önizlemeyi kapat"
                className="text-platinum-400 hover:text-surface-primary transition-colors"
              >
                <EyeOff className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {pages.find((p) => p.pageNumber === selectedPage)?.isEmpty ? (
                <div className="text-center py-8 text-surface-secondary">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p>Bu sayfa boş veya içerik çıkarılamadı</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-surface-secondary">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {pages.find((p) => p.pageNumber === selectedPage)?.content}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analiz Butonu */}
      <div className="text-center space-y-4">
        {/* AI Provider ve Doküman Bilgisi */}
        {detectedDocTypes.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <span className="text-purple-400 font-medium">
                📋 {detectedDocTypes.length} belge türü tespit edildi
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <span className="text-gray-400">🧠</span>
              <span className="text-blue-400 font-medium">AI: {aiProvider}</span>
            </div>
          </div>
        )}

        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || filteredPages.length === 0}
          className="px-8 py-3 bg-linear-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 disabled:from-platinum-600 disabled:to-platinum-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg disabled:shadow-none"
        >
          {isAnalyzing ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analiz Ediliyor...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>Analiz Et</span>
              <span className="opacity-75">•</span>
              <span>{stats.totalWords.toLocaleString()} kelime</span>
              {detectedDocTypes.length > 0 && (
                <>
                  <span className="opacity-75">•</span>
                  <span className="text-blue-300">{detectedDocTypes.length} doküman</span>
                </>
              )}
            </div>
          )}
        </button>

        {filteredPages.length === 0 && (
          <p className="text-sm text-surface-secondary mt-2">
            Analize uygun sayfa bulunamadı. Filtreleri kontrol edin.
          </p>
        )}
      </div>
    </div>
  );
}
