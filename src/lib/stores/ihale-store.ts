import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AIAnalysisResult, BelgeTuru, IhaleStatus } from '@/types/ai';
import { CSVCostAnalysis } from '@/lib/csv/csv-parser';

/**
 * İhale State Management with Zustand
 *
 * Mevcut problem: 15+ useState hook ile state chaos
 * Çözüm: Merkezi state yönetimi
 */

// File metadata (File objesi yerine - serializable)
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url?: string; // 🆕 İhale Robotu'ndan gelen dosyalar için indirme URL'i
}

export interface FileProcessingStatus {
  // File objesi KALDIRILDI - sadece metadata
  fileMetadata: FileMetadata;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: string;
  progressPercentage?: number; // 0-100 arası gerçek zamanlı progress
  wordCount?: number;
  error?: string;
  extractedText?: string;
  // YENİ: Belge türü tespiti
  detectedType?: BelgeTuru;
  detectedTypeConfidence?: number;
}

export interface CSVFileStatus {
  // File objesi KALDIRILDI - sadece metadata
  fileMetadata: FileMetadata;
  status: 'pending' | 'processing' | 'completed' | 'error';
  analysis?: CSVCostAnalysis;
  error?: string;
}

export interface IhaleState {
  // Current Analysis State
  currentAnalysis: AIAnalysisResult | null;
  fileStatuses: FileProcessingStatus[];
  isProcessing: boolean;
  currentStep: 'upload' | 'processing' | 'view' | 'analyze' | 'results';

  // CSV Data (separate from regular documents)
  csvFiles: CSVFileStatus[];

  // Analysis History (localStorage'da saklanacak)
  analysisHistory: AIAnalysisResult[];

  // 🆕 Auto-Analysis Preview (İhale seçildiğinde otomatik işleme)
  autoAnalysisPreview: {
    isProcessing: boolean;
    stage: 'idle' | 'csv-processing' | 'txt-processing' | 'ai-analyzing' | 'completed';
    progress: number; // 0-100
    summary: {
      csvItemCount?: number;
      totalCost?: number;
      missingColumns?: string[];
      confidence?: number;
    } | null;
  };

  // Actions
  setCurrentAnalysis: (analysis: AIAnalysisResult | null) => void;
  setFileStatuses: (statuses: FileProcessingStatus[]) => void;
  addFileStatus: (status: FileProcessingStatus) => void;
  updateFileStatus: (fileName: string, updates: Partial<FileProcessingStatus>) => void;
  removeFileStatus: (fileName: string) => void;
  clearFileStatuses: () => void;
  setIsProcessing: (processing: boolean) => void;
  setCurrentStep: (step: 'upload' | 'processing' | 'view' | 'analyze' | 'results') => void;

  // CSV Actions
  addCSVFile: (status: CSVFileStatus) => void;
  updateCSVFile: (fileName: string, updates: Partial<CSVFileStatus>) => void;
  removeCSVFile: (fileName: string) => void;
  clearCSVFiles: () => void;

  // History Actions
  addToHistory: (analysis: AIAnalysisResult) => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
  updateProposalData: (index: number, proposalData: any) => void;
  updateDeepAnalysis: (deepAnalysis: any) => void; // Derin analiz güncelle (currentAnalysis için)
  updateStatus: (index: number, status: IhaleStatus) => void;

  // 🆕 Auto-Analysis Preview Actions
  setAutoAnalysisPreview: (preview: Partial<IhaleState['autoAnalysisPreview']>) => void;
  resetAutoAnalysisPreview: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentAnalysis: null,
  fileStatuses: [],
  csvFiles: [],
  isProcessing: false,
  currentStep: 'upload' as const,
  analysisHistory: [],
  autoAnalysisPreview: {
    isProcessing: false,
    stage: 'idle' as const,
    progress: 0,
    summary: null,
  },
};

/**
 * İhale Store - SADECE ANALIZ SONUÇLARINI PERSIST ET
 *
 * ✅ localStorage'da saklanır: currentAnalysis, analysisHistory
 * ❌ localStorage'da SAKLANMAZ: fileStatuses, csvFiles, isProcessing
 *
 * Kullanıcı analiz sonuçlarını isterse kapatabilir (localStorage'ı temizle)
 */
