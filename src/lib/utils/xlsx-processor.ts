import * as XLSX from 'xlsx';
import { logger, LogKategori } from '@/lib/logger';

export interface XlsxProcessingResult {
  success: boolean;
  text: string;
  sheets: SheetData[];
  error?: string;
  totalRows: number;
  totalCells: number;
}

export interface SheetData {
  name: string;
  rows: number;
  cols: number;
  text: string;
}

/**
 * XLSX/XLS Processor Utility
 * Excel dosyalarını okur ve metin formatına çevirir
 */
export class XlsxProcessor {
  /**
   * Excel dosyasını işle ve tüm sheet'leri metin olarak çıkar
   */
  static async process(file: File, onProgress?: (message: string) => void): Promise<XlsxProcessingResult> {
    try {
      logger.info(LogKategori.PROCESSING, `📊 Excel işleme başladı: ${file.name}`, {
        dosyaAdi: file.name,
        dosyaBoyutu: file.size,
      });

      onProgress?.(`📊 Excel dosyası okunuyor: ${file.name}`);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load workbook
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellText: true,
        cellDates: true,
      });

      logger.info(LogKategori.PROCESSING, `📑 ${workbook.SheetNames.length} sheet bulundu`);
      onProgress?.(`📑 ${workbook.SheetNames.length} sheet işleniyor...`);

      const sheets: SheetData[] = [];
      const allTexts: string[] = [];
      let totalRows = 0;
      let totalCells = 0;

      // Process each sheet
      for (let i = 0; i < workbook.SheetNames.length; i++) {
        const sheetName = workbook.SheetNames[i];
        const worksheet = workbook.Sheets[sheetName];

        logger.debug(LogKategori.PROCESSING, `Sheet işleniyor: ${sheetName}`, {
          sheetAdi: sheetName,
        });

        onProgress?.(`⚙️ ${sheetName} işleniyor... (${i + 1}/${workbook.SheetNames.length})`);

        try {
          // Convert sheet to CSV format (easier to parse)
          const csv = XLSX.utils.sheet_to_csv(worksheet, {
            FS: '\t', // Tab separator
            RS: '\n', // Row separator
          });

          // Count rows and cells
          const rows = csv.split('\n').filter(row => row.trim().length > 0);
          const rowCount = rows.length;
          const cellCount = rows.reduce((sum, row) => sum + row.split('\t').length, 0);

          totalRows += rowCount;
          totalCells += cellCount;

          // Format as readable text
          const sheetText = this.formatSheetText(sheetName, csv);
          allTexts.push(sheetText);

          sheets.push({
            name: sheetName,
            rows: rowCount,
            cols: rows[0]?.split('\t').length || 0,
            text: sheetText,
          });

          logger.debug(LogKategori.PROCESSING, `✓ ${sheetName} tamamlandı`, {
            satirSayisi: rowCount,
            hucreSayisi: cellCount,
          });
        } catch (sheetError: any) {
          logger.uyari(LogKategori.PROCESSING, `${sheetName} işlenemedi: ${sheetError.message}`, {
            sheetAdi: sheetName,
            hata: sheetError.message,
          });
          // Continue with other sheets
        }
      }

      const combinedText = allTexts.join('\n\n');

      logger.basarili(LogKategori.PROCESSING, `Excel işleme tamamlandı: ${sheets.length} sheet`, {
        toplamSheet: sheets.length,
        toplamSatir: totalRows,
        toplamHucre: totalCells,
        karakterSayisi: combinedText.length,
      });

      onProgress?.(`✅ ${sheets.length} sheet işlendi (${totalRows} satır)`);

      return {
        success: true,
        text: combinedText,
        sheets,
        totalRows,
        totalCells,
      };
    } catch (error: any) {
      logger.hata(LogKategori.PROCESSING, `Excel işleme hatası: ${error.message}`, {
        kod: 'XLSX_PROCESSING_ERROR',
        mesaj: error.message,
        dosyaAdi: file.name,
      });

      return {
        success: false,
        text: '',
        sheets: [],
        error: error.message || 'Excel dosyası işlenemedi',
        totalRows: 0,
        totalCells: 0,
      };
    }
  }

  /**
   * Sheet'i okunabilir metin formatına çevir
   */
  private static formatSheetText(sheetName: string, csv: string): string {
    const lines: string[] = [];

    lines.push(`=== SHEET: ${sheetName} ===`);
    lines.push('');

    // Parse CSV rows
    const rows = csv.split('\n').filter(row => row.trim().length > 0);

    // Add header row (if exists)
    if (rows.length > 0) {
      const headers = rows[0].split('\t');
      lines.push(`📋 Sütunlar: ${headers.join(' | ')}`);
      lines.push('─'.repeat(80));
    }

    // Add data rows
    rows.forEach((row, index) => {
      if (index === 0) return; // Skip header (already added)

      const cells = row.split('\t');
      const formattedRow = cells
        .map((cell, cellIndex) => {
          const header = rows[0]?.split('\t')[cellIndex] || `Col${cellIndex + 1}`;
          return `${header}: ${cell}`;
        })
        .join(' | ');

      lines.push(`${index}. ${formattedRow}`);
    });

    lines.push('');

    return lines.join('\n');
  }
}
