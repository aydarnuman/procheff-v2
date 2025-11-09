'use client';

// ============================================================================
// TENDER WORKSPACE - Proper File Processing Integration
// Uses SimpleDocumentList component for file processing workflow
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, FileText, Download, ArrowLeft, Terminal, Bug } from 'lucide-react';
import { SimpleDocumentList } from '@/components/ihale/SimpleDocumentList';
import { useIhaleStore, FileMetadata } from '@/lib/stores/ihale-store';
import { toast } from 'sonner';
import { AILogger } from '@/lib/utils/ai-logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SupportedMimeType = 
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/plain'
  | 'text/csv'
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/tiff'
  | 'application/zip';

enum FileProcessStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

enum SessionStatus {
  CREATED = 'created',
  UPLOADING = 'uploading',
  UPLOADED = 'uploaded',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

interface TenderFile {
  id: string;
  filename: string;
  mimeType: SupportedMimeType;
  size: number;
  isExtractedFromZip?: boolean;
  uploadedAt?: Date;
  processedAt?: Date;
}

interface TenderSession {
  id: string;
  status: SessionStatus;
  files: TenderFile[];
  result?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnalysisProgress {
  sessionId: string;
  stage: string;
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  message: string;
  error?: string;
}

export default function TenderWorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Yükleniyor...</p>
        </div>
      </div>
    }>
      <TenderWorkspacePageInner />
    </Suspense>
  );
}

function TenderWorkspacePageInner() {
  // Simple mode: Sadece processing (session tracking kaldırıldı)
  return <ProcessingMode />;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Debug Mode (development'ta true, production'da false)
const IS_DEBUG = process.env.NODE_ENV === 'development';

// Enhanced Logging Helper
const workspaceLogger = {
  info: (stage: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, stage, message, ...data };
    
    if (IS_DEBUG) {
      console.log(`🔵 [WORKSPACE/${stage}]`, message, data || '');
    }
    
    // AILogger için terminal output
    AILogger.info(`[WORKSPACE] ${stage}: ${message}`);
    return logData;
  },
  
  success: (stage: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, stage, message, ...data };
    
    if (IS_DEBUG) {
      console.log(`✅ [WORKSPACE/${stage}]`, message, data || '');
    }
    
    AILogger.success(`[WORKSPACE] ${stage}: ${message}`);
    return logData;
  },
  
  error: (stage: string, message: string, error?: any, data?: any) => {
    const timestamp = new Date().toISOString();
    const errorDetails = {
      timestamp,
      stage,
      message,
      errorType: error?.name || 'UnknownError',
      errorMessage: error?.message || String(error),
      stack: IS_DEBUG ? error?.stack : undefined,
      ...data
    };
    
    console.error(`❌ [WORKSPACE/${stage}]`, message, errorDetails);
    AILogger.error(`[WORKSPACE] ${stage}: ${message} - ${error?.message || error}`);
    
    return errorDetails;
  },
  
  warning: (stage: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, stage, message, ...data };
    
    if (IS_DEBUG) {
      console.warn(`⚠️ [WORKSPACE/${stage}]`, message, data || '');
    }
    
    AILogger.warning(`[WORKSPACE] ${stage}: ${message}`);
    return logData;
  },
  
  debug: (stage: string, message: string, data?: any) => {
    if (IS_DEBUG) {
      const timestamp = new Date().toISOString();
      console.debug(`🐛 [WORKSPACE/${stage}]`, message, data || '');
    }
  }
};

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES: SupportedMimeType[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'application/zip'
];

