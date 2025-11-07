"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Eye,
  Brain,
  CheckCircle,
  Loader2,
  Trash2,
  TrendingUp,
  Download,
} from "lucide-react";
import { DocumentPreview } from "@/components/ai/DocumentPreview";
import { AnalysisResults } from "@/components/ai/AnalysisResults";
import { EnhancedAnalysisResults } from "@/components/ai/EnhancedAnalysisResults";
import { LinkedDocuments } from "@/components/ai/LinkedDocuments";
import { CSVCostAnalysis } from "@/components/ihale/CSVCostAnalysis";
import { SimpleDocumentList } from "@/components/ihale/SimpleDocumentList";
import { AIAnalysisResult } from "@/types/ai";
import { useIhaleStore, FileProcessingStatus } from "@/lib/stores/ihale-store";
import { CSVParser } from "@/lib/csv/csv-parser";
import { BelgeTuru } from "@/types/ai";
import {
  detectDocumentTypeFromFileName,
  getConfidenceScore,
} from "@/lib/utils/quick-document-detector";
import { downloadDocument } from "@/lib/utils/document-downloader";
import { getFromIndexedDB, deleteFromIndexedDB } from '@/lib/utils/indexed-db-storage';

import { Toast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";

// Types
interface FileStatus {
  fileMetadata: {
    name: string;
    url?: string;
    type?: string;
    size?: number;
    lastModified?: number;
  };
  status: "pending" | "downloading" | "processing" | "completed" | "error";
  progress?: string;
  progressPercentage?: number;
  wordCount?: number;
  extractedText?: string;
  detectedType?: string;
  detectedTypeConfidence?: number;
}

// === Utility ===
let lastProgressRaf = 0;
const throttleProgressUpdate = (update: () => void) => {
  const now = performance.now();
  if (now - lastProgressRaf > 16) {
    lastProgressRaf = now;
    requestAnimationFrame(update);
  }
};

// === Zustand Store Destructure ===


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

// FileProcessingStatus store'dan import ediliyor - local tanım kaldırıldı
// File objelerini ayrı bir Map'te tutuyor (runtime-only, serialize edilmeyecek)

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
}


const SSE_HEARTBEAT_MS = 120000; // 2 dakika (OCR gibi uzun işlemler için)

const getStageText = (stage: string) => stage;
const handleDownloadPage = (pageNumber: number) => console.log("download", pageNumber);
const handleDeletePage = (pageNumber: number) => console.log("delete", pageNumber);

// === Zustand Store Destructure ===
export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Yükleniyor...</p>
          </div>
        </div>
      }>
        <PageInner />
      </Suspense>
    </ErrorBoundary>
  );
}

