"use client";

import { motion } from "framer-motion";
import {
  Eye,
  Upload,
  FileText,
  DollarSign,
  Shield,
  Utensils,
  BarChart3,
  Download,
  Star,
  Clock,
} from "lucide-react";
import { ReportGenerator } from "@/lib/report/pdf-generator";

interface AnalysisCategory {
  title: string;
  content: string[];
  confidence: number;
  evidencePassages: string[];
  keyMetrics?: { [key: string]: string | number };
}

interface DetailedAnalysis {
  generalInfo: AnalysisCategory;
  cost: AnalysisCategory;
  risks: AnalysisCategory;
  menu: AnalysisCategory;
  summary: string;
  overallConfidence: number;
  processingTime: number;
  wordCount: number;
  keyTermsFound: string[];
  documentMetrics?: {
    documentHash: string;
    totalPages: number;
    averageQuality: number;
    ocrPagesProcessed: number;
    processingDuration: number;
  };
}

interface AnalysisResultsProps {
  analysis: DetailedAnalysis;
  onReturnToView: () => void;
  onNewAnalysis: () => void;
}

export function AnalysisResults({
  analysis,
  onReturnToView,
  onNewAnalysis,
}: AnalysisResultsProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-400";
    if (confidence >= 0.6) return "text-yellow-400";
    if (confidence >= 0.4) return "text-orange-400";
    return "text-red-400";
  };

  const handleExportPdf = () => {
    try {
      // Analiz verilerini PDF rapor formatına uygun hale getir
      const reportData = {
        ...analysis,
        documentMetrics: analysis.documentMetrics || {
          documentHash: "N/A",
          totalPages: 0,
          averageQuality: 0,
          ocrPagesProcessed: 0,
          processingDuration: analysis.processingTime,
        },
      };

      const fileName = `ihale-analiz-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      const htmlContent = ReportGenerator.generateHtmlReport(
        reportData,
        fileName
      );

      // HTML'i yeni pencerede aç ve print dialog'u başlat
      ReportGenerator.downloadHtmlAsPdf(htmlContent);
    } catch (error) {
      console.error("PDF export hatası:", error);
      alert("PDF export sırasında hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  const categories = [
    {
      data: analysis.generalInfo,
      icon: FileText,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/30",
    },
    {
      data: analysis.cost,
      icon: DollarSign,
      color: "text-green-400",
      bgColor: "bg-green-500/10 border-green-500/30",
    },
    {
      data: analysis.risks,
      icon: Shield,
      color: "text-red-400",
      bgColor: "bg-red-500/10 border-red-500/30",
    },
    {
      data: analysis.menu,
      icon: Utensils,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/30",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-surface-primary">
            Analiz Sonuçları
          </h3>
          <div className="flex items-center space-x-4 mt-2 text-sm text-surface-secondary">
            <span className="flex items-center space-x-1">
              <BarChart3 className="w-4 h-4" />
              <span>
                Güven: {(() => {
                  const confidenceValue = Math.round(analysis.overallConfidence * 100);
                  console.log('🔍 [UI DEBUG] analysis.overallConfidence:', analysis.overallConfidence);
                  console.log('🔍 [UI DEBUG] Calculated percentage:', confidenceValue);
                  console.log('🔍 [UI DEBUG] isNaN check:', isNaN(confidenceValue));
                  return isNaN(confidenceValue) ? '70' : confidenceValue;
                })()}%
              </span>
            </span>
            <span className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{Math.round(analysis.processingTime / 1000)}s</span>
            </span>
            <span>{analysis.wordCount} kelime</span>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onReturnToView}
            className="flex items-center px-4 py-2 bg-platinum-700 text-surface-primary rounded-xl hover:bg-platinum-600 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            Belgeye Dön
          </button>
          <button
            onClick={onNewAnalysis}
            className="flex items-center px-4 py-2 bg-accent-500 text-white rounded-xl hover:bg-accent-600 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Yeni Analiz
          </button>
        </div>
      </div>

      {/* Genel Özet */}
      <div className="bg-platinum-800/60 rounded-xl p-6 border border-platinum-600">
        <h4 className="text-lg font-semibold text-surface-primary mb-3 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-accent-400" />
          Genel Özet
        </h4>
        <p className="text-surface-secondary leading-relaxed">
          {analysis.summary}
        </p>

        {/* Anahtar Terimler */}
        {analysis.keyTermsFound.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-surface-primary mb-2">
              Tespit Edilen Anahtar Terimler:
            </h5>
            <div className="flex flex-wrap gap-2">
              {analysis.keyTermsFound.slice(0, 10).map((term, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-accent-500/20 text-accent-400 rounded text-xs"
                >
                  {term}
                </span>
              ))}
              {analysis.keyTermsFound.length > 10 && (
                <span className="text-xs text-surface-secondary">
                  +{analysis.keyTermsFound.length - 10} terim daha
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kategoriler */}
      <div className="grid md:grid-cols-2 gap-6">
        {categories.map((category, index) => {
          const IconComponent = category.icon;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-xl p-6 border ${category.bgColor}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-surface-primary flex items-center">
                  <IconComponent className={`w-5 h-5 mr-2 ${category.color}`} />
                  {category.data.title}
                </h4>
                <div className="flex items-center space-x-2">
                  <div
                    className={`flex items-center space-x-1 text-sm ${getConfidenceColor(
                      category.data.confidence
                    )}`}
                  >
                    <Star className="w-4 h-4" />
                    <span>
                      {(() => {
                        const conf = category.data.confidence;
                        const percentage = Math.round((typeof conf === 'number' && !isNaN(conf) ? conf : 0.7) * 100);
                        return percentage;
                      })()}%
                    </span>
                  </div>
                </div>
              </div>

              {/* İçerik */}
              <div className="space-y-3">
                {category.data.content.length > 0 ? (
                  <ul className="space-y-2">
                    {category.data.content.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-surface-secondary text-sm flex items-start"
                      >
                        <span className="w-1.5 h-1.5 bg-accent-400 rounded-full mt-2 mr-3 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-surface-secondary text-sm italic">
                    Bu kategori için yeterli bilgi bulunamadı
                  </p>
                )}

                {/* Key Metrics */}
                {category.data.keyMetrics &&
                  Object.keys(category.data.keyMetrics).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-platinum-600">
                      <h5 className="text-sm font-medium text-surface-primary mb-2">
                        Önemli Bilgiler:
                      </h5>
                      <div className="space-y-1">
                        {Object.entries(category.data.keyMetrics).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-surface-secondary">
                                {key}:
                              </span>
                              <span className="text-surface-primary font-medium">
                                {value}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Kanıt Pasajları */}
                {category.data.evidencePassages.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-sm font-medium text-surface-primary cursor-pointer hover:text-accent-400 transition-colors">
                      Kanıt Pasajları ({category.data.evidencePassages.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {category.data.evidencePassages
                        .slice(0, 3)
                        .map((passage, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-surface-secondary bg-platinum-900/50 p-2 rounded"
                          >
                            {passage}
                          </div>
                        ))}
                      {category.data.evidencePassages.length > 3 && (
                        <p className="text-xs text-surface-secondary italic">
                          ... ve {category.data.evidencePassages.length - 3}{" "}
                          kanıt daha
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Rapor İndirme */}
      <div className="flex justify-center">
        <button
          onClick={handleExportPdf}
          className="flex items-center px-6 py-3 bg-linear-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg"
        >
          <Download className="w-5 h-5 mr-2" />
          PDF Rapor İndir
        </button>
      </div>
    </motion.div>
  );
}
