// ============================================================================
// TENDER SESSION TYPES
// Yeni mimari için TypeScript interface tanımları
// ============================================================================

/**
 * Tender Session Status
 */
export type TenderSessionStatus =
  | 'created'      // Session oluşturuldu
  | 'uploading'    // Dosyalar yükleniyor
  | 'uploaded'     // Dosyalar yüklendi
  | 'analyzing'    // AI analizi yapılıyor
  | 'completed'    // Analiz tamamlandı
  | 'error';       // Hata oluştu

/**
 * Tender Session Source
 */
export type TenderSessionSource = 'ihalebul' | 'manual';

/**
 * Tender File Interface
 */
export interface TenderFile {
  id: string;                       // UUID
  sessionId: string;                // Session ID
  filename: string;                 // Dosya adı
  originalFilename?: string;        // Orijinal dosya adı (ZIP içinden çıkanlar için)
  mimeType: string;                 // MIME type (file-type detection ile)
  size: number;                     // Dosya boyutu (bytes)
  storagePath: string;              // Dosya yolu (data/sessions/{sessionId}/{filename})
  isExtractedFromZip?: boolean;     // ZIP'den çıkarıldı mı?
  parentZipId?: string;             // Parent ZIP file ID (varsa)
  uploadedAt: string;               // Upload zamanı (ISO 8601)
}

/**
 * Tender Session Interface
 */
export interface TenderSession {
  id: string;                       // tender_20251105_123456
  userId?: string;                  // Kullanıcı ID (opsiyonel)
  source: TenderSessionSource;      // 'ihalebul' | 'manual'
  tenderId?: number;                // İhale ID (ihale_listings.id)
  status: TenderSessionStatus;      // Session durumu
  files: TenderFile[];              // Session'a ait dosyalar
  result?: AnalysisResult;          // AI analiz sonucu
  errorMessage?: string;            // Hata mesajı (varsa)
  createdAt: string;                // Oluşturulma zamanı (ISO 8601)
  updatedAt: string;                // Güncellenme zamanı (ISO 8601)
}

/**
 * Analysis Progress (for SSE streaming)
 */
export interface AnalysisProgress {
  sessionId: string;
  stage: AnalysisStage;
  currentFile?: string;
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  message: string;
  error?: string;
}

/**
 * Analysis Stage
 */
export type AnalysisStage =
  | 'starting'              // Analiz başlatılıyor
  | 'fetching_documents'    // Dökümanlar getiriliyor
  | 'extracting_files'      // Dosyalar çıkarılıyor (ZIP)
  | 'processing_files'      // Dosyalar işleniyor
  | 'analyzing_content'     // İçerik analiz ediliyor
  | 'calculating_costs'     // Maliyetler hesaplanıyor
  | 'finalizing'            // Sonuçlar hazırlanıyor
  | 'completed'             // Tamamlandı
  | 'error';                // Hata oluştu

/**
 * Analysis Result (AI analiz sonucu)
 */
export interface AnalysisResult {
  // İhale bilgileri
  tenderInfo?: {
    title?: string;
    organization?: string;
    city?: string;
    registrationNumber?: string;
    announcementDate?: string;
    tenderDate?: string;
    deadlineDate?: string;
    budget?: number;
  };

  // Kategorileme
  categorization?: {
    isCatering: boolean;
    confidence: number;
    reasoning: string;
  };

  // Mal/Hizmet kalemleri
  items?: Array<{
    itemNumber: number;
    itemName: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
  }>;

  // Maliyet analizi
  costAnalysis?: {
    totalBudget?: number;
    totalMealQuantity?: number;
    estimatedBudgetFromItems?: number;
    breakdown?: any;
  };

  // Döküman bilgileri
  documents?: Array<{
    filename: string;
    type: string;
    size?: number;
    wordCount?: number;
    charCount?: number;
    pageCount?: number;
    processedSuccessfully: boolean;
    error?: string;
  }>;

  // AI metadata
  aiMetadata?: {
    analyzedAt: string;
    model: string;
    tokensUsed?: number;
  };
}

/**
 * Session Creation Request
 */
export interface CreateSessionRequest {
  source: TenderSessionSource;
  tenderId?: number;
  userId?: string;
}

/**
 * Session Creation Response
 */
export interface CreateSessionResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * File Upload Request (multipart/form-data)
 */
export interface UploadFileRequest {
  sessionId: string;
  file: File;
}

/**
 * File Upload Response
 */
export interface UploadFileResponse {
  success: boolean;
  fileId?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  extractedFiles?: Array<{
    fileId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  error?: string;
}

/**
 * Start Analysis Request
 */
export interface StartAnalysisRequest {
  sessionId: string;
}

/**
 * Start Analysis Response
 */
export interface StartAnalysisResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Get Session Response
 */
export interface GetSessionResponse {
  success: boolean;
  session?: TenderSession;
  error?: string;
}
