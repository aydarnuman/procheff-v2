/**
 * Log Formatters - Console ve File için formatting
 */

import { LogGirisi, LogKategori, LogSeviye, IslemDurumu } from './types';

// Emoji mapping
const KATEGORI_EMOJI: Record<LogKategori, string> = {
  [LogKategori.UPLOAD]: '📤',
  [LogKategori.VALIDATION]: '✓',
  [LogKategori.PROCESSING]: '⚙️',
  [LogKategori.OCR]: '👁️',
  [LogKategori.AI_ANALYSIS]: '🤖',
  [LogKategori.EXTRACTION]: '📊',
  [LogKategori.DATABASE]: '💾',
  [LogKategori.COMPLETION]: '🎯',
};

const SEVIYE_EMOJI: Record<LogSeviye, string> = {
  [LogSeviye.DEBUG]: '🔍',
  [LogSeviye.INFO]: 'ℹ️',
  [LogSeviye.WARN]: '⚠️',
  [LogSeviye.ERROR]: '❌',
  [LogSeviye.SUCCESS]: '✅',
};

const DURUM_EMOJI: Record<IslemDurumu, string> = {
  [IslemDurumu.STARTED]: '▶️',
  [IslemDurumu.IN_PROGRESS]: '⏳',
  [IslemDurumu.COMPLETED]: '✅',
  [IslemDurumu.FAILED]: '❌',
  [IslemDurumu.CANCELLED]: '⛔',
};

/**
 * Console için renkli format
 */
export const formatLogKonsol = (log: LogGirisi): string => {
  const timestamp = new Date(log.timestamp).toISOString().split('T')[1].split('.')[0];
  const kategoriEmoji = KATEGORI_EMOJI[log.kategori];
  const seviyeEmoji = SEVIYE_EMOJI[log.seviye];

  let logStr = `[${timestamp}] ${seviyeEmoji} ${kategoriEmoji} ${log.kategori}`;

  // Durum varsa ekle
  if (log.durum) {
    const durumEmoji = DURUM_EMOJI[log.durum];
    logStr += ` ${durumEmoji}`;
  }

  // Progress varsa ekle
  if (log.progress !== undefined) {
    const progressBar = olusturProgressBar(log.progress);
    logStr += ` [${progressBar}] ${log.progress}%`;
  }

  // Mesaj
  logStr += `\n  ${log.mesaj}`;

  // Detay varsa
  if (log.detay) {
    logStr += `\n    └─ ${log.detay}`;
  }

  // Süre varsa
  if (log.sure !== undefined) {
    const sureStr = log.sure < 1000
      ? `${log.sure}ms`
      : `${(log.sure / 1000).toFixed(2)}s`;
    logStr += `\n    ⏱️ Süre: ${sureStr}`;
  }

  // Metadata varsa
  if (log.metadata) {
    const metadataStr = formatMetadata(log.metadata);
    if (metadataStr) {
      logStr += `\n    📋 ${metadataStr}`;
    }
  }

  // Hata varsa
  if (log.hata) {
    logStr += `\n    ❌ Hata: ${log.hata.mesaj}`;
    if (log.hata.kod) {
      logStr += ` [${log.hata.kod}]`;
    }
    if (log.hata.iyilestirme) {
      logStr += `\n    💡 Öneri: ${log.hata.iyilestirme}`;
    }
  }

  return logStr;
};

/**
 * Dosya için JSON format
 */
export const formatLogDosya = (log: LogGirisi): string => {
  return JSON.stringify({
    timestamp: new Date(log.timestamp).toISOString(),
    seviye: log.seviye,
    kategori: log.kategori,
    mesaj: log.mesaj,
    detay: log.detay,
    durum: log.durum,
    progress: log.progress,
    sure: log.sure,
    metadata: log.metadata,
    hata: log.hata,
  });
};

/**
 * Progress bar oluştur (ASCII)
 */
const olusturProgressBar = (progress: number, width: number = 20): string => {
  const dolu = Math.round((progress / 100) * width);
  const bos = width - dolu;
  return '█'.repeat(dolu) + '░'.repeat(bos);
};

/**
 * Metadata formatla
 */
const formatMetadata = (metadata: LogGirisi['metadata']): string => {
  if (!metadata) return '';

  const parts: string[] = [];

  if (metadata.dosyaAdi) {
    parts.push(`Dosya: ${metadata.dosyaAdi}`);
  }

  if (metadata.dosyaBoyutu) {
    parts.push(`Boyut: ${formatBoyut(metadata.dosyaBoyutu)}`);
  }

  if (metadata.sayfaSayisi) {
    parts.push(`Sayfa: ${metadata.sayfaSayisi}`);
  }

  if (metadata.kelimeSayisi) {
    parts.push(`Kelime: ${metadata.kelimeSayisi.toLocaleString()}`);
  }

  if (metadata.karakterSayisi) {
    parts.push(`Karakter: ${metadata.karakterSayisi.toLocaleString()}`);
  }

  if (metadata.aiModel) {
    parts.push(`Model: ${metadata.aiModel}`);
  }

  if (metadata.tokenKullanimi) {
    parts.push(`Token: ${metadata.tokenKullanimi.toLocaleString()}`);
  }

  if (metadata.maliyetTL) {
    parts.push(`Maliyet: ₺${metadata.maliyetTL.toFixed(4)}`);
  }

  if (metadata.memoryKullanimi) {
    parts.push(`Memory: ${metadata.memoryKullanimi.toFixed(2)} MB`);
  }

  if (metadata.altAdimlar && metadata.altAdimlar.length > 0) {
    parts.push(`Alt-adımlar: ${metadata.altAdimlar.length}`);
  }

  return parts.join(' | ');
};

/**
 * Byte formatla (KB, MB)
 */
const formatBoyut = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * İşlem özeti formatla
 */
export const formatOzet = (session: any): string => {
  if (!session.ozet) return '';

  const { ozet } = session;
  let str = '\n╔════════════════════════════════════════════╗\n';
  str += '║         İŞLEM ÖZETİ                        ║\n';
  str += '╠════════════════════════════════════════════╣\n';
  str += `║ Toplam Dosya    : ${ozet.toplamDosya.toString().padEnd(20)}║\n`;
  str += `║ Başarılı        : ${ozet.basarili.toString().padEnd(20)}║\n`;
  str += `║ Başarısız       : ${ozet.basarisiz.toString().padEnd(20)}║\n`;
  str += `║ Toplam Süre     : ${(ozet.toplamSure / 1000).toFixed(2)}s`.padEnd(44) + '║\n';

  if (ozet.toplamToken) {
    str += `║ Toplam Token    : ${ozet.toplamToken.toLocaleString().padEnd(20)}║\n`;
  }

  if (ozet.toplamMaliyet) {
    str += `║ Toplam Maliyet  : ₺${ozet.toplamMaliyet.toFixed(4).padEnd(19)}║\n`;
  }

  str += '╚════════════════════════════════════════════╝\n';

  return str;
};
