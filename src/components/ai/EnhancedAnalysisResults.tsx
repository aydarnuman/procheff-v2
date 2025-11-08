"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Upload,
  FileText,
  DollarSign,
  Shield,
  BarChart3,
  Download,
  Star,
  Clock,
  Database,
  Brain,
  TrendingUp,
  AlertTriangle,
  Clipboard,
  CheckCircle2,
  Calendar,
  Users,
  ChevronDown,
  Maximize2,
  X,
} from "lucide-react";
import { ReportGenerator } from "@/lib/report/pdf-generator";
import { AIAnalysisResult } from "@/types/ai";
import { ProposalCards } from "@/components/proposal/ProposalCards";
import { DeepAnalysis } from "@/components/ai/DeepAnalysis";
import { DashboardAnalysis } from "@/components/ai/DashboardAnalysis";
import { PaginatedTextViewer } from "@/components/ai/PaginatedTextViewer";
import { PaginatedTablesViewer } from "@/components/ai/PaginatedTablesViewer";
import { CSVCostAnalysis } from "@/components/ihale/CSVCostAnalysis";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { CSVParser } from "@/lib/csv/csv-parser";

interface EnhancedAnalysisResultsProps {
  analysis: AIAnalysisResult;
  onReturnToView: () => void;
  onNewAnalysis: () => void;
  onAddDocument?: () => void; // Mevcut analize ek dosya ekle
  onFilesAdded?: (files: File[]) => void; // Ek dosyalar seçildiğinde
  autoStartDeepAnalysis?: boolean; // Otomatik derin analiz başlatma sinyali
}