function PageInner() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  const {
    currentStep,
    setCurrentStep,
    currentAnalysis,
    setCurrentAnalysis,
    fileStatuses,
    updateFileStatus,
    addFileStatus,
    removeFileStatus,
    clearFileStatuses,
    isProcessing,
    setIsProcessing,
    autoAnalysisPreview,
    resetAutoAnalysisPreview,
    csvFiles,
    addCSVFile,
    updateCSVFile,
    removeCSVFile
  } = useIhaleStore();

  // Local state
  const [documentPages, setDocumentPages] = useState<DocumentPage[]>([]);
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null);
  const [autoDeepAnalysisTriggered, setAutoDeepAnalysisTriggered] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");
  const [retryCount, setRetryCount] = useState(0); // 🆕 Retry count for error recovery
  const [useOCR, setUseOCR] = useState(true); // Default to true for OCR
  const [sessionLoadProgress, setSessionLoadProgress] = useState(0); // 🆕 Session data loading progress
  
  // ✅ FIX: File Queue State (sıralı işleme için)
  const [fileQueue, setFileQueue] = useState<File[]>([]); // Bekleyen dosyalar
  const [currentlyProcessing, setCurrentlyProcessing] = useState<File | null>(null); // Şu anda işlenen

  // Refs
  const processingQueueRef = useRef<Set<string>>(new Set());
  const fileObjectsMapRef = useRef<Map<string, File>>(new Map());
  const uploadedFilesRef = useRef<File[]>([]);
  const sseHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const sseAbortRef = useRef<AbortController | null>(null);
  const indexedDBProcessedRef = useRef<boolean>(false); // 🆕 IndexedDB işlendi mi?

  // Steps configuration - useMemo for performance
  const steps = React.useMemo(() => [
    { id: "upload", label: "Yükle", icon: Upload },
    { id: "processing", label: "İşle", icon: FileText },
    { id: "view", label: "Görüntüle", icon: Eye },
    { id: "analyze", label: "Analiz", icon: Brain },
    { id: "results", label: "Sonuç", icon: CheckCircle },
  ], []);

  // Toast function (assuming it's from a context or hook)
  const setToast = useCallback((toast: { message: string; type: "success" | "error" | "info" }) => {
    // Implementation would depend on your toast system
    console.log("Toast:", toast);
  }, []);

  // 🆕 İlerleme mesajlarını iyileştir
  const getProgressMessage = useCallback((stage?: string, details?: string, elapsed?: string) => {
    // Defensive: stage undefined olabilir
    if (!stage) {
      return details ? `⏳ ${details}` : '⏳ İşleniyor...';
    }

    const baseMessages: Record<string, string> = {
      'extracting': '📄 Döküman metni çıkarılıyor',
      'analyzing': '🧠 AI analizi yapılıyor',
      'processing': '⚙️ İşleniyor',
      'parsing': '🔍 İçerik ayrıştırılıyor',
      'validating': '✅ Doğrulama yapılıyor',
      'saving': '💾 Sonuçlar kaydediliyor',
      'complete': '✅ Tamamlandı',
      'error': '❌ Hata oluştu'
    };

    const friendlyStage = baseMessages[stage.toLowerCase()] || `⏳ ${stage}`;
    const timeInfo = elapsed ? ` (${elapsed}s)` : '';
    const detailInfo = details ? ` • ${details}` : '';

    return `${friendlyStage}${detailInfo}${timeInfo}`;
  }, []);

  // 🆕 Sayfa direkt açıldığında (from parametresi yoksa) eski analizi temizle
  useEffect(() => {
    if (!from && currentAnalysis) {
      console.log('🧹 Sayfa manuel açıldı, eski analiz temizleniyor...');
      setCurrentAnalysis(null);
      // currentStep zaten 'upload' olarak başlıyor, tekrar set etmeye gerek yok
    }
  }, [from, currentAnalysis, setCurrentAnalysis]); // Dependencies ekledik

  // 🆕 İhale robotundan gelen IndexedDB verilerini işle
  useEffect(() => {
    console.log('🔍 useEffect çalıştı - from parametresi:', from);
    console.log('🔍 currentStep:', currentStep);
    console.log('🔍 indexedDBProcessedRef:', indexedDBProcessedRef.current);
    
    // ⚠️ Bir kez çalışmalı, tekrar tetiklenmemeli
    if (from && from.startsWith('ihale_docs_') && currentStep === 'upload' && !indexedDBProcessedRef.current) {
      console.log('🎯 İhale robotundan gelen veri tespit edildi, IndexedDB\'den yükleniyor...');

      // 🔒 İşlem başlatıldı, tekrar çalışmasın
      indexedDBProcessedRef.current = true;

      // 🧹 Önce mevcut state'i temizle (yeni analiz için)
      console.log('🧹 Eski state temizleniyor...');
      clearFileStatuses();
      uploadedFilesRef.current = [];
      fileObjectsMapRef.current.clear();
      setSessionLoadProgress(1); // 🆕 Loading indicator'ı göster (0 yerine 1)

      // async işlem - IndexedDB'den veri al
      (async () => {
        try {
          const payload = await getFromIndexedDB<{
            title: string;
            text: string;
            documents: any[];
            size: number;
            timestamp: number;
          }>(from);
          
          console.log('📦 IndexedDB\'den okunan data:', payload ? 'VAR' : 'YOK');
        
          if (payload) {
            console.log('📦 IndexedDB data bulundu:', {
              hasDocuments: !!payload.documents,
              hasText: !!payload.text,
              documentCount: payload.documents?.length || 0,
              size: `${(payload.size / (1024 * 1024)).toFixed(2)} MB`
            });

            // Dökümanları işle
            if (payload.documents && payload.documents.length > 0) {
              const totalDocs = payload.documents.length;
              const totalSize = payload.documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
              
              console.log(`📄 ${totalDocs} döküman yükleniyor... (Toplam: ${(totalSize / (1024 * 1024)).toFixed(2)} MB)`);
              setSessionLoadProgress(5); // Başlangıç progress

              // Her döküman için file oluştur ve İŞLE
              for (let index = 0; index < totalDocs; index++) {
                const doc = payload.documents[index];
                const docNumber = index + 1;
                
                console.log(`📦 [${docNumber}/${totalDocs}] ${doc.title} işleniyor... (${(doc.size / 1024).toFixed(1)} KB)`);
                
                if (doc.blob) {
                  // Blob nesnesi direkt kullanılabilir (IndexedDB Blob'u korur)
                  const file = new File([doc.blob], doc.title || `document_${index}.pdf`, {
                    type: doc.mimeType || 'application/pdf'
                  });

                  // 🆕 File status'u PENDING olarak ekle
                  addFileStatus({
                    fileMetadata: {
                      name: file.name,
                      size: file.size,
                      type: file.type,
                      lastModified: Date.now(),
                    },
                    status: 'pending',
                    progress: `⏳ Sırada bekliyor... (${docNumber}/${totalDocs})`,
                    detectedType: doc.type || 'ihale_dokuman',
                    detectedTypeConfidence: 1.0,
                  });

                  // File'ı Map'e ekle (processSingleFile için gerekli)
                  fileObjectsMapRef.current.set(file.name, file);
                  
                  // File'ı uploadedFilesRef'e ekle
                  uploadedFilesRef.current.push(file);

                  // Progress güncelle
                  const progress = Math.round(((docNumber) / totalDocs) * 15) + 5; // 5-20% arası
                  setSessionLoadProgress(progress);
                  
                  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
                  console.log(`📋 [${docNumber}/${totalDocs}] ${file.name} kuyruğa eklendi (${sizeInMB} MB) - Progress: ${progress}%`);
                } else {
                  console.warn(`⚠️ [${docNumber}/${totalDocs}] ${doc.title} - Blob bulunamadı, atlanıyor...`);
                }
              }

              setSessionLoadProgress(90); // Dosyalar hazırlandı
              console.log(`✅ ${totalDocs} döküman kuyruğa eklendi (PENDING durumunda)`);
              console.log(`� Kullanıcı "İşle" butonuna basarak dosyaları işleyebilir`);
              
              // ⚠️ OTOMATİK PROCESSING KALDIRILDI - Kullanıcı manuel başlatacak
              // Dosyalar artık "pending" durumunda ve kullanıcı her dosya için "İşle" butonuna basacak
              
              // Progress'i tamamla
              setSessionLoadProgress(100);
              setTimeout(() => {
                setSessionLoadProgress(0);
                console.log('🧹 Session loading progress temizlendi - Dosyalar hazır!');
              }, 1000);
            }

            // Metin varsa localStorage'a kaydet (eski sistem uyumluluğu için)
            if (payload.text) {
              localStorage.setItem('ihale_document_text', payload.text);
              console.log('📝 Metin localStorage\'a kaydedildi');
            }

            // Tender başlığını sakla
            if (payload.title) {
              console.log('🏷️ Tender başlığı:', payload.title);
              // TODO: Tender title state'i eklenebilir
            }

            // IndexedDB data'yı temizle (bir kez kullanıldı)
            await deleteFromIndexedDB(from);

            // ✅ URL temizleme YAPMA - router karışıyor
            // window.history.replaceState çağırmıyoruz artık
            
            console.log('✅ İhale robotu verileri başarıyla yüklendi, otomatik processing yapıldı');

          } else {
            console.warn('⚠️ IndexedDB data bulunamadı:', from);
            setSessionLoadProgress(0);
          }

        } catch (error) {
          console.error('❌ IndexedDB data işlenirken hata:', error);
          // Hata durumunda normal upload'a dön
          setSessionLoadProgress(0);
        }
      })();
    }
  }, [from, currentStep]); // ✅ Sadece from ve currentStep - store fonksiyonları stable

  // 🆕 Klavye kısayolları
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Enter: Analiz başlat
      if (e.ctrlKey && e.key === 'Enter' && currentStep === 'view' && !isProcessing) {
        e.preventDefault();
        console.log('⌨️ Ctrl+Enter: Analiz başlatılıyor...');
        // analyzeDocuments fonksiyonunu çağır
        setCurrentStep('analyze');
        return;
      }

      // Escape: Modal kapat
      if (e.key === 'Escape') {
        // Modal varsa kapat
        return;
      }

      // Ctrl+O: Dosya seçici aç
      if (e.ctrlKey && e.key === 'o' && currentStep === 'upload') {
        e.preventDefault();
        console.log('⌨️ Ctrl+O: Dosya seçici açılıyor...');
        document.getElementById('file-input')?.click();
        return;
      }

      // Ctrl+R: Reset (sadece upload adımında)
      if (e.ctrlKey && e.key === 'r' && currentStep === 'upload') {
        e.preventDefault();
        console.log('⌨️ Ctrl+R: İşlem sıfırlanıyor...');
        resetProcess();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentStep, isProcessing]);

  // 💾 Stage 2 Persistence - documentPages ve documentStats'ı localStorage'da tut
  useEffect(() => {
    // Restore from localStorage on mount
    if (typeof window !== 'undefined') {
      const savedPages = localStorage.getItem('ihale_document_pages');
      const savedStats = localStorage.getItem('ihale_document_stats');
      const savedStep = localStorage.getItem('ihale_current_step');

      if (savedPages && savedStats && savedStep === 'view') {
        try {
          const pages = JSON.parse(savedPages);
          const stats = JSON.parse(savedStats);
          setDocumentPages(pages);
          setDocumentStats(stats);
          setCurrentStep('view');
          console.log('📥 Stage 2 data restored from localStorage');
        } catch (error) {
          console.error('Failed to restore Stage 2 data:', error);
        }
      }
    }
  }, []);

  // Save to localStorage whenever documentPages or documentStats changes
  useEffect(() => {
    if (typeof window !== 'undefined' && documentPages.length > 0 && documentStats) {
      localStorage.setItem('ihale_document_pages', JSON.stringify(documentPages));
      localStorage.setItem('ihale_document_stats', JSON.stringify(documentStats));
      localStorage.setItem('ihale_current_step', currentStep);
      console.log('💾 Stage 2 data saved to localStorage');
    }
  }, [documentPages, documentStats, currentStep]);

  // 🔥 Otomatik Derin Analiz - 5 saniye bekleme YOK, direkt başla
  useEffect(() => {
    // Eğer results adımındaysak VE henüz tetiklenmediyse
    if (currentStep === "results" && currentAnalysis && !autoDeepAnalysisTriggered) {
      console.log("🚀 Derin analiz otomatik başlatılıyor (bekleme YOK)...");
      // EnhancedAnalysisResults component'ine "deep" sekmesini aç sinyali gönder
      setAutoDeepAnalysisTriggered(true);
    }
  }, [currentStep, currentAnalysis, autoDeepAnalysisTriggered]);

  // 🆕 Pending dosyaları otomatik indir ve işle (URL'den gelen PDF'ler için)
  useEffect(() => {
    if (currentStep !== 'upload') return;

    // Pending durumda olan ve URL'si olan dosyaları bul
    const pendingFiles = fileStatuses.filter(fs =>
      fs.status === 'pending' &&
      fs.fileMetadata.url &&
      !processingQueueRef.current.has(fs.fileMetadata.name)
    );

    if (pendingFiles.length > 0) {
      console.log(`📥 ${pendingFiles.length} adet pending döküman bulundu, otomatik indiriliyor...`);

      (async () => {
        for (const fileStatus of pendingFiles) {
          const url = fileStatus.fileMetadata.url!;
          const filename = fileStatus.fileMetadata.name;

          // Zaten işleniyorsa atla
          if (processingQueueRef.current.has(filename)) {
            console.log(`⏭️ ${filename} zaten işleniyor, atlanıyor...`);
            continue;
          }

          console.log(`📥 İndiriliyor: ${filename}`);

          // Önce durumu "downloading" olarak işaretle
          updateFileStatus(filename, { status: 'processing', progress: '📥 İndiriliyor...' });

          try {
            // 🔐 Merkezi download utility kullan (auth otomatiği)
            const downloadedFiles = await downloadDocument(url);
            
            if (downloadedFiles.length === 0) {
              throw new Error('Dosya indirilemedi');
            }

            // İlk dosyayı al (ZIP ise zaten extract edilmiş olacak)
            const firstFile = downloadedFiles[0];
            const file = new File([firstFile.blob], firstFile.title, { type: firstFile.mimeType });

            // File objesini Map'e ekle
            fileObjectsMapRef.current.set(filename, file);

            console.log(`✅ ${filename} indirildi (${(firstFile.size / 1024).toFixed(2)} KB)`);

            // Şimdi bu dosyayı normal şekilde işle
            await processSingleFile(file);

          } catch (error) {
            console.error(`❌ ${filename} indirilemedi:`, error);
            updateFileStatus(filename, { status: 'error', progress: `❌ İndirme hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` });
          }
        }
      })();
    }
  }, [fileStatuses, currentStep]);

  // 🆕 Otomatik önizleme geçişi: Tüm dosyalar işlendiğinde
  useEffect(() => {
    // Sadece upload adımındayken çalışsın
    if (currentStep !== 'upload') return;

    const allCompleted = fileStatuses.every(fs => fs.status === 'completed' || fs.status === 'error');
    const hasCompletedFiles = fileStatuses.some(fs => fs.status === 'completed');
    const noMoreProcessing = processingQueueRef.current.size === 0;

    if (allCompleted && hasCompletedFiles && noMoreProcessing && fileStatuses.length > 0) {
      console.log('✨ Tüm dosyalar işlendi, otomatik önizlemeye geçiliyor...');
      // Kısa bir gecikme ile, böylece UI güncellemeleri tamamlanır
      setTimeout(() => {
        handleProcessAllFiles();
      }, 800);
    }
  }, [fileStatuses, currentStep]); // fileStatuses her değiştiğinde kontrol et

  // 🆕 Büyük dosyalar için chunk'lı yükleme
  const loadFileChunked = useCallback(async (file: File, chunkSize: number = 1024 * 1024): Promise<string> => {
    const fileSize = file.size;
    
    // Küçük dosyalar için normal yükleme
    if (fileSize <= chunkSize * 2) {
      return await file.text();
    }

    console.log(`📦 Büyük dosya algılandı (${(fileSize / 1024 / 1024).toFixed(1)}MB), chunk'lı yükleme başlatılıyor...`);
    
    const chunks: string[] = [];
    const totalChunks = Math.ceil(fileSize / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      const chunk = file.slice(start, end);
      const chunkText = await chunk.text();
      chunks.push(chunkText);
      
      // Progress güncellemesi
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      updateFileStatus(file.name, {
        status: 'processing',
        progress: `📖 Dosya yükleniyor... ${progress}%`
      });
      
      // UI'yi güncellemek için kısa bekleme
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const fullContent = chunks.join('');
    console.log(`✅ Chunk'lı yükleme tamamlandı: ${chunks.length} parça, ${(fullContent.length / 1024 / 1024).toFixed(1)}MB`);
    return fullContent;
  }, []);

  // ✅ FIX: processSingleFile'ı useCallback ile wrap et (dependency olarak kullanılacak)
  const processSingleFile = useCallback(async (file: File) => {
    console.log(`🔍 [PROCESS DEBUG] processSingleFile başlatıldı: ${file.name}`);
    
    // Zaten işleniyorsa atla
    if (processingQueueRef.current.has(file.name)) {
      console.warn(`⚠️ ${file.name} zaten işleniyor, atlanıyor...`);
      return;
    }

    // Kuyruğa ekle
    processingQueueRef.current.add(file.name);

    console.log(`İşleniyor: ${file.name}`);
    const startTime = Date.now();

      // 1️⃣ Yükleme başladı
    const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    updateFileStatus(file.name, {
      status: 'processing',
      progress: `📤 Dosya yükleniyor... (${fileSizeInMB} MB)`
    });
    console.log(`📤 ${file.name} yüklemeye başlandı (${fileSizeInMB} MB)`);    try {
      // 🆕 TXT/JSON/CSV dosyaları için özel işlem
      const fileName = file.name.toLowerCase();
      const isTxtFile = fileName.endsWith('.txt');
      const isJsonFile = fileName.endsWith('.json');
      const isCsvFile = fileName.endsWith('.csv') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

      // ✅ FIX: TXT ve JSON dosyalarını da API'ye gönder (AI analizi için)
      // CSV hariç - CSV zaten ayrı CSV parser'dan geçiyor
      if (isCsvFile) {
        // CSV için eski akış devam ediyor (chunk'lı okuma)
        // 🆕 Büyük dosyalar için chunk'lı yükleme kullan
        const rawContent = await loadFileChunked(file);
        let fileType = 'CSV/Excel';
        let extractedText = rawContent; // Default olarak ham içerik

        // 📊 CSV/Excel - Tablo verisi (olduğu gibi sakla)
        // ProCheff CSV export formatını kontrol et
        if (rawContent.includes('İHALE DETAY RAPORU') || rawContent.includes('Alan,Değer')) {
          console.log('📊 ProCheff CSV export formatı algılandı');
          fileType = 'CSV (ProCheff Export)';
        }

        const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Parsed içeriği sakla
        updateFileStatus(file.name, {
          status: 'completed',
          progress: `✅ Tamamlandı - ${fileType} (${wordCount} kelime, ${elapsed}s)`,
          progressPercentage: 100,
          wordCount: wordCount,
          extractedText: extractedText  // Parsed veya ham içerik
        });

        console.log(`✅ ${file.name} tamamlandı - Format: ${fileType} (${wordCount} kelime)`);
        console.log(`📄 ${file.name} Önizleme (ilk 500 karakter):`, extractedText.slice(0, 500));

        processingQueueRef.current.delete(file.name);
        return;
      }

      // TXT ve JSON dosyaları artık API'ye gönderiliyor (AI analizi için)
      console.log(`📤 ${file.name} API'ye gönderiliyor (format: ${isTxtFile ? 'TXT' : isJsonFile ? 'JSON' : 'UNKNOWN'})`);

      // PDF/DOC/TXT/JSON dosyaları için normal API akışı
      const formData = new FormData();
      formData.append("file0", file);
      formData.append("fileCount", "1");
      formData.append("useOCR", useOCR.toString());

      // 2️⃣ Server'a gönderiliyor
      updateFileStatus(file.name, {
        progress: `🚀 Server'a gönderiliyor... (${fileSizeInMB} MB)`,
        progressPercentage: 5
      });
      console.log(`🚀 ${file.name} API'ye POST ediliyor...`);
      console.log(`📊 FormData hazırlandı: file=${file.name}, size=${file.size}, useOCR=${useOCR}`);

      let response: Response;
      try {
        console.log(`🌐 fetch() başlatılıyor: /api/upload`);
        response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        console.log(`✅ fetch() tamamlandı: ${response.status} ${response.statusText}`);
      } catch (fetchError) {
        console.error(`❌ fetch() HATASI:`, fetchError);
        throw new Error(`Network hatası: ${fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata'}`);
      }

      console.log(`📡 ${file.name} - Server response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 3️⃣ Streaming response'u oku
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: any = null;

      if (!reader) {
        throw new Error('Streaming desteklenmiyor');
      }

      // Heartbeat watchdog: if server goes silent for too long, abort and surface a friendly error
      const resetHeartbeat = () => {
        if (sseHeartbeatRef.current) clearTimeout(sseHeartbeatRef.current);
        sseHeartbeatRef.current = setTimeout(() => {
          try { sseAbortRef.current?.abort(); } catch {}
          console.warn("⚠️ SSE heartbeat timeout, request aborted");
        }, SSE_HEARTBEAT_MS);
      };
      resetHeartbeat();

      // Robust line buffer across chunks
      let leftover = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetHeartbeat();
        const chunk = decoder.decode(value, { stream: true });
        leftover += chunk;
        // SSE frames are separated by \n\n; process full frames only
        const frames = leftover.split('\n\n');
        leftover = frames.pop() || '';
        for (const frame of frames) {
          const lines = frame.split('\n');
          // Ignore comment/heartbeat lines
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          let data: any = null;
          try {
            data = JSON.parse(payload);
          } catch (e) {
            console.warn("JSON parse hatası (frame atlandı):", e);
            continue;
          }
          if (data.type === 'progress') {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const pct = Math.max(0, Math.min(100, Number(data.progress) || 0));
            const friendlyMessage = getProgressMessage(data.stage, data.details, elapsed);
            
            // 🆕 File status'u güncelle (streaming progress)
            updateFileStatus(file.name, {
              status: 'processing',
              progress: `${friendlyMessage} - %${pct}`,
              progressPercentage: pct
            });
            
            throttleProgressUpdate(() => {
              setAnalysisProgress(pct);
              setAnalysisStage(friendlyMessage);
            });
            
            // 🆕 Detaylı progress toast - Her %10'da güncelle
            if (pct % 10 === 0 || pct === 0 || pct === 25 || pct === 50 || pct === 75 || pct === 100) {
              const emoji = pct < 30 ? '📄' : pct < 60 ? '🔍' : pct < 90 ? '🧠' : '✅';
              setToast({ 
                message: `${emoji} ${friendlyMessage} - %${pct}`, 
                type: pct >= 100 ? "success" : "info" 
              });
            }
            
            // Console log her progress update'de
            console.log(`📊 Progress: ${pct}% - ${data.stage} ${data.details || ''} (${elapsed}s)`);
          } else if (data.type === 'complete') {
            result = data.result;
            setAnalysisProgress(100);
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            const metadata = data.metadata || {};
            const isCached = metadata.cached || metadata.cache_hit;
            if (isCached) {
              const cacheAge = metadata.cache_age_ms ? Math.round(metadata.cache_age_ms / 1000 / 60) : 0;
              const maxCacheAge = 24 * 60; // 24 saat
              
              if (cacheAge > maxCacheAge) {
                setAnalysisStage(`⚠️ Eski cache kullanıldı (${cacheAge} dakika önce) - Yenileniyor...`);
                console.warn(`Cache çok eski (${cacheAge}dk > ${maxCacheAge}dk), yeniden analiz öneriliyor`);
              } else {
                setAnalysisStage(`💾 Cache'den geldi! (${cacheAge} dakika önce analiz edildi)`);
              }
            } else {
              setAnalysisStage(`✅ Analiz tamamlandı! (${totalTime}s)`);
            }
            
            // 🎉 SUCCESS TOAST
            setToast({ 
              message: `✅ ${file.name} başarıyla işlendi! (${totalTime}s)`, 
              type: "success" 
            });
            
            // 🆕 File status'u "completed" yap
            const wordCount = result?.extracted_text?.split(/\s+/).filter((w: string) => w.length > 0).length || 0;
            updateFileStatus(file.name, {
              status: 'completed',
              progress: `✅ Tamamlandı (${totalTime}s)`,
              progressPercentage: 100,
              wordCount: wordCount,
              extractedText: result?.extracted_text || ''
            });
          } else if (data.type === 'error') {
            throw new Error(data.error || 'Bilinmeyen streaming hatası');
          }
        }
      }
      // Try to parse any trailing complete frame in leftover
      if (leftover && leftover.includes('data: ')) {
        try {
          const lastPayload = leftover.substring(leftover.lastIndexOf('data: ') + 6);
          const maybe = JSON.parse(lastPayload);
          if (!result && maybe?.type === 'complete') {
            result = maybe.result;
          }
        } catch {}
      }
      // Clear heartbeat
      if (sseHeartbeatRef.current) {
        clearTimeout(sseHeartbeatRef.current);
        sseHeartbeatRef.current = null;
      }
      // Defensive normalization for result shape
      if (!result?.extracted_data) {
        result = {
          extracted_data: {
            kurum: result?.organization || '',
            ihale_turu: result?.dates?.ihale_turu || '',
            tahmini_butce: result?.budget?.estimated || 0,
          },
          processing_metadata: {
            provider: 'unknown',
            processing_time: Date.now(),
          },
          ...result
        };
      }
      setCurrentAnalysis(result);
      setCurrentStep("results");
      console.log("=== ANALİZ TAMAMLANDI ===");
    } catch (error) {
      // Handle aborted streaming (manual or heartbeat)
      if ((error as any)?.name === 'AbortError') {
        // 🆕 Otomatik retry mekanizması
        if (retryCount < 2) { // 2 kere dene (toplam 3 deneme)
          const nextRetry = retryCount + 1;
          setRetryCount(nextRetry);
          setToast({ 
            message: `⚠️ Bağlantı zaman aşımına uğradı. Otomatik yeniden deneme ${nextRetry}/3...`, 
            type: "info" 
          });
          
          // 3 saniye bekleyip tekrar dene
          setTimeout(() => {
            console.log(`🔄 Otomatik retry ${nextRetry}/3 başlatılıyor...`);
            setRetryCount(0); // Reset count for next attempt
            setCurrentStep("analyze"); // Tekrar analyze adımına dön
            setIsProcessing(false); // Reset processing state
          }, 3000);
          return;
        } else {
          // Retry limit aşıldı
          setToast({ 
            message: "⚠️ Bağlantı zaman aşımına uğradı. Lütfen sayfayı yenileyip tekrar deneyin.", 
            type: "error" 
          });
          setRetryCount(0); // Reset retry count
          // ✅ FIX: Adım değişikliğini KALDIRDIK - processing kartı açık kalsın
          // setCurrentStep("view"); // ← Bu satırı kaldırdık!
          return;
        }
      }
      console.error("=== ANALYSIS ERROR ===", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );

      const errorMessage =
        error instanceof Error ? error.message : "Bilinmeyen hata";

      let userMessage = "Analiz sırasında hata oluştu:\n\n";

      // Hataya göre özelleştirilmiş mesajlar
      if (
        errorMessage.includes("ANTHROPIC_API_KEY") ||
        errorMessage.includes("CLAUDE_API_KEY")
      ) {
        userMessage +=
          "🔑 AI servis yapılandırması eksik. Sistem yöneticisine başvurun.";
      } else if (
        errorMessage.includes("çok kısa") ||
        errorMessage.includes("boş")
      ) {
        userMessage +=
          "📄 " +
          errorMessage +
          "\n\n💡 OCR seçeneğini aktifleştirmeyi deneyin.";
      } else if (errorMessage.includes("HTTP 429")) {
        userMessage +=
          "⏳ AI servisi geçici olarak meşgul. Lütfen 1-2 dakika bekleyip tekrar deneyin.";
      } else if (
        errorMessage.includes("HTTP 500") ||
        errorMessage.includes("HTTP 503")
      ) {
        userMessage +=
          "🚫 AI servisi geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.";
      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {
        userMessage +=
          "🌐 İnternet bağlantısı sorunu. Bağlantınızı kontrol edip tekrar deneyin.";
      } else {
        userMessage += errorMessage;
      }

      userMessage +=
        "\n\n📋 Teknik Detaylar: " +
        (process.env.NODE_ENV === "development"
          ? errorMessage
          : "Hata kaydedildi");

      setToast({ message: userMessage, type: "error" });
      
      // 🆕 Dosya durumunu ERROR olarak güncelle
      updateFileStatus(file.name, {
        status: 'error',
        progress: `❌ Hata: ${errorMessage}`,
        progressPercentage: 0
      });
      
      // ✅ FIX: Adım değişikliğini KALDIRDIK - processing kartı açık kalsın
      // setCurrentStep("view"); // ← Bu satırı kaldırdık!
      
      // ❌ Hata durumunda progress'i sıfırla
      setAnalysisProgress(0);
      setAnalysisStage("");
    } finally {
      // 🧹 Dosyayı kuyruktan çıkar (hata olsa bile)
      processingQueueRef.current.delete(file.name);
      
      if (sseHeartbeatRef.current) {
        clearTimeout(sseHeartbeatRef.current);
        sseHeartbeatRef.current = null;
      }
      if (sseAbortRef.current) {
        sseAbortRef.current = null;
      }
      setIsProcessing(false);
      // ⚠️ Progress'i sıfırlama - başarılı olduğunda %100'de kalmalı
    }
  }, [setCurrentStep, setCurrentAnalysis, setAnalysisProgress, setAnalysisStage, setIsProcessing, setToast, updateFileStatus]);
  // ☝️ processSingleFile dependencies - tüm state setters ve store actions

  // ✅ FIX: Queue İşleme Fonksiyonu (sıralı dosya işleme)
  const processFileQueue = useCallback(async () => {
    console.log('🔍 [QUEUE DEBUG] processFileQueue çağrıldı');
    console.log('🔍 [QUEUE DEBUG] currentlyProcessing:', currentlyProcessing?.name);
    console.log('🔍 [QUEUE DEBUG] fileQueue.length:', fileQueue.length);
    
    // Zaten bir dosya işleniyorsa bekle
    if (currentlyProcessing) {
      console.log('⏳ Bir dosya zaten işleniyor, sıra bekleniyor...');
      return;
    }

    // Kuyrukta dosya yoksa bitir
    if (fileQueue.length === 0) {
      console.log('✅ Kuyruk boş, tüm dosyalar işlendi');
      return;
    }

    // Kuyruktan ilk dosyayı al
    const nextFile = fileQueue[0];
    console.log(`🚀 Kuyruktan alınıyor: ${nextFile.name}`);
    
    setCurrentlyProcessing(nextFile);
    setFileQueue(prev => {
      console.log('🔍 [QUEUE DEBUG] Kuyruktan çıkarılıyor:', nextFile.name);
      console.log('🔍 [QUEUE DEBUG] Kalan dosya sayısı:', prev.length - 1);
      return prev.slice(1);
    });

    console.log(`🚀 İşleniyor: ${nextFile.name} (Kuyrukta ${fileQueue.length - 1} dosya kaldı)`);

    try {
      // ✅ Mevcut processSingleFile() fonksiyonunu kullan
      console.log(`📝 processSingleFile başlatılıyor: ${nextFile.name}`);
      await processSingleFile(nextFile);
      
      console.log(`✅ ${nextFile.name} başarıyla tamamlandı!`);
    } catch (error) {
      console.error(`❌ ${nextFile.name} işlenirken hata:`, error);
      setToast({ 
        message: `❌ ${nextFile.name} işlenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`, 
        type: "error" 
      });
    } finally {
      console.log(`🧹 ${nextFile.name} için cleanup yapılıyor`);
      setCurrentlyProcessing(null);
      
      // ⚠️ ÖNEMLİ: Sonraki dosyayı işle ama state update'i bekle
      // setTimeout kullanmak yerine setCurrentlyProcessing(null) sonrası
      // useEffect otomatik tetiklenecek
    }
  }, [fileQueue, currentlyProcessing, processSingleFile, setToast]);

  // ✅ FIX: Queue değiştiğinde otomatik işleme başlat
  useEffect(() => {
    console.log('🔍 [QUEUE EFFECT] Triggered - fileQueue.length:', fileQueue.length, 'currentlyProcessing:', currentlyProcessing?.name);
    
    if (fileQueue.length > 0 && !currentlyProcessing) {
      console.log('🎯 [QUEUE EFFECT] Şartlar sağlandı, processFileQueue çağrılıyor');
      // 500ms delay - API rate limit koruması
      const timer = setTimeout(() => {
        processFileQueue();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [fileQueue, currentlyProcessing, processFileQueue]);

  const resetProcess = useCallback(() => {
    // Abort any ongoing streaming and clear heartbeat
    if (sseAbortRef.current) {
      try { sseAbortRef.current.abort(); } catch {}
      sseAbortRef.current = null;
    }
    if (sseHeartbeatRef.current) {
      clearTimeout(sseHeartbeatRef.current);
      sseHeartbeatRef.current = null;
    }

    setCurrentStep("upload");
    uploadedFilesRef.current = []; // useRef - direkt assign
    clearFileStatuses();
    setDocumentPages([]);
    setCurrentAnalysis(null); // Zustand store'daki analiz sonucunu temizle
    setIsProcessing(false);
    setAutoDeepAnalysisTriggered(false); // Otomatik derin analiz sıfırla
    resetAutoAnalysisPreview(); // 🆕 Auto-analysis preview'ı sıfırla

    // ✅ FIX: Queue temizliği
    setFileQueue([]);
    setCurrentlyProcessing(null);

    // 🧹 File Map temizliği (memory leak önleme)
    fileObjectsMapRef.current.clear();

    // ⚠️ KRİTİK: localStorage'daki document text'i de temizle
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ihale_document_text');
      console.log('🧹 localStorage temizlendi - yeni analiz için hazır');
    }
  }, [setCurrentStep, clearFileStatuses, setCurrentAnalysis, setIsProcessing, setAutoDeepAnalysisTriggered, resetAutoAnalysisPreview]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    const asyncThreshold = 20 * 1024 * 1024; // 20MB
    const newFiles: File[] = [];

    for (const file of files) {
      // ⚠️ Dosya boyutu kontrolü
      if (file.size > maxSize) {
        setToast({
          message: `❌ ${file.name} çok büyük! Maksimum dosya boyutu: 50MB`,
          type: "error"
        });
        console.error(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        continue; // Bu dosyayı atla, diğerlerine devam et
      }

      // Dosya tipi kontrolü - TXT, JSON eklendi
      const isValidType =
        file.type.includes("pdf") ||
        file.type.includes("word") ||
        file.type.includes("image") ||
        file.type.includes("text") ||
        file.type.includes("json") ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.name.toLowerCase().endsWith(".docx") ||
        file.name.toLowerCase().endsWith(".doc") ||
        file.name.toLowerCase().endsWith(".png") ||
        file.name.toLowerCase().endsWith(".jpg") ||
        file.name.toLowerCase().endsWith(".jpeg") ||
        file.name.toLowerCase().endsWith(".txt") ||
        file.name.toLowerCase().endsWith(".json");

      if (!isValidType) {
        setToast({ 
          message: `❌ ${file.name} desteklenmeyen format!\n\n✅ Kabul edilen formatlar:\n• PDF, Word (.docx, .doc)\n• Görseller (PNG, JPG, JPEG)\n• Metin dosyaları (TXT, JSON)\n\n💡 Dosyanızın uzantısını kontrol edin.`, 
          type: "error" 
        });
        continue;
      }

      if (file.size > maxSize) {
        setToast({ 
          message: `❌ ${file.name} çok büyük!\n\n📏 Dosya boyutu: ${(file.size/1024/1024).toFixed(1)}MB\n📏 Limit: 50MB\n\n💡 Daha küçük dosyalar kullanın veya dosyayı bölün.`, 
          type: "error" 
        });
        continue;
      }

      // Aynı dosya zaten ekli mi?
      if (fileStatuses.some(fs => fs.fileMetadata.name === file.name)) {
        setToast({ 
          message: `⚠️ ${file.name} zaten işleniyor!\n\n📋 Liste: ${fileStatuses.length} dosya\n⏳ Durum: İşleniyor\n\n💡 Farklı bir dosya seçin veya bekleyin.`, 
          type: "info" 
        });
        continue;
      }

      // Büyük dosya için async parse
      if (file.size >= asyncThreshold) {
        const start = performance.now();
        setToast({ 
          message: `⏳ Büyük dosya arka planda işleniyor...\n\n📄 ${file.name}\n📏 ${(file.size/1024/1024).toFixed(1)}MB\n⚡ Async mod aktif\n\n💡 Bu işlem biraz zaman alabilir.`, 
          type: "info" 
        });
        await new Promise<void>(resolve => {
          (window as any).requestIdleCallback(() => {
            newFiles.push(file);
            const end = performance.now();
            setToast({ 
              message: `✅ ${file.name} başarıyla işlendi!\n\n⚡ Süre: ${((end-start)/1000).toFixed(2)} sn\n📏 Boyut: ${(file.size/1024/1024).toFixed(1)}MB\n\n📋 Liste: ${newFiles.length + 1} dosya hazır`, 
              type: "success" 
            });
            resolve();
          });
        });
        continue;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      // Dosyaları pending olarak ekle (store'a metadata, Map'e File objesi)
      newFiles.forEach(file => {
        // Duplikasyon kontrolü: Aynı isimli dosya Map'te varsa ekleme
        if (fileObjectsMapRef.current.has(file.name)) {
          console.warn(`⚠️ ${file.name} zaten Map'te var, tekrar eklenmiyor.`);
          return;
        }
        fileObjectsMapRef.current.set(file.name, file);

        // Metadata'yı store'a ekle
        addFileStatus({
          fileMetadata: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
          },
          status: 'pending',
          progress: 'İşlenmeyi bekliyor...',
          detectedType: 'belirsiz' // AI tespit edene kadar belirsiz
        });
      });

      console.log(`✅ ${newFiles.length} dosya pending olarak eklendi (duplikasyon kontrolü ile)`);
      
      // ✅ FIX: Dosyaları kuyruğa ekle (otomatik işleme için)
      setFileQueue(prev => [...prev, ...newFiles]);
      
      setToast({ 
        message: `📋 ${newFiles.length} dosya kuyruğa eklendi. Sırayla işlenecek...`, 
        type: "info" 
      });
      
      console.log(`📋 Kuyruk güncellendi: ${newFiles.length} yeni dosya (Toplam: ${fileQueue.length + newFiles.length})`);
    }

    // Input'u temizle
    event.target.value = '';
  };

  const handleProcessAllFiles = useCallback(async () => {
    console.log('🚀 Toplu dosya işleme başlatılıyor...');
    
    // Pending durumundaki tüm dosyaları bul
    const pendingFiles = fileStatuses.filter(fs => fs.status === 'pending');
    
    if (pendingFiles.length === 0) {
      console.log('✅ İşlenecek dosya yok, view adımına geçiliyor...');
      setCurrentStep('view');
      return;
    }

    console.log(`📦 ${pendingFiles.length} dosya işlenecek...`);

    // ✅ FIX: Dosyaları kuyruğa ekle (sıralı işleme için - PARALEL ÇAKIŞMA YOK!)
    const filesToQueue: File[] = [];
    
    // Her dosya için File objesini Map'ten al
    for (const fileStatus of pendingFiles) {
      const fileName = fileStatus.fileMetadata.name;
      const fileObj = fileObjectsMapRef.current.get(fileName);
      
      if (!fileObj) {
        console.error(`❌ File objesi bulunamadı: ${fileName}`);
        updateFileStatus(fileName, {
          status: 'error',
          progress: '❌ Dosya yüklenemedi (File objesi yok)'
        });
        continue;
      }

      filesToQueue.push(fileObj);
    }

    // Kuyruğa ekle - processFileQueue otomatik başlatacak (useEffect)
    setFileQueue(prev => [...prev, ...filesToQueue]);
    
    setToast({ 
      message: `📋 ${filesToQueue.length} dosya kuyruğa eklendi. Sırayla işlenecek...`, 
      type: "info" 
    });
    
    console.log(`📋 ${filesToQueue.length} dosya kuyruğa eklendi (otomatik sıralı işleme başlayacak)`);
    
    // View adımına geç - dosyalar işlenirken kullanıcı görebilsin
    setCurrentStep('view');
  }, [fileStatuses, setCurrentStep]);

  return (
<div className="min-h-screen bg-slate-950 p-4">
  <div className="max-w-7xl mx-auto space-y-4">
    {/* Header - Modern Dark Compact */}
    {currentStep !== "results" && (
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
        {/* Dot Pattern Background */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(148, 163, 184, 0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}></div>
        
        <div className="relative px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Title */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-600/20 rounded-lg blur-lg"></div>
                <div className="relative p-2.5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">İhale Şartname Analizi</h1>
                <p className="text-xs text-slate-500 mt-0.5">PDF • Word • TXT • JSON • Görsel • AI Destekli</p>
              </div>
            </div>
            
            {/* Right: AI Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-400 font-medium">Claude AI</span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Progress Steps - Compact Horizontal Only */}
    {currentStep !== "results" && (
      <div className="w-full">
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted =
              steps.findIndex((s) => s.id === currentStep) > index;

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                    isActive
                      ? "border-blue-600 bg-blue-600/10 shadow-lg shadow-blue-600/20"
                      : isCompleted
                      ? "border-green-600 bg-green-600/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <StepIcon
                    className={`w-4 h-4 ${
                      isActive
                        ? "text-blue-400"
                        : isCompleted
                        ? "text-green-400"
                        : "text-slate-500"
                    }`}
                  />
                  <span className={`text-xs font-medium ${
                    isActive
                      ? "text-white"
                      : isCompleted
                      ? "text-green-300"
                      : "text-slate-500"
                  }`}>
                    {step.label}
                  </span>
                </div>
                
                {/* Separator Line */}
                {index < steps.length - 1 && (
                  <div className={`h-px w-8 ${
                    isCompleted ? "bg-green-600" : "bg-slate-700"
                  }`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    )}

    {/* Progress Steps - Sadece results dışında göster */}
    {currentStep !== "results" && (
      <div className="w-full max-w-4xl mx-auto px-4 hidden">
        {/* Desktop: Horizontal steps */}
        <div className="hidden md:flex items-center justify-center space-x-8">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted =
              steps.findIndex((s) => s.id === currentStep) > index;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? "border-accent-400 bg-accent-500/20"
                      : isCompleted
                      ? "border-green-400 bg-green-500/20"
                      : "border-platinum-600 bg-platinum-800/60"
                  }`}
                >
                  <StepIcon
                    className={`w-5 h-5 ${
                      isActive
                        ? "text-accent-400"
                        : isCompleted
                        ? "text-green-400"
                        : "text-platinum-400"
                    }`}
                  />
                  {isProcessing && isActive && (
                    <Loader2 className="absolute w-6 h-6 text-accent-400 animate-spin" />
                  )}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    isActive
                      ? "text-accent-400"
                      : isCompleted
                      ? "text-green-400"
                      : "text-platinum-400"
                  }`}
                >
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-4 ${
                      isCompleted ? "bg-green-400" : "bg-platinum-600"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: Vertical steps */}
        <div className="md:hidden space-y-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted =
              steps.findIndex((s) => s.id === currentStep) > index;

            return (
              <div key={step.id} className="flex items-center space-x-4">
                <div
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? "border-accent-400 bg-accent-500/20"
                      : isCompleted
                      ? "border-green-400 bg-green-500/20"
                      : "border-platinum-600 bg-platinum-800/60"
                  }`}
                >
                  <StepIcon
                    className={`w-4 h-4 ${
                      isActive
                        ? "text-accent-400"
                        : isCompleted
                        ? "text-green-400"
                        : "text-platinum-400"
                    }`}
                  />
                  {isProcessing && isActive && (
                    <Loader2 className="absolute w-5 h-5 text-accent-400 animate-spin" />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      isActive
                        ? "text-accent-400"
                        : isCompleted
                        ? "text-green-400"
                        : "text-platinum-400"
                    }`}
                  >
                    {step.label}
                  </div>
                  {isActive && (
                    <div className="text-xs text-platinum-400 mt-1">
                      {isProcessing ? "İşleniyor..." : "Aktif"}
                    </div>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-6 ${
                      isCompleted ? "bg-green-400" : "bg-platinum-600"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}    {/* Content Area */}
    <AnimatePresence mode="wait">
      {currentStep === "upload" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          {/* 🆕 Session Loading Progress - İhale robotundan veri yüklenirken */}
          {sessionLoadProgress > 0 && sessionLoadProgress < 100 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-8 border border-blue-500/30"
            >
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-surface-primary mb-2">
                  İhale Verileri Yükleniyor...
                </h3>
                <p className="text-surface-secondary mb-4">
                  İhale robotundan gelen dökümanlar hazırlanıyor
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${sessionLoadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-400">
                  {sessionLoadProgress}%
                </p>
              </div>
            </motion.div>
          )}

          {/* Eğer önceki analiz varsa, bilgilendirme banner'ı göster */}
          {currentAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6"
            >
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5">ℹ️</div>
                <div className="flex-1">
                  <p className="text-sm text-blue-300">
                    Daha önce tamamlanmış bir analiz var. Yeni bir analiz başlatmak için aşağıdan dosyalarınızı yükleyin.
                  </p>
                  <button
                    onClick={() => setCurrentStep("results")}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Önceki analiz sonuçlarını görüntüle →
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 🆕 Auto-Analysis Preview Card */}
          {(autoAnalysisPreview.isProcessing || autoAnalysisPreview.stage === 'completed') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl p-6 border border-emerald-500/30 mb-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {autoAnalysisPreview.isProcessing ? (
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                      ) : null}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {autoAnalysisPreview.isProcessing && (
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${autoAnalysisPreview.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}

                  {/* Summary (CSV işlendiyse) */}
                  {autoAnalysisPreview.summary && (
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="bg-gray-800/40 rounded-xl p-4">
                        <div className="text-xs text-gray-400 mb-1">Kalem Sayısı</div>
                        <div className="text-2xl font-bold text-emerald-400">
                          {autoAnalysisPreview.summary.csvItemCount || 0}
                        </div>
                      </div>
                      <div className="bg-gray-800/40 rounded-xl p-4">
                        <div className="text-xs text-gray-400 mb-1">Toplam Maliyet</div>
                        <div className="text-2xl font-bold text-blue-400">
                          {(autoAnalysisPreview.summary.totalCost || 0).toLocaleString()} ₺
                        </div>
                      </div>
                      <div className="bg-gray-800/40 rounded-xl p-4">
                        <div className="text-xs text-gray-400 mb-1">Güven</div>
                        <div className="text-2xl font-bold text-purple-400">
                          {Math.round((autoAnalysisPreview.summary.confidence || 0) * 100)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Smart Action Button */}
                  {autoAnalysisPreview.stage === 'completed' && fileStatuses.some((fs: any) => fs.status === 'completed') && (
                    <button
                      onClick={handleProcessAllFiles}
                      className="mt-4 w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/25"
                    >
                      <Brain className="w-5 h-5" />
                      <span>Analiz Başlat</span>
                    </button>
                  )}
                </motion.div>
              )}

              {/* BASİT LİSTE - MODAL YOK! */}
              <SimpleDocumentList
                fileStatuses={fileStatuses}
                csvFiles={csvFiles}
                onFileSelect={async (files) => {
                  // Dosyaları pending olarak ekle + HIZLI TESPİT!
                  for (const file of files) {
                    // Duplicate check
                    if (fileStatuses.some(fs => fs.fileMetadata.name === file.name)) {
                      console.warn(`⚠️ ${file.name} zaten listede!`);
                      continue;
                    }

                    // File objesini Map'e ekle
                    fileObjectsMapRef.current.set(file.name, file);

                    // 1) Önce dosya isminden hızlı tahmin
                    const quickGuess = detectDocumentTypeFromFileName(file.name);
                    const quickConfidence = getConfidenceScore(quickGuess, file.name);

                    // 🆕 2a) TXT/JSON/CSV dosyaları için hemen preview oku
                    let textPreview = '';
                    const isTextBased = file.name.toLowerCase().endsWith('.txt') || 
                                       file.name.toLowerCase().endsWith('.json') || 
                                       file.name.toLowerCase().endsWith('.csv');
                    
                    if (isTextBased && file.size < 100 * 1024) { // 100KB'dan küçükse
                      try {
                        const content = await file.text();
                        textPreview = content.slice(0, 500); // İlk 500 karakter
                      } catch (error) {
                        console.warn(`Preview okunamadı: ${file.name}`, error);
                      }
                    }

                    // 2) Store'a ekle (başlangıç tahmini ile)
                    addFileStatus({
                      fileMetadata: {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                      },
                      status: 'pending',
                      progress: quickGuess !== 'belirsiz'
                        ? `📋 ${quickGuess} (dosya isminden tahmin)`
                        : 'İşlenmeyi bekliyor...',
                      detectedType: quickGuess,
                      detectedTypeConfidence: quickConfidence,
                      extractedText: textPreview || undefined, // 🆕 Önizleme metni
                    });

                    console.log(`✅ ${file.name} eklendi - Hızlı tahmin: ${quickGuess} (${Math.round(quickConfidence * 100)}%)`);

                    // 3) HER DOSYA İÇİN Gemini ile background tespit yap
                    if (quickGuess === 'belirsiz' || quickConfidence < 0.9) {
                      // Background'da Gemini ile daha iyi tahmin yap
                      (async () => {
                        try {
                          let textPreview = '';

                          // Dosya tipine göre preview oluştur
                          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                            // PDF: İlk 500KB oku
                            const arrayBuffer = await file.slice(0, Math.min(file.size, 500000)).arrayBuffer();
                            textPreview = new TextDecoder().decode(arrayBuffer);
                          } else if (file.name.toLowerCase().endsWith('.csv')) {
                            // CSV: İlk 10 satırı oku
                            const text = await file.text();
                            textPreview = text.split('\n').slice(0, 10).join('\n');
                          } else if (file.type.includes('text') || file.name.toLowerCase().endsWith('.txt')) {
                            // Text: İlk 1000 karakter
                            const text = await file.text();
                            textPreview = text.slice(0, 1000);
                          }

                          const response = await fetch('/api/ai/quick-detect-type', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              fileName: file.name,
                              textPreview: textPreview
                            })
                          });

                          if (response.ok) {
                            const result = await response.json();
                            if (result.success) {
                              updateFileStatus(file.name, {
                                detectedType: result.data.belge_turu,
                                detectedTypeConfidence: result.data.guven,
                                progress: `📋 ${result.data.belge_turu} (${result.data.sebep})`
                              });
                              console.log(`🤖 Gemini tespit: ${result.data.belge_turu} (${Math.round(result.data.guven * 100)}%)`);
                            }
                          }
                        } catch (err) {
                          console.warn('Gemini hızlı tespit başarısız:', err);
                        }
                      })();
                    }
                  }
                }}
                onFileRemove={(fileName) => {
                  removeFileStatus(fileName);
                  fileObjectsMapRef.current.delete(fileName);
                }}
                onFileProcess={async (fileName) => {
                  // İŞLE butonuna basınca işle
                  let fileObject = fileObjectsMapRef.current.get(fileName);

                  // File object yoksa, metadata'dan URL'i kontrol et ve indir
                  if (!fileObject) {
                    const fileStatus = fileStatuses.find(f => f.fileMetadata.name === fileName);
                    const fileUrl = fileStatus?.fileMetadata.url;

                    if (fileUrl) {
                      try {
                        console.log(`📥 Dosya indiriliyor: ${fileName} (${fileUrl})`);

                        // 🔐 Merkezi download utility (auth + ZIP extraction otomatik)
                        const downloadedFiles = await downloadDocument(fileUrl);

                        if (downloadedFiles.length === 0) {
                          throw new Error('Dosya indirilemedi');
                        }

                        // ZIP ise birden fazla dosya gelir
                        if (downloadedFiles.length > 1 || downloadedFiles[0].isFromZip) {
                          console.log(`📦 ZIP extract edildi: ${downloadedFiles.length} dosya`);

                          // 1️⃣ ZIP dosyasının kendi statusunu sil
                          removeFileStatus(fileName);

                          // 2️⃣ Her dosyayı işle
                          for (const df of downloadedFiles) {
                            const extractedFile = new File([df.blob], df.title, {
                              type: df.mimeType,
                              lastModified: Date.now()
                            });

                            // File objesini map'e kaydet
                            fileObjectsMapRef.current.set(df.title, extractedFile);

                            // Bu dosya için yeni status oluştur
                            const detectedType = df.title.toLowerCase().includes('idari') ? 'idari_sartname'
                              : df.title.toLowerCase().includes('teknik') ? 'teknik_sartname'
                              : 'diger';

                            addFileStatus({
                              fileMetadata: {
                                name: df.title,
                                size: df.size,
                                type: df.mimeType,
                                lastModified: Date.now(),
                              },
                              status: 'processing',
                              detectedType: detectedType,
                            });

                            // Bu dosyayı işle
                            console.log(`🔄 ZIP'ten çıkan dosya işleniyor: ${df.title}`);
                            await processSingleFile(extractedFile);
                          }

                          console.log(`✅ ZIP işleme tamamlandı: ${fileName} (${downloadedFiles.length} dosya)`);
                          return; // ZIP işlemi bitti, fonksiyondan çık
                        }

                        // Normal dosya (tek dosya)
                        const df = downloadedFiles[0];
                        const fileObject = new File([df.blob], df.title, {
                          type: df.mimeType,
                          lastModified: Date.now()
                        });

                        // File objesini map'e kaydet
                        fileObjectsMapRef.current.set(fileName, fileObject);

                        console.log(`✅ Dosya indirildi: ${fileName} (${(df.size / 1024).toFixed(2)} KB)`);

                      } catch (error: any) {
                        console.error(`❌ Dosya indirme hatası (${fileName}):`, error);
                        updateFileStatus(fileName, {
                          status: 'error',
                          progress: `❌ İndirme hatası: ${error.message}`
                        });
                        setToast({ message: `❌ Dosya indirilemedi: ${fileName}\n${error.message}`, type: "error" });
                        return;
                      }
                    } else {
                      console.error(`File object not found: ${fileName}`);
                      updateFileStatus(fileName, {
                        status: 'error',
                        progress: '❌ Dosya bulunamadı'
                      });
                      setToast({ message: `❌ Dosya bulunamadı: ${fileName}`, type: "error" });
                      return;
                    }
                  }

                  // Dosyayı işle
                  if (fileObject) {
                    await processSingleFile(fileObject);
                  }
                }}
                onCSVSelect={async (files) => {
                  // CSV dosyalarını pending olarak ekle
                  for (const file of files) {
                    if (!file.name.toLowerCase().endsWith('.csv')) {
                      setToast({ message: `❌ ${file.name} CSV dosyası değil!`, type: "error" });
                      continue;
                    }

                    // Duplicate check
                    if (csvFiles.some(csv => csv.fileMetadata.name === file.name)) {
                      setToast({ message: `⚠️ ${file.name} zaten listede!`, type: "info" });
                      continue;
                    }

                    // File objesini Map'e ekle
                    fileObjectsMapRef.current.set(file.name, file);

                    // 1) Önce dosya isminden hızlı tahmin
                    const quickGuess = detectDocumentTypeFromFileName(file.name);
                    const quickConfidence = getConfidenceScore(quickGuess, file.name);

                    addCSVFile({
                      fileMetadata: {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                      },
                      status: 'pending'
                    });

                    console.log(`✅ CSV dosyası pending olarak eklendi: ${file.name}`);

                    // 2) Gemini ile background tespit (CSV için ilk 10 satır)
                    (async () => {
                      try {
                        const text = await file.text();
                        const previewLines = text.split('\n').slice(0, 10).join('\n');

                        const response = await fetch('/api/ai/quick-detect-type', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fileName: file.name,
                            textPreview: previewLines
                          })
                        });

                        if (response.ok) {
                          const result = await response.json();
                          if (result.success) {
                            // CSV için detected type bilgisi yok, sadece log
                            console.log(`🤖 Gemini CSV tespit: ${result.data.belge_turu} (${Math.round(result.data.guven * 100)}%)`);
                          }
                        }
                      } catch (err) {
                        console.warn('Gemini CSV tespit başarısız:', err);
                      }
                    })();
                  }
                }}
                onCSVProcess={async (fileName) => {
                  // İŞLE butonuna basınca CSV'yi işle
                  const fileObject = fileObjectsMapRef.current.get(fileName);
                  if (!fileObject) {
                    console.error(`File object not found: ${fileName}`);
                    return;
                  }

                  try {
                    updateCSVFile(fileName, { status: 'processing' });
                    console.log(`📊 CSV dosyası işleniyor: ${fileName}`);

                    const analysis = await CSVParser.parseFile(fileObject);

                    console.log(`✅ CSV analizi tamamlandı:`, {
                      items: analysis.summary.total_items,
                      total: analysis.summary.total_cost,
                      confidence: analysis.confidence
                    });

                    updateCSVFile(fileName, { status: 'completed', analysis });
                  } catch (error) {
                    console.error(`❌ CSV işleme hatası (${fileName}):`, error);
                    updateCSVFile(fileName, {
                      status: 'error',
                      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
                    });
                    setToast({ message: `❌ ${fileName} işlenirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`, type: "error" });
                  }
                }}
                onCSVRemove={(fileName) => {
                  removeCSVFile(fileName);
                }}
              />

              {/* ✅ FIX: File Queue Display (Sıralı işleme görünürlüğü) */}
              {(fileQueue.length > 0 || currentlyProcessing) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        📋 Dosya İşleme Kuyruğu
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        {currentlyProcessing ? (
                          <>
                            🔄 İşleniyor: <strong>{currentlyProcessing.name}</strong> ({(currentlyProcessing.size / 1024 / 1024).toFixed(1)} MB)
                          </>
                        ) : (
                          'Hazırlanıyor...'
                        )}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Kuyrukta bekleyen: {fileQueue.length} dosya
                      </p>
                    </div>
                  </div>
                  
                  {/* Queue list - Sonraki 3 dosya */}
                  {fileQueue.length > 0 && (
                    <div className="mt-4 space-y-1">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">
                        Sıradaki Dosyalar:
                      </p>
                      {fileQueue.slice(0, 3).map((file, idx) => (
                        <div key={file.name} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 pl-2">
                          <span className="font-mono bg-blue-100 dark:bg-blue-800/30 px-1.5 py-0.5 rounded">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-blue-400 dark:text-blue-500 whitespace-nowrap">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                      ))}
                      {fileQueue.length > 3 && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 pl-2 pt-1">
                          ... ve {fileQueue.length - 3} dosya daha
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* İşlem Sırası Rehberi */}
              {(fileStatuses.length > 0 || csvFiles.length > 0) && (
                <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-blue-400 text-lg">💡</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">
                        İşlem Sırası
                      </h4>
                      <div className="space-y-2 text-xs text-gray-300">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">1️⃣</span>
                          <span>Her dosya kartındaki <span className="text-blue-400 font-medium">"İşle"</span> butonuna basarak dosyaları işleyin</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">2️⃣</span>
                          <span>CSV dosyalarınız varsa, bunları da işleyin (maliyet analizi için)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">3️⃣</span>
                          <span>Tüm dosyalar işlendikten sonra <span className="text-green-400 font-medium">"Analiz Et"</span> butonuna basın</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dosya İşleme Butonları */}
              {(fileStatuses.length > 0 || csvFiles.length > 0) && (
                <div className="mt-4 flex gap-3">
                  {/* Pending CSV dosyaları işle */}
                  {csvFiles.some(csv => csv.status === 'pending') && (
                    <button
                      type="button"
                      onClick={async () => {
                        // CSV'ler otomatik işleniyor, manuel işlem gerekmiyor
                        alert('ℹ️ CSV dosyaları yüklendiğinde otomatik olarak işlenir.');
                      }}
                      disabled={true}
                      className="flex-1 px-6 py-3.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/25"
                      title="CSV dosyaları otomatik işlenir"
                    >
                      <Upload className="w-5 h-5" />
                      <span>CSV İşle ({csvFiles.filter(csv => csv.status === 'pending').length})</span>
                    </button>
                  )}

                  {/* KALDIRILDI: Pending dosyaları işle butonu - Artık her kartta kendi "İşle" butonu var */}

                  {/* Completed dosyaları analiz et */}
                  {fileStatuses.some(fs => fs.status === 'completed') && (
                    <button
                      type="button"
                      onClick={handleProcessAllFiles}
                      disabled={fileStatuses.some(fs => fs.status === 'processing')}
                      className="flex-1 px-6 py-3.5 bg-green-600/90 hover:bg-green-600 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/25"
                    >
                      <Brain className="w-5 h-5" />
                      <span>
                        Analiz Et ({fileStatuses.filter(fs => fs.status === 'completed').length} PDF/DOC
                        {csvFiles.filter(c => c.status === 'completed').length > 0 && ` + ${csvFiles.filter(c => c.status === 'completed').length} CSV`})
                      </span>
                    </button>
                  )}
                </div>
              )}
        </motion.div>
      )}

      {/* ✅ FIX: "processing" step kartı KALDIRILDI - Queue kartı zaten var! */}
      {/* currentStep === "processing" kartı gereksiz çünkü artık queue sistemi kullanıyoruz */}

      {currentStep === "view" && (
        <>
          {/* 🆕 Skeleton Loading - Dökümanlar yüklenirken */}
          {(!documentPages.length || !documentStats) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-r from-gray-800/60 to-gray-900/60 rounded-2xl p-8 border border-gray-700/50">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-6 bg-gray-700 rounded-lg w-48 animate-pulse"></div>
                  <div className="flex space-x-2">
                    <div className="h-10 bg-gray-700 rounded-lg w-24 animate-pulse"></div>
                    <div className="h-10 bg-blue-600 rounded-lg w-32 animate-pulse"></div>
                  </div>
                </div>

                {/* Stats skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-lg animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-700 rounded w-20 animate-pulse"></div>
                          <div className="h-6 bg-gray-700 rounded w-16 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Content skeleton */}
                <div className="space-y-4">
                  <div className="h-4 bg-gray-700 rounded w-full animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2 animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded w-5/6 animate-pulse"></div>
                </div>

                <div className="mt-6">
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Dökümanlar hazırlanıyor...</span>
                      <span className="text-sm font-semibold text-blue-400">{sessionLoadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${sessionLoadProgress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Status mesajları */}
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center space-x-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span className="text-sm">
                        {sessionLoadProgress < 20 && '📦 Dökümanlar IndexedDB\'den okunuyor...'}
                        {sessionLoadProgress >= 20 && sessionLoadProgress < 50 && `📄 Dosyalar işleniyor... (${Math.floor(sessionLoadProgress / 10)}/10)`}
                        {sessionLoadProgress >= 50 && sessionLoadProgress < 90 && '🔍 Metadata çıkarılıyor...'}
                        {sessionLoadProgress >= 90 && sessionLoadProgress < 100 && '✅ Son kontroller yapılıyor...'}
                        {sessionLoadProgress >= 100 && '🎉 Tamamlandı!'}
                      </span>
                    </div>
                    
                    {/* Dosya sayısı bilgisi */}
                    {fileStatuses.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {fileStatuses.filter(fs => fs.status === 'completed').length} / {fileStatuses.length} dosya hazır
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Normal view content */}
          {documentPages.length > 0 &&
            documentStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-surface-primary">
                Döküman Önizlemesi
              </h3>
                                        <div className="flex items-center space-x-2">
                <button
                
                 
                  onClick={() => window.print()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline-block mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 16v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4m12 0V8a2 2 0 00-2-2H8a2 2 0 00-2 2v8m12 0h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2m-8 0H6a2 2 0 00-2 2v4a2 2 0 002 2h2"
                    />
                  </svg>
                  Yazdır
                </button>
                <button
                  onClick={resetProcess}
                  className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline-block mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.403 1.403a2 2 0 01-1.414.597H4a2 2 0 01-2-2V4a2 2 0 012-2h14a2 2 0 012 2v5.586a2 2 0 01-.586 1.414L17 15v2z"
                    />
                  </svg>
                  Yeni Analiz Başlat
                </button>
              </div>
            </div>

            {/* Sayfa Önizleme Kartları */}
            <div className="grid grid-cols-1 gap-4">
              {documentPages.map((page, index) => (
                <motion.div
                  key={page.pageNumber}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 rounded-lg bg-gray-800 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-400">
                      Sayfa {page.pageNumber} / {documentStats.totalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDownloadPage(page.pageNumber)}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        <Download className="w-4 h-4 inline-block mr-1" />
                        İndir
                      </button>
                      <button
                        onClick={() => handleDeletePage(page.pageNumber)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 inline-block mr-1" />
                        Sil
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-surface-secondary mb-4">
                    {page.wordCount} kelime • {page.processingTime} sn
                  </div>
                  <div className="text-sm text-surface-primary whitespace-pre-wrap break-words">
                    {page.content}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Detaylı İstatistikler - Modern Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700"
            >
              <h4 className="text-lg font-semibold text-surface-primary mb-4">
                Döküman İstatistikleri
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Toplam Sayfa
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.totalPages}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Boş Sayfa
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.emptyPages}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Düşük Kalite Sayfa
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.lowQualityPages}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Toplam Kelime
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.totalWords}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Ortalama Kalite
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.averageQuality.toFixed(1)} / 10
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    OCR ile İşlenen Sayfalar
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.ocrPagesProcessed}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    İşlem Süresi (toplam)
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(documentStats.processingTime / 1000).toFixed(1)} sn
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Dosya Türü
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {documentStats.fileType}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </>
      )}

      {/* Results Step - AI Analysis Results */}
      {currentStep === "results" && currentAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6"
        >
          <EnhancedAnalysisResults
            analysis={currentAnalysis}
            onReturnToView={() => setCurrentStep("view")}
            onNewAnalysis={() => {
              resetProcess();
              setCurrentStep("upload");
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</div>
);
}