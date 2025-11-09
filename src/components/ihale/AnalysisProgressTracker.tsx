"use client";

import { motion } from "framer-motion";
import { 
  Loader2, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Database,
  Brain,
  FileText,
  Search,
  Shield
} from "lucide-react";

interface AnalysisProgressTrackerProps {
  stage: string;
  progress: number;
  details?: string;
}

/**
 * Real-time analiz progress tracker
 * SSE stream'den gelen stage/progress verilerini görsel olarak gösterir
 */
export function AnalysisProgressTracker({ 
  stage, 
  progress, 
  details 
}: AnalysisProgressTrackerProps) {
  
  // Stage'e göre ikon seç
  const getStageIcon = (stageText: string) => {
    if (stageText.includes('başlatılıyor') || stageText.includes('Starting')) {
      return <Loader2 className="w-5 h-5 animate-spin" />;
    }
    if (stageText.includes('tespit') || stageText.includes('Detection')) {
      return <Search className="w-5 h-5" />;
    }
    if (stageText.includes('veri') || stageText.includes('Extraction')) {
      return <Database className="w-5 h-5" />;
    }
    if (stageText.includes('tablo') || stageText.includes('CSV')) {
      return <FileText className="w-5 h-5" />;
    }
    if (stageText.includes('validation') || stageText.includes('kontrol')) {
      return <Shield className="w-5 h-5" />;
    }
    if (stageText.includes('Stratejik') || stageText.includes('Strategic')) {
      return <Brain className="w-5 h-5" />;
    }
    if (stageText.includes('Tamamlandı') || stageText.includes('Complete')) {
      return <CheckCircle className="w-5 h-5" />;
    }
    return <TrendingUp className="w-5 h-5" />;
  };

  // Progress rengi (0-100 arası)
  const getProgressColor = (p: number) => {
    if (p < 25) return "from-blue-500 to-blue-600";
    if (p < 50) return "from-purple-500 to-purple-600";
    if (p < 75) return "from-pink-500 to-pink-600";
    if (p < 95) return "from-orange-500 to-orange-600";
    return "from-green-500 to-green-600";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-accent-400">
            {getStageIcon(stage)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-surface-primary">
              AI Analizi Devam Ediyor
            </h3>
            <p className="text-sm text-surface-secondary">
              {stage}
            </p>
          </div>
        </div>
        
        {/* Progress percentage */}
        <div className="text-right">
          <div className="text-2xl font-bold text-accent-400">
            {Math.round(progress)}%
          </div>
          <div className="text-xs text-surface-secondary flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>~{Math.round((100 - progress) / 2)}s kaldı</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-slate-900/50 rounded-full overflow-hidden mb-3">
        <motion.div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor(progress)} rounded-full`}
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ["0%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Details */}
      {details && (
        <p className="text-sm text-surface-secondary">
          {details}
        </p>
      )}

      {/* Stage indicators */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {[
          { label: "Başlangıç", threshold: 10 },
          { label: "Veri Çıkarımı", threshold: 50 },
          { label: "Validation", threshold: 65 },
          { label: "Strateji", threshold: 80 },
          { label: "Tamamlanıyor", threshold: 95 }
        ].map((s, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-colors duration-300 ${
              progress >= s.threshold 
                ? "bg-accent-400" 
                : "bg-slate-700/30"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}
