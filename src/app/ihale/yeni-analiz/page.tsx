"use client";

import { useState, useEffect, useRef } from "react";
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
import { detectDocumentTypeFromFileName, getConfidenceScore } from "@/lib/utils/quick-document-detector";

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
// File objelerini ayrı bir Map'te tutuyoruz (runtime-only, serialize edilmeyecek)

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
}

type ProcessStep = "upload" | "processing" | "view" | "analyze" | "results";

export default function IhalePage() {
  // Zustand Store (global state)
  const {
    currentStep,
    fileStatuses,
    csvFiles,
    isProcessing,
    currentAnalysis,
    setCurrentStep,
    setFileStatuses,
    addFileStatus,
    updateFileStatus,
    removeFileStatus,
    clearFileStatuses,
    setIsProcessing,
    setCurrentAnalysis,
    addCSVFile,
    updateCSVFile,
    removeCSVFile,
    clearCSVFiles,
  } = useIhaleStore();

  // Local state (sadece UI-specific state kalsın)
  // Runtime-only File arrays/maps (serialize edilmeyecek - useRef ile tutuluyor)
  const uploadedFilesRef = useRef<File[]>([]); // Geçici - dosya yükleme için (useRef - state DEĞİL!)
  const fileObjectsMapRef = useRef<Map<string, File>>(new Map());
  const [documentPages, setDocumentPages] = useState<DocumentPage[]>([]);
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(
    null
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<DetailedAnalysis | null>(
    null
  );
  const useNewAI = true; // Always use real AI
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");
  const [useOCR, setUseOCR] = useState(true); // Varsayılan olarak açık

  // İhale Takip entegrasyonu
  const [showTenderSelection, setShowTenderSelection] = useState(false);
  const [tenders, setTenders] = useState<any[]>([]);
  const [loadingTenders, setLoadingTenders] = useState(false);
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [fetchingTenderContent, setFetchingTenderContent] = useState(false);
  const [tenderSearchQuery, setTenderSearchQuery] = useState('');

  // İhale listesini çek
  const fetchTenders = async () => {
    try {
      setLoadingTenders(true);
      const response = await fetch('/api/ihale-scraper/list?limit=500');
      const data = await response.json();

      if (data.success && data.data) {
        setTenders(data.data);
        setShowTenderSelection(true);
      } else {
        alert('İhaleler yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Tender fetch error:', error);
      alert('İhaleler yüklenirken hata oluştu');
    } finally {
      setLoadingTenders(false);
    }
  };

  // İhale seçildiğinde dokümanları çek ve analiz et
  const handleTenderSelect = async (tender: any) => {
    try {
      setFetchingTenderContent(true);
      setSelectedTender(tender);

      console.log('🔍 İhale seçildi:', tender.title);
      console.log('📡 URL:', tender.source_url);

      // İhale içeriğini AI ile çek
      const response = await fetch('/api/ihale-scraper/fetch-full-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tender.source_url,
          tenderId: tender.id // 🆕 Veritabanına kaydetmek için tender ID'si
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'İçerik çekilemedi');
      }

      console.log('✅ İhale içeriği çekildi:', result.data);

      // Modal'ı kapat
      setShowTenderSelection(false);

      // Dokümanları indir ve sisteme yükle
      const documents = result.data.documents || [];
      console.log(`📥 ${documents.length} doküman indiriliyor...`);

      const downloadedFiles: File[] = [];

      for (const doc of documents) {
        try {
          console.log(`📄 İndiriliyor: ${doc.title}`);

          // Dokümanı indir
          const downloadResponse = await fetch(`/api/ihale-scraper/download-document?url=${encodeURIComponent(doc.url)}`);

          if (!downloadResponse.ok) {
            console.error(`❌ ${doc.title} indirilemedi:`, downloadResponse.statusText);
            continue;
          }

          // Blob'a çevir
          const blob = await downloadResponse.blob();

          // Dosya adını belirle (content-disposition header'ından al)
          const contentDisposition = downloadResponse.headers.get('content-disposition');
          let filename = doc.title || 'document.pdf';

          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
            }
          }

          // Eğer uzantı yoksa .pdf ekle
          if (!filename.includes('.')) {
            filename += '.pdf';
          }

          // File objesi oluştur
          const file = new File([blob], filename, { type: blob.type });
          downloadedFiles.push(file);

          console.log(`✅ ${filename} indirildi (${(blob.size / 1024).toFixed(1)} KB)`);
        } catch (docError) {
          console.error(`❌ ${doc.title} indirilirken hata:`, docError);
        }
      }

      // İndirilen dosyaları sisteme ekle
      if (downloadedFiles.length > 0) {
        console.log(`📂 ${downloadedFiles.length} dosya sisteme ekleniyor...`);

        // Dosyaları store'a ekle
        for (const file of downloadedFiles) {
          // File objesini Map'e ekle
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
            progress: 'İhale Takip\'ten eklendi - İşlenmeyi bekliyor...'
          });
        }

        console.log(`✅ ${downloadedFiles.length} dosya başarıyla eklendi!`);

        // 🆕 1) Malzeme listesi varsa CSV olarak ekle (AI'dan gelen)
        if (result.data.itemsList) {
          const itemsBlob = new Blob([result.data.itemsList], { type: 'text/csv' });
          const itemsFile = new File(
            [itemsBlob],
            `ihale_malzeme_listesi_${tender.id || Date.now()}.csv`,
            { type: 'text/csv' }
          );

          fileObjectsMapRef.current.set(itemsFile.name, itemsFile);

          addCSVFile({
            fileMetadata: {
              name: itemsFile.name,
              size: itemsFile.size,
              type: itemsFile.type,
              lastModified: itemsFile.lastModified,
            },
            status: 'pending'
          });

          console.log('✅ Malzeme listesi CSV olarak eklendi');
        }

        // 🆕 2) İhale ilanı AYRI TXT dosyası olarak ekle (malzeme listesi olmadan)
        if (result.data.fullText) {
          const announcementBlob = new Blob([result.data.fullText], { type: 'text/plain' });
          const announcementFile = new File(
            [announcementBlob],
            `ihale_ilan_${tender.id || Date.now()}.txt`,
            { type: 'text/plain' }
          );

          fileObjectsMapRef.current.set(announcementFile.name, announcementFile);

          addFileStatus({
            fileMetadata: {
              name: announcementFile.name,
              size: announcementFile.size,
              type: announcementFile.type,
              lastModified: announcementFile.lastModified,
            },
            status: 'pending',
            progress: 'İhale ilanı metni eklendi - İşlenmeyi bekliyor...'
          });

          console.log('✅ İhale ilanı text dosyası olarak eklendi');
        }

        // Upload sayfasına geç ki dosyalar görünsün
        setCurrentStep("upload");

        // Success message (modal kapandıktan sonra göster)
        setTimeout(() => {
          const hasItemsList = result.data.itemsList ? '\n📊 Malzeme listesi CSV olarak eklendi' : '';
          alert(`✅ İhale başarıyla eklendi!\n\n📄 ${downloadedFiles.length} doküman indirildi\n📝 İhale ilanı metni eklendi${hasItemsList}\n\n💡 Dosyaları "Dosyaları İşle" butonuna basarak analiz edebilirsiniz.`);
        }, 500);
      } else {
        // Upload sayfasına geç (en azından ihale ilanı text dosyası var)
        setCurrentStep("upload");

        setTimeout(() => {
          alert(`⚠️ İhale çekildi ama doküman indirilemedi.\n\n📝 İhale ilanı metni eklendi.\n\nDokümanları manuel olarak yükleyebilirsiniz.`);
        }, 500);
      }

    } catch (error: any) {
      console.error('❌ İhale çekme hatası:', error);
      alert('İhale çekilemedi: ' + error.message);
    } finally {
      setFetchingTenderContent(false);
    }
  };

  // Manuel hydration KALDIRILDI - Persist middleware artık yok (PERSIST-OFF.md)

  // Sayfa yüklendiğinde eğer currentAnalysis varsa direkt results'a git
  // useRef ile infinite loop'u önle
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (currentAnalysis && currentStep === "upload" && !hasRedirected.current) {
      console.log("📊 Mevcut analiz bulundu, results adımına geçiliyor...");
      hasRedirected.current = true;
      setCurrentStep("results");
    }

    // Reset ref when leaving upload step
    if (currentStep !== "upload") {
      hasRedirected.current = false;
    }
  }, [currentAnalysis, currentStep, setCurrentStep]);

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
  const [autoDeepAnalysisTriggered, setAutoDeepAnalysisTriggered] = useState(false);

  useEffect(() => {
    // Eğer results adımındaysak VE henüz tetiklenmediyse
    if (currentStep === "results" && currentAnalysis && !autoDeepAnalysisTriggered) {
      console.log("🚀 Derin analiz otomatik başlatılıyor (bekleme YOK)...");
      // EnhancedAnalysisResults component'ine "deep" sekmesini aç sinyali gönder
      setAutoDeepAnalysisTriggered(true);
    }
  }, [currentStep, currentAnalysis, autoDeepAnalysisTriggered]);

  const steps = [
    { id: "upload", label: "Yükle", icon: Upload },
    { id: "processing", label: "Sayfalara Böl", icon: FileText },
    { id: "view", label: "Görüntüle", icon: Eye },
    { id: "analyze", label: "AI Analizi", icon: Brain },
    { id: "results", label: "Sonuç", icon: CheckCircle },
  ];

  // Dosya ekleme ve hemen işleme başlat
  const handleAddFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    const newFiles: File[] = [];

    for (const file of files) {
      // Dosya tipi kontrolü - PNG, JPG eklendi
      const isValidType =
        file.type.includes("pdf") ||
        file.type.includes("word") ||
        file.type.includes("image") ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.name.toLowerCase().endsWith(".docx") ||
        file.name.toLowerCase().endsWith(".doc") ||
        file.name.toLowerCase().endsWith(".png") ||
        file.name.toLowerCase().endsWith(".jpg") ||
        file.name.toLowerCase().endsWith(".jpeg");

      if (!isValidType) {
        alert(`❌ ${file.name} desteklenmeyen format!\n\n✅ Kabul edilen: PDF, Word, PNG, JPG`);
        continue;
      }

      if (file.size > maxSize) {
        alert(`❌ ${file.name} çok büyük! (Max: 50MB)`);
        continue;
      }

      // Aynı dosya zaten ekli mi?
      if (fileStatuses.some(fs => fs.fileMetadata.name === file.name)) {
        alert(`⚠️ ${file.name} zaten listede!`);
        continue;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      // Dosyaları pending olarak ekle (store'a metadata, Map'e File objesi)
      newFiles.forEach(file => {
        // File objesini Map'e ekle (useRef - state değil!)
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

      console.log(`✅ ${newFiles.length} dosya pending olarak eklendi (işlem başlatılmadı)`);
      // NOT: Dosyalar PENDING durumunda - kullanıcı "Dosyaları İşle" butonuna basınca işlenecek
    }

    // Input'u temizle
    event.target.value = '';
  };

  // İşlem kuyruğu yönetimi - paralel işleme
  const processingQueueRef = useRef<Set<string>>(new Set());

  // Tek dosya işle - İYİLEŞTİRME: Zustand store kullan + Detaylı Progress + PARALEL
  const processSingleFile = async (file: File) => {
    // Zaten işleniyor mu kontrol et
    if (processingQueueRef.current.has(file.name)) {
      console.warn(`⚠️ ${file.name} zaten işleniyor, atlanıyor...`);
      return;
    }

    // Kuyruğa ekle
    processingQueueRef.current.add(file.name);

    console.log(`İşleniyor: ${file.name}`);
    const startTime = Date.now();

    // 1️⃣ Yükleme başladı
    updateFileStatus(file.name, {
      status: 'processing',
      progress: '📤 Dosya yükleniyor...'
    });

    try {
      const formData = new FormData();
      formData.append("file0", file);
      formData.append("fileCount", "1");
      formData.append("useOCR", useOCR.toString());

      // 2️⃣ Server'a gönderiliyor
      updateFileStatus(file.name, {
        progress: '🚀 Server\'a gönderiliyor...'
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.replace('data: ', ''));

            if (data.type === 'progress') {
              // Canlı progress güncelle
              updateFileStatus(file.name, {
                progress: data.message,
                progressPercentage: Math.round(data.progress || 0)
              });
            } else if (data.type === 'success') {
              // Final result
              result = data;
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseError) {
            console.warn('Parse error:', parseError);
          }
        }
      }

      if (result) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // 4️⃣ Başarılı - İlk durum
        updateFileStatus(file.name, {
          status: 'completed',
          progress: `✅ Tamamlandı (${result.stats?.wordCount || 0} kelime, ${elapsed}s)`,
          progressPercentage: 100,
          wordCount: result.stats?.wordCount || 0,
          extractedText: result.text || ''
        });

        console.log(`✅ ${file.name} tamamlandı (${elapsed}s)`);

        // 5️⃣ YENİ: Belge türü tespiti yap (background - hata verse bile devam et)
        try {
          console.log(`🔍 Belge türü tespit ediliyor: ${file.name}`);

          // Progress güncelle
          updateFileStatus(file.name, {
            progress: `🔍 AI belge türü tespit ediyor... (${result.stats?.wordCount || 0} kelime)`
          });

          const docTypeResponse = await fetch('/api/ai/detect-document-type', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: result.text || '',
              fileName: file.name
            })
          });

          if (docTypeResponse.ok) {
            const docTypeResult = await docTypeResponse.json();
            if (docTypeResult.success) {
              const aiDetectedType = docTypeResult.data.belge_turu;
              const aiConfidence = docTypeResult.data.guven;
              const aiReason = docTypeResult.data.sebep;

              // Kullanıcı seçimi var mı?
              const currentFile = fileStatuses.find(fs => fs.fileMetadata.name === file.name);
              const userSelectedType = currentFile?.detectedType;

              // AI'nın tespit ettiği türü güncelle
              updateFileStatus(file.name, {
                detectedType: aiDetectedType,
                detectedTypeConfidence: aiConfidence,
                progress: `✅ Tamamlandı • ${Math.round(aiConfidence * 100)}% güvenle tespit edildi`
              });

              console.log(`✅ AI Tespit: ${aiDetectedType} (${Math.round(aiConfidence * 100)}%)`);

              // DOĞRULAMA: Kullanıcı seçimi ile AI tespiti uyuşuyor mu?
              if (userSelectedType && userSelectedType !== aiDetectedType && aiConfidence > 0.7) {
                console.warn(`⚠️ UYARI: Kullanıcı "${userSelectedType}" seçti ama AI "${aiDetectedType}" tespit etti!`);
                console.warn(`   Sebep: ${aiReason}`);

                // UI'da uyarı göster
                updateFileStatus(file.name, {
                  progress: `⚠️ Tamamlandı • AI farklı tür tespit etti (${Math.round(aiConfidence * 100)}%)`
                });

                // TODO: Toast notification eklenebilir
              } else if (userSelectedType === aiDetectedType) {
                console.log(`✅ Doğrulama: Kullanıcı seçimi ile AI tespiti uyuşuyor!`);
                updateFileStatus(file.name, {
                  progress: `✅ Tamamlandı • Doğrulandı (${Math.round(aiConfidence * 100)}%)`
                });
              }
            }
          }
        } catch (docTypeError) {
          console.warn(`⚠️ Belge türü tespiti başarısız (${file.name}):`, docTypeError);
          // Sessizce devam et - belge türü kritik değil
        }
      } else {
        throw new Error(result.error || "İşleme hatası");
      }
    } catch (error) {
      console.error(`❌ ${file.name} hatası:`, error);

      // Hata - error işaretle
      updateFileStatus(file.name, {
        status: 'error',
        progress: '❌ Hata',
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });
    } finally {
      // Kuyruktan çıkar (başarılı veya hatalı olsa da)
      processingQueueRef.current.delete(file.name);
      console.log(`🔓 ${file.name} kuyruktan çıkarıldı (aktif: ${processingQueueRef.current.size})`);
    }
  };

  // Dosya listesinden kaldır
  const handleRemoveFile = (index: number) => {
    const fileName = fileStatuses[index]?.fileMetadata.name;
    if (fileName) {
      removeFileStatus(fileName);
    }
  };

  // Tüm dosyaları temizle
  const handleClearAllFiles = () => {
    clearFileStatuses();
  };

  // CSV Upload Handler
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      // CSV format kontrolü
      if (!file.name.toLowerCase().endsWith('.csv')) {
        alert(`❌ ${file.name} CSV dosyası değil!`);
        continue;
      }

      // Add to store with pending status
      addCSVFile({
        fileMetadata: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },
        status: 'pending'
      });

      // Process CSV
      try {
        updateCSVFile(file.name, { status: 'processing' });

        console.log(`📊 CSV dosyası işleniyor: ${file.name}`);
        console.log(`📁 Dosya boyutu: ${file.size} bytes`);

        const analysis = await CSVParser.parseFile(file);

        console.log(`✅ CSV analizi tamamlandı:`, {
          items: analysis.summary.total_items,
          total: analysis.summary.total_cost,
          confidence: analysis.confidence,
          fullAnalysis: analysis
        });

        if (analysis.summary.total_items === 0) {
          console.warn(`⚠️ CSV'de hiç ürün bulunamadı! Kolon isimleri kontrol edilmeli.`);
        }

        updateCSVFile(file.name, {
          status: 'completed',
          analysis
        });

      } catch (error) {
        console.error(`❌ CSV işleme hatası (${file.name}):`, error);
        updateCSVFile(file.name, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Bilinmeyen hata'
        });
        alert(`❌ ${file.name} işlenirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
      }
    }

    // Clear input
    event.target.value = '';
  };

  // Tümünü AI ile analiz et
  const handleProcessAllFiles = async () => {
    const completedFiles = fileStatuses.filter(fs => fs.status === 'completed');

    if (completedFiles.length === 0) {
      alert("⚠️ Lütfen en az bir dosya ekleyin ve işlensin!");
      return;
    }

    console.log(`=== ${completedFiles.length} DOSYA ANALİZ EDİLECEK ===`);

    setCurrentStep("processing");
    setIsProcessing(true);

    try {
      // Tüm dosyaların metinlerini birleştir (zaten etiketli geliyorlar)
      const combinedText = completedFiles
        .map(fs => fs.extractedText || '')
        .join("\n" + "=".repeat(80) + "\n\n");

      console.log(`Toplam ${completedFiles.length} dosya birleştirildi, ${combinedText.length} karakter`);

      if (!combinedText.trim()) {
        throw new Error("Birleştirilmiş metin boş!");
      }

      // DocumentPages oluştur
      const totalWordCount = completedFiles.reduce((sum, fs) => sum + (fs.wordCount || 0), 0);

      const realPages = [{
        pageNumber: 1,
        content: combinedText,
        isEmpty: false,
        quality: 1.0,
        wordCount: totalWordCount,
        keyTerms: [],
        processingTime: 0,
      }];

      const stats = {
        totalPages: completedFiles.length, // Her dosya bir "sayfa" olarak sayılıyor
        emptyPages: 0,
        lowQualityPages: 0,
        totalWords: totalWordCount,
        averageQuality: 1.0,
        ocrPagesProcessed: 0,
        processingTime: 0,
        fileType: 'multiple',
      };

      setDocumentPages(realPages);
      setDocumentStats(stats);
      setWarnings([]);

      // localStorage'a kaydet
      if (typeof window !== 'undefined') {
        localStorage.setItem('ihale_document_text', combinedText);
      }

      setCurrentStep("view");
      console.log("=== DOSYALAR BİRLEŞTİRİLDİ, VIEW ADIMINA GEÇİLDİ ===");
    } catch (error) {
      console.error("=== UPLOAD ERROR ===", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );

      const errorMessage =
        error instanceof Error ? error.message : "Bilinmeyen hata";

      let userMessage = "Dosya yüklenirken hata oluştu:\n\n";

      // Hataya göre özelleştirilmiş mesajlar
      if (errorMessage.includes("FILE_TOO_LARGE")) {
        userMessage +=
          "📁 Dosya çok büyük. Maksimum 50MB boyutunda dosya yükleyebilirsiniz.";
      } else if (errorMessage.includes("UNSUPPORTED_FORMAT")) {
        userMessage +=
          "📄 Desteklenmeyen dosya formatı. PDF veya Word dosyası seçin.";
      } else if (errorMessage.includes("NO_TEXT_EXTRACTED")) {
        userMessage +=
          "📝 Dosyadan metin çıkarılamadı. OCR seçeneğini aktifleştirip tekrar deneyin.";
      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {
        userMessage +=
          "🌐 İnternet bağlantısı problemi. Bağlantınızı kontrol edin.";
      } else {
        userMessage += "🔧 " + errorMessage;
      }

      userMessage +=
        "\n\n💡 Öneriler:\n• Dosya formatını kontrol edin (PDF/Word)\n• Dosya boyutunu kontrol edin (<50MB)\n• OCR seçeneğini deneyin";

      alert(userMessage);
      setCurrentStep("upload");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    setCurrentStep("analyze");
    setIsProcessing(true);
    setAnalysisProgress(0);
    setAnalysisStage("Metin analizi başlatılıyor...");

    try {
      console.log("=== ANALIZ BAŞLADI ===");
      console.log("Document pages:", documentPages.length);
      console.log("useNewAI:", useNewAI);

      // Ön kontroller
      if (!documentPages || documentPages.length === 0) {
        throw new Error(
          "Analiz edilecek döküman verisi bulunamadı. Lütfen dosyayı tekrar yükleyin."
        );
      }

      const fullText = documentPages[0]?.content?.trim() || "";
      console.log("Full text length:", fullText.length);

      if (!fullText || fullText.length < 50) {
        throw new Error(
          "Döküman metni çok kısa veya boş. Lütfen farklı bir dosya deneyin veya OCR seçeneğini aktifleştirin."
        );
      }

      // Gerçek AI analizi başlatılıyor
      setAnalysisProgress(10);
      setAnalysisStage("Claude AI'a bağlanılıyor...");

      // Yeni AI endpoint kullan - GERÇEK ZAMANLI STREAMING
      if (useNewAI) {
        console.log("🔴 Streaming API başlatılıyor...");

        let result: any = null;
        const analysisStartTime = Date.now();

        // CSV analizlerini hazırla
        const completedCSVAnalyses = csvFiles
          .filter(csv => csv.status === 'completed' && csv.analysis)
          .map(csv => ({
            fileName: csv.fileMetadata.name,
            analysis: csv.analysis
          }));

        console.log(`📊 ${completedCSVAnalyses.length} CSV analizi API'ye gönderiliyor`);

        try {
          // EventSource ile gerçek zamanlı progress takibi
          const response = await fetch("/api/ai/full-analysis?stream=true", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: fullText,
              csvAnalyses: completedCSVAnalyses.length > 0 ? completedCSVAnalyses : undefined
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("Response body reader not available");
          }

          // Stream'den gelen verileri oku
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));

                  if (data.type === 'progress') {
                    // Gerçek zamanlı progress güncelleme
                    const elapsed = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
                    setAnalysisProgress(data.progress);
                    setAnalysisStage(`${data.stage} ${data.details ? `(${data.details})` : ''} - ${elapsed}s`);
                    console.log(`📊 [${data.progress}%] ${data.stage} - ${elapsed}s`);
                  } else if (data.type === 'complete') {
                    // Analiz tamamlandı
                    result = data.result;
                    setAnalysisProgress(100);
                    const totalTime = ((Date.now() - analysisStartTime) / 1000).toFixed(1);

                    // 💾 Cache feedback
                    const metadata = data.metadata || {};
                    const isCached = metadata.cached || metadata.cache_hit;

                    if (isCached) {
                      const cacheAge = metadata.cache_age_ms ? Math.round(metadata.cache_age_ms / 1000 / 60) : 0;
                      setAnalysisStage(`💾 Cache'den geldi! (${cacheAge} dakika önce analiz edildi)`);
                      console.log(`💾 CACHE HIT - ${cacheAge} dakika önce analiz edilmişti`);
                      console.log(`⏱️ Zaman tasarrufu: ~30-60 saniye`);
                    } else {
                      setAnalysisStage(`✅ Analiz tamamlandı! (${totalTime}s)`);
                      console.log(`✅ Analiz tamamlandı - Toplam süre: ${totalTime}s`);
                      console.log(`💾 Bu analiz cache'e kaydedildi`);
                    }
                  } else if (data.type === 'error') {
                    // Hata oluştu
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.warn("JSON parse hatası:", parseError);
                }
              }
            }
          }

          if (!result) {
            throw new Error("Analiz sonucu alınamadı");
          }

        } catch (error) {
          console.error("❌ Streaming hatası:", error);
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 800));

        // Zustand store'a kaydet
        setCurrentAnalysis(result);

        setCurrentStep("results");
        console.log("=== ANALİZ TAMAMLANDI ===");
      } else {
        // Eski endpoint (fallback)
        if (uploadedFilesRef.current.length === 0) {
          throw new Error("Dosya bulunamadı");
        }

        const formData = new FormData();
        formData.append("file", uploadedFilesRef.current[0]);

        const response = await fetch("/api/ai/analyze-document", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "API hatası");
        }

        const result = await response.json();

        setAnalysisProgress(100);
        setAnalysisStage("Analiz tamamlandı!");
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAnalysisResult(result);
        setCurrentStep("results");
      }
    } catch (error) {
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

      alert(userMessage);
      setCurrentStep("view");
    } finally {
      setIsProcessing(false);
      setAnalysisProgress(0);
      setAnalysisStage("");
    }
  };

  const resetProcess = () => {
    setCurrentStep("upload");
    uploadedFilesRef.current = []; // useRef - direkt assign
    clearFileStatuses();
    setDocumentPages([]);
    setAnalysisResult(null);
    setCurrentAnalysis(null); // Zustand store'daki analiz sonucunu temizle
    setIsProcessing(false);
    setAutoDeepAnalysisTriggered(false); // Otomatik derin analiz sıfırla

    // ⚠️ KRİTİK: localStorage'daki document text'i de temizle
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ihale_document_text');
      console.log('🧹 localStorage temizlendi - yeni analiz için hazır');
    }
  };

  return (
    <div className="min-h-screen bg-platinum-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header - Sadece results dışında göster */}
        {currentStep !== "results" && (
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-surface-primary">
              İhale Şartname Analizi
            </h1>
            <p className="text-surface-secondary">
              PDF/DOCX şartname yükleyin, AI ile analiz edin
            </p>

            {/* AI Status */}
            <div className="flex items-center justify-center space-x-2 mt-4">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-surface-secondary text-sm">
                Claude AI Aktif
              </span>
            </div>
          </div>
        )}

        {/* Progress Steps - Sadece results dışında göster */}
        {currentStep !== "results" && (
          <div className="flex items-center justify-center space-x-4 md:space-x-8">
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
        )}

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {currentStep === "upload" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              {/* Eğer analiz tamamlanmışsa sadece özet göster */}
              {currentAnalysis ? (
                <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-2xl p-8 border border-green-500/30">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                      <div>
                        <h3 className="text-xl font-bold text-surface-primary">
                          Analiz Tamamlandı!
                        </h3>
                        <p className="text-surface-secondary text-sm">
                          İhale analizi başarıyla tamamlandı
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hızlı Özet - Modern Animated Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Kurum", value: currentAnalysis.extracted_data.kurum || "Belirtilmemiş", icon: FileText },
                      { label: "İhale Türü", value: currentAnalysis.extracted_data.ihale_turu || "Belirtilmemiş", icon: Brain },
                      { label: "Tahmini Bütçe", value: currentAnalysis.extracted_data.tahmini_butce ? `${currentAnalysis.extracted_data.tahmini_butce.toLocaleString()} TL` : "Belirtilmemiş", icon: TrendingUp }
                    ].map((stat, idx) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="relative group p-6 rounded-xl bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700 hover:border-accent-500/50 overflow-hidden"
                      >
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-accent-500/0 to-purple-500/0 group-hover:from-accent-500/10 group-hover:to-purple-500/10 transition-all duration-500" />

                        {/* Icon */}
                        <div className="relative mb-3 flex items-center justify-between">
                          <stat.icon className="w-6 h-6 text-accent-400" />
                        </div>

                        {/* Label */}
                        <div className="relative text-xs text-gray-400 uppercase tracking-wider mb-2">{stat.label}</div>

                        {/* Value */}
                        <div className="relative text-lg font-bold text-white truncate">
                          {stat.value}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setCurrentStep("results")}
                      className="flex-1 flex items-center justify-center px-6 py-4 bg-accent-500 text-white rounded-xl hover:bg-accent-600 transition-colors font-semibold"
                    >
                      <Eye className="w-5 h-5 mr-2" />
                      Detaylı Sonuçları Gör
                    </button>
                    <button
                      onClick={resetProcess}
                      className="flex items-center justify-center px-6 py-4 bg-platinum-700 text-surface-primary rounded-xl hover:bg-platinum-600 transition-colors font-semibold"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Yeni Analiz Başlat
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* İhale Takipten Seç Butonu */}
                  <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl p-6 border border-indigo-500/30 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-surface-primary mb-2">
                          🎯 İhale Takip Sisteminden Seç
                        </h3>
                        <p className="text-surface-secondary text-sm">
                          Takip ettiğiniz ihalelerden birini seçin, dokümanlar otomatik yüklensin
                        </p>
                      </div>
                      <button
                        onClick={fetchTenders}
                        disabled={loadingTenders}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingTenders ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Yükleniyor...
                          </>
                        ) : (
                          <>
                            <FileText className="w-5 h-5" />
                            İhale Seç
                          </>
                        )}
                      </button>
                    </div>
                  </div>

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
                          detectedTypeConfidence: quickConfidence
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
                      const fileObject = fileObjectsMapRef.current.get(fileName);
                      if (fileObject) {
                        await processSingleFile(fileObject);
                      } else {
                        console.error(`File object not found: ${fileName}`);
                      }
                    }}
                    onCSVSelect={async (files) => {
                      // CSV dosyalarını pending olarak ekle
                      for (const file of files) {
                        if (!file.name.toLowerCase().endsWith('.csv')) {
                          alert(`❌ ${file.name} CSV dosyası değil!`);
                          continue;
                        }

                        // Duplicate check
                        if (csvFiles.some(csv => csv.fileMetadata.name === file.name)) {
                          alert(`⚠️ ${file.name} zaten listede!`);
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
                        alert(`❌ ${fileName} işlenirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
                      }
                    }}
                    onCSVRemove={(fileName) => {
                      removeCSVFile(fileName);
                    }}
                  />

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
                </>
              )}
            </motion.div>
          )}

          {currentStep === "processing" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="max-w-md mx-auto">
                <Loader2 className="w-16 h-16 text-accent-400 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-surface-primary mb-2">
                  Dosya İşleniyor...
                </h3>
                <p className="text-surface-secondary">
                  {uploadedFilesRef.current.length > 0
                    ? `${uploadedFilesRef.current.length} dosya metne dönüştürülüyor`
                    : "Dosyalar işleniyor..."}
                </p>
              </div>
            </motion.div>
          )}

          {currentStep === "view" &&
            documentPages.length > 0 &&
            documentStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-surface-primary">
                    Döküman İçeriği
                  </h3>
                  <div className="flex space-x-3">
                    <label className="flex items-center space-x-2 text-sm text-surface-secondary">
                      <input
                        type="checkbox"
                        checked={useOCR}
                        onChange={(e) => setUseOCR(e.target.checked)}
                        className="rounded border-platinum-600 bg-platinum-800 text-accent-400 focus:ring-accent-400 focus:ring-offset-0"
                      />
                      <span>OCR Kullan (Boş sayfalar için)</span>
                    </label>
                    <button
                      onClick={resetProcess}
                      className="flex items-center px-4 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Sıfırla
                    </button>
                  </div>
                </div>

                <DocumentPreview
                  pages={documentPages}
                  stats={documentStats}
                  warnings={warnings}
                  onAnalyze={handleAnalyze}
                  isAnalyzing={isProcessing}
                  detectedDocTypes={Array.from(new Set(
                    fileStatuses
                      .filter(f => f.status === 'completed' && f.detectedType && f.detectedType !== 'belirsiz')
                      .map(f => f.detectedType!)
                  ))}
                  aiProvider="Gemini + Claude"
                  totalFilesCount={fileStatuses.filter(f => f.status === 'completed').length + csvFiles.filter(c => c.status === 'completed').length}
                  csvFilesCount={csvFiles.filter(c => c.status === 'completed').length}
                  onAddFiles={() => {
                    // Navigate back to upload step to add more files
                    setCurrentStep("upload");
                  }}
                />

                {/* CSV Bilgi Mesajı - Artık ana analizde gösteriliyor */}
                {csvFiles.length > 0 && csvFiles.some(csv => csv.status === 'completed') && (
                  <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-emerald-400 text-lg">📊</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-emerald-400 mb-1">
                          Maliyet Verileri Hazır
                        </h4>
                        <p className="text-xs text-gray-300">
                          {csvFiles.filter(c => c.status === 'completed').length} CSV dosyası analiz edildi.
                          Maliyet verileri "Analiz Et" butonuna bastığınızda ana analiz sonuçlarına entegre edilecek.
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          {csvFiles
                            .filter(csv => csv.status === 'completed' && csv.analysis)
                            .map((csv, index) => (
                              <span key={index} className="px-2 py-1 bg-emerald-500/10 rounded">
                                {csv.fileMetadata.name}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          {currentStep === "analyze" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <Brain className="w-16 h-16 text-accent-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-surface-primary mb-2">
                  AI Analizi Yapılıyor...
                </h3>
                <p className="text-surface-secondary mb-6">
                  {analysisStage ||
                    "Şartname içeriği analiz ediliyor ve öneriler hazırlanıyor"}
                </p>
              </div>

              {/* Progress Bar - Gradient Animated */}
              <div className="relative w-full bg-gray-800 rounded-full h-3 mb-6 overflow-hidden">
                {/* Gradient progress */}
                <motion.div
                  className="h-full bg-gradient-to-r from-accent-500 via-purple-500 to-accent-500 bg-[length:200%_100%]"
                  style={{ width: `${Math.max(0, Math.min(100, analysisProgress))}%` }}
                  animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />

                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </div>

              {/* Progress Percentage */}
              <div className="text-center mb-6">
                <span className="text-2xl font-bold text-accent-400">
                  {analysisProgress}%
                </span>
              </div>

              {/* Analysis Steps */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Metin Okuma", progress: analysisProgress >= 10 },
                  {
                    label: "Anahtar Kelimeler",
                    progress: analysisProgress >= 25,
                  },
                  { label: "Risk Analizi", progress: analysisProgress >= 40 },
                  { label: "Maliyet Hesabı", progress: analysisProgress >= 60 },
                  { label: "Öneriler", progress: analysisProgress >= 80 },
                  { label: "Raporlama", progress: analysisProgress >= 95 },
                ].map((step, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-xl border transition-all duration-500 ${
                      step.progress
                        ? "bg-accent-500/20 border-accent-500/30 text-accent-300"
                        : "bg-platinum-800/40 border-platinum-700/40 text-platinum-400"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {step.progress ? (
                        <CheckCircle className="w-4 h-4 text-accent-400" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === "results" && (
            <>
              {/* Yeni AI sonuçları - Zustand store'dan */}
              {currentAnalysis && (
                <EnhancedAnalysisResults
                  analysis={currentAnalysis}
                  onReturnToView={() => setCurrentStep("view")}
                  onNewAnalysis={resetProcess}
                  onAddDocument={() => setCurrentStep("upload")}
                  onFilesAdded={async (newFiles) => {
                    console.log('📎 Parent: Yeni dosyalar alındı:', newFiles.length, 'adet');

                    // Dosyaları filtrele ve kontrol et
                    const validFiles: File[] = [];
                    const maxSize = 50 * 1024 * 1024; // 50MB

                    for (const file of newFiles) {
                      // Dosya tipi kontrolü
                      const isValidType =
                        file.type.includes("pdf") ||
                        file.type.includes("word") ||
                        file.type.includes("image") ||
                        file.name.toLowerCase().endsWith(".pdf") ||
                        file.name.toLowerCase().endsWith(".docx") ||
                        file.name.toLowerCase().endsWith(".doc") ||
                        file.name.toLowerCase().endsWith(".png") ||
                        file.name.toLowerCase().endsWith(".jpg") ||
                        file.name.toLowerCase().endsWith(".jpeg");

                      if (!isValidType) {
                        alert(`❌ ${file.name} desteklenmeyen format!\n\n✅ Kabul edilen: PDF, Word, PNG, JPG`);
                        continue;
                      }

                      if (file.size > maxSize) {
                        alert(`❌ ${file.name} çok büyük! (Max: 50MB)`);
                        continue;
                      }

                      // Aynı dosya zaten ekli mi?
                      if (fileStatuses.some(fs => fs.fileMetadata.name === file.name)) {
                        alert(`⚠️ ${file.name} zaten listede!`);
                        continue;
                      }

                      validFiles.push(file);
                    }

                    if (validFiles.length > 0) {
                      console.log(`✅ ${validFiles.length} geçerli dosya ekleniyor...`);

                      // Dosyaları pending olarak ekle (store'a metadata, Map'e File objesi)
                      validFiles.forEach(file => {
                        // File objesini Map'e ekle (useRef - state değil!)
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
                          progress: 'Sırada bekliyor...'
                        });
                      });

                      // Upload sayfasına yönlendir
                      console.log('🔄 Upload sayfasına yönlendiriliyor...');
                      setCurrentStep("upload");

                      console.log(`✅ ${validFiles.length} dosya pending olarak eklendi (işlem başlatılmadı)`);
                      // NOT: Dosyalar PENDING durumunda - kullanıcı "Dosyaları İşle" butonuna basınca işlenecek
                    } else {
                      console.warn('⚠️ Geçerli dosya bulunamadı');
                    }
                  }}
                  autoStartDeepAnalysis={false}
                />
              )}

              {/* Eski AI sonuçları (fallback - local state) */}
              {analysisResult && !currentAnalysis && (
                <AnalysisResults
                  analysis={analysisResult}
                  onReturnToView={() => setCurrentStep("view")}
                  onNewAnalysis={resetProcess}
                />
              )}
            </>
          )}
        </AnimatePresence>

        {/* İhale Seçim Modal'ı */}
        {showTenderSelection && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            onClick={() => setShowTenderSelection(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-200/50 dark:border-indigo-500/30 shadow-2xl shadow-black/20"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 space-y-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">İhale Seç</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      {tenders.filter(tender => {
                        if (!tenderSearchQuery) return true;
                        const query = tenderSearchQuery.toLowerCase();
                        const title = tender.title?.toLowerCase() || '';
                        const org = tender.organization?.toLowerCase() || '';
                        const city = tender.organization_city?.toLowerCase() || '';
                        const sourceId = tender.source_id?.toLowerCase() || '';
                        const rawJson = tender.raw_json ? JSON.stringify(tender.raw_json).toLowerCase() : '';
                        return title.includes(query) || org.includes(query) || city.includes(query) || sourceId.includes(query) || rawJson.includes(query);
                      }).length} ihale bulundu
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTenderSelection(false)}
                    className="p-2 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    <span className="text-gray-500 dark:text-gray-400 text-2xl">×</span>
                  </button>
                </div>

                {/* 🆕 Arama Barı */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="İhale ara (Kayıt No, Kurum Adı, Şehir...)..."
                    value={tenderSearchQuery}
                    onChange={(e) => setTenderSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-11 bg-white/80 dark:bg-gray-800/80 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all shadow-sm"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    🔍
                  </div>
                  {tenderSearchQuery && (
                    <button
                      onClick={() => setTenderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xl"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* İhale Listesi */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] bg-gray-50/50 dark:bg-gray-950/30">
                {tenders.filter(tender => {
                  if (!tenderSearchQuery) return true;
                  const query = tenderSearchQuery.toLowerCase();
                  const title = tender.title?.toLowerCase() || '';
                  const org = tender.organization?.toLowerCase() || '';
                  const city = tender.organization_city?.toLowerCase() || '';
                  const sourceId = tender.source_id?.toLowerCase() || '';
                  const rawJson = tender.raw_json ? JSON.stringify(tender.raw_json).toLowerCase() : '';
                  return title.includes(query) || org.includes(query) || city.includes(query) || sourceId.includes(query) || rawJson.includes(query);
                }).length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Henüz ihale bulunamadı</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {tenders.filter(tender => {
                      if (!tenderSearchQuery) return true;
                      const query = tenderSearchQuery.toLowerCase();
                      const title = tender.title?.toLowerCase() || '';
                      const org = tender.organization?.toLowerCase() || '';
                      const city = tender.organization_city?.toLowerCase() || '';
                      const sourceId = tender.source_id?.toLowerCase() || '';
                      const rawJson = tender.raw_json ? JSON.stringify(tender.raw_json).toLowerCase() : '';
                      return title.includes(query) || org.includes(query) || city.includes(query) || sourceId.includes(query) || rawJson.includes(query);
                    }).map((tender) => {
                      // İhale başlığı düzeltme - "Belirtilmemiş" ise organization'dan çek
                      const displayTitle = tender.title && tender.title !== 'Belirtilmemiş'
                        ? tender.title
                        : tender.organization?.split(' ').slice(0, 10).join(' ') || 'İhale Başlığı Yok';

                      // Kurum adı kısalt (ilk 40 karakter)
                      const displayOrg = tender.organization?.length > 40
                        ? tender.organization.slice(0, 40) + '...'
                        : tender.organization || 'Belirtilmemiş';

                      // Şehir adı parse et (karışık data'dan temiz şehir adı çıkar)
                      const parseCity = (cityData: string) => {
                        if (!cityData) return 'Belirtilmemiş';

                        // Türkiye şehir isimleri listesi (ilk kelime genelde şehir)
                        const cityMatch = cityData.match(/^([A-ZĞÜŞİÖÇ][a-zğüşıöç]+)/);
                        if (cityMatch) return cityMatch[1];

                        // Fallback: İlk kelimeyi al
                        const firstWord = cityData.split(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/)[0];
                        return firstWord || 'Belirtilmemiş';
                      };

                      const displayCity = parseCity(tender.organization_city);

                      return (
                        <div
                          key={tender.id}
                          className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30 hover:border-indigo-400/50 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer group"
                          onClick={() => handleTenderSelect(tender)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2.5 line-clamp-2 leading-snug">
                                {displayTitle}
                              </h3>

                              {/* Detaylar: Kurum, Şehir, Kaynak, Kayıt No */}
                              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60 flex-shrink-0">📍</span>
                                  <span className="line-clamp-1">{tender.organization || 'Belirtilmemiş'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60 flex-shrink-0">🏙️</span>
                                  <span>{displayCity}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="opacity-60 flex-shrink-0">🔗</span>
                                  <span className="uppercase font-medium text-indigo-600 dark:text-indigo-400">{tender.source || 'N/A'}</span>
                                </div>
                                {/* 🆕 Kayıt No */}
                                {tender.raw_json?.['Kayıt no'] && (
                                  <div className="flex items-center gap-2">
                                    <span className="opacity-60 flex-shrink-0">🔢</span>
                                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{tender.raw_json['Kayıt no']}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Loading indicator for selected tender */}
                            {fetchingTenderContent && selectedTender?.id === tender.id && (
                              <div className="flex-shrink-0">
                                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
