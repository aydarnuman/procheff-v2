/**
 * Ultra Seviye Logger Sistemi - Type Definitions
 * İhale analiz sürecinin her aşamasını detaylı takip eder
 */

// Log seviyeleri
export enum LogSeviye {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

// İşlem kategorileri
export enum LogKategori {
  UPLOAD = 'UPLOAD',           // Dosya yükleme
  VALIDATION = 'VALIDATION',   // Dosya validasyonu
  PROCESSING = 'PROCESSING',   // Dosya işleme (PDF, DOCX, CSV)
  OCR = 'OCR',                 // OCR işlemleri
  AI_ANALYSIS = 'AI_ANALYSIS', // AI analizi (Claude/Gemini)
  EXTRACTION = 'EXTRACTION',   // Veri çıkarma (tablolar, kategoriler)
  DATABASE = 'DATABASE',       // Supabase işlemleri
  COMPLETION = 'COMPLETION',   // İşlem tamamlanma
}

// İşlem durumu
export enum IslemDurumu {
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Ana log interface
export interface LogGirisi {
  id: string;                    // Unique log ID
  timestamp: number;             // Unix timestamp (ms)
  seviye: LogSeviye;            // Log seviyesi
  kategori: LogKategori;        // İşlem kategorisi
  mesaj: string;                // Ana mesaj
  detay?: string;               // Detaylı açıklama
  durum?: IslemDurumu;          // İşlem durumu
  progress?: number;            // İlerleme % (0-100)
  sure?: number;                // İşlem süresi (ms)
  metadata?: LogMetadata;       // Ek veriler
  hata?: LogHata;               // Hata bilgisi (varsa)
}

// Metadata interface
export interface LogMetadata {
  dosyaAdi?: string;            // İşlenen dosya adı
  dosyaBoyutu?: number;         // Dosya boyutu (bytes)
  dosyaTipi?: string;           // MIME type
  sayfaSayisi?: number;         // PDF sayfa sayısı
  kelimeSayisi?: number;        // Çıkarılan kelime sayısı
  karakterSayisi?: number;      // Karakter sayısı
  aiModel?: string;             // Kullanılan AI model
  tokenKullanimi?: number;      // Token kullanımı
  maliyetTL?: number;           // Maliyet (TL)
  memoryKullanimi?: number;     // Memory kullanımı (MB)
  altAdimlar?: string[];        // Alt-adım listesi
  ek?: Record<string, unknown>; // Ekstra key-value data
}

// Hata interface
export interface LogHata {
  kod?: string;                 // Hata kodu
  mesaj: string;                // Hata mesajı
  stack?: string;               // Stack trace
  iyilestirme?: string;         // Önerilen çözüm
}

// İşlem session tracking
export interface IslemSession {
  sessionId: string;            // Unique session ID
  baslangic: number;            // Başlangıç zamanı (ms)
  bitis?: number;               // Bitiş zamanı (ms)
  toplamSure?: number;          // Toplam süre (ms)
  durum: IslemDurumu;           // Session durumu
  logs: LogGirisi[];            // Bu session'a ait tüm loglar
  ozet?: IslemOzeti;            // İşlem özeti
}

// İşlem özeti
export interface IslemOzeti {
  toplamDosya: number;          // İşlenen dosya sayısı
  basarili: number;             // Başarılı işlem
  basarisiz: number;            // Başarısız işlem
  toplamSure: number;           // Toplam süre (ms)
  toplamToken?: number;         // Toplam token kullanımı
  toplamMaliyet?: number;       // Toplam maliyet (TL)
  ortalamaSure?: number;        // Ortalama işlem süresi (ms)
}

// Logger konfigürasyonu
export interface LoggerConfig {
  etkin: boolean;               // Logger aktif mi?
  seviye: LogSeviye;            // Minimum log seviyesi
  konsolaCikti: boolean;        // Console'a yazdır
  dosyayaKaydet?: boolean;      // File'a kaydet
  realtimeGonderim?: boolean;   // Real-time UI gönderimi
  detayliMetadata?: boolean;    // Detaylı metadata topla
  performansOlcumu?: boolean;   // Performance ölçümü yap
}

// Real-time log eventi (WebSocket/SSE için)
export interface LogEvent {
  type: 'log' | 'session-start' | 'session-end' | 'progress-update';
  sessionId?: string;
  log?: LogGirisi;
  session?: IslemSession;
  progress?: number;
}
