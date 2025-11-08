/**
 * UNIFIED FILE UPLOAD & ANALYSIS SYSTEM
 * 
 * Problem: İhale Robotu'nda dosya yükleme ve AI analiz butonları işlevsiz
 * Çözüm: Zustand store ile merkezi, reliable dosya yönetimi
 * 
 * Flow:
 * 1. Dosya seçimi (drag-drop veya file input)
 * 2. Client-side validation (type, size, count)
 * 3. File metadata store'a kaydet
 * 4. Server'a yükle + progress tracking
 * 5. AI analize gönder butonu aktif
 * 6. Tek tıkla `/ihale/yeni-analiz` rotasına yönlendir
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ========================================
// TYPES
// ========================================

export interface UploadFile {
  id: string; // Unique identifier
  file: File; // Actual file object (not persisted)
  metadata: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  };
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  uploadedUrl?: string; // Server'dan dönen URL
  extractedText?: string; // OCR/parse sonucu
  wordCount?: number;
  error?: string;
}

export interface AnalysisPayload {
  tenderId?: string; // İhale Robotu'ndan geliyorsa
  tenderTitle?: string;
  tenderText?: string; // İhale metni
  files: UploadFile[]; // Yüklenen dosyalar
  timestamp: number;
}

// ========================================
// STORE
// ========================================

interface FileUploadStore {
  // State
  files: UploadFile[];
  isDragging: boolean;
  isUploading: boolean;
  isReadyForAnalysis: boolean;
  
  // Tender context (İhale Robotu'ndan geliyorsa)
  selectedTenderId: string | null;
  selectedTenderTitle: string | null;
  selectedTenderText: string | null;
  
  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  updateFileStatus: (fileId: string, updates: Partial<UploadFile>) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsUploading: (uploading: boolean) => void;
  
  // Tender context
  setTenderContext: (tenderId: string, title: string, text: string) => void;
  clearTenderContext: () => void;
  
  // Analysis trigger
  prepareAnalysisPayload: () => AnalysisPayload | null;
  reset: () => void;
}

export const useFileUploadStore = create<FileUploadStore>()(
  persist(
    (set, get) => ({
      // ========== STATE ==========
      files: [],
      isDragging: false,
      isUploading: false,
      isReadyForAnalysis: false,
      selectedTenderId: null,
      selectedTenderTitle: null,
      selectedTenderText: null,

      // ========== ACTIONS ==========
      
      addFiles: (newFiles: File[]) => {
        const existingFiles = get().files;
        
        // Generate unique IDs and create UploadFile objects
        const uploadFiles: UploadFile[] = newFiles.map(file => ({
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          metadata: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
          },
          status: 'pending',
          progress: 0,
        }));
        
        // Add to store
        set({
          files: [...existingFiles, ...uploadFiles],
          isReadyForAnalysis: false, // Reset until upload completes
        });
        
        console.log(`[FileUploadStore] ${uploadFiles.length} dosya eklendi`);
      },
      
      removeFile: (fileId: string) => {
        set(state => ({
          files: state.files.filter(f => f.id !== fileId),
        }));
        console.log(`[FileUploadStore] Dosya silindi: ${fileId}`);
      },
      
      clearFiles: () => {
        set({ files: [], isReadyForAnalysis: false });
        console.log('[FileUploadStore] Tüm dosyalar temizlendi');
      },
      
      updateFileStatus: (fileId: string, updates: Partial<UploadFile>) => {
        set(state => ({
          files: state.files.map(f =>
            f.id === fileId ? { ...f, ...updates } : f
          ),
        }));
        
        // Check if all files are completed
        const allCompleted = get().files.every(f => f.status === 'completed');
        if (allCompleted && get().files.length > 0) {
          set({ isReadyForAnalysis: true });
          console.log('[FileUploadStore] ✅ Tüm dosyalar hazır - Analiz başlatılabilir');
        }
      },
      
      setIsDragging: (dragging: boolean) => {
        set({ isDragging: dragging });
      },
      
      setIsUploading: (uploading: boolean) => {
        set({ isUploading: uploading });
      },
      
      // Tender context (İhale Robotu modal'ından)
      setTenderContext: (tenderId: string, title: string, text: string) => {
        set({
          selectedTenderId: tenderId,
          selectedTenderTitle: title,
          selectedTenderText: text,
        });
        console.log('[FileUploadStore] Tender context ayarlandı:', { tenderId, title });
      },
      
      clearTenderContext: () => {
        set({
          selectedTenderId: null,
          selectedTenderTitle: null,
          selectedTenderText: null,
        });
      },
      
      // Analysis payload hazırla
      prepareAnalysisPayload: () => {
        const state = get();
        
        if (state.files.length === 0) {
          console.warn('[FileUploadStore] Dosya yok - payload hazırlanamadı');
          return null;
        }
        
        if (!state.isReadyForAnalysis) {
          console.warn('[FileUploadStore] Dosyalar henüz hazır değil');
          return null;
        }
        
        const payload: AnalysisPayload = {
          tenderId: state.selectedTenderId || undefined,
          tenderTitle: state.selectedTenderTitle || undefined,
          tenderText: state.selectedTenderText || undefined,
          files: state.files,
          timestamp: Date.now(),
        };
        
        console.log('[FileUploadStore] Analysis payload hazır:', {
          fileCount: payload.files.length,
          hasTender: !!payload.tenderId,
        });
        
        return payload;
      },
      
      reset: () => {
        set({
          files: [],
          isDragging: false,
          isUploading: false,
          isReadyForAnalysis: false,
          selectedTenderId: null,
          selectedTenderTitle: null,
          selectedTenderText: null,
        });
        console.log('[FileUploadStore] RESET tamamlandı');
      },
    }),
    {
      name: 'file-upload-store',
      // Only persist metadata (not File objects)
      partialize: (state) => ({
        selectedTenderId: state.selectedTenderId,
        selectedTenderTitle: state.selectedTenderTitle,
        selectedTenderText: state.selectedTenderText,
        // files metadata only (without File objects)
        files: state.files.map(f => ({
          id: f.id,
          metadata: f.metadata,
          status: f.status,
          progress: f.progress,
          uploadedUrl: f.uploadedUrl,
          extractedText: f.extractedText,
          wordCount: f.wordCount,
          error: f.error,
          // ⚠️ file object NOT persisted
        })),
      }),
    }
  )
);

// ========================================
// SELECTORS
// ========================================

export const selectPendingFiles = (state: FileUploadStore) =>
  state.files.filter(f => f.status === 'pending');

export const selectCompletedFiles = (state: FileUploadStore) =>
  state.files.filter(f => f.status === 'completed');

export const selectFailedFiles = (state: FileUploadStore) =>
  state.files.filter(f => f.status === 'error');

export const selectTotalProgress = (state: FileUploadStore) => {
  if (state.files.length === 0) return 0;
  const sum = state.files.reduce((acc, f) => acc + f.progress, 0);
  return Math.round(sum / state.files.length);
};

export const selectTotalSize = (state: FileUploadStore) =>
  state.files.reduce((acc, f) => acc + f.metadata.size, 0);

export const selectFileStats = (state: FileUploadStore) => ({
  total: state.files.length,
  pending: selectPendingFiles(state).length,
  completed: selectCompletedFiles(state).length,
  failed: selectFailedFiles(state).length,
  progress: selectTotalProgress(state),
  totalSize: selectTotalSize(state),
});
