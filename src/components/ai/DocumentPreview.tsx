"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Clock,
  Upload,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FileProcessingStatus, CSVFileStatus } from '@/lib/stores/ihale-store';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';

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
  totalFilesCount?: number; // Total number of files (PDF + CSV)
  csvFilesCount?: number; // Number of CSV files
  onAddFiles?: () => void; // Callback to add more files in Stage 2
  fileStatuses?: FileProcessingStatus[]; // Detailed file information
  csvFiles?: CSVFileStatus[]; // Detailed CSV file information
}

export function DocumentPreview({
  pages,
  stats,
  warnings,
  onAnalyze,
  isAnalyzing,
  detectedDocTypes = [],
  aiProvider = 'Claude Sonnet 4',
  totalFilesCount = 0,
  csvFilesCount = 0,
  onAddFiles,
  fileStatuses = [],
  csvFiles = [],
}: DocumentPreviewProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [showEmptyPages, setShowEmptyPages] = useState(false);
  const [filterQuality, setFilterQuality] = useState<"all" | "high" | "low">(
    "all"
  );
  const [showFileDetails, setShowFileDetails] = useState(false);

  // Filtreleme
  const filteredPages = pages.filter((page) => {
    // Boş sayfa filtresi
    if (!showEmptyPages && page.isEmpty) return false;

    // Kalite filtresi
    if (filterQuality === "high" && page.quality < 0.7) return false;
    if (filterQuality === "low" && page.quality >= 0.7) return false;

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
      {/* Stage Indicator - Outside Card */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/30 blur-lg rounded-xl"></div>
          <div className="relative px-4 py-2 bg-gradient-to-r from-green-500/30 to-emerald-600/20 border border-green-400/50 rounded-xl shadow-lg shadow-green-500/20">
            <span className="text-green-300 font-bold text-base tracking-wide">2️⃣ İKİNCİ AŞAMA</span>
          </div>
        </div>
        <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>
        <h3 className="text-2xl font-bold text-white tracking-tight">AI Analizi Hazır</h3>
        <div className="flex-1"></div>
        <p className="text-sm text-gray-300 font-medium">
          ✅ Dosyalarınız işlendi ve analiz için hazır
        </p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-5 border border-purple-500/30 hover:border-purple-500/50 transition-all shadow-lg hover:shadow-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-purple-400">
              {stats.totalPages}
            </div>
            <FileText className="w-8 h-8 text-purple-400/50" />
          </div>
          <div className="text-sm text-gray-400 font-medium">Toplam Sayfa</div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-5 border border-green-500/30 hover:border-green-500/50 transition-all shadow-lg hover:shadow-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-green-400">
              {stats.totalWords.toLocaleString()}
            </div>
            <span className="text-2xl">📝</span>
          </div>
          <div className="text-sm text-gray-400 font-medium">Toplam Kelime</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-5 border border-blue-500/30 hover:border-blue-500/50 transition-all shadow-lg hover:shadow-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-blue-400">
              {Math.round(stats.averageQuality * 100)}%
            </div>
            <BarChart3 className="w-8 h-8 text-blue-400/50" />
          </div>
          <div className="text-sm text-gray-400 font-medium">Ortalama Kalite</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl p-5 border border-amber-500/30 hover:border-amber-500/50 transition-all shadow-lg hover:shadow-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-amber-400">
              {totalFilesCount || stats.totalPages}
            </div>
            <span className="text-3xl">📁</span>
          </div>
          <div className="text-sm text-gray-400 font-medium">
            {totalFilesCount > 0 ? (
              <>
                {totalFilesCount - (csvFilesCount || 0)} PDF/DOC
                {csvFilesCount > 0 && ` + ${csvFilesCount} CSV`}
              </>
            ) : (
              'Toplam Dosya'
            )}
          </div>
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
        {/* Add More Files Button */}
        {onAddFiles && (
          <button
            onClick={onAddFiles}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-blue-500/30"
          >
            <Plus className="w-4 h-4" />
            <span>Ek Dosya Ekle</span>
          </button>
        )}

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
            whileHover={{ scale: 1.02 }}
            className={`p-5 rounded-xl border transition-all cursor-pointer shadow-md ${
              selectedPage === page.pageNumber
                ? "border-accent-400 bg-gradient-to-br from-accent-500/20 to-accent-600/10 shadow-accent-500/30"
                : `border-slate-600 bg-gradient-to-br from-slate-800/80 to-slate-900/40 hover:border-slate-500 hover:shadow-lg ${getQualityBg(
                    page.quality
                  )}`
            }`}
            onClick={() =>
              setSelectedPage(
                selectedPage === page.pageNumber ? null : page.pageNumber
              )
            }
          >
            {/* Başlık Bölümü */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-700/50 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <span className="font-bold text-white text-base">
                  Sayfa {page.pageNumber}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {page.isEmpty ? (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
                <span
                  className={`text-base font-bold px-2 py-1 rounded-lg ${
                    page.quality >= 0.8 ? 'bg-green-500/20 text-green-400' :
                    page.quality >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}
                >
                  {Math.round(page.quality * 100)}%
                </span>
              </div>
            </div>

            {/* İçerik */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>📝</span> Kelime sayısı:
                </span>
                <span className="font-bold text-white">{page.wordCount.toLocaleString()}</span>
              </div>

              {page.keyTerms.length > 0 && (
                <div>
                  <div className="text-gray-400 mb-2 text-xs font-medium">
                    🏷️ Anahtar terimler:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {page.keyTerms.slice(0, 3).map((term, index) => (
                      <span
                        key={index}
                        className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium border border-blue-500/30"
                      >
                        {term}
                      </span>
                    ))}
                    {page.keyTerms.length > 3 && (
                      <span className="px-2.5 py-1 bg-slate-700/50 text-gray-400 rounded-lg text-xs">
                        +{page.keyTerms.length - 3} daha
                      </span>
                    )}
                  </div>
                </div>
              )}

              {page.isEmpty && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs font-medium">
                  ⚠️ Bu sayfa boş veya okunamadı
                </div>
              )}

              {/* Önizle Butonu */}
              <div className="pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPage(
                      selectedPage === page.pageNumber ? null : page.pageNumber
                    );
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/30 rounded-lg text-accent-400 hover:text-accent-300 transition-all font-medium text-sm"
                >
                  {selectedPage === page.pageNumber ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span>Gizle</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>İçeriği Görüntüle</span>
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
      <div className="space-y-6">
        {/* AI Provider ve Doküman Bilgisi - Modernized */}
        {(detectedDocTypes.length > 0 || totalFilesCount > 0) && (
          <div className="bg-gradient-to-r from-slate-800/50 via-slate-800/30 to-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              {/* Sol: Dosya Bilgisi - Tıklanabilir */}
              <button
                onClick={() => setShowFileDetails(!showFileDetails)}
                className="flex items-center gap-4 hover:bg-slate-700/30 p-3 rounded-xl transition-colors"
              >
                <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
                  <span className="text-2xl">📋</span>
                </div>
                <div className="text-left">
                  <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                    Yüklenecek Dökümanlar
                    {showFileDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {totalFilesCount > 0 ? (
                      <>
                        <span className="text-lg font-bold text-white">
                          {totalFilesCount - (csvFilesCount || 0)} PDF/DOC
                        </span>
                        {csvFilesCount > 0 && (
                          <>
                            <span className="text-gray-500">+</span>
                            <span className="text-lg font-bold text-emerald-400">
                              {csvFilesCount} CSV
                            </span>
                          </>
                        )}
                        <span className="text-sm text-gray-500 ml-1">
                          ({totalFilesCount} toplam)
                        </span>
                      </>
                    ) : (
                      <span className="text-white font-medium">
                        {detectedDocTypes.length} belge türü
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Orta: Separator */}
              <div className="h-12 w-px bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>

              {/* Sağ: AI Provider */}
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                  <span className="text-2xl">🧠</span>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">AI Motoru</div>
                  <div className="text-lg font-bold text-blue-400">{aiProvider}</div>
                </div>
              </div>
            </div>

            {/* Dosya Detay Listesi - Expandable */}
            {showFileDetails && (fileStatuses.length > 0 || csvFiles.length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-slate-700"
              >
                <div className="space-y-2">
                  {/* PDF/DOC Files */}
                  {fileStatuses.map((file, index) => (
                    <div
                      key={`${file.fileMetadata.name}-${index}`}
                      className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                    >
                      <span className="text-xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {file.fileMetadata.name}
                          </span>
                          {file.detectedType && file.detectedType !== 'belirsiz' && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-medium flex-shrink-0">
                              {BELGE_TURU_LABELS[file.detectedType as BelgeTuru]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{(file.fileMetadata.size / 1024 / 1024).toFixed(2)} MB</span>
                          {file.status === 'completed' && file.wordCount && (
                            <span className="text-green-400">✓ {file.wordCount.toLocaleString()} kelime</span>
                          )}
                          {file.status === 'processing' && (
                            <span className="text-blue-400">🔄 İşleniyor...</span>
                          )}
                          {file.status === 'pending' && (
                            <span className="text-yellow-400">⏳ Bekliyor</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* CSV Files */}
                  {csvFiles.map((csv, index) => (
                    <div
                      key={`csv-${csv.fileMetadata.name}-${index}`}
                      className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-emerald-700/50 hover:border-emerald-600 transition-colors"
                    >
                      <span className="text-xl">📊</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {csv.fileMetadata.name}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium flex-shrink-0">
                            CSV Maliyet
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{(csv.fileMetadata.size / 1024).toFixed(2)} KB</span>
                          {csv.status === 'completed' && csv.analysis && (
                            <span className="text-emerald-400">
                              ✓ {csv.analysis.summary.total_items} ürün • {csv.analysis.summary.total_cost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                            </span>
                          )}
                          {csv.status === 'processing' && (
                            <span className="text-blue-400">🔄 İşleniyor...</span>
                          )}
                          {csv.status === 'pending' && (
                            <span className="text-yellow-400">⏳ Bekliyor</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Analiz Et Butonu - Improved */}
        <div className="text-center">
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || filteredPages.length === 0}
            className="px-12 py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-platinum-600 disabled:to-platinum-700 text-white font-bold rounded-2xl transition-all duration-300 shadow-2xl hover:shadow-green-500/50 disabled:shadow-none hover:scale-105 disabled:scale-100 transform"
          >
            {isAnalyzing ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-lg">Analiz Ediliyor...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-3 text-xl">
                  <span>🚀</span>
                  <span>Analiz Et</span>
                </div>
                <div className="flex items-center justify-center gap-3 text-sm opacity-90 font-normal">
                  <span className="px-3 py-1 bg-white/20 rounded-lg">
                    {totalFilesCount - (csvFilesCount || 0)} PDF/DOC
                  </span>
                  {csvFilesCount > 0 && (
                    <span className="px-3 py-1 bg-white/20 rounded-lg">
                      {csvFilesCount} CSV
                    </span>
                  )}
                  <span className="opacity-75">•</span>
                  <span className="font-medium">{stats.totalWords.toLocaleString()} kelime</span>
                </div>
              </div>
            )}
          </button>

          {filteredPages.length === 0 && (
            <p className="text-sm text-surface-secondary mt-4">
              Analize uygun sayfa bulunamadı. Filtreleri kontrol edin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
