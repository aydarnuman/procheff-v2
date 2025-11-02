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
import { DocumentUploadWizard } from "@/components/ihale/DocumentUploadWizard";
import { AIAnalysisResult } from "@/types/ai";
import { useIhaleStore, FileProcessingStatus } from "@/lib/stores/ihale-store";
import { CSVParser } from "@/lib/csv/csv-parser";
import { BelgeTuru } from "@/types/ai";

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
          progress: 'İşlenmeyi bekliyor...'
        });
      });

      console.log(`✅ ${newFiles.length} dosya pending olarak eklendi (işlem başlatılmadı)`);
      // NOT: Dosyalar PENDING durumunda - kullanıcı "Dosyaları İşle" butonuna basınca işlenecek
    }

    // Input'u temizle
    event.target.value = '';
  };

  // Tek dosya işle - İYİLEŞTİRME: Zustand store kullan
  const processSingleFile = async (file: File) => {
    console.log(`İşleniyor: ${file.name}`);

    // Durumu processing'e çek
    updateFileStatus(file.name, {
      status: 'processing',
      progress: 'İşleniyor...'
    });

    try {
      const formData = new FormData();
      formData.append("file0", file);
      formData.append("fileCount", "1");
      formData.append("useOCR", useOCR.toString());

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Başarılı - completed işaretle
        updateFileStatus(file.name, {
          status: 'completed',
          progress: `✅ Tamamlandı (${result.stats?.wordCount || 0} kelime)`,
          wordCount: result.stats?.wordCount || 0,
          extractedText: result.text || ''
        });

        console.log(`✅ ${file.name} tamamlandı`);

        // YENİ: Belge türü tespiti yap (background - hata verse bile devam et)
        try {
          console.log(`🔍 Belge türü tespit ediliyor: ${file.name}`);
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
                detectedTypeConfidence: aiConfidence
              });

              console.log(`✅ AI Tespit: ${aiDetectedType} (${Math.round(aiConfidence * 100)}%)`);

              // DOĞRULAMA: Kullanıcı seçimi ile AI tespiti uyuşuyor mu?
              if (userSelectedType && userSelectedType !== aiDetectedType && aiConfidence > 0.7) {
                console.warn(`⚠️ UYARI: Kullanıcı "${userSelectedType}" seçti ama AI "${aiDetectedType}" tespit etti!`);
                console.warn(`   Sebep: ${aiReason}`);

                // Kullanıcıya bildiri (opsiyonel - şimdilik sadece console)
                // TODO: UI'da toast notification göster
              } else if (userSelectedType === aiDetectedType) {
                console.log(`✅ Doğrulama: Kullanıcı seçimi ile AI tespiti uyuşuyor!`);
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
        totalPages: 1,
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

        try {
          // EventSource ile gerçek zamanlı progress takibi
          const response = await fetch("/api/ai/full-analysis?stream=true", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: fullText }),
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
                  {/* YENİ: Tek Kart Wizard - Modern Dark UI */}
                  <DocumentUploadWizard
                    fileStatuses={fileStatuses}
                    onFileSelect={(file, documentType) => {
                      console.log(`📄 Dosya seçildi: ${file.name} (${documentType})`);

                      // Dosya zaten var mı kontrol et
                      if (fileStatuses.some(fs => fs.fileMetadata.name === file.name)) {
                        alert(`⚠️ ${file.name} zaten listede!`);
                        return;
                      }

                      // File objesini Map'e ekle (useRef - state değil!)
                      fileObjectsMapRef.current.set(file.name, file);

                      // Store'a ekle (pending olarak) - KULLANICI SEÇTİĞİ TÜRÜ SET ET
                      addFileStatus({
                        fileMetadata: {
                          name: file.name,
                          size: file.size,
                          type: file.type,
                          lastModified: file.lastModified,
                        },
                        status: 'pending',
                        progress: 'İşlenmeyi bekliyor...',
                        detectedType: documentType, // ✅ Kullanıcının seçtiği türü hemen ekle
                        detectedTypeConfidence: 1.0 // Kullanıcı seçimi %100 güvenilir
                      });

                      console.log(`✅ ${file.name} listeye eklendi (pending)`);
                    }}
                    onFileRemove={(fileName) => {
                      removeFileStatus(fileName);
                      // File objesini Map'ten de kaldır (useRef - state değil!)
                      fileObjectsMapRef.current.delete(fileName);
                    }}
                    onSkip={(documentType) => {
                      console.log(`⏭️ Belge türü atlandı: ${documentType}`);
                      // Şimdilik sadece log, ileride skip tracking eklenebilir
                    }}
                  />

                  {/* Dosya İşleme Butonları */}
                  {(fileStatuses.length > 0 || csvFiles.length > 0) && (
                    <div className="mt-6 flex gap-3">
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

                      {/* Pending dosyaları işle */}
                      {fileStatuses.some(fs => fs.status === 'pending') && (
                        <button
                          type="button"
                          onClick={async () => {
                            console.log('▶️ Dosyaları İşle button CLICKED!');
                            const pendingFiles = fileStatuses.filter(fs => fs.status === 'pending');
                            console.log(`🚀 ${pendingFiles.length} pending dosya işlenecek...`);
                            console.log('📋 Pending dosyalar:', pendingFiles.map(f => f.fileMetadata.name));

                            for (let i = 0; i < pendingFiles.length; i++) {
                              const fileStatus = pendingFiles[i];
                              console.log(`\n📄 [${i+1}/${pendingFiles.length}] İşleniyor: ${fileStatus.fileMetadata.name}`);

                              try {
                                // File objesini Map'ten al (useRef - state değil!)
                                const fileObject = fileObjectsMapRef.current.get(fileStatus.fileMetadata.name);
                                if (!fileObject) {
                                  throw new Error(`File object not found in map: ${fileStatus.fileMetadata.name}`);
                                }
                                await processSingleFile(fileObject);
                                console.log(`✅ [${i+1}/${pendingFiles.length}] Tamamlandı: ${fileStatus.fileMetadata.name}`);
                              } catch (error) {
                                console.error(`❌ [${i+1}/${pendingFiles.length}] Hata: ${fileStatus.fileMetadata.name}`, error);
                              }
                            }

                            console.log(`\n🎉 Tüm ${pendingFiles.length} dosya işlendi!`);
                          }}
                          disabled={fileStatuses.some(fs => fs.status === 'processing')}
                          className="flex-1 px-6 py-3.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25"
                        >
                          <Upload className="w-5 h-5" />
                          <span>Dosyaları İşle ({fileStatuses.filter(fs => fs.status === 'pending').length})</span>
                        </button>
                      )}

                      {/* Completed dosyaları analiz et */}
                      {fileStatuses.some(fs => fs.status === 'completed') && (
                        <button
                          type="button"
                          onClick={handleProcessAllFiles}
                          disabled={fileStatuses.some(fs => fs.status === 'processing')}
                          className="flex-1 px-6 py-3.5 bg-green-600/90 hover:bg-green-600 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/25"
                        >
                          <Brain className="w-5 h-5" />
                          <span>Analiz Et ({fileStatuses.filter(fs => fs.status === 'completed').length})</span>
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
                />

                {/* CSV Analiz Sonuçları */}
                {csvFiles.length > 0 && csvFiles.some(csv => csv.status === 'completed') && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      📊 Maliyet Analizi
                    </h3>
                    {csvFiles
                      .filter(csv => csv.status === 'completed' && csv.analysis)
                      .map((csv, index) => (
                        <CSVCostAnalysis
                          key={index}
                          analysis={csv.analysis!}
                          fileName={csv.fileMetadata.name}
                        />
                      ))}
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
      </div>
    </div>
  );
}
