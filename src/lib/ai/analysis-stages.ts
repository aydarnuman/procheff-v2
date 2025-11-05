/**
 * Analysis Stages - Fixed progress mapping
 *
 * Bu harita backend'in hangi aşamada olduğunu ve progress %'sini tutarlı gösterir.
 * Frontend bu değerlere göre progress bar günceller.
 */

export interface AnalysisStage {
  key: string;
  message: string;
  progress: number;
  emoji: string;
}

export const ANALYSIS_STAGES = {
  STARTING: {
    key: 'starting',
    message: 'AI analizi başlatılıyor...',
    progress: 5,
    emoji: '🚀'
  },
  PROVIDER_SELECTION: {
    key: 'provider_selection',
    message: 'AI sağlayıcıları seçiliyor...',
    progress: 10,
    emoji: '🤖'
  },
  DOCUMENT_DETECTION: {
    key: 'document_detection',
    message: 'Belgeler tespit ediliyor...',
    progress: 12,
    emoji: '📋'
  },
  CONTEXT_ANALYSIS: {
    key: 'context_analysis',
    message: 'Türkçe bağlam analizi yapılıyor...',
    progress: 15,
    emoji: '🔍'
  },
  DATA_EXTRACTION_START: {
    key: 'data_extraction_start',
    message: 'AI veri çıkarımı başladı...',
    progress: 20,
    emoji: '⚙️'
  },
  DOCUMENT_PROCESSING: {
    key: 'document_processing',
    message: 'Belgeler işleniyor...',
    progress: 25,
    emoji: '📄'
  },
  DATA_EXTRACTION_COMPLETE: {
    key: 'data_extraction_complete',
    message: 'Veri çıkarımı tamamlandı',
    progress: 50,
    emoji: '✅'
  },
  CSV_INTEGRATION: {
    key: 'csv_integration',
    message: 'CSV maliyet verileri entegre ediliyor...',
    progress: 52,
    emoji: '📊'
  },
  CSV_COMPLETE: {
    key: 'csv_complete',
    message: 'CSV tabloları eklendi',
    progress: 55,
    emoji: '✅'
  },
  VALIDATION: {
    key: 'validation',
    message: 'Veri doğrulama yapılıyor...',
    progress: 60,
    emoji: '✔️'
  },
  FINANCIAL_CONTROL: {
    key: 'financial_control',
    message: 'Finansal kontrol hesaplanıyor...',
    progress: 65,
    emoji: '💰'
  },
  CLAUDE_FALLBACK: {
    key: 'claude_fallback',
    message: 'Kritik alanlar için Claude fallback...',
    progress: 70,
    emoji: '🔄'
  },
  STRATEGIC_ANALYSIS: {
    key: 'strategic_analysis',
    message: 'Stratejik analiz yapılıyor...',
    progress: 75,
    emoji: '📊'
  },
  FINALIZING: {
    key: 'finalizing',
    message: 'Analiz tamamlandı',
    progress: 95,
    emoji: '📋'
  },
  COMPLETE: {
    key: 'complete',
    message: 'Tamamlandı!',
    progress: 100,
    emoji: '🎉'
  },
  // Fallback stages
  GEMINI_FALLBACK: {
    key: 'gemini_fallback',
    message: 'Claude fallback aktif...',
    progress: 40,
    emoji: '🔄'
  }
} as const;

// Document-specific progress ranges (25-45 arası dinamik dağılım)
export function getDocumentProcessingProgress(index: number, total: number): number {
  const startProgress = 25;
  const endProgress = 45;
  const range = endProgress - startProgress;
  return startProgress + Math.floor((range / total) * (index + 1));
}

// Helper function to create progress event data
export function createProgressEvent(
  stage: AnalysisStage,
  details?: string
): {
  type: 'progress';
  stage: string;
  progress: number;
  details?: string;
  timestamp: number;
} {
  return {
    type: 'progress',
    stage: `${stage.emoji} ${stage.message}`,
    progress: stage.progress,
    details,
    timestamp: Date.now()
  };
}

// Helper function to create custom document stage
export function createDocumentStage(
  docType: string,
  emoji: string,
  message: string,
  progress: number
): {
  type: 'progress';
  stage: string;
  progress: number;
  timestamp: number;
} {
  return {
    type: 'progress',
    stage: `${emoji} ${message}`,
    progress,
    timestamp: Date.now()
  };
}
