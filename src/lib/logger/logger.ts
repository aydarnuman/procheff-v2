/**
 * Ultra Seviye Logger - Ana Class
 * İhale analiz sürecinin her aşamasını milisaniye hassasiyetinde loglar
 */

import {
  LogGirisi,
  LogKategori,
  LogSeviye,
  IslemDurumu,
  IslemSession,
  LogMetadata,
  LogHata,
  LoggerConfig,
  IslemOzeti,
} from './types';
import { formatLogKonsol, formatLogDosya } from './formatters';

class UltraLogger {
  private config: LoggerConfig;
  private aktifSession: IslemSession | null = null;
  private sessionBaslangic: Map<string, number> = new Map();
  private listeners: Array<(log: LogGirisi) => void> = [];

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      etkin: true,
      seviye: LogSeviye.DEBUG,
      konsolaCikti: true,
      dosyayaKaydet: false,
      realtimeGonderim: true,
      detayliMetadata: true,
      performansOlcumu: true,
      ...config,
    };
  }

  /**
   * Yeni session başlat
   */
  sessionBaslat(sessionId: string): void {
    const simdi = Date.now();
    this.aktifSession = {
      sessionId,
      baslangic: simdi,
      durum: IslemDurumu.STARTED,
      logs: [],
    };
    this.sessionBaslangic.set(sessionId, simdi);

    this.log(LogSeviye.INFO, LogKategori.UPLOAD, '🚀 İşlem başladı', {
      detay: `Session ID: ${sessionId}`,
      durum: IslemDurumu.STARTED,
    });
  }

  /**
   * Session'ı bitir
   */
  sessionBitir(sessionId: string, durum: IslemDurumu = IslemDurumu.COMPLETED): IslemSession | null {
    if (!this.aktifSession || this.aktifSession.sessionId !== sessionId) {
      // Paralel isteklerde önceki stream kapanırken çağrılabilir; normal durum.
      // Gürültüyü azaltmak için bilgi seviyesinde loglayalım.
      console.info(`[LOGGER] Parallel/finished session mismatch (normal): ${sessionId}`);
      return null;
    }

    const simdi = Date.now();
    const baslangic = this.sessionBaslangic.get(sessionId);
    const toplamSure = baslangic ? simdi - baslangic : 0;

    this.aktifSession.bitis = simdi;
    this.aktifSession.toplamSure = toplamSure;
    this.aktifSession.durum = durum;
    this.aktifSession.ozet = this.ozetHesapla(this.aktifSession.logs);

    const emoji = durum === IslemDurumu.COMPLETED ? '✅' : '❌';
    this.log(LogSeviye.SUCCESS, LogKategori.COMPLETION, `${emoji} İşlem tamamlandı`, {
      detay: `Toplam süre: ${(toplamSure / 1000).toFixed(2)}s`,
      durum,
      sure: toplamSure,
      metadata: {
        ek: { toplamLog: this.aktifSession.logs.length },
      },
    });

    const tamamlananSession = { ...this.aktifSession };
    this.aktifSession = null;
    this.sessionBaslangic.delete(sessionId);

    return tamamlananSession;
  }

  /**
   * Ana log fonksiyonu
   */
  log(
    seviye: LogSeviye,
    kategori: LogKategori,
    mesaj: string,
    ekstra?: {
      detay?: string;
      durum?: IslemDurumu;
      progress?: number;
      sure?: number;
      metadata?: Partial<LogMetadata>;
    }
  ): void {
    if (!this.config.etkin) return;

    const logGirisi: LogGirisi = {
      id: this.logIdOlustur(),
      timestamp: Date.now(),
      seviye,
      kategori,
      mesaj,
      detay: ekstra?.detay,
      durum: ekstra?.durum,
      progress: ekstra?.progress,
      sure: ekstra?.sure,
      metadata: ekstra?.metadata as LogMetadata,
    };

    // Session'a ekle
    if (this.aktifSession) {
      this.aktifSession.logs.push(logGirisi);
    }

    // Console'a yazdır
    if (this.config.konsolaCikti) {
      console.log(formatLogKonsol(logGirisi));
    }

    // Listeners'a bildir (real-time UI için)
    if (this.config.realtimeGonderim) {
      this.listeners.forEach((listener) => listener(logGirisi));
    }

    // Dosyaya kaydet (isteğe bağlı)
    if (this.config.dosyayaKaydet) {
      this.dosyayaKaydet(logGirisi);
    }
  }

  /**
   * Debug log
   */
  debug(kategori: LogKategori, mesaj: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogSeviye.DEBUG, kategori, mesaj, { metadata });
  }

  /**
   * Info log
   */
  info(kategori: LogKategori, mesaj: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogSeviye.INFO, kategori, mesaj, { metadata });
  }

  /**
   * Warning log
   */
  uyari(kategori: LogKategori, mesaj: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogSeviye.WARN, kategori, mesaj, { metadata });
  }

  /**
   * Success log
   */
  basarili(kategori: LogKategori, mesaj: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogSeviye.SUCCESS, kategori, mesaj, { metadata });
  }

  /**
   * Error log
   */
  hata(kategori: LogKategori, mesaj: string, hata?: Partial<LogHata>): void {
    const logGirisi: LogGirisi = {
      id: this.logIdOlustur(),
      timestamp: Date.now(),
      seviye: LogSeviye.ERROR,
      kategori,
      mesaj,
      hata: hata as LogHata,
    };

    if (this.aktifSession) {
      this.aktifSession.logs.push(logGirisi);
    }

    console.error(formatLogKonsol(logGirisi));
    this.listeners.forEach((listener) => listener(logGirisi));
  }

  /**
   * Progress güncelleme
   */
  progressGuncelle(kategori: LogKategori, mesaj: string, progress: number, metadata?: Partial<LogMetadata>): void {
    this.log(LogSeviye.INFO, kategori, mesaj, {
      durum: IslemDurumu.IN_PROGRESS,
      progress,
      metadata,
    });
  }

  /**
   * Adım başlat (timing için)
   */
  adimBaslat(adimId: string): void {
    this.sessionBaslangic.set(adimId, Date.now());
  }

  /**
   * Adım bitir (timing ile)
   */
  adimBitir(adimId: string, kategori: LogKategori, mesaj: string, metadata?: Partial<LogMetadata>): void {
    const baslangic = this.sessionBaslangic.get(adimId);
    const sure = baslangic ? Date.now() - baslangic : 0;
    this.sessionBaslangic.delete(adimId);

    this.log(LogSeviye.INFO, kategori, mesaj, {
      sure,
      metadata: {
        ...metadata,
      },
    });
  }

  /**
   * Real-time listener ekle
   */
  onLog(callback: (log: LogGirisi) => void): () => void {
    this.listeners.push(callback);
    // Unsubscribe fonksiyonu döndür
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Aktif session'ı al
   */
  getAktifSession(): IslemSession | null {
    return this.aktifSession;
  }

  /**
   * Config güncelle
   */
  configGuncelle(yeniConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...yeniConfig };
  }

  // ===== PRIVATE METHODLAR =====

  private logIdOlustur(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private ozetHesapla(logs: LogGirisi[]): IslemOzeti {
    const basarili = logs.filter((l) => l.seviye === LogSeviye.SUCCESS).length;
    const basarisiz = logs.filter((l) => l.seviye === LogSeviye.ERROR).length;
    const toplamSure = logs.reduce((acc, l) => acc + (l.sure || 0), 0);
    const toplamToken = logs.reduce((acc, l) => acc + (l.metadata?.tokenKullanimi || 0), 0);
    const toplamMaliyet = logs.reduce((acc, l) => acc + (l.metadata?.maliyetTL || 0), 0);

    return {
      toplamDosya: logs.filter((l) => l.kategori === LogKategori.UPLOAD).length,
      basarili,
      basarisiz,
      toplamSure,
      toplamToken: toplamToken > 0 ? toplamToken : undefined,
      toplamMaliyet: toplamMaliyet > 0 ? toplamMaliyet : undefined,
      ortalamaSure: logs.length > 0 ? toplamSure / logs.length : 0,
    };
  }

  private dosyayaKaydet(log: LogGirisi): void {
    // File logging için (şimdilik console'a yazdır)
    // Production'da fs kullanılabilir veya external service'e gönderilebilir
    if (typeof window === 'undefined') {
      // Server-side
      const formattedLog = formatLogDosya(log);
      // TODO: Append to log file
      console.log('[FILE LOG]', formattedLog);
    }
  }
}

// Singleton instance
const logger = new UltraLogger();

export default logger;
export { UltraLogger };