// File validation
const validateFile = (file: File): { valid: boolean; error?: string } => {
  workspaceLogger.debug('VALIDATION', 'Validating file', {
    name: file.name,
    size: file.size,
    type: file.type
  });

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    const error = `Dosya çok büyük. Maksimum ${MAX_FILE_SIZE / 1024 / 1024}MB (${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    workspaceLogger.error('VALIDATION', 'File too large', null, {
      fileName: file.name,
      fileSize: file.size,
      maxSize: MAX_FILE_SIZE
    });
    return { valid: false, error };
  }

  // Empty file check
  if (file.size === 0) {
    workspaceLogger.error('VALIDATION', 'Empty file', null, { fileName: file.name });
    return { valid: false, error: 'Dosya boş' };
  }

  // MIME type check
  if (!ALLOWED_MIME_TYPES.includes(file.type as SupportedMimeType)) {
    const error = `Desteklenmeyen dosya formatı: ${file.type}. İzin verilenler: PDF, Word, Excel, Text, Image, ZIP`;
    workspaceLogger.error('VALIDATION', 'Unsupported MIME type', null, {
      fileName: file.name,
      mimeType: file.type,
      allowedTypes: ALLOWED_MIME_TYPES
    });
    return { valid: false, error };
  }

  // Filename security check (prevent path traversal)
  if (/[\/\\]/.test(file.name)) {
    workspaceLogger.error('VALIDATION', 'Path traversal attempt', null, { fileName: file.name });
    return { valid: false, error: 'Dosya adı geçersiz karakter içeriyor (/ veya \\)' };
  }

  // Check for dangerous characters
  if (!/^[\w\s\-_.()ğüşıöçĞÜŞİÖÇ]+\.[a-zA-Z0-9]+$/i.test(file.name)) {
    workspaceLogger.error('VALIDATION', 'Invalid filename characters', null, { fileName: file.name });
    return { 
      valid: false, 
      error: 'Dosya adı yalnızca harf, rakam, boşluk ve .-_() karakterlerini içerebilir' 
    };
  }

  workspaceLogger.success('VALIDATION', 'File validated', { fileName: file.name });
  return { valid: true };
};

// Türkçe karakterleri destekleyen kelime sayma
const countWords = (text: string): number => {
  if (!text || text.trim().length === 0) return 0;
  const words = text.match(/[\wğüşıöçĞÜŞİÖÇ]+/gu);
  return words ? words.length : 0;
};

// Token tahmini (Türkçe için ~1.3 token/kelime)
const estimateTokens = (text: string): number => {
  const wordCount = countWords(text);
  return Math.ceil(wordCount * 1.3);
};

// Token limits (Claude Sonnet 4)
const MAX_TOKENS = 180000; // 200K limiti, güvenlik için 180K
const CHUNK_SIZE_TOKENS = 50000; // Her chunk max 50K token

// OCR detection
const shouldUseOCR = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  const fileType = file.type;
  
  // Image dosyaları kesinlikle OCR
  if (fileType.startsWith('image/') || 
      fileName.match(/\.(png|jpg|jpeg|tiff|bmp|webp)$/)) {
    return true;
  }
  
  // PDF'ler için OCR (scanned vs native ayrımı yapılabilir gelecekte)
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return true;
  }
  
  return false;
};

// ============================================================================
// MODE 1: PROCESSING MODE (dosya işleme)
// ============================================================================
function ProcessingMode() {
  const router = useRouter();
  const { fileStatuses, addFileStatus, updateFileStatus, removeFileStatus, clearFileStatuses } = useIhaleStore();
  const [processing, setProcessing] = useState(false);
  const [fileObjects, setFileObjects] = useState<Map<string, File>>(new Map());

  // ⚠️ MEMORY LEAK PREVENTİON: Component unmount olunca temizle
  useEffect(() => {
    return () => {
      // File objelerini temizle
      setFileObjects(new Map());
      // Store'daki file status'ları da temizle
      clearFileStatuses();
    };
  }, [clearFileStatuses]);

  // Dosya seçme
  const handleFileSelect = async (files: File[]) => {
    workspaceLogger.info('FILE_SELECT', `Dosya seçildi (${files.length})`, {
      fileCount: files.length,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });

    let validCount = 0;
    let invalidCount = 0;
    const validationErrors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      // ✅ FILE VALIDATION
      const validation = validateFile(file);
      
      if (!validation.valid) {
        // Geçersiz dosya - kullanıcıyı uyar
        toast.error(`${file.name}: ${validation.error}`, { 
          duration: 5000,
          description: 'Dosya validation başarısız'
        });
        validationErrors.push({ file: file.name, error: validation.error! });
        invalidCount++;
        continue; // Bu dosyayı atla
      }

      // File metadata oluştur
      const metadata: FileMetadata = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };

      // Store'a ekle
      addFileStatus({
        fileMetadata: metadata,
        status: 'pending',
        progress: 'Bekliyor...'
      });

      // File objesini geçici olarak sakla (işlendikten sonra silinecek)
      setFileObjects(prev => new Map(prev).set(file.name, file));
      validCount++;
      
      workspaceLogger.success('FILE_SELECT', `Dosya eklendi: ${file.name}`, {
        size: file.size,
        type: file.type
      });
    }

    // Özet logging
    if (invalidCount > 0) {
      workspaceLogger.warning('FILE_SELECT', `Geçersiz dosyalar`, {
        invalidCount,
        errors: validationErrors
      });
    }

    // Özet toast
    if (validCount > 0) {
      const message = `${validCount} dosya eklendi${invalidCount > 0 ? ` (${invalidCount} geçersiz atlandı)` : ''}`;
      toast.success(message, {
        description: `Toplam: ${files.length} dosya`
      });
      workspaceLogger.success('FILE_SELECT', 'Dosya ekleme tamamlandı', {
        valid: validCount,
        invalid: invalidCount,
        total: files.length
      });
    } else if (invalidCount > 0) {
      toast.error(`Tüm dosyalar geçersiz (${invalidCount})`, {
        description: 'Dosya gereksinimlerini kontrol edin'
      });
      workspaceLogger.error('FILE_SELECT', 'Tüm dosyalar geçersiz', null, { invalidCount });
    }
  };

  // Dosya silme
  const handleFileRemove = (fileName: string) => {
    removeFileStatus(fileName);
    setFileObjects(prev => {
      const next = new Map(prev);
      next.delete(fileName);
      return next;
    });
    toast.success(`${fileName} silindi`);
  };

  // Tek dosyayı işle
  const handleFileProcess = async (fileName: string) => {
    workspaceLogger.info('FILE_PROCESS', `İşlem başlatılıyor: ${fileName}`);
    
    const fileStatus = fileStatuses.find(f => f.fileMetadata.name === fileName);
    const fileObject = fileObjects.get(fileName);

    if (!fileStatus || !fileObject) {
      const errorMsg = 'Dosya bulunamadı';
      workspaceLogger.error('FILE_PROCESS', errorMsg, null, { fileName });
      toast.error(errorMsg, { description: fileName });
      return;
    }

    // Status'u processing'e çek
    updateFileStatus(fileName, { status: 'processing', progress: 'Başlatılıyor...' });
    workspaceLogger.info('FILE_PROCESS', `Processing başladı: ${fileName}`, {
      size: fileObject.size,
      type: fileObject.type
    });

    let response: Response | null = null;
    const startTime = Date.now();

    try {
      // FormData oluştur
      const formData = new FormData();
      formData.append('file0', fileObject);
      formData.append('fileCount', '1');
      
      // ✅ SMART OCR DETECTION
      const useOCR = shouldUseOCR(fileObject);
      formData.append('useOCR', useOCR ? 'true' : 'false');
      if (useOCR) {
        formData.append('ocrQuality', 'high');
        formData.append('ocrLanguage', 'tur');
        workspaceLogger.info('FILE_PROCESS', `OCR enabled: ${fileName}`, { useOCR, quality: 'high' });
      }

      // SSE ile stream al
      workspaceLogger.info('FILE_PROCESS', `Upload başlatılıyor: ${fileName}`);
      response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorMsg = `Upload failed with status ${response.status}`;
        workspaceLogger.error('FILE_PROCESS', errorMsg, null, { 
          fileName, 
          status: response.status,
          statusText: response.statusText 
        });
        throw new Error(errorMsg);
      }

      workspaceLogger.success('FILE_PROCESS', `Upload başarılı, stream okunuyor: ${fileName}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      // ✅ SSE BUFFER FIX: Partial message'ları handle etmek için buffer kullan
      let buffer = '';

      if (reader) {
        workspaceLogger.info('FILE_PROCESS', `SSE stream başladı: ${fileName}`);
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            workspaceLogger.info('FILE_PROCESS', `SSE stream tamamlandı: ${fileName}`, { 
              totalChunks: chunkCount 
            });
            break;
          }

          chunkCount++;
          // Chunk'ı buffer'a ekle
          buffer += decoder.decode(value, { stream: true });
          
          // Buffer'ı satırlara böl
          const lines = buffer.split('\n\n');
          
          // Son satır incomplete olabilir, buffer'da tut
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  workspaceLogger.debug('FILE_PROCESS', `Progress: ${data.message}`, { fileName });
                  updateFileStatus(fileName, {
                    status: 'processing',
                    progress: data.message
                  });
                } else if (data.type === 'success') {
                  // SSE'den gelen data formatı
                  const extractedText = data.text || '';
                  const wordCount = data.stats?.wordCount ||
                                   data.stats?.totalWordCount ||
                                   extractedText.split(/\s+/).filter((w: string) => w.length > 0).length;

                  const processingTime = Date.now() - startTime;

                  workspaceLogger.success('FILE_PROCESS', `Dosya işlendi: ${fileName}`, {
                    textLength: extractedText.length,
                    wordCount,
                    processingTime: `${(processingTime / 1000).toFixed(2)}s`,
                    stats: data.stats
                  });

                  updateFileStatus(fileName, {
                    status: 'completed',
                    progress: 'Tamamlandı',
                    extractedText,
                    wordCount
                  });
                  
                  toast.success(`${fileName} işlendi`, {
                    description: `${wordCount.toLocaleString('tr-TR')} kelime • ${(processingTime / 1000).toFixed(1)}s`
                  });
                  
                  // ✅ MEMORY OPTIMIZATION
                  setFileObjects(prev => {
                    const next = new Map(prev);
                    next.delete(fileName);
                    return next;
                  });
                  
                  workspaceLogger.debug('FILE_PROCESS', `Memory cleanup: ${fileName}`);
                } else if (data.type === 'error') {
                  const errorMsg = data.error || 'İşleme hatası';
                  workspaceLogger.error('FILE_PROCESS', `SSE Error: ${errorMsg}`, null, { 
                    fileName, 
                    errorData: data 
                  });
                  throw new Error(errorMsg);
                }
              } catch (parseError) {
                workspaceLogger.error('FILE_PROCESS', 'SSE Parse error', parseError, { 
                  fileName, 
                  line: line.substring(0, 100) 
                });
              }
            }
          }
        }
        
        // ✅ Kalan buffer'ı işle (son message)
        if (buffer && buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6));
            
            if (data.type === 'success') {
              const extractedText = data.text || '';
              const wordCount = data.stats?.wordCount ||
                               data.stats?.totalWordCount ||
                               extractedText.split(/\s+/).filter((w: string) => w.length > 0).length;

              updateFileStatus(fileName, {
                status: 'completed',
                progress: 'Tamamlandı',
                extractedText,
                wordCount
              });
              toast.success(`${fileName} işlendi (${wordCount.toLocaleString('tr-TR')} kelime)`);
              
              // Memory cleanup
              setFileObjects(prev => {
                const next = new Map(prev);
                next.delete(fileName);
                return next;
              });
            }
          } catch (parseError) {
            console.error('Final SSE parse error:', parseError);
          }
        }
      }
    } catch (error: any) {
      // ✅ STRUCTURED ERROR HANDLING
      const errorType = error.name || 'UnknownError';
      const errorMessage = error.message || 'Bilinmeyen hata';
      
      // Detailed error logging
      console.error('File processing failed:', {
        fileName,
        errorType,
        errorMessage,
        timestamp: new Date().toISOString(),
        fileSize: fileObject?.size,
        fileType: fileObject?.type
      });
      
      // User-friendly error messages
      let userMessage = '';
      let retryable = true;
      
      if (errorType === 'NetworkError' || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = 'İnternet bağlantınızı kontrol edin';
        retryable = true;
      } else if (errorType === 'TimeoutError' || errorMessage.includes('timeout')) {
        userMessage = 'İşlem zaman aşımına uğradı. Tekrar deneyin';
        retryable = true;
      } else if (errorMessage.includes('size') || errorMessage.includes('large')) {
        userMessage = 'Dosya çok büyük. Maksimum 50MB';
        retryable = false;
      } else if (errorMessage.includes('format') || errorMessage.includes('type')) {
        userMessage = 'Desteklenmeyen dosya formatı';
        retryable = false;
      } else if (response && !response.ok) {
        userMessage = `Sunucu hatası (${response.status}). Tekrar deneyin`;
        retryable = true;
      } else {
        userMessage = 'Dosya işlenemedi. Destek ekibiyle iletişime geçin';
        retryable = false;
      }
      
      updateFileStatus(fileName, {
        status: 'error',
        progress: 'Hata',
        error: userMessage
      });
      
      // Toast with retry option
      if (retryable) {
        toast.error(`${fileName}: ${userMessage}`, {
          action: {
            label: 'Tekrar Dene',
            onClick: () => handleFileProcess(fileName)
          },
          duration: 5000
        });
      } else {
        toast.error(`${fileName}: ${userMessage}`);
      }
      
      // ✅ MEMORY OPTIMIZATION: Hata durumunda da File objesini sil
      setFileObjects(prev => {
        const next = new Map(prev);
        next.delete(fileName);
        return next;
      });
    }
  };

  // Analiz başlat - Token kontrolü ve chunking ile
  const handleStartAnalysis = async () => {
    workspaceLogger.info('ANALYSIS', 'AI analizi başlatma talebi');

    // 1. Validation - Tüm dosyalar işlendi mi
    const completedFiles = fileStatuses.filter(f => f.status === 'completed');
    if (completedFiles.length === 0) {
      workspaceLogger.warning('ANALYSIS', 'İşlenmiş dosya yok');
      toast.error('İşlenmiş dosya bulunamadı!', {
        description: 'Önce dosyaları işleyin'
      });
      return;
    }

    // 2. Race condition kontrolü
    if (processing) {
      workspaceLogger.warning('ANALYSIS', 'Analiz zaten devam ediyor');
      toast.warning('Analiz zaten devam ediyor...', {
        description: 'Lütfen mevcut analizin tamamlanmasını bekleyin'
      });
      return;
    }

    // 3. Token limiti kontrolü
    const totalWordCount = completedFiles.reduce((sum, f) => sum + (f.wordCount || 0), 0);
    const estimatedTokens = Math.ceil(totalWordCount * 1.3);
    
    const tokenInfo = {
      totalFiles: completedFiles.length,
      totalWords: totalWordCount,
      estimatedTokens,
      maxTokens: MAX_TOKENS,
      withinLimit: estimatedTokens <= MAX_TOKENS,
      utilizationPercent: ((estimatedTokens / MAX_TOKENS) * 100).toFixed(1)
    };

    workspaceLogger.info('ANALYSIS', 'Token hesaplaması', tokenInfo);
    AILogger.tokenUsage('claude', estimatedTokens, 0, 0, 0); // Estimated input tokens

    if (estimatedTokens > MAX_TOKENS) {
      workspaceLogger.error('ANALYSIS', 'Token limiti aşıldı', null, tokenInfo);
      toast.error(
        `Text çok uzun!`,
        { 
          duration: 7000,
          description: `${estimatedTokens.toLocaleString('tr-TR')} token (limit: ${MAX_TOKENS.toLocaleString('tr-TR')}). Bazı dosyaları kaldırın.`
        }
      );
      return;
    }

    setProcessing(true);
    const startTime = Date.now();
    const toastId = toast.loading('AI analizi hazırlanıyor...', {
      description: `${completedFiles.length} dosya • ${estimatedTokens.toLocaleString('tr-TR')} token`
    });

    try {
      // 4. Text'leri birleştir
      workspaceLogger.info('ANALYSIS', 'Dosyalar birleştiriliyor', {
        fileCount: completedFiles.length,
        fileNames: completedFiles.map(f => f.fileMetadata.name)
      });

      const combinedText = completedFiles
        .map(f => `\n\n=== DOSYA: ${f.fileMetadata.name} ===\n${f.extractedText || ''}`)
        .join('\n');

      workspaceLogger.success('ANALYSIS', 'Dosyalar birleştirildi', {
        combinedTextLength: combinedText.length,
        estimatedTokens
      });

      toast.loading('AI analizi yapılıyor...', { 
        id: toastId,
        description: 'Claude AI çalışıyor...'
      });

      // Premium AI analysis endpoint
      workspaceLogger.info('ANALYSIS', 'API request başlatılıyor');
      const response = await fetch('/api/ai/full-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: combinedText,
          csvData: null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Analiz başarısız (${response.status})`;
        workspaceLogger.error('ANALYSIS', 'API request failed', null, {
          status: response.status,
          statusText: response.statusText,
          error: errorMsg
        });
        throw new Error(errorMsg);
      }

      const result = await response.json();

      // Validate response
      if (!result.success || !result.data) {
        workspaceLogger.error('ANALYSIS', 'Invalid API response', null, { result });
        throw new Error('Analiz sonucu alınamadı');
      }

      const processingTime = Date.now() - startTime;

      workspaceLogger.success('ANALYSIS', 'AI analizi tamamlandı', {
        processingTime: `${(processingTime / 1000).toFixed(2)}s`,
        hasData: !!result.data,
        metadata: result.metadata
      });

      // Token usage logging if available
      if (result.metadata?.tokenUsage) {
        AILogger.tokenUsage(
          'claude',
          result.metadata.tokenUsage.input || estimatedTokens,
          result.metadata.tokenUsage.output || 0,
          result.metadata.tokenUsage.cost || 0,
          processingTime / 1000
        );
      }

      toast.success('Analiz tamamlandı!', { 
        id: toastId,
        description: `${(processingTime / 1000).toFixed(1)}s • Detaylar açılıyor...`
      });

      // Zustand store'a kaydet
      workspaceLogger.info('ANALYSIS', 'Store\'a kaydediliyor');
      const { setCurrentAnalysis } = useIhaleStore.getState();
      setCurrentAnalysis(result.data);

      // Store güncel analysisHistory'yi al
      const updatedHistory = useIhaleStore.getState().analysisHistory;
      const lastIndex = updatedHistory.length - 1;

      workspaceLogger.success('ANALYSIS', 'Store\'a kaydedildi', {
        historyLength: updatedHistory.length,
        targetIndex: lastIndex
      });

      // Premium detay sayfasına yönlendir
      workspaceLogger.info('ANALYSIS', `Detay sayfasına yönlendiriliyor: /ihale/analysis-${lastIndex}`);
      router.push(`/ihale/analysis-${lastIndex}`);

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      workspaceLogger.error('ANALYSIS', 'AI analizi başarısız', error, {
        processingTime: `${(processingTime / 1000).toFixed(2)}s`,
        errorMessage: error.message,
        errorStack: IS_DEBUG ? error.stack : undefined
      });
      
      // User-friendly error message
      let userMessage = error.message || 'Analiz başarısız oldu';
      let errorDescription = '';
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorDescription = 'İnternet bağlantınızı kontrol edin';
      } else if (error.message?.includes('timeout')) {
        errorDescription = 'İşlem zaman aşımına uğradı';
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorDescription = 'Yetkilendirme hatası';
      } else if (error.message?.includes('429')) {
        errorDescription = 'Rate limit aşıldı. Biraz bekleyin';
      } else if (error.message?.includes('500')) {
        errorDescription = 'Sunucu hatası. Tekrar deneyin';
      } else {
        errorDescription = 'Detaylar terminal loglarında';
      }
      
      toast.error(userMessage, { 
        id: toastId,
        duration: 7000,
        description: errorDescription
      });
    } finally {
      setProcessing(false);
      workspaceLogger.info('ANALYSIS', 'İşlem sonlandırıldı', { processing: false });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/ihale')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              İhale Dashboard'a Dön
            </button>
            
            {/* Debug Mode Indicator (Development only) */}
            {IS_DEBUG && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <Bug className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-300 font-medium">Debug Mode</span>
                <Terminal className="w-3 h-3 text-purple-400 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* SimpleDocumentList Component */}
        <SimpleDocumentList
          fileStatuses={fileStatuses}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          onFileProcess={handleFileProcess}
        />

        {/* Start Analysis Button - Sadece tüm dosyalar işlendiyse */}
        {fileStatuses.length > 0 && fileStatuses.every(f => f.status === 'completed') && (
          <div className="sticky bottom-6 z-10">
            <button
              onClick={handleStartAnalysis}
              disabled={processing}
              className={`
                w-full relative overflow-hidden group
                py-3 px-6 rounded-xl font-semibold text-sm
                transition-all duration-500 ease-out
                ${processing
                  ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 text-white border border-slate-600/50 shadow-xl shadow-slate-900/40 hover:shadow-slate-700/50 transform hover:scale-[1.01] hover:-translate-y-0.5'
                }
              `}
            >
              {/* Premium glow effect */}
              {!processing && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              )}

              {processing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analiz Başlatılıyor...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 relative z-10">
                  <span className="text-lg">✨</span>
                  <span>AI ile Analiz Et</span>
                  <span className="text-lg">✨</span>
                </div>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODE 2: TRACKING MODE (sessionId var)
// ============================================================================
function TrackingMode({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<TenderSession | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch session details
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/tender/session/${sessionId}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Session yüklenemedi');
      }

      setSession(data.session);
      setLoading(false);
    } catch (err: any) {
      console.error('Session fetch error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [sessionId]);

  // SSE progress tracking
  useEffect(() => {
    if (!sessionId || !session) return;

    // Only start SSE if session is analyzing
    if (session.status !== 'analyzing' && session.status !== 'uploaded') {
      return;
    }

    console.log('📡 Starting SSE progress tracking for session:', sessionId);

    const eventSource = new EventSource(`/api/tender/session/${sessionId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const progressData: AnalysisProgress = JSON.parse(event.data);
        console.log('📊 Progress update:', progressData);
        setProgress(progressData);

        // Update session status if completed or error
        if (progressData.stage === 'completed' || progressData.stage === 'error') {
          fetchSession(); // Refresh session to get final result
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, session, fetchSession]);

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Workspace yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Hata</p>
          <p className="text-gray-600 mb-4">{error || 'Session bulunamadı'}</p>
          <button
            onClick={() => router.push('/ihale')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            İhale Dashboard'a Dön
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = session.status === 'completed';
  const isError = session.status === 'error';
  const isAnalyzing = session.status === 'analyzing' || session.status === 'uploaded';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/ihale')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            İhale Dashboard'a Dön
          </button>
          <h1 className="text-3xl font-bold text-gray-900">İhale Analiz Workspace</h1>
          <p className="text-gray-600 mt-1">Session ID: {session.id}</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {isCompleted && <CheckCircle className="w-8 h-8 text-green-600" />}
            {isError && <XCircle className="w-8 h-8 text-red-600" />}
            {isAnalyzing && <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isCompleted && 'Analiz Tamamlandı'}
                {isError && 'Hata Oluştu'}
                {isAnalyzing && 'Analiz Yapılıyor'}
                {session.status === 'created' && 'Session Oluşturuldu'}
                {session.status === 'uploading' && 'Dosyalar Yükleniyor'}
              </h2>
              <p className="text-gray-600 text-sm">
                {progress?.message || 'İşlem devam ediyor...'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {isAnalyzing && progress && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>İlerleme</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {isError && session.errorMessage && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{session.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Files Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Yüklenen Dosyalar ({session.files.length})
          </h3>
          <div className="space-y-2">
            {session.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.filename}
                    {file.isExtractedFromZip && (
                      <span className="ml-2 text-xs text-blue-600">(ZIP'den çıkarıldı)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.mimeType} • {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results Card (if completed) */}
        {isCompleted && session.result && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Analiz Sonuçları</h3>

            {/* Documents Metadata */}
            {session.result.documents && session.result.documents.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Dökümanlar</h4>
                <div className="space-y-3">
                  {session.result.documents.map((doc: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-xs text-gray-500 mt-1">{doc.type}</p>
                        </div>
                        {doc.processedSuccessfully ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        {doc.pageCount && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Sayfa</p>
                            <p className="text-sm font-semibold text-gray-900">{doc.pageCount}</p>
                          </div>
                        )}
                        {doc.wordCount && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Kelime</p>
                            <p className="text-sm font-semibold text-gray-900">{doc.wordCount.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
                        {doc.charCount && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Karakter</p>
                            <p className="text-sm font-semibold text-gray-900">{doc.charCount.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
                        {doc.size && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Boyut</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {(doc.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        )}
                      </div>

                      {doc.error && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          {doc.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON - Collapsed by default */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 font-medium">
                Ham Veriyi Görüntüle (JSON)
              </summary>
              <div className="bg-gray-50 rounded-lg p-4 mt-2">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(session.result, null, 2)}
                </pre>
              </div>
            </details>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(session.result, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${session.id}_results.json`;
                  a.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Sonuçları İndir (JSON)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