export const useIhaleStore = create<IhaleState>()(
  persist(
    (set, get) => ({
      ...initialState,

  // Current Analysis
  setCurrentAnalysis: (analysis) => {
    set({ currentAnalysis: analysis });
    // History'e ekle (eğer yeni analiz tamamlandıysa)
    if (analysis) {
      const history = get().analysisHistory;
      // Aynı analiz zaten varsa ekleme
      const exists = history.some(
        h => h.extracted_data.kurum === analysis.extracted_data.kurum &&
             h.processing_metadata.processing_time === analysis.processing_metadata.processing_time
      );
      if (!exists) {
        set({ analysisHistory: [...history, analysis] });
      }
    }
  },

  // File Statuses
  setFileStatuses: (statuses) => set({ fileStatuses: statuses }),

  addFileStatus: (status) => {
    const current = get().fileStatuses;

    // Duplicate kontrolü - aynı dosya zaten varsa ekleme
    const exists = current.some(fs => fs.fileMetadata.name === status.fileMetadata.name);
    if (exists) {
      console.log(`⚠️ [STORE] Dosya zaten mevcut, eklenmedi:`, status.fileMetadata.name);
      return;
    }

    console.log(`📥 [STORE] addFileStatus çağrıldı:`, {
      fileName: status.fileMetadata.name,
      detectedType: status.detectedType,
      status: status.status,
      currentCount: current.length,
      newCount: current.length + 1
    });
    set({ fileStatuses: [...current, status] });
    console.log(`✅ [STORE] Dosya eklendi - Toplam dosya: ${current.length + 1}`);
  },

  updateFileStatus: (fileName, updates) => {
    const current = get().fileStatuses;
    const updated = current.map(fs =>
      fs.fileMetadata.name === fileName ? { ...fs, ...updates } : fs
    );
    console.log(`🔄 updateFileStatus called for: ${fileName}`, updates);
    console.log(`   Status: ${updates.status}, WordCount: ${updates.wordCount}`);
    set({ fileStatuses: updated });
  },

  removeFileStatus: (fileName) => {
    const current = get().fileStatuses;
    set({ fileStatuses: current.filter(fs => fs.fileMetadata.name !== fileName) });
  },

  clearFileStatuses: () => set({ fileStatuses: [] }),

  // Processing State
  setIsProcessing: (processing) => set({ isProcessing: processing }),

  setCurrentStep: (step) => set({ currentStep: step }),

  // CSV Actions
  addCSVFile: (status) => {
    const current = get().csvFiles;

    // Duplicate kontrolü - aynı dosya zaten varsa ekleme
    const exists = current.some(csv => csv.fileMetadata.name === status.fileMetadata.name);
    if (exists) {
      console.log(`⚠️ [STORE] CSV dosyası zaten mevcut, eklenmedi:`, status.fileMetadata.name);
      return;
    }

    set({ csvFiles: [...current, status] });
  },

  updateCSVFile: (fileName, updates) => {
    const current = get().csvFiles;
    const updated = current.map(csv =>
      csv.fileMetadata.name === fileName ? { ...csv, ...updates } : csv
    );
    set({ csvFiles: updated });
  },

  removeCSVFile: (fileName) => {
    const current = get().csvFiles;
    set({ csvFiles: current.filter(csv => csv.fileMetadata.name !== fileName) });
  },

  clearCSVFiles: () => set({ csvFiles: [] }),

  // History
  addToHistory: (analysis) => {
    const history = get().analysisHistory;
    set({ analysisHistory: [...history, analysis] });
  },

  clearHistory: () => set({ analysisHistory: [] }),

  removeFromHistory: (index) => {
    const history = get().analysisHistory;
    set({ analysisHistory: history.filter((_, i) => i !== index) });
  },

  updateProposalData: (index, proposalData) => {
    const history = get().analysisHistory;
    const updated = history.map((item, i) =>
      i === index ? { ...item, proposal_data: proposalData } : item
    );
    set({ analysisHistory: updated });
  },

  updateDeepAnalysis: (deepAnalysis) => {
    const current = get().currentAnalysis;
    if (current) {
      const updated = { ...current, deep_analysis: deepAnalysis };
      set({ currentAnalysis: updated });

      // History'de de güncelle (eğer varsa)
      const history = get().analysisHistory;
      const historyIndex = history.findIndex(
        h => h.extracted_data.kurum === current.extracted_data.kurum &&
             h.processing_metadata.processing_time === current.processing_metadata.processing_time
      );
      if (historyIndex !== -1) {
        const updatedHistory = history.map((item, i) =>
          i === historyIndex ? updated : item
        );
        set({ analysisHistory: updatedHistory });
      }
    }
  },

  updateStatus: (index, status) => {
    const history = get().analysisHistory;
    const updated = history.map((item, i) =>
      i === index ? { ...item, status } : item
    );
    set({ analysisHistory: updated });
  },

  // 🆕 Auto-Analysis Preview Actions
  setAutoAnalysisPreview: (preview) => {
    const current = get().autoAnalysisPreview;
    set({ autoAnalysisPreview: { ...current, ...preview } });
  },

  resetAutoAnalysisPreview: () => {
    set({ autoAnalysisPreview: initialState.autoAnalysisPreview });
  },

      // Reset Everything
      reset: () => set(initialState),
    }),
    {
      name: 'ihale-analysis-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Analiz sonuçları + aktif dosya durumu sakla
      partialize: (state) => ({
        currentAnalysis: state.currentAnalysis,
        // 🆕 analysisHistory maksimum 20 analiz (eski analizleri otomatik temizle)
        analysisHistory: state.analysisHistory.slice(-20),
        // 🆕 fileStatuses - extractedText'i ÇIKAR (quota aşımı önleme)
        fileStatuses: state.fileStatuses.map(fs => ({
          ...fs,
          extractedText: undefined, // Text persist edilmesin (50-200KB tasarruf per file)
        })),
        currentStep: state.currentStep, // 🆕 Hangi adımda olduğumuzu sakla
        // csvFiles, isProcessing SAKLANMAZ
      }),
    }
  )
);

/**
 * Computed selectors (derived state)
 */
export const useIhaleSelectors = () => {
  const store = useIhaleStore();

  return {
    // Completed files count
    completedFilesCount: store.fileStatuses.filter(fs => fs.status === 'completed').length,

    // Has any file in processing
    hasProcessingFiles: store.fileStatuses.some(fs => fs.status === 'processing'),

    // Total word count
    totalWordCount: store.fileStatuses
      .filter(fs => fs.status === 'completed')
      .reduce((sum, fs) => sum + (fs.wordCount || 0), 0),

    // Can proceed to analysis (has completed files)
    canProceedToAnalysis: store.fileStatuses.some(fs => fs.status === 'completed'),

    // Latest analysis from history
    latestAnalysis: store.analysisHistory.length > 0
      ? store.analysisHistory[store.analysisHistory.length - 1]
      : null,
  };
};