export function EnhancedAnalysisResults({
  analysis,
  onReturnToView,
  onNewAnalysis,
  onAddDocument,
  onFilesAdded,
  autoStartDeepAnalysis = false,
}: EnhancedAnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState<"extraction" | "analysis" | "deep">("extraction");
  const [showProposal, setShowProposal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(analysis.extracted_data);
  // Zustand store'dan fonksiyonları üstte çağır
  const { updateDeepAnalysis, removeCSVFile, fileStatuses, csvFiles } = useIhaleStore();

  useEffect(() => {
    if (autoStartDeepAnalysis) {
      setActiveTab("deep");
    }
  }, [autoStartDeepAnalysis]);

  // Collapsible sections state
  const [openTables, setOpenTables] = useState<Record<number, boolean>>({ 0: true }); // İlk tablo açık
  const [showSources, setShowSources] = useState(false);
  const [fullscreenTable, setFullscreenTable] = useState<{ index: number; tablo: any } | null>(null);
  const [veriCikarimTab, setVeriCikarimTab] = useState<"ham-veri" | "tablolar">("ham-veri"); // Tab state
  const [showEvidence, setShowEvidence] = useState(false);

  // CSV analizlerinden toplam maliyeti güvenli şekilde hesapla
  const csvTotalCost = Array.isArray(analysis.csv_analyses)
    ? analysis.csv_analyses.reduce((t, csv) => t + (csv.analysis?.summary?.total_cost ?? 0), 0)
    : 0;

  // Memoize edilmiş tablo tıklama fonksiyonu
  const handleTableClick = useCallback((index: number, tablo: any) => {
    setFullscreenTable({ index, tablo });
  }, []);

  /**
   * 🎯 OPTIMIZED: Ham metni akıllıca formatla (memoized)
   * - Paragrafları ayır
   * - Başlıkları tanı (ALL CAPS veya "MADDE X:" formatı)
   * - Numaralı/tireli listeleri tanı
   * - Markdown benzeri rendering
   */
  const formatSmartText = useCallback((text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let currentList: { type: 'ol' | 'ul'; items: string[] } | null = null;
    let currentParagraph: string[] = [];
    let lineIndex = 0;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const content = currentParagraph.join(' ').trim();
        if (content) {
          elements.push(
            <p key={`p-${lineIndex}`} className="mb-3 text-gray-300 leading-relaxed">
              {content}
            </p>
          );
        }
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (currentList && currentList.items.length > 0) {
        const ListTag = currentList.type === 'ol' ? 'ol' : 'ul';
        elements.push(
          <ListTag
            key={`list-${lineIndex}`}
            className={`mb-4 ml-6 space-y-2 ${
              currentList.type === 'ol' ? 'list-decimal' : 'list-disc'
            } text-gray-300`}
          >
            {currentList.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ListTag>
        );
        currentList = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      lineIndex = i;
      const line = lines[i].trim();

      // Boş satır - paragraf sonu
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      // Başlık tespiti (ALL CAPS, minimum 10 karakter, maksimum 100 karakter)
      const isHeading =
        line.length >= 10 &&
        line.length <= 100 &&
        line === line.toUpperCase() &&
        /^[A-ZÇĞİÖŞÜ0-9\s:.-]+$/.test(line);

      if (isHeading) {
        flushParagraph();
        flushList();
        elements.push(
          <h3
            key={`h-${i}`}
            className="text-cyan-400 font-bold text-base mb-3 mt-4 first:mt-0"
          >
            {line}
          </h3>
        );
        continue;
      }

      // Numaralı liste tespiti (1., 2., 3. veya 1) 2) 3))
      const numberedMatch = line.match(/^(\d+)[.):]\s+(.+)$/);
      if (numberedMatch) {
        flushParagraph();
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(numberedMatch[2]);
        continue;
      }

      // Tireli liste tespiti (-, •, *, →)
      const bulletMatch = line.match(/^[-•*→]\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      // MADDE formatı (MADDE 1:, MADDE 2:, vb.)
      const maddeMatch = line.match(/^(MADDE\s+\d+[.:]?\s*.*?)$/i);
      if (maddeMatch) {
        flushParagraph();
        flushList();
        elements.push(
          <h4
            key={`madde-${i}`}
            className="text-emerald-400 font-semibold text-sm mb-2 mt-3"
          >
            {line}
          </h4>
        );
        continue;
      }

      // Normal paragraf satırı
      currentParagraph.push(line);
    }

    // Son kalanları flush et
    flushParagraph();
    flushList();

    return <div className="space-y-1">{elements}</div>;
  }, []); // 🎯 Empty dependency array - fonksiyon sabit kalır

  if (showProposal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowProposal(false)}
            className="flex items-center space-x-2 px-4 py-2 bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Analize Dön</span>
          </button>
          <h2 className="text-2xl font-bold text-surface-primary">Teklif Hazırlama</h2>
          <div className="w-32" /> {/* Spacer for alignment */}
        </div>

        <ProposalCards analysis={analysis} />
      </motion.div>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-400";
    if (confidence >= 0.6) return "text-yellow-400";
    if (confidence >= 0.4) return "text-orange-400";
    return "text-red-400";
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "dusuk":
        return "text-green-400 bg-green-500/10";
      case "orta":
        return "text-yellow-400 bg-yellow-500/10";
      case "yuksek":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "yeterli":
        return "text-green-400 bg-green-500/10";
      case "sinirda":
        return "text-yellow-400 bg-yellow-500/10";
      case "yetersiz":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  };

  // PDF export fonksiyonu asenkron
  const handleExportPdf = async () => {
    try {
      // Convert AI analysis to legacy format for PDF
      const legacyFormat = {
        generalInfo: {
          title: "Genel Bilgiler",
          content: [
            analysis.extracted_data.kurum,
            analysis.extracted_data.ihale_turu,
            `${analysis.extracted_data.kisi_sayisi} kişi`,
            `${analysis.extracted_data.ogun_sayisi} öğün`,
            `${analysis.extracted_data.gun_sayisi} gün`,
          ].filter(Boolean),
          confidence: (() => {
            console.log('🔍 [CARD DEBUG - Basic Info] guven_skoru:', analysis.extracted_data.guven_skoru);
            return typeof analysis.extracted_data.guven_skoru === 'number' && !isNaN(analysis.extracted_data.guven_skoru) 
              ? analysis.extracted_data.guven_skoru 
              : 0.7;
          })(),
          evidencePassages: Object.values(
            analysis.extracted_data.kanitlar || {}
          ).map(String),
        },
        cost: {
          title: "Maliyet Analizi",
          content: [
            `Tahmini Bütçe: ${analysis.extracted_data.tahmini_butce?.toLocaleString(
              "tr-TR"
            )} TL`,
            `Maliyet Sapma Riski: %${analysis.contextual_analysis?.maliyet_sapma_olasiligi?.oran}`,
          ],
          confidence: analysis.processing_metadata.confidence_score,
          evidencePassages: analysis.contextual_analysis?.maliyet_sapma_olasiligi?.sebepler ?? [],
        },
        risks: {
          title: "Risk Analizi",
          content: analysis.contextual_analysis?.operasyonel_riskler?.faktorler ?? [],
          confidence: analysis.processing_metadata.confidence_score,
          evidencePassages:
            analysis.contextual_analysis?.operasyonel_riskler?.oneriler ?? [],
        },
        menu: {
          title: "Özel Şartlar",
          content: analysis.extracted_data.ozel_sartlar,
          confidence: (() => {
            console.log('🔍 [CARD DEBUG - Menu] guven_skoru:', analysis.extracted_data.guven_skoru);
            return typeof analysis.extracted_data.guven_skoru === 'number' && !isNaN(analysis.extracted_data.guven_skoru) 
              ? analysis.extracted_data.guven_skoru 
              : 0.7;
          })(),
          evidencePassages: analysis.extracted_data.riskler,
        },
        summary: analysis.contextual_analysis?.genel_oneri,
        overallConfidence: analysis.processing_metadata.confidence_score,
        processingTime: analysis.processing_metadata.processing_time,
        wordCount: 0,
        keyTermsFound: [],
        documentMetrics: {
          documentHash: "AI-Generated",
          totalPages: 1,
          averageQuality: analysis.processing_metadata.confidence_score,
          ocrPagesProcessed: 0,
          processingDuration: analysis.processing_metadata.processing_time,
        },
      };

      const fileName = `ai-ihale-analiz-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      const htmlContent = await ReportGenerator.generateHtmlReport(
        legacyFormat,
        fileName
      );
      await ReportGenerator.downloadHtmlAsPdf(htmlContent);
    } catch (error) {
      console.error("PDF export hatası:", error);
      alert("PDF export sırasında hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1" /> {/* Spacer */}
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-accent-400" />
            <h2 className="text-2xl font-bold text-surface-primary">
              AI Analiz Sonuçları
            </h2>
          </div>
          <div className="flex-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onNewAnalysis}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-slate-700/50 border border-slate-700"
            >
              <Upload className="w-4 h-4" />
              <span>Yeni Analiz</span>
            </button>
            <button
              type="button"
              onClick={() => setShowProposal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-slate-700/50 border border-slate-700"
            >
              <Clipboard className="w-4 h-4" />
              <span>Teklif Hazırla</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-8 text-sm bg-slate-800/30 rounded-lg px-6 py-3 border border-slate-700/50">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-accent-400" />
            <span className="text-surface-primary font-medium">
              {analysis.processing_metadata.ai_provider || 'AI'}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-700" /> {/* Divider */}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-surface-secondary" />
            <span className="text-surface-secondary">
              {(analysis.processing_metadata.processing_time / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="w-px h-4 bg-slate-700" /> {/* Divider */}
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-surface-secondary" />
            <span
              className={getConfidenceColor(
                analysis.processing_metadata.confidence_score
              )}
            >
              {(() => {
                const confidenceValue = Math.round(analysis.processing_metadata.confidence_score * 100);
                return isNaN(confidenceValue) ? '70' : confidenceValue;
              })()}%
              güven
            </span>
          </div>
        </div>
      </div>

      {/* Eksik Belge Ekle Butonu */}
      {onFilesAdded && (
        <div className="flex justify-center">
          <label className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-lg hover:shadow-blue-500/30 cursor-pointer">
            <Upload className="w-5 h-5" />
            📎 Eksik Belge Ekle
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.json"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0 && onFilesAdded) {
                  onFilesAdded(files);
                }
                e.target.value = ''; // Reset input
              }}
            />
          </label>
        </div>
      )}

      {/* CSV Maliyet Analizi Kartları */}
      {csvFiles.length > 0 && csvFiles.some(csv => csv.status === 'completed' && csv.analysis) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            📊 Maliyet Analizi
          </h3>
          {csvFiles
            .filter(csv => csv.status === 'completed' && csv.analysis)
            .map((csv, index) => (
              <CSVCostAnalysis
                key={index}
                analysis={csv.analysis!}
                fileName={csv.fileMetadata.name}
                onRemove={() => removeCSVFile(csv.fileMetadata.name)}
              />
            ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="bg-platinum-800/60 rounded-xl p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setActiveTab("extraction")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "extraction"
                ? "bg-accent-500/20 text-accent-400 shadow-sm"
                : "text-surface-secondary hover:text-surface-primary"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Veri Çıkarımı</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analysis")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "analysis"
                ? "bg-accent-500/20 text-accent-400 shadow-sm"
                : "text-surface-secondary hover:text-surface-primary"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <span>Bağlamsal Analiz</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("deep")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "deep"
                ? "bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-lg shadow-purple-500/50 scale-105"
                : "text-surface-secondary hover:text-white hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-orange-500/20"
            }`}
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className={`w-4 h-4 ${activeTab === "deep" ? "animate-pulse" : ""}`} />
              <span className="font-semibold">✨ Derin Analiz</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === "extraction" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Finansal Durum Kartı Kaldırıldı */}

            {/* YENİ: Veri Çıkarımı Tabbed Section - Ham Veri ve Tablolar */}
            {(analysis.extracted_data.veri_havuzu || (analysis.extracted_data.tablolar && analysis.extracted_data.tablolar.length > 0)) && (
              <div className="bg-platinum-800/60 rounded-xl backdrop-blur-sm border border-platinum-700/30 overflow-hidden">
                {/* Tab Header */}
                <div className="flex items-center border-b border-platinum-700/30">
                  <button
                    onClick={() => setVeriCikarimTab("ham-veri")}
                    className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                      veriCikarimTab === "ham-veri"
                        ? "bg-cyan-500/10 border-b-2 border-cyan-400 text-cyan-400"
                        : "text-surface-secondary hover:text-surface-primary hover:bg-platinum-700/30"
                    }`}
                  >
                    <Database className="w-5 h-5" />
                    <span className="font-semibold">Ham Veri</span>
                    {analysis.extracted_data.veri_havuzu && (
                      <span className="text-xs bg-cyan-500/20 px-2 py-0.5 rounded-full">
                        AI
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setVeriCikarimTab("tablolar")}
                    className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                      veriCikarimTab === "tablolar"
                        ? "bg-emerald-500/10 border-b-2 border-emerald-400 text-emerald-400"
                        : "text-surface-secondary hover:text-surface-primary hover:bg-platinum-700/30"
                    }`}
                  >
                    <BarChart3 className="w-5 h-5" />
                    <span className="font-semibold">Tablolar</span>
                    {analysis.extracted_data.tablolar && analysis.extracted_data.tablolar.length > 0 && (
                      <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        {analysis.extracted_data.tablolar.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {/* Ham Veri Tab */}
                  {veriCikarimTab === "ham-veri" && analysis.extracted_data.veri_havuzu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Ham Metin - Paginated */}
                      {analysis.extracted_data.veri_havuzu.ham_metin ? (
                        <PaginatedTextViewer
                          text={analysis.extracted_data.veri_havuzu.ham_metin}
                          linesPerPage={50}
                        />
                      ) : (
                        <div className="bg-platinum-900/60 rounded-lg p-6 border border-platinum-700/20">
                          <div className="text-gray-500 text-center py-8">Veri bulunamadı</div>
                        </div>
                      )}

                      {/* Kaynaklar - Daraltılabilir */}
                      {analysis.extracted_data.veri_havuzu.kaynaklar &&
                       Object.keys(analysis.extracted_data.veri_havuzu.kaynaklar).length > 0 && (
                        <div className="mt-4">
                          <button
                            onClick={() => setShowSources(!showSources)}
                            className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${showSources ? "rotate-180" : ""}`}
                            />
                            <span>
                              Kaynak Detayları ({Object.keys(analysis.extracted_data.veri_havuzu.kaynaklar).length})
                            </span>
                          </button>

                          {showSources && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-3 space-y-2"
                            >
                              {Object.entries(analysis.extracted_data.veri_havuzu.kaynaklar).map(([key, source]) => (
                                <div
                                  key={key}
                                  className="bg-platinum-900/40 rounded p-3 text-xs border border-platinum-700/20"
                                >
                                  <div className="text-cyan-400 font-semibold mb-1">
                                    📌 {source.deger}
                                  </div>
                                  <div className="text-surface-secondary italic mb-1">
                                    📚 Kaynak: "{source.kaynak}"
                                  </div>
                                  <div className="text-surface-secondary/60">
                                    📄 {source.dosya}
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Tablolar Tab - Paginated Market Kart Görünümü */}
                  {veriCikarimTab === "tablolar" && analysis.extracted_data.tablolar && analysis.extracted_data.tablolar.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PaginatedTablesViewer
                        tables={analysis.extracted_data.tablolar}
                        tablesPerPage={6}
                        onTableClick={handleTableClick}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* ESKİ KARTLAR KALDIRILDI - Veri Havuzu ve Tablolar sistemi aktif */}
          </motion.div>
        )}

        {activeTab === "analysis" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Belge Tutarlılığı Analizi Kaldırıldı */}

            {/* Kritik İş Metrikleri - İş Değerlendirmesi için En Önemli Bilgiler */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. İnsan Odaklı Metrikler */}
              <div className="rounded-xl p-4 border border-blue-500/30 bg-blue-500/10">
                <div className="flex items-center space-x-3 mb-3">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-blue-400">İnsan Metrikleri</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {analysis.extracted_data.kisi_sayisi?.toLocaleString('tr-TR') || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-400">Kişi Sayısı</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Süre:</span>
                    <span className="text-white font-medium">{analysis.extracted_data.gun_sayisi || 'N/A'} gün</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Günlük:</span>
                    <span className="text-white font-medium">
                      {analysis.extracted_data.kisi_sayisi && analysis.extracted_data.ogun_sayisi
                        ? (analysis.extracted_data.kisi_sayisi * analysis.extracted_data.ogun_sayisi).toLocaleString('tr-TR')
                        : 'N/A'} porsiyon
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Finansal Özet */}
              <div className="rounded-xl p-4 border border-green-500/30 bg-green-500/10">
                <div className="flex items-center space-x-3 mb-3">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-green-400">Finansal Özet</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {csvTotalCost > 0
                        ? `${(csvTotalCost / 1_000_000).toFixed(1)}M ₺`
                        : analysis.extracted_data.tahmini_butce
                          ? `${(analysis.extracted_data.tahmini_butce / 1_000_000).toFixed(1)}M ₺`
                          : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {csvTotalCost > 0 ? 'Gerçek Maliyet (CSV)' : 'Tahmini Bütçe'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Kişi Başı:</span>
                    <span className="text-white font-medium">
                      {(csvTotalCost > 0 || analysis.extracted_data.tahmini_butce) && analysis.extracted_data.kisi_sayisi
                        ? `${((csvTotalCost > 0 ? csvTotalCost : analysis.extracted_data.tahmini_butce!) / analysis.extracted_data.kisi_sayisi).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    {csvTotalCost > 0 && analysis.extracted_data.tahmini_butce ? (
                      <>
                        <span className="text-gray-400">Fark:</span>
                        <span className={`font-medium ${
                          csvTotalCost > analysis.extracted_data.tahmini_butce ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {csvTotalCost > analysis.extracted_data.tahmini_butce ? '+' : ''}
                          {((csvTotalCost - analysis.extracted_data.tahmini_butce) / 1_000_000).toFixed(1)}M ₺
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-400">Risk:</span>
                        <span className={`font-medium ${
                          analysis.contextual_analysis.operasyonel_riskler.seviye === 'dusuk' ? 'text-green-400' :
                          analysis.contextual_analysis.operasyonel_riskler.seviye === 'orta' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {analysis.contextual_analysis.operasyonel_riskler.seviye === 'dusuk' ? 'Düşük' :
                           analysis.contextual_analysis.operasyonel_riskler.seviye === 'orta' ? 'Orta' : 'Yüksek'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Öğün Dağılımı */}
              <div className="rounded-xl p-4 border border-purple-500/30 bg-purple-500/10">
                <div className="flex items-center space-x-3 mb-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-purple-400">Öğün Dağılımı</span>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const kahvalti = analysis.extracted_data?.detayli_veri?.ogun_dagilimi?.kahvalti;
                    const ogle = analysis.extracted_data?.detayli_veri?.ogun_dagilimi?.ogle;
                    const aksam = analysis.extracted_data?.detayli_veri?.ogun_dagilimi?.aksam;
                    const toplam = analysis.extracted_data?.kisi_sayisi && analysis.extracted_data?.gun_sayisi
                      ? analysis.extracted_data.kisi_sayisi * (analysis.extracted_data.ogun_sayisi ?? 0) * analysis.extracted_data.gun_sayisi
                      : null;

                    if (kahvalti && ogle && aksam) {
                      return (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">☀️ Kahvaltı:</span>
                            <span className="text-white font-medium">{kahvalti.toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">🌞 Öğle:</span>
                            <span className="text-white font-medium">{ogle.toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">🌙 Akşam:</span>
                            <span className="text-white font-medium">{aksam.toLocaleString('tr-TR')}</span>
                          </div>
                        </>
                      );
                    } else if (toplam) {
                      // Eğer öğün dağılımı yoksa, öğün sayısını göster
                      return (
                        <>
                          <div>
                            <p className="text-2xl font-bold text-white">
                              {(analysis.extracted_data.ogun_sayisi ?? 0).toLocaleString('tr-TR')}
                            </p>
                            <p className="text-xs text-gray-400">Günlük Öğün</p>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Toplam:</span>
                            <span className="text-white font-medium">{toplam.toLocaleString('tr-TR')} porsiyon</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Öğün dağılımı belirtilmemiş
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <div className="text-sm text-gray-500">
                          Öğün bilgisi bulunamadı
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* 4. Kritik Tarihler & Durum */}
              <div className="rounded-xl p-4 border border-orange-500/30 bg-orange-500/10">
                <div className="flex items-center space-x-3 mb-3">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  <span className="font-medium text-orange-400">Tarihler</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Son Teklif:</span>
                    <span className="text-white font-medium">
                      {analysis.extracted_data.teklif_son_tarih || 'Belirtilmemiş'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">İşe Başlama:</span>
                    <span className="text-white font-medium">
                      {analysis.extracted_data.ise_baslama_tarih || 'Belirtilmemiş'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Teslim:</span>
                    <span className="text-white font-medium">
                      {analysis.extracted_data.teslim_suresi || 'N/A'}
                    </span>
                  </div>
                  <div className={`text-xs font-medium mt-2 px-2 py-1 rounded ${getStatusColor(
                    analysis.contextual_analysis.zaman_uygunlugu.durum
                  )}`}>
                    {analysis.contextual_analysis.zaman_uygunlugu.durum === 'yeterli' ? '✓ Zaman Yeterli' :
                     analysis.contextual_analysis.zaman_uygunlugu.durum === 'sinirda' ? '⚠ Sınırda' :
                     '✗ Yetersiz'}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Analysis */}
            <div className="space-y-4">
              {/* Cost Deviation Analysis */}
              <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
                <h3 className="text-lg font-semibold text-surface-primary mb-4">
                  Maliyet Sapma Analizi
                </h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-surface-primary font-medium mb-2">Sapma Sebepleri:</h4>
                    <ul className="space-y-1">
                      {analysis.contextual_analysis.maliyet_sapma_olasiligi.sebepler.map((sebep, idx) => (
                        <li key={idx} className="text-surface-secondary text-sm flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-1.5" />
                          <span>{sebep}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-surface-primary font-medium mb-2">Önlem Önerileri:</h4>
                    <ul className="space-y-1">
                      {analysis.contextual_analysis.maliyet_sapma_olasiligi.onlem_oneriler.map((onlem, idx) => (
                        <li key={idx} className="text-surface-secondary text-sm flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5" />
                          <span>{onlem}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="bg-platinum-800/60 rounded-xl p-6 backdrop-blur-sm border border-platinum-700/30">
                <h3 className="text-lg font-semibold text-surface-primary mb-4">
                  Risk Değerlendirmesi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-surface-primary font-medium mb-2">
                      Risk Faktörleri:
                    </h4>
                    <ul className="space-y-1">
                      {analysis.contextual_analysis.operasyonel_riskler.faktorler.map(
                        (faktor, index) => (
                          <li
                            key={index}
                            className="text-surface-secondary text-sm flex items-center space-x-2"
                          >
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                            <span>{faktor}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-surface-primary font-medium mb-2">
                      Öneriler:
                    </h4>
                    <ul className="space-y-1">
                      {analysis.contextual_analysis.operasyonel_riskler.oneriler.map(
                        (oneri, index) => (
                          <li
                            key={index}
                            className="text-surface-secondary text-sm flex items-center space-x-2"
                          >
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                            <span>{oneri}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* General Recommendation */}
              <div className="bg-gradient-to-r from-accent-500/10 to-purple-500/10 rounded-xl p-6 border border-accent-500/30">
                <h3 className="text-lg font-semibold text-surface-primary mb-4">
                  Genel Öneri
                </h3>
                <p className="text-surface-primary leading-relaxed">
                  {analysis.contextual_analysis?.genel_oneri}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "deep" && (
          <DeepAnalysis
            analysis={analysis}
            cachedResult={analysis.deep_analysis || null}
            onAnalysisComplete={updateDeepAnalysis}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4 pt-6 border-t border-platinum-700/30">
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onReturnToView}
            className="flex items-center space-x-2 px-4 py-2 bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Önizlemeye Dön</span>
          </button>
          <button
            type="button"
            onClick={onNewAnalysis}
            className="flex items-center space-x-2 px-4 py-2 bg-platinum-700/50 hover:bg-platinum-700/70 text-surface-primary rounded-xl transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Yeni Analiz</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Analiz sekmesini kapatmak istediğinize emin misiniz?\nKaydedilmemiş veriler kaybolabilir.')) {
                onReturnToView();
              }
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Analizi Kapat</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportPdf}
          className="flex items-center space-x-2 px-6 py-2 bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>PDF İndir</span>
        </button>
      </div>

      {/* Tam Ekran Tablo Modal */}
      {fullscreenTable && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFullscreenTable(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-platinum-900 rounded-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden border border-emerald-500/30 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-platinum-700/30">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-bold text-surface-primary">
                  {fullscreenTable.tablo.baslik}
                </h2>
                <span className="text-xs text-green-300 bg-green-500/20 px-2 py-1 rounded-full">
                  {fullscreenTable.tablo.satir_sayisi} satır
                </span>
                <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded-full">
                  {Math.round(fullscreenTable.tablo.guven * 100)}% güven
                </span>
              </div>
              <button
                onClick={() => setFullscreenTable(null)}
                className="p-2 hover:bg-platinum-700/50 rounded-lg transition-colors"
                title="Kapat"
              >
                <X className="w-5 h-5 text-surface-secondary" />
              </button>
            </div>

            {/* Content - HTML Tablo Görünümü */}
            <div className="p-6 overflow-auto max-h-[calc(95vh-100px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-800/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-600/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-500/70">
              {fullscreenTable.tablo.headers && fullscreenTable.tablo.rows && fullscreenTable.tablo.rows.length > 0 ? (
                <div className="bg-slate-900/80 rounded-lg p-6 border border-emerald-500/30 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-emerald-500/50">
                        {fullscreenTable.tablo.headers.map((header: string, idx: number) => (
                          <th
                            key={idx}
                            className="px-4 py-3 text-left text-sm font-semibold text-emerald-400 bg-slate-800/50"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fullscreenTable.tablo.rows.map((row: string[], rowIdx: number) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
                        >
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className="px-4 py-3 text-sm text-gray-300"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-900/80 rounded-lg p-6 border border-emerald-500/30 text-center text-gray-500">
                  Tablo verisi yok
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
